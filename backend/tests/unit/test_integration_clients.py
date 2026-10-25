"""Outbound client behaviour, driven through httpx's mock transport so the real
request path - guard, body cap, redirect policy, status mapping - is exercised
without touching the network."""

import base64
import json
import socket

import httpx
import pytest

from app.core import egress
from app.core.config import settings
from app.modules.integrations import clients

PUBLIC = "93.184.216.34"
HOOK = "https://hooks.example.com/security"


@pytest.fixture(autouse=True)
def _public_dns(monkeypatch) -> None:
    def fake(host, port=None, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 0, "", (PUBLIC, 443))]

    monkeypatch.setattr(egress.socket, "getaddrinfo", fake)


def _respond(monkeypatch, status_code: int, body: object = None, headers: dict | None = None):
    """Route every outbound client through a transport that never leaves the test."""
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        payload = body if body is not None else b""
        if isinstance(payload, (dict, list)):
            return httpx.Response(status_code, json=payload, headers=headers or {})
        return httpx.Response(status_code, content=payload, headers=headers or {})

    real = httpx.Client

    def factory(*args, **kwargs):
        return real(*args, transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "Client", factory)
    return calls


def test_webhook_sends_signed_redacted_body(monkeypatch) -> None:
    calls = _respond(monkeypatch, 202)
    result = clients.send_webhook(
        HOOK, {"event": "scan.completed", "scan": {"id": "s1"}}, "whsec_123", "delivery-1"
    )
    assert result.ok and result.http_status == 202
    request = calls[0]
    assert json.loads(request.content) == {"event": "scan.completed", "scan": {"id": "s1"}}
    assert request.headers["x-vulnix-event"] == "scan.completed"
    assert request.headers["x-vulnix-delivery"] == "delivery-1"
    signature = request.headers["x-vulnix-signature"]
    timestamp = request.headers["x-vulnix-timestamp"]
    assert signature == "v1=" + clients.sign_webhook("whsec_123", int(timestamp), request.content)


def test_unsigned_webhook_has_no_signature_header(monkeypatch) -> None:
    calls = _respond(monkeypatch, 200)
    assert clients.send_webhook(HOOK, {"event": "scan.failed"}, None, "d2").ok
    assert "x-vulnix-signature" not in calls[0].headers


def test_body_cap_is_enforced_before_any_request(monkeypatch) -> None:
    monkeypatch.setattr(settings, "integration_max_body_bytes", 64)
    calls = _respond(monkeypatch, 200)
    result = clients.send_webhook(HOOK, {"event": "scan.completed", "blob": "x" * 500}, None, "d3")
    assert result.error_code == "PAYLOAD_TOO_LARGE"
    assert calls == []


def test_private_target_never_reaches_the_transport(monkeypatch) -> None:
    def fake(host, port=None, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 0, "", ("169.254.169.254", 443))]

    monkeypatch.setattr(egress.socket, "getaddrinfo", fake)
    calls = _respond(monkeypatch, 200)
    result = clients.send_webhook(HOOK, {"event": "scan.completed"}, None, "d4")
    assert result.error_code == "TARGET_BLOCKED"
    assert not result.retryable
    assert calls == []


def test_redirect_is_refused(monkeypatch) -> None:
    _respond(monkeypatch, 302, headers={"location": "http://127.0.0.1/"})
    result = clients.send_webhook(HOOK, {"event": "scan.completed"}, None, "d5")
    assert (result.ok, result.error_code, result.retryable) == (False, "REDIRECT_REFUSED", False)


def test_server_error_is_retryable(monkeypatch) -> None:
    _respond(monkeypatch, 503)
    result = clients.send_webhook(HOOK, {"event": "scan.completed"}, None, "d6")
    assert (result.error_code, result.retryable, result.http_status) == ("TARGET_SERVER_ERROR", True, 503)


def test_client_error_is_terminal(monkeypatch) -> None:
    _respond(monkeypatch, 403)
    result = clients.send_webhook(HOOK, {"event": "scan.completed"}, None, "d7")
    assert (result.error_code, result.retryable) == ("HTTP_403", False)


