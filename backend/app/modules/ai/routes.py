"""AI reviewer selection and usage endpoints.

A model name is never taken from a client, and never returned to one: a caller
chooses a selection token from the model list, and every response identifies a
reviewer by its alias.
"""

from fastapi import APIRouter, Query

from app.ai import catalog, service
from app.api.dependencies import CurrentUser, DbSession
from app.core.config import settings
from app.core.errors import AppError
from app.core.security import require_role
from app.db.models import WorkspaceAiSetting
from app.modules.audit.service import record_event
from app.schemas.ai import AiModelOut, AiSettingsOut, AiSettingsUpdate, AiUsageDay, AiUsageModel, AiUsageOut

router = APIRouter(prefix="/workspaces", tags=["ai"])

_MAX_DAYS = 370
_SCOPES = ("user", "workspace")


def _model_out(entry: catalog.ModelEntry) -> AiModelOut:
    return AiModelOut(id=entry.client_id, alias=entry.alias, note=entry.note)


def _settings_out(db, workspace_id: str, user_id: str) -> AiSettingsOut:
    entries = catalog.list_models()
    row = db.get(WorkspaceAiSetting, workspace_id) if workspace_id else None
    default = catalog.preferred(entries)
    selected = (catalog.resolve(row.model_id) if row else None) or default
    return AiSettingsOut(
        enabled=bool(settings.ai_enabled and entries),
        selected=selected.client_id if selected else None,
        default=default.client_id if default else None,
        models=[_model_out(entry) for entry in entries],
        daily_quota=settings.ai_daily_quota_per_user,
        used_today=service.used_today(db, user_id),
    )


@router.get("/{workspace_id}/ai/models", response_model=list[AiModelOut])
def list_models(workspace_id: str, db: DbSession, user: CurrentUser) -> list[AiModelOut]:
    require_role(db, workspace_id, user, "viewer")
    return [_model_out(entry) for entry in catalog.list_models()]


@router.get("/{workspace_id}/ai/settings", response_model=AiSettingsOut)
def get_settings(workspace_id: str, db: DbSession, user: CurrentUser) -> AiSettingsOut:
    require_role(db, workspace_id, user, "viewer")
    return _settings_out(db, workspace_id, user.id)


@router.put("/{workspace_id}/ai/settings", response_model=AiSettingsOut)
def update_settings(
    workspace_id: str, body: AiSettingsUpdate, db: DbSession, user: CurrentUser
) -> AiSettingsOut:
    require_role(db, workspace_id, user, "member")
    entry = service.set_preference(db, workspace_id, body.model_id, user.id)
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="ai.model_selected",
        resource_type="workspace",
        resource_id=workspace_id,
        # The alias only - never the vendor's model name, where it runs,
        # a credential, or prompt content.
        metadata={"reviewer": entry.alias},
    )
    return _settings_out(db, workspace_id, user.id)


@router.get("/{workspace_id}/ai/usage", response_model=AiUsageOut)
def get_usage(
    workspace_id: str,
    db: DbSession,
    user: CurrentUser,
    days: int = Query(365, ge=1, le=_MAX_DAYS),
    scope: str = Query("user", max_length=16),
) -> AiUsageOut:
    require_role(db, workspace_id, user, "viewer")
    if scope not in _SCOPES:
        raise AppError("VALIDATION_ERROR", "Unknown usage scope.", 422)
    # A workspace-wide view is an admin's; anyone with access may see their own.
    if scope == "workspace":
        require_role(db, workspace_id, user, "admin")

    since_day, until_day = service.usage_window(days)
    rows = service.daily_credits(
        db,
        user_id=None if scope == "workspace" else user.id,
        workspace_id=workspace_id,
        days=days,
    )
    model_rows = service.usage_by_model(
        db,
        user_id=None if scope == "workspace" else user.id,
        workspace_id=workspace_id,
        days=days,
    )
    days_out = [AiUsageDay(**row) for row in rows]
    return AiUsageOut(
        scope=scope,
        since_day=since_day,
        until_day=until_day,
        total_credits=sum(row.credits for row in days_out),
        days=days_out,
        models=[AiUsageModel(**row) for row in model_rows],
    )
