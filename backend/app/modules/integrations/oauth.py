"""Consent-window flows: GitHub, Slack and Jira.

A workspace admin clicks Connect, approves in the provider's own window, and the
provider sends us an authorization code at a fixed redirect URI. Nothing in this
module ever shows a token to the console, and no client-supplied value decides
where a callback goes: the redirect URIs, scopes and token endpoints are all
compiled in, and the app credentials come from the environment.

State is a signed, expiring link rather than a server-side session, so a
multi-worker deployment still recognises it. The trade-off is recorded in
ADR-010: single use is best-effort (an in-process spent nonce set), bounded by a
short TTL.
"""

import base64
import hashlib
import hmac
import json
import logging
import re
import secrets
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import httpx
import jwt

from app.core.config import settings
from app.core.egress import assert_egress_allowed
from app.core.errors import AppError

logger = logging.getLogger("vulnix.oauth")

_SPENT_NONCES: set[str] = set()
_SPENT_NONCES_MAX = 512


@dataclass(frozen=True)
class OAuthApp:
    provider: str
    authorize_url: str
    token_url: str
    scopes: tuple[str, ...]
    # A Slack bot install answers with the token directly; Jira and GitHub need
    # a second call to learn who consented.
    identity_url: str | None
    extra_authorize_params: dict[str, str] = field(default_factory=dict)
    # "client_secret_post" sends credentials in the body, "basic" in a header.
    token_endpoint_auth: str = "client_secret_post"


OAUTH_APPS: dict[str, OAuthApp] = {
    "github": OAuthApp(
        provider="github",
        authorize_url="https://github.com/login/oauth/authorize",
        token_url="https://github.com/login/oauth/access_token",
        # A GitHub App is not granted anything by a scope in this URL - the
        # permissions (Contents, Metadata, Pull requests) are declared on the app
        # itself and a user consent only picks which accounts they apply to.
        # Sending 'repo' makes GitHub answer with redirect_uri_mismatch-style
        # warnings on the consent page, so the list stays empty.
        scopes=(),
        identity_url="https://api.github.com/user",
    ),
    "slack": OAuthApp(
        provider="slack",
        authorize_url="https://slack.com/oauth/v2/authorize",
        token_url="https://slack.com/api/oauth.v2.access",
        # Post to one channel, list channels to post to. No 'chat:write.public'
        # because a workspace picks the channel from the list it can see.
        scopes=("chat:write", "channels:read"),
        identity_url=None,
        # The token in the response is a bot token bound to the team in
        # team_id/team_name, so no second call is needed.
    ),
    "jira": OAuthApp(
        provider="jira",
        authorize_url="https://auth.atlassian.com/authorize",
        token_url="https://auth.atlassian.com/oauth/token",
        scopes=(
            "read:jira-user",
            "read:jira-work",
            "write:jira-work",
            "offline_access",
        ),
        identity_url="https://api.atlassian.com/oauth/token/accessible-resources",
        extra_authorize_params={"audience": "api.atlassian.com", "prompt": "consent"},
        token_endpoint_auth="basic",
    ),
}

# Fixed, compiled-in hosts for the resource reads this module performs. A client
# never supplies a URL here.
GITHUB_INSTALLATION_ACCESS_URL = "https://api.github.com/app/installations/{installation_id}/access_tokens"
GITHUB_INSTALLATION_REPOSITORIES_URL = "https://api.github.com/installation/repositories"
GITHUB_REPOSITORY_BY_ID_URL = "https://api.github.com/repositories/{repository_id}"
GITHUB_ARCHIVE_URL = "https://api.github.com/repos/{repo}/zipball/{ref}"
SLACK_CONVERSATIONS_URL = "https://slack.com/api/conversations.list"
JIRA_PROJECTS_PATH = "/rest/api/3/project/search"

_REPO_PAGE = 100


class OAuthConfigError(AppError):
    def __init__(self, code: str, message: str, status_code: int = 409) -> None:
        super().__init__(code, message, status_code)


def app_for(provider: str) -> OAuthApp:
    app = OAUTH_APPS.get(provider)
    if app is None:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    return app


def credentials(provider: str) -> tuple[str, str]:
    client_id, client_secret = settings.oauth_app(provider)
    if not (client_id and client_secret):
        raise OAuthConfigError(
            "OAUTH_APP_NOT_CONFIGURED",
            "This provider's OAuth app is not configured on this server.",
            412,
        )
    return client_id, client_secret


