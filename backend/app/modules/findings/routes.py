"""Finding detail, triage, and AI explanation endpoints."""

from datetime import UTC, datetime

from fastapi import APIRouter

from app.ai.service import explain_finding
from app.api.dependencies import CurrentUser, DbSession
from app.core.errors import AppError
from app.core.security import require_role
from app.db.models import Finding, Project, Scan
from app.modules.audit.service import record_event
from app.modules.integrations.service import emit_triage_event
from app.schemas.findings import (
    AIExplanationOut,
    FindingOut,
    FindingTriageUpdate,
    public_explanation,
)

router = APIRouter(prefix="/findings", tags=["findings"])


def _authorized_finding(db, user, finding_id: str) -> tuple[Finding, Project]:
    finding = db.get(Finding, finding_id)
    if finding is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    scan = db.get(Scan, finding.scan_id)
    project = db.get(Project, scan.project_id) if scan else None
    if project is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    require_role(db, project.workspace_id, user, "viewer")
    return finding, project


@router.get("/{finding_id}", response_model=FindingOut)
def get_finding(finding_id: str, db: DbSession, user: CurrentUser) -> Finding:
    finding, _ = _authorized_finding(db, user, finding_id)
    return finding


@router.patch("/{finding_id}", response_model=FindingOut)
def triage_finding(
    finding_id: str, db: DbSession, user: CurrentUser, body: FindingTriageUpdate
) -> Finding:
    if body.status not in ("open", "accepted_risk", "false_positive", "fixed"):
        raise AppError("VALIDATION_ERROR", "Unknown finding status.", 422)
    finding, project = _authorized_finding(db, user, finding_id)
    require_role(db, project.workspace_id, user, "member")
    finding.status = body.status
    finding.triage_note = body.triage_note
    finding.triaged_by = user.id
    finding.triaged_at = datetime.now(UTC)
    db.commit()
    record_event(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        action="finding.triaged",
        resource_type="finding",
        resource_id=finding.id,
        metadata={"status": finding.status},
    )
    emit_triage_event(db, finding, project)
    return finding


@router.post("/{finding_id}/explanation", response_model=AIExplanationOut)
def create_explanation(finding_id: str, db: DbSession, user: CurrentUser) -> AIExplanationOut:
    finding, project = _authorized_finding(db, user, finding_id)
    require_role(db, project.workspace_id, user, "member")
    explanation = explain_finding(db, finding, user.id, workspace_id=project.workspace_id)
    # A replayed answer spent no credit and changed nothing, so it is not an
    # event worth putting in the audit trail.
    if not explanation.cached:
        record_event(
            db,
            workspace_id=project.workspace_id,
            actor_id=user.id,
            action="finding.explained",
            resource_type="finding",
            resource_id=finding.id,
        )
    stored = public_explanation(finding.ai_explanation) or {}
    return AIExplanationOut(
        finding_id=finding.id,
        # The reviewer's alias and whether it was a failover - both come from the
        # same projection the finding list uses, so the two can never disagree.
        reviewer=stored.get("reviewer"),
        fallback=bool(stored.get("fallback")),
        generated_at=stored.get("generated_at"),
        summary=explanation.summary,
        impact=explanation.impact or explanation.why_it_matters,
        remediation_steps=explanation.remediation,
        verification_steps=explanation.verification_steps,
        confidence=explanation.confidence,
        limitations=explanation.limitations,
        evidence_refs=explanation.evidence_refs,
    )
