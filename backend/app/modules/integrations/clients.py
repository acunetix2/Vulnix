"""Outbound HTTP for integrations - the only module that makes these calls.

Rules that hold for every attempt: the target passes the egress guard, the
timeout is short and fixed, redirects are never followed, the body is capped,
and nothing about the payload, credential or response body is logged.
"""

import base64
import hashlib
import hmac
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings
from app.core.egress import assert_egress_allowed
from app.core.errors import AppError

logger = logging.getLogger("vulnix.integrations")

SLACK_POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage"
JIRA_MYSELF_PATH = "/rest/api/3/myself"
JIRA_ISSUE_PATH = "/rest/api/3/issue"

# Slack rejects a message with HTTP 200 and ok=false, so these codes come from
# a response body we do not trust. They are whitelisted, not echoed.
_SLACK_RETRYABLE = {"rate_limited", "server_error", "service_unavailable", "internal_error"}

_ERROR_SUFFIX = re.compile(r"[^a-z0-9_]+")
_MAX_ERROR_CODE_CHARS = 48


@dataclass(frozen=True)
class SendResult:
    ok: bool
    http_status: int | None = None
    error_code: str | None = None
    retryable: bool = False
    body: Any = None


def _json_bytes(body: dict) -> bytes:
    return json.dumps(body, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def _external_code(prefix: str, raw: object) -> str:
    """Turn an untrusted provider error string into a bounded, safe code."""
    slug = str(raw or "rejected").strip().lower()[:32]
    slug = _ERROR_SUFFIX.sub("_", slug).strip("_")
    return f"{prefix}_{slug or 'rejected'}".upper()[:_MAX_ERROR_CODE_CHARS]


def _request(url: str, content: bytes, headers: dict[str, str]) -> SendResult:
    if len(content) > settings.integration_max_body_bytes:
        return SendResult(ok=False, error_code="PAYLOAD_TOO_LARGE")

    try:
        safe_url = assert_egress_allowed(url)
    except AppError as exc:
        # A blocked or unresolvable target is not retried: the operator has to
        # change the configuration first.
        return SendResult(ok=False, error_code=exc.code)

    try:
        with httpx.Client(
            timeout=settings.integration_timeout_seconds, follow_redirects=False, trust_env=False
        ) as client:
            response = client.post(safe_url, content=content, headers=headers)
    except httpx.TimeoutException:
        return SendResult(ok=False, error_code="TARGET_TIMEOUT", retryable=True)
    except httpx.HTTPError:
        # Exception text can contain the URL; never persist it.
        return SendResult(ok=False, error_code="TARGET_UNREACHABLE", retryable=True)

    status = response.status_code
    if 300 <= status < 400:
        return SendResult(ok=False, http_status=status, error_code="REDIRECT_REFUSED")
    parsed: Any = None
    if len(response.content) <= settings.integration_max_body_bytes:
        try:
            parsed = response.json()
        except ValueError:
            parsed = None
    if status >= 500:
        return SendResult(ok=False, http_status=status, error_code="TARGET_SERVER_ERROR", retryable=True)
    if status >= 400:
        return SendResult(ok=False, http_status=status, error_code=f"HTTP_{status}")

    logger.info("integration_delivered status=%s", status)
    return SendResult(ok=True, http_status=status, body=parsed)


def send_slack(token: str, channel: str, text: str) -> SendResult:
    if not token or not channel:
        return SendResult(ok=False, error_code="CONFIG_INCOMPLETE")
    body = {"channel": channel, "text": text[:3500], "mrkdwn": True, "unfurl_links": False}
    result = _request(
        SLACK_POST_MESSAGE_URL,
        _json_bytes(body),
        {"authorization": f"Bearer {token}", "content-type": "application/json"},
    )
    if not result.ok:
        return result
    payload = result.body if isinstance(result.body, dict) else {}
    if payload.get("ok") is not True:
        # Slack answers 200 for logical failures, and a body we cannot read is
        # not proof that the message arrived.
        raw = payload.get("error") or "malformed_response"
        code = _external_code("SLACK", raw)
        return SendResult(
            ok=False, http_status=result.http_status, error_code=code,
            retryable=str(raw).lower() in _SLACK_RETRYABLE,
        )
    return result


def _jira_headers(email: str, token: str) -> dict[str, str]:
    """Two authorization shapes, decided by what the workspace has.

    A hand-stored API token pairs with the account email as HTTP Basic. An OAuth
    consent already carries the account, so it is a bearer token and the email is
    empty - sending Basic with a blank user would fail in a way that reads like a
    bad password.
    """
    if email:
        credential = base64.b64encode(f"{email}:{token}".encode()).decode("ascii")
        return {"authorization": f"Basic {credential}", "accept": "application/json"}
    return {"authorization": f"Bearer {token}", "accept": "application/json"}


def _jira_content_headers(email: str, token: str) -> dict[str, str]:
    headers = _jira_headers(email, token)
    headers["content-type"] = "application/json"
    return headers


def _jira_url(base_url: str, path: str) -> str:
    return f"{(base_url or '').rstrip('/')}{path}"


def check_jira(base_url: str, email: str, token: str) -> SendResult:
    """Validate credentials against the REST API without creating anything."""
    if not base_url or not token:
        return SendResult(ok=False, error_code="CONFIG_INCOMPLETE")
    return _request(_jira_url(base_url, JIRA_MYSELF_PATH), _json_bytes({}), _jira_headers(email, token))


def create_jira_issue(
    base_url: str,
    email: str,
    token: str,
    project_key: str,
    summary: str,
    description: str,
    *,
    issue_type: str = "Task",
    priority: str | None = None,
    custom_fields: dict | None = None,
) -> SendResult:
    if not base_url or not token or not project_key:
        return SendResult(ok=False, error_code="CONFIG_INCOMPLETE")
    fields: dict[str, Any] = {
        "project": {"key": project_key},
        "summary": summary[:250],
        "description": description[:4000],
        "issuetype": {"name": (issue_type or "Task")[:40]},
    }
    if email:
        # Only a Basic-auth install has an addressable account to name here.
        fields["reporter"] = {"emailAddress": email}
    if priority:
        fields["priority"] = {"name": priority[:40]}
    fields.update(custom_fields or {})

    result = _request(
        _jira_url(base_url, JIRA_ISSUE_PATH),
        _json_bytes({"fields": fields}),
        _jira_content_headers(email, token),
    )
    if not result.ok:
        return result
    payload = result.body if isinstance(result.body, dict) else {}
    key = payload.get("key")
    return SendResult(ok=True, http_status=result.http_status, body={"issue_key": key} if key else {})


def sign_webhook(secret: str, timestamp: int, content: bytes) -> str:
    signed = f"{timestamp}.".encode() + content
    return hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()


def send_webhook(url: str, payload: dict, secret: str | None, delivery_id: str) -> SendResult:
    content = _json_bytes(payload)
    timestamp = int(time.time())
    headers = {
        "content-type": "application/json",
        "user-agent": "Vulnix-Webhooks/1",
        "x-vulnix-delivery": delivery_id,
        "x-vulnix-event": str(payload.get("event") or "unknown")[:64],
        "x-vulnix-timestamp": str(timestamp),
    }
    if secret:
        # Verify with hmac.compare_digest on the receiving side.
        headers["x-vulnix-signature"] = f"v1={sign_webhook(secret, timestamp, content)}"
    return _request(url, content, headers)
