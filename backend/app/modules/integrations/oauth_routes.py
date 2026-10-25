"""Consent-window endpoints: connect, callback, disconnect, and the pickers.

These routes are separated from the configuration routes because their failure
modes differ: a bad token exchange is the provider's doing, and a callback has
no authenticated caller at all - the signed state is the only authority it has.
"""

import logging

from fastapi import APIRouter, Query, Request, status
from fastapi.responses import RedirectResponse

from app.api.dependencies import CurrentUser, DbSession
from app.core.config import settings
from app.core.errors import AppError
from app.core.rate_limit import check_rate_limit
from app.core.security import require_role
from app.db.models import OAuthConnection
from app.modules.audit.service import record_event
from app.modules.integrations import connections, oauth, service
from app.schemas.oauth import (
    ConnectionOut,
    ConnectOut,
    GitHubRepository,
    JiraProject,
    JiraSetupOut,
    JiraSite,
    ProviderCapability,
    RepositoryListOut,
    SlackChannel,
)

logger = logging.getLogger("vulnix.oauth")

router = APIRouter(prefix="/workspaces", tags=["integrations"])
public_router = APIRouter(tags=["integrations"])

_CONNECT_RATE = 10
_CONNECT_RATE_WINDOW_SECONDS = 600


def _require_app(provider: str) -> oauth.OAuthApp:
    app = oauth.app_for(provider)
    if provider == "github":
        if not settings.github_app_ready:
            raise AppError(
                "GITHUB_APP_NOT_CONFIGURED",
                "The GitHub App is not configured on this server.",
                412,
            )
    else:
        oauth.credentials(provider)
    oauth.redirect_uri(provider)
    return app


def _connection_out(row: OAuthConnection | None, provider: str) -> ConnectionOut:
    if row is None:
        return ConnectionOut(provider=provider, connected=False)
    return ConnectionOut(
        provider=provider,
        connected=True,
        account_label=row.account_label,
        scope=row.scope,
        access_expires_at=row.access_expires_at,
        connected_at=row.connected_at,
        details=dict(row.details or {}),
    )


def _get_connection(db, workspace_id: str, provider: str) -> OAuthConnection:
    row = connections.get(db, workspace_id, provider)
    if row is None:
        raise AppError(
            "OAUTH_NOT_CONNECTED", "Connect this integration before using its account data.", 409
        )
    return row


@router.get("/{workspace_id}/integrations/providers", response_model=list[ProviderCapability])
def provider_capabilities(
    workspace_id: str, db: DbSession, user: CurrentUser
) -> list[ProviderCapability]:
    """What each provider can do on this server, so the console offers only
    buttons that could actually work."""
    require_role(db, workspace_id, user, "viewer")
    linked = {row.provider: row for row in connections.list_for(db, workspace_id)}
    out: list[ProviderCapability] = []
    for provider, app in oauth.OAUTH_APPS.items():
        client_id, client_secret = settings.oauth_app(provider)
        reason = ""
        if provider == "github" and not settings.github_app_ready:
            reason = "GITHUB_APP_NOT_CONFIGURED"
        elif provider != "github" and not (client_id and client_secret):
            reason = "OAUTH_APP_NOT_CONFIGURED"
        elif not settings.oauth_ready:
            reason = "OAUTH_REDIRECT_NOT_CONFIGURED"
        row = linked.get(provider)
        out.append(
            ProviderCapability(
                provider=provider,
                oauth_available=not reason,
                reason=reason,
                redirect_uri=oauth.redirect_uri(provider) if not reason else "",
                scopes=list(app.scopes),
                connected=row is not None,
                account_label=row.account_label if row else "",
            )
        )
    return sorted(out, key=lambda item: item.provider)


