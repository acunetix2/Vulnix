"""Scan lifecycle endpoints."""

from datetime import UTC, datetime

from fastapi import APIRouter, Header, Query, Response, status
from sqlalchemy import case, select

from app.api.dependencies import CurrentUser, DbSession, get_scan
from app.api.pagination import paginate_desc
from app.core.config import settings
from app.core.errors import AppError
from app.core.rate_limit import check_rate_limit
from app.core.security import require_role
from app.db.models import Finding, IdempotencyKey, Project, Scan, ToolRun, Upload
from app.integrations.queue import enqueue_scan
from app.modules.audit.service import record_event
from pydantic import BaseModel, Field
from app.modules.reports.generator import (
    build_csv_report,
    build_json_report,
    build_markdown_report,
    serialize_json,
)
from app.schemas.common import Page
from app.schemas.findings import FindingOut
from app.schemas.scans import ScanCreate, ScanDetailOut, ScanOut, ToolRunOut

router = APIRouter(tags=["scans"])


@router.post("/projects/{project_id}/scans", response_model=ScanOut, status_code=status.HTTP_202_ACCEPTED)
def create_scan(
    project_id: str,
    db: DbSession,
    user: CurrentUser,
    body: ScanCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Scan:
    project = db.get(Project, project_id)
    if project is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    require_role(db, project.workspace_id, user, "member")
    if project.archived_at is not None:
        raise AppError("CONFLICT", "Project is archived.", 409)
    # Per-user scan creation quota (AGENTS.md rate limits).
    check_rate_limit(f"scan:{user.id}", settings.scan_rate_per_hour, 3600)

    # Idempotent replay: same key returns the original scan.
    if idempotency_key:
        existing = db.scalar(
            select(IdempotencyKey).where(
                IdempotencyKey.user_id == user.id, IdempotencyKey.key == idempotency_key
            )
        )
        if existing is not None:
            return db.get(Scan, existing.scan_id)

    upload = db.get(Upload, body.upload_id)
    if upload is None or upload.project_id != project_id or upload.status == "deleted":
        raise AppError("NOT_FOUND", "Upload not found for this project.", 404)

    scan = Scan(
        project_id=project_id,
        upload_id=upload.id,
        status="queued",
        requested_by=user.id,
        options=body.options.model_dump(),
        summary={},
    )
    db.add(scan)
    db.flush()
    if idempotency_key:
        db.add(IdempotencyKey(user_id=user.id, key=idempotency_key, scan_id=scan.id))
    db.commit()

    record_event(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        action="scan.created",
        resource_type="scan",
        resource_id=scan.id,
        metadata={"options": scan.options},
    )
    enqueue_scan(scan.id)
    db.refresh(scan)
    return scan


@router.get("/projects/{project_id}/scans", response_model=Page[ScanOut])
def list_scans(
    project_id: str,
    db: DbSession,
    user: CurrentUser,
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
) -> Page[ScanOut]:
    project = db.get(Project, project_id)
    if project is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    require_role(db, project.workspace_id, user, "viewer")
    query = select(Scan).where(Scan.project_id == project_id)
    items, next_cursor = paginate_desc(db, query, Scan, cursor, limit)
    return Page(items=items, next_cursor=next_cursor)


@router.get("/scans/{scan_id}", response_model=ScanDetailOut)
def get_scan_detail(scan_id: str, db: DbSession, user: CurrentUser) -> ScanDetailOut:
    scan = get_scan(db, user, scan_id)
    runs = db.scalars(select(ToolRun).where(ToolRun.scan_id == scan.id)).all()
    payload = ScanOut.model_validate(scan).model_dump()
    payload["tool_runs"] = [ToolRunOut.model_validate(r) for r in runs]
    return ScanDetailOut.model_validate(payload)


@router.post("/scans/{scan_id}/cancel", response_model=ScanOut)
def cancel_scan(scan_id: str, db: DbSession, user: CurrentUser) -> Scan:
    scan = get_scan(db, user, scan_id)
    project = db.get(Project, scan.project_id)
    require_role(db, project.workspace_id, user, "member")
    if scan.status not in ("queued", "running"):
        raise AppError("CONFLICT", "Only queued or running scans can be cancelled.", 409)
    scan.status = "cancelled"
    scan.completed_at = datetime.now(UTC)
    db.commit()
    record_event(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        action="scan.cancelled",
        resource_type="scan",
        resource_id=scan.id,
    )
    return scan


@router.get("/scans/{scan_id}/findings", response_model=Page[FindingOut])
def list_findings(
    scan_id: str,
    db: DbSession,
    user: CurrentUser,
    severity: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    category: str | None = Query(default=None),
    tool: str | None = Query(default=None),
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = None,
) -> Page[FindingOut]:
    scan = get_scan(db, user, scan_id)
    query = select(Finding).where(Finding.scan_id == scan.id)
    if tool:
        query = query.join(ToolRun, Finding.tool_run_id == ToolRun.id).where(ToolRun.tool_name == tool)
    if severity:
        if severity not in ("critical", "high", "medium", "low", "info"):
            raise AppError("VALIDATION_ERROR", "Unknown severity filter.", 422)
        query = query.where(Finding.severity == severity)
    if status_filter:
        if status_filter not in ("open", "accepted_risk", "false_positive", "fixed"):
            raise AppError("VALIDATION_ERROR", "Unknown status filter.", 422)
        query = query.where(Finding.status == status_filter)
    if category:
        query = query.where(Finding.category == category)
    items, next_cursor = paginate_desc(db, query, Finding, cursor, limit)
    return Page(items=items, next_cursor=next_cursor)


@router.get("/scans/{scan_id}/report")
def download_report(
    scan_id: str,
    db: DbSession,
    user: CurrentUser,
    format: str = Query(default="json", pattern="^(json|markdown|csv)$"),
) -> Response:
    scan = get_scan(db, user, scan_id)
    project = db.get(Project, scan.project_id)
    tool_runs = db.scalars(select(ToolRun).where(ToolRun.scan_id == scan.id)).all()
    severity_rank = case(
        (Finding.severity == "critical", 4),
        (Finding.severity == "high", 3),
        (Finding.severity == "medium", 2),
        (Finding.severity == "low", 1),
        else_=0,
    )
    findings = db.scalars(
        select(Finding).where(Finding.scan_id == scan.id).order_by(severity_rank.desc(), Finding.created_at)
    ).all()
    record_event(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        action="report.exported",
        resource_type="scan",
        resource_id=scan.id,
        metadata={"format": format},
    )
    if format == "markdown":
        content = build_markdown_report(scan, tool_runs, findings)
        return Response(
            content=content,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="vulnix-report-{scan.id}.md"'},
        )
    if format == "csv":
        content = build_csv_report(scan, tool_runs, findings)
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="vulnix-report-{scan.id}.csv"'},
        )
    content = serialize_json(build_json_report(scan, tool_runs, findings))
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="vulnix-report-{scan.id}.json"'},
    )


class ScanShareRequest(BaseModel):
    recipient: str = Field(min_length=1, max_length=255)
    role: str = "viewer"
    note: str | None = None


class ScanShareResponse(BaseModel):
    success: bool
    message: str
    recipient: str
    share_url: str


@router.post("/scans/{scan_id}/share", response_model=ScanShareResponse)
def share_scan_report(
    scan_id: str,
    body: ScanShareRequest,
    db: DbSession,
    user: CurrentUser,
) -> ScanShareResponse:
    scan = get_scan(db, user, scan_id)
    project = db.get(Project, scan.project_id)
    recipient = body.recipient.strip()
    if not recipient:
        raise AppError("VALIDATION_ERROR", "Recipient is required.", 422)

    record_event(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        action="report.shared",
        resource_type="scan",
        resource_id=scan.id,
        metadata={
            "recipient": recipient,
            "role": body.role,
            "note": body.note,
        },
    )
    return ScanShareResponse(
        success=True,
        message=f"Audit report shared with {recipient}",
        recipient=recipient,
        share_url=f"/app/audits/runs/{scan.id}",
    )
