"""OAuth and authentication endpoints."""

import re
import secrets
from datetime import datetime
from io import BytesIO
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, File, HTTPException, Query, Request, Response, UploadFile
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select

from app.api.dependencies import CurrentUser, DbSession
from app.core.config import settings
from app.core.errors import AppError
from app.core.rate_limit import check_rate_limit
from app.core.security import get_optional_current_user, upsert_user
from app.db.models import User, Workspace, WorkspaceMember, _now
from app.integrations.storage import get_storage

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: str
    password: str
    display_name: str | None = None
    redirect_uri: str | None = None  # where Supabase should send the confirm link


class LoginRequest(BaseModel):
    email: str
    password: str


class ResendConfirmationRequest(BaseModel):
    email: str
    redirect_uri: str | None = None


class ConfirmEmailRequest(BaseModel):
    code: str
    redirect_uri: str | None = None


class ConfirmTokenRequest(BaseModel):
    access_token: str
    refresh_token: str | None = None


class OAuthInitRequest(BaseModel):
    provider: Literal["github", "google"]
    redirect_uri: str


class OAuthCallbackRequest(BaseModel):
    provider: Literal["github", "google"]
    code: str
    redirect_uri: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: dict


def get_supabase_url() -> str:
    """Get Supabase URL from settings (.env / environment)."""
    if not settings.supabase_url:
        raise HTTPException(status_code=500, detail="SUPABASE_URL not configured")
    return settings.supabase_url


def get_supabase_anon_key() -> str:
    """Get Supabase anon key from settings (.env / environment)."""
    if not settings.supabase_anon_key:
        raise HTTPException(status_code=500, detail="SUPABASE_ANON_KEY not configured")
    return settings.supabase_anon_key


def _supabase_error(resp: "httpx.Response") -> HTTPException:
    """Map a failed Supabase Auth response to an HTTPException with a readable message."""
    try:
        data = resp.json()
    except Exception:
        data = {}
    msg = (
        data.get("msg")
        or data.get("error_description")
        or data.get("message")
        or data.get("error")
        or (resp.text or "").strip()
    )
    if not msg:
        msg = f"Supabase Auth request failed with status {resp.status_code}"
    return HTTPException(status_code=resp.status_code, detail=msg)


def _extract_user(token_data: dict, provider: str | None = None) -> dict:
    user = token_data.get("user") or {}
    meta = user.get("user_metadata") or {}
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "display_name": meta.get("full_name") or meta.get("name") or user.get("email"),
        # Providers disagree on the key: GitHub sends avatar_url, Google picture.
        "avatar_url": meta.get("avatar_url") or meta.get("picture"),
        "provider": provider or user.get("app_metadata", {}).get("provider"),
    }


@router.post("/signup", response_model=AuthResponse)
async def signup(body: SignupRequest) -> AuthResponse:
    """Create a user via Supabase Auth. Returns session if auto-confirm is on."""
    supabase_url = get_supabase_url()
    supabase_key = get_supabase_anon_key()

    payload: dict = {"email": body.email, "password": body.password}
    if body.display_name:
        payload["data"] = {"full_name": body.display_name}
    if body.redirect_uri:
        # Supabase appends this to the confirmation email's verify link,
        # so the user lands back on our app after confirming.
        payload["email_redirect_to"] = body.redirect_uri

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{supabase_url}/auth/v1/signup",
                json=payload,
                headers={"apikey": supabase_key, "Content-Type": "application/json"},
                timeout=15.0,
            )
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Request failed: {e}") from None

    if resp.status_code >= 400:
        raise _supabase_error(resp)

    data = resp.json()
    # If email confirmation is required, Supabase returns an identities array
    # but no access_token. Signal that to the client.
    if "access_token" not in data:
        return AuthResponse(
            access_token="",
            refresh_token="",
            user={"email": body.email, "pending_confirmation": True},
        )

    return AuthResponse(
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token", ""),
        user=_extract_user(data),
    )


@router.post("/resend-confirmation")
async def resend_confirmation(body: ResendConfirmationRequest) -> dict:
    """Resend the signup confirmation email via Supabase's /resend endpoint."""
    supabase_url = get_supabase_url()
    supabase_key = get_supabase_anon_key()

    payload: dict = {"email": body.email, "type": "signup"}
    if body.redirect_uri:
        payload["email_redirect_to"] = body.redirect_uri

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{supabase_url}/auth/v1/resend",
                json=payload,
                headers={"apikey": supabase_key, "Content-Type": "application/json"},
                timeout=15.0,
            )
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Request failed: {e}") from None

    if resp.status_code >= 400:
        raise _supabase_error(resp)

    return {"status": "ok", "message": f"Confirmation email sent to {body.email}"}


