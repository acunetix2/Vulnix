"""Consent-window flows: signed state, the callback, pickers, and a repo import.

Nothing here talks to a real provider. The stubs sit on the seams this feature
has - ``oauth`` for the network, ``clients._request`` for delivery - so what is
being proven is the plumbing around them: what gets stored, who may ask for it,
and which values a client can never supply itself.
"""

import io
import json
import socket
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit

import pytest

from app.core.config import settings
from app.core.crypto import decrypt_secret
from app.core.errors import AppError
from app.db.session import SessionLocal
from app.modules.integrations import clients, connections, oauth

ACCESS = "gho_access_token_abcdef123567890"
REFRESH = "jr_refresh_token_zzz1234567890"
SLACK_BOT = "fixture-slack-token"
REPO = {"id": 2, "full_name": "acme/web", "private": False, "default_branch": "trunk",
        "description": "", "pushed_at": "2026-10-01T00:00:00Z"}


@pytest.fixture(autouse=True)
def _fresh_nonces():
    # The spent-nonce guard is process state; a leaked value would fail a later
    # test with an unrelated "already used" error.
    oauth.reset_spent_nonces()


@pytest.fixture
def public_dns(monkeypatch) -> None:
    """Let the egress guard resolve the compiled-in provider hosts."""

    def fake(host, port=None, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 0, "", ("93.184.216.34", 443))]

    monkeypatch.setattr(socket, "getaddrinfo", fake)


@pytest.fixture
def apps(monkeypatch) -> None:
    """A server with the GitHub App, Slack/Jira OAuth apps and callback origin."""
    for provider, pair in (
        ("github", ("gid", "gsecret")),
        ("slack", ("sid", "ssecret")),
        ("jira", ("jid", "jsecret")),
    ):
        monkeypatch.setattr(settings, f"{provider}_client_id", pair[0])
        monkeypatch.setattr(settings, f"{provider}_client_secret", pair[1])
    monkeypatch.setattr(settings, "oauth_redirect_base_url", "https://vulnix.example.com")
    monkeypatch.setattr(settings, "console_base_url", "https://console.example.com")
    monkeypatch.setattr(settings, "github_app_id", "12345")
    monkeypatch.setattr(settings, "github_app_slug", "vulnix-reviewer")
    monkeypatch.setattr(settings, "github_app_private_key", "configured-test-key")


@pytest.fixture
def enabled(monkeypatch) -> None:
    monkeypatch.setattr(settings, "integrations_enabled", True)


def _workspace(client, login, user_id="owner-1", email="o@example.com", name="Acme"):
    login(user_id, email)
    return client.post("/api/v1/workspaces", json={"name": name}).json()


def _add_member(workspace_id: str, user_id: str, role: str) -> None:
    from app.db.models import WorkspaceMember

    db = SessionLocal()
    db.add(WorkspaceMember(workspace_id=workspace_id, user_id=user_id, role=role))
    db.commit()
    db.close()


def _tokens(**overrides) -> dict:
    base = {
        "access_token": ACCESS,
        "refresh_token": REFRESH,
        "scope": "repo",
        "expires_at": None,
        "account_label": "octocat",
        "details": {},
    }
    return {**base, **overrides}


def _state_of(authorize_url: str) -> str:
    query = urlsplit(authorize_url).query
    return parse_qs(query)["state"][0]


def _connect(client, workspace_id: str, provider: str) -> str:
    resp = client.post(f"/api/v1/workspaces/{workspace_id}/integrations/{provider}/connect")
    assert resp.status_code == 200, resp.json()
    return _state_of(resp.json()["authorize_url"])


def _complete(client, provider: str, state: str, code: str = "code-123"):
    return client.get(
        f"/api/v1/integrations/oauth/{provider}/callback",
        params={"code": code, "state": state},
        follow_redirects=False,
    )


def _complete_install(client, state: str, installation_id: int = 11):
    return client.get(
        "/api/v1/integrations/oauth/github/callback",
        params={"installation_id": installation_id, "setup_action": "install", "state": state},
        follow_redirects=False,
    )


