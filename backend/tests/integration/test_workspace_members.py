"""Who holds access to a workspace, and what deleting one actually takes.

The roster is the part of the settings page that names people, so these tests
pin two things: nobody is ever labelled with a primary key, and a workspace
cannot be left ownerless or deleted half-finished.
"""

import pytest
from sqlalchemy import select

from app.db.models import (
    AuditEvent,
    Finding,
    Project,
    Scan,
    ToolRun,
    Upload,
    User,
    Workspace,
    WorkspaceMember,
)
from app.db.session import SessionLocal
from app.integrations.storage import get_storage

ZIP = {"app/login.py": b'password = "hunter2"\n'}


def _account(user_id: str, email: str, **fields) -> None:
    db = SessionLocal()
    db.merge(User(id=user_id, email=email, **fields))
    db.commit()
    db.close()


def _grant(workspace_id: str, user_id: str, role: str) -> None:
    db = SessionLocal()
    db.merge(WorkspaceMember(workspace_id=workspace_id, user_id=user_id, role=role))
    db.commit()
    db.close()


def _roster(client, workspace_id: str):
    return client.get(f"/api/v1/workspaces/{workspace_id}/members").json()


def _destroy(client, workspace_id: str, confirm_name: str):
    # The confirmation travels in a body, which is why this is not client.delete().
    return client.request("DELETE", f"/api/v1/workspaces/{workspace_id}", json={"confirm_name": confirm_name})


def _seed(client, login, name="Acme"):
    login("owner-1", "owner@example.com")
    return client.post("/api/v1/workspaces", json={"name": name}).json()


def _project(client, workspace_id: str, name="API"):
    return client.post(f"/api/v1/workspaces/{workspace_id}/projects", json={"name": name}).json()


def _run_scan(client, project_id: str, make_zip) -> str:
    upload = client.post(
        f"/api/v1/projects/{project_id}/uploads",
        files={"file": ("s.zip", make_zip(ZIP), "application/zip")},
    ).json()
    scan = client.post(f"/api/v1/projects/{project_id}/scans", json={"upload_id": upload["id"]}).json()
    return scan["id"]


def _rows(statement):
    db = SessionLocal()
    found = db.scalars(statement).all()
    db.close()
    return found


def test_the_roster_names_people_and_orders_them_by_role(client, login):
    ws = _seed(client, login)
    _account("admin-1", "admin@example.com", display_name="Grace Hopper")
    _account("member-1", "member@example.com")
    _account("viewer-1", "viewer@example.com", username="leibniz")
    _grant(ws["id"], "admin-1", "admin")
    _grant(ws["id"], "member-1", "member")
    _grant(ws["id"], "viewer-1", "viewer")
    client.patch("/api/v1/auth/me", json={"username": "@Ada"})

    rows = _roster(client, ws["id"])

    assert [r["role"] for r in rows] == ["owner", "admin", "member", "viewer"]
    # Handle beats display name beats a blank, and none of them is an identifier.
    assert [r["label"] for r in rows] == ["ada", "Grace Hopper", "Unclaimed account", "leibniz"]
    assert [r["username"] for r in rows] == ["ada", None, None, "leibniz"]
    for row in rows:
        assert row["label"] != row["user_id"]
        assert row["joined_at"] is not None


def test_a_member_row_with_no_account_is_marked_removed(client, login):
    ws = _seed(client, login)
    _grant(ws["id"], "ghost-1", "viewer")

    ghost = next(row for row in _roster(client, ws["id"]) if row["user_id"] == "ghost-1")
    assert ghost["label"] == "Removed account"
    assert ghost["email"] == ""


def test_joining_makes_the_owner_nameable_without_a_profile_call(client, login):
    ws = _seed(client, login, name="Blind")
    assert _roster(client, ws["id"])[0]["email"] == "owner@example.com"


def test_a_viewer_reads_the_roster_but_cannot_change_it(client, login):
    ws = _seed(client, login)
    _account("viewer-1", "viewer@example.com", username="leibniz")
    _grant(ws["id"], "viewer-1", "viewer")

    login("viewer-1", "viewer@example.com")
    assert client.get(f"/api/v1/workspaces/{ws['id']}/members").status_code == 200
    assert (
        client.patch(f"/api/v1/workspaces/{ws['id']}/members/owner-1", json={"role": "viewer"}).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/v1/workspaces/{ws['id']}/members", json={"email": "someone@example.com"}
        ).status_code
        == 403
    )


def test_an_outsider_never_sees_the_roster(client, login):
    ws = _seed(client, login)
    login("stranger", "stranger@example.com")
    assert client.get(f"/api/v1/workspaces/{ws['id']}/members").status_code == 404


