"""Provider adapters, the health bookkeeping, and the factory that chains them."""

import json

import httpx
import pytest

from app.ai.catalog import ModelEntry
from app.ai.providers.ollama import (
    FallbackProvider,
    GeminiProvider,
    GroqProvider,
    OllamaProvider,
    OpenRouterProvider,
    ProviderResult,
    _failover_link,
    build_provider,
    is_available,
    mark_down,
    reset_provider_health,
    retry_wait_seconds,
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
WIDE = ModelEntry(
    id="gemini:gemini-2.5-flash",
    provider="gemini",
    model="gemini-2.5-flash",
    note="",
    source="hosted",
)
CODER = ModelEntry(
    id="openrouter:qwen/qwen2.5-coder-32b-instruct:free",
    provider="openrouter",
    model="qwen/qwen2.5-coder-32b-instruct:free",
    note="",
    source="hosted",
)


@pytest.fixture(autouse=True)
def clean_health():
    """Provider cooldown is process state; one test's outage is not the next one's."""
    reset_provider_health()
    yield
    reset_provider_health()


@pytest.fixture()
def configured(monkeypatch):
    # A chain link resolves its own model through the catalog, which asks that
    # provider over the network. These tests are about which reviewers a chain
    # holds, not which name each one answers to, so that lookup is settled here.
    monkeypatch.setattr(
        "app.ai.providers.ollama.handover_model", lambda provider, default: default
    )
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
    monkeypatch.setattr(settings, "ai_gemini_api_key", "gm-test")
    monkeypatch.setattr(settings, "ai_gemini_model", "gemini-2.5-flash")
    monkeypatch.setattr(settings, "ai_gemini_timeout_seconds", 8)
    monkeypatch.setattr(settings, "ai_gemini_context_tokens", 1000000)
    monkeypatch.setattr(settings, "ai_openrouter_api_key", "or-test")
    monkeypatch.setattr(settings, "ai_openrouter_model", "qwen/qwen2.5-coder-32b-instruct:free")
    monkeypatch.setattr(settings, "ai_openrouter_timeout_seconds", 7)
    monkeypatch.setattr(settings, "ai_openrouter_context_tokens", 32768)
    monkeypatch.setattr(settings, "ai_max_output_tokens", 2048)
    monkeypatch.setattr(settings, "ai_provider_cooldown_seconds", 60)
    reset_provider_health()
    yield
    reset_provider_health()


class FakeReply:
    """Stands in for an httpx.Response, carrying the parts ``_post`` reads."""

    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    @property
    def is_success(self) -> bool:
        return 200 <= self.status_code < 300

    @property
    def text(self) -> str:
        return json.dumps(self._payload)

    def json(self) -> dict:
        return self._payload


def _refused(status: int, reason: dict) -> FakeReply:
    """A refusal carrying the reviewer's own error object, as the vendors send it."""
    return FakeReply({"error": reason}, status)


# Stands in for source code: a vendor's refusal message often quotes the prompt back.
SECRET_QUOTE = 'DATABASE = "postgres://admin:s3cretphrase@db.internal/prod"'


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


def _completion(model: str = "answered-1", finish: str = "stop") -> FakeReply:
    return FakeReply(
        {
            "model": model,
            "choices": [
                {"message": {"content": '{"ok": 1}'}, "finish_reason": finish},
            ],
            "usage": {"prompt_tokens": 30, "completion_tokens": 6},
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
    sent = _patch_post(monkeypatch, [_completion("qwen/qwen3.8-27b")])
    result = GroqProvider("qwen/qwen3.8-27b").generate("sys", "usr")
    body = sent[0]["json"]
    assert body["response_format"] == {"type": "json_object"}
    assert body["model"] == "qwen/qwen3.8-27b"
    assert sent[0]["headers"]["Authorization"].startswith("Bearer ")
    assert result.provider == "groq"
    assert result.completion_tokens == 6


def test_a_hosted_reply_is_capped_so_it_cannot_run_long(configured, monkeypatch) -> None:
    """The token budget: a review answer is a small object, never an essay."""
    sent = _patch_post(monkeypatch, [_completion(), _completion()])
    GeminiProvider("gemini-2.5-flash").generate("s", "u")
    GroqProvider("qwen/qwen3.8-27b").generate("s", "u")
    assert sent[0]["json"]["max_tokens"] == 2048
    assert sent[1]["json"]["max_tokens"] == 2048


def test_the_cap_can_be_turned_off(configured, monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_max_output_tokens", 0)
    sent = _patch_post(monkeypatch, [_completion()])
    GeminiProvider("gemini-2.5-flash").generate("s", "u")
    assert "max_tokens" not in sent[0]["json"]


def test_gemini_uses_its_own_endpoint_and_credential(configured, monkeypatch) -> None:
    sent = _patch_post(monkeypatch, [_completion("gemini-2.5-flash")])
    result = GeminiProvider("gemini-2.5-flash").generate("sys", "usr")
    assert sent[0]["url"].endswith("/chat/completions")
    assert "generativelanguage" in sent[0]["url"]
    assert sent[0]["headers"]["Authorization"] == "Bearer gm-test"
    assert sent[0]["timeout"] == 8
    assert (result.provider, result.model) == ("gemini", "gemini-2.5-flash")


def test_gemini_never_borrows_another_providers_key(configured, monkeypatch) -> None:
    """A key belongs to the endpoint the operator put it on, and only that one."""
    monkeypatch.setattr(settings, "ai_gemini_api_key", "")
    with pytest.raises(AppError) as exc:
        GeminiProvider("gemini-2.5-flash")
    assert exc.value.code == "AI_MISCONFIGURED"


def test_openrouter_uses_its_own_endpoint_and_credential(configured, monkeypatch) -> None:
    sent = _patch_post(monkeypatch, [_completion("qwen/qwen2.5-coder-32b-instruct:free")])
    result = OpenRouterProvider("qwen/qwen2.5-coder-32b-instruct:free").generate("sys", "usr")
    assert sent[0]["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert sent[0]["headers"]["Authorization"] == "Bearer or-test"
    assert sent[0]["timeout"] == 7
    assert sent[0]["json"]["max_tokens"] == 2048
    assert (result.provider, result.model) == (
        "openrouter",
        "qwen/qwen2.5-coder-32b-instruct:free",
    )


def test_openrouter_never_borrows_another_providers_key(configured, monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_openrouter_api_key", "")
    with pytest.raises(AppError) as exc:
        OpenRouterProvider("qwen/qwen2.5-coder-32b-instruct:free")
    assert exc.value.code == "AI_MISCONFIGURED"


def test_a_file_wider_than_the_window_is_refused_before_it_is_sent(
    configured, monkeypatch
) -> None:
    """The token discipline that matters most: never pay for a guaranteed 400.

    32k tokens is the narrow reviewer in the chain, so a long file has to be
    declined locally and handed to a wider reviewer rather than posted, billed
    and rejected.
    """
    sent = _patch_post(monkeypatch, [])
    long_prompt = "x" * (4 * 40000)
    with pytest.raises(AppError) as exc:
        OpenRouterProvider("qwen/qwen2.5-coder-32b-instruct:free").generate("s", long_prompt)
    assert exc.value.code == "AI_CONTEXT_OVERFLOW"
    assert sent == []


def test_the_same_file_still_fits_the_wide_reviewer(configured, monkeypatch) -> None:
    """The overflow is a property of the window, not a blanket refusal."""
    _patch_post(monkeypatch, [_completion("gemini-2.5-pro")])
    long_prompt = "x" * (4 * 40000)
    assert GeminiProvider("gemini-2.5-pro").generate("s", long_prompt).provider == "gemini"


def test_a_wide_enough_prompt_is_still_sent(configured, monkeypatch) -> None:
    sent = _patch_post(monkeypatch, [_completion()])
    OpenRouterProvider("qwen/qwen2.5-coder-32b-instruct:free").generate("s", "x" * 4000)
    assert len(sent) == 1


def test_a_truncated_answer_is_reported_not_reasked(configured, monkeypatch) -> None:
    """Asking again buys the same cut-off answer, so the cap is a verdict."""
    _patch_post(monkeypatch, [_completion(finish="length")])
    with pytest.raises(AppError) as exc:
        GeminiProvider("gemini-2.5-flash").generate("s", "u")
    assert exc.value.code == "AI_OUTPUT_TRUNCATED"


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


def test_a_reviewer_that_is_out_of_window_says_so(configured, monkeypatch) -> None:
    """A vendor's own reason code is the only way to tell "too long" from "wrong key".

    Both answer 400 or 404, but one is a property of the file and the other of the
    deployment - and the audit handles them in opposite orders.
    """
    for reason in (
        {"code": "context_length_exceeded"},
        {"type": "invalid_request_error", "code": "input_token_limit_exceeded"},
        {"code": "ContextLengthTooLong"},
        {"code": "context_window_exceeded"},
    ):
        _patch_post(monkeypatch, [_refused(400, reason)])
        with pytest.raises(AppError) as exc:
            GroqProvider("qwen/qwen3.8-27b").generate("s", "u")
        assert exc.value.code == "AI_CONTEXT_OVERFLOW"
        assert exc.value.status_code == 413


def test_a_refusal_that_is_not_about_width_stays_configuration(
    configured, monkeypatch
) -> None:
    for reason in (
        {"code": "model_not_found"},
        {"type": "authentication_error"},
        {"message": "no machine-readable reason here, only prose"},
    ):
        _patch_post(monkeypatch, [_refused(404, reason)])
        with pytest.raises(AppError) as exc:
            GroqProvider("qwen/qwen3.8-27b").generate("s", "u")
        assert exc.value.code == "AI_MISCONFIGURED"


def test_the_refusing_reviewers_message_is_never_handed_to_the_user(
    configured, monkeypatch
) -> None:
    """A refusal often quotes the prompt back, and the prompt is somebody's source.

    The reason token is read; the prose beside it is dropped from the message.
    """
    _patch_post(
        monkeypatch,
        [_refused(400, {"code": "context_length_exceeded", "message": SECRET_QUOTE})],
    )
    with pytest.raises(AppError) as exc:
        GroqProvider("qwen/qwen3.8-27b").generate("s", "u")
    assert SECRET_QUOTE not in exc.value.message
    assert SECRET_QUOTE not in str(exc.value.details)


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
    assert isinstance(build_provider(WIDE), GeminiProvider)
    assert isinstance(build_provider(CODER), OpenRouterProvider)


def _chain_order(chain: FallbackProvider) -> list[str]:
    """The reviewers behind the primary, in the order an audit will try them."""
    return [f().name for f in chain._chain]


def test_the_whole_configured_chain_follows_the_primary(configured, monkeypatch) -> None:
    """An audit survives one outage per reviewer, not one reviewer per outage."""
    monkeypatch.setattr(settings, "ai_fallback_enabled", True)
    monkeypatch.setattr(settings, "ai_fallback_api_key", "gk-test")
    # The named failover provider leads, then every other configured reviewer.
    assert _chain_order(build_provider(LOCAL)) == ["groq", "gemini", "openrouter"]


def test_a_hosted_primary_is_never_its_own_handover(configured, monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_fallback_enabled", True)
    monkeypatch.setattr(settings, "ai_fallback_api_key", "gk-test")
    names = _chain_order(build_provider(HOSTED))
    assert names == ["gemini", "openrouter"]
    assert _chain_order(build_provider(WIDE)) == ["groq", "openrouter"]


def test_a_reviewer_without_a_credential_is_never_offered_the_file(
    configured, monkeypatch
) -> None:
    """Chaining onto a reviewer with no key would fail the handover for nothing."""
    monkeypatch.setattr(settings, "ai_fallback_enabled", True)
    monkeypatch.setattr(settings, "ai_api_key", "gk-test")
    monkeypatch.setattr(settings, "ai_gemini_api_key", "")
    assert _chain_order(build_provider(LOCAL)) == ["groq", "openrouter"]


def test_failover_is_not_built_without_a_second_credential(configured) -> None:
    assert not isinstance(build_provider(LOCAL), FallbackProvider)


def test_unknown_provider_has_no_adapter(configured) -> None:
    entry = ModelEntry(id="x", provider="mistral", model="m", note="", source="hosted")
    assert build_provider(entry) is None


class AlwaysFails:
    name = "primary"

    def __init__(self) -> None:
        self.calls = 0

    def generate(self, system: str, user: str):
        self.calls += 1
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
    primary, backup = AlwaysFails(), Answers()
    result = FallbackProvider(primary, lambda: backup).generate("s", "u")
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
        FallbackProvider(BadShape(), lambda: backup).generate("s", "u")
    assert exc.value.code == "AI_INVALID_OUTPUT"
    assert backup.calls == 0


def test_a_truncated_primary_is_not_reasked_elsewhere() -> None:
    """A capped answer is the same cap whichever reviewer is asked for it."""
    class CutShort:
        name = "primary"

        def generate(self, system: str, user: str):
            raise AppError("AI_OUTPUT_TRUNCATED", "cut short", 502)

    backup = Answers()
    with pytest.raises(AppError) as exc:
        FallbackProvider(CutShort(), lambda: backup).generate("s", "u")
    assert exc.value.code == "AI_OUTPUT_TRUNCATED"
    assert backup.calls == 0


def test_a_dead_primary_is_skipped_until_it_cools_down(configured) -> None:
    """The credit discipline behind failover: one outage, then stop paying for it.

    Without the cooldown, every turn of an audit's retry loop would re-ask the
    dead reviewer before reaching the working one.
    """
    primary, backup = AlwaysFails(), Answers()
    chain = FallbackProvider(primary, lambda: backup)
    chain.generate("s", "u")
    chain.generate("s", "u")
    assert primary.calls == 1
    assert backup.calls == 2
    assert not is_available("primary")
    reset_provider_health()
    chain.generate("s", "u")
    assert primary.calls == 2


def test_a_failing_fallback_is_also_parked() -> None:
    class BothDown:
        name = "backup"

        def generate(self, system: str, user: str):
            raise AppError("AI_UNAVAILABLE", "also down", 503)

    chain = FallbackProvider(AlwaysFails(), lambda: BothDown())
    with pytest.raises(AppError) as exc:
        chain.generate("s", "u")
    assert exc.value.code == "AI_UNAVAILABLE"
    assert not is_available("primary")
    assert not is_available("backup")


def test_an_audit_walks_the_chain_until_a_reviewer_answers(configured) -> None:
    """One outage per reviewer, then the audit continues on whoever is left.

    The free tiers in this chain answer a few requests per minute, so the whole
    point of the cooldown is that a throttled reviewer is stepped past rather
    than knocked on again for every file.
    """
    asked: list[str] = []

    class Link:
        def __init__(self, name: str, answers: bool) -> None:
            self.name = name
            self.answers = answers

        def generate(self, system: str, user: str):
            asked.append(self.name)
            if not self.answers:
                raise AppError("AI_UNAVAILABLE", "down", 503)
            return ProviderResult(data={"ok": True}, provider=self.name, model=self.name)

    chain = FallbackProvider(
        Link("groq", False),
        lambda: Link("gemini", False),
        lambda: Link("openrouter", True),
    )
    assert chain.generate("s", "u").provider == "openrouter"
    assert asked == ["groq", "gemini", "openrouter"]

    asked.clear()
    assert chain.generate("s", "u").provider == "openrouter"
    assert asked == ["openrouter"]


def test_a_narrow_reviewer_passes_a_long_file_to_a_wide_one(configured) -> None:
    """Running out of window is a reason to hand over, not to fail the file."""
    asked: list[str] = []

    class Narrow:
        name = "openrouter"

        def generate(self, system: str, user: str):
            asked.append(self.name)
            raise AppError("AI_CONTEXT_OVERFLOW", "too long", 413)

    class Wide:
        name = "gemini"

        def generate(self, system: str, user: str):
            asked.append(self.name)
            return ProviderResult(data={"ok": True}, provider=self.name, model=self.name)

    assert FallbackProvider(Narrow(), lambda: Wide()).generate("s", "u").provider == "gemini"
    assert asked == ["openrouter", "gemini"]


def test_a_narrow_reviewer_is_not_benched_by_one_long_file(configured) -> None:
    """Too wide for this file says nothing about the next one.

    Parking a healthy reviewer for a minute because a single file exceeded its
    window would cost the rest of the audit its cheapest reviewer.
    """
    asked: list[str] = []

    class Narrow:
        name = "openrouter"

        def generate(self, system: str, user: str):
            asked.append(self.name)
            raise AppError("AI_CONTEXT_OVERFLOW", "too long", 413)

    class Wide:
        name = "gemini"

        def generate(self, system: str, user: str):
            asked.append(self.name)
            return ProviderResult(data={"ok": True}, provider=self.name, model=self.name)

    chain = FallbackProvider(Narrow(), lambda: Wide())
    chain.generate("s", "u")
    assert is_available("openrouter")
    chain.generate("s", "short file")
    assert asked == ["openrouter", "gemini", "openrouter", "gemini"]


def test_every_link_being_down_reports_the_first_failure(configured) -> None:
    """The user hears about the reviewer they chose, not the last one tried."""
    class Link:
        def __init__(self, name: str) -> None:
            self.name = name

        def generate(self, system: str, user: str):
            raise AppError("AI_UNAVAILABLE", f"{self.name} is down", 503)

    chain = FallbackProvider(Link("groq"), lambda: Link("gemini"), lambda: Link("openrouter"))
    with pytest.raises(AppError) as exc:
        chain.generate("s", "u")
    assert exc.value.code == "AI_UNAVAILABLE"


def test_cooldown_disabled_means_every_attempt_asks_the_primary(configured, monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_provider_cooldown_seconds", 0)
    mark_down("primary")
    assert is_available("primary")


def test_an_unbuildable_fallback_keeps_the_primaries_error() -> None:
    """A half-configured target must not replace the outage with a new lie."""
    def broken():
        raise AppError("AI_MISCONFIGURED", "no credential", 503)

    with pytest.raises(AppError) as exc:
        FallbackProvider(AlwaysFails(), broken).generate("s", "u")
    assert exc.value.code == "AI_UNAVAILABLE"


def test_a_reviewer_that_confirms_no_model_is_never_offered_the_file(
    configured, monkeypatch
) -> None:
    """A handover to a guessed name is a request spent on a rejection.

    One live run handed over to a model the account does not have, took a 404, and
    then benched that reviewer for a full minute as though it were down. Asking
    what the account has is free, so a reviewer that reports nothing is stepped
    past without a call and without a penalty.
    """
    monkeypatch.setattr("app.ai.providers.ollama.handover_model", lambda provider, default: None)
    sent = _patch_post(monkeypatch, [])
    with pytest.raises(AppError) as exc:
        FallbackProvider(AlwaysFails(), _failover_link("gemini")).generate("s", "u")
    assert exc.value.code == "AI_UNAVAILABLE"
    assert sent == []
    assert is_available("gemini")


def test_a_retry_waits_for_the_earliest_resting_reviewer_to_wake(
    configured, monkeypatch
) -> None:
    """Waiting on the head alone sleeps past a link that is already free.

    Without this the retry loop spent seven attempts and 46 seconds making no
    request at all, then failed the file anyway - and took the time the next file
    needed with it.
    """
    class AlsoDown:
        name = "backup"

        def generate(self, system: str, user: str):
            raise AppError("AI_UNAVAILABLE", "also down", 503)

    monkeypatch.setattr(settings, "ai_provider_cooldown_seconds", 0)
    chain = FallbackProvider(AlwaysFails(), lambda: AlsoDown())
    with pytest.raises(AppError):
        chain.generate("s", "u")

    monkeypatch.setattr(settings, "ai_provider_cooldown_seconds", 60)
    mark_down("primary")
    monkeypatch.setattr(settings, "ai_provider_cooldown_seconds", 10)
    mark_down("backup")
    assert retry_wait_seconds(chain) == pytest.approx(10.0, abs=0.5)


def test_a_reviewer_that_never_failed_is_no_reason_to_wait(configured) -> None:
    """The backoff already chosen stands when nothing is known to be resting."""
    assert retry_wait_seconds(Answers()) == 0.0
    mark_down("primary")
    assert retry_wait_seconds(Answers()) == 0.0


def test_provider_roundtrip_is_valid_json(configured, monkeypatch) -> None:
    _patch_post(monkeypatch, [_chat(json.dumps({"finding_id": "f1"}))])
    assert OllamaProvider("qwen3.5:4b").generate("s", "u").data == {"finding_id": "f1"}
