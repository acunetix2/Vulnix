"""Integration API: authorisation, write-only secrets, fan-out, and the log."""

import json
import socket
from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import settings
from app.db.models import IntegrationDelivery
from app.db.session import SessionLocal
from app.modules.integrations import clients, service
from app.modules.integrations.events import EVENT_TEST

ZIP = {"a.py": b"print('x')\n"}
SLACK_SECRET = "fixture-slack-token"


@pytest.fixture()
def enabled(monkeypatch) -> None:
    monkeypatch.setattr(settings, "integrations_enabled", True)


@pytest.fixture()
def sent(monkeypatch) -> list[dict]:
    """Capture every outbound call instead of making one, reporting success."""
    calls: list[dict] = []

    def fake(url, content, headers):
        calls.append({"url": url, "body": json.loads(content), "headers": dict(headers)})
        return clients.SendResult(ok=True, http_status=200, body={"ok": True})

    monkeypatch.setattr(clients, "_request", fake)
    return calls


def _workspace(client, login, user_id="owner-1", email="o@example.com", name="Acme"):
    login(user_id, email)
    return client.post("/api/v1/workspaces", json={"name": name}).json()


def _add_member(workspace_id: str, user_id: str, role: str) -> None:
    from app.db.models import WorkspaceMember
    from app.db.session import SessionLocal

    db = SessionLocal()
    db.add(WorkspaceMember(workspace_id=workspace_id, user_id=user_id, role=role))
    db.commit()
    db.close()


def _put_slack(client, workspace_id, **overrides) -> dict:
    body = {"channel": "security", "secret": SLACK_SECRET, **overrides}
    return client.put(f"/api/v1/workspaces/{workspace_id}/integrations/slack", json=body).json()


