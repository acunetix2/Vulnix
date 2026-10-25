"""Scan orchestration: extract, review, scan, normalize, persist, clean up.

Runs inside a worker (Celery or eager). The AI review agent is the scanner; the
CLI tools are optional inputs whose absence is recorded as a note and never
fails the scan. One tool crashing never discards another's results.
"""

import logging
import shutil
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.review import AGENT_TOOL_NAME, AgentOutcome, run_agent_review
from app.agent.router import AgentRouter, RouterOutcome
from app.core.config import settings
from app.core.errors import AppError
from app.db.models import Finding, Project, Scan, ToolRun, Upload
from app.db.session import SessionLocal
from app.integrations.storage import get_storage
from app.modules.audit.service import record_event
from app.modules.integrations.service import emit_scan_event
from app.scanning.adapters import build_adapters
from app.scanning.archive import extract_archive

logger = logging.getLogger("vulnix.pipeline")

_ACTIVE = ("queued", "running")
# How much of the live step trace the scan record keeps. The oldest steps fall
# off rather than the list growing without bound on a large repository.
_MAX_STEPS = 240


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _aware(dt: datetime | None) -> datetime | None:
    # SQLite drops tzinfo; normalize so duration math never mixes naive/aware.
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def _persist_findings(db: Session, scan: Scan, tool_run: ToolRun, findings: list) -> int:
    existing = set(db.scalars(select(Finding.fingerprint).where(Finding.scan_id == scan.id)))
    stored = 0
    for f in findings:
        fp = f.fingerprint()
        if fp in existing:  # dedupe within the scan
            continue
        existing.add(fp)
        db.add(
            Finding(
                scan_id=scan.id,
                tool_run_id=tool_run.id,
                fingerprint=fp,
                rule_id=f.rule_id,
                title=f.title[:500],
                category=f.category,
                severity=f.severity,
                confidence=f.confidence,
                file_path=f.file_path,
                start_line=f.start_line,
                end_line=f.end_line,
                evidence=f.evidence,
                scanner_message=f.scanner_message,
                impact=f.impact,
                remediation=f.remediation,
                suggestion=f.suggestion,
                ai_explanation=f.extra if f.extra else None,
            )
        )
        stored += 1
    db.commit()
    return stored


def _finish(db: Session, scan: Scan, status: str, error_code: str | None = None) -> None:
    scan.status = status
    scan.completed_at = _utcnow()
    if error_code:
        scan.error_code = error_code
    db.commit()


def execute_scan(scan_id: str) -> None:
    db = SessionLocal()
    try:
        scan = db.get(Scan, scan_id)
        if scan is None or scan.status != "queued":
            return  # job is stale or already handled

        scan.status = "running"
        scan.started_at = _utcnow()
        db.commit()

        project = db.get(Project, scan.project_id)
        record_event(
            db,
            workspace_id=project.workspace_id,
            actor_id=scan.requested_by,
            action="scan.started",
            resource_type="scan",
            resource_id=scan.id,
        )

        upload = db.get(Upload, scan.upload_id) if scan.upload_id else None
        if upload is None or upload.status in ("deleted", "rejected"):
            _finish(db, scan, "failed", "UPLOAD_UNAVAILABLE")
            return

        workdir = Path(settings.scan_workdir) / scan.id
        workdir.mkdir(parents=True, exist_ok=True)
        try:
            _run_scan(db, scan, upload, workdir)
        finally:
            # Always clean up extracted source, success or failure.
            shutil.rmtree(workdir, ignore_errors=True)
    except Exception:
        logger.exception("scan_crashed scan_id=%s", scan_id)
        scan = db.get(Scan, scan_id)
        if scan is not None and scan.status in _ACTIVE:
            _finish(db, scan, "failed", "INTERNAL_ERROR")
    finally:
        db.close()


class Trace:
    """The live step list a scanning user watches, persisted as they poll.

    A label is reported twice - once running, once finished - and the last
    state wins, so the trace never grows a duplicate row per file.
    """

    def __init__(self, db: Session, scan: Scan) -> None:
        self.db = db
        self.scan = scan
        self.steps: list[dict] = list((scan.summary or {}).get("steps") or [])

    def __call__(self, label: str, status: str, detail: str | None = None) -> None:
        entry = {"label": label, "status": status, "detail": detail, "at": _utcnow().isoformat()}
        for index, existing in enumerate(self.steps):
            if existing.get("label") == label:
                self.steps[index] = entry
                break
        else:
            self.steps.append(entry)
        # Reassign, not mutate: SQLAlchemy cannot see inside a JSON column.
        self.scan.summary = {**(self.scan.summary or {}), "steps": self.steps[-_MAX_STEPS:]}
        self.db.commit()


def _decide(
    outcome: AgentOutcome | None, results: list, *, agent_requested: bool
) -> tuple[str, str | None]:
    """Roll up tool and agent results without presenting partial review as complete."""
    problems = [r for r in results if r.status in ("failed", "timed_out")]
    tools_worked = any(r.status == "succeeded" for r in results)

    if agent_requested:
        if outcome is not None and outcome.status == "succeeded":
            return ("completed_with_errors" if problems else "completed", None)
        if outcome is not None and outcome.status == "partial":
            return ("completed_with_errors", outcome.error_code)
        error_code = outcome.error_code if outcome is not None else "AGENT_UNAVAILABLE"
        if tools_worked:
            return ("completed_with_errors", error_code)
        return ("failed", error_code or "NO_ANALYSIS")

    # CLI checks may be run by themselves when the caller explicitly disables
    # agent review. Missing optional tools are notes; real failures remain visible.
    if tools_worked:
        return ("completed_with_errors" if problems else "completed", None)
    return ("failed", "ALL_SCANNERS_FAILED")


