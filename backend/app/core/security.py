"""Authentication and role checks.

Supabase-issued JWTs are verified locally. A dev-only mode exists so the API
can be exercised without an auth provider, but it never overrides a token that a
caller actually presented.
"""

import time
from dataclasses import dataclass

import httpx
import jwt
from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.db.models import User, WorkspaceMember

# Role hierarchy: higher number means more permission.
ROLE_ORDER = {"viewer": 0, "member": 1, "admin": 2, "owner": 3}

_jwks_cache: dict = {"fetched_at": 0.0, "keys": {}}


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str


def _verify_hs256(token: str) -> dict:
    return jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        options={"verify_aud": False, "require": ["exp", "sub"]},
    )


def _fetch_jwks() -> dict:
    # Cache JWKS briefly to avoid a fetch per request.
    if time.time() - _jwks_cache["fetched_at"] > 300 or not _jwks_cache["keys"]:
        resp = httpx.get(settings.supabase_jwks_url, timeout=10.0)
        resp.raise_for_status()
        _jwks_cache["keys"] = {k["kid"]: k for k in resp.json().get("keys", [])}
        _jwks_cache["fetched_at"] = time.time()
    return _jwks_cache["keys"]


def _verify_jwks(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    kid = header.get("kid", "")
    key = _fetch_jwks().get(kid)
    if not key:
        raise AppError("UNAUTHENTICATED", "Invalid token.", 401)
    alg = header.get("alg") or key.get("alg", "ES256")
    allowed_algs = list({alg, "ES256", "RS256", "HS256"})
    return jwt.decode(
        token,
        jwt.PyJWK(key).key,
        algorithms=allowed_algs,
        options={"verify_aud": False, "require": ["exp", "sub"]},
    )


def _verify_via_supabase(token: str) -> dict:
    supabase_url = getattr(settings, "supabase_url", None)
    supabase_key = getattr(settings, "supabase_anon_key", None)
    if not supabase_url:
        raise AppError("UNAUTHENTICATED", "Invalid token.", 401)
    headers = {"Authorization": f"Bearer {token}"}
    if supabase_key:
        headers["apikey"] = supabase_key
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(f"{supabase_url}/auth/v1/user", headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return {"sub": data.get("id"), "email": data.get("email", "")}
    except Exception:
        pass
    raise AppError("UNAUTHENTICATED", "Invalid or expired token.", 401)


def _dev_user() -> AuthUser:
    """The one identity a tokenless local request is served as."""
    return AuthUser(id="00000000-0000-0000-0000-000000000001", email=settings.dev_user_email)


def _identity_from_token(token: str) -> AuthUser:
    """Verify a bearer token and take its subject as the caller."""
    claims = None
    last_err = None

    if settings.supabase_jwks_url:
        try:
            claims = _verify_jwks(token)
        except Exception as e:
            last_err = e

    if claims is None and settings.supabase_jwt_secret:
        try:
            claims = _verify_hs256(token)
        except Exception as e:
            last_err = e

    if claims is None:
        try:
            claims = _verify_via_supabase(token)
        except Exception as e:
            last_err = e

    if claims is None:
        if isinstance(last_err, AppError):
            raise last_err
        raise AppError("UNAUTHENTICATED", "Invalid or expired token.", 401) from None

    return AuthUser(id=str(claims["sub"]), email=str(claims.get("email", "")))


def get_current_user(request: Request) -> AuthUser:
    """Resolve the caller from the bearer token they presented.

    An offered credential is always verified, even when development has auth
    switched off. Serving the shared dev identity to a request that carried a
    real token collapsed every account into one user, which is how a freshly
    signed-up account ended up looking inside someone else's workspace. The
    fallback answers a tokenless request only, and never in production.
    """
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return _identity_from_token(header.removeprefix("Bearer ").strip())

    if settings.auth_disabled and not settings.is_production:
        return _dev_user()

    raise AppError("UNAUTHENTICATED", "Authentication required.", 401)


def get_optional_current_user(request: Request) -> AuthUser | None:
    """Resolve caller if token provided, otherwise return None without error."""
    try:
        return get_current_user(request)
    except Exception:
        return None


def upsert_user(db: Session, user: AuthUser) -> User:
    """Mirror the auth subject into our users table on first sight."""
    row = db.get(User, user.id)
    if row is None:
        row = User(id=user.id, email=user.email or f"{user.id}@placeholder.local")
        db.add(row)
    elif user.email and row.email != user.email:
        row.email = user.email
    db.commit()
    return row


def get_membership(db: Session, workspace_id: str, user_id: str) -> WorkspaceMember | None:
    return db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
        )
    )


def require_role(db: Session, workspace_id: str, user: AuthUser, minimum: str) -> WorkspaceMember:
    """Enforce workspace membership and role. Never trust client-supplied IDs."""
    member = get_membership(db, workspace_id, user.id)
    if member is None:
        # 404, not 403, so foreign resource existence is not disclosed.
        raise AppError("NOT_FOUND", "Resource not found.", 404)
    if ROLE_ORDER.get(member.role, -1) < ROLE_ORDER[minimum]:
        raise AppError("FORBIDDEN", "You do not have permission for this action.", 403)
    return member
