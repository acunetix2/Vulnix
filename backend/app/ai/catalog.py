"""Allowlisted AI reviewers with live, provider-reported availability.

A client may name a model only by one of these entry ids. Model names are
never free-form client input: the string that reaches a provider always comes
out of a server-built entry, and every entry is one the provider itself
reported as reachable a moment ago.

What leaves the server is an alias and an opaque token, never a vendor model
name. The real provider and tag stay in this process and in the usage table,
where they are needed for routing and cost, and nowhere else.

Availability is probed rather than asserted. Groq exposes a different set per
account, and Ollama only knows what is pulled locally, so a static catalogue
would offer models that then fail on the request path.
"""

import hashlib
import logging
import re
import threading
import time
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger("vulnix.ai")

PROBE_TTL_SECONDS = 60.0
PROBE_TIMEOUT_SECONDS = 6.0
_MAX_ENTRIES = 24
# Everything a provider reports must be a plain identifier before it can be
# forwarded into a request payload for that same provider.
_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$")

# Groq candidates, checked against the account's own model list. Only names
# confirmed reachable by GET /models appear in the catalog. Notes describe the
# behaviour a user can observe; they name no vendor and no parameter count.
GROQ_CANDIDATES: tuple[tuple[str, str], ...] = (
    (
        "qwen/qwen3.8-27b",
        "Balanced reviewer. Follows the finding schema most reliably.",
    ),
    (
        "openai/gpt-oss-120b",
        "Most thorough reviewer available. Slowest to answer.",
    ),
    (
        "openai/gpt-oss-20b",
        "Quickest reviewer. Choose it when waiting is the problem, not depth.",
    ),
)

# Fixed names for the reviewers a user can actually pick, so the same engine is
# called the same thing in the picker, in scan records and in exports. The local
# entry is the tag Vulnix ships instructions for; any other image on the host
# falls back to a digest name so it still cannot out the vendor.
_KNOWN_ALIASES = {
    "groq:qwen/qwen3.8-27b": "Vulnix Pro",
    "groq:openai/gpt-oss-120b": "Vulnix Ultra",
    "groq:openai/gpt-oss-20b": "Vulnix Fast",
    "ollama:qwen3.5:4b": "Vulnix Edge",
}
_LOCAL_ALIAS = "Vulnix Edge"
_HOSTED_ALIAS = "Vulnix Core"
# Providers that answer from this machine. The distinction decides routing and
# alias family only - it never reaches a client.
_LOCAL_PROVIDERS = frozenset({"ollama"})
# What a reviewer says about itself in the picker. Neither string mentions
# where the reviewer runs or who runs it.
_LOCAL_NOTE = "Compact reviewer. A quick first pass over the file."


