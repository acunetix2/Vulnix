"""Provider adapters and the factory that chooses between them."""

import json

import httpx
import pytest

from app.ai.catalog import ModelEntry
from app.ai.providers.ollama import (
    FallbackProvider,
    GroqProvider,
    OllamaProvider,
    build_provider,
)
from app.core.config import settings
from app.core.errors import AppError

LOCAL = ModelEntry(
    id="ollama:qwen3.5:4b",
    provider="ollama",
    model="qwen3.5:4b",
    note="",
    source="local",
)
HOSTED = ModelEntry(
    id="groq:qwen/qwen3.8-27b",
    provider="groq",
    model="qwen/qwen3.8-27b",
    note="",
    source="hosted",
)


@pytest.fixture()
def configured(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_base_url", "http://localhost:11434")
    monkeypatch.setattr(settings, "ai_timeout_seconds", 5)
    monkeypatch.setattr(settings, "ai_num_ctx", 4096)
    monkeypatch.setattr(settings, "ai_disable_think", True)
    monkeypatch.setattr(settings, "ai_api_key", "gk-test")
    monkeypatch.setattr(settings, "ai_fallback_api_key", "")
    monkeypatch.setattr(settings, "ai_fallback_enabled", False)
    monkeypatch.setattr(settings, "ai_fallback_provider", "groq")
    monkeypatch.setattr(settings, "ai_fallback_model", "qwen/qwen3.8-27b")
    monkeypatch.setattr(settings, "ai_fallback_timeout_seconds", 10)


class FakeReply:
    """Stands in for an httpx.Response, carrying the parts ``_post`` reads."""

    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    @property
    def is_success(self) -> bool:
        return 200 <= self.status_code < 300

    def json(self) -> dict:
        return self._payload


def _patch_post(monkeypatch, replies: list) -> list[dict]:
    """Feed `replies` (objects or exceptions) to successive httpx.post calls."""
    sent: list[dict] = []
    queue = list(replies)

    def fake_post(url, **kwargs):
        sent.append({"url": url, **kwargs})
        item = queue.pop(0) if queue else FakeReply({})
        if isinstance(item, Exception):
            raise item
        return item

    monkeypatch.setattr(httpx, "post", fake_post)
    return sent


def _chat(content: str, model: str = "answered-1") -> FakeReply:
    return FakeReply(
        {
            "model": model,
            "message": {"content": content},
            "prompt_eval_count": 40,
            "eval_count": 12,
        }
    )


def test_local_payload_disables_thinking_and_pins_context(configured, monkeypatch) -> None:
    sent = _patch_post(monkeypatch, [_chat('{"ok": 1}')])
    result = OllamaProvider("qwen3.5:4b").generate("sys", "usr")
    body = sent[0]["json"]
    assert body["think"] is False
    assert body["options"] == {"num_ctx": 4096}
    assert body["format"] == "json"
    assert [m["role"] for m in body["messages"]] == ["system", "user"]
    assert (result.prompt_tokens, result.completion_tokens) == (40, 12)


def test_local_reports_the_model_that_replied(configured, monkeypatch) -> None:
    _patch_post(monkeypatch, [_chat('{"ok": 1}', model="qwen3.5:4b")])
    assert OllamaProvider("qwen3.5:4b").generate("s", "u").model == "qwen3.5:4b"


def test_groq_requests_json_object_mode(configured, monkeypatch) -> None:
    sent = _patch_post(
        monkeypatch,
        [
            FakeReply(
                {
                    "model": "qwen/qwen3.8-27b",
                    "choices": [{"message": {"content": '{"ok": 1}'}}],
                    "usage": {"prompt_tokens": 30, "completion_tokens": 6},
                }
            )
        ],
    )
    result = GroqProvider("qwen/qwen3.8-27b").generate("sys", "usr")
    body = sent[0]["json"]
    assert body["response_format"] == {"type": "json_object"}
    assert body["model"] == "qwen/qwen3.8-27b"
    assert sent[0]["headers"]["Authorization"].startswith("Bearer ")
    assert result.provider == "groq"
    assert result.completion_tokens == 6


def test_transport_failure_becomes_a_503_without_echoing_details(
    configured, monkeypatch
) -> None:
    _patch_post(monkeypatch, [httpx.ConnectError("refused at http://secret-host")])
    with pytest.raises(AppError) as exc:
        GroqProvider("qwen/qwen3.8-27b").generate("s", "u")
    assert exc.value.code == "AI_UNAVAILABLE"
    assert "secret-host" not in exc.value.message


def test_a_busy_reviewer_is_worth_asking_again(configured, monkeypatch) -> None:
    """Throttling and restarts are a bad moment, not a verdict on the code."""
    for status in (429, 503, 500):
        _patch_post(monkeypatch, [FakeReply({}, status)])
        with pytest.raises(AppError) as exc:
            GroqProvider("qwen/qwen3.8-27b").generate("s", "u")
        assert exc.value.code == "AI_UNAVAILABLE"


def test_a_refusal_is_configuration_not_an_outage(configured, monkeypatch) -> None:
    """A wrong key answers 401 identically every time.

    Retrying it would spend eight backoffs to reach the same word, and reporting
    it as unavailable sends whoever is fixing it to the wrong machine.
    """
    for status in (401, 403, 404):
        _patch_post(monkeypatch, [FakeReply({}, status)])
        with pytest.raises(AppError) as exc:
            GroqProvider("qwen/qwen3.8-27b").generate("s", "u")
        assert exc.value.code == "AI_MISCONFIGURED"


def test_a_gateway_answering_html_is_unreadable_not_a_crash(configured, monkeypatch) -> None:
    class Html(FakeReply):
        def json(self):
            raise ValueError("Expecting value: line 1 column 1")

    _patch_post(monkeypatch, [Html({})])
    with pytest.raises(AppError) as exc:
        OllamaProvider("qwen3.5:4b").generate("s", "u")
    assert exc.value.code == "AI_INVALID_OUTPUT"


def test_prose_instead_of_json_is_rejected(configured, monkeypatch) -> None:
    _patch_post(monkeypatch, [_chat("I cannot answer that.")])
    with pytest.raises(AppError) as exc:
        OllamaProvider("qwen3.5:4b").generate("s", "u")
    assert exc.value.code == "AI_INVALID_OUTPUT"


def test_json_array_is_not_an_object(configured, monkeypatch) -> None:
    _patch_post(monkeypatch, [_chat("[1, 2]")])
    with pytest.raises(AppError) as exc:
        OllamaProvider("qwen3.5:4b").generate("s", "u")
    assert exc.value.code == "AI_INVALID_OUTPUT"


def test_build_provider_matches_the_entry(configured) -> None:
    assert isinstance(build_provider(LOCAL), OllamaProvider)
    assert isinstance(build_provider(HOSTED), GroqProvider)


def test_failover_wraps_only_a_local_primary(configured, monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_fallback_enabled", True)
    monkeypatch.setattr(settings, "ai_fallback_api_key", "gk-test")
    assert isinstance(build_provider(LOCAL), FallbackProvider)
    # A hosted primary is the failover target; there is nothing behind it.
    assert isinstance(build_provider(HOSTED), GroqProvider)


def test_failover_is_not_built_without_a_second_credential(configured) -> None:
    assert not isinstance(build_provider(LOCAL), FallbackProvider)


def test_unknown_provider_has_no_adapter(configured) -> None:
    entry = ModelEntry(id="x", provider="mistral", model="m", note="", source="hosted")
    assert build_provider(entry) is None


class AlwaysFails:
    name = "primary"

    def generate(self, system: str, user: str):
        raise AppError("AI_UNAVAILABLE", "down", 503)


class Answers:
    name = "backup"

    def __init__(self) -> None:
        self.calls = 0

    def generate(self, system: str, user: str):
        self.calls += 1
        from app.ai.providers.ollama import ProviderResult

        return ProviderResult(data={"ok": True}, provider="backup", model="backup-7b")


def test_failover_carries_the_answering_model_forward() -> None:
    backup = Answers()
    result = FallbackProvider(AlwaysFails(), backup).generate("s", "u")
    assert result.provider == "backup"
    assert result.model == "backup-7b"
    assert backup.calls == 1


def test_failover_does_not_mask_a_bad_response() -> None:
    class BadShape:
        name = "primary"

        def generate(self, system: str, user: str):
            raise AppError("AI_INVALID_OUTPUT", "not json", 502)

    backup = Answers()
    with pytest.raises(AppError) as exc:
        FallbackProvider(BadShape(), backup).generate("s", "u")
    assert exc.value.code == "AI_INVALID_OUTPUT"
    assert backup.calls == 0


def test_provider_roundtrip_is_valid_json(configured, monkeypatch) -> None:
    _patch_post(monkeypatch, [_chat(json.dumps({"finding_id": "f1"}))])
    assert OllamaProvider("qwen3.5:4b").generate("s", "u").data == {"finding_id": "f1"}
