"""End-to-end API flow: project, upload, scan, findings, triage, report."""

SAFE_ZIP = {
    "app/login.py": (
        b'def login(user, password):\n    password = "hunter2"\n    return check(user, password)\n'
    ),
    "README.md": b"# demo app\n",
}


def test_health_and_ready(client) -> None:
    assert client.get("/health").json() == {"status": "ok"}
    ready = client.get("/api/v1/ready")
    assert ready.status_code == 200
    components = ready.json()
    # The endpoint is typed dict[str, str], so a numeric or boolean field would
    # fail to serialize and make readiness itself the thing that is broken.
    assert all(isinstance(value, str) for value in components.values())
    for slot in ("ai_hosted_primary", "ai_hosted_secondary", "ai_hosted_tertiary"):
        assert components[slot] in {"configured", "not_configured"}
    assert components["ai_fallback"] in {"enabled", "disabled"}


def test_full_scan_flow(client, login, fake_scanner, make_zip) -> None:
    login("user-1", "u1@example.com")
    ws = client.post("/api/v1/workspaces", json={"name": "Acme"}).json()
    proj = client.post(
        f"/api/v1/workspaces/{ws['id']}/projects", json={"name": "API", "source_type": "zip_upload"}
    ).json()

    upload_resp = client.post(
        f"/api/v1/projects/{proj['id']}/uploads",
        files={"file": ("source.zip", make_zip(SAFE_ZIP), "application/zip")},
    )
    assert upload_resp.status_code == 201
    upload = upload_resp.json()
    assert upload["status"] == "quarantined"
    assert len(upload["sha256"]) == 64

    scan_resp = client.post(
        f"/api/v1/projects/{proj['id']}/scans",
        json={"upload_id": upload["id"], "options": {"static_analysis": True}},
    )
    assert scan_resp.status_code == 202
    scan = scan_resp.json()
    assert scan["status"] == "completed_with_errors"  # agent review is not configured in this test

    detail = client.get(f"/api/v1/scans/{scan['id']}").json()
    runs = {run["tool_name"]: run for run in detail["tool_runs"]}
    assert runs["fake-scanner"]["status"] == "succeeded"
    # CLI results are retained, but the audit is incomplete without its agent review.
    assert runs["agent"]["status"] == "skipped"
    assert runs["agent"]["error_code"] == "AI_DISABLED"
    assert len(detail["summary"]["steps"]) >= 2
    assert detail["summary"]["total_findings"] == 1  # duplicate finding deduplicated

    findings = client.get(f"/api/v1/scans/{scan['id']}/findings?severity=high&status=open").json()
    assert findings["items"][0]["title"] == "Hardcoded test password"
    finding_id = findings["items"][0]["id"]

    by_tool = client.get(f"/api/v1/scans/{scan['id']}/findings?tool=fake-scanner").json()
    assert len(by_tool["items"]) == 1
    no_tool = client.get(f"/api/v1/scans/{scan['id']}/findings?tool=other-scanner").json()
    assert no_tool["items"] == []

    triage = client.patch(
        f"/api/v1/findings/{finding_id}",
        json={"status": "false_positive", "triage_note": "test fixture"},
    )
    assert triage.status_code == 200
    assert triage.json()["status"] == "false_positive"
    assert triage.json()["triaged_at"] is not None

    report = client.get(f"/api/v1/scans/{scan['id']}/report?format=markdown")
    assert report.status_code == 200
    assert "Vulnix Scan Report" in report.text
    assert report.headers["content-type"].startswith("text/markdown")

    json_report = client.get(f"/api/v1/scans/{scan['id']}/report?format=json").json()
    assert json_report["findings"][0]["status"] == "false_positive"

    audit = client.get(f"/api/v1/workspaces/{ws['id']}/audit-events").json()
    actions = {e["action"] for e in audit["items"]}
    expected = {
        "workspace.created",
        "project.created",
        "upload.created",
        "scan.created",
        "scan.started",
        "scan.completed",
        "finding.triaged",
    }
    assert expected <= actions


