"""Provider adapters behind one interface, plus the factory that builds them.

Every adapter returns the same shape - a parsed object, the provider and model
that actually produced it, and token counters - so a failover never hides
which model answered. Model names only ever arrive from a catalog entry built
by the server.
"""

import json
import logging
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass

import httpx

from app.ai.catalog import ModelEntry
from app.core.config import settings
from app.core.errors import AppError

logger = logging.getLogger("vulnix.ai")


@dataclass(frozen=True)
class ProviderResult:
    data: dict
    provider: str
    model: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


class AIProvider(ABC):
    name: str = "provider"

    @abstractmethod
    def generate(self, system: str, user: str) -> ProviderResult: ...


def _validate_json_object(content: str, provider_name: str) -> dict:
    """Parse a provider's text reply and require a JSON object."""
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        logger.warning("ai_invalid_output provider=%s reason=parse", provider_name)
        raise AppError("AI_INVALID_OUTPUT", "The reviewer's answer could not be read.", 502) from None
    if not isinstance(data, dict):
        logger.warning("ai_invalid_output provider=%s reason=not_object", provider_name)
        raise AppError("AI_INVALID_OUTPUT", "The reviewer's answer was not an object.", 502)
    return data


def _count(value: object) -> int | None:
    return value if isinstance(value, int) and value >= 0 else None


# Statuses worth asking again about: the reviewer is throttling, restarting or
# shedding load. Anything else it returns is an answer rather than a delay.
_RETRYABLE_STATUS = frozenset({408, 409, 425, 429, 500, 502, 503, 504, 520, 521, 522, 524})


def _post(
    url: str,
    *,
    headers: dict | None,
    payload: dict,
    timeout: float,
    provider_name: str,
) -> dict:
    """POST once and classify the outcome for the caller's retry loop.

    A transport failure and a busy status both mean "ask again", while a refusal
    means "asking again will not help". Collapsing the two into one code - as
    raise_for_status does - is what made a wrong API key look like an outage.
    Only the status is logged: a provider's error body can echo the prompt.
    """
    try:
        resp = httpx.post(url, headers=headers, json=payload, timeout=timeout)
    except httpx.HTTPError:
        logger.warning("ai_provider_unreachable provider=%s", provider_name)
        raise AppError("AI_UNAVAILABLE", "That reviewer is not answering right now.", 503) from None

    if not resp.is_success:
        if resp.status_code in _RETRYABLE_STATUS:
            logger.warning("ai_provider_busy provider=%s status=%s", provider_name, resp.status_code)
            raise AppError("AI_UNAVAILABLE", "That reviewer is not answering right now.", 503)
        logger.warning("ai_provider_refused provider=%s status=%s", provider_name, resp.status_code)
        raise AppError("AI_MISCONFIGURED", "The reviewer rejected that request.", 502)

    try:
        body = resp.json()
    except ValueError:
        # A proxy or gateway answering 200 with HTML is an unreadable reply, not
        # a crash: report it as one so the caller can ask again.
        logger.warning("ai_provider_unreadable_body provider=%s", provider_name)
        raise AppError("AI_INVALID_OUTPUT", "The reviewer's answer could not be read.", 502) from None
    if not isinstance(body, dict):
        logger.warning("ai_provider_unreadable_body provider=%s reason=not_object", provider_name)
        raise AppError("AI_INVALID_OUTPUT", "The reviewer's answer could not be read.", 502)
    return body


class OllamaProvider(AIProvider):
    """Talks to a local Ollama server via its chat API."""

    name = "ollama"

    def __init__(self, model: str) -> None:
        self.model = model
        if not settings.ai_base_url:
            raise AppError("AI_MISCONFIGURED", "No reviewer is configured here.", 503)

    def generate(self, system: str, user: str) -> ProviderResult:
        payload = {
            "model": self.model,
            "stream": False,
            "format": "json",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        # Keep an explicit opt-out for deployments prioritizing lower latency.
        if settings.ai_disable_think:
            payload["think"] = False
        payload["options"] = {"num_ctx": settings.ai_num_ctx}
        body = _post(
            f"{settings.ai_base_url.rstrip('/')}/api/chat",
            headers=None,
            payload=payload,
            timeout=settings.ai_timeout_seconds,
            provider_name=self.name,
        )
        message = body.get("message") or {}
        data = _validate_json_object(message.get("content", ""), self.name)
        return ProviderResult(
            data=data,
            provider=self.name,
            model=str(body.get("model") or self.model),
            prompt_tokens=_count(body.get("prompt_eval_count")),
            completion_tokens=_count(body.get("eval_count")),
        )


class GroqProvider(AIProvider):
    """Talks to Groq's OpenAI-compatible chat completions API."""

    name = "groq"

    def __init__(self, model: str) -> None:
        self.model = model
        if not settings.groq_ready:
            raise AppError("AI_MISCONFIGURED", "No reviewer is configured here.", 503)

    def generate(self, system: str, user: str) -> ProviderResult:
        body = _post(
            f"{settings.groq_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            payload={
                "model": self.model,
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            },
            timeout=settings.ai_fallback_timeout_seconds,
            provider_name=self.name,
        )
        choices = body.get("choices") or []
        content = (choices[0].get("message") or {}).get("content", "") if choices else ""
        usage = body.get("usage") or {}
        data = _validate_json_object(content, self.name)
        return ProviderResult(
            data=data,
            provider=self.name,
            model=str(body.get("model") or self.model),
            prompt_tokens=_count(usage.get("prompt_tokens")),
            completion_tokens=_count(usage.get("completion_tokens")),
        )


class FallbackProvider(AIProvider):
    """Tries the primary provider, then the fallback on availability failure."""

    def __init__(self, primary: AIProvider, fallback: AIProvider):
        self.primary = primary
        self._fallback = fallback

    @property
    def name(self) -> str:
        return f"{self.primary.name}+{self._fallback.name}"

    def generate(self, system: str, user: str) -> ProviderResult:
        try:
            return self.primary.generate(system, user)
        except AppError as exc:
            # Only availability/misconfig issues are worth falling back on;
            # schema/parse failures mean the response shape is wrong, not the provider.
            if exc.code not in {"AI_UNAVAILABLE", "AI_MISCONFIGURED"}:
                raise
            logger.warning("ai_fallback_triggered primary=%s code=%s", self.primary.name, exc.code)
            return self._fallback.generate(system, user)


def build_provider(entry: ModelEntry) -> AIProvider | None:
    """Construct the provider for a catalog entry, with failover where it helps."""
    factories: dict[str, Callable[[], AIProvider]] = {
        "ollama": lambda: OllamaProvider(entry.model),
        "groq": lambda: GroqProvider(entry.model),
    }
    factory = factories.get(entry.provider)
    if factory is None:
        return None
    primary = factory()
    # A local model that is not running, or too slow to be useful, is exactly
    # what the hosted fallback is for. A hosted primary has nothing to fall back to.
    if (
        entry.provider == "ollama"
        and settings.ai_fallback_enabled
        and settings.ai_fallback_provider == "groq"
        and settings.groq_ready
    ):
        return FallbackProvider(primary, GroqProvider(settings.ai_fallback_model))
    return primary


def provider_for(entry: ModelEntry) -> AIProvider:
    provider = build_provider(entry)
    if provider is None:
        raise AppError("AI_DISABLED", "No reviewer is enabled on this deployment.", 503)
    return provider
