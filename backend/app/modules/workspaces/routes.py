"""Workspace endpoints: the workspace itself, its members, and its audit trail."""

import logging
import re
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Query, status
from sqlalchemy import delete, func, select

from app.api.dependencies import CurrentUser, DbSession
from app.api.pagination import paginate_desc
from app.core.errors import AppError
from app.core.security import ROLE_ORDER, require_role, upsert_user
from app.db.models import (
    AiUsageEvent,
    AuditEvent,
    Finding,
    IdempotencyKey,
    IntegrationConfig,
    IntegrationDelivery,
    OAuthConnection,
    Project,
    Scan,
    ToolRun,
    Upload,
    User,
    WebhookEndpoint,
    Workspace,
    WorkspaceAiSetting,
    WorkspaceMember,
    _now,
)
from app.integrations.storage import get_storage
from app.modules.audit.service import record_event
from app.schemas.common import Page
from app.schemas.workspaces import (
    AuditEventOut,
    MemberCreate,
    MemberOut,
    MemberRoleUpdate,
    WorkspaceCreate,
    WorkspaceDeleteRequest,
    WorkspaceOut,
    WorkspaceUpdate,
)

logger = logging.getLogger("vulnix.workspaces")

router = APIRouter(prefix="/workspaces", tags=["workspaces"])

# Rendered instead of an identifier when the account has claimed neither a
# handle nor a name - truthful, and never a UUID.
UNCLAIMED = "Unclaimed account"


def member_label(row: User | None) -> str:
    """What the console prints for a person: handle, then name, then neither."""
    if row is None:
        return "Removed account"
    return row.username or row.display_name or UNCLAIMED


def _member_out(member: WorkspaceMember, account: User | None) -> MemberOut:
    return MemberOut(
        user_id=member.user_id,
        username=account.username if account else None,
        display_name=account.display_name if account else None,
        email=account.email if account else "",
        role=member.role,
        label=member_label(account),
        joined_at=member.created_at,
    )


def _member_rows(db, workspace_id: str):
    return db.execute(
        select(WorkspaceMember, User)
        .outerjoin(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace_id)
    ).all()


def _owner_count(db, workspace_id: str) -> int:
    return db.execute(
        select(func.count())
        .select_from(WorkspaceMember)
        .where(WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.role == "owner")
    ).scalar_one()


def _check_grant(actor_role: str, wanted: str) -> None:
    """Nobody hands out a role at or above their own; only an owner creates an owner."""
    if ROLE_ORDER[wanted] >= ROLE_ORDER[actor_role] and actor_role != "owner":
        raise AppError("FORBIDDEN", "Only an owner can grant that role.", 403)


@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(db: DbSession, user: CurrentUser) -> list[Workspace]:
    return db.scalars(
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user.id)
        .order_by(Workspace.created_at.desc())
    ).all()


@router.post("", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
def create_workspace(db: DbSession, user: CurrentUser, body: WorkspaceCreate) -> Workspace:
    # The roster labels people from the users table, so the owner has to have a
    # row here the moment they own something - not only after /auth/me is read.
    upsert_user(db, user)
    workspace = Workspace(name=body.name.strip(), created_by=user.id)
    db.add(workspace)
    db.flush()
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="owner"))
    db.commit()
    record_event(
        db,
        workspace_id=workspace.id,
        actor_id=user.id,
        action="workspace.created",
        resource_type="workspace",
        resource_id=workspace.id,
        metadata={"name": workspace.name},
    )
    return workspace


@router.get("/{workspace_id}", response_model=WorkspaceOut)
def get_workspace(workspace_id: str, db: DbSession, user: CurrentUser) -> Workspace:
    require_role(db, workspace_id, user, "viewer")
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    return workspace


@router.patch("/{workspace_id}", response_model=WorkspaceOut)
def update_workspace(
    workspace_id: str, db: DbSession, user: CurrentUser, body: WorkspaceUpdate
) -> Workspace:
    require_role(db, workspace_id, user, "admin")
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    workspace.name = body.name.strip()
    workspace.updated_at = _now()
    db.commit()
    record_event(
        db,
        workspace_id=workspace.id,
        actor_id=user.id,
        action="workspace.updated",
        resource_type="workspace",
        resource_id=workspace.id,
    )
    return workspace


