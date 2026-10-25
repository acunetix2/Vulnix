"""Integration endpoints: provider configuration, webhooks, tests, delivery log.

Reads need the viewer role, every write needs admin, and no response ever
carries a secret - only ``configured`` plus a masked hint.
"""

import secrets
from urllib.parse import urlsplit

from fastapi import APIRouter, Query, status
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.api.pagination import paginate_desc
from app.core.egress import normalize_url
from app.core.errors import AppError
from app.core.security import require_role
from app.db.models import IntegrationConfig, IntegrationDelivery, WebhookEndpoint
from app.modules.audit.service import record_event
from app.modules.integrations import connections, service
from app.modules.integrations.events import WEBHOOK_EVENT_TYPES
from app.schemas.common import Page
from app.schemas.integrations import (
    DeliveryOut,
    IntegrationOut,
    IntegrationUpdate,
    TestResultOut,
    WebhookCreate,
    WebhookCreatedOut,
    WebhookOut,
    WebhookUpdate,
)

router = APIRouter(prefix="/workspaces", tags=["integrations"])

_ALLOWED_EVENTS = set(WEBHOOK_EVENT_TYPES) | {"*"}
_DELIVERY_STATUSES = ("pending", "succeeded", "failed", "dead")
_DELIVERY_CHANNELS = ("slack", "jira", "webhook")


def _host(url: str) -> str:
    return urlsplit(url).hostname or ""


def _check_provider(provider: str) -> None:
    if provider not in service.PROVIDERS:
        raise AppError("NOT_FOUND", "Resource not found.", 404)


def _integration_out(row: IntegrationConfig, connected: bool = False) -> IntegrationOut:
    return IntegrationOut(
        provider=row.provider,
        enabled=row.enabled,
        # A consented connection is just as much a credential as a stored secret.
        configured=bool(row.secret_enc) or connected,
        secret_hint=row.secret_hint,
        # Whitelisted on write, so nothing secret can be stored in here anyway.
        config=dict(row.config or {}),
        updated_at=row.updated_at,
        connected=connected,
    )


def _jira_site_url(connection, base_url: str) -> str:
    """Accept a Jira site only if this consent covers it.

    The site list came from Atlassian during the callback, so the workspace can
    choose among them but cannot name a fourth. Without that check an OAuth token
    scoped to one tenant would be pointed at another host's API.
    """
    candidates = [str(site.get("url") or "") for site in (connection.details or {}).get("sites", [])]
    wanted = normalize_url(base_url or "")
    for site in candidates:
        if site and normalize_url(site) == wanted:
            return site
    raise AppError("JIRA_SITE_NOT_GRANTED", "This connection cannot reach that Jira site.", 403)


def _new_signing_secret() -> str:
    # 256 bits of URL-safe entropy: long enough that nobody brute-forces a
    # signature, short enough to paste.
    return f"whsec_{secrets.token_urlsafe(32)}"


def _created_out(row: WebhookEndpoint, secret: str) -> WebhookCreatedOut:
    base = _webhook_out(row)
    return WebhookCreatedOut(**base.model_dump(), secret=secret)