def _load_connection(workspace_id: str, provider: str):
    db = SessionLocal()
    try:
        return connections.get(db, workspace_id, provider)
    finally:
        db.close()


def _store(workspace_id: str, provider: str, **kwargs) -> None:
    db = SessionLocal()
    try:
        connections.store(db, workspace_id=workspace_id, provider=provider,
                          tokens=_tokens(), connected_by="owner-1", **kwargs)
    finally:
        db.close()


def _code_exchange(monkeypatch, **tokens) -> list:
    """Stand in for the token endpoint and record what it was asked for."""
    calls: list = []

    def fake_exchange(provider, code, redirect=None):
        calls.append((provider, code, redirect))
        return _tokens(**tokens)

    monkeypatch.setattr(oauth, "exchange_code", fake_exchange)
    return calls


def test_state_is_signed_and_bound_to_its_provider() -> None:
    payload = oauth.read_state(oauth.make_state("github", "ws-1", "user-1"))
    assert (payload["p"], payload["w"], payload["u"]) == ("github", "ws-1", "user-1")

    encoded, _, signature = oauth.make_state("github", "ws-1", "user-1").partition(".")
    other = oauth.make_state("jira", "ws-2", "user-2").partition(".")[0]
    for tampered in (f"{encoded}.{signature[:-2]}aa", f"{other}.{signature}", "nonsense", f"{encoded}"):
        with pytest.raises(Exception) as exc:
            oauth.read_state(tampered)
        assert exc.value.code == "OAUTH_STATE_INVALID"


def test_state_is_single_use(monkeypatch) -> None:
    state = oauth.make_state("github", "ws-1", "user-1")
    assert oauth.read_state(state)["w"] == "ws-1"
    # Spending the same link twice is the replay this guard exists for.
    with pytest.raises(Exception) as exc:
        oauth.read_state(state)
    assert exc.value.code == "OAUTH_STATE_INVALID"

    monkeypatch.setattr(settings, "oauth_state_ttl_seconds", -60)
    with pytest.raises(Exception) as exc:
        oauth.read_state(oauth.make_state("github", "ws-1", "user-1"))
    assert exc.value.code == "OAUTH_STATE_EXPIRED"


def test_providers_report_why_a_connect_button_is_missing(client, login, monkeypatch) -> None:
    monkeypatch.setattr(settings, "oauth_redirect_base_url", "")
    ws = _workspace(client, login)
    url = f"/api/v1/workspaces/{ws['id']}/integrations/providers"

    rows = {r["provider"]: r for r in client.get(url).json()}
    assert rows["slack"]["oauth_available"] is False
    assert rows["slack"]["reason"] == "OAUTH_APP_NOT_CONFIGURED"
    # Nothing is invented for a provider this server cannot serve.
    assert rows["slack"]["redirect_uri"] == ""

    monkeypatch.setattr(settings, "slack_client_id", "sid")
    monkeypatch.setattr(settings, "slack_client_secret", "ssecret")
    rows = {r["provider"]: r for r in client.get(url).json()}
    assert rows["slack"]["reason"] == "OAUTH_REDIRECT_NOT_CONFIGURED"

    monkeypatch.setattr(settings, "oauth_redirect_base_url", "https://vulnix.example.com")
    rows = {r["provider"]: r for r in client.get(url).json()}
    slack = rows["slack"]
    assert slack["oauth_available"] is True and slack["reason"] == ""
    assert slack["redirect_uri"] == "https://vulnix.example.com/api/v1/integrations/oauth/slack/callback"
    assert slack["scopes"] == ["chat:write", "channels:read"]
    assert slack["connected"] is False