@router.get("/{workspace_id}/members", response_model=list[MemberOut])
def list_members(workspace_id: str, db: DbSession, user: CurrentUser) -> list[MemberOut]:
    """Everyone with access, strongest role first. Viewers may read the roster."""
    require_role(db, workspace_id, user, "viewer")
    rows = _member_rows(db, workspace_id)
    return sorted(
        [_member_out(member, account) for member, account in rows],
        key=lambda m: (-ROLE_ORDER.get(m.role, -1), m.label.lower()),
    )


@router.post("/{workspace_id}/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def add_member(
    workspace_id: str, body: MemberCreate, db: DbSession, user: CurrentUser
) -> MemberOut:
    """Give an existing account a role here.

    There is no invitation to wait on: the console can only name people who have
    already signed in, so an unknown email is an error rather than a pending row.
    """
    actor = require_role(db, workspace_id, user, "admin")
    raw = (body.identifier or body.username or body.email or "").strip()
    if not raw:
        raise AppError("VALIDATION_ERROR", "Username or email is required.", 422)
    clean = raw.lstrip("@").lower()
    account = db.scalar(
        select(User).where(
            (func.lower(User.email) == clean) | (func.lower(User.username) == clean)
        )
    )
    if account is None:
        raise AppError(
            "ACCOUNT_UNKNOWN",
            f"No account matching '{raw}' has signed in to Vulnix yet.",
            404,
        )
    if db.get(WorkspaceMember, (workspace_id, account.id)) is not None:
        raise AppError("ALREADY_MEMBER", f"{member_label(account)} is already a member.", 409)
    _check_grant(actor.role, body.role)
    member = WorkspaceMember(workspace_id=workspace_id, user_id=account.id, role=body.role)
    db.add(member)
    db.commit()
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="workspace.member_added",
        resource_type="workspace_member",
        resource_id=account.id,
        metadata={"role": body.role},
    )
    return _member_out(member, account)


@router.patch("/{workspace_id}/members/{member_user_id}", response_model=MemberOut)
def update_member_role(
    workspace_id: str,
    member_user_id: str,
    body: MemberRoleUpdate,
    db: DbSession,
    user: CurrentUser,
) -> MemberOut:
    """Change one person's role. Changing your own is how an owner hands the
    workspace over; changing anyone else's is only allowed from above."""
    actor = require_role(db, workspace_id, user, "admin")
    target = db.get(WorkspaceMember, (workspace_id, member_user_id))
    if target is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    # Acting on yourself is never "acting on a peer": it is the only way an
    # owner can step down and the reason the last-owner guard below has any
    # reach at all.
    if member_user_id != user.id and ROLE_ORDER.get(target.role, -1) >= ROLE_ORDER[actor.role]:
        raise AppError(
            "FORBIDDEN", "You cannot change the role of someone at or above your own.", 403
        )
    if ROLE_ORDER[body.role] > ROLE_ORDER[actor.role]:
        raise AppError("FORBIDDEN", "You cannot grant a role above your own.", 403)
    if target.role == "owner" and body.role != "owner" and _owner_count(db, workspace_id) <= 1:
        raise AppError(
            "LAST_OWNER", "This is the only owner left; promote someone else first.", 409
        )
    target.role = body.role
    db.commit()
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="workspace.member_role_changed",
        resource_type="workspace_member",
        resource_id=member_user_id,
        metadata={"role": body.role},
    )
    account = db.get(User, member_user_id)
    return _member_out(target, account)


