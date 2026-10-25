"""Scan and tool-run schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ScanOptions(BaseModel):
    """The agent is the scanner; the CLI tools below are optional inputs."""

    agent_review: bool = True
    static_analysis: bool = True
    secrets: bool = True
    dependencies: bool = True


class ScanCreate(BaseModel):
    upload_id: str
    options: ScanOptions = Field(default_factory=ScanOptions)


class ToolRunOut(BaseModel):
    id: str
    tool_name: str
    tool_version: str | None
    status: str
    exit_code: int | None
    duration_ms: int | None
    finding_count: int
    error_code: str | None

    model_config = {"from_attributes": True}


class ScanOut(BaseModel):
    id: str
    project_id: str
    upload_id: str | None
    status: str
    options: dict[str, Any]
    summary: dict[str, Any]
    error_code: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScanDetailOut(ScanOut):
    tool_runs: list[ToolRunOut] = []