def redirect_uri(provider: str) -> str:
    base = settings.oauth_redirect_base_url.rstrip("/")
    if not base:
        raise OAuthConfigError(
            "OAUTH_REDIRECT_NOT_CONFIGURED",
            "The public callback address is not configured on this server.",
            412,
        )
    return f"{base}{settings.api_v1_prefix}/integrations/oauth/{provider}/callback"


def _sign(payload: bytes) -> str:
    key = settings.integration_secret_key.encode("utf-8")
    return base64.urlsafe_b64encode(hmac.new(key, payload, hashlib.sha256).digest()).decode("ascii")


def make_state(provider: str, workspace_id: str, user_id: str) -> str:
    """A signed link that says who consented, to what, and until when."""
    nonce = secrets.token_urlsafe(16)
    body = json.dumps(
        {
            "p": provider,
            "w": workspace_id,
            "u": user_id,
            "n": nonce,
            "e": int(time.time()) + settings.oauth_state_ttl_seconds,
        },
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode("utf-8")
    encoded = base64.urlsafe_b64encode(body).decode("ascii").rstrip("=")
    return f"{encoded}.{_sign(encoded.encode('ascii'))}"


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    try:
        return base64.urlsafe_b64decode(value + padding)
    except (ValueError, TypeError):
        raise AppError("OAUTH_STATE_INVALID", "This sign-in link is not valid.", 400) from None


def read_state(state: str) -> dict:
    """Verify signature, expiry and single use. Never trusts an unsigned field."""
    encoded, _, signature = (state or "").partition(".")
    if not encoded or not signature:
        raise AppError("OAUTH_STATE_INVALID", "This sign-in link is not valid.", 400)
    expected = _sign(encoded.encode("ascii"))
    if not hmac.compare_digest(signature, expected):
        raise AppError("OAUTH_STATE_INVALID", "This sign-in link is not valid.", 400)

    try:
        payload = json.loads(_b64decode(encoded))
    except (ValueError, UnicodeDecodeError):
        raise AppError("OAUTH_STATE_INVALID", "This sign-in link is not valid.", 400) from None

    expires = payload.get("e")
    nonce = str(payload.get("n") or "")
    provider = str(payload.get("p") or "")
    if not isinstance(expires, int) or not nonce or provider not in OAUTH_APPS:
        raise AppError("OAUTH_STATE_INVALID", "This sign-in link is not valid.", 400)
    if expires < int(time.time()):
        raise AppError("OAUTH_STATE_EXPIRED", "That approval link expired. Start again.", 400)
    # Best-effort replay guard: a spent nonce is refused for as long as this
    # process lives, which is what bounds a second use of the same link.
    if nonce in _SPENT_NONCES:
        raise AppError("OAUTH_STATE_INVALID", "This sign-in link has already been used.", 400)
    if len(_SPENT_NONCES) >= _SPENT_NONCES_MAX:
        _SPENT_NONCES.clear()
    _SPENT_NONCES.add(nonce)
    return payload


def reset_spent_nonces() -> None:
    """Test hook: the spent-nonce guard is process state."""
    _SPENT_NONCES.clear()


def authorize_url(provider: str, state: str) -> str:
    app = app_for(provider)
    client_id, _ = credentials(provider)
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri(provider),
        "state": state,
        **app.extra_authorize_params,
    }
    if app.scopes:
        # An empty scope list is omitted rather than sent blank: GitHub reads a
        # blank 'scope' as a malformed request, and a GitHub App takes its
        # permissions from its own settings instead.
        params["scope"] = " ".join(app.scopes)
    return f"{app.authorize_url}?{urlencode(params)}"


def github_install_url(state: str) -> str:
    """Start GitHub's repository-scoped App installation flow."""
    slug = settings.github_app_slug.strip()
    if not settings.github_app_ready or not re.fullmatch(r"[A-Za-z0-9-]{1,100}", slug):
        raise OAuthConfigError(
            "GITHUB_APP_NOT_CONFIGURED",
            "The GitHub App installation is not configured on this server.",
            412,
        )
    return f"https://github.com/apps/{slug}/installations/new?{urlencode({'state': state})}"