def _webhook_out(row: WebhookEndpoint) -> WebhookOut:
    return WebhookOut(
        id=row.id,
        name=row.name,
        url=row.url,
        events=list(row.events or []),
        enabled=row.enabled,
        configured=bool(row.secret_enc),
        secret_hint=row.secret_hint,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _get_delivery(db, workspace_id: str, delivery_id: str) -> IntegrationDelivery:
    row = db.get(IntegrationDelivery, delivery_id)
    if row is None or row.workspace_id != workspace_id:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    return row


def _validate_events(values: list[str]) -> list[str]:
    cleaned = []
    for value in values:
        item = str(value).strip()
        if item not in _ALLOWED_EVENTS:
            raise AppError("UNKNOWN_EVENT_TYPE", "Unknown webhook event type.", 422)
        if item not in cleaned:
            cleaned.append(item)
    return cleaned


def _merged_config(provider: str, body: IntegrationUpdate, existing: dict, connection=None) -> dict:
    """Keep only the non-secret fields for this provider; reject incomplete setups."""
    if provider == "slack":
        channel = body.channel or existing.get("channel")
        if not channel:
            raise AppError("INTEGRATION_CONFIG_INCOMPLETE", "A Slack channel is required.", 422)
        return {
            "channel": channel,
            "mention_group": body.mention_group.strip(),
            "notify_triage": body.notify_triage,
        }

    # A consented connection reaches exactly one set of sites, and its token says
    # who the reporter is, so neither the host nor an account email is typed.
    if connection is not None:
        base_url = _jira_site_url(connection, body.base_url or str(existing.get("base_url") or ""))
    else:
        base_url = normalize_url(body.base_url or str(existing.get("base_url") or ""))
    project_key = (body.project_key or str(existing.get("project_key") or "")).upper()
    user_email = body.user_email or existing.get("user_email")
    if not project_key:
        raise AppError("INTEGRATION_CONFIG_INCOMPLETE", "A Jira project key is required.", 422)
    if not user_email and connection is None:
        raise AppError("INTEGRATION_CONFIG_INCOMPLETE", "A Jira account email is required.", 422)
    return {
        "base_url": base_url,
        "project_key": project_key[:32],
        "user_email": str(user_email or "")[:254],
        "auto_create": body.auto_create,
        "min_severity": body.min_severity,
        "issue_type": body.issue_type.strip() or "Task",
        "priority": body.priority.strip(),
    }


@router.get("/{workspace_id}/integrations", response_model=list[IntegrationOut])
def list_integrations(workspace_id: str, db: DbSession, user: CurrentUser) -> list[IntegrationOut]:
    require_role(db, workspace_id, user, "viewer")
    linked = {row.provider for row in connections.list_for(db, workspace_id)}
    return [
        _integration_out(row, connected=row.provider in linked)
        for row in service.list_configs(db, workspace_id)
    ]


@router.get("/{workspace_id}/integrations/deliveries", response_model=Page[DeliveryOut])
def list_deliveries(
    workspace_id: str,
    db: DbSession,
    user: CurrentUser,
    channel: str | None = Query(default=None, max_length=16),
    delivery_status: str | None = Query(default=None, alias="status", max_length=16),
    limit: int = Query(25, ge=1, le=100),
    cursor: str | None = None,
) -> Page[DeliveryOut]:
    require_role(db, workspace_id, user, "viewer")
    if channel is not None and channel not in _DELIVERY_CHANNELS:
        raise AppError("VALIDATION_ERROR", "Unknown delivery channel.", 422)
    if delivery_status is not None and delivery_status not in _DELIVERY_STATUSES:
        raise AppError("VALIDATION_ERROR", "Unknown delivery status.", 422)

    query = select(IntegrationDelivery).where(IntegrationDelivery.workspace_id == workspace_id)
    if channel:
        query = query.where(IntegrationDelivery.channel == channel)
    if delivery_status:
        query = query.where(IntegrationDelivery.status == delivery_status)
    items, next_cursor = paginate_desc(db, query, IntegrationDelivery, cursor, limit)
    return Page(items=[DeliveryOut.model_validate(item) for item in items], next_cursor=next_cursor)


@router.get("/{workspace_id}/integrations/{provider}", response_model=IntegrationOut)
def get_integration(
    workspace_id: str, provider: str, db: DbSession, user: CurrentUser
) -> IntegrationOut:
    _check_provider(provider)
    require_role(db, workspace_id, user, "viewer")
    row = service.get_config(db, workspace_id, provider)
    if row is None:
        raise AppError("INTEGRATION_NOT_CONFIGURED", "This integration is not configured.", 404)
    linked = connections.get(db, workspace_id, provider) is not None
    return _integration_out(row, connected=linked)


@router.put("/{workspace_id}/integrations/{provider}", response_model=IntegrationOut)
def put_integration(
    workspace_id: str,
    provider: str,
    body: IntegrationUpdate,
    db: DbSession,
    user: CurrentUser,
) -> IntegrationOut:
    _check_provider(provider)
    require_role(db, workspace_id, user, "admin")
    existing_row = service.get_config(db, workspace_id, provider)
    connection = connections.get(db, workspace_id, provider)
    # Choosing from a list the consent already authorized is not an egress action,
    # so it stays allowed while delivery is switched off. Pasting a credential is
    # an explicit intent to send, and keeps requiring the full gate.
    if body.secret or connection is None:
        service.require_ready()
    else:
        service.require_key()

    merged = _merged_config(
        provider, body, dict(existing_row.config or {}) if existing_row else {}, connection
    )
    row = service.save_config(
        db,
        workspace_id=workspace_id,
        provider=provider,
        config=merged,
        enabled=body.enabled,
        secret=body.secret,
    )
    if body.clear_secret:
        service.clear_secret(db, row)
        row = service.get_config(db, workspace_id, provider) or row

    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="integration.updated",
        resource_type="integration",
        resource_id=row.id,
        metadata={"provider": provider, "enabled": row.enabled, "secret_set": bool(row.secret_enc)},
    )
    return _integration_out(row, connected=connections.get(db, workspace_id, provider) is not None)


