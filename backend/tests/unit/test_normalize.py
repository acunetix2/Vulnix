"""Normalization, fingerprinting, and redaction unit tests."""

from app.ai.redaction import redact
from app.scanning.normalize import NormalizedFinding, normalize_confidence, normalize_severity


def _finding(**kwargs) -> NormalizedFinding:
    base = dict(rule_id="R1", title="t", category="static_analysis", severity="high")
    base.update(kwargs)
    return NormalizedFinding(**base)


def test_fingerprint_is_stable() -> None:
    a = _finding(file_path="a.py", start_line=10, scanner_message="msg")
    b = _finding(file_path="a.py", start_line=10, scanner_message="msg")
    assert a.fingerprint() == b.fingerprint()


def test_fingerprint_changes_with_location() -> None:
    a = _finding(file_path="a.py", start_line=10)
    b = _finding(file_path="a.py", start_line=20)
    assert a.fingerprint() != b.fingerprint()


def test_fingerprint_masks_secret_values() -> None:
    a = _finding(scanner_message="token=abcd1234efgh5678")
    b = _finding(scanner_message="token=zzzz9999yyyy8888")
    assert a.fingerprint() == b.fingerprint()


def test_severity_mapping() -> None:
    assert normalize_severity("ERROR") == "high"
    assert normalize_severity("warning") == "medium"
    assert normalize_severity("weird-value") == "info"
    assert normalize_severity(None) == "info"


def test_confidence_mapping() -> None:
    assert normalize_confidence("HIGH") == "high"
    assert normalize_confidence("nonsense") == "unknown"


def test_redaction_masks_common_secrets() -> None:
    cases = [
        ('password = "hunter2-secret"', "hunter2-secret"),
        ("api_key=sk-12345678901234567890", "sk-12345678901234567890"),
        ("AKIA1234567890ABCDEF", "AKIA1234567890ABCDEF"),
        ("ghp_abcdefghijklmnopqrstuv", "ghp_abcdefghijklmnopqrstuv"),
        ("postgres://user:pass@host/db", "user:pass@host"),
        ("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghij", "eyJhbGciOiJIUzI1NiJ9"),
    ]
    for raw, secret in cases:
        redacted = redact(raw)
        assert redacted is not None
        assert secret not in redacted


def test_redaction_preserves_non_secret_text() -> None:
    text = "Use parameterized queries to build SQL safely."
    assert redact(text) == text
