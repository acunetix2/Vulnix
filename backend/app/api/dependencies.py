"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import AuthUser, get_current_user, require_role
from app.db.models import Project, Scan
from app.db.session import get_db

DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[AuthUser, Depends(get_current_user)]


def get_project(db: Session, user: AuthUser, project_id: str) -> Project:
    """Load a project only if the user is a member of its workspace."""
    project = db.get(Project, project_id)
    if project is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    require_role(db, project.workspace_id, user, "viewer")
    return project


def get_scan(db: Session, user: AuthUser, scan_id: str) -> Scan:
    """Load a scan only if the user may access its project's workspace."""
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    project = db.get(Project, scan.project_id)
    if project is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    require_role(db, project.workspace_id, user, "viewer")
    return scan


def request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "")