@router.delete("/{workspace_id}/integrations/{provider}", status_code=status.HTTP_204_NO_CONTENT)
def delete_integration(workspace_id: str, provider: str, db: DbSession, user: CurrentUser) -> None:
    _check_provider(provider)
    require_role(db, workspace_id, user, "admin")
    row = service.get_config(db, workspace_id, provider)
    if row is None:
        raise AppError("INTEGRATION_NOT_CONFIGURED", "This integration is not configured.", 404)
    service.delete_config(db, row)
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="integration.deleted",
        resource_type="integration",
        resource_id=row.id,
        metadata={"provider": provider},
    )


@router.post("/{workspace_id}/integrations/{provider}/test", response_model=TestResultOut)
def test_integration(
    workspace_id: str, provider: str, db: DbSession, user: CurrentUser
) -> TestResultOut:
    _check_provider(provider)
    require_role(db, workspace_id, user, "admin")
    service.require_ready()
    row = service.get_config(db, workspace_id, provider)
    if row is None:
        raise AppError("INTEGRATION_NOT_CONFIGURED", "Add a credential before testing.", 409)
    credential = connections.delivery_credential(db, row)
    if not credential.usable:
        raise AppError("INTEGRATION_NOT_CONFIGURED", "Add a credential before testing.", 409)

    delivery, result = service.run_test(
        db,
        workspace_id=workspace_id,
        channel=provider,
        target_id=row.id,
        label=service.target_label(provider, row.config),
        provider_name=provider,
    )
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="integration.tested",
        resource_type="integration",
        resource_id=row.id,
        metadata={"provider": provider, "ok": result.ok, "error_code": result.error_code},
    )
    return TestResultOut(delivery=DeliveryOut.model_validate(delivery), ok=result.ok)


@router.post(
    "/{workspace_id}/integrations/deliveries/{delivery_id}/redeliver", response_model=DeliveryOut
)
def redeliver(
    workspace_id: str, delivery_id: str, db: DbSession, user: CurrentUser
) -> DeliveryOut:
    require_role(db, workspace_id, user, "admin")
    service.require_ready()
    row = _get_delivery(db, workspace_id, delivery_id)
    row = service.redeliver(db, row)
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="integration.redelivered",
        resource_type="integration_delivery",
        resource_id=row.id,
        metadata={"channel": row.channel, "event_type": row.event_type},
    )
    return DeliveryOut.model_validate(row)


@router.get("/{workspace_id}/webhooks", response_model=list[WebhookOut])
def list_webhooks(workspace_id: str, db: DbSession, user: CurrentUser) -> list[WebhookOut]:
    require_role(db, workspace_id, user, "viewer")
    return [_webhook_out(row) for row in service.list_webhooks(db, workspace_id)]


