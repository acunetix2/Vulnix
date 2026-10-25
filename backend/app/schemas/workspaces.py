"""Workspace schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ROLE_VALUES = ("owner", "admin", "member", "viewer")


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class WorkspaceUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class WorkspaceOut(BaseModel):
    id: str
    name: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    """One person's access to one workspace, labelled so the console never has
    to print a primary key."""

    user_id: str
    username: str | None
    display_name: str | None
    email: str
    role: str
    # What to render. Username first, because it is the handle others type.
    label: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class MemberRoleUpdate(BaseModel):
    # Owner is assignable, but only by an existing owner; enforced by the route.
    role: Literal["owner", "admin", "member", "viewer"]


class MemberCreate(BaseModel):
    """Grant access to an account that already exists.

    Can be specified by email, username, or general identifier.
    """

    email: str | None = None
    username: str | None = None
    identifier: str | None = None
    role: Literal["admin", "member", "viewer"] = "member"


class WorkspaceDeleteRequest(BaseModel):
    """Deleting a workspace means retyping its name - the only confirmation the
    console can offer for an irreversible action."""

    confirm_name: str = Field(min_length=1, max_length=255)


class AuditEventOut(BaseModel):
    id: str
    action: str
    resource_type: str
    resource_id: str | None
    actor_id: str | None
    # Resolved from the users table: username, display name, or a neutral
    # placeholder. The identifier itself stays out of what the console renders.
    actor_label: str | None = None
    resource_label: str | None = None
    # ORM attribute is metadata_; "metadata" is reserved by SQLAlchemy.
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_")
    created_at: datetime

    model_config = {"from_attributes": True}
