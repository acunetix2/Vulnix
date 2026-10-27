"""Provider adapters behind one interface, plus the factory that builds them.

Every adapter returns the same shape - a parsed object, the provider and model
that actually produced it, and token counters - so a failover never hides
which model answered. Model names only ever arrive from a catalog entry built
by the server.
"""

import json
import logging
import re
import threading
import time
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass

import httpx

from app.ai.catalog import ModelEntry, handover_model
from app.core.config import settings
from app.core.errors import AppError

logger = logging.getLogger("vulnix.ai")

# An outage is not a verdict on the code, but it is a reason to stop asking the
# provider that just failed. These codes mean "another reviewer may answer".
# A file too long for one window is included: the next reviewer may hold it.
_FALLBACK_CODES = frozenset({"AI_UNAVAILABLE", "AI_MISCONFIGURED", "AI_CONTEXT_OVERFLOW"})


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

# A vendor's machine-readable reason for refusing, which is the only part of its
# error object this server reads. Each tag must be a short plain token, because the
# message beside it often quotes the request back - and a review request is source
# code, which is never logged or stored.
_ERROR_TAG = re.compile(r"^[A-Za-z0-9_.-]{1,48}$")
# Refusals that mean "this input is wider than I can read". That is a property of
# the file, not of the reviewer, so the next link in the chain may hold it and the
# narrow one stays available for the files that do fit. Vendors spell the same tag
# snake_case or CamelCase, so it is compared with its punctuation removed.
_CONTEXT_TAGS = frozenset(
    {
        "contextlengthexceeded",
        "contextlengthtoolong",
        "contextwindowexceeded",
        "inputtokenlimitexceeded",
        "inputtoolong",
        "promptistoolong",
    }
)
_NOT_ALNUM = re.compile(r"[^a-z0-9]+")


def _refusal_tag(body: str) -> str | None:
    """The refusing reviewer's own short reason code, or None if it sent none."""
    try:
        parsed = json.loads(body)
    except ValueError:
        return None
    error = parsed.get("error") if isinstance(parsed, dict) else None
    if not isinstance(error, dict):
        return None
    for field in ("code", "type", "status"):
        tag = error.get(field)
        if isinstance(tag, str) and _ERROR_TAG.match(tag):
            return _NOT_ALNUM.sub("", tag.lower())
    return None


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
    raise_for_status does - is what made a wrong API key look like an outage. The
    status and the reviewer's own short reason code are logged; its message is not,
    because that often quotes the prompt back.
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
        tag = _refusal_tag(resp.text[:65_536])
        if tag in _CONTEXT_TAGS:
            # The reviewer is healthy and said no to *this* file. Reported as an
            # overflow so the chain moves to a wider one instead of parking this
            # one for an outage it did not have.
            logger.info(
                "ai_provider_too_narrow provider=%s status=%s reason=%s",
                provider_name,
                resp.status_code,
                tag,
            )
            raise AppError(
                "AI_CONTEXT_OVERFLOW",
                "This file is longer than that reviewer can read at once.",
                413,
            )
        logger.warning(
            "ai_provider_refused provider=%s status=%s reason=%s",
            provider_name,
            resp.status_code,
            tag or "unreported",
        )
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