@router.post(
    "/{workspace_id}/integrations/{provider}/connect", response_model=ConnectOut
)
def start_connect(
    workspace_id: str, provider: str, db: DbSession, user: CurrentUser
) -> ConnectOut:
    """Hand back the provider's own consent URL. Nothing is stored yet."""
    app = _require_app(provider)
    require_role(db, workspace_id, user, "admin")
    service.require_key()
    check_rate_limit(f"oauth_connect:{user.id}", _CONNECT_RATE, _CONNECT_RATE_WINDOW_SECONDS)

    state = oauth.make_state(provider, workspace_id, user.id)
    return ConnectOut(
        provider=provider,
        authorize_url=(
            oauth.github_install_url(state)
            if provider == "github"
            else oauth.authorize_url(provider, state)
        ),
        redirect_uri=oauth.redirect_uri(provider),
        scopes=list(app.scopes),
        expires_in=settings.oauth_state_ttl_seconds,
    )


@router.delete(
    "/{workspace_id}/integrations/{provider}/connection",
    status_code=status.HTTP_204_NO_CONTENT,
)
def disconnect(workspace_id: str, provider: str, db: DbSession, user: CurrentUser) -> None:
    _check_provider(provider)
    require_role(db, workspace_id, user, "admin")
    row = _get_connection(db, workspace_id, provider)
    connections.drop(db, row)
    # A pasted credential left beside a revoked consent would keep delivering,
    # which is the opposite of what disconnect means.
    config = service.get_config(db, workspace_id, provider)
    if config is not None and config.secret_enc:
        service.clear_secret(db, config)
    record_event(
        db,
        workspace_id=workspace_id,
        actor_id=user.id,
        action="integration.disconnected",
        resource_type="oauth_connection",
        resource_id=row.id,
        metadata={"provider": provider},
    )


@router.get("/{workspace_id}/integrations/connections", response_model=list[ConnectionOut])
def list_connections(
    workspace_id: str, db: DbSession, user: CurrentUser
) -> list[ConnectionOut]:
    require_role(db, workspace_id, user, "viewer")
    rows = {row.provider: row for row in connections.list_for(db, workspace_id)}
    return [_connection_out(rows.get(provider), provider) for provider in sorted(rows)]


@router.get("/{workspace_id}/integrations/slack/channels", response_model=list[SlackChannel])
def slack_channels(
    workspace_id: str, db: DbSession, user: CurrentUser
) -> list[SlackChannel]:
    require_role(db, workspace_id, user, "viewer")
    row = _get_connection(db, workspace_id, "slack")
    token = connections.access_token(db, row)
    return [SlackChannel(**channel) for channel in oauth.slack_channels(token)]


@router.get("/{workspace_id}/integrations/jira/setup", response_model=JiraSetupOut)
def jira_setup(
    workspace_id: str,
    db: DbSession,
    user: CurrentUser,
    site_id: str | None = Query(default=None, max_length=64),
) -> JiraSetupOut:
    """The sites this consent covers, and the projects inside one of them.

    Site URLs come from the provider, never from the request, so ``site_id`` can
    only ever select from what this connection was granted.
    """
    require_role(db, workspace_id, user, "viewer")
    row = _get_connection(db, workspace_id, "jira")
    token = connections.access_token(db, row)
    sites = oauth.jira_sites(token)
    selected = next((site for site in sites if site["id"] == site_id), None) if site_id else None
    if site_id and selected is None:
        raise AppError("JIRA_SITE_NOT_GRANTED", "This connection cannot reach that site.", 403)
    projects = oauth.jira_projects(token, selected["url"], selected["id"]) if selected else []
    return JiraSetupOut(
        sites=[JiraSite(**site) for site in sites],
        projects=[JiraProject(**project) for project in projects],
        site_id=selected["id"] if selected else "",
    )


@router.get("/{workspace_id}/integrations/github/repositories", response_model=RepositoryListOut)
def github_repositories(
    workspace_id: str,
    db: DbSession,
    user: CurrentUser,
    page: int = Query(default=1, ge=1, le=20),
    search: str = Query(default="", max_length=200),
) -> RepositoryListOut:
    require_role(db, workspace_id, user, "viewer")
    row = _get_connection(db, workspace_id, "github")
    token = connections.access_token(db, row)
    listed = oauth.github_repositories(token, page, search=search)
    return RepositoryListOut(
        repositories=[
            GitHubRepository(**repo, selected=True) for repo in listed
        ],
        selected=[GitHubRepository(**repo, selected=True) for repo in listed],
        truncated=len(listed) >= 100,
    )


