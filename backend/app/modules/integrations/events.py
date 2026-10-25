"""Event payload building for outbound integrations.

Payloads leave the trust boundary, so they are built from identifiers and
counts only: never source code, file paths, evidence snippets or credentials.
Free-text fields that originate from scanner output are redacted and truncated.
"""

from datetime import UTC, datetime

from app.ai.redaction import redact

EVENT_SCAN_COMPLETED = "scan.completed"
EVENT_SCAN_FAILED = "scan.failed"
EVENT_FINDING_TRIAGED = "finding.triaged"
EVENT_TEST = "integration.test"

WEBHOOK_EVENT_TYPES = (EVENT_SCAN_COMPLETED, EVENT_SCAN_FAILED, EVENT_FINDING_TRIAGED, EVENT_TEST)

_MAX_TEXT_CHARS = 300
_SEVERITIES = ("critical", "high", "medium", "low", "info")


def _clip(text: str | None) -> str:
    cleaned = " ".join((text or "").split())
    return redact(cleaned)[:_MAX_TEXT_CHARS] if cleaned else ""


def _counts(summary: dict | None) -> dict[str, int]:
    by_severity = (summary or {}).get("by_severity") or {}
    return {key: int(by_severity.get(key, 0) or 0) for key in _SEVERITIES}


def _tools(summary: dict | None) -> list[str]:
    runs = (summary or {}).get("tool_runs") or []
    return sorted({run["tool"] for run in runs if isinstance(run, dict) and run.get("tool")})


def scan_event(scan, project) -> dict:
    """Snapshot of a finished scan, safe to hand to a third party."""
    status = scan.status
    event = EVENT_SCAN_FAILED if status in ("failed", "cancelled") else EVENT_SCAN_COMPLETED
    summary = scan.summary or {}
    return {
        "event": event,
        "occurred_at": datetime.now(UTC).isoformat(),
        "workspace_id": project.workspace_id,
        "project": {"id": project.id, "name": _clip(project.name)},
        "scan": {
            "id": scan.id,
            "status": status,
            "error_code": scan.error_code,
            "total_findings": summary.get("total_findings", 0),
            "by_severity": _counts(summary),
            "analyzers": _tools(summary),
        },
    }


def triage_event(finding, project) -> dict:
    return {
        "event": EVENT_FINDING_TRIAGED,
        "occurred_at": datetime.now(UTC).isoformat(),
        "workspace_id": project.workspace_id,
        "project": {"id": project.id, "name": _clip(project.name)},
        "finding": {
            "id": finding.id,
            "title": _clip(finding.title),
            "category": finding.category,
            "severity": finding.severity,
            "status": finding.status,
        },
    }


def test_event(workspace_id: str, provider: str) -> dict:
    return {
        "event": EVENT_TEST,
        "occurred_at": datetime.now(UTC).isoformat(),
        "workspace_id": workspace_id,
        "test_of": provider,
        "message": "Vulnix integration test. No finding data is included.",
    }


def _severity_line(counts: dict) -> str:
    return ", ".join(f"{count} {name}" for name, count in (counts or {}).items() if count)


def summarize(payload: dict) -> str:
    """One-line text used for Slack messages and Jira descriptions."""
    event = payload.get("event", "")
    project = (payload.get("project") or {}).get("name") or "project"

    if event == EVENT_TEST:
        return "Vulnix integration test - no finding data is included."

    if event == EVENT_FINDING_TRIAGED:
        finding = payload.get("finding") or {}
        title = _clip(finding.get("title")) or "Finding"
        return f"{project}: {title} set to {finding.get('status') or 'unknown'}"

    scan = payload.get("scan") or {}
    status = scan.get("status") or "finished"
    counts = _severity_line(scan.get("by_severity"))
    if event == EVENT_SCAN_FAILED:
        reason = f" [{scan.get('error_code')}]" if scan.get("error_code") else ""
        return f"{project}: scan {status}{reason}"
    return f"{project}: scan {status} ({counts})" if counts else f"{project}: scan {status}"