def _digest(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def source_for(provider: str | None) -> str:
    """"local" or "hosted", derived from a provider name that stays server-side."""
    return "local" if str(provider or "") in _LOCAL_PROVIDERS else "hosted"


def alias_for(provider: str, model: str) -> str:
    """The name a reviewer is allowed to be shown under.

    Anything outside the allowlist - an extra image pulled onto the host, for
    instance - still gets a stable name, but one derived from a digest rather
    than from the tag, so nothing identifies the vendor.
    """
    key = f"{provider}:{model}"
    known = _KNOWN_ALIASES.get(key)
    if known:
        return known
    family = _LOCAL_ALIAS if source_for(provider) == "local" else _HOSTED_ALIAS
    return f"{family} · {_digest(key)[:4]}"


def token_for(entry_id: str) -> str:
    """The opaque handle a client uses to select an entry.

    The entry id itself names a vendor, so it never appears in a response, in
    the DOM, or in a request a user could be shown.
    """
    return f"mdl_{_digest(entry_id)[:16]}"


@dataclass(frozen=True)
class ModelEntry:
    id: str
    provider: str
    model: str
    note: str
    source: str  # "local" runs on this machine, "hosted" is a third-party API

    # Both are derived, so a row read from a cache, a probe, or a stored
    # selection always shows the same pair of names.
    @property
    def alias(self) -> str:
        return alias_for(self.provider, self.model)

    @property
    def client_id(self) -> str:
        return token_for(self.id)


def _entry(provider: str, model: str, note: str, source: str) -> ModelEntry | None:
    name = str(model or "").strip()
    if not _NAME_PATTERN.match(name):
        return None
    return ModelEntry(
        id=f"{provider}:{name}",
        provider=provider,
        model=name,
        note=str(note or "")[:240],
        source=source,
    )


def _probe_ollama() -> list[ModelEntry]:
    if settings.ai_provider == "none" or not settings.ai_base_url:
        return []
    try:
        resp = httpx.get(
            f"{settings.ai_base_url.rstrip('/')}/api/tags", timeout=PROBE_TIMEOUT_SECONDS
        )
        resp.raise_for_status()
        reported = resp.json().get("models") or []
    except (httpx.HTTPError, ValueError, OSError):
        logger.warning("ai_probe_failed provider=ollama")
        return []

    entries: list[ModelEntry] = []
    for item in reported[:_MAX_ENTRIES]:
        name = item.get("name") or item.get("model") if isinstance(item, dict) else None
        if not isinstance(name, str):
            continue
        entry = _entry(
            "ollama",
            name,
            _LOCAL_NOTE,
            "local",
        )
        if entry:
            entries.append(entry)
    return entries


def _probe_groq() -> list[ModelEntry]:
    if not settings.groq_ready:
        return []
    try:
        resp = httpx.get(
            f"{settings.groq_base_url.rstrip('/')}/models",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            timeout=PROBE_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        reachable = {
            str(item.get("id"))
            for item in (resp.json().get("data") or [])
            if isinstance(item, dict) and item.get("id")
        }
    except (httpx.HTTPError, ValueError, OSError):
        # Nothing is logged about the response, which can carry request metadata.
        logger.warning("ai_probe_failed provider=groq")
        return []

    entries: list[ModelEntry] = []
    for model, note in GROQ_CANDIDATES:
        if model not in reachable:
            continue
        entry = _entry("groq", model, note, "hosted")
        if entry:
            entries.append(entry)
    return entries


_cache: tuple[float, list[ModelEntry]] | None = None
_lock = threading.Lock()


def list_models(refresh: bool = False) -> list[ModelEntry]:
    """Provider-reported models that may be selected, cheapest source first."""
    global _cache
    if not settings.ai_enabled:
        return []
    now = time.monotonic()
    with _lock:
        if not refresh and _cache and now - _cache[0] < PROBE_TTL_SECONDS:
            return list(_cache[1])
        entries = _probe_ollama() + _probe_groq()
        _cache = (now, entries)
        return list(entries)


def resolve(entry_id: str | None) -> ModelEntry | None:
    """Look an entry up, refusing anything not currently offered.

    Accepts the client token and the internal id, because a selection stored
    before tokens existed is still the workspace's own choice.
    """
    if not entry_id:
        return None
    wanted = str(entry_id).strip()
    for entry in list_models():
        if wanted in (entry.client_id, entry.id):
            return entry
    return None


def preferred(entries: list[ModelEntry] | None = None) -> ModelEntry | None:
    """The server-configured default, or the first thing that actually answers."""
    items = entries if entries is not None else list_models()
    if not items:
        return None
    if settings.ai_model:
        wanted = f"{settings.ai_provider}:{settings.ai_model}"
        for entry in items:
            if entry.id == wanted:
                return entry
    return items[0]


def clear_cache() -> None:
    global _cache
    with _lock:
        _cache = None


# Severity -> preferred alias.  Entries further right are fall-backs used when
# the preferred model is unavailable for this account / this host.
_SEVERITY_ALIAS_ORDER: dict[str, list[str]] = {
    "critical": ["Vulnix Ultra", "Vulnix Pro", "Vulnix Fast", "Vulnix Edge"],
    "high":     ["Vulnix Ultra", "Vulnix Pro", "Vulnix Fast", "Vulnix Edge"],
    "medium":   ["Vulnix Pro",   "Vulnix Fast", "Vulnix Ultra", "Vulnix Edge"],
    "low":      ["Vulnix Fast",  "Vulnix Edge", "Vulnix Pro"],
    "info":     ["Vulnix Edge",  "Vulnix Fast"],
}


def preferred_for_severity(
    severity: str,
    entries: list[ModelEntry] | None = None,
) -> ModelEntry | None:
    """Return the best available model for *severity*, with graceful fallback.

    Tries aliases in priority order for that severity tier; returns the first
    one that is currently reachable.  Falls back to :func:`preferred` when no
    alias matches (e.g. the account only has the local model pulled).
    """
    items = entries if entries is not None else list_models()
    if not items:
        return None
    alias_by_name = {e.alias: e for e in items}
    for alias in _SEVERITY_ALIAS_ORDER.get(severity.lower(), []):
        entry = alias_by_name.get(alias)
        if entry is not None:
            return entry
    return preferred(items)