@public_router.get("/integrations/oauth/{provider}/callback")
def oauth_callback(
    provider: str,
    request: Request,
    db: DbSession,
    code: str = "",
    state: str = "",
    installation_id: int | None = None,
    setup_action: str = "",
) -> RedirectResponse:
    """Complete the round trip the browser started, then send it home.

    Unauthenticated by nature: the caller is the provider's redirect. The signed
    state is what binds a consent to a workspace and a user, and the only thing
    taken from the query is the code and that state.
    """
    _check_provider(provider)
    client = request.client.host if request.client else "unknown"
    check_rate_limit(f"oauth_callback:{client}", 30, 60)

    try:
        payload = oauth.read_state(state)
        # The state names one provider. Presenting GitHub's approval to the Jira
        # callback would link an account nobody consented to.
        if payload["p"] != provider:
            raise AppError("OAUTH_STATE_INVALID", "This sign-in link is not valid.", 400)
        workspace_id = str(payload["w"])
        actor_id = str(payload["u"])
        _require_app(provider)
        if provider == "github":
            if setup_action not in ("install", "update"):
                raise AppError(
                    "GITHUB_INSTALLATION_INCOMPLETE",
                    "The GitHub App installation was not completed.",
                    400,
                )
            if installation_id is None:
                raise AppError(
                    "GITHUB_INSTALLATION_MISSING",
                    "GitHub did not return an installation. Try connecting again.",
                    400,
                )
            tokens = oauth.github_installation_token(installation_id)
        else:
            if not code:
                raise AppError("OAUTH_CODE_MISSING", "The provider returned no approval.", 400)
            tokens = oauth.exchange_code(provider, code)
        details = dict(tokens.get("details") or {})
        # The token exchange answered, so the consent is real. A failing identity
        # call must not throw the whole link away.
        try:
            token = tokens["access_token"]
            if provider == "jira":
                sites = oauth.jira_sites(token)
                details["sites"] = sites
                tokens["account_label"] = sites[0]["name"] if len(sites) == 1 else "Atlassian account"
                if len(sites) == 1:
                    # One site means no decision to make: bind it now so the Jira
                    # setup screen never asks for a URL the consent already picked.
                    details["site_id"] = sites[0]["id"]
                    details["site_url"] = sites[0]["url"]
        except AppError as exc:
            logger.warning("oauth_identity_lookup_failed provider=%s code=%s", provider, exc.code)

        row = connections.store(
            db,
            workspace_id=workspace_id,
            provider=provider,
            tokens=tokens,
            details=details,
            connected_by=actor_id,
        )
        _mirror_delivery_secret(db, workspace_id, provider)
        record_event(
            db,
            workspace_id=workspace_id,
            actor_id=actor_id,
            action="integration.connected",
            resource_type="oauth_connection",
            resource_id=row.id,
            metadata={"provider": provider, "scope": row.scope[:200]},
        )
        return _redirect(provider, {"connected": "1"})
    except AppError as exc:
        logger.warning("oauth_callback_failed provider=%s code=%s", provider, exc.code)
        return _redirect(provider, {"oauth_error": exc.code[:64]})


def _redirect(provider: str, params: dict[str, str]) -> RedirectResponse:
    base = settings.console_base_url.rstrip("/")
    query = "&".join(f"{key}={value}" for key, value in params.items())
    return RedirectResponse(f"{base}/app/integrations/{provider}?{query}", status_code=302)


def _mirror_delivery_secret(db, workspace_id: str, provider: str) -> None:
    """Keep a manual credential out of the way once a consent exists.

    The connection is the token source from now on (``connections.delivery_credential``
    prefers it), so a pasted token left in the row would only ever mislead the
    masked hint the console shows.
    """
    if provider not in connections.PROVIDERS[:2]:
        return
    config = service.get_config(db, workspace_id, provider)
    if config is not None and config.secret_enc:
        service.clear_secret(db, config)


def _check_provider(provider: str) -> None:
    if provider not in oauth.OAUTH_APPS:
        raise AppError("NOT_FOUND", "Resource not found.", 404)
