"""Connection rows: what a consent window left behind, and how to spend it.

One ``OAuthConnection`` per (workspace, provider). The access token lives in
``access_enc`` and is decrypted only at the moment of a provider call or a
refresh. ``integration_configs.secret_enc`` stays what it always was - a
manually supplied credential for the deployments where OAuth is not available -
and a connection simply takes precedence over it.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.errors import AppError
from app.db.models import IntegrationConfig, OAuthConnection
from app.modules.integrations import oauth

logger = logging.getLogger("vulnix.oauth")

PROVIDERS = ("slack", "jira", "github")


def _utcnow() -> datetime:
    return datetime.now(UTC)


def get(db: Session, workspace_id: str, provider: str) -> OAuthConnection | None:
    return db.scalar(
        select(OAuthConnection).where(
            OAuthConnection.workspace_id == workspace_id, OAuthConnection.provider == provider
        )
    )


def list_for(db: Session, workspace_id: str) -> list[OAuthConnection]:
    return list(
        db.scalars(
            select(OAuthConnection).where(OAuthConnection.workspace_id == workspace_id)
        ).all()
    )


def _decrypt_token(column: str | None) -> str:
    value = decrypt_secret(column)
    if not value:
        # Either the key rotated or the row was written by another deployment.
        raise AppError(
            "OAUTH_TOKEN_UNREADABLE",
            "This connection cannot be read with the current server key. Reconnect it.",
            409,
        )
    return value


def store(
    db: Session,
    *,
    workspace_id: str,
    provider: str,
    tokens: dict,
    details: dict | None = None,
    connected_by: str,
) -> OAuthConnection:
    """Insert or replace a connection from a completed consent flow."""
    row = get(db, workspace_id, provider)
    if row is None:
        row = OAuthConnection(workspace_id=workspace_id, provider=provider)
        db.add(row)

    access = tokens.get("access_token") or ""
    if not access:
        raise AppError("OAUTH_BAD_RESPONSE", "The provider did not return a token.", 502)

    row.account_label = str(tokens.get("account_label") or "")[:160] or provider
    row.scope = str(tokens.get("scope") or "")[:512]
    row.access_enc, _ = encrypt_secret(access)
    refresh = tokens.get("refresh_token") or ""
    # A refresh response that omits the refresh token means "keep the old one".
    if refresh:
        row.refresh_enc, _ = encrypt_secret(refresh)
    elif row.refresh_enc is None:
        row.refresh_enc = None
    expires = tokens.get("expires_at")
    row.access_expires_at = expires
    merged = dict(row.details or {})
    merged.update(dict(details or {}))
    row.details = merged
    row.connected_by = connected_by
    row.connected_at = _utcnow()
    row.updated_at = _utcnow()
    db.commit()
    db.refresh(row)
    logger.info("oauth_connected provider=%s workspace_id=%s", provider, workspace_id)
    return row


def drop(db: Session, row: OAuthConnection) -> None:
    db.delete(row)
    db.commit()


def _renew(db: Session, row: OAuthConnection) -> str:
    installation_id = (row.details or {}).get("installation_id")
    if row.provider == "github" and isinstance(installation_id, int):
        tokens = oauth.github_installation_token(installation_id)
        store(
            db,
            workspace_id=row.workspace_id,
            provider=row.provider,
            tokens=tokens,
            details=tokens.get("details") or {},
            connected_by=row.connected_by,
        )
        fresh = get(db, row.workspace_id, row.provider)
        if fresh is None:
            raise AppError("OAUTH_CONNECTION_EXPIRED", "Reconnect this integration.", 409)
        return _decrypt_token(fresh.access_enc)

    refresh_token = decrypt_secret(row.refresh_enc)
    if not refresh_token:
        raise AppError(
            "OAUTH_CONNECTION_EXPIRED",
            "This connection's approval has run out. Reconnect it.",
            409,
        )
    tokens = oauth.refresh_tokens(row.provider, refresh_token)
    store(
        db,
        workspace_id=row.workspace_id,
        provider=row.provider,
        tokens=tokens,
        details=tokens.get("details") or {},
        connected_by=row.connected_by,
    )
    # ``store`` wrote a fresh row; return the token it just sealed.
    fresh = get(db, row.workspace_id, row.provider)
    if fresh is None:
        raise AppError("OAUTH_CONNECTION_EXPIRED", "Reconnect this integration.", 409)
    return _decrypt_token(fresh.access_enc)


def access_token(db: Session, row: OAuthConnection) -> str:
    """The current access token, renewed silently when it has run out."""
    if oauth.is_expired(row.access_expires_at):
        return _renew(db, row)
    return _decrypt_token(row.access_enc)


def configured_secret(config: IntegrationConfig | None) -> str:
    """A manually stored credential, for the fallback path only."""
    if config is None or not config.secret_enc:
        return ""
    return decrypt_secret(config.secret_enc) or ""


@dataclass(frozen=True)
class DeliveryCredential:
    """What a delivery sends with, and how the provider expects it.

    ``basic_email`` is non-empty only for a hand-stored Jira token, where the
    account email and the API token pair up as HTTP Basic. An OAuth consent
    authorizes itself with a bearer token and has no email to name.
    """

    token: str
    basic_email: str = ""

    @property
    def usable(self) -> bool:
        return bool(self.token)


def delivery_credential(db: Session, config: IntegrationConfig) -> DeliveryCredential:
    """The credential a delivery should use: the consented one, else the stored secret.

    An unusable result is an empty credential rather than an exception, so the
    caller can park the row with the same ``CONFIG_INCOMPLETE`` it already knows.
    """
    connection = get(db, config.workspace_id, config.provider)
    if connection is not None:
        try:
            return DeliveryCredential(token=access_token(db, connection))
        except AppError as exc:
            # An expired consent is a real configuration problem, and the outbox
            # must park it as dead rather than retry forever.
            logger.warning("oauth_token_unavailable provider=%s code=%s", config.provider, exc.code)
            return DeliveryCredential(token="")

    stored = config.config or {}
    return DeliveryCredential(
        token=configured_secret(config),
        basic_email=str(stored.get("user_email") or "") if config.provider == "jira" else "",
    )