def github_app_jwt() -> str:
    """Sign a short-lived GitHub App JWT without exposing the private key."""
    if not settings.github_app_ready:
        raise OAuthConfigError(
            "GITHUB_APP_NOT_CONFIGURED",
            "The GitHub App installation is not configured on this server.",
            412,
        )
    try:
        app_id = int(settings.github_app_id)
    except ValueError:
        raise OAuthConfigError("GITHUB_APP_NOT_CONFIGURED", "The GitHub App ID is invalid.", 412) from None
    private_key = settings.github_app_private_key.replace("\\n", "\n")
    now = int(time.time())
    return jwt.encode(
        {"iat": now - 60, "exp": now + 540, "iss": str(app_id)},
        private_key,
        algorithm="RS256",
    )


def github_installation_token(installation_id: int) -> dict:
    """Mint a short-lived repository token for one GitHub App installation."""
    if installation_id < 1:
        raise AppError("GITHUB_INSTALLATION_INVALID", "The GitHub installation is invalid.", 400)
    url = GITHUB_INSTALLATION_ACCESS_URL.format(installation_id=installation_id)
    headers = {
        "accept": "application/vnd.github+json",
        "authorization": f"Bearer {github_app_jwt()}",
        "user-agent": "Vulnix-Integrations/1",
        "x-github-api-version": "2022-11-28",
    }
    try:
        with httpx.Client(
            timeout=settings.integration_timeout_seconds * 2,
            follow_redirects=False,
            trust_env=False,
        ) as client:
            response = client.post(assert_egress_allowed(url), headers=headers, json={})
    except httpx.TimeoutException:
        raise AppError("OAUTH_TIMEOUT", "GitHub did not answer the installation request.", 502) from None
    except httpx.HTTPError:
        raise AppError("OAUTH_UNREACHABLE", "GitHub could not be reached.", 502) from None

    if response.status_code >= 400:
        logger.warning("github_installation_token_failed status=%s", response.status_code)
        raise AppError(
            "GITHUB_INSTALLATION_UNAVAILABLE",
            "GitHub could not verify this app installation. Reinstall the GitHub App and try again.",
            409,
        )
    try:
        payload = response.json()
        expires_at = datetime.fromisoformat(str(payload.get("expires_at", "")).replace("Z", "+00:00"))
        access_token = str(payload.get("token") or "")
    except (ValueError, AttributeError, TypeError):
        raise AppError(
            "OAUTH_BAD_RESPONSE", "GitHub returned an unreadable installation token.", 502
        ) from None
    if not access_token:
        raise AppError("OAUTH_BAD_RESPONSE", "GitHub did not return an installation token.", 502)

    installation = get_json(
        f"https://api.github.com/app/installations/{installation_id}",
        github_app_jwt(),
        provider="github",
    )
    account = installation.get("account") if isinstance(installation, dict) else {}
    account_label = (
        str(account.get("login") or "GitHub installation")
        if isinstance(account, dict)
        else "GitHub installation"
    )
    return {
        "access_token": access_token,
        "expires_at": expires_at,
        "account_label": account_label[:160],
        "scope": "",
        "refresh_token": "",
        "details": {"installation_id": installation_id},
    }


def _form_headers(token_endpoint_auth: str, client_id: str, client_secret: str) -> tuple[dict, dict]:
    headers = {
        "accept": "application/json",
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "Vulnix-Integrations/1",
    }
    body: dict[str, str] = {}
    if token_endpoint_auth == "basic":
        import base64 as _b64

        pair = _b64.b64encode(f"{client_id}:{client_secret}".encode()).decode("ascii")
        headers["authorization"] = f"Basic {pair}"
    else:
        body["client_id"] = client_id
        body["client_secret"] = client_secret
    return headers, body


def _post(url: str, data: dict, headers: dict) -> dict:
    """One guarded, short, redirect-free POST that returns a parsed JSON body."""
    safe_url = assert_egress_allowed(url)
    try:
        with httpx.Client(
            timeout=settings.integration_timeout_seconds * 2,
            follow_redirects=False,
            trust_env=False,
        ) as client:
            response = client.post(safe_url, data=data, headers=headers)
    except httpx.TimeoutException:
        raise AppError("OAUTH_TIMEOUT", "The identity provider did not answer.", 502) from None
    except httpx.HTTPError:
        # Exception text can contain the URL or the credential; never persist it.
        raise AppError("OAUTH_UNREACHABLE", "The identity provider could not be reached.", 502) from None

    if response.status_code >= 400:
        logger.warning("oauth_token_failed provider_status=%s", response.status_code)
        raise AppError("OAUTH_REJECTED", "The provider refused this approval.", 400)
    try:
        payload = response.json()
    except ValueError:
        raise AppError("OAUTH_BAD_RESPONSE", "The provider did not return a token.", 502) from None
    if not isinstance(payload, dict):
        raise AppError("OAUTH_BAD_RESPONSE", "The provider did not return a token.", 502)
    # Slack answers 200 with ok=false, so a body-level failure is a failure.
    if payload.get("ok") is False:
        logger.warning("oauth_provider_error error=%s", str(payload.get("error"))[:40])
        raise AppError("OAUTH_REJECTED", "The provider refused this approval.", 400)
    return payload