@router.delete("/{workspace_id}/members/{member_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    workspace_id: str, member_user_id: str, db: DbSession, user: CurrentUser
) -> None:
    """Revoke one person's access. Their own account and history stay intact.

    Anyone may leave, so removing yourself only needs membership; removing
    somebody else is an act of administration. The last owner may do neither,
    because the workspace would be left unowned.
    """
    leaving = member_user_id == user.id
    actor = require_role(db, workspace_id, user, "viewer" if leaving else "admin")
    target = db.get(WorkspaceMember, (workspace_id, member_user_id))
    if target is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    if not leaving and ROLE_ORDER.get(target.role, -1) >= ROLE_ORDER[actor.role]:
        raise AppError("FORBIDDEN", "You cannot remove someone at or above your own role.", 403)
    if target.role == "owner" and _owner_count(db, workspace_id) <= 1:
        raise AppError("LAST_OWNER", "A workspace cannot be left without an owner.", 409)
    db.delete(target)
    db.commit()
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="workspace.member_removed",
        resource_type="workspace_member",
        resource_id=member_user_id,
    )


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(
    workspace_id: str, body: WorkspaceDeleteRequest, db: DbSession, user: CurrentUser
) -> None:
    """Delete a workspace and everything derived from it. Irreversible.

    Every scan, finding, stored archive, integration and audit row that belongs
    to the workspace goes with it, so the confirmation has to be the name itself
    rather than a checkbox.
    """
    require_role(db, workspace_id, user, "owner")
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    if body.confirm_name.strip() != workspace.name:
        raise AppError(
            "CONFIRMATION_MISMATCH",
            "Type the workspace name exactly as it appears to confirm the deletion.",
            422,
        )
    project_ids = select(Project.id).where(Project.workspace_id == workspace_id)
    scan_ids = select(Scan.id).where(Scan.project_id.in_(project_ids))
    if db.execute(
        select(Scan.id).where(Scan.project_id.in_(project_ids), Scan.status.in_(("queued", "running")))
    ).first():
        raise AppError(
            "WORKSPACE_BUSY", "A scan is still running here. Cancel it before deleting.", 409
        )

    # Stored archives are collected before the rows that name them are removed.
    object_keys = db.scalars(select(Upload.object_key).where(Upload.project_id.in_(project_ids))).all()

    for statement in (
        delete(Finding).where(Finding.scan_id.in_(scan_ids)),
        delete(ToolRun).where(ToolRun.scan_id.in_(scan_ids)),
        delete(IdempotencyKey).where(IdempotencyKey.scan_id.in_(scan_ids)),
        delete(Scan).where(Scan.project_id.in_(project_ids)),
        delete(Upload).where(Upload.project_id.in_(project_ids)),
        delete(Project).where(Project.workspace_id == workspace_id),
        delete(IntegrationDelivery).where(IntegrationDelivery.workspace_id == workspace_id),
        delete(WebhookEndpoint).where(WebhookEndpoint.workspace_id == workspace_id),
        delete(OAuthConnection).where(OAuthConnection.workspace_id == workspace_id),
        delete(IntegrationConfig).where(IntegrationConfig.workspace_id == workspace_id),
        delete(AiUsageEvent).where(AiUsageEvent.workspace_id == workspace_id),
        delete(WorkspaceAiSetting).where(WorkspaceAiSetting.workspace_id == workspace_id),
        delete(AuditEvent).where(AuditEvent.workspace_id == workspace_id),
        delete(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id),
    ):
        db.execute(statement)
    db.delete(workspace)
    db.commit()

    # Objects are removed after the rows, so a failed delete cannot orphan a
    # reference the console still shows.
    storage = get_storage()
    for key in object_keys:
        try:
            storage.delete(key)
        except OSError:
            logger.warning("workspace_object_delete_failed")
    logger.info("workspace_deleted")


ACTION_GROUP = re.compile(r"[a-z_]{1,32}")


