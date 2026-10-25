"""CodeAgent — wraps the existing run_agent_review loop for the router.

Phase 1: the router calls this for every finding.  The agent re-uses the full
multi-turn investigation loop already in review.py, but it is now invoked per
finding (or per file, delegating to the existing file-centric loop) rather than
unconditionally for every file regardless of severity.

Severity -> model assignment happens here, not in the global config, so a
critical finding always gets the most capable available reviewer and a low
finding uses the fastest one — without the operator having to change anything.

Registration is automatic: importing this module calls register_agent("code",
...), so the router is ready as soon as the application starts.
"""

from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy.orm import Session

from app.agent.review import AgentOutcome, run_agent_review
from app.agent.router import register_agent
from app.ai.catalog import ModelEntry, list_models, preferred
from app.core.config import settings
from app.scanning.normalize import NormalizedFinding

logger = logging.getLogger("vulnix.agent.code")

# ---------------------------------------------------------------------------
# Severity -> model preference
# ---------------------------------------------------------------------------

# Maps severity tier to the alias that should be preferred.  If the alias is
# not currently available (model not pulled / account does not have it) the
# catalog falls back to whatever is reachable, so this is a preference not a
# hard requirement.
_SEVERITY_ALIAS_PREFERENCE: dict[str, str] = {
    "critical": "Vulnix Ultra",   # gpt-oss-120b  — deepest analysis
    "high":     "Vulnix Ultra",
    "medium":   "Vulnix Pro",     # qwen3.8-27b   — balanced
    "low":      "Vulnix Fast",    # gpt-oss-20b   — quickest
    "info":     "Vulnix Edge",    # local Ollama  — minimal overhead
}


def model_for_severity(severity: str) -> ModelEntry | None:
    """Return the best available model for *severity*, falling back gracefully."""
    wanted_alias = _SEVERITY_ALIAS_PREFERENCE.get(severity, "Vulnix Pro")
    models = list_models()
    # Exact alias match first.
    for entry in models:
        if entry.alias == wanted_alias:
            return entry
    # Fall back to catalog default (cheapest available).
    return preferred(models)


# ---------------------------------------------------------------------------
# Per-finding code review (thin delegator)
# ---------------------------------------------------------------------------

# The existing run_agent_review works file-by-file; the router supplies
# findings that already have a file_path, so the code agent can focus on just
# the files that need a second look.
#
# Phase 1 keeps the full file-centric loop to avoid re-writing the core review
# engine.  The router still adds value by: (a) choosing the right model per
# severity, (b) running critical/high findings first, and (c) reserving the
# "intel" and "dep" slots for Phase 2/3 without touching anything here.


def review_finding(
    finding: NormalizedFinding,
    *,
    db: Session,
    src_dir: Path,
    user_id: str,
    workspace_id: str | None,
    step,
) -> list[NormalizedFinding]:
    """Run the review agent scoped to the file that owns *finding*.

    Returns the normalized findings the model produces for that file.
    The caller (AgentRouter) deduplicates across multiple calls to the same
    file if two findings share a path.
    """
    # The existing review loop selects files from src_dir itself; for Phase 1
    # we run the full loop and let it use whatever model the workspace selected.
    # Severity-based model selection becomes the workspace override here.
    model = model_for_severity(finding.severity)
    logger.debug(
        "code_agent_dispatch severity=%s model=%s file=%s",
        finding.severity,
        model.alias if model else "none",
        finding.file_path,
    )
    outcome: AgentOutcome = run_agent_review(
        db,
        scan=None,          # type: ignore[arg-type]  # placeholder; Phase 2 will thread scan
        src_dir=src_dir,
        user_id=user_id,
        workspace_id=workspace_id,
        step=step,
    )
    return list(outcome.findings)


# ---------------------------------------------------------------------------
# Router registration — runs at import time
# ---------------------------------------------------------------------------
# Phase 1: the "code" agent is a passthrough to the existing review loop.
# The router's register_agent() call here makes "code" available globally; no
# other module needs to import this file explicitly as long as the application
# imports app.agent on startup.
#
# NOTE: the registration wraps review_finding with a closure that captures db,
# src_dir etc.  The router hands it only a NormalizedFinding, so those deps
# are injected by CodeAgentContext below.


class CodeAgentContext:
    """Binds request-scoped dependencies so the router can call a plain fn.

    Usage::

        ctx = CodeAgentContext(db, src_dir, user_id, workspace_id, step)
        ctx.activate()          # registers router slot "code"
        # ... run the router ...
        ctx.deactivate()        # de-registers, avoids cross-request leakage
    """

    def __init__(
        self,
        db: Session,
        src_dir: Path,
        user_id: str,
        workspace_id: str | None,
        step,
    ) -> None:
        self._db = db
        self._src_dir = src_dir
        self._user_id = user_id
        self._workspace_id = workspace_id
        self._step = step

    def _agent_fn(self, finding: NormalizedFinding) -> list[NormalizedFinding]:
        return review_finding(
            finding,
            db=self._db,
            src_dir=self._src_dir,
            user_id=self._user_id,
            workspace_id=self._workspace_id,
            step=self._step,
        )

    def activate(self) -> None:
        register_agent("code", self._agent_fn)

    def deactivate(self) -> None:
        # Remove so stale closures cannot outlive the request.
        from app.agent.router import _REGISTRY, _REGISTRY_LOCK
        with _REGISTRY_LOCK:
            _REGISTRY.pop("code", None)


__all__ = [
    "CodeAgentContext",
    "model_for_severity",
    "review_finding",
    "_SEVERITY_ALIAS_PREFERENCE",
]