def test_audit_events_filter_by_action_group(client, login, project_factory) -> None:
    login()
    ids = project_factory()
    url = f"/api/v1/workspaces/{ids['workspace_id']}/audit-events"

    only = client.get(url, params={"action": "project"}).json()
    assert {e["action"] for e in only["items"]} == {"project.created"}
    assert all(e["action"].startswith("project.") for e in only["items"])
    assert only["items"][0]["resource_label"] == "Payment API"

    # The filter becomes a LIKE prefix, so a value shaped like a pattern is
    # refused rather than passed to the database.
    refused = client.get(url, params={"action": "project%"})
    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "AUDIT_FILTER_INVALID"


def test_audit_events_filter_by_date_range(client, login, project_factory) -> None:
    from datetime import UTC, datetime, timedelta

    login()
    ids = project_factory()
    url = f"/api/v1/workspaces/{ids['workspace_id']}/audit-events"

    events = client.get(url, params={"from_at": "2000-01-01T00:00:00Z"}).json()["items"]
    assert events
    assert all(event["created_at"] >= "2000-01-01" for event in events)

    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    assert client.get(url, params={"from_at": future}).json()["items"] == []

    invalid = client.get(
        url,
        params={
            "from_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "to_at": datetime.now(UTC).isoformat(),
        },
    )
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "AUDIT_DATE_RANGE_INVALID"


def test_upload_rejects_non_zip(client, login, project_factory, make_zip) -> None:
    login()
    ids = project_factory()
    resp = client.post(
        f"/api/v1/projects/{ids['project_id']}/uploads",
        files={"file": ("notes.txt", b"just text", "text/plain")},
    )
    assert resp.status_code == 415
    assert resp.json()["error"]["code"] == "UNSUPPORTED_FORMAT"


def test_scan_with_unsafe_archive_fails_closed(client, login, project_factory, make_zip) -> None:
    login()
    ids = project_factory()
    evil = make_zip({"../../evil.py": b"print('pwned')\n"})
    upload = client.post(
        f"/api/v1/projects/{ids['project_id']}/uploads",
        files={"file": ("evil.zip", evil, "application/zip")},
    ).json()
    # Upload accepts the bytes; the worker rejects them during validation.
    scan = client.post(
        f"/api/v1/projects/{ids['project_id']}/scans", json={"upload_id": upload["id"]}
    ).json()
    assert scan["status"] == "failed"
    assert scan["error_code"] == "UNSAFE_ARCHIVE"


def test_idempotency_key_replays_same_scan(
    client, login, project_factory, fake_scanner, make_zip
) -> None:
    login()
    ids = project_factory()
    upload = client.post(
        f"/api/v1/projects/{ids['project_id']}/uploads",
        files={"file": ("s.zip", make_zip(SAFE_ZIP), "application/zip")},
    ).json()
    headers = {"Idempotency-Key": "abc-123"}
    first = client.post(
        f"/api/v1/projects/{ids['project_id']}/scans", json={"upload_id": upload["id"]}, headers=headers
    ).json()
    second = client.post(
        f"/api/v1/projects/{ids['project_id']}/scans", json={"upload_id": upload["id"]}, headers=headers
    ).json()
    assert first["id"] == second["id"]


def test_scan_without_available_scanners_fails_gracefully(
    client, login, project_factory, make_zip
) -> None:
    # Explicitly disable the agent and opt into the CLI category, so this
    # exercises the CLI-only failure path against whatever real tools the host
    # has. Tools are opt-in now, so asking for nothing is a different error.
    login()
    ids = project_factory()
    upload = client.post(
        f"/api/v1/projects/{ids['project_id']}/uploads",
        files={"file": ("s.zip", make_zip(SAFE_ZIP), "application/zip")},
    ).json()
    scan = client.post(
        f"/api/v1/projects/{ids['project_id']}/scans",
        json={"upload_id": upload["id"], "options": {"agent_review": False, "static_analysis": True}},
    ).json()
    assert scan["status"] == "failed"
    assert scan["error_code"] == "ALL_SCANNERS_FAILED"
    detail = client.get(f"/api/v1/scans/{scan['id']}").json()
    scanner_runs = [run for run in detail["tool_runs"] if run["tool_name"] != "agent"]
    assert scanner_runs, "the scan should still record what it was asked to run"
    # Which real tools exist differs per host, so this only asserts that every
    # run states a reason for having produced nothing.
    assert all(run["status"] in ("failed", "skipped") for run in scanner_runs)
    assert all(run["error_code"] for run in scanner_runs)
    assert client.get("/api/v1/findings/does-not-exist").status_code == 404


