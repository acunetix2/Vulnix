"""Strict output schema for AI explanations.

Validated with Pydantic before anything is stored or shown.
"""

from pydantic import BaseModel, Field, field_validator

CONFIDENCE = ("low", "medium", "high")


class AIExplanation(BaseModel):
    finding_id: str
    summary: str = Field(min_length=1, max_length=2000)
    why_it_matters: str = Field(default="", max_length=2000)
    attack_preconditions: str = Field(default="", max_length=2000)
    impact: str = Field(default="", max_length=2000)
    confidence: str = "medium"
    severity_rationale: str = Field(default="", max_length=1000)
    remediation: list[str] = Field(default_factory=list, max_length=20)
    verification_steps: list[str] = Field(default_factory=list, max_length=20)
    false_positive_notes: str = Field(default="", max_length=2000)
    evidence_refs: list[str] = Field(default_factory=list, max_length=20)
    limitations: str = Field(default="", max_length=2000)
    # True when this came back out of the finding instead of out of a call. It is
    # never stored, so it cannot survive a refresh of the row.
    cached: bool = False

    @field_validator("confidence")
    @classmethod
    def _check_confidence(cls, v: str) -> str:
        if v not in CONFIDENCE:
            return "low"
        return v

    @field_validator("remediation", "verification_steps")
    @classmethod
    def _clip_steps(cls, v: list[str]) -> list[str]:
        return [s[:500] for s in v if isinstance(s, str)][:20]