def _chat_payload(model: str, system: str, user: str) -> dict:
    """One OpenAI-compatible request: strict JSON, low temperature, bounded reply.

    The cap is the token discipline. A review prompt asks for a small object, so
    an answer that runs past it is a reviewer that stopped following the schema,
    and paying for the rest of its context would not make it a finding.
    """
    payload: dict = {
        "model": model,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    if settings.ai_max_output_tokens > 0:
        payload["max_tokens"] = settings.ai_max_output_tokens
    return payload


def _chat_result(body: dict, provider_name: str, requested_model: str) -> ProviderResult:
    """Read one OpenAI-compatible completion, refusing a truncated answer."""
    choices = body.get("choices") or []
    choice = choices[0] if choices and isinstance(choices[0], dict) else {}
    if choice.get("finish_reason") == "length":
        # Retrying a capped answer buys the same truncation again, so this is
        # reported rather than asked for.
        logger.warning("ai_output_truncated provider=%s", provider_name)
        raise AppError("AI_OUTPUT_TRUNCATED", "The reviewer's answer was cut short.", 502)
    content = (choice.get("message") or {}).get("content", "")
    usage = body.get("usage") or {}
    data = _validate_json_object(content, provider_name)
    return ProviderResult(
        data=data,
        provider=provider_name,
        model=str(body.get("model") or requested_model),
        prompt_tokens=_count(usage.get("prompt_tokens")),
        completion_tokens=_count(usage.get("completion_tokens")),
    )


def _approx_tokens(text: str) -> int:
    """A rough token count, four characters to the token.

    Only ever used to decide whether a prompt is comfortably inside a window, so
    the estimate is deliberately coarse: it exists so an oversized review is
    never sent and never billed.
    """
    return (len(text) + 3) // 4


class _OpenAIChatProvider(AIProvider):
    """One OpenAI-compatible chat completions endpoint.

    The three hosted reviewers all speak this API, so only the credential, the
    address, the timeout and the context window differ. Keeping the request shape
    here means a cap or a truncation check cannot be applied to one provider and
    missed on another.
    """

    @property
    def _ready(self) -> bool:
        raise NotImplementedError

    @property
    def _base_url(self) -> str:
        raise NotImplementedError

    @property
    def _api_key(self) -> str:
        raise NotImplementedError

    @property
    def _timeout(self) -> int:
        raise NotImplementedError

    @property
    def _context_tokens(self) -> int:
        """What this reviewer can hold. Zero means no check is applied."""
        return 0

    def __init__(self, model: str) -> None:
        self.model = model
        if not self._ready:
            raise AppError("AI_MISCONFIGURED", "No reviewer is configured here.", 503)

    def generate(self, system: str, user: str) -> ProviderResult:
        window = self._context_tokens
        if window > 0:
            room = window - max(settings.ai_max_output_tokens, 0)
            if _approx_tokens(system) + _approx_tokens(user) > room:
                # Refuse before the request: this provider would reject it anyway,
                # and sending it would spend input tokens on a guaranteed failure.
                # Another reviewer in the chain may still have the room for it.
                logger.info("ai_context_overflow provider=%s window=%s", self.name, window)
                raise AppError(
                    "AI_CONTEXT_OVERFLOW",
                    "This file is longer than that reviewer can read at once.",
                    413,
                )
        body = _post(
            f"{self._base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {self._api_key}"},
            payload=_chat_payload(self.model, system, user),
            timeout=self._timeout,
            provider_name=self.name,
        )
        return _chat_result(body, self.name, self.model)


class GroqProvider(_OpenAIChatProvider):
    """Groq: the balanced hosted reviewer."""

    name = "groq"

    @property
    def _ready(self) -> bool:
        return settings.groq_ready

    @property
    def _base_url(self) -> str:
        return settings.groq_base_url

    @property
    def _api_key(self) -> str:
        return settings.groq_api_key

    @property
    def _timeout(self) -> int:
        return settings.ai_fallback_timeout_seconds

    @property
    def _context_tokens(self) -> int:
        return settings.ai_fallback_context_tokens


class GeminiProvider(_OpenAIChatProvider):
    """Google AI Studio: the long-context reviewer in the failover chain."""

    name = "gemini"

    @property
    def _ready(self) -> bool:
        return settings.gemini_ready

    @property
    def _base_url(self) -> str:
        return settings.gemini_base_url

    @property
    def _api_key(self) -> str:
        return settings.gemini_api_key

    @property
    def _timeout(self) -> int:
        return settings.ai_gemini_timeout_seconds

    @property
    def _context_tokens(self) -> int:
        return settings.ai_gemini_context_tokens


class OpenRouterProvider(_OpenAIChatProvider):
    """OpenRouter: the last link, and the narrowest window of the three."""

    name = "openrouter"

    @property
    def _ready(self) -> bool:
        return settings.openrouter_ready

    @property
    def _base_url(self) -> str:
        return settings.openrouter_base_url

    @property
    def _api_key(self) -> str:
        return settings.openrouter_api_key

    @property
    def _timeout(self) -> int:
        return settings.ai_openrouter_timeout_seconds

    @property
    def _context_tokens(self) -> int:
        return settings.ai_openrouter_context_tokens


