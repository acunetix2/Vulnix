"""Quarantine storage on an S3-compatible bucket.

boto3 stays an optional install, so these tests substitute the module the storage
layer imports at call time and assert on the client configuration a real R2 bucket
needs - the things that silently 400 or 500 in production and cannot be caught by a
local-filesystem test.
"""

import hashlib
import io
import sys
import types

import pytest

from app.core.config import settings
from app.core.errors import AppError
from app.integrations.storage.local import S3Storage


class FakeClient:
    def __init__(self, **kwargs) -> None:
        self.kwargs = kwargs
        self.uploads: list[tuple[str, str, bytes]] = []

    def upload_fileobj(self, stream, bucket, key, Config=None) -> None:
        self.uploads.append((bucket, key, stream.read()))


@pytest.fixture()
def clients(monkeypatch) -> list[FakeClient]:
    made: list[FakeClient] = []

    boto3 = types.ModuleType("boto3")
    boto3.client = lambda service, **kwargs: made.append(FakeClient(service=service, **kwargs)) or made[-1]

    class FakeConfig:
        def __init__(self, **kwargs) -> None:
            self.kwargs = kwargs

    botocore = types.ModuleType("botocore")
    config = types.ModuleType("botocore.config")
    config.Config = FakeConfig
    botocore.config = config

    monkeypatch.setitem(sys.modules, "boto3", boto3)
    monkeypatch.setitem(sys.modules, "botocore", botocore)
    monkeypatch.setitem(sys.modules, "botocore.config", config)
    return made


def _storage() -> S3Storage:
    return S3Storage("https://acct.r2.cloudflarestorage.com", "quarantine", "ak", "sk", "auto")


def test_a_named_endpoint_still_needs_a_signing_region(clients) -> None:
    # Without this boto3 raises NoRegionError before it opens a connection, which
    # is why the setting defaults to R2's `auto` rather than being left blank.
    _storage()
    kwargs = clients[0].kwargs
    assert kwargs["service"] == "s3"
    assert kwargs["endpoint_url"] == "https://acct.r2.cloudflarestorage.com"
    assert kwargs["region_name"] == "auto"
    assert kwargs["config"].kwargs["signature_version"] == "s3v4"


def test_writes_carry_no_checksum_trailer(clients) -> None:
    _storage()
    checksum = clients[0].kwargs["config"].kwargs
    assert checksum["request_checksum_calculation"] == "when_required"
    assert checksum["response_checksum_validation"] == "when_required"


def test_the_stored_bytes_match_the_hash_returned(clients) -> None:
    """The size guard reads the stream once; the upload must still send it whole."""
    storage = _storage()
    body = b"stored-archive" * 512
    size, digest = storage.put_stream(io.BytesIO(body), "proj/key.zip", max_bytes=len(body))

    assert size == len(body)
    assert digest == hashlib.sha256(body).hexdigest()
    assert clients[0].uploads == [("quarantine", "proj/key.zip", body)]


def test_an_oversize_upload_is_refused_before_it_is_sent(clients) -> None:
    storage = _storage()
    with pytest.raises(AppError) as exc:
        storage.put_stream(io.BytesIO(b"x" * 2048), "proj/key.zip", max_bytes=1024)

    assert exc.value.code == "UPLOAD_TOO_LARGE"
    assert clients[0].uploads == []


def test_the_configured_region_reaches_the_client(clients, monkeypatch) -> None:
    from app.integrations.storage import local

    monkeypatch.setattr(settings, "storage_backend", "s3")
    monkeypatch.setattr(settings, "s3_region", "eu-west-2")
    local.reset_storage()
    try:
        assert isinstance(local.get_storage(), S3Storage)
        assert clients[0].kwargs["region_name"] == "eu-west-2"
    finally:
        local.reset_storage()