def test_timeout_is_retryable(monkeypatch) -> None:
    def handler(request):
        raise httpx.ConnectTimeout("timed out", request=request)

    real = httpx.Client
    monkeypatch.setattr(
        httpx, "Client", lambda *a, **k: real(*a, transport=httpx.MockTransport(handler), **k)
    )
    result = clients.send_webhook(HOOK, {"event": "scan.completed"}, None, "d8")
    assert (result.error_code, result.retryable) == ("TARGET_TIMEOUT", True)


def test_slack_posts_to_the_fixed_api_url(monkeypatch) -> None:
    calls = _respond(monkeypatch, 200, {"ok": True, "channel": "C1", "ts": "1"})
    result = clients.send_slack("xoxb-token", "security", "scan finished")
    assert result.ok
    assert str(calls[0].url) == "https://slack.com/api/chat.postMessage"
    assert calls[0].headers["authorization"] == "Bearer xoxb-token"
    assert json.loads(calls[0].content)["channel"] == "security"


def test_slack_logical_failure_is_a_failure(monkeypatch) -> None:
    _respond(monkeypatch, 200, {"ok": False, "error": "channel_not_found"})
    result = clients.send_slack("xoxb-token", "security", "hi")
    assert (result.ok, result.error_code, result.retryable) == (False, "SLACK_CHANNEL_NOT_FOUND", False)


def test_slack_rate_limit_is_retryable(monkeypatch) -> None:
    _respond(monkeypatch, 200, {"ok": False, "error": "rate_limited"})
    assert clients.send_slack("xoxb-token", "security", "hi").retryable is True


def test_slack_unreadable_body_is_not_success(monkeypatch) -> None:
    _respond(monkeypatch, 200, b"<html>proxy error</html>")
    result = clients.send_slack("xoxb-token", "security", "hi")
    assert (result.ok, result.error_code) == (False, "SLACK_MALFORMED_RESPONSE")


def test_slack_incomplete_config_sends_nothing(monkeypatch) -> None:
    calls = _respond(monkeypatch, 200, {"ok": True})
    assert clients.send_slack("", "security", "hi").error_code == "CONFIG_INCOMPLETE"
    assert clients.send_slack("token", "", "hi").error_code == "CONFIG_INCOMPLETE"
    assert calls == []


def test_jira_check_uses_basic_auth(monkeypatch) -> None:
    calls = _respond(monkeypatch, 200, {"displayName": "Vulnix"})
    result = clients.check_jira("https://acme.atlassian.net/", "bot@acme.example", "token123")
    assert result.ok
    assert str(calls[0].url) == "https://acme.atlassian.net/rest/api/3/myself"
    expected = base64.b64encode(b"bot@acme.example:token123").decode()
    assert calls[0].headers["authorization"] == f"Basic {expected}"


def test_jira_issue_create_returns_the_key(monkeypatch) -> None:
    calls = _respond(monkeypatch, 201, {"key": "SEC-42"})
    result = clients.create_jira_issue(
        "https://acme.atlassian.net",
        "bot@acme.example",
        "token123",
        "SEC",
        "scan finished",
        "details",
        issue_type="Bug",
        priority="High",
    )
    assert result.ok and result.body == {"issue_key": "SEC-42"}
    fields = json.loads(calls[0].content)["fields"]
    assert fields["issuetype"] == {"name": "Bug"}
    assert fields["priority"] == {"name": "High"}
    assert fields["project"] == {"key": "SEC"}
    assert str(calls[0].url) == "https://acme.atlassian.net/rest/api/3/issue"


def test_jira_missing_config_sends_nothing(monkeypatch) -> None:
    calls = _respond(monkeypatch, 200)
    assert clients.check_jira("", "a@b.example", "token").error_code == "CONFIG_INCOMPLETE"
    assert clients.create_jira_issue("https://a.example", "a@b.example", "t", "", "s", "d").ok is False
    assert calls == []