@router.post("/confirm", response_model=AuthResponse)
async def confirm_email(body: ConfirmEmailRequest) -> AuthResponse:
    """Exchange the email-confirmation code (from the verify link) for a session.

    When a user clicks the confirm link, Supabase redirects to
    ``email_redirect_to`` with a ``?code=`` query param. Exchange it here.
    """
    supabase_url = get_supabase_url()
    supabase_key = get_supabase_anon_key()

    payload: dict = {"auth_code": body.code}
    if body.redirect_uri:
        payload["redirect_to"] = body.redirect_uri

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{supabase_url}/auth/v1/token?grant_type=pkce",
                json=payload,
                headers={"apikey": supabase_key, "Content-Type": "application/json"},
                timeout=15.0,
            )
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Request failed: {e}") from None

    if resp.status_code >= 400:
        raise _supabase_error(resp)

    data = resp.json()
    return AuthResponse(
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token", ""),
        user=_extract_user(data, provider="email"),
    )


@router.post("/confirm-token", response_model=AuthResponse)
async def confirm_token(body: ConfirmTokenRequest) -> AuthResponse:
    """Validate an implicit-flow access_token (from the confirm redirect) and
    return the user profile so the frontend can log them in."""
    supabase_url = get_supabase_url()
    supabase_key = get_supabase_anon_key()

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {body.access_token}",
                },
                timeout=15.0,
            )
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Request failed: {e}") from None

    if resp.status_code >= 400:
        raise _supabase_error(resp)

    user = resp.json()
    return AuthResponse(
        access_token=body.access_token,
        refresh_token=body.refresh_token or "",
        user=_extract_user({"user": user}, provider="email"),
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest) -> AuthResponse:
    """Sign in via Supabase Auth password grant."""
    supabase_url = get_supabase_url()
    supabase_key = get_supabase_anon_key()

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{supabase_url}/auth/v1/token?grant_type=password",
                json={"email": body.email, "password": body.password},
                headers={"apikey": supabase_key, "Content-Type": "application/json"},
                timeout=15.0,
            )
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Request failed: {e}") from None

    if resp.status_code >= 400:
        raise _supabase_error(resp)

    data = resp.json()
    return AuthResponse(
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token", ""),
        user=_extract_user(data),
    )


@router.post("/oauth/init")
async def init_oauth(body: OAuthInitRequest) -> dict:
    """Return the Supabase authorize URL for the given provider.

    The browser is redirected there; Supabase handles the provider dance and
    sends the user back to ``redirect_uri`` with a ``code`` query param.
    """
    supabase_url = get_supabase_url()

    # Supabase OAuth URL format: /auth/v1/authorize?provider=<provider>
    # The redirect_to is where Supabase sends the user after OAuth completes.
    # Without a PKCE code_challenge, Supabase returns tokens in the URL
    # fragment (#access_token=...); the frontend handles that implicit flow.
    params = httpx.QueryParams(
        {"provider": body.provider, "redirect_to": body.redirect_uri}
    )
    return {
        "authorization_url": f"{supabase_url}/auth/v1/authorize?{params}",
        "provider": body.provider,
    }


def _adopt_provider_profile(db, profile: dict) -> None:
    """Copy what a sign-in provider knows onto the account row Vulnix owns.

    Without this the picture and name would live only in the session object in
    one browser. Values the account already carries win: an uploaded photo or an
    edited name is never overwritten by a later sign-in.
    """
    user_id = profile.get("id")
    if not user_id:
        return
    row = db.get(User, user_id)
    if row is None:
        row = User(id=user_id, email=profile.get("email") or f"{user_id}@placeholder.local")
        db.add(row)
    if profile.get("avatar_url") and not row.avatar_url:
        row.avatar_url = str(profile["avatar_url"])[:500]
    if profile.get("display_name") and not row.display_name:
        row.display_name = str(profile["display_name"])[:255]
    db.commit()