def test_connect_is_admin_only_and_stores_nothing_yet(client, login, apps, monkeypatch) -> None:
    ws = _workspace(client, login)
    login("viewer-1", "v@example.com")
    _add_member(ws["id"], "viewer-1", "viewer")
    connect = f"/api/v1/workspaces/{ws['id']}/integrations/slack/connect"
    assert client.post(connect).status_code == 403

    login("owner-1", "o@example.com")
    body = client.post(connect).json()
    authorize = body["authorize_url"]
    assert authorize.startswith("https://slack.com/oauth/v2/authorize?")
    assert parse_qs(urlsplit(authorize).query)["client_id"] == ["sid"]
    assert _state_of(authorize)
    assert body["redirect_uri"] == "https://vulnix.example.com/api/v1/integrations/oauth/slack/callback"
    # Asking to connect stores nothing: the consent has not happened yet.
    assert _load_connection(ws["id"], "slack") is None

    monkeypatch.setattr(settings, "github_app_private_key", "")
    refused = client.post(f"/api/v1/workspaces/{ws['id']}/integrations/github/connect")
    assert refused.status_code == 412
    assert refused.json()["error"]["code"] == "GITHUB_APP_NOT_CONFIGURED"


def test_callback_stores_sealed_tokens_and_redirects_home(client, login, apps, monkeypatch) -> None:
    ws = _workspace(client, login)
    state = _connect(client, ws["id"], "slack")
    calls = _code_exchange(
        monkeypatch,
        access_token=SLACK_BOT,
        refresh_token="",
        scope="chat:write channels:read",
        account_label="Acme HQ",
        details={"team_id": "T123", "bot_user_id": "B123"},
    )

    resp = _complete(client, "slack", state)
    assert resp.status_code == 302
    assert resp.headers["location"] == "https://console.example.com/app/integrations/slack?connected=1"
    # No redirect is threaded through the callback: ``exchange_code`` falls back to
    # the server's own compiled URI, which is what the provider app must allow.
    assert calls[0] == ("slack", "code-123", None)
    assert oauth.redirect_uri("slack") == (
        "https://vulnix.example.com/api/v1/integrations/oauth/slack/callback"
    )

    row = _load_connection(ws["id"], "slack")
    assert row is not None and row.account_label == "Acme HQ"
    assert row.access_enc != SLACK_BOT and decrypt_secret(row.access_enc) == SLACK_BOT
    assert row.details["team_id"] == "T123"
    assert SLACK_BOT not in json.dumps(dict(row.details))

    listed = client.get(f"/api/v1/workspaces/{ws['id']}/integrations/connections").json()
    assert listed[0]["connected"] is True and listed[0]["account_label"] == "Acme HQ"
    assert SLACK_BOT not in json.dumps(listed)


def test_callback_rejects_a_forged_or_mismatched_state(client, login, apps) -> None:
    ws = _workspace(client, login)
    resp = _complete(client, "slack", "not-a-real-state")
    assert "oauth_error=OAUTH_STATE_INVALID" in resp.headers["location"]

    # GitHub's approval must not be spendable on the Slack callback.
    state = oauth.make_state("github", ws["id"], "owner-1")
    resp = _complete(client, "slack", state)
    assert "oauth_error=OAUTH_STATE_INVALID" in resp.headers["location"]
    assert _load_connection(ws["id"], "slack") is None


def test_github_install_callback_requires_an_installation(client, login, apps) -> None:
    ws = _workspace(client, login)
    state = _connect(client, ws["id"], "github")
    resp = client.get(
        "/api/v1/integrations/oauth/github/callback",
        params={"setup_action": "install", "state": state},
        follow_redirects=False,
    )
    assert "oauth_error=GITHUB_INSTALLATION_MISSING" in resp.headers["location"]
    assert _load_connection(ws["id"], "github") is None


def test_github_install_flow_stores_installation_token(client, login, apps, monkeypatch) -> None:
    ws = _workspace(client, login)
    state = _connect(client, ws["id"], "github")
    monkeypatch.setattr(
        oauth,
        "github_installation_token",
        lambda installation_id: {
            **_tokens(
                access_token=ACCESS,
                refresh_token="",
                expires_at=datetime.now(UTC) + timedelta(hours=1),
            ),
            "account_label": "acme",
            "details": {"installation_id": installation_id},
        },
    )

    resp = _complete_install(client, state, 11)

    assert resp.status_code == 302
    assert resp.headers["location"] == "https://console.example.com/app/integrations/github?connected=1"
    row = _load_connection(ws["id"], "github")
    assert row is not None and row.details["installation_id"] == 11
    assert decrypt_secret(row.access_enc) == ACCESS