def test_default_options_run_the_agent_and_no_cli_tool(
    client, login, project_factory, make_zip
) -> None:
    # The product model: every audit is an AI audit. A scan that asks for nothing
    # must not spawn semgrep, bandit, gitleaks, pip-audit or trivy.
    from app.scanning.adapters import build_adapters
    from app.schemas.scans import ScanOptions

    options = ScanOptions().model_dump()
    assert options["agent_review"] is True
    assert build_adapters(options) == []
    assert build_adapters({}) == []
    assert [a.name for a in build_adapters({"static_analysis": True})] == ["semgrep", "bandit"]

    login()
    ids = project_factory()
    upload = client.post(
        f"/api/v1/projects/{ids['project_id']}/uploads",
        files={"file": ("s.zip", make_zip(SAFE_ZIP), "application/zip")},
    ).json()
    scan = client.post(f"/api/v1/projects/{ids['project_id']}/scans", json={"upload_id": upload["id"]}).json()
    detail = client.get(f"/api/v1/scans/{scan['id']}").json()
    assert [run["tool_name"] for run in detail["tool_runs"]] == ["agent"]
    assert detail["options"]["static_analysis"] is False
    assert detail["error_code"] == "AI_DISABLED"  # no reviewer is configured in tests


def test_upload_rate_limit_returns_429(client, login, project_factory, make_zip, monkeypatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "upload_rate_per_hour", 3)
    login()
    ids = project_factory()
    codes = [
        client.post(
            f"/api/v1/projects/{ids['project_id']}/uploads",
            files={"file": (f"s{i}.zip", make_zip(SAFE_ZIP), "application/zip")},
        ).status_code
        for i in range(4)
    ]
    assert codes == [201, 201, 201, 429]
    limited = client.post(
        f"/api/v1/projects/{ids['project_id']}/uploads",
        files={"file": ("again.zip", make_zip(SAFE_ZIP), "application/zip")},
    )
    assert limited.json()["error"]["code"] == "RATE_LIMITED"


def test_a_crashed_scan_is_reported_failed_not_as_a_fifty_and_a_zombie(
    client, login, project_factory, make_zip, monkeypatch
) -> None:
    """The job row was committed before the work started, so a crash is a result.

    One live run lost its database connection inside a hosted model call: the
    request answered 500 and the scan stayed ``running`` after the process had
    stopped, which is a state the console repeats on every poll.
    """
    from app.scanning import pipeline

    def crash(db, scan, upload, workdir):
        raise RuntimeError("the connection went away mid-review")

    monkeypatch.setattr(pipeline, "_run_scan", crash)
    login()
    ids = project_factory()
    upload = client.post(
        f"/api/v1/projects/{ids['project_id']}/uploads",
        files={"file": ("s.zip", make_zip(SAFE_ZIP), "application/zip")},
    ).json()
    resp = client.post(
        f"/api/v1/projects/{ids['project_id']}/scans", json={"upload_id": upload["id"]}
    )
    assert resp.status_code == 202
    detail = client.get(f"/api/v1/scans/{resp.json()['id']}").json()
    assert detail["status"] == "failed"
    assert detail["error_code"] == "INTERNAL_ERROR"
    assert detail["completed_at"] is not None


def test_scan_rate_limit_returns_429(
    client, login, project_factory, fake_scanner, make_zip, monkeypatch
) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "scan_rate_per_hour", 1)
    login()
    ids = project_factory()
    upload = client.post(
        f"/api/v1/projects/{ids['project_id']}/uploads",
        files={"file": ("s.zip", make_zip(SAFE_ZIP), "application/zip")},
    ).json()
    first = client.post(
        f"/api/v1/projects/{ids['project_id']}/scans", json={"upload_id": upload["id"]}
    )
    second = client.post(
        f"/api/v1/projects/{ids['project_id']}/scans", json={"upload_id": upload["id"]}
    )
    assert first.status_code == 202
    assert second.status_code == 429
    assert second.json()["error"]["code"] == "RATE_LIMITED"
