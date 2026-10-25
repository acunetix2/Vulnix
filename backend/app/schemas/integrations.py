"""Integration request and response schemas.

Reads return a masked hint and a ``configured`` flag. The one exception is
``WebhookCreatedOut``, which carries a generated signing secret exactly once.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Severity = Literal["critical", "high", "medium", "low", "info"]
_CHANNEL_PATTERN = r"^#?[A-Za-z0-9][A-Za-z0-9_-]{0,79}$"


class IntegrationUpdate(BaseModel):
    """One shape for both providers; the route keeps only the fields it needs."""

    enabled: bool = True
    # Write-only. Omit to keep the stored secret.
    secret: str | None = Field(default=None, min_length=8, max_length=4096)
    clear_secret: bool = False

    channel: str | None = Field(default=None, max_length=80, pattern=_CHANNEL_PATTERN)
    mention_group: str = Field(default="", max_length=80)
    notify_triage: bool = False

    base_url: str | None = Field(default=None, max_length=1024)
    project_key: str | None = Field(default=None, max_length=32, pattern=r"^[A-Z][A-Z0-9_]{1,31}$")
    user_email: str | None = Field(default=None, max_length=254)
    auto_create: bool = True
    min_severity: Severity = "high"
    issue_type: str = Field(default="Task", max_length=40)
    priority: str = Field(default="", max_length=40)

    @field_validator("channel")
    @classmethod
    def _strip_channel_hash(cls, value: str | None) -> str | None:
        return value.lstrip("#") if value else value

    @field_validator("user_email")
    @classmethod
    def _looks_like_email(cls, value: str | None) -> str | None:
        if value is not None and "@" not in value:
            raise ValueError("user_email must be an email address")
        return value.lower() if value else value


class IntegrationOut(BaseModel):
    provider: str
    enabled: bool
    configured: bool
    # True when the credential behind 'configured' came from a consent window
    # rather than something somebody typed in.
    connected: bool = False
    secret_hint: str | None
    config: dict
    updated_at: datetime


class WebhookCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    url: str = Field(min_length=8, max_length=1024)
    events: list[str] = Field(min_length=1, max_length=8)
    secret: str | None = Field(default=None, min_length=8, max_length=4096)
    enabled: bool = True


class WebhookUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    url: str | None = Field(default=None, min_length=8, max_length=1024)
    events: list[str] | None = Field(default=None, min_length=1, max_length=8)
    secret: str | None = Field(default=None, min_length=8, max_length=4096)
    clear_secret: bool = False
    enabled: bool | None = None


class WebhookOut(BaseModel):
    id: str
    name: str
    url: str
    events: list[str]
    enabled: bool
    configured: bool
    secret_hint: str | None
    created_at: datetime
    updated_at: datetime


class WebhookCreatedOut(WebhookOut):
    """Create and rotate answers only.

    ``secret`` is the generated signing key, handed over once because it is the
    one secret in this product a receiver genuinely needs to see. Every other
    webhook read reports ``configured`` plus a masked hint, and there is no
    endpoint that returns this value again.
    """

    secret: str = ""


class DeliveryOut(BaseModel):
    id: str
    channel: str
    target_id: str | None
    target_label: str
    event_type: str
    resource_type: str
    resource_id: str | None
    status: str
    attempts: int
    http_status: int | None
    last_error_code: str | None
    next_attempt_at: datetime
    completed_at: datetime | None
    created_at: datetime
    payload: dict

    model_config = {"from_attributes": True}


class TestResultOut(BaseModel):
    delivery: DeliveryOut
    ok: bool = False
