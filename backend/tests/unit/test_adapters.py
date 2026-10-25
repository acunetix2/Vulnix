"""Adapter normalization tests using known tool-output fixtures.

Fixtures use fake placeholder secrets only, per ACCEPTANCE_CRITERIA.
"""

import json
from pathlib import Path

FIXTURES = Path(__file__).parent.parent / "fixtures" / "tools"


def _load(name: str):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_semgrep_fixture_normalizes_severity_and_location() -> None:
    from app.scanning.adapters import SemgrepAdapter

    findings = SemgrepAdapter().normalize(_load("semgrep.json"))
    assert len(findings) == 2
    shell = next(f for f in findings if "shell-true" in (f.rule_id or ""))
    assert shell.severity == "high"  # ERROR maps to high
    assert shell.confidence == "high"
    assert shell.file_path == "app/login.py"
    assert (shell.start_line, shell.end_line) == (3, 3)
    assert "shell=True" in (shell.evidence or "")
    assert shell.tool == "semgrep"
    # WARNING maps to medium
    password = next(f for f in findings if "hardcoded-password" in (f.rule_id or ""))
    assert password.severity == "medium"


def test_gitleaks_fixture_never_exposes_secret_values() -> None:
    from app.scanning.adapters import GitleaksAdapter

    findings = GitleaksAdapter().normalize(_load("gitleaks.json"))
    assert len(findings) == 2
    for f in findings:
        blob = " ".join(x for x in (f.evidence, f.scanner_message, f.title) if x)
        assert "AKIA1234567890ABCDEF" not in blob  # raw secret stays out
        assert "sk_live_0000000000000000" not in blob
        assert f.severity == "high"
        assert f.category == "secrets"


def test_bandit_fixture_maps_confidence_and_severity() -> None:
    from app.scanning.adapters import BanditAdapter

    findings = BanditAdapter().normalize(_load("bandit.json"))
    assert len(findings) == 2
    shell = next(f for f in findings if f.rule_id == "B605")
    assert shell.severity == "high"
    assert shell.confidence == "medium"
    assert shell.start_line == 21
    md5 = next(f for f in findings if f.rule_id == "B303")
    assert md5.severity == "medium"
    assert md5.confidence == "high"


def test_pip_audit_fixture_skips_clean_dependencies() -> None:
    from app.scanning.adapters import PipAuditAdapter

    findings = PipAuditAdapter().normalize(_load("pip_audit.json"))
    assert len(findings) == 1  # flask has no vulns
    assert findings[0].rule_id == "PYSEC-2018-64"
    assert findings[0].category == "dependencies"
    assert "2.20.0" in (findings[0].remediation or "")


def test_trivy_fixture_maps_severity_and_fix_version() -> None:
    from app.scanning.adapters import TrivyAdapter

    findings = TrivyAdapter().normalize(_load("trivy.json"))
    assert len(findings) == 1
    assert findings[0].severity == "high"
    assert findings[0].file_path == "requirements.txt"
    assert "2.31.0" in (findings[0].remediation or "")


def test_empty_outputs_produce_no_findings() -> None:
    from app.scanning.adapters import BanditAdapter, GitleaksAdapter, SemgrepAdapter

    assert SemgrepAdapter().normalize({"results": []}) == []
    assert GitleaksAdapter().normalize([]) == []
    assert BanditAdapter().normalize({"results": []}) == []
    # Malformed output must not raise.
    assert SemgrepAdapter().normalize(None) == []
    assert BanditAdapter().normalize("garbage") == []


def test_fingerprint_includes_tool_identity() -> None:
    # Same rule/path from two tools must be distinct findings (DATA_MODEL).
    from app.scanning.normalize import NormalizedFinding

    def make(tool: str) -> str:
        f = NormalizedFinding(
            rule_id="R1", title="t", category="static_analysis", severity="high",
            tool=tool, file_path="a.py", start_line=1,
        )
        return f.fingerprint()

    assert make("semgrep") != make("bandit")
    assert make("semgrep") == make("semgrep")


def test_adapters_declare_supported_file_types() -> None:
    from app.scanning.adapters import BanditAdapter, GitleaksAdapter, SemgrepAdapter

    assert ".py" in BanditAdapter.supported_file_types
    assert ".py" in SemgrepAdapter.supported_file_types
    assert GitleaksAdapter.supported_file_types == ("*",)