def _run_scan(db: Session, scan: Scan, upload: Upload, workdir: Path) -> None:
    archive_path = workdir / "archive.zip"
    with get_storage().open_read(upload.object_key) as src, archive_path.open("wb") as out:
        shutil.copyfileobj(src, out, length=1024 * 1024)

    src_dir = workdir / "src"
    try:
        extract_archive(archive_path, src_dir)
    except AppError as exc:
        upload.status = "rejected"
        db.commit()
        _finish(db, scan, "failed", exc.code)
        return
    finally:
        archive_path.unlink(missing_ok=True)

    if upload.status != "validated":
        upload.status = "validated"
        db.commit()

    project = db.get(Project, scan.project_id)
    options = scan.options or {}
    trace = Trace(db, scan)

    outcome = None
    router_outcome: RouterOutcome | None = None
    if options.get("agent_review", True):
        agent_run = ToolRun(scan_id=scan.id, tool_name=AGENT_TOOL_NAME, status="running")
        db.add(agent_run)
        db.commit()
        outcome = run_agent_review(
            db,
            scan=scan,
            src_dir=src_dir,
            user_id=scan.requested_by,
            workspace_id=project.workspace_id,
            step=trace,
        )
        # Phase 1 router: re-sort findings by severity and fan out to any
        # registered specialist agents.  In Phase 1 only "code" is registered,
        # so the effect is severity-priority ordering.  Phase 2/3 drops intel
        # and dep agents in without touching this block.
        router_outcome: RouterOutcome | None = None
        if settings.agent_router_enabled and outcome.usable and outcome.findings:
            router = AgentRouter(max_workers=settings.agent_router_max_workers)
            routed, router_outcome = router.run(outcome.findings, step=trace)
            # Replace the flat finding list with the router's merged, ordered one.
            outcome.findings = routed
            logger.info(
                "router_done scan_id=%s decisions=%s merged=%s",
                scan.id,
                router_outcome.decisions,
                router_outcome.merged_findings,
            )
        # The agent's own outcome is stored on its run so finding provenance
        # resolves to the model that reported it, not to a scanner binary.
        agent_run.status = "succeeded" if outcome.usable else outcome.status
        agent_run.error_code = outcome.error_code
        agent_run.duration_ms = outcome.duration_ms
        agent_run.tool_version = outcome.reviewer[:64] if outcome.reviewer else None
        db.commit()
        if outcome.findings:
            agent_run.finding_count = _persist_findings(db, scan, agent_run, outcome.findings)
        db.commit()
    else:
        trace("AI agent review", "skipped", "Turned off for this scan")

    results = []
    for adapter in build_adapters(options):
        db.refresh(scan)
        if scan.status == "cancelled":  # honour cancellation between tools
            break
        run = ToolRun(scan_id=scan.id, tool_name=adapter.name, status="running")
        db.add(run)
        db.commit()
        trace(adapter.name, "running")
        result = adapter.run(src_dir)
        run.status = result.status
        run.exit_code = result.exit_code
        run.duration_ms = result.duration_ms
        run.tool_version = result.tool_version
        run.error_code = result.error_code
        run.completed_at = _utcnow()
        db.commit()
        if result.status == "succeeded":
            count = _persist_findings(db, scan, run, result.findings)
            run.finding_count = count
            db.commit()
        trace(adapter.name, result.status, result.error_code)
        results.append(result)

    db.refresh(scan)
    if scan.status == "cancelled":
        return

    scan.summary = {**(scan.summary or {}), **_build_summary(db, scan, outcome, results, router_outcome)}
    db.commit()
    summary = scan.summary

    status, error_code = _decide(
        outcome, results, agent_requested=bool(options.get("agent_review", True))
    )
    _finish(db, scan, status, error_code)

    started = _aware(scan.started_at) or datetime.now(UTC)
    duration_ms = int((datetime.now(UTC) - started).total_seconds() * 1000)
    logger.info(
        "scan_finished scan_id=%s status=%s duration_ms=%s findings=%s agent=%s",
        scan.id,
        scan.status,
        duration_ms,
        summary["total_findings"],
        summary["agent"]["status"] if summary.get("agent") else "off",
    )

    record_event(
        db,
        workspace_id=project.workspace_id,
        actor_id=scan.requested_by,
        action="scan.completed",
        resource_type="scan",
        resource_id=scan.id,
        metadata={"status": scan.status, "findings": summary["total_findings"]},
    )
    emit_scan_event(db, scan, project)


def _build_summary(
    db: Session,
    scan: Scan,
    outcome: AgentOutcome | None,
    results: list,
    router_outcome: RouterOutcome | None = None,
) -> dict:
    findings = db.scalars(select(Finding).where(Finding.scan_id == scan.id)).all()
    by_severity: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for f in findings:
        by_severity[f.severity] = by_severity.get(f.severity, 0) + 1
    return {
        "total_findings": len(findings),
        "by_severity": by_severity,
        "agent": outcome.summary() if outcome else {"status": "off", "error_code": None},
        "router": router_outcome.summary() if router_outcome else None,
        "tool_runs": [
            {
                "tool": r.tool_name,
                "status": r.status,
                "duration_ms": r.duration_ms,
                "finding_count": len(r.findings),
            }
            for r in results
        ],
    }