def _aware(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(UTC)
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def is_expired(expires_at: datetime | None, skew_seconds: int = 120) -> bool:
    """True when a token needs renewing. Tokens without an expiry never do."""
    if expires_at is None:
        return False
    return _aware(expires_at) - timedelta(seconds=skew_seconds) <= datetime.now(UTC)


def exchange_code(provider: str, code: str, redirect: str | None = None) -> dict:
    """Trade a single-use authorization code for tokens. Server-side only."""
    app = app_for(provider)
    client_id, client_secret = credentials(provider)
    headers, body = _form_headers(app.token_endpoint_auth, client_id, client_secret)
    body.update(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect or redirect_uri(provider),
        }
    )
    if provider == "github":
        # GitHub answers form-encoded unless the request asks for JSON.
        headers["accept"] = "application/json"
    payload = _post(app.token_url, body, headers)
    return _normalize_tokens(provider, payload)


def refresh_tokens(provider: str, refresh_token: str) -> dict:
    app = app_for(provider)
    client_id, client_secret = credentials(provider)
    headers, body = _form_headers(app.token_endpoint_auth, client_id, client_secret)
    body.update({"grant_type": "refresh_token", "refresh_token": refresh_token})
    payload = _post(app.token_url, body, headers)
    return _normalize_tokens(provider, payload)


def _normalize_tokens(provider: str, payload: dict) -> dict:
    access = str(payload.get("access_token") or "")
    if not access:
        raise AppError("OAUTH_BAD_RESPONSE", "The provider did not return a token.", 502)

    # Slack's bot token arrives nested under bot_id/user_id, and its team is the
    # account label. Jira and GitHub put the identity in a separate call.
    label = ""
    details: dict[str, object] = {}
    if provider == "slack":
        label = str(payload.get("team_name") or payload.get("team_id") or "Slack workspace")
        details = {
            "team_id": str(payload.get("team_id") or "")[:64],
            "bot_user_id": str(payload.get("bot_user_id") or "")[:64],
        }
    elif provider == "github":
        label = "GitHub account"
    else:
        label = "Atlassian account"

    expires_in = payload.get("expires_in")
    expires_at = None
    if isinstance(expires_in, (int, float)) and expires_in > 0:
        expires_at = datetime.now(UTC) + timedelta(seconds=float(expires_in))

    return {
        "access_token": access,
        # Jira rotates the refresh token on every refresh; a missing one means
        # "keep the previous", which the caller handles. GitHub Apps rotate too,
        # and their user tokens live eight hours - so this field is what keeps a
        # connection alive overnight instead of demanding a fresh consent.
        "refresh_token": str(payload.get("refresh_token") or ""),
        # Only what the provider actually granted. Inventing a scope it never
        # returned would tell an admin the connection can do something it cannot.
        "scope": str(payload.get("scope") or "")[:512],
        "expires_at": expires_at,
        "account_label": label[:160],
        "details": details,
    }


def get_json(url: str, access_token: str, *, provider: str, params: dict | None = None) -> object:
    """Read a provider resource with the workspace's own token."""
    headers = {
        "accept": "application/json",
        "authorization": f"Bearer {access_token}",
        "user-agent": "Vulnix-Integrations/1",
    }
    if provider == "github":
        # Required by the REST API; without it the call is answered 403.
        headers["x-github-api-version"] = "2022-11-28"
    safe_url = assert_egress_allowed(url)
    try:
        with httpx.Client(
            timeout=settings.integration_timeout_seconds * 2,
            follow_redirects=False,
            trust_env=False,
        ) as client:
            response = client.get(safe_url, headers=headers, params=params)
    except httpx.TimeoutException:
        raise AppError("OAUTH_TIMEOUT", "The identity provider did not answer.", 502) from None
    except httpx.HTTPError:
        raise AppError("OAUTH_UNREACHABLE", "The identity provider could not be reached.", 502) from None

    if response.status_code == 401:
        raise AppError("OAUTH_TOKEN_REVOKED", "The connection was revoked at the provider.", 401)
    if response.status_code >= 400:
        logger.warning("oauth_resource_failed status=%s", response.status_code)
        raise AppError("OAUTH_RESOURCE_UNAVAILABLE", "The provider could not answer this request.", 502)
    try:
        return response.json()
    except ValueError:
        raise AppError("OAUTH_BAD_RESPONSE", "The provider returned an unreadable response.", 502) from None


