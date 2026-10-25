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
    monkeypatch.setattr(settings, "ai_provider", "ollama")
    monkeypatch.setattr(settings, "ai_model", "")
    monkeypatch.setattr(settings, "ai_base_url", "http://localhost:11434")
    monkeypatch.setattr(settings, "ai_api_key", "")
    monkeypatch.setattr(settings, "ai_fallback_api_key", "")
    catalog.clear_cache()


OLLAMA_TAGS = FakeResponse({"models": [{"name": "qwen3.5:4b"}, {"name": "llama3.2:3b"}]})
GROQ_MODELS = FakeResponse({"data": [{"id": "qwen/qwen3.8-27b"}, {"id": "openai/gpt-oss-20b"}]})


def test_nothing_is_offered_when_ai_is_disabled(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_enabled", False)
    catalog.clear_cache()
    assert catalog.list_models() == []


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