def test_expired_connection_is_renewed_silently(client, login, apps, monkeypatch) -> None:
    ws = _workspace(client, login)
    db = SessionLocal()
    try:
        connections.store(
            db,
            workspace_id=ws["id"],
            provider="jira",
            tokens=_tokens(expires_at=datetime.now(UTC) - timedelta(minutes=5)),
            connected_by="owner-1",
        )
        row = connections.get(db, ws["id"], "jira")
        assert row.access_expires_at is not None

        seen = []

        def fake_refresh(provider, refresh_token):
            seen.append((provider, refresh_token))
            return _tokens(access_token="fresh-token-value-999", refresh_token="rotated-refresh-999")

        monkeypatch.setattr(oauth, "refresh_tokens", fake_refresh)
        assert connections.access_token(db, row) == "fresh-token-value-999"
        assert seen == [("jira", REFRESH)]

        renewed = connections.get(db, ws["id"], "jira")
        assert decrypt_secret(renewed.access_enc) == "fresh-token-value-999"
        # Jira rotates on every refresh, so the new pair has to replace the old.
        assert decrypt_secret(renewed.refresh_enc) == "rotated-refresh-999"
        assert not oauth.is_expired(renewed.access_expires_at)
    finally:
        db.close()


def test_a_connection_without_a_refresh_token_asks_to_be_redone(client, login, apps) -> None:
    ws = _workspace(client, login)
    _store(ws["id"], "github")
    db = SessionLocal()
    try:
        row = connections.get(db, ws["id"], "github")
        row.access_expires_at = datetime.now(UTC) - timedelta(minutes=1)
        row.refresh_enc = None
        db.commit()
        with pytest.raises(Exception) as exc:
            connections.access_token(db, row)
        assert exc.value.code == "OAUTH_CONNECTION_EXPIRED"
    finally:
        db.close()


def test_disconnect_clears_a_pasted_secret(client, login, apps, enabled, monkeypatch) -> None:
    ws = _workspace(client, login)
    state = _connect(client, ws["id"], "slack")
    monkeypatch.setattr(oauth, "exchange_code", lambda p, c, redirect=None: _tokens(access_token=SLACK_BOT))
    _complete(client, "slack", state)

    client.put(
        f"/api/v1/workspaces/{ws['id']}/integrations/slack",
        json={"channel": "security", "secret": "fixture-slack-token"},
    )
    assert client.get(f"/api/v1/workspaces/{ws['id']}/integrations/slack").json()["configured"] is True

    gone = client.delete(f"/api/v1/workspaces/{ws['id']}/integrations/slack/connection")
    assert gone.status_code == 204
    out = client.get(f"/api/v1/workspaces/{ws['id']}/integrations/slack").json()
    # A revoked consent must not keep delivering through a leftover hand-pasted token.
    assert out["configured"] is False and out["connected"] is False
    assert _load_connection(ws["id"], "slack") is None


def test_a_consent_alone_makes_deliveries_work(client, login, apps, enabled, public_dns, monkeypatch) -> None:
    ws = _workspace(client, login)
    state = _connect(client, ws["id"], "slack")
    monkeypatch.setattr(oauth, "exchange_code", lambda p, c, redirect=None: _tokens(access_token=SLACK_BOT))
    _complete(client, "slack", state)

    calls = []

    def fake(url, content, headers):
        calls.append(dict(headers))
        return clients.SendResult(ok=True, http_status=200, body={"ok": True})

    monkeypatch.setattr(clients, "_request", fake)
    # Choosing a channel needs no secret at all, because the consent is the token.
    saved = client.put(
        f"/api/v1/workspaces/{ws['id']}/integrations/slack", json={"channel": "security"}
    ).json()
    assert saved["configured"] is True and saved["connected"] is True
    assert client.post(f"/api/v1/workspaces/{ws['id']}/integrations/slack/test").json()["ok"] is True
    assert calls[0]["authorization"] == f"Bearer {SLACK_BOT}"


