"""Upload endpoints: quarantined ZIP intake with strict limits.

Both ways a project gets an archive - a browser upload and a fetch of a selected
GitHub repository - run through ``_intake``, so the size cap, the magic-number
check and the quarantine row cannot differ between them.
"""

import re
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, File, Request, UploadFile, status
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DbSession
from app.core.config import settings
from app.core.errors import AppError
from app.core.rate_limit import check_rate_limit
from app.core.security import require_role
from app.db.models import Project, Scan, Upload
from app.integrations.storage import get_storage
from app.modules.audit.service import record_event
from app.modules.integrations import connections, oauth
from app.schemas.uploads import GitHubImport, UploadOut

router = APIRouter(tags=["uploads"])

_ZIP_MAGIC = (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")
_DISPLAY_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def _display_name(raw: str) -> str:
    # Metadata only; never used as a path.
    base = _DISPLAY_NAME.sub("_", (raw or "archive.zip").split("/")[-1].split("\\")[-1])
    return (base or "archive.zip")[:255]


def _load_project(db, project_id: str, user, minimum: str) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    require_role(db, project.workspace_id, user, minimum)
    if project.archived_at is not None:
        raise AppError("CONFLICT", "Project is archived.", 409)
    return project


def _intake(db, project: Project, user, stream, filename: str, source: str) -> Upload:
    """Store a streamed archive under the size cap and record it as quarantined.

    The caller owns the stream; this function owns the object key, so every
    failure path here deletes what it wrote rather than leaving an orphan.
    """
    storage = get_storage()
    key = storage.new_key(project.id)
    try:
        size, digest = storage.put_stream(stream, key, settings.upload_max_bytes)
        if size < 4 or not _read_head(storage, key).startswith(_ZIP_MAGIC):
            raise AppError("UNSUPPORTED_FORMAT", "Uploaded file is not a ZIP archive.", 415)
    except AppError:
        storage.delete(key)
        raise

    upload = Upload(
        project_id=project.id,
        object_key=key,
        original_filename=filename,
        size_bytes=size,
        sha256=digest,
        status="quarantined",
        created_by=user.id,
        expires_at=datetime.now(UTC) + timedelta(days=settings.upload_retention_days),
    )
    db.add(upload)
    db.commit()
    record_event(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        action="upload.created",
        resource_type="upload",
        resource_id=upload.id,
        metadata={"size_bytes": size, "source": source},
    )
    return upload


@router.post(
    "/projects/{project_id}/uploads",
    response_model=UploadOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_upload(
    project_id: str,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    file: Annotated[UploadFile, File(...)],
) -> Upload:
    project = _load_project(db, project_id, user, "member")
    # Per-user upload quota (AGENTS.md rate limits).
    check_rate_limit(f"upload:{user.id}", settings.upload_rate_per_hour, 3600)

    # Cheap pre-check before buffering the body.
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > settings.upload_max_bytes + 1024 * 1024:
        raise AppError("UPLOAD_TOO_LARGE", "Upload exceeds the allowed size.", 413)

    filename = _display_name(file.filename or "archive.zip")
    try:
        return _intake(db, project, user, file.file, filename, "upload")
    finally:
        await file.close()


def _read_head(storage, key: str, length: int = 8) -> bytes:
    with storage.open_read(key) as fh:
        return fh.read(length)


def _import_target(repo: dict, requested_ref: str) -> tuple[str, str]:
    """Pick the name and ref to fetch, and reject bad shapes before any network.

    The stored entry decides the ref when the caller named none, so a repository
    is imported from its own default branch without a client having to know it.
    """
    full_name = str(repo.get("full_name") or "")
    ref = (requested_ref or str(repo.get("default_branch") or "") or "HEAD").strip()
    # Checked here rather than left to the transport: a name we would refuse has
    # no reason to open a connection on the way to being refused.
    oauth.archive_target(full_name, ref)
    return full_name, ref


@router.post(
    "/projects/{project_id}/uploads/github",
    response_model=UploadOut,
    status_code=status.HTTP_201_CREATED,
)
def create_github_upload(
    project_id: str,
    body: GitHubImport,
    db: DbSession,
    user: CurrentUser,
) -> Upload:
    """Pull a selected repository's archive into quarantine.

    No cloning and no execution: GitHub's own zipball arrives as a stream and is
    written straight to storage under the same cap as a browser upload. A scan is
    then created from the resulting ``upload_id`` exactly as it is for an upload.
    """
    project = _load_project(db, project_id, user, "member")
    check_rate_limit(f"upload:{user.id}", settings.upload_rate_per_hour, 3600)

    connection = connections.get(db, project.workspace_id, "github")
    if connection is None:
        raise AppError(
            "OAUTH_NOT_CONNECTED", "Connect GitHub to this workspace before importing.", 409
        )
    token = connections.access_token(db, connection)
    repo = oauth.github_repository_by_id(token, body.repo_id)
    full_name, ref = _import_target(repo, body.ref)
    filename = _display_name(f"{full_name}@{ref}.zip")

    with oauth.stream_repo_archive(token, full_name, ref) as stream:
        upload = _intake(db, project, user, stream, filename, "github")

    # A project created for uploads that is now fed from GitHub should say so;
    # the console labels its source from this column.
    if project.source_type != "git_import":
        project.source_type = "git_import"
        db.commit()
    return upload



@router.get("/uploads/{upload_id}", response_model=UploadOut)
def get_upload(upload_id: str, db: DbSession, user: CurrentUser) -> Upload:
    upload = db.get(Upload, upload_id)
    if upload is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    project = db.get(Project, upload.project_id)
    require_role(db, project.workspace_id, user, "viewer")
    return upload


@router.delete("/uploads/{upload_id}", response_model=UploadOut)
def delete_upload(upload_id: str, db: DbSession, user: CurrentUser) -> Upload:
    upload = db.get(Upload, upload_id)
    if upload is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    project = db.get(Project, upload.project_id)
    require_role(db, project.workspace_id, user, "member")
    active = db.scalar(
        select(Scan).where(Scan.upload_id == upload.id, Scan.status.in_(("queued", "running")))
    )
    if active is not None:
        raise AppError("CONFLICT", "Upload is in use by an active scan.", 409)
    get_storage().delete(upload.object_key)
    upload.status = "deleted"
    db.commit()
    record_event(
        db,
        workspace_id=project.workspace_id,
        actor_id=user.id,
        action="upload.deleted",
        resource_type="upload",
        resource_id=upload.id,
    )
    return upload
