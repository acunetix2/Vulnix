"""Project schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

SOURCE_TYPES = ("zip_upload", "git_import")


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    source_type: str = Field(default="zip_upload")


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)


class ProjectDeleteRequest(BaseModel):
    confirm_name: str = Field(min_length=1, max_length=255)


class ProjectOut(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: str | None
    source_type: str
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None

    model_config = {"from_attributes": True}
