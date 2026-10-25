"""Integration configuration and the delivery outbox.

Events are never sent inline with the request that produced them: they are
written to ``integration_deliveries`` first, then dispatched. That keeps a slow
or dead third party from failing a scan, and gives the operator a log to read
and a dead-letter to redeliver.
"""

import logging
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.errors import AppError
from app.db.models import IntegrationConfig, IntegrationDelivery, Project, WebhookEndpoint
from app.modules.integrations import clients, connections, events

logger = logging.getLogger("vulnix.integrations")

PROVIDERS = ("slack", "jira")
# 'failed' means waiting for the next attempt, so it is still claimable.
_CLAIMABLE = ("pending", "failed")
_MAX_BACKOFF_SECONDS = 3600


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _aware(dt: datetime | None) -> datetime:
    # SQLite drops tzinfo; keep comparisons against _utcnow() honest.
    if dt is None:
        return _utcnow()
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt


def _dispatch(delivery_id: str) -> None:
    # Deferred import: the queue module reaches back into the scan pipeline,
    # which imports this module.
    from app.integrations.queue.dispatch import enqueue_integration_delivery

    enqueue_integration_delivery(delivery_id)


def _host(url: str) -> str:
    return (urlsplit(url or "").hostname or "")[:120]


def target_label(channel: str, config: dict | None, url: str = "") -> str:
    """A short, log-safe description. Never includes a secret or a full URL."""
    config = config or {}
    if channel == "slack":
        return f"#{str(config.get('channel') or '').lstrip('#')[:80]}"
    if channel == "jira":
        key = str(config.get("project_key") or "?")[:16]
        return f"{key} @ {_host(config.get('base_url', ''))}"
    return _host(url)


def require_ready() -> None:
    # Callers that would create new secrets or outbound traffic must fail loudly;
    # reading stored configuration stays allowed.
    if not settings.integrations_enabled:
        raise AppError("INTEGRATIONS_DISABLED", "Outbound integrations are disabled on this server.", 409)
    if not settings.integration_secret_key:
        raise AppError("INTEGRATION_KEY_MISSING", "Integration secrets are not configured.", 503)


def require_key() -> None:
    """Gate a flow that only stores a secret, such as an OAuth consent.

    Consent is separate from delivery: an operator must be able to link accounts
    before switching egress on, but never without the key that seals the tokens.
    """
    if not settings.integration_secret_key:
        raise AppError("INTEGRATION_KEY_MISSING", "Integration secrets are not configured.", 503)


def get_config(db: Session, workspace_id: str, provider: str) -> IntegrationConfig | None:
    return db.scalar(
        select(IntegrationConfig).where(
            IntegrationConfig.workspace_id == workspace_id, IntegrationConfig.provider == provider
        )
    )


def list_configs(db: Session, workspace_id: str) -> list[IntegrationConfig]:
    return list(
        db.scalars(
            select(IntegrationConfig).where(IntegrationConfig.workspace_id == workspace_id)
        ).all()
    )


def save_config(
    db: Session,
    *,
    workspace_id: str,
    provider: str,
    config: dict,
    enabled: bool,
    secret: str | None,
) -> IntegrationConfig:
    """Upsert a provider configuration. ``secret=None`` keeps the existing one."""
    row = get_config(db, workspace_id, provider)
    if row is None:
        row = IntegrationConfig(workspace_id=workspace_id, provider=provider)
        db.add(row)
    row.config = config
    row.enabled = enabled
    if secret:
        row.secret_enc, row.secret_hint = encrypt_secret(secret)
    row.updated_at = _utcnow()
    db.commit()
    db.refresh(row)
    return row


def clear_secret(db: Session, row: IntegrationConfig) -> None:
    row.secret_enc = None
    row.secret_hint = None
    row.enabled = False
    row.updated_at = _utcnow()
    db.commit()


def delete_config(db: Session, row: IntegrationConfig) -> None:
    db.delete(row)
    db.commit()


def list_webhooks(db: Session, workspace_id: str) -> list[WebhookEndpoint]:
    return list(
        db.scalars(
            select(WebhookEndpoint)
            .where(WebhookEndpoint.workspace_id == workspace_id)
            .order_by(WebhookEndpoint.created_at.desc())
        ).all()
    )


