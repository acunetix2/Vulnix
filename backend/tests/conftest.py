"""Shared test setup.

Environment variables are set before any application import so settings and
the database engine pick up the test configuration.
"""

import io
import os
import tempfile
import zipfile
from collections.abc import Callable, Generator
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="vulnix-tests-"))
os.environ["VULNIX_APP_ENV"] = "test"
os.environ["VULNIX_DATABASE_URL"] = "sqlite:///:memory:"
os.environ["VULNIX_AUTH_DISABLED"] = "true"
os.environ["VULNIX_CELERY_EAGER"] = "true"
os.environ["VULNIX_STORAGE_BACKEND"] = "local"
os.environ["VULNIX_STORAGE_LOCAL_ROOT"] = str(_TMP / "storage")
os.environ["VULNIX_SCAN_WORKDIR"] = str(_TMP / "scans")
os.environ["VULNIX_DB_AUTO_CREATE"] = "true"
os.environ["VULNIX_AI_ENABLED"] = "false"
# Integrations stay off, and are pinned rather than left to the default: a
# developer's .env that turns them on would otherwise change what these tests
# assert. Tests that want them on need key material so secret encryption behaves
# for real.
os.environ["VULNIX_INTEGRATIONS_ENABLED"] = "false"
os.environ["VULNIX_INTEGRATION_SECRET_KEY"] = "test-integration-secret"


def _make_zip(files: dict[str, bytes], symlinks: tuple[str, str] = ()) -> bytes:
    """Build an in-memory ZIP for upload tests."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in files.items():
            zf.writestr(name, data)
        for name, target in symlinks:
            info = zipfile.ZipInfo(name)
            info.external_attr = (0o120777 << 16)  # Unix symlink mode
            zf.writestr(info, target)
    return buf.getvalue()


@pytest.fixture()
def make_zip():
    return _make_zip


@pytest.fixture(autouse=True)
def _clean_state() -> Generator[None, None, None]:
    from app.ai.catalog import clear_cache
    from app.core.rate_limit import reset_limits
    from app.db.base import Base
    from app.db.session import engine

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    reset_limits()
    # The model catalog is probed from providers and cached by TTL; a leaked
    # cache would show one test's models inside the next.
    clear_cache()
    yield
    clear_cache()


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def login() -> Callable[[str, str], None]:
    """Impersonate a user by overriding the auth dependency."""
    from app.core.security import AuthUser, get_current_user
    from app.main import app

    def _login(user_id: str = "user-1", email: str = "user1@example.com") -> None:
        app.dependency_overrides[get_current_user] = lambda: AuthUser(id=user_id, email=email)

    return _login


@pytest.fixture()
def fake_scanner(monkeypatch: pytest.MonkeyPatch):
    """Replace real scanners with one deterministic fake adapter."""
    from app.scanning.adapters.base import ScannerAdapter, ToolRunResult
    from app.scanning.normalize import NormalizedFinding

    class FakeAdapter(ScannerAdapter):
        name = "fake-scanner"
        executable = "true"

        def available(self) -> bool:
            return True

        def version(self) -> str | None:
            return "1.0.0-test"

        def run(self, target_dir):
            findings = [
                NormalizedFinding(
                    rule_id="FAKE001",
                    title="Hardcoded test password",
                    category="static_analysis",
                    severity="high",
                    confidence="high",
                    file_path="app/login.py",
                    start_line=3,
                    end_line=3,
                    evidence='password = "hunter2"',
                    scanner_message="Hardcoded password literal found",
                ),
                NormalizedFinding(
                    rule_id="FAKE001",
                    title="Hardcoded test password",
                    category="static_analysis",
                    severity="high",
                    confidence="high",
                    file_path="app/login.py",
                    start_line=3,
                    end_line=3,
                    evidence='password = "hunter2"',
                    scanner_message="Hardcoded password literal found",
                ),
            ]
            for finding in findings:
                finding.tool = self.name
            return ToolRunResult(
                tool_name=self.name,
                tool_version=self.version(),
                status="succeeded",
                exit_code=0,
                duration_ms=5,
                findings=findings,
            )

        def build_command(self, target_dir):
            return []

        def parse(self, raw):
            return []

    monkeypatch.setattr("app.scanning.pipeline.build_adapters", lambda options: [FakeAdapter()])
    return FakeAdapter


@pytest.fixture()
def project_factory(client, login):
    """Create a workspace + project via the API and return their ids."""

    def _factory(workspace_name="Acme", project_name="Payment API") -> dict[str, str]:
        ws = client.post("/api/v1/workspaces", json={"name": workspace_name}).json()
        proj = client.post(
            f"/api/v1/workspaces/{ws['id']}/projects",
            json={"name": project_name, "source_type": "zip_upload"},
        ).json()
        return {"workspace_id": ws["id"], "project_id": proj["id"]}

    return _factory