def _text(value: object, limit: int) -> str:
    # Provider fields are untrusted: a repository description is somebody's text.
    return str(value if value is not None else "")[:limit]


def github_identity(access_token: str) -> dict:
    body = get_json("https://api.github.com/user", access_token, provider="github")
    payload = body if isinstance(body, dict) else {}
    return {"account_label": _text(payload.get("login"), 80) or "GitHub account"}


def jira_sites(access_token: str) -> list[dict]:
    """Which sites this consent covers, and therefore which host we may call.

    The URLs come from the provider rather than from the console, so a workspace
    cannot aim a Jira write at a host it was never granted.
    """
    body = get_json(
        "https://api.atlassian.com/oauth/token/accessible-resources", access_token, provider="jira"
    )
    sites = []
    for item in body if isinstance(body, list) else []:
        if not isinstance(item, dict):
            continue
        url = _text(item.get("url"), 255)
        if not url.startswith("https://"):
            continue
        sites.append(
            {
                "id": _text(item.get("id"), 64),
                "url": url,
                "name": _text(item.get("name"), 120) or url.split("/")[2],
            }
        )
    return sites[:50]


def jira_projects(access_token: str, site_url: str, site_id: str) -> list[dict]:
    base = site_url.rstrip("/")
    body = get_json(f"{base}{JIRA_PROJECTS_PATH}", access_token, provider="jira",
                    params={"maxResults": 100})
    values = body.get("values") if isinstance(body, dict) else None
    projects = []
    for item in values if isinstance(values, list) else []:
        if not isinstance(item, dict):
            continue
        key = _text(item.get("key"), 32).upper()
        if not key:
            continue
        projects.append(
            {
                "id": _text(item.get("id"), 32),
                "key": key,
                "name": _text(item.get("name"), 120),
                # Stored so a later write can name the site without re-fetching.
                "site_id": site_id[:64],
            }
        )
    return projects[:100]


def slack_channels(access_token: str) -> list[dict]:
    body = get_json(
        SLACK_CONVERSATIONS_URL,
        access_token,
        provider="slack",
        params={"types": "public_channel,private_channel", "limit": 200, "exclude_archived": True},
    )
    values = body.get("channels") if isinstance(body, dict) else None
    channels = []
    for item in values if isinstance(values, list) else []:
        if not isinstance(item, dict):
            continue
        name = _text(item.get("name"), 80)
        if not name:
            continue
        channels.append(
            {
                "id": _text(item.get("id"), 64),
                "name": name,
                "private": bool(item.get("is_private")),
            }
        )
    return channels[:200]


def _github_repo(item: object) -> dict | None:
    if not isinstance(item, dict):
        return None
    repo_id = item.get("id")
    full_name = _text(item.get("full_name"), 200)
    if not isinstance(repo_id, int) or "/" not in full_name:
        return None
    return {
        "id": repo_id,
        "full_name": full_name,
        "private": bool(item.get("private")),
        "default_branch": _text(item.get("default_branch"), 100),
        "description": _text(item.get("description"), 200),
        "pushed_at": _text(item.get("pushed_at"), 32),
    }


def github_repositories(access_token: str, page: int = 1, *, search: str = "") -> list[dict]:
    """List repositories allowed by this installation, most recently pushed first."""
    target = max(page, 1)
    skip = (target - 1) * _REPO_PAGE
    needle = search.strip().casefold()
    found: list[dict] = []
    github_page = 1
    while len(found) < skip + _REPO_PAGE and github_page <= 20:
        body = get_json(
            GITHUB_INSTALLATION_REPOSITORIES_URL,
            access_token,
            provider="github",
            params={"per_page": _REPO_PAGE, "page": github_page},
        )
        values = body.get("repositories") if isinstance(body, dict) else None
        batch = values if isinstance(values, list) else []
        for item in batch:
            repo = _github_repo(item)
            if repo is not None and (
                not needle
                or needle in repo["full_name"].casefold()
                or needle in repo["description"].casefold()
            ):
                found.append(repo)
        if len(batch) < _REPO_PAGE:
            break
        github_page += 1
    return found[skip : skip + _REPO_PAGE]


