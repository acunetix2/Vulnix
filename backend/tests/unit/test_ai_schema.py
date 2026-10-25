"""AI output schema validation tests."""

import pytest
from pydantic import ValidationError

from app.ai.schema import AIExplanation


def test_valid_payload_parses() -> None:
    data = {
        "finding_id": "f-1",
        "summary": "SQL query built with string concatenation.",
        "impact": "An attacker may alter query logic.",
        "confidence": "high",
        "remediation": ["Use parameterized queries."],
        "verification_steps": ["Re-run the scanner."],
        "evidence_refs": ["f-1"],
        "limitations": "Only local context was reviewed.",
    }
    parsed = AIExplanation.model_validate(data)
    assert parsed.confidence == "high"
    assert parsed.remediation == ["Use parameterized queries."]


def test_invalid_confidence_is_downgraded() -> None:
    parsed = AIExplanation.model_validate({"finding_id": "f-1", "summary": "x", "confidence": "certain"})
    assert parsed.confidence == "low"


def test_missing_summary_is_rejected() -> None:
    with pytest.raises(ValidationError):
        AIExplanation.model_validate({"finding_id": "f-1"})


def test_oversized_steps_are_clipped() -> None:
    parsed = AIExplanation.model_validate(
        {"finding_id": "f-1", "summary": "x", "remediation": ["y" * 2000]}
    )
    assert len(parsed.remediation[0]) == 500