def get_webhook(db: Session, workspace_id: str, webhook_id: str) -> WebhookEndpoint:
    row = db.get(WebhookEndpoint, webhook_id)
    if row is None or row.workspace_id != workspace_id:
        # A webhook in another workspace must look identical to one that never existed.
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    return row


def create_webhook(
    db: Session,
    *,
    workspace_id: str,
    name: str,
    url: str,
    events_: list[str],
    secret: str | None,
    enabled: bool,
    created_by: str,
) -> WebhookEndpoint:
    require_ready()
    row = WebhookEndpoint(
        workspace_id=workspace_id,
        name=name[:120],
        url=url,
        events=list(events_),
        enabled=enabled,
        created_by=created_by,
    )
    if secret:
        row.secret_enc, row.secret_hint = encrypt_secret(secret)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_webhook(
    db: Session,
    *,
    row: WebhookEndpoint,
    name: str,
    url: str,
    events_: list[str],
    enabled: bool,
    secret: str | None,
    clear_secret: bool = False,
) -> WebhookEndpoint:
    row.name = name[:120]
    row.url = url
    row.events = list(events_)
    row.enabled = enabled
    if secret:
        row.secret_enc, row.secret_hint = encrypt_secret(secret)
    elif clear_secret:
        row.secret_enc = None
        row.secret_hint = None
    row.updated_at = _utcnow()
    db.commit()
    db.refresh(row)
    return row


def delete_webhook(db: Session, row: WebhookEndpoint) -> None:
    db.delete(row)
    db.commit()


def _subscribed(endpoint: WebhookEndpoint, event_type: str) -> bool:
    values = endpoint.events or []
    return event_type in values or "*" in values


def enqueue_event(
    db: Session,
    *,
    workspace_id: str,
    payload: dict,
    resource_type: str = "",
    resource_id: str | None = None,
) -> list[IntegrationDelivery]:
    """Fan one event out to every enabled target. Returns queued rows (may be empty)."""
    if not settings.integrations_ready:
        return []

    event_type = payload.get("event") or ""
    rows: list[IntegrationDelivery] = []
    linked = {row.provider for row in connections.list_for(db, workspace_id)}

    for config in list_configs(db, workspace_id):
        # A consented connection carries its own token, so an empty
        # ``secret_enc`` no longer means "nothing to send with".
        if not config.enabled:
            continue
        if not config.secret_enc and config.provider not in linked:
            continue
        if config.provider == "slack":
            if event_type == events.EVENT_FINDING_TRIAGED and not (config.config or {}).get("notify_triage"):
                continue
            rows.append(
                _queue(db, workspace_id, "slack", config.id, target_label("slack", config.config),
                       event_type, resource_type, resource_id, payload)
            )
        elif config.provider == "jira":
            if not _jira_should_create(config.config or {}, payload):
                continue
            rows.append(
                _queue(db, workspace_id, "jira", config.id, target_label("jira", config.config),
                       event_type, resource_type, resource_id, payload)
            )

    for endpoint in list_webhooks(db, workspace_id):
        if endpoint.enabled and _subscribed(endpoint, event_type):
            rows.append(
                _queue(db, workspace_id, "webhook", endpoint.id, target_label("webhook", None, endpoint.url),
                       event_type, resource_type, resource_id, payload)
            )

    for row in rows:
        _dispatch(row.id)
    return rows


def _jira_should_create(config: dict, payload: dict) -> bool:
    if not config.get("auto_create"):
        return False
    if payload.get("event") != events.EVENT_SCAN_COMPLETED:
        return False
    minimum = config.get("min_severity", "high")
    counts = (payload.get("scan") or {}).get("by_severity") or {}
    order = ("critical", "high", "medium", "low", "info")
    if minimum not in order:
        minimum = "high"
    return any(counts.get(sev, 0) for sev in order[: order.index(minimum) + 1])