def test_only_an_existing_account_can_be_invited(client, login):
    ws = _seed(client, login)
    unknown = client.post(
        f"/api/v1/workspaces/{ws['id']}/members", json={"email": "nobody@example.com"}
    )
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "ACCOUNT_UNKNOWN"

    _account("member-1", "Member@Example.com", username="raphson")
    invited = client.post(
        f"/api/v1/workspaces/{ws['id']}/members",
        json={"email": " member@example.com ", "role": "member"},
    )
    assert invited.status_code == 201
    assert invited.json()["label"] == "raphson"
    assert invited.json()["role"] == "member"

    duplicate = client.post(
        f"/api/v1/workspaces/{ws['id']}/members", json={"email": "member@example.com"}
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "ALREADY_MEMBER"


def test_ownership_is_not_granted_by_an_invitation(client, login):
    ws = _seed(client, login)
    _account("member-1", "member@example.com")
    body = client.post(
        f"/api/v1/workspaces/{ws['id']}/members",
        json={"email": "member@example.com", "role": "owner"},
    )
    assert body.status_code == 422


def test_an_admin_may_invite_below_their_own_role_only(client, login):
    ws = _seed(client, login)
    _account("admin-1", "admin2@example.com")
    _account("admin-2", "admin3@example.com")
    _account("member-1", "member@example.com")
    _grant(ws["id"], "admin-1", "admin")

    login("admin-1", "admin2@example.com")
    peer = client.post(
        f"/api/v1/workspaces/{ws['id']}/members",
        json={"email": "admin3@example.com", "role": "admin"},
    )
    assert peer.status_code == 403
    assert peer.json()["error"]["code"] == "FORBIDDEN"

    junior = client.post(
        f"/api/v1/workspaces/{ws['id']}/members", json={"email": "member@example.com"}
    )
    assert junior.status_code == 201
    assert junior.json()["role"] == "member"

    # A person who is not in this workspace cannot have a role changed here.
    assert (
        client.patch(
            f"/api/v1/workspaces/{ws['id']}/members/admin-2", json={"role": "viewer"}
        ).status_code
        == 404
    )


def test_only_an_owner_creates_an_owner(client, login):
    ws = _seed(client, login)
    _account("member-1", "member@example.com", username="ada")
    _grant(ws["id"], "member-1", "member")
    login("member-1", "member@example.com")
    assert (
        client.patch(f"/api/v1/workspaces/{ws['id']}/members/owner-1", json={"role": "viewer"}).status_code
        == 403
    )

    login("owner-1", "owner@example.com")
    promoted = client.patch(f"/api/v1/workspaces/{ws['id']}/members/member-1", json={"role": "owner"})
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "owner"
    assert len([row for row in _roster(client, ws["id"]) if row["role"] == "owner"]) == 2


def test_an_admin_cannot_touch_a_peer_but_may_step_down(client, login):
    ws = _seed(client, login)
    _account("admin-1", "admin@example.com")
    _grant(ws["id"], "admin-1", "admin")

    login("admin-1", "admin@example.com")
    assert (
        client.patch(f"/api/v1/workspaces/{ws['id']}/members/admin-1", json={"role": "admin"}).status_code
        == 200
    )
    assert (
        client.patch(f"/api/v1/workspaces/{ws['id']}/members/admin-1", json={"role": "member"}).status_code
        == 200
    )
    assert _roster(client, ws["id"])[-1]["role"] == "member"


def test_role_change_and_removal_round_trip(client, login):
    ws = _seed(client, login)
    _account("member-1", "member@example.com", username="ada")
    _grant(ws["id"], "member-1", "member")

    admin = client.patch(f"/api/v1/workspaces/{ws['id']}/members/member-1", json={"role": "admin"})
    assert admin.status_code == 200
    assert admin.json()["role"] == "admin"
    assert client.delete(f"/api/v1/workspaces/{ws['id']}/members/member-1").status_code == 204
    assert [row["user_id"] for row in _roster(client, ws["id"])] == ["owner-1"]


def test_the_only_owner_cannot_step_down_or_leave(client, login):
    ws = _seed(client, login)

    step_down = client.patch(f"/api/v1/workspaces/{ws['id']}/members/owner-1", json={"role": "admin"})
    assert step_down.status_code == 409
    assert step_down.json()["error"]["code"] == "LAST_OWNER"

    assert client.delete(f"/api/v1/workspaces/{ws['id']}/members/owner-1").status_code == 409
    assert _roster(client, ws["id"])[0]["role"] == "owner"


def test_with_a_co_owner_the_first_owner_may_leave(client, login):
    ws = _seed(client, login)
    _account("co-owner", "co@example.com", username="boole")
    _grant(ws["id"], "co-owner", "owner")

    assert client.delete(f"/api/v1/workspaces/{ws['id']}/members/owner-1").status_code == 204
    login("co-owner", "co@example.com")
    assert [row["user_id"] for row in _roster(client, ws["id"])] == ["co-owner"]
    login("owner-1", "owner@example.com")
    assert client.get(f"/api/v1/workspaces/{ws['id']}").status_code == 404


def test_any_member_may_leave_the_workspace(client, login):
    ws = _seed(client, login)
    _account("viewer-1", "viewer@example.com")
    _grant(ws["id"], "viewer-1", "viewer")

    login("viewer-1", "viewer@example.com")
    assert client.delete(f"/api/v1/workspaces/{ws['id']}/members/viewer-1").status_code == 204
    assert client.get(f"/api/v1/workspaces/{ws['id']}/members").status_code == 404


def test_member_changes_are_attributed_by_handle(client, login):
    ws = _seed(client, login)
    client.patch("/api/v1/auth/me", json={"username": "ada"})
    _account("member-1", "member@example.com")

    client.post(f"/api/v1/workspaces/{ws['id']}/members", json={"email": "member@example.com"})
    client.patch(f"/api/v1/workspaces/{ws['id']}/members/member-1", json={"role": "admin"})

    events = client.get(f"/api/v1/workspaces/{ws['id']}/audit-events").json()["items"]
    actions = {event["action"]: event for event in events}
    assert actions["workspace.member_added"]["actor_label"] == "ada"
    assert actions["workspace.member_role_changed"]["metadata"]["role"] == "admin"


def test_deleting_needs_the_name_typed_exactly(client, login, fake_scanner, make_zip):
    ws = _seed(client, login, name="Payments")
    _run_scan(client, _project(client, ws["id"])["id"], make_zip)

    mismatch = _destroy(client, ws["id"], "payments ")
    assert mismatch.status_code == 422
    assert mismatch.json()["error"]["code"] == "CONFIRMATION_MISMATCH"
    assert client.get(f"/api/v1/workspaces/{ws['id']}").status_code == 200

    _account("admin-1", "admin@example.com")
    _grant(ws["id"], "admin-1", "admin")
    login("admin-1", "admin@example.com")
    answer = _destroy(client, ws["id"], "Payments")
    assert answer.status_code == 403


def test_a_workspace_with_a_scan_in_flight_cannot_be_deleted(client, login):
    ws = _seed(client, login, name="Queued")
    proj = _project(client, ws["id"])
    db = SessionLocal()
    db.add(Scan(project_id=proj["id"], status="queued", requested_by="owner-1", options={}))
    db.commit()
    db.close()

    busy = _destroy(client, ws["id"], "Queued")
    assert busy.status_code == 409
    assert busy.json()["error"]["code"] == "WORKSPACE_BUSY"


@pytest.mark.usefixtures("fake_scanner")
def test_deleting_takes_everything_derived_from_it(client, login, make_zip):
    doomed = _seed(client, login, name="Doomed")
    doomed_project = _project(client, doomed["id"])
    scan_id = _run_scan(client, doomed_project["id"], make_zip)
    [object_key] = _rows(select(Upload.object_key).where(Upload.project_id == doomed_project["id"]))

    survivor = _seed(client, login, name="Survivor")
    survivor_project = _project(client, survivor["id"], name="Keep")
    _run_scan(client, survivor_project["id"], make_zip)
    assert len(_rows(select(Finding.id).where(Finding.scan_id == scan_id))) == 1

    deleted = _destroy(client, doomed["id"], "Doomed")
    assert deleted.status_code == 204

    assert client.get(f"/api/v1/workspaces/{doomed['id']}").status_code == 404
    assert client.get(f"/api/v1/scans/{scan_id}").status_code == 404
    assert [w["name"] for w in client.get("/api/v1/workspaces").json()] == ["Survivor"]

    assert {w.id for w in _rows(select(Workspace))} == {survivor["id"]}
    assert _rows(select(Scan.project_id)) == [survivor_project["id"]]
    assert _rows(select(Upload.project_id)) == [survivor_project["id"]]
    assert _rows(select(Project.id)) == [survivor_project["id"]]
    assert _rows(select(Finding.scan_id)) != [scan_id]
    assert _rows(select(ToolRun.scan_id)) != [scan_id]
    assert _rows(select(WorkspaceMember.workspace_id)) == [survivor["id"]]
    assert _rows(select(AuditEvent.workspace_id).where(AuditEvent.workspace_id == doomed["id"])) == []
    # The archive goes with the row that named it, so nothing is left unreachable.
    assert get_storage()._path_for(object_key).exists() is False


def test_deleting_a_workspace_twice_is_a_404(client, login):
    ws = _seed(client, login, name="Twice")
    assert _destroy(client, ws["id"], "Twice").status_code == 204
    assert _destroy(client, ws["id"], "Twice").status_code == 404
