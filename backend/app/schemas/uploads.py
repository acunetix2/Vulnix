"""Upload schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class GitHubImport(BaseModel):
    """Fetch one of the repositories this workspace already selected.

    ``repo_id`` is the only way to name a source: there is no URL in this body, so
    the request can point at nothing the consent and the selection did not allow.
    ``ref`` is optional because the stored repository already carries its default
    branch, and is shape-checked server-side before it is put in a URL.
    """

    repo_id: int
    ref: str = Field(default="", max_length=120)


class UploadOut(BaseModel):
    id: str
    project_id: str
    status: str
    original_filename: str
    size_bytes: int
    sha256: str
    created_at: datetime
    expires_at: datetime | None

    model_config = {"from_attributes": True}