def _queue(
    db: Session,
    workspace_id: str,
    channel: str,
    target_id: str,
    label: str,
    event_type: str,
    resource_type: str,
    resource_id: str | None,
    payload: dict,
) -> IntegrationDelivery:
    row = IntegrationDelivery(
        workspace_id=workspace_id,
        channel=channel,
        target_id=target_id,
        target_label=label[:255],
        event_type=event_type[:64],
        resource_type=resource_type[:32],
        resource_id=resource_id,
        payload=payload,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _backoff(attempts: int) -> timedelta:
    delay = settings.integration_backoff_base_seconds * (2 ** max(attempts - 1, 0))
    return timedelta(seconds=min(delay, _MAX_BACKOFF_SECONDS))


def _finalize(db: Session, row: IntegrationDelivery, result: clients.SendResult) -> str:
    row.http_status = result.http_status
    if result.ok:
        row.status = "succeeded"
        row.completed_at = _utcnow()
        row.last_error_code = None
        db.commit()
        return row.status

    exhausted = row.attempts >= settings.integration_max_attempts
    if result.retryable and not exhausted:
        row.status = "failed"
        row.next_attempt_at = _utcnow() + _backoff(row.attempts)
    else:
        # Non-retryable failures and exhausted budgets both land in the
        # dead-letter state, where the operator can fix config and redeliver.
        row.status = "dead"
        row.completed_at = _utcnow()
    row.last_error_code = (result.error_code or "DELIVERY_FAILED")[:64]
    db.commit()
    logger.warning(
        "integration_delivery_failed id=%s channel=%s code=%s", row.id, row.channel, row.last_error_code
    )
    return row.status


def _probe_jira(db: Session, config: IntegrationConfig | None) -> clients.SendResult:
    # A Jira test must not create an issue, so it checks credentials only.
    if config is None:
        return clients.SendResult(ok=False, error_code="TARGET_MISSING")
    credential = connections.delivery_credential(db, config)
    if not credential.usable:
        return clients.SendResult(ok=False, error_code="CONFIG_INCOMPLETE")
    stored = config.config or {}
    return clients.check_jira(
        str(stored.get("base_url") or ""), credential.basic_email, credential.token
    )


def run_test(
    db: Session, *, workspace_id: str, channel: str, target_id: str, label: str, provider_name: str
) -> tuple[IntegrationDelivery, clients.SendResult]:
    """Send one probe through the normal pipeline so it lands in the delivery log."""
    payload = events.test_event(workspace_id, provider_name)
    row = _queue(
        db, workspace_id, channel, target_id, label, events.EVENT_TEST, channel, target_id, payload
    )
    # A probe is one attempt already; the backoff and dead-letter maths below
    # reads attempts the same way the claim path does.
    row.attempts = 1
    db.commit()
    if channel == "jira":
        result = _probe_jira(db, db.get(IntegrationConfig, target_id))
    else:
        result = _send(db, row)
    _finalize(db, row, result)
    return row, result


def _send(db: Session, row: IntegrationDelivery) -> clients.SendResult:
    payload = row.payload or {}
    # ``enabled`` is not checked here: an operator must be able to test a target
    # before turning it on, and redeliver is an explicit action.
    if row.channel == "webhook":
        endpoint = db.get(WebhookEndpoint, row.target_id)
        if endpoint is None:
            return clients.SendResult(ok=False, error_code="TARGET_MISSING")
        return clients.send_webhook(endpoint.url, payload, decrypt_secret(endpoint.secret_enc), row.id)

    config = db.get(IntegrationConfig, row.target_id)
    if config is None:
        return clients.SendResult(ok=False, error_code="TARGET_MISSING")
    credential = connections.delivery_credential(db, config)
    if not credential.usable:
        # Either nothing was ever stored, or the consent ran out and could not be
        # renewed. Both need an operator, so the row goes to the dead-letter pile.
        return clients.SendResult(ok=False, error_code="CONFIG_INCOMPLETE")
    stored = config.config or {}

    if row.channel == "slack":
        text = events.summarize(payload)
        mention = str(stored.get("mention_group") or "")
        counts = (payload.get("scan") or {}).get("by_severity") or {}
        if mention and counts.get("critical"):
            text = f"{mention} {text}"
        return clients.send_slack(credential.token, str(stored.get("channel") or ""), text)

    summary_text = events.summarize(payload)
    scan = payload.get("scan") or {}
    return clients.create_jira_issue(
        str(stored.get("base_url") or ""),
        credential.basic_email,
        credential.token,
        str(stored.get("project_key") or ""),
        f"[Vulnix] {summary_text}"[:250],
        _jira_description(payload, scan),
        issue_type=str(stored.get("issue_type") or "Task"),
        priority=str(stored.get("priority") or "") or None,
    )


def _jira_description(payload: dict, scan: dict) -> str:
    counts = ", ".join(f"{value} {name}" for name, value in (scan.get("by_severity") or {}).items() if value)
    project = (payload.get("project") or {}).get("name") or "unknown"
    return (
        f"Project: {project}\n"
        f"Scan: {scan.get('id')}\n"
        f"Status: {scan.get('status')}\n"
        f"Findings: {scan.get('total_findings', 0)} ({counts or 'none'})\n\n"
        "Open Vulnix for the finding details. Source code and evidence are not included."
    )


def process_delivery(db: Session, delivery_id: str) -> str:
    """Attempt one queued delivery. Returns the resulting status, or '' if not claimable."""
    if not settings.integrations_ready:
        return ""
    row = db.get(IntegrationDelivery, delivery_id)
    if row is None or row.status not in _CLAIMABLE:
        return ""
    if row.status == "failed" and _aware(row.next_attempt_at) > _utcnow():
        # Backoff has not elapsed yet; only the sweep may claim it later.
        return ""

    # Claiming is an atomic attempt bump: two workers draining the same row can
    # only have one winner, and a crash mid-send still counts as an attempt.
    claimed = db.execute(
        update(IntegrationDelivery)
        .where(IntegrationDelivery.id == delivery_id, IntegrationDelivery.status.in_(_CLAIMABLE))
        .values(attempts=IntegrationDelivery.attempts + 1)
    )
    db.commit()
    if claimed.rowcount != 1:
        return ""
    db.refresh(row)

    try:
        result = _send(db, row)
    except AppError as exc:  # e.g. the Fernet key vanished mid-flight
        result = clients.SendResult(ok=False, error_code=exc.code)
    except Exception:
        logger.exception("integration_delivery_crashed id=%s", delivery_id)
        result = clients.SendResult(ok=False, error_code="INTERNAL_ERROR", retryable=True)
    return _finalize(db, row, result)


def redeliver(db: Session, row: IntegrationDelivery) -> IntegrationDelivery:
    row.status = "pending"
    row.attempts = 0
    row.last_error_code = None
    row.http_status = None
    row.completed_at = None
    row.next_attempt_at = _utcnow()
    db.commit()
    db.refresh(row)
    _dispatch(row.id)
    # Eager mode finished inline; with a broker this still reads 'pending', which
    # is the truth the client should see.
    db.refresh(row)
    return row


def deliver_due(db: Session, limit: int = 50) -> int:
    """Drain due outbox rows. Used by the periodic Celery sweep."""
    now = _utcnow()
    due = db.scalars(
        select(IntegrationDelivery)
        .where(
            IntegrationDelivery.status.in_(_CLAIMABLE),
            IntegrationDelivery.next_attempt_at <= now,
        )
        .order_by(IntegrationDelivery.next_attempt_at)
        .limit(limit)
    ).all()
    processed = 0
    for row in due:
        if process_delivery(db, row.id):
            processed += 1
    return processed


def emit_scan_event(db: Session, scan, project: Project) -> int:
    return _emit(
        db,
        workspace_id=project.workspace_id,
        payload=events.scan_event(scan, project),
        resource_type="scan",
        resource_id=scan.id,
    )


def emit_triage_event(db: Session, finding, project: Project) -> int:
    return _emit(
        db,
        workspace_id=project.workspace_id,
        payload=events.triage_event(finding, project),
        resource_type="finding",
        resource_id=finding.id,
    )


def _emit(
    db: Session, *, workspace_id: str, payload: dict, resource_type: str, resource_id: str
) -> int:
    # Deliveries are best-effort: an integration failure must never change the
    # outcome of the scan or triage that produced the event.
    try:
        return len(
            enqueue_event(
                db,
                workspace_id=workspace_id,
                payload=payload,
                resource_type=resource_type,
                resource_id=resource_id,
            )
        )
    except Exception:
        logger.exception("integration_emit_failed event=%s", payload.get("event"))
        return 0