@router.post("/oauth/callback", response_model=AuthResponse)
async def oauth_callback(db: DbSession, body: OAuthCallbackRequest) -> AuthResponse:
    """Exchange the authorization code from Supabase OAuth for tokens.
    
    When using Supabase's /authorize endpoint, it redirects back with URL fragments
    containing access_token and refresh_token directly (implicit flow), OR with a 
    code parameter that needs to be exchanged (PKCE flow).
    
    For social OAuth (GitHub, Google), Supabase uses the code flow.
    """
    supabase_url = get_supabase_url()
    supabase_key = get_supabase_anon_key()

    async with httpx.AsyncClient() as client:
        try:
            # Exchange the authorization code for tokens
            # Supabase expects the code in the 'auth_code' parameter with grant_type=pkce
            resp = await client.post(
                f"{supabase_url}/auth/v1/token?grant_type=pkce",
                json={"auth_code": body.code},
                headers={
                    "apikey": supabase_key,
                    "Content-Type": "application/json"
                },
                timeout=15.0,
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Request to Supabase failed: {str(e)}"
            ) from None

        if resp.status_code >= 400:
            # Log the full error for debugging
            error_detail = _supabase_error(resp)
            raise error_detail

        data = resp.json()
        
        # Validate that we got tokens back
        if "access_token" not in data:
            raise HTTPException(
                status_code=500,
                detail="No access token returned from Supabase"
            )
        
        profile = _extract_user(data, body.provider)
        _adopt_provider_profile(db, profile)
        return AuthResponse(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", ""),
            user=profile,
        )


@router.post("/refresh")
async def refresh_token(refresh_token: str) -> AuthResponse:
    """
    Refresh an expired access token using a refresh token.
    """
    supabase_url = get_supabase_url()
    supabase_key = get_supabase_anon_key()
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{supabase_url}/auth/v1/token?grant_type=refresh_token",
                json={"refresh_token": refresh_token},
                headers={
                    "apikey": supabase_key,
                    "Content-Type": "application/json"
                },
                timeout=10.0
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to refresh token"
                )
            
            token_data = response.json()
            
            # Get updated user info
            user_response = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {token_data['access_token']}"
                },
                timeout=10.0
            )
            
            user_data = user_response.json() if user_response.status_code == 200 else {}
            
            return AuthResponse(
                access_token=token_data["access_token"],
                refresh_token=token_data.get("refresh_token", refresh_token),
                user={
                    "id": user_data.get("id"),
                    "email": user_data.get("email"),
                    "display_name": user_data.get("user_metadata", {}).get("full_name") 
                                   or user_data.get("email"),
                    "avatar_url": user_data.get("user_metadata", {}).get("avatar_url")
                }
            )
            
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}") from e


@router.post("/signout")
async def signout(access_token: str) -> dict:
    """
    Sign out user by revoking their session in Supabase.
    """
    supabase_url = get_supabase_url()
    supabase_key = get_supabase_anon_key()
    
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"{supabase_url}/auth/v1/logout",
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {access_token}"
                },
                timeout=10.0
            )
            
            return {"success": True, "message": "Signed out successfully"}
            
        except httpx.RequestError:
            # Even if the API call fails, we can consider it successful from client perspective
            return {"success": True, "message": "Signed out"}


class WorkspaceRole(BaseModel):
    id: str
    name: str
    role: str


class MeOut(BaseModel):
    id: str
    email: str
    display_name: str | None
    # The handle shown everywhere the console used to print the primary key.
    username: str | None
    avatar_url: str | None
    created_at: datetime | None
    # Null until the account closes the welcome sequence; the console offers it
    # again on any device while it is.
    onboarding_completed_at: datetime | None = None
    workspaces: list[WorkspaceRole]


class MeUpdate(BaseModel):
    # No length constraints here on purpose: a rejected name or handle has to come
    # back as the rule it broke, and a pydantic constraint failure only earns the
    # caller a generic VALIDATION_ERROR. The validators in this module own the
    # messages.
    display_name: str | None = None
    username: str | None = None

    # A name made of spaces is not a name; trimming before the length check is
    # what turns it into a validation error instead of a blank profile.
    @field_validator("display_name", mode="before")
    @classmethod
    def _trim(cls, value):
        return value.strip() if isinstance(value, str) else value

    # Handles are typed with a leading @ and in mixed case; the stored form is
    # neither, because uniqueness has to be case-insensitive.
    @field_validator("username", mode="before")
    @classmethod
    def _normalize_handle(cls, value):
        if not isinstance(value, str):
            return value
        return value.strip().lstrip("@").lower()


class PasswordUpdate(BaseModel):
    password: str = Field(min_length=8, max_length=128)


# Letters, digits, dot, underscore and hyphen; must start and end alphanumeric.
USERNAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$")
# Handles that would let a profile impersonate the product or its staff.
RESERVED_USERNAMES = frozenset(
    {
        "admin",
        "administrator",
        "root",
        "support",
        "system",
        "webmaster",
        "vulnix",
        "security",
        "moderator",
    }
)


