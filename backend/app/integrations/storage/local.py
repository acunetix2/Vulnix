"""Object storage abstraction.

Uploaded archives land in quarantine storage. Original filenames are kept as
display metadata only; object keys are generated server-side.
"""

import hashlib
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO

from app.core.config import settings
from app.core.errors import AppError


class ObjectStorage(ABC):
    @abstractmethod
    def put_stream(self, stream: BinaryIO, key: str, max_bytes: int) -> tuple[int, str]:
        """Store a stream under `key`; returns (size, sha256 hex)."""

    @abstractmethod
    def open_read(self, key: str) -> BinaryIO: ...

    @abstractmethod
    def delete(self, key: str) -> None: ...

    def new_key(self, project_id: str, suffix: str = ".zip") -> str:
        # Generated key: no user-controlled path segments.
        return f"{project_id}/{uuid.uuid4().hex}{suffix}"


class LocalStorage(ObjectStorage):
    """Filesystem-backed storage for development and tests."""

    def __init__(self, root: str) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path_for(self, key: str) -> Path:
        path = (self.root / key).resolve()
        # Confinement check: refuse keys that escape the storage root.
        if not path.is_relative_to(self.root):
            raise AppError("INVALID_STORAGE_KEY", "Invalid storage key.", 400)
        return path

    def put_stream(self, stream: BinaryIO, key: str, max_bytes: int) -> tuple[int, str]:
        path = self._path_for(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256()
        size = 0
        with path.open("wb") as out:
            while chunk := stream.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    out.close()
                    path.unlink(missing_ok=True)
                    raise AppError("UPLOAD_TOO_LARGE", "Upload exceeds the allowed size.", 413)
                digest.update(chunk)
                out.write(chunk)
        return size, digest.hexdigest()

    def open_read(self, key: str) -> BinaryIO:
        path = self._path_for(key)
        if not path.is_file():
            raise AppError("NOT_FOUND", "Stored object not found.", 404)
        return path.open("rb")

    def delete(self, key: str) -> None:
        self._path_for(key).unlink(missing_ok=True)


class S3Storage(ObjectStorage):
    """S3-compatible storage. boto3 is imported lazily so it stays optional."""

    def __init__(self, endpoint: str, bucket: str, access_key: str, secret_key: str) -> None:
        import boto3  # optional dependency

        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint or None,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )

    def put_stream(self, stream: BinaryIO, key: str, max_bytes: int) -> tuple[int, str]:
        data = stream.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise AppError("UPLOAD_TOO_LARGE", "Upload exceeds the allowed size.", 413)
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data)
        return len(data), hashlib.sha256(data).hexdigest()

    def open_read(self, key: str) -> BinaryIO:
        try:
            obj = self.client.get_object(Bucket=self.bucket, Key=key)
        except Exception:
            raise AppError("NOT_FOUND", "Stored object not found.", 404) from None
        return obj["Body"]

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)


_storage: ObjectStorage | None = None


def get_storage() -> ObjectStorage:
    global _storage
    if _storage is None:
        if settings.storage_backend == "s3":
            _storage = S3Storage(
                settings.s3_endpoint_url, settings.s3_bucket, settings.s3_access_key, settings.s3_secret_key
            )
        else:
            _storage = LocalStorage(settings.storage_local_root)
    return _storage


def reset_storage() -> None:
    """Test helper to rebind storage after settings change."""
    global _storage
    _storage = None
