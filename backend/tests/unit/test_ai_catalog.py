"""Catalog tests: availability comes from the provider, identity never does."""

import pytest

from app.ai import catalog
from app.core.config import settings


class FakeResponse:
    def __init__(self, payload: dict, status: int = 200) -> None:
        self._payload = payload
        self.status_code = status

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError("http error")

    def json(self) -> dict:
        return self._payload


def _patch_get(monkeypatch, responses: dict[str, object]) -> list[str]:
    """Route httpx.get by URL substring; record which providers were probed."""
    called: list[str] = []

    def fake_get(url, **kwargs):
        called.append(url)
        for needle, value in responses.items():
            if needle in url:
                if isinstance(value, Exception):
                    raise value
                return value
        raise AssertionError(f"unexpected probe url {url}")

    monkeypatch.setattr(catalog.httpx, "get", fake_get)
    return called


@pytest.fixture()
def enabled(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_enabled", True)
    # These tests exercise the catalog with a local reviewer present; the shipped
    # default hides it, which the tests below this fixture state on its own.
    monkeypatch.setattr(settings, "ai_local_enabled", True)
    monkeypatch.setattr(settings, "ai_provider", "ollama")
    monkeypatch.setattr(settings, "ai_model", "")
    monkeypatch.setattr(settings, "ai_base_url", "http://localhost:11434")
    monkeypatch.setattr(settings, "ai_api_key", "")
    monkeypatch.setattr(settings, "ai_fallback_api_key", "")
    # Each hosted reviewer is probed only with its own credential, so a test for
    # one must not inherit the other from the operator's env file. Every key the
    # shipped chain knows about is blanked here, not just the ones a test expects:
    # an operator who sets one in `backend/.env` must not change what the unit
    # suite probes, and a probe the fixture did not stub is an assertion error.
    monkeypatch.setattr(settings, "ai_gemini_api_key", "")
    monkeypatch.setattr(settings, "ai_openrouter_api_key", "")
    catalog.clear_cache()


OLLAMA_TAGS = FakeResponse({"models": [{"name": "qwen3.5:4b"}, {"name": "llama3.2:3b"}]})
GROQ_MODELS = FakeResponse({"data": [{"id": "qwen/qwen3.8-27b"}, {"id": "openai/gpt-oss-20b"}]})
GEMINI_MODELS = FakeResponse(
    {"models": [{"name": "models/gemini-2.5-pro"}, {"name": "models/gemini-2.5-flash"}]}
)


def test_nothing_is_offered_when_ai_is_disabled(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_enabled", False)
    catalog.clear_cache()
    assert catalog.list_models() == []


def test_no_local_model_is_offered_by_default(enabled, monkeypatch) -> None:
    """A reviewer the host has not pulled must never appear in a picker (ADR-017)."""
    monkeypatch.setattr(settings, "ai_local_enabled", False)
    monkeypatch.setattr(settings, "ai_fallback_api_key", "gk-not-a-real-key")
    called = _patch_get(monkeypatch, {"models": GROQ_MODELS})
    catalog.clear_cache()
    assert [entry.id for entry in catalog.list_models()] == [
        "groq:qwen/qwen3.8-27b",
        "groq:openai/gpt-oss-20b",
    ]
    # Not asked, not asked-and-filtered: the local host is never probed.
    assert not [url for url in called if "/api/tags" in url]


def test_a_deployment_that_runs_its_own_model_can_offer_it(enabled, monkeypatch) -> None:
    """Hidden, not removed: one setting brings the whole local path back."""
    monkeypatch.setattr(settings, "ai_fallback_api_key", "gk-not-a-real-key")
    _patch_get(monkeypatch, {"api/tags": OLLAMA_TAGS, "models": GROQ_MODELS})
    catalog.clear_cache()
    assert [entry.source for entry in catalog.list_models()] == [
        "local",
        "local",
        "hosted",
        "hosted",
    ]


def test_the_default_never_names_a_reviewer_that_is_not_offered(enabled, monkeypatch) -> None:
    """An operator's stale local default must not empty the picker.

    `preferred()` returns the configured provider and model when the catalog can
    confirm it; with local inference off it confirms nothing, so the first hosted
    reviewer answers rather than no reviewer at all.
    """
    monkeypatch.setattr(settings, "ai_local_enabled", False)
    monkeypatch.setattr(settings, "ai_provider", "ollama")
    monkeypatch.setattr(settings, "ai_model", "qwen3.5:4b")
    monkeypatch.setattr(settings, "ai_fallback_api_key", "gk-not-a-real-key")
    _patch_get(monkeypatch, {"models": GROQ_MODELS})
    catalog.clear_cache()
    assert catalog.preferred().provider == "groq"


def test_local_models_come_from_ollama_tags(enabled, monkeypatch) -> None:
    called = _patch_get(monkeypatch, {"api/tags": OLLAMA_TAGS})
    entries = catalog.list_models()
    assert [e.id for e in entries] == ["ollama:qwen3.5:4b", "ollama:llama3.2:3b"]
    assert entries[0].source == "local"
    assert any("api/tags" in url for url in called)


def test_groq_candidates_are_filtered_by_account_access(enabled, monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_fallback_api_key", "gk-not-a-real-key")
    _patch_get(monkeypatch, {"api/tags": OLLAMA_TAGS, "models": GROQ_MODELS})
    entries = catalog.list_models()
    ids = [e.id for e in entries]
    # Two of the three candidates are reachable here; the third is never offered.
    assert "groq:qwen/qwen3.8-27b" in ids
    assert "groq:openai/gpt-oss-20b" in ids
    assert "groq:openai/gpt-oss-120b" not in ids
    hosted = [e for e in entries if e.provider == "groq"]
    assert [e.source for e in hosted] == ["hosted", "hosted"]


def test_groq_without_a_credential_is_not_probed(enabled, monkeypatch) -> None:
    _patch_get(monkeypatch, {"api/tags": OLLAMA_TAGS})
    entries = catalog.list_models()
    assert not [e for e in entries if e.provider == "groq"]
    assert settings.groq_api_key == ""


def test_gemini_is_offered_only_for_names_the_account_confirms(enabled, monkeypatch) -> None:
    """Google exposes a different set per key, so the catalog is a probe result."""
    monkeypatch.setattr(settings, "ai_gemini_api_key", "gm-not-a-real-key")
    called = _patch_get(
        monkeypatch,
        {"api/tags": OLLAMA_TAGS, "generativelanguage": GEMINI_MODELS},
    )
    entries = catalog.list_models()
    gemini = [e for e in entries if e.provider == "gemini"]
    assert [e.id for e in gemini] == ["gemini:gemini-2.5-pro", "gemini:gemini-2.5-flash"]
    assert [e.alias for e in gemini] == ["Vulnix Wide", "Vulnix Steady"]
    assert [e.source for e in gemini] == ["hosted", "hosted"]
    # The listing is asked for with this provider's own credential only.
    assert any("generativelanguage" in url for url in called)
    assert not any("groq" in url for url in called)


def test_gemini_never_borrows_the_other_reviewers_key(enabled, monkeypatch) -> None:
    """A key set for one hosted reviewer must not open a probe against another."""
    monkeypatch.setattr(settings, "ai_fallback_api_key", "gk-not-a-real-key")
    _patch_get(monkeypatch, {"api/tags": OLLAMA_TAGS, "models": GROQ_MODELS})
    assert not [e for e in catalog.list_models() if e.provider == "gemini"]


def test_a_gemini_account_without_the_candidates_offers_nothing(
    enabled, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "ai_gemini_api_key", "gm-not-a-real-key")
    _patch_get(
        monkeypatch,
        {
            "api/tags": OLLAMA_TAGS,
            "generativelanguage": FakeResponse({"models": [{"name": "models/gemini-1.0-old"}]}),
        },
    )
    assert not [e for e in catalog.list_models() if e.provider == "gemini"]


def test_gemini_accepts_the_openai_style_listing(enabled, monkeypatch) -> None:
    """The compatible endpoint answers with ``data``, the native one with ``models``."""
    monkeypatch.setattr(settings, "ai_gemini_api_key", "gm-not-a-real-key")
    _patch_get(
        monkeypatch,
        {
            "api/tags": OLLAMA_TAGS,
            "generativelanguage": FakeResponse({"data": [{"id": "gemini-2.5-flash"}]}),
        },
    )
    gemini = [e for e in catalog.list_models() if e.provider == "gemini"]
    assert [e.id for e in gemini] == ["gemini:gemini-2.5-flash"]


def test_a_down_gemini_degrades_without_failing_the_catalog(
    enabled, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "ai_gemini_api_key", "gm-not-a-real-key")
    _patch_get(
        monkeypatch,
        {"api/tags": OLLAMA_TAGS, "generativelanguage": catalog.httpx.ConnectError("down")},
    )
    assert [e.id for e in catalog.list_models()] == [
        "ollama:qwen3.5:4b",
        "ollama:llama3.2:3b",
    ]


def test_the_local_reviewer_is_still_offered_first(enabled, monkeypatch) -> None:
    """Ordering is a cost decision: nothing may default onto a hosted model."""
    monkeypatch.setattr(settings, "ai_gemini_api_key", "gm-not-a-real-key")
    _patch_get(monkeypatch, {"api/tags": OLLAMA_TAGS, "generativelanguage": GEMINI_MODELS})
    assert catalog.preferred().id == "ollama:qwen3.5:4b"


OPENROUTER_MODELS = FakeResponse(
    {"data": [{"id": "qwen/qwen2.5-coder-32b-instruct:free"}, {"id": "other/model"}]}
)


def test_openrouter_is_offered_only_for_names_the_account_confirms(
    enabled, monkeypatch
) -> None:
    """A free-tier key has the `:free` variant, and that is the name asked for."""
    monkeypatch.setattr(settings, "ai_openrouter_api_key", "or-not-a-real-key")
    called = _patch_get(
        monkeypatch, {"api/tags": OLLAMA_TAGS, "openrouter.ai": OPENROUTER_MODELS}
    )
    entries = [e for e in catalog.list_models() if e.provider == "openrouter"]
    assert [e.alias for e in entries] == ["Vulnix Sprint"]
    assert any("openrouter.ai" in url for url in called)
    assert not any("generativelanguage" in url for url in called)


def test_openrouter_never_borrows_another_reviewers_key(enabled, monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_fallback_api_key", "gk-not-a-real-key")
    _patch_get(monkeypatch, {"api/tags": OLLAMA_TAGS, "models": GROQ_MODELS})
    assert not [e for e in catalog.list_models() if e.provider == "openrouter"]


def test_a_handover_uses_a_model_the_account_actually_has(enabled, monkeypatch) -> None:
    """The configured default is only used when this key can reach it.

    Naming a model the provider does not have would spend the one handover
    attempt on a rejection instead of on a review.
    """
    monkeypatch.setattr(settings, "ai_enabled", True)
    monkeypatch.setattr(settings, "ai_openrouter_api_key", "or-not-a-real-key")
    _patch_get(monkeypatch, {"api/tags": OLLAMA_TAGS, "openrouter.ai": OPENROUTER_MODELS})
    assert (
        catalog.handover_model("openrouter", "qwen/qwen2.5-coder-32b-instruct:free")
        == "qwen/qwen2.5-coder-32b-instruct:free"
    )
    # The operator's preferred name is not reachable here, so the confirmed one is.
    assert (
        catalog.handover_model("openrouter", "qwen/some-newer-coder")
        == "qwen/qwen2.5-coder-32b-instruct:free"
    )
    # Nothing confirmed for this reviewer: no name at all, rather than the
    # configured one. A handover that guesses is refused, and a refusal parks the
    # link as if it had an outage - so the chain loses the reviewer for a minute on
    # the strength of a name nobody confirmed.
    assert catalog.handover_model("gemini", "gemini-2.5-flash") is None


def test_a_down_provider_degrades_to_empty_instead_of_raising(enabled, monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_fallback_api_key", "gk-not-a-real-key")
    _patch_get(
        monkeypatch,
        {"api/tags": OLLAMA_TAGS, "models": catalog.httpx.ConnectError("down")},
    )
    assert [e.id for e in catalog.list_models()] == ["ollama:qwen3.5:4b", "ollama:llama3.2:3b"]


def test_oversized_tag_list_and_junk_names_are_dropped(enabled, monkeypatch) -> None:
    payload = FakeResponse(
        {
            "models": [
                {"name": "good:1"},
                {"name": "../../etc/passwd"},
                {"name": "with spaces"},
                {"name": ""},
                "not-a-dict",
            ]
        }
    )
    _patch_get(monkeypatch, {"api/tags": payload})
    assert [e.id for e in catalog.list_models()] == ["ollama:good:1"]


def test_probe_results_are_cached_until_the_ttl_expires(enabled, monkeypatch) -> None:
    called = _patch_get(monkeypatch, {"api/tags": OLLAMA_TAGS})
    catalog.list_models()
    catalog.list_models()
    assert len(called) == 1
    catalog.list_models(refresh=True)
    assert len(called) == 2


def test_resolve_refuses_ids_that_are_not_currently_offered(enabled, monkeypatch) -> None:
    _patch_get(monkeypatch, {"api/tags": OLLAMA_TAGS})
    assert catalog.resolve("ollama:qwen3.5:4b").model == "qwen3.5:4b"
    assert catalog.resolve("ollama:deleted-model") is None
    assert catalog.resolve("groq:anything") is None
    assert catalog.resolve(None) is None


def test_preferred_uses_the_configured_default_then_anything_live(enabled, monkeypatch) -> None:
    _patch_get(monkeypatch, {"api/tags": OLLAMA_TAGS})
    monkeypatch.setattr(settings, "ai_model", "llama3.2:3b")
    assert catalog.preferred().id == "ollama:llama3.2:3b"
    # The configured model may have been deleted locally; take what is live.
    monkeypatch.setattr(settings, "ai_model", "qwen3.5:99b")
    assert catalog.preferred().id == "ollama:qwen3.5:4b"


def test_allowlisted_reviewers_are_named_by_tier() -> None:
    assert catalog.alias_for("groq", "openai/gpt-oss-120b") == "Vulnix Ultra"
    assert catalog.alias_for("groq", "qwen/qwen3.8-27b") == "Vulnix Pro"
    assert catalog.alias_for("groq", "openai/gpt-oss-20b") == "Vulnix Fast"
    assert catalog.alias_for("gemini", "gemini-2.5-pro") == "Vulnix Wide"
    assert catalog.alias_for("gemini", "gemini-2.5-flash") == "Vulnix Steady"
    assert catalog.alias_for("ollama", "qwen3.5:4b") == "Vulnix Edge"


def test_an_unlisted_reviewer_still_gets_a_stable_vendor_free_name() -> None:
    """A second image on the host needs a name that identifies nothing."""
    local = catalog.alias_for("ollama", "llama3.2:3b")
    hosted = catalog.alias_for("groq", "mistral-large-3")
    assert local.startswith("Vulnix Edge · ")
    assert hosted.startswith("Vulnix Core · ")
    assert catalog.alias_for("ollama", "llama3.2:3b") == local
    for name in (local, hosted):
        assert "llama" not in name and "mistral" not in name


def test_source_only_says_whether_the_answer_left_the_machine() -> None:
    assert catalog.source_for("ollama") == "local"
    assert catalog.source_for("groq") == "hosted"
    # A failure recorded before any provider was chosen must not claim the host.
    assert catalog.source_for("") == "hosted"


def test_a_client_handle_is_opaque_and_matches_only_its_entry(enabled, monkeypatch) -> None:
    _patch_get(monkeypatch, {"api/tags": OLLAMA_TAGS})
    entries = catalog.list_models()
    tokens = [e.client_id for e in entries]
    assert all(t.startswith("mdl_") for t in tokens)
    assert len(set(tokens)) == len(tokens)
    assert not any("qwen" in t or "ollama" in t for t in tokens)
    # A token selects exactly the entry it came from, and nothing else resolves.
    assert catalog.resolve(tokens[0]) is not None
    assert catalog.resolve(tokens[0]).id == entries[0].id
    assert catalog.resolve("mdl_0000000000000000") is None


def test_an_id_stored_before_tokens_exist_still_resolves(enabled, monkeypatch) -> None:
    """A workspace that chose a reviewer earlier keeps its choice."""
    _patch_get(monkeypatch, {"api/tags": OLLAMA_TAGS})
    assert catalog.resolve("ollama:qwen3.5:4b").alias == "Vulnix Edge"
