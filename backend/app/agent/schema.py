"""Strict output schema for the review agent.

A finding may name a related file only after the investigation loaded that file.
The runner checks the path and cited range against the exact views sent to the
model, so an invented path or a line known only from a search hit is dropped
rather than stored. Actions are data requests, never shell or tool names: the
only verbs are ``read_file`` and ``search``.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

CATEGORIES = ("static_analysis", "secrets", "dependencies")
MAX_FINDINGS_PER_FILE = 10
MAX_ACTIONS_PER_TURN = 3


class AgentAction(BaseModel):
    """One read-only investigation step the server may execute for the model."""

    action: Literal["read_file", "search"]
    path: str = Field(default="", max_length=255)
    query: str = Field(default="", max_length=120)
    line: int | None = Field(default=None, ge=1)

    @field_validator("path", "query")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()


class AgentSuggestion(BaseModel):
    """The fix the reviewer would write, as lines to take out and lines to put in.

    `remove` has to be the archived text copied exactly; anything that does not
    match is discarded by `app.agent.patch`, so an invented edit cannot become a
    proposal the console offers to apply.
    """

    remove: list[str] = Field(default_factory=list, max_length=300)
    add: list[str] = Field(default_factory=list, max_length=300)
    why: str = Field(default="", max_length=500)

    @field_validator("remove", "add")
    @classmethod
    def _strings_only(cls, value: list[str]) -> list[str]:
        return [str(line)[:2000] for line in value if isinstance(line, (str, int, float))][:300]


class AgentFinding(BaseModel):
    # Empty means the primary file. A non-empty path is accepted only when the
    # investigation actually loaded that exact repository file and showed the
    # cited lines; app.agent.review enforces that boundary.
    path: str = Field(default="", max_length=255)
    title: str = Field(min_length=1, max_length=300)
    vulnerability_class: str = Field(default="", max_length=80)
    category: str = "static_analysis"
    severity: str = "medium"
    confidence: str = "low"
    start_line: int = Field(ge=1)
    end_line: int | None = Field(default=None, ge=1)
    evidence: str = Field(min_length=1, max_length=2000)
    impact: str = Field(default="", max_length=2000)
    remediation: list[str] = Field(default_factory=list, max_length=10)
    suggestion: AgentSuggestion | None = None

    @field_validator("category")
    @classmethod
    def _known_category(cls, value: str) -> str:
        # Only the categories the rest of the product can filter on.
        return value if value in CATEGORIES else "static_analysis"

    @field_validator("remediation")
    @classmethod
    def _clip_steps(cls, value: list[str]) -> list[str]:
        return [str(step)[:500] for step in value if isinstance(step, str)][:10]


class AgentReview(BaseModel):
    # Short-lived working state for the next turn, not a user-facing summary.
    # It lets the model say which hypothesis it is chasing without sending the
    # whole conversation back through a small context window.
    assessment: str = Field(default="", max_length=1500)
    findings: list[AgentFinding] = Field(default_factory=list, max_length=MAX_FINDINGS_PER_FILE)
    actions: list[AgentAction] = Field(default_factory=list, max_length=MAX_ACTIONS_PER_TURN)