def validate_username(value: str) -> str:
    """Normalise and check a handle, raising the errors a form can display."""
    handle = value.strip().lstrip("@").lower()
    # One rule per error: a form can only explain the handle it was given if the
    # answer names the rule that broke.
    if len(handle) < 3:
        raise AppError("USERNAME_TOO_SHORT", "A username is at least 3 characters.", 422)
    if len(handle) > 30:
        raise AppError("USERNAME_TOO_LONG", "A username is at most 30 characters.", 422)
    if not USERNAME_PATTERN.match(handle):
        raise AppError(
            "USERNAME_INVALID",
            "A username uses letters, digits, dot, underscore or hyphen, and starts and "
            "ends with a letter or digit.",
            422,
        )
    if handle in RESERVED_USERNAMES:
        raise AppError("USERNAME_RESERVED", "That username is reserved.", 422)
    return handle


def validate_display_name(value: str) -> str:
    name = value.strip()
    if not name:
        raise AppError("DISPLAY_NAME_EMPTY", "A display name cannot be blank.", 422)
    if len(name) > 120:
        raise AppError("DISPLAY_NAME_TOO_LONG", "A display name is at most 120 characters.", 422)
    return name


def _me(db, user) -> MeOut:
    row = upsert_user(db, user)
    rows = db.execute(
        select(Workspace.id, Workspace.name, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user.id)
        .order_by(Workspace.created_at.desc())
    ).all()
    return MeOut(
        id=row.id,
        email=row.email,
        display_name=row.display_name,
        username=row.username,
        avatar_url=row.avatar_url,
        created_at=row.created_at,
        onboarding_completed_at=row.onboarding_completed_at,
        workspaces=[WorkspaceRole(id=r[0], name=r[1], role=r[2]) for r in rows],
    )


class CheckUsernameOut(BaseModel):
    username: str
    available: bool
    reason: str | None = None


class UserSearchOut(BaseModel):
    id: str
    username: str | None
    display_name: str | None
    email: str
    avatar_url: str | None


@router.get("/check-username", response_model=CheckUsernameOut)
def check_username(
    db: DbSession,
    request: Request,
    username: str = Query(..., min_length=1, max_length=50),
) -> CheckUsernameOut:
    handle = username.strip().lstrip("@").lower()
    if len(handle) < 3:
        return CheckUsernameOut(username=handle, available=False, reason="A username is at least 3 characters.")
    if len(handle) > 30:
        return CheckUsernameOut(username=handle, available=False, reason="A username is at most 30 characters.")
    if not USERNAME_PATTERN.match(handle):
        return CheckUsernameOut(
            username=handle,
            available=False,
            reason="Use letters, digits, dot, underscore or hyphen (starts/ends with alphanumeric).",
        )
    if handle in RESERVED_USERNAMES:
        return CheckUsernameOut(username=handle, available=False, reason="That username is reserved.")

    caller = get_optional_current_user(request)
    query = select(User.id).where(User.username == handle)
    if caller is not None:
        query = query.where(User.id != caller.id)

    taken = db.execute(query).scalar_one_or_none()
    if taken is not None:
        return CheckUsernameOut(username=handle, available=False, reason="Username is already in use.")

    return CheckUsernameOut(username=handle, available=True, reason=None)


@router.get("/users/search", response_model=list[UserSearchOut])
def search_users(
    db: DbSession,
    user: CurrentUser,
    q: str = Query(..., min_length=1, max_length=100),
) -> list[UserSearchOut]:
    clean = q.strip().lstrip("@").lower()
    term = f"%{clean}%"
    rows = db.scalars(
        select(User)
        .where(
            (func.lower(User.username).like(term))
            | (func.lower(User.email).like(term))
            | (func.lower(User.display_name).like(term))
        )
        .limit(20)
    ).all()
    return [
        UserSearchOut(
            id=u.id,
            username=u.username,
            display_name=u.display_name,
            email=u.email,
            avatar_url=u.avatar_url,
        )
        for u in rows
    ]


@router.get("/me", response_model=MeOut)
def read_me(db: DbSession, user: CurrentUser) -> MeOut:
    """Identity plus the workspace roles that decide what the console shows."""
    return _me(db, user)