def test_disabled_server_refuses_writes_but_still_reads(client, login) -> None:
    ws = _workspace(client, login)
    resp = client.put(
        f"/api/v1/workspaces/{ws['id']}/integrations/slack",
        json={"channel": "security", "secret": SLACK_SECRET},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INTEGRATIONS_DISABLED"
    assert client.get(f"/api/v1/workspaces/{ws['id']}/integrations").json() == []


def test_secret_is_write_only_and_survives_edits(client, login, enabled) -> None:
    ws = _workspace(client, login)
    out = _put_slack(client, ws["id"])
    assert out["configured"] is True and out["secret_hint"] == SLACK_SECRET[-4:].rjust(7, ".")
    assert SLACK_SECRET not in json.dumps(out)

    # Editing the channel without a new secret keeps the stored one.
    out2 = client.put(
        f"/api/v1/workspaces/{ws['id']}/integrations/slack",
        json={"channel": "urgent", "enabled": False},
    ).json()
    assert out2["config"]["channel"] == "urgent"
    assert out2["enabled"] is False and out2["configured"] is True
    # Only the hint and the flag cross the wire - never ciphertext or plaintext.
    assert not {"secret", "secret_enc"} & set(out2.keys())
    assert SLACK_SECRET not in json.dumps(out2)


def test_clear_secret_disables_the_target(client, login, enabled) -> None:
    ws = _workspace(client, login)
    _put_slack(client, ws["id"])
    out = client.put(
        f"/api/v1/workspaces/{ws['id']}/integrations/slack",
        json={"channel": "security", "clear_secret": True},
    ).json()
    assert out["configured"] is False and out["secret_hint"] is None and out["enabled"] is False
    # Testing without a credential is refused before any request is made.
    assert client.post(f"/api/v1/workspaces/{ws['id']}/integrations/slack/test").status_code == 409


def test_incomplete_and_unknown_provider_requests(client, login, enabled) -> None:
    ws = _workspace(client, login)
    resp = client.put(f"/api/v1/workspaces/{ws['id']}/integrations/slack", json={"secret": SLACK_SECRET})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INTEGRATION_CONFIG_INCOMPLETE"
    assert client.put(f"/api/v1/workspaces/{ws['id']}/integrations/email", json={}).status_code == 404
    assert client.get(f"/api/v1/workspaces/{ws['id']}/integrations/jira").status_code == 404


def test_short_secret_is_rejected(client, login, enabled) -> None:
    ws = _workspace(client, login)
    resp = client.put(
        f"/api/v1/workspaces/{ws['id']}/integrations/slack", json={"channel": "s", "secret": "short"}
    )
    assert resp.status_code == 422


def test_viewer_cannot_write_and_outsider_gets_404(client, login, enabled) -> None:
    ws = _workspace(client, login)
    _put_slack(client, ws["id"])
    other = _workspace(client, login, "owner-2", "o2@example.com", "Other")

    login("viewer-1", "v@example.com")
    _add_member(ws["id"], "viewer-1", "viewer")
    assert client.get(f"/api/v1/workspaces/{ws['id']}/integrations").status_code == 200
    resp = client.put(
        f"/api/v1/workspaces/{ws['id']}/integrations/slack", json={"channel": "nope", "secret": SLACK_SECRET}
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"

    # A different workspace's admin must not distinguish absent from foreign.
    login("owner-2", "o2@example.com")
    assert client.get(f"/api/v1/workspaces/{ws['id']}/integrations/slack").status_code == 404
    assert client.delete(f"/api/v1/workspaces/{ws['id']}/integrations/slack").status_code == 404
    assert client.get(f"/api/v1/workspaces/{ws['id']}/webhooks").status_code == 404
    assert _put_slack(client, other["id"])["provider"] == "slack"


def test_delete_removes_configuration(client, login, enabled) -> None:
    ws = _workspace(client, login)
    _put_slack(client, ws["id"])
    assert client.delete(f"/api/v1/workspaces/{ws['id']}/integrations/slack").status_code == 204
    assert client.get(f"/api/v1/workspaces/{ws['id']}/integrations/slack").status_code == 404


def test_webhook_validation_and_crud(client, login, enabled) -> None:
    ws = _workspace(client, login)
    base = f"/api/v1/workspaces/{ws['id']}/webhooks"

    bad_urls = (
        "http://example.com/hook",
        "https://user:token@example.com/hook",
        "https://example.com:8444/h",
    )
    for url in bad_urls:
        resp = client.post(base, json={"name": "n", "url": url, "events": ["scan.completed"]})
        assert resp.status_code == 422
    assert client.post(
        base, json={"name": "n", "url": "https://example.com/hook", "events": ["pull.merged"]}
    ).status_code == 422

    created = client.post(
        base,
        json={
            "name": "Security desk",
            "url": "https://desk.example.com/vulnix",
            "events": ["scan.completed"],
        },
    )
    assert created.status_code == 201
    hook = created.json()
    # The signing key is generated by Vulnix and handed over exactly once, here.
    assert hook["configured"] is True and hook["secret"].startswith("whsec_")
    assert "secret" not in client.get(base).json()[0]

    updated = client.patch(
        f"{base}/{hook['id']}",
        json={"name": "Renamed desk", "events": ["*"], "enabled": False, "secret": "whsec_abcdef12345"},
    ).json()
    assert updated["events"] == ["*"] and updated["enabled"] is False
    assert updated["configured"] is True and "whsec_abcdef12345" not in json.dumps(updated)

    assert len(client.get(base).json()) == 1
    assert client.delete(f"{base}/{hook['id']}").status_code == 204
    assert client.get(base).json() == []
    assert client.patch(f"{base}/{hook['id']}", json={"name": "x"}).status_code == 404


def test_provider_test_records_a_delivery(client, login, enabled, sent) -> None:
    ws = _workspace(client, login)
    _put_slack(client, ws["id"])
    resp = client.post(f"/api/v1/workspaces/{ws['id']}/integrations/slack/test")
    result = resp.json()
    assert result["ok"] is True
    assert result["delivery"]["event_type"] == EVENT_TEST
    assert result["delivery"]["status"] == "succeeded"
    assert result["delivery"]["target_label"] == "#security"
    assert sent[0]["headers"]["authorization"] == f"Bearer {SLACK_SECRET}"


def test_webhook_test_is_blocked_by_the_egress_guard(client, login, enabled, monkeypatch) -> None:
    def fake(host, port=None, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 0, "", ("169.254.169.254", 443))]

    monkeypatch.setattr("app.core.egress.socket.getaddrinfo", fake)
    ws = _workspace(client, login)
    hook = client.post(
        f"/api/v1/workspaces/{ws['id']}/webhooks",
        json={"name": "Metadata", "url": "https://anything.example.com/hook", "events": ["*"]},
    ).json()
    result = client.post(f"/api/v1/workspaces/{ws['id']}/webhooks/{hook['id']}/test").json()
    assert result["ok"] is False
    assert result["delivery"]["status"] == "dead"
    assert result["delivery"]["last_error_code"] == "TARGET_BLOCKED"


def test_scan_completion_fans_out(client, login, enabled, sent, fake_scanner, make_zip) -> None:
    ws = _workspace(client, login)
    _put_slack(client, ws["id"])
    hook = client.post(
        f"/api/v1/workspaces/{ws['id']}/webhooks",
        json={"name": "Desk", "url": "https://desk.example.com/hook", "events": ["scan.completed"]},
    ).json()
    proj = client.post(f"/api/v1/workspaces/{ws['id']}/projects", json={"name": "Payment API"}).json()

    upload = client.post(
        f"/api/v1/projects/{proj['id']}/uploads",
        files={"file": ("s.zip", make_zip(ZIP), "application/zip")},
    ).json()
    client.post(f"/api/v1/projects/{proj['id']}/scans", json={"upload_id": upload["id"]})

    channels = {call["url"] for call in sent}
    assert clients.SLACK_POST_MESSAGE_URL in channels
    assert f"{hook['url']}" in channels

    deliveries = client.get(f"/api/v1/workspaces/{ws['id']}/integrations/deliveries").json()["items"]
    assert {d["channel"] for d in deliveries} == {"slack", "webhook"}
    assert all(d["status"] == "succeeded" for d in deliveries)
    slack_body = next(c for c in sent if c["url"] == clients.SLACK_POST_MESSAGE_URL)["body"]
    assert "Payment API" in slack_body["text"] and "scan completed" in slack_body["text"]
    # No source paths or evidence ever leave the process.
    assert "a.py" not in json.dumps(slack_body)


def test_triage_notify_flag_and_redaction(client, login, enabled, sent, fake_scanner, make_zip) -> None:
    ws = _workspace(client, login)
    proj = client.post(
        f"/api/v1/workspaces/{ws['id']}/projects", json={"name": "password=hunter2"}
    ).json()
    upload = client.post(
        f"/api/v1/projects/{proj['id']}/uploads",
        files={"file": ("s.zip", make_zip(ZIP), "application/zip")},
    ).json()
    scan = client.post(f"/api/v1/projects/{proj['id']}/scans", json={"upload_id": upload["id"]}).json()
    finding = client.get(f"/api/v1/scans/{scan['id']}/findings").json()["items"][0]

    client.patch(f"/api/v1/findings/{finding['id']}", json={"status": "fixed"})
    assert not [c for c in sent if "set to fixed" in json.dumps(c["body"])]

    _put_slack(client, ws["id"], notify_triage=True)
    sent.clear()
    client.patch(f"/api/v1/findings/{finding['id']}", json={"status": "accepted_risk"})
    body = json.dumps([c["body"] for c in sent])
    assert "accepted_risk" in body
    assert "hunter2" not in body and "[REDACTED]" in body


def test_retryable_failure_backs_off_then_dead_letters(client, login, enabled, monkeypatch) -> None:
    monkeypatch.setattr(settings, "integration_max_attempts", 2)
    monkeypatch.setattr(clients, "_request", lambda url, content, headers: clients.SendResult(
        ok=False, http_status=503, error_code="TARGET_SERVER_ERROR", retryable=True
    ))
    ws = _workspace(client, login)
    _put_slack(client, ws["id"])
    assert client.post(f"/api/v1/workspaces/{ws['id']}/integrations/slack/test").json()["ok"] is False

    item = client.get(f"/api/v1/workspaces/{ws['id']}/integrations/deliveries").json()["items"][0]
    assert item["status"] == "failed" and item["attempts"] == 1
    assert item["last_error_code"] == "TARGET_SERVER_ERROR"

    db = SessionLocal()
    try:
        row = db.get(IntegrationDelivery, item["id"])
        # Backoff holds the row until its next attempt window opens.
        assert service.deliver_due(db) == 0
        row.next_attempt_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()
        assert service.deliver_due(db) == 1
        db.refresh(row)
        assert row.status == "dead" and row.attempts == 2
    finally:
        db.close()

    # Dead letters stay in the log and an admin can requeue them; eager mode runs
    # the retry inline, so the response carries the new outcome.
    redelivered = client.post(
        f"/api/v1/workspaces/{ws['id']}/integrations/deliveries/{item['id']}/redeliver"
    ).json()
    assert redelivered["status"] == "failed"
    assert redelivered["attempts"] == 1


def test_deliveries_filter_and_paginate(client, login, enabled, sent) -> None:
    ws = _workspace(client, login)
    _put_slack(client, ws["id"])
    client.post(f"/api/v1/workspaces/{ws['id']}/integrations/slack/test")
    client.post(f"/api/v1/workspaces/{ws['id']}/integrations/slack/test")

    page = client.get(f"/api/v1/workspaces/{ws['id']}/integrations/deliveries?channel=slack&limit=1").json()
    assert len(page["items"]) == 1 and page["next_cursor"]
    # The response is a keyset page: items plus a cursor, never a total count.
    assert "total" not in page
    second = client.get(
        f"/api/v1/workspaces/{ws['id']}/integrations/deliveries?channel=slack&limit=1&cursor={page['next_cursor']}"
    ).json()
    assert second["items"][0]["id"] != page["items"][0]["id"]
    bad = client.get(f"/api/v1/workspaces/{ws['id']}/integrations/deliveries?channel=email")
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "VALIDATION_ERROR"


def test_missing_secret_key_blocks_writes(client, login, monkeypatch) -> None:
    monkeypatch.setattr(settings, "integrations_enabled", True)
    monkeypatch.setattr(settings, "integration_secret_key", "")
    ws = _workspace(client, login)
    resp = client.put(
        f"/api/v1/workspaces/{ws['id']}/integrations/slack", json={"channel": "s", "secret": SLACK_SECRET}
    )
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "INTEGRATION_KEY_MISSING"