# Providers that recently failed, and when to ask one again.
_down_until: dict[str, float] = {}
_health_lock = threading.Lock()


def is_available(provider_name: str) -> bool:
    """Whether this provider may be asked now, given its last failure."""
    with _health_lock:
        until = _down_until.get(provider_name)
        if until is None:
            return True
        if time.monotonic() < until:
            return False
        _down_until.pop(provider_name, None)
        return True


def mark_down(provider_name: str) -> None:
    seconds = float(settings.ai_provider_cooldown_seconds)
    if seconds <= 0:
        return
    with _health_lock:
        _down_until[provider_name] = time.monotonic() + seconds


def mark_healthy(provider_name: str) -> None:
    with _health_lock:
        _down_until.pop(provider_name, None)


def seconds_until_available(provider_name: str) -> float:
    """Seconds left on this reviewer's rest. Zero when it may be asked again."""
    with _health_lock:
        until = _down_until.get(provider_name)
        if until is None:
            return 0.0
        return max(0.0, until - time.monotonic())


class FallbackProvider(AIProvider):
    """Asks each reviewer in turn, skipping any that is cooling down.

    The audit's own retry loop is what makes this necessary: without the
    cooldown, every attempt of every file would knock on the dead reviewer
    first, paying its timeout before reaching the one that answers. A failed
    link is parked for `ai_provider_cooldown_seconds` and the next link takes
    the file, so an outage costs one failure per reviewer rather than one per
    attempt. Only a call that answered is ever charged, so handover itself is
    free - what it spends is the dead reviewer's timeout, once.

    Each link is constructed only when it is reached, so a half-configured
    failover target cannot break a healthy primary.
    """

    def __init__(self, primary: AIProvider, *chain: Callable[[], AIProvider]):
        self.primary = primary
        self._chain = list(chain)
        # Reviewers this chain has actually reached, so the wait for a resting one
        # can be measured instead of guessed. A link is only named once it exists,
        # which keeps a half-configured failover target unbuilt.
        self._asked: set[str] = {primary.name}

    @property
    def name(self) -> str:
        # The head of the chain identifies it. Naming every link would mean
        # constructing reviewers that may not be configured.
        return self.primary.name

    def next_open_seconds(self) -> float:
        """Seconds until one reviewer this chain has used may be asked again.

        The audit's retry loop needs this. Without it a file that found every link
        parked slept through all of its attempts making no request at all - one
        live run spent seven retries and 46 seconds knocking on closed doors - and
        then failed anyway, having also burned the time the next file needed.
        """
        return min((seconds_until_available(name) for name in self._asked), default=0.0)

    def generate(self, system: str, user: str) -> ProviderResult:
        first_error: AppError | None = None
        # The primary is an instance; every later link is built on demand.
        for index, factory in enumerate([lambda: self.primary] + self._chain):
            try:
                provider = factory()
            except AppError as exc:
                first_error = first_error or exc
                logger.warning("ai_link_unconfigured position=%s code=%s", index, exc.code)
                continue
            self._asked.add(provider.name)
            if not is_available(provider.name):
                logger.info("ai_link_cooling provider=%s", provider.name)
                continue
            try:
                result = provider.generate(system, user)
            except AppError as exc:
                if exc.code not in _FALLBACK_CODES:
                    # A schema or parse failure is an answer, not an outage;
                    # another reviewer would give the same unreadable reply.
                    raise
                if exc.code == "AI_CONTEXT_OVERFLOW":
                    # Too narrow for this file, not unwell. The next link may hold
                    # it, and this one must still take the files that do fit - a
                    # long file must not be able to bench a healthy reviewer for a
                    # whole minute on the rest of the audit.
                    first_error = first_error or exc
                    logger.info("ai_link_skipped_narrow provider=%s", provider.name)
                    continue
                # Parked whether it was unreachable or refused - both give the same
                # reply to the same prompt.
                mark_down(provider.name)
                first_error = first_error or exc
                logger.warning("ai_link_failed provider=%s code=%s", provider.name, exc.code)
                continue
            mark_healthy(provider.name)
            if index:
                logger.warning("ai_handover_to provider=%s", provider.name)
            return result

        raise first_error or AppError("AI_UNAVAILABLE", "No reviewer is answering right now.", 503)