@router.get("/{workspace_id}/audit-events", response_model=Page[AuditEventOut])
def list_audit_events(
    workspace_id: str,
    db: DbSession,
    user: CurrentUser,
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = None,
    action: str | None = Query(None, description="Only this group of actions, e.g. 'workspace'."),
    from_at: Annotated[
        datetime | None, Query(description="Include events at or after this timestamp.")
    ] = None,
    to_at: Annotated[
        datetime | None, Query(description="Include events at or before this timestamp.")
    ] = None,
) -> Page[AuditEventOut]:
    require_role(db, workspace_id, user, "admin")
    if from_at and from_at.tzinfo is None:
        from_at = from_at.replace(tzinfo=UTC)
    if to_at and to_at.tzinfo is None:
        to_at = to_at.replace(tzinfo=UTC)
    if from_at and to_at and from_at > to_at:
        raise AppError("AUDIT_DATE_RANGE_INVALID", "The start time must be before the end time.", 422)
    query = select(AuditEvent).where(AuditEvent.workspace_id == workspace_id)
    if action:
        # The value becomes a LIKE prefix, so it is held to the shape of a group
        # name this service writes. Nothing user-shaped can reach the pattern.
        if not ACTION_GROUP.fullmatch(action):
            raise AppError(
                "AUDIT_FILTER_INVALID", "An action group is lower-case letters and underscore.", 422
            )
        query = query.where(AuditEvent.action.like(f"{action}.%"))
    if from_at:
        query = query.where(AuditEvent.created_at >= from_at)
    if to_at:
        query = query.where(AuditEvent.created_at <= to_at)
    items, next_cursor = paginate_desc(db, query, AuditEvent, cursor, limit)
    labels = _actor_labels(db, items)
    resources = _resource_labels(db, items)
    return Page(
        items=[
            AuditEventOut.model_validate(event).model_copy(
                update={
                    "actor_label": labels.get(event.actor_id),
                    "resource_label": resources.get(event.resource_id),
                }
            )
            for event in items
        ],
        next_cursor=next_cursor,
    )


def _actor_labels(db, events: list[AuditEvent]) -> dict[str, str]:
    """Resolve every actor in this page with one query, not one per row."""
    actor_ids = {event.actor_id for event in events if event.actor_id}
    if not actor_ids:
        return {}
    rows = db.execute(select(User.id, User.username, User.display_name).where(User.id.in_(actor_ids)))
    labels: dict[str, str] = {}
    for row_id, username, display_name in rows:
        labels[row_id] = username or display_name or UNCLAIMED
    return labels


def _resource_labels(db, events: list[AuditEvent]) -> dict[str, str]:
    """Resolve readable resource names without exposing resource identifiers."""
    labels: dict[str, str] = {}
    project_ids = {
        event.resource_id
        for event in events
        if event.resource_id and event.resource_type == "project"
    }
    scan_ids = {
        event.resource_id for event in events if event.resource_id and event.resource_type == "scan"
    }
    workspace_ids = {
        event.resource_id
        for event in events
        if event.resource_id and event.resource_type == "workspace"
    }
    member_ids = {
        event.resource_id
        for event in events
        if event.resource_id and event.resource_type == "workspace_member"
    }
    if project_ids:
        labels.update(
            db.execute(select(Project.id, Project.name).where(Project.id.in_(project_ids))).all()
        )
    if scan_ids:
        rows = db.execute(
            select(Scan.id, Project.name)
            .join(Project, Project.id == Scan.project_id)
            .where(Scan.id.in_(scan_ids))
        ).all()
        labels.update({scan_id: f"{name} audit" for scan_id, name in rows})
    if workspace_ids:
        labels.update(
            db.execute(select(Workspace.id, Workspace.name).where(Workspace.id.in_(workspace_ids))).all()
        )
    if member_ids:
        rows = db.execute(
            select(User.id, User.username, User.display_name).where(User.id.in_(member_ids))
        ).all()
        labels.update(
            {
                user_id: f"@{username}" if username else display_name or "Workspace member"
                for user_id, username, display_name in rows
            }
        )
    for event in events:
        if (
            event.resource_type == "project"
            and event.resource_id
            and event.resource_id not in labels
            and isinstance(event.metadata_, dict)
            and event.metadata_.get("name")
        ):
            labels[event.resource_id] = str(event.metadata_["name"])
    return labels