def test_jira_setup_only_offers_granted_sites(client, login, apps, monkeypatch) -> None:
    ws = _workspace(client, login)
    _store(ws["id"], "jira", details={"sites": [
        {"id": "site-1", "url": "https://acme.atlassian.net", "name": "Acme"}]})

    asked = []
    monkeypatch.setattr(oauth, "jira_sites", lambda token: [
        {"id": "site-1", "url": "https://acme.atlassian.net", "name": "Acme"}])
    monkeypatch.setattr(oauth, "jira_projects", lambda token, site_url, site_id: (
        asked.append(site_url) or [{"id": "1", "key": "SEC", "name": "Security", "site_id": site_id}]))

    base = f"/api/v1/workspaces/{ws['id']}/integrations/jira/setup"
    out = client.get(base).json()
    assert [s["id"] for s in out["sites"]] == ["site-1"] and out["projects"] == []

    picked = client.get(base, params={"site_id": "site-1"}).json()
    assert picked["projects"][0]["key"] == "SEC"
    # The host used for the call is the provider's own, not something a query set.
    assert asked == ["https://acme.atlassian.net"]

    refused = client.get(base, params={"site_id": "site-9"})
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "JIRA_SITE_NOT_GRANTED"

    assert client.get(f"/api/v1/workspaces/{ws['id']}/integrations/slack/channels").status_code == 409


def test_github_installation_repositories_are_automatically_available(
    client, login, apps, monkeypatch
) -> None:
    ws = _workspace(client, login)
    _store(ws["id"], "github")
    listing = [REPO, {**REPO, "id": 1, "full_name": "acme/api", "private": True}]
    monkeypatch.setattr(
        oauth,
        "github_repositories",
        lambda token, page=1, *, search="": listing if page == 1 else [],
    )

    base = f"/api/v1/workspaces/{ws['id']}/integrations/github/repositories"
    page = client.get(base).json()
    assert [r["id"] for r in page["repositories"]] == [2, 1]
    assert [r["id"] for r in page["selected"]] == [2, 1]
    assert all(repo["selected"] for repo in page["repositories"])
    assert page["truncated"] is False


def test_github_repository_search_checks_later_provider_pages(monkeypatch) -> None:
    requested_pages = []
    unrelated = [
        {**REPO, "id": repo_id, "full_name": f"acme/other-{repo_id}"}
        for repo_id in range(100)
    ]

    def fake_get(url, token, *, provider, params=None):
        page = (params or {}).get("page", 1)
        requested_pages.append(page)
        if page == 1:
            return {"repositories": unrelated}
        if page == 2:
            return {"repositories": [REPO]}
        return {"repositories": []}

    monkeypatch.setattr(oauth, "get_json", fake_get)

    matches = oauth.github_repositories(ACCESS, search="acme/web")

    assert [repo["full_name"] for repo in matches] == ["acme/web"]
    assert requested_pages == [1, 2]


def test_github_repository_search_includes_repositories_beyond_first_page(
    client, login, apps, monkeypatch
) -> None:
    ws = _workspace(client, login)
    _store(ws["id"], "github")
    seen = []

    def listing(token, page=1, *, search=""):
        seen.append((page, search))
        return [REPO] if search == "acme/web" else []

    monkeypatch.setattr(oauth, "github_repositories", listing)
    base = f"/api/v1/workspaces/{ws['id']}/integrations/github/repositories"

    result = client.get(base, params={"page": 2, "search": "acme/web"}).json()

    assert [repo["full_name"] for repo in result["repositories"]] == ["acme/web"]
    assert seen == [(2, "acme/web")]


