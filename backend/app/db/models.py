"""Database models. Schema mirrors DATA_MODEL.md."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255))
    # The handle the console shows in place of the primary key. Lowercase on
    # write so uniqueness is case-insensitive without a second column.
    username: Mapped[str | None] = mapped_column(String(30), unique=True)
    # Either the sign-in provider's own photo URL or a path to one this service
    # stores after an upload. Nothing here is fetched server-side.
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    # Set once the account closes the welcome sequence. Until then the console
    # offers it again on any device, which localStorage could not do.
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Workspace(Base, TimestampMixin):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by: Mapped[str] = mapped_column(String(36), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class WorkspaceMember(Base, TimestampMixin):
    __tablename__ = "workspace_members"
    __table_args__ = (
        CheckConstraint(
            "role IN ('owner','admin','member','viewer')", name="ck_workspace_members_role"
        ),
    )

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id"), primary_key=True, nullable=False
    )
    user_id: Mapped[str] = mapped_column(String(36), primary_key=True, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)


class Project(Base, TimestampMixin):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint("source_type IN ('zip_upload','git_import')", name="ck_projects_source_type"),
        Index("ix_projects_workspace_updated", "workspace_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="zip_upload")
    default_branch: Mapped[str | None] = mapped_column(String(255))
    created_by: Mapped[str] = mapped_column(String(36), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Upload(Base, TimestampMixin):
    __tablename__ = "uploads"
    __table_args__ = (
        CheckConstraint(
            "status IN ('quarantined','validated','rejected','deleted')", name="ck_uploads_status"
        ),
        CheckConstraint("size_bytes >= 0", name="ck_uploads_size"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    object_key: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    # Display metadata only; never used as a filesystem path.
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="quarantined")
    created_by: Mapped[str] = mapped_column(String(36), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Scan(Base, TimestampMixin):
    __tablename__ = "scans"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued','running','completed','completed_with_errors','failed','cancelled')",
            name="ck_scans_status",
        ),
        Index("ix_scans_project_created", "project_id", "created_at"),
        Index("ix_scans_status_created", "status", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    upload_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("uploads.id"))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    requested_by: Mapped[str] = mapped_column(String(36), nullable=False)
    commit_ref: Mapped[str | None] = mapped_column(String(255))
    options: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_code: Mapped[str | None] = mapped_column(String(64))
    summary: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)


class ToolRun(Base, TimestampMixin):
    __tablename__ = "tool_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued','running','succeeded','failed','timed_out','skipped')",
            name="ck_tool_runs_status",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False
    )
    tool_name: Mapped[str] = mapped_column(String(64), nullable=False)
    tool_version: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    exit_code: Mapped[int | None] = mapped_column(Integer)
    duration_ms: Mapped[int | None] = mapped_column(BigInteger)
    finding_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_code: Mapped[str | None] = mapped_column(String(64))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Finding(Base, TimestampMixin):
    __tablename__ = "findings"
    __table_args__ = (
        CheckConstraint(
            "severity IN ('critical','high','medium','low','info')", name="ck_findings_severity"
        ),
        CheckConstraint(
            "confidence IN ('high','medium','low','unknown')", name="ck_findings_confidence"
        ),
        CheckConstraint(
            "status IN ('open','accepted_risk','false_positive','fixed')", name="ck_findings_status"
        ),
        UniqueConstraint("scan_id", "fingerprint", name="uq_findings_scan_fingerprint"),
        Index("ix_findings_scan_created", "scan_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    scan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False
    )
    tool_run_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("tool_runs.id"))
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    rule_id: Mapped[str | None] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    confidence: Mapped[str] = mapped_column(String(16), nullable=False, default="unknown")
    file_path: Mapped[str | None] = mapped_column(String(1024))
    start_line: Mapped[int | None] = mapped_column(Integer)
    end_line: Mapped[int | None] = mapped_column(Integer)
    evidence: Mapped[str | None] = mapped_column(Text)
    scanner_message: Mapped[str | None] = mapped_column(Text)
    impact: Mapped[str | None] = mapped_column(Text)
    remediation: Mapped[str | None] = mapped_column(Text)
    # A validated edit proposed by the agent: the unified diff this server built
    # from the archived file, plus the reviewer's one-line reason. Nothing here
    # has been applied anywhere.
    suggestion: Mapped[dict | None] = mapped_column(JSON)
    ai_explanation: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default="open", nullable=False)
    triage_note: Mapped[str | None] = mapped_column(Text)
    triaged_by: Mapped[str | None] = mapped_column(String(36))
    triaged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WorkspaceAiSetting(Base, TimestampMixin):
    """A workspace's chosen AI model, stored as a catalog entry id.

    The raw model name is never taken from a client: the id is validated
    against the live catalog before it is stored or used.
    """

    __tablename__ = "workspace_ai_settings"

    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True, nullable=False
    )
    model_id: Mapped[str] = mapped_column(String(160), nullable=False)
    updated_by: Mapped[str | None] = mapped_column(String(36))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class AiUsageEvent(Base, TimestampMixin):
    """One row per AI explanation attempt. ``day`` is the credit bucket.

    Holds counters and identifiers only - never a prompt, snippet, or model
    output. That is what makes this table safe to read back in bulk.
    """

    __tablename__ = "ai_usage_events"
    __table_args__ = (
        CheckConstraint("status IN ('succeeded','failed')", name="ck_ai_usage_status"),
        Index("ix_ai_usage_user_day", "user_id", "day"),
        Index("ix_ai_usage_workspace_day", "workspace_id", "day"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    workspace_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("workspaces.id"))
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    finding_id: Mapped[str | None] = mapped_column(String(36))
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    model: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    # UTC calendar day as YYYY-MM-DD, kept denormalised so daily aggregation
    # works the same on SQLite and Postgres.
    day: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="succeeded")
    error_code: Mapped[str | None] = mapped_column(String(64))
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(BigInteger)


class AuditEvent(Base, TimestampMixin):
    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_workspace_created", "workspace_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(36))
    # Metadata must never hold source code, secrets, or full prompts.
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)


class IdempotencyKey(Base, TimestampMixin):
    __tablename__ = "idempotency_keys"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_idempotency_user_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    key: Mapped[str] = mapped_column(String(128), nullable=False)
    scan_id: Mapped[str] = mapped_column(String(36), nullable=False)


class IntegrationConfig(Base, TimestampMixin):
    """One Slack or Jira configuration per workspace. Mirrors DATA_MODEL.md."""

    __tablename__ = "integration_configs"
    __table_args__ = (
        CheckConstraint("provider IN ('slack','jira')", name="ck_integration_configs_provider"),
        UniqueConstraint("workspace_id", "provider", name="uq_integration_workspace_provider"),
        Index("ix_integration_workspace", "workspace_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Non-secret settings only: channel id, Jira base URL, project key.
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Fernet ciphertext plus a trailing-character hint. Neither column leaves the
    # process in an API response.
    secret_enc: Mapped[str | None] = mapped_column(Text)
    secret_hint: Mapped[str | None] = mapped_column(String(16))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class OAuthConnection(Base, TimestampMixin):
    """A workspace's consented link to an external account. Mirrors DATA_MODEL.md.

    Kept separate from ``integration_configs`` because the two facts change on
    different schedules: who consented, to what scope and when it expires belongs
    to the account, while where to send a message belongs to the configuration.
    """

    __tablename__ = "oauth_connections"
    __table_args__ = (
        CheckConstraint(
            "provider IN ('slack','jira','github')", name="ck_oauth_connection_provider"
        ),
        UniqueConstraint("workspace_id", "provider", name="uq_oauth_connection_workspace_provider"),
        Index("ix_oauth_connection_workspace", "workspace_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    # What the consent was given by - a login, a workspace name, a site host.
    # Displayed in the console so a wrong account is visible, never a secret.
    account_label: Mapped[str] = mapped_column(String(160), nullable=False)
    scope: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    # Nullable: Slack bot tokens do not expire; GitHub installation tokens do.
    access_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Both tokens are Fernet ciphertext. No response carries either.
    access_enc: Mapped[str | None] = mapped_column(Text)
    refresh_enc: Mapped[str | None] = mapped_column(Text)
    # Provider-owned, non-secret facts: Jira site URL, Slack team ID, GitHub
    # installation ID. Never a token, never a client secret.
    details: Mapped[dict] = mapped_column("details", JSON, default=dict, nullable=False)
    connected_by: Mapped[str] = mapped_column(String(36), nullable=False)
    connected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class WebhookEndpoint(Base, TimestampMixin):
    __tablename__ = "webhook_endpoints"
    __table_args__ = (Index("ix_webhook_workspace_created", "workspace_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Validated by app.core.egress before every request; never fetched raw.
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    events: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    secret_enc: Mapped[str | None] = mapped_column(Text)
    secret_hint: Mapped[str | None] = mapped_column(String(16))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[str] = mapped_column(String(36), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class IntegrationDelivery(Base, TimestampMixin):
    """Outbox row: one per (event, target), drained by the delivery worker.

    ``payload`` is a redacted snapshot taken when the event was accepted, so a
    later change to the finding cannot alter an already-queued message.
    """

    __tablename__ = "integration_deliveries"
    __table_args__ = (
        CheckConstraint(
            "channel IN ('slack','jira','webhook')", name="ck_deliveries_channel"
        ),
        CheckConstraint(
            "status IN ('pending','succeeded','failed','dead')", name="ck_deliveries_status"
        ),
        Index("ix_deliveries_status_next", "status", "next_attempt_at"),
        Index("ix_deliveries_workspace_created", "workspace_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(36))
    # Human-readable and safe to display: a channel name or target host, never a token.
    target_label: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    resource_id: Mapped[str | None] = mapped_column(String(36))
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    last_error_code: Mapped[str | None] = mapped_column(String(64))
    http_status: Mapped[int | None] = mapped_column(Integer)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