@router.post(
    "/{workspace_id}/webhooks", response_model=WebhookCreatedOut, status_code=status.HTTP_201_CREATED
)
def create_webhook(
    workspace_id: str, body: WebhookCreate, db: DbSession, user: CurrentUser
) -> WebhookCreatedOut:
    require_role(db, workspace_id, user, "admin")
    service.require_ready()
    # A signing secret nobody asked for is still a secret nobody will paste.
    # Generating it here is what removes that step from the setup.
    generated = body.secret or _new_signing_secret()
    row = service.create_webhook(
        db,
        workspace_id=workspace_id,
        name=body.name.strip(),
        url=normalize_url(body.url),
        events_=_validate_events(body.events),
        secret=generated,
        enabled=body.enabled,
        created_by=user.id,
    )
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="webhook.created",
        resource_type="webhook",
        resource_id=row.id,
        metadata={"host": _host(row.url), "events": row.events, "secret_set": bool(row.secret_enc)},
    )
    return _created_out(row, generated)


@router.post(
    "/{workspace_id}/webhooks/{webhook_id}/rotate-secret", response_model=WebhookCreatedOut
)
def rotate_webhook_secret(
    workspace_id: str, webhook_id: str, db: DbSession, user: CurrentUser
) -> WebhookCreatedOut:
    """Replace the signing secret and show the new one. Exactly once.

    Rotation is the recovery path for a leaked secret, and an event delivered
    with the old key is already out of reach of the new one - the receiving side
    has to accept whichever it stored, which is why the value is handed over here
    and never again.
    """
    require_role(db, workspace_id, user, "admin")
    service.require_ready()
    current = service.get_webhook(db, workspace_id, webhook_id)
    generated = _new_signing_secret()
    row = service.update_webhook(
        db,
        row=current,
        name=current.name,
        url=current.url,
        events_=list(current.events or []),
        enabled=current.enabled,
        secret=generated,
    )
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="webhook.secret_rotated",
        resource_type="webhook",
        resource_id=row.id,
        metadata={"host": _host(row.url)},
    )
    return _created_out(row, generated)


@router.patch("/{workspace_id}/webhooks/{webhook_id}", response_model=WebhookOut)
def update_webhook(
    workspace_id: str,
    webhook_id: str,
    body: WebhookUpdate,
    db: DbSession,
    user: CurrentUser,
) -> WebhookOut:
    require_role(db, workspace_id, user, "admin")
    service.require_ready()
    row = service.get_webhook(db, workspace_id, webhook_id)
    events_ = _validate_events(body.events) if body.events is not None else list(row.events or [])
    row = service.update_webhook(
        db,
        row=row,
        name=(body.name or row.name).strip(),
        url=normalize_url(body.url or row.url),
        events_=events_,
        enabled=row.enabled if body.enabled is None else body.enabled,
        secret=body.secret,
        clear_secret=body.clear_secret,
    )
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="webhook.updated",
        resource_type="webhook",
        resource_id=row.id,
        metadata={"host": _host(row.url), "enabled": row.enabled, "events": row.events},
    )
    return _webhook_out(row)


@router.delete("/{workspace_id}/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(
    workspace_id: str, webhook_id: str, db: DbSession, user: CurrentUser
) -> None:
    require_role(db, workspace_id, user, "admin")
    row = service.get_webhook(db, workspace_id, webhook_id)
    webhook_id_value = row.id
    service.delete_webhook(db, row)
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="webhook.deleted",
        resource_type="webhook",
        resource_id=webhook_id_value,
    )


@router.post("/{workspace_id}/webhooks/{webhook_id}/test", response_model=TestResultOut)
def test_webhook(
    workspace_id: str, webhook_id: str, db: DbSession, user: CurrentUser
) -> TestResultOut:
    require_role(db, workspace_id, user, "admin")
    service.require_ready()
    row = service.get_webhook(db, workspace_id, webhook_id)
    delivery, result = service.run_test(
        db,
        workspace_id=workspace_id,
        channel="webhook",
        target_id=row.id,
        label=service.target_label("webhook", None, row.url),
        provider_name="webhook",
    )
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="webhook.tested",
        resource_type="webhook",
        resource_id=row.id,
        metadata={"host": _host(row.url), "ok": result.ok, "error_code": result.error_code},
    )
    return TestResultOut(delivery=DeliveryOut.model_validate(delivery), ok=result.ok)