def test_github_import_lands_in_the_same_quarantine(
    client, login, apps, monkeypatch, make_zip, fake_scanner
) -> None:
    ws = _workspace(client, login)
    login("owner-1", "o@example.com")
    proj = client.post(f"/api/v1/workspaces/{ws['id']}/projects", json={"name": "Imported API"}).json()
    _store(ws["id"], "github", details={"repos": [REPO]})
    seen = []
    monkeypatch.setattr(oauth, "github_repository_by_id", lambda token, repo_id: REPO)

    @contextmanager
    def fake_archive(token, full_name, ref):
        seen.append((token, full_name, ref))
        yield io.BytesIO(make_zip({"web/index.js": b"console.log(1)\n"}))

    monkeypatch.setattr(oauth, "stream_repo_archive", fake_archive)
    resp = client.post(f"/api/v1/projects/{proj['id']}/uploads/github", json={"repo_id": 2})
    assert resp.status_code == 201, resp.json()
    upload = resp.json()
    # It arrives as an ordinary quarantined upload, so the existing scan path is
    # all a repository import ever needs.
    assert upload["status"] == "quarantined" and upload["size_bytes"] > 0
    assert upload["original_filename"] == "web_trunk.zip"
    # The credential is the decrypted consent; the target came from the allowlist.
    assert seen == [(ACCESS, "acme/web", "trunk")]

    scan = client.post(f"/api/v1/projects/{proj['id']}/scans", json={"upload_id": upload["id"]})
    assert scan.status_code == 202, scan.json()
    # The archive went through the real pipeline, which is the whole point of
    # reusing the upload row instead of adding a second scan path.
    assert scan.json()["status"] in {"completed", "completed_with_errors"}
    assert client.get(f"/api/v1/scans/{scan.json()['id']}/findings").json()["items"]


def test_github_import_refuses_a_repository_outside_the_installation(
    client, login, apps, monkeypatch
) -> None:
    ws = _workspace(client, login)
    login("owner-1", "o@example.com")
    proj = client.post(f"/api/v1/workspaces/{ws['id']}/projects", json={"name": "P"}).json()

    def explode(*args, **kwargs):
        raise AssertionError("no archive may be fetched for an ungranted repository")

    monkeypatch.setattr(oauth, "stream_repo_archive", explode)
    def unavailable_repository(token, repo_id):
        if repo_id == 77:
            raise AppError("GITHUB_REPO_NOT_AVAILABLE", "Unavailable.", 422)
        return REPO

    monkeypatch.setattr(oauth, "github_repository_by_id", unavailable_repository)
    resp = client.post(f"/api/v1/projects/{proj['id']}/uploads/github", json={"repo_id": 2})
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "OAUTH_NOT_CONNECTED"

    _store(ws["id"], "github", details={"repos": [REPO]})
    refused = client.post(f"/api/v1/projects/{proj['id']}/uploads/github", json={"repo_id": 77})
    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "GITHUB_REPO_NOT_AVAILABLE"
    # Only a repository id is accepted here; there is no URL a caller can point
    # at, and a ref that would break the path is refused before a connection.
    bad_ref = client.post(
        f"/api/v1/projects/{proj['id']}/uploads/github",
        json={"repo_id": 2, "ref": "../../etc/passwd"},
    )
    assert bad_ref.status_code == 422
    assert bad_ref.json()["error"]["code"] == "GITHUB_REF_INVALID"


def test_archive_target_rejects_a_path_shaped_ref() -> None:
    assert oauth.archive_target("acme/web", "main") == "https://api.github.com/repos/acme/web/zipball/main"
    for bad_name in ("acme/web/extra", "https://evil.example/acme/web", "", "a" * 101 + "/b"):
        with pytest.raises(Exception) as exc:
            oauth.archive_target(bad_name, "main")
        assert exc.value.code == "GITHUB_REPO_INVALID"
    for bad_ref in ("../../etc/passwd", "-oProxyCommand=x", "main; rm -rf /", "a" * 121, ""):
        with pytest.raises(Exception) as exc:
            oauth.archive_target("acme/web", bad_ref)
        assert exc.value.code == "GITHUB_REF_INVALID"


