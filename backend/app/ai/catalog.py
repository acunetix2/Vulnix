"""Allowlisted AI reviewers with live, provider-reported availability.

A client may name a model only by one of these entry ids. Model names are
never free-form client input: the string that reaches a provider always comes
out of a server-built entry, and every entry is one the provider itself
reported as reachable a moment ago.

What leaves the server is an alias and an opaque token, never a vendor model
name. The real provider and tag stay in this process and in the usage table,
where they are needed for routing and cost, and nowhere else.

Availability is probed rather than asserted. Groq and Google expose a different
set per account, and Ollama only knows what is pulled locally, so a static
catalogue would offer models that then fail on the request path.
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

# Google AI Studio candidates, checked the same way against the account's own
# model list. These are the long-context reviewers: an audit that has to hold a
# whole subsystem in view can continue here. Notes describe behaviour only.
GEMINI_CANDIDATES: tuple[tuple[str, str], ...] = (
    (
        "gemini-2.5-pro",
        "Widest-context reviewer. Reads a whole subsystem in one pass.",
    ),
    (
        "gemini-2.5-flash",
        "Steady reviewer for long files. Faster to answer than the widest.",
    ),
)

# OpenRouter candidates, checked the same way. These are the narrow-window
# reviewers: 32k tokens takes a file or a function, not a subsystem, so an audit
# hands a long one to a wider reviewer instead of asking for a rejection.
OPENROUTER_CANDIDATES: tuple[tuple[str, str], ...] = (
    (
        "qwen/qwen2.5-coder-32b-instruct:free",
        "Free-tier coder review for one file at a time. Quickest to answer.",
    ),
    (
        "qwen/qwen2.5-coder-32b-instruct",
        "Same coder pass without the free-tier wait. Still one file at a time.",
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
    "gemini:gemini-2.5-pro": "Vulnix Wide",
    "gemini:gemini-2.5-flash": "Vulnix Steady",
    "openrouter:qwen/qwen2.5-coder-32b-instruct:free": "Vulnix Sprint",
    "openrouter:qwen/qwen2.5-coder-32b-instruct": "Vulnix Focus",
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
    """What the host offers locally, when this deployment runs its own model.

    Off by default (ADR-017): the product's reviewers are hosted, so the listing
    is not asked for at all rather than asked and then filtered. Turning
    `ai_local_enabled` on brings the whole local path back - adapter, aliases,
    context settings and all.
    """
    if not settings.ai_local_enabled:
        return []
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
            for item in _listing(resp.json())
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


def _probe_gemini() -> list[ModelEntry]:
    if not settings.gemini_ready:
        return []
    try:
        resp = httpx.get(
            f"{settings.gemini_base_url.rstrip('/')}/models",
            headers={"Authorization": f"Bearer {settings.gemini_api_key}"},
            timeout=PROBE_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        reachable = {
            str(item.get("id") or "").split("/", 1)[-1]
            for item in _listing(resp.json())
            if isinstance(item, dict) and item.get("id")
        }
    except (httpx.HTTPError, ValueError, OSError):
        logger.warning("ai_probe_failed provider=gemini")
        return []

    entries: list[ModelEntry] = []
    for model, note in GEMINI_CANDIDATES:
        if model not in reachable:
            continue
        entry = _entry("gemini", model, note, "hosted")
        if entry:
            entries.append(entry)
    return entries


def _probe_openrouter() -> list[ModelEntry]:
    if not settings.openrouter_ready:
        return []
    try:
        resp = httpx.get(
            f"{settings.openrouter_base_url.rstrip('/')}/models",
            headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
            timeout=PROBE_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        # OpenRouter lists the free tier as its own model id, suffix included, so
        # the account is matched on the exact name and only that name is asked of
        # it. Stripping ":free" would offer a paid model to a key that cannot use
        # it, and the request would be refused at a cost of one failed handover.
        reachable = {
            str(item.get("id"))
            for item in _listing(resp.json())
            if isinstance(item, dict) and item.get("id")
        }
    except (httpx.HTTPError, ValueError, OSError):
        logger.warning("ai_probe_failed provider=openrouter")
        return []

    entries: list[ModelEntry] = []
    for model, note in OPENROUTER_CANDIDATES:
        if model not in reachable:
            continue
        entry = _entry("openrouter", model, note, "hosted")
        if entry:
            entries.append(entry)
    return entries


def _listing(body: object) -> list:
    """The model array from either response shape, dropping anything unreadable."""
    if not isinstance(body, dict):
        return []
    reported = body.get("data")
    if reported is None:
        # A native-style listing wraps entries under "models" and prefixes each
        # name with "models/", so accept both shapes and strip the prefix.
        reported = body.get("models") or []
        return [
            {"id": str(item.get("id") or item.get("name") or "").split("/", 1)[-1]}
            if isinstance(item, dict)
            else item
            for item in reported
        ]
    return reported if isinstance(reported, list) else []


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
        # A local model comes first when the deployment opts into one, then the
        # hosted reviewers in configuration order: a deployment must never default
        # onto the newest provider by accident.
        entries = _probe_ollama() + _probe_groq() + _probe_gemini() + _probe_openrouter()
        _cache = (now, entries)
        return list(entries)


def handover_model(provider: str, configured_default: str) -> str | None:
    """The model to ask of a reviewer that is taking over a failed audit turn.

    Only a name this account has reported comes back. The operator's configured
    name is used when the probe confirmed it, and the first confirmed name when it
    did not. When the provider reports nothing at all the answer is None rather
    than a guess, because a handover that names a model the reviewer has never
    offered spends its one attempt on a request that is refused - and the link is
    then parked as though it had an outage. A skipped link costs nothing.
    """
    names = [entry.model for entry in list_models() if entry.provider == provider]
    if configured_default and configured_default in names:
        return configured_default
    return names[0] if names else None


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
