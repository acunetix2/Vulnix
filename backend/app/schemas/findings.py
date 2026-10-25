"""Finding and AI explanation schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.ai.catalog import alias_for

FINDING_STATUSES = ("open", "accepted_risk", "false_positive", "fixed")
SEVERITIES = ("critical", "high", "medium", "low", "info")

# What a client may learn about a stored explanation. ``provider`` and ``model``
# are deliberately absent: the row keeps them for routing and cost, the response
# keeps only the alias they resolve to.
_EXPLANATION_FIELDS = (
    "summary",
    "impact",
    "remediation_steps",
    "verification_steps",
    "confidence",
    "limitations",
    "evidence_refs",
    "generated_at",
    "intel",
    "dep",
)


def public_explanation(stored: dict[str, Any] | None) -> dict[str, Any] | None:
    """Project a stored explanation onto the fields a client is allowed to see."""
    if not isinstance(stored, dict):
        return None
    shown = {key: stored.get(key) for key in _EXPLANATION_FIELDS if stored.get(key) is not None}
    shown["generated_by"] = stored.get("generated_by") or "ai"
    provider = str(stored.get("provider") or "")
    model = str(stored.get("model") or "")
    shown["reviewer"] = alias_for(provider, model) if provider or model else None
    shown["fallback"] = bool(stored.get("fallback"))
    return shown


class FindingOut(BaseModel):
    id: str
    scan_id: str
    # Provenance: which run reported this — the agent or one of the CLI tools.
    tool_run_id: str | None
    rule_id: str | None
    title: str
    category: str
    severity: str
    confidence: str
    file_path: str | None
    start_line: int | None
    end_line: int | None
    evidence: str | None
    scanner_message: str | None
    impact: str | None
    remediation: str | None
    status: str
    triage_note: str | None
    triaged_at: datetime | None
    created_at: datetime
    ai_explanation: dict[str, Any] | None = None
    # The agent's proposed edit, already redacted and already checked against the
    # archived file. `patch` is a unified diff this server built; it is a proposal
    # and applying it is a separate, explicit act.
    suggestion: dict[str, Any] | None = None

    model_config = {"from_attributes": True}

    @field_validator("ai_explanation", mode="before")
    @classmethod
    def _hide_reviewer_identity(cls, value):
        return public_explanation(value)


class FindingTriageUpdate(BaseModel):
    status: str
    triage_note: str | None = Field(default=None, max_length=4000)


class AIExplanationOut(BaseModel):
    finding_id: str
    generated_by: str = "ai"
    # Which reviewer answered, under its alias, and whether that was the one the
    # workspace asked for. A failover from a local model changes the answer but
    # not the request, so the UI needs both to avoid presenting a hosted reply
    # as a local one.
    reviewer: str | None = None
    fallback: bool = False
    generated_at: datetime | None = None
    summary: str
    impact: str
    remediation_steps: list[str]
    verification_steps: list[str] = []
    confidence: str
    limitations: str
    evidence_refs: list[str] = []