def test_github_archive_uses_json_media_type_and_drops_auth_on_redirect(monkeypatch) -> None:
    requests = []

    class FakeResponse:
        def __init__(self, status_code, headers=None):
            self.status_code = status_code
            self.headers = headers or {}

        def close(self):
            pass

        def iter_bytes(self):
            yield b"archive"

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def build_request(self, method, url, *, headers):
            return method, url, headers

        def send(self, request, *, stream):
            requests.append(request)
            if len(requests) == 1:
                return FakeResponse(
                    302,
                    {"location": "https://codeload.github.com/acme/web/legacy.zip/refs/heads/main"},
                )
            return FakeResponse(200)

    monkeypatch.setattr(oauth, "assert_egress_allowed", lambda url: url)
    monkeypatch.setattr(oauth.httpx, "Client", FakeClient)

    with oauth.stream_repo_archive(ACCESS, "acme/web", "main") as archive:
        assert archive.read() == b"archive"

    assert requests[0][2]["accept"] == "application/vnd.github+json"
    assert "authorization" in requests[0][2]
    assert "authorization" not in requests[1][2]


def test_webhook_secret_is_generated_once_and_rotatable(client, login, enabled) -> None:
    ws = _workspace(client, login)
    base = f"/api/v1/workspaces/{ws['id']}/webhooks"
    created = client.post(
        base, json={"name": "Desk", "url": "https://desk.example.com/hook", "events": ["scan.completed"]}
    )
    assert created.status_code == 201
    hook = created.json()
    # Nobody pastes a signing secret any more: Vulnix makes it and shows it once.
    assert hook["secret"].startswith("whsec_") and hook["configured"] is True
    generated = hook["secret"]

    listed = client.get(base).json()[0]
    assert "secret" not in listed and listed["configured"] is True
    assert generated not in json.dumps(listed)

    rotated = client.post(f"{base}/{hook['id']}/rotate-secret").json()
    assert rotated["secret"].startswith("whsec_") and rotated["secret"] != generated
    assert generated not in json.dumps(client.get(base).json())

    # A receiver that already minted its own key can still supply it.
    kept = client.post(
        base,
        json={"name": "Own key", "url": "https://desk.example.com/2", "events": ["*"],
              "secret": "whsec_their_own_value"},
    ).json()
    assert kept["secret"] == "whsec_their_own_value"


def test_consent_works_while_egress_is_off(client, login, monkeypatch) -> None:
    """Integrations stay disabled; clicking Connect must still be possible.

    Nothing leaves the process until the provider calls back, and the callback
    stores a token rather than sending one, so the egress switch cannot make the
    consent window unusable.
    """
    assert settings.integrations_enabled is False
    monkeypatch.setattr(settings, "oauth_redirect_base_url", "https://vulnix.example.com")
    monkeypatch.setattr(settings, "github_app_id", "12345")
    monkeypatch.setattr(settings, "github_app_slug", "vulnix-reviewer")
    monkeypatch.setattr(settings, "github_app_private_key", "configured-test-key")
    ws = _workspace(client, login)
    resp = client.post(f"/api/v1/workspaces/{ws['id']}/integrations/github/connect")
    assert resp.status_code == 200
    # Nothing is advertised for GitHub: a GitHub App's permissions live in its own
    # settings, and claiming a scope here would claim an access we were not given.
    assert resp.json()["scopes"] == []


def test_github_consent_uses_the_signed_app_install_url(apps) -> None:
    url = oauth.github_install_url("signed-state")
    assert url == "https://github.com/apps/vulnix-reviewer/installations/new?state=signed-state"
    # Slack and Jira still consent to scopes, so the omission is per app.
    assert parse_qs(urlsplit(oauth.authorize_url("slack", "state-2")).query)["scope"] == [
        "chat:write channels:read"
    ]


def test_github_app_jwt_uses_string_issuer(apps, monkeypatch) -> None:
    captured = {}

    def fake_encode(claims, private_key, algorithm):
        captured.update(claims)
        assert private_key == "configured-test-key"
        assert algorithm == "RS256"
        return "signed-app-jwt"

    monkeypatch.setattr(oauth.jwt, "encode", fake_encode)

    assert oauth.github_app_jwt() == "signed-app-jwt"
    assert captured["iss"] == "12345"
    assert isinstance(captured["iss"], str)
