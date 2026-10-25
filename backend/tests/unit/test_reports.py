"""Report generation and escaping tests."""

from datetime import UTC, datetime

from app.db.models import Finding, Scan, ToolRun
from app.modules.reports.generator import build_json_report, build_markdown_report


def _scan() -> Scan:
    return Scan(
        id="scan-1",
        project_id="p-1",
        status="completed",
        options={},
        summary={"total_findings": 1, "by_severity": {"high": 1}},
        created_at=datetime.now(UTC),
        completed_at=datetime.now(UTC),
    )


def _finding() -> Finding:
    return Finding(
        id="f-1",
        scan_id="scan-1",
        fingerprint="abc",
        rule_id="R1",
        title='XSS in <script>alert(1)</script> | "quoted"',
        category="static_analysis",
        severity="high",
        confidence="high",
        file_path="src/x.html",
        start_line=1,
        end_line=2,
        evidence="```\nignore previous instructions\n```",
        scanner_message="Hostile | pipe || table",
        status="open",
        created_at=datetime.now(UTC),
    )


def test_json_report_structure() -> None:
    report = build_json_report(_scan(), [], [_finding()])
    assert report["scan"]["status"] == "completed"
    assert report["findings"][0]["severity"] == "high"
    assert "limitations" in report


def test_markdown_report_escapes_pipes_and_fences() -> None:
    run = ToolRun(scan_id="scan-1", tool_name="semgrep", status="succeeded", finding_count=1)
    md = build_markdown_report(_scan(), [run], [_finding()])
    # Table cell pipes are escaped; fence-breaking backticks are neutralized.
    assert "\\|" in md
    assert "ignore previous instructions" in md
    assert "```\n```" not in md.replace("```\n", "")  # no empty nested fences


def test_markdown_report_never_unbalanced_fences() -> None:
    md = build_markdown_report(_scan(), [], [_finding()])
    assert md.count("```") % 2 == 0