def github_repository_by_id(access_token: str, repository_id: int) -> dict:
    """Resolve a fetch target through GitHub's installation-scoped access."""
    body = get_json(
        GITHUB_REPOSITORY_BY_ID_URL.format(repository_id=repository_id),
        access_token,
        provider="github",
    )
    repo = _github_repo(body)
    if repo is None:
        raise AppError(
            "GITHUB_REPO_NOT_AVAILABLE",
            "This repository is not available to the GitHub App installation.",
            422,
        )
    return repo


_REPO_NAME = re.compile(r"^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$")
_REF_NAME = re.compile(r"^[A-Za-z0-9._/-]{1,120}$")


class _BodyReader:
    """A file-like view over a streaming response, for the storage layer.

    ``put_stream`` pulls fixed-size chunks and never asks for a position, which
    is exactly what a generator-backed reader can serve.
    """

    def __init__(self, iterator) -> None:
        self._iterator = iterator
        self._buffer = bytearray()
        self._response = None

    def read(self, size: int = -1) -> bytes:
        while size < 0 or len(self._buffer) < size:
            chunk = next(self._iterator, b"")
            if not chunk:
                break
            self._buffer.extend(chunk)
        if size < 0:
            data = bytes(self._buffer)
            self._buffer.clear()
            return data
        data = bytes(self._buffer[:size])
        del self._buffer[:size]
        return data

    def close(self) -> None:
        if self._response is not None:
            self._response.close()


def archive_target(full_name: str, ref: str) -> str:
    """Build the zipball URL for a stored repository.

    Both halves are shape-checked before they are joined, so a repository name or
    ref that came from a client can never add a path segment or a host.
    """
    if not _REPO_NAME.match(full_name or ""):
        raise AppError("GITHUB_REPO_INVALID", "That repository name is not usable.", 422)
    if not _REF_NAME.match(ref or "") or ".." in ref or ref.startswith("-"):
        raise AppError("GITHUB_REF_INVALID", "That branch or tag name is not usable.", 422)
    return GITHUB_ARCHIVE_URL.format(repo=full_name, ref=ref)


@contextmanager
def stream_repo_archive(access_token: str, full_name: str, ref: str):
    """Stream a repository archive, following GitHub's own redirect once.

    The redirect is re-passed through the egress guard rather than followed by
    the client: codeload's address is chosen by GitHub, and a blind
    follow_redirects would let an answer point at an internal host.
    """
    url = archive_target(full_name, ref)
    headers = {
        "accept": "application/vnd.github+json",
        "authorization": f"Bearer {access_token}",
        "user-agent": "Vulnix-Integrations/1",
        "x-github-api-version": "2022-11-28",
    }
    with httpx.Client(
        timeout=settings.integration_fetch_timeout_seconds,
        follow_redirects=False,
        trust_env=False,
    ) as client:
        response = client.send(
            client.build_request("GET", assert_egress_allowed(url), headers=headers), stream=True
        )
        try:
            if response.status_code in (301, 302, 303, 307, 308):
                location = response.headers.get("location", "")
                response.close()
                target = assert_egress_allowed(location)
                redirect_headers = {
                    key: value for key, value in headers.items() if key != "authorization"
                }
                response = client.send(
                    client.build_request("GET", target, headers=redirect_headers), stream=True
                )
            if response.status_code == 401:
                raise AppError("OAUTH_TOKEN_REVOKED", "The connection was revoked at the provider.", 401)
            if response.status_code == 404:
                raise AppError(
                    "GITHUB_REPO_NOT_AVAILABLE", "GitHub has no archive for that repository.", 404
                )
            if response.status_code >= 400:
                logger.warning("github_archive_failed status=%s", response.status_code)
                raise AppError("TARGET_UNREACHABLE", "GitHub could not provide the archive.", 502)
            reader = _BodyReader(response.iter_bytes())
            reader._response = response
            yield reader
        finally:
            response.close()
