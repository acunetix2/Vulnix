"""Project endpoints."""

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import delete, select, union

from app.api.dependencies import CurrentUser, DbSession, get_project
from app.api.pagination import paginate_desc
from app.core.errors import AppError
from app.core.security import require_role
from app.db.models import (
    AiUsageEvent,
    AuditEvent,
    Finding,
    IdempotencyKey,
    IntegrationDelivery,
    Project,
    Scan,
    ToolRun,
    Upload,
)
from app.integrations.storage import get_storage
from app.modules.audit.service import record_event
from app.schemas.common import Page
from app.schemas.projects import ProjectCreate, ProjectDeleteRequest, ProjectOut, ProjectUpdate

router = APIRouter(tags=["projects"])


@router.get("/workspaces/{workspace_id}/projects", response_model=Page[ProjectOut])
def list_projects(
    workspace_id: str,
    db: DbSession,
    user: CurrentUser,
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
) -> Page[ProjectOut]:
    require_role(db, workspace_id, user, "viewer")
    query = select(Project).where(Project.workspace_id == workspace_id, Project.archived_at.is_(None))
    items, next_cursor = paginate_desc(db, query, Project, cursor, limit)
    return Page(items=items, next_cursor=next_cursor)


@router.post(
    "/workspaces/{workspace_id}/projects",
    response_model=ProjectOut,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    workspace_id: str, db: DbSession, user: CurrentUser, body: ProjectCreate
) -> Project:
    require_role(db, workspace_id, user, "member")
    if body.source_type not in ("zip_upload", "git_import"):
        raise AppError("VALIDATION_ERROR", "Unsupported source_type.", 422)
    project = Project(
        workspace_id=workspace_id,
        name=body.name.strip(),
        description=body.description,
        source_type=body.source_type,
        created_by=user.id,
    )
    db.add(project)
    db.commit()
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="project.created",
        resource_type="project",
        resource_id=project.id,
        metadata={"name": project.name},
    )
    return project


@router.get("/projects/{project_id}", response_model=ProjectOut)
def read_project(project_id: str, db: DbSession, user: CurrentUser) -> Project:
    return get_project(db, user, project_id)


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str, db: DbSession, user: CurrentUser, body: ProjectUpdate
) -> Project:
    project = get_project(db, user, project_id)
    require_role(db, project.workspace_id, user, "member")
    if body.name is not None:
        project.name = body.name.strip()
    if body.description is not None:
        project.description = body.description
    db.commit()
    record_event(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        action="project.updated",
        resource_type="project",
        resource_id=project.id,
    )
    return project


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    body: ProjectDeleteRequest,
    db: DbSession,
    user: CurrentUser,
) -> Response:
    project = get_project(db, user, project_id)
    require_role(db, project.workspace_id, user, "member")
    if body.confirm_name.strip() != project.name:
        raise AppError(
            "CONFIRMATION_MISMATCH",
            "Type the project name exactly as it appears to confirm deletion.",
            422,
        )

    scan_ids = select(Scan.id).where(Scan.project_id == project_id)
    active_scan = db.scalar(
        select(Scan.id).where(
            Scan.project_id == project_id,
            Scan.status.in_(("queued", "running")),
        )
    )
    if active_scan:
        raise AppError(
            "PROJECT_BUSY",
            "An audit is still running for this project. Cancel it before deleting.",
            409,
        )

    object_keys = db.scalars(select(Upload.object_key).where(Upload.project_id == project_id)).all()
    storage = get_storage()
    for key in object_keys:
        storage.delete(key)

    finding_ids = select(Finding.id).where(Finding.scan_id.in_(scan_ids))
    db.execute(
        delete(IntegrationDelivery).where(
            IntegrationDelivery.resource_id.in_(
                union(
                    select(Project.id).where(Project.id == project_id),
                    select(Scan.id).where(Scan.project_id == project_id),
                    select(Finding.id).where(Finding.scan_id.in_(scan_ids)),
                )
            )
        )
    )
    db.add(
        AuditEvent(
            workspace_id=project.workspace_id,
            actor_id=user.id,
            action="project.deleted",
            resource_type="project",
            resource_id=project.id,
            metadata_={"name": project.name},
        )
    )
    for statement in (
        delete(AiUsageEvent).where(AiUsageEvent.finding_id.in_(finding_ids)),
        delete(Finding).where(Finding.scan_id.in_(scan_ids)),
        delete(ToolRun).where(ToolRun.scan_id.in_(scan_ids)),
        delete(IdempotencyKey).where(IdempotencyKey.scan_id.in_(scan_ids)),
        delete(Scan).where(Scan.project_id == project_id),
        delete(Upload).where(Upload.project_id == project_id),
        delete(Project).where(Project.id == project_id),
    ):
        db.execute(statement)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
