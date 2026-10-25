"""Tenant isolation and role-based access tests."""

import pytest

ZIP = {"a.py": b"print('x')\n"}


def _setup_workspace(client, login, user_id: str, email: str, name: str = "WS"):
    login(user_id, email)
    ws = client.post("/api/v1/workspaces", json={"name": name}).json()
    proj = client.post(f"/api/v1/workspaces/{ws['id']}/projects", json={"name": "P"}).json()
    return ws, proj


def test_missing_bearer_token_is_rejected(monkeypatch) -> None:
    from starlette.requests import Request

    from app.core.config import settings
    from app.core.errors import AppError
    from app.core.security import get_current_user

    monkeypatch.setattr(settings, "auth_disabled", False)
    scope = {"type": "http", "method": "GET", "path": "/", "headers": [], "query_string": b""}
    with pytest.raises(AppError) as exc:
        get_current_user(Request(scope))
    assert exc.value.status_code == 401


def test_garbage_token_is_rejected(monkeypatch) -> None:
    from starlette.requests import Request

    from app.core.config import settings
    from app.core.errors import AppError
    from app.core.security import get_current_user

    monkeypatch.setattr(settings, "auth_disabled", False)
    monkeypatch.setattr(settings, "supabase_jwt_secret", "test-secret")
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(b"authorization", b"Bearer not-a-real-jwt")],
        "query_string": b"",
    }
    with pytest.raises(AppError) as exc:
        get_current_user(Request(scope))
    assert exc.value.status_code == 401


def test_cross_tenant_access_is_hidden(client, login) -> None:
    ws_a, proj_a = _setup_workspace(client, login, "user-a", "a@example.com")
    # Same test client, different user: must not see user A's resources.
    login("user-b", "b@example.com")
    assert client.get(f"/api/v1/projects/{proj_a['id']}").status_code == 404
    assert client.get(f"/api/v1/workspaces/{ws_a['id']}").status_code == 404
    assert client.get(f"/api/v1/workspaces/{ws_a['id']}/projects").status_code == 404
    # User B's own workspace list does not include A's workspace.
    mine = client.get("/api/v1/workspaces").json()
    assert all(w["id"] != ws_a["id"] for w in mine)


def test_viewer_cannot_create_projects(client, login) -> None:
    ws, _ = _setup_workspace(client, login, "owner-1", "o@example.com")
    # Add a viewer membership directly, then act as them.
    from app.db.models import WorkspaceMember
    from app.db.session import SessionLocal

    db = SessionLocal()
    db.add(WorkspaceMember(workspace_id=ws["id"], user_id="viewer-1", role="viewer"))
    db.commit()
    db.close()

    login("viewer-1", "v@example.com")
    resp = client.post(f"/api/v1/workspaces/{ws['id']}/projects", json={"name": "Nope"})
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


def test_viewer_cannot_triage_findings(client, login, fake_scanner, make_zip) -> None:
    ws, proj = _setup_workspace(client, login, "owner-1", "o@example.com")
    from app.db.models import WorkspaceMember
    from app.db.session import SessionLocal

    db = SessionLocal()
    db.add(WorkspaceMember(workspace_id=ws["id"], user_id="viewer-1", role="viewer"))
    db.commit()
    db.close()

    upload = client.post(
        f"/api/v1/projects/{proj['id']}/uploads",
        files={"file": ("s.zip", make_zip(ZIP), "application/zip")},
    ).json()
    scan = client.post(f"/api/v1/projects/{proj['id']}/scans", json={"upload_id": upload["id"]}).json()
    finding = client.get(f"/api/v1/scans/{scan['id']}/findings").json()["items"][0]

    login("viewer-1", "v@example.com")
    # Viewer may read findings but not change triage state.
    assert client.get(f"/api/v1/findings/{finding['id']}").status_code == 200
    resp = client.patch(f"/api/v1/findings/{finding['id']}", json={"status": "fixed"})
    assert resp.status_code == 403


def test_audit_events_require_admin(client, login) -> None:
    ws, _ = _setup_workspace(client, login, "owner-1", "o@example.com")
    from app.db.models import WorkspaceMember
    from app.db.session import SessionLocal

    db = SessionLocal()
    db.add(WorkspaceMember(workspace_id=ws["id"], user_id="member-1", role="member"))
    db.commit()
    db.close()

    login("member-1", "m@example.com")
    assert client.get(f"/api/v1/workspaces/{ws['id']}/audit-events").status_code == 403

    login("owner-1", "o@example.com")
    assert client.get(f"/api/v1/workspaces/{ws['id']}/audit-events").status_code == 200


def test_workspace_patch_requires_admin(client, login) -> None:
    ws, _ = _setup_workspace(client, login, "owner-1", "o@example.com")
    from app.db.models import WorkspaceMember
    from app.db.session import SessionLocal

    db = SessionLocal()
    db.add(WorkspaceMember(workspace_id=ws["id"], user_id="member-1", role="member"))
    db.commit()
    db.close()

    login("member-1", "m@example.com")
    resp = client.patch(f"/api/v1/workspaces/{ws['id']}", json={"name": "Renamed"})
    assert resp.status_code == 403