def reset_provider_health() -> None:
    """Forget every recorded failure. Tests use it; so does an operator retry."""
    with _health_lock:
        _down_until.clear()


def retry_wait_seconds(provider: AIProvider) -> float:
    """Seconds until this reviewer may be asked again, zero if it never failed.

    A chain answers with the earliest of the reviewers it actually reached: the
    first one to wake is worth retrying against, so waiting on the head alone
    sleeps past a free link. A provider the audit's tests hand over is a plain
    stub that has never been parked, and keeps the backoff's own answer.
    """
    if isinstance(provider, FallbackProvider):
        return provider.next_open_seconds()
    return seconds_until_available(provider.name)


_HOSTED_PROVIDERS = ("groq", "gemini", "openrouter")
_CONFIGURED_PROVIDERS = ("ollama", *_HOSTED_PROVIDERS)


def _provider_ready(name: str) -> bool:
    if name == "groq":
        return settings.groq_ready
    if name == "gemini":
        return settings.gemini_ready
    if name == "openrouter":
        return settings.openrouter_ready
    return bool(settings.ai_base_url)


def _provider_factory(name: str, model: str) -> Callable[[], AIProvider]:
    if name == "ollama":
        return lambda: OllamaProvider(model)
    if name == "groq":
        return lambda: GroqProvider(model)
    if name == "gemini":
        return lambda: GeminiProvider(model)
    if name == "openrouter":
        return lambda: OpenRouterProvider(model)
    return lambda: _unconfigured(name)


def _unconfigured(name: str) -> AIProvider:
    raise AppError("AI_MISCONFIGURED", f"No reviewer named {name} is configured here.", 503)


def _failover_targets(primary_provider: str) -> list[str]:
    """Every configured reviewer behind the primary, in the order to try them.

    The named failover provider leads, because that is the one an operator chose
    for this deployment; the rest follow in configuration order. The primary is
    never its own handover, and a reviewer without a credential is never
    offered a file it cannot answer for.
    """
    if not settings.ai_fallback_enabled or settings.ai_fallback_provider == "none":
        return []
    named = settings.ai_fallback_provider
    ordered = ([named] if named in _HOSTED_PROVIDERS else []) + [
        name for name in _HOSTED_PROVIDERS if name != named
    ]
    return [
        name
        for name in dict.fromkeys(ordered)
        if name != primary_provider and _provider_ready(name)
    ]


def _provider_model(name: str) -> str | None:
    """The model to ask of a reviewer that is taking over, or None if it offers none.

    The configured default is checked against what this account actually has, so a
    handover never burns its one attempt on a name the provider does not recognise.
    A reviewer whose listing came back empty is not offered the file at all: sending
    a guessed name is refused, and a refusal parks the link as an outage.
    """
    if name == "gemini":
        return handover_model(name, settings.ai_gemini_model)
    if name == "openrouter":
        return handover_model(name, settings.ai_openrouter_model)
    return handover_model(name, settings.ai_fallback_model)


def _failover_link(name: str) -> Callable[[], AIProvider]:
    """Build one chain link only when the handover actually reaches it.

    Resolving the model means asking that provider what this account has, so it
    happens here rather than while a healthy primary is still answering.
    """

    def build() -> AIProvider:
        model = _provider_model(name)
        if model is None:
            raise AppError(
                "AI_MISCONFIGURED",
                "That reviewer reports no models this account can use.",
                503,
            )
        return _provider_factory(name, model)()

    return build


def build_provider(entry: ModelEntry) -> AIProvider | None:
    """Construct the provider for a catalog entry, chained to the reviewers behind it.

    Any configured reviewer can be primary, and any primary can hand over: the
    local model to a hosted one, and one hosted reviewer to the next when the
    first is throttling, down, or too narrow for the file.
    """
    if entry.provider not in _CONFIGURED_PROVIDERS:
        return None
    primary = _provider_factory(entry.provider, entry.model)()
    targets = _failover_targets(entry.provider)
    if not targets:
        return primary
    return FallbackProvider(primary, *[_failover_link(t) for t in targets])


def provider_for(entry: ModelEntry) -> AIProvider:
    provider = build_provider(entry)
    if provider is None:
        raise AppError("AI_DISABLED", "No reviewer is enabled on this deployment.", 503)
    return provider