@router.patch("/me", response_model=MeOut)
def update_me(db: DbSession, user: CurrentUser, body: MeUpdate) -> MeOut:
    """Rename the account or claim its handle. Credentials stay with the provider."""
    if body.display_name is None and body.username is None:
        raise AppError("VALIDATION_ERROR", "Nothing to update.", 422)
    row = upsert_user(db, user)
    if body.username is not None:
        handle = validate_username(body.username)
        taken = db.execute(
            select(User.id).where(User.username == handle, User.id != row.id)
        ).scalar_one_or_none()
        if taken is not None:
            raise AppError("USERNAME_TAKEN", f"{handle} is already in use.", 409)
        row.username = handle
    if body.display_name is not None:
        row.display_name = validate_display_name(body.display_name)
    db.commit()
    return _me(db, user)


@router.post("/me/onboarding", response_model=MeOut)
def finish_onboarding(db: DbSession, user: CurrentUser) -> MeOut:
    """Close the welcome sequence. Idempotent: a second call keeps the first time."""
    row = upsert_user(db, user)
    if row.onboarding_completed_at is None:
        row.onboarding_completed_at = _now()
        db.commit()
    return _me(db, user)


AVATAR_MAX_BYTES = 2 * 1024 * 1024
# The path stored on the account row, resolved against the API base by the
# console. The file name is generated here and is unguessable, which is what
# lets an <img> tag fetch it without a bearer token it cannot send.
AVATAR_PATH_PREFIX = "/auth/avatars/"
AVATAR_NAME = re.compile(r"^[0-9a-f]{32}\.(png|jpg|gif|webp)$")
AVATAR_MEDIA = {"png": "image/png", "jpg": "image/jpeg", "gif": "image/gif", "webp": "image/webp"}


def _sniff_image(data: bytes) -> str | None:
    """Identify the picture from its bytes; the claimed content type is ignored."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


@router.post("/me/avatar", response_model=MeOut)
async def upload_avatar(db: DbSession, user: CurrentUser, file: Annotated[UploadFile, File(...)]) -> MeOut:
    """Replace the account picture with one this service stores and serves."""
    # Repeated uploads write to disk, so this is throttled like a credential write.
    check_rate_limit(f"avatar:{user.id}", 10, 3600)
    data = await file.read(AVATAR_MAX_BYTES + 1)
    if len(data) > AVATAR_MAX_BYTES:
        raise AppError("AVATAR_TOO_LARGE", "A profile picture is at most 2 MB.", 413)
    kind = _sniff_image(data)
    if kind is None:
        raise AppError("AVATAR_UNSUPPORTED", "Upload a PNG, JPEG, GIF or WebP image.", 415)

    row = upsert_user(db, user)
    name = f"{secrets.token_hex(16)}.{kind}"
    get_storage().put_stream(BytesIO(data), f"avatars/{name}", AVATAR_MAX_BYTES)
    previous = row.avatar_url or ""
    row.avatar_url = f"{AVATAR_PATH_PREFIX}{name}"
    db.commit()

    # Only an object this endpoint wrote is removed; a provider's URL is left alone.
    if previous.startswith(AVATAR_PATH_PREFIX):
        old = previous.removeprefix(AVATAR_PATH_PREFIX)
        if AVATAR_NAME.fullmatch(old):
            get_storage().delete(f"avatars/{old}")
    return _me(db, user)


@router.get("/avatars/{name}")
def read_avatar(name: str) -> Response:
    """Serve a stored picture. The unguessable name is the whole credential."""
    if not AVATAR_NAME.fullmatch(name):
        raise AppError("NOT_FOUND", "No such image.", 404)
    with get_storage().open_read(f"avatars/{name}") as handle:
        body = handle.read()
    # The name never changes for a given image, so a browser may keep it forever.
    return Response(content=body, media_type=AVATAR_MEDIA[name.rsplit(".", 1)[-1]],
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.put("/password")
async def change_password(
    request: Request, db: DbSession, user: CurrentUser, body: PasswordUpdate
) -> dict:
    """Rotate the password through Supabase Auth, which owns credentials.

    The bearer token on this request is the authorization; Vulnix neither stores
    the password nor logs it, and forwards it only in this one call.
    """
    # Credential changes are the one auth write worth throttling: a stolen
    # session should not be able to lock the owner out repeatedly.
    check_rate_limit(f"password:{user.id}", 5, 900)
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")

    supabase_url = get_supabase_url()
    supabase_key = get_supabase_anon_key()

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.put(
                f"{supabase_url}/auth/v1/user",
                json={"password": body.password},
                headers={
                    "apikey": supabase_key,
                    "Authorization": header,
                    "Content-Type": "application/json",
                },
                timeout=10.0,
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502, detail="Could not reach the identity provider."
            ) from exc

    if resp.status_code != 200:
        raise _supabase_error(resp)
    return {"changed": True}
