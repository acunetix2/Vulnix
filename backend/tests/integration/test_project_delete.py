def test_project_delete_requires_exact_name_then_removes_project(
    client, login, project_factory, make_zip, fake_scanner
) -> None:
    login()
    ids = project_factory(project_name="Delete me")
    endpoint = f"/api/v1/projects/{ids['project_id']}"

    upload = client.post(
        f"/api/v1/projects/{ids['project_id']}/uploads",
        files={"file": ("source.zip", make_zip({"app.py": b"print('hello')"}), "application/zip")},
    ).json()
    scan = client.post(
        f"/api/v1/projects/{ids['project_id']}/scans",
        json={"upload_id": upload["id"]},
    ).json()

    mismatch = client.request("DELETE", endpoint, json={"confirm_name": "delete me"})
    assert mismatch.status_code == 422
    assert mismatch.json()["error"]["code"] == "CONFIRMATION_MISMATCH"
    assert client.get(endpoint).status_code == 200

    deleted = client.request("DELETE", endpoint, json={"confirm_name": "Delete me"})
    assert deleted.status_code == 204
    assert client.get(endpoint).status_code == 404
    assert client.get(f"/api/v1/uploads/{upload['id']}").status_code == 404
    assert client.get(f"/api/v1/scans/{scan['id']}").status_code == 404

    events = client.get(
        f"/api/v1/workspaces/{ids['workspace_id']}/audit-events",
        params={"action": "project"},
    ).json()["items"]
    deletion = next(event for event in events if event["action"] == "project.deleted")
    assert deletion["resource_label"] == "Delete me"


def test_project_delete_refuses_to_remove_a_running_audit(client, login, project_factory) -> None:
    login()
    ids = project_factory(project_name="Busy project")

    from app.db.models import Scan
    from app.db.session import SessionLocal

    with SessionLocal() as db:
        db.add(Scan(project_id=ids["project_id"], requested_by="user-1", status="running"))
        db.commit()

    response = client.request(
        "DELETE",
        f"/api/v1/projects/{ids['project_id']}",
        json={"confirm_name": "Busy project"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "PROJECT_BUSY"
    assert client.get(f"/api/v1/projects/{ids['project_id']}").status_code == 200
