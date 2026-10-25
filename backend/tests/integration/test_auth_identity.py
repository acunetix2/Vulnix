"""Who the API believes a caller is.

Tenant isolation depends on this first: two accounts must resolve to two
subjects. The dev escape hatch must never swallow a token that was presented,
because that is what makes a new signup look straight into someone else's
workspace.
"""

import time

import jwt
import pytest
from pydantic import ValidationError

from app.core.config import Settings, settings

# 32 bytes or more: HS256 keys shorter than that draw a warning from PyJWT.
SECRET = "identity-test-secret-0123456789abcdef"


@pytest.fixture()
def tokens(monkeypatch):
    """HS256 subjects, minted the way the auth provider would mint them."""
    monkeypatch.setattr(settings, "supabase_jwt_secret", SECRET)
    monkeypatch.setattr(settings, "supabase_jwks_url", "")

    def _make(subject: str, email: str) -> str:
        return jwt.encode(
            {"sub": subject, "email": email, "exp": int(time.time()) + 3600},
            SECRET,
            algorithm="HS256",
        )

    return _make


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_a_presented_token_beats_the_development_identity(client, tokens, monkeypatch) -> None:
    # The suite runs with auth switched off; that must not make the token vanish.
    monkeypatch.setattr(settings, "auth_disabled", True)
    body = client.get("/api/v1/auth/me", headers=_auth(tokens("real-subject", "real@example.com"))).json()

    assert body["id"] == "real-subject"
    assert body["email"] == "real@example.com"


def test_a_request_with_no_token_uses_the_shared_development_identity(client, monkeypatch) -> None:
    # Documented escape hatch, so that a broken one is obvious rather than silent.
    monkeypatch.setattr(settings, "auth_disabled", True)
    assert client.get("/api/v1/auth/me").json()["id"] == "00000000-0000-0000-0000-000000000001"


def test_a_forged_token_is_refused_even_with_auth_switched_off(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth_disabled", True)
    monkeypatch.setattr(settings, "supabase_jwt_secret", SECRET)
    monkeypatch.setattr(settings, "supabase_jwks_url", "")

    response = client.get("/api/v1/auth/me", headers=_auth("not-a-real-jwt"))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


def test_two_signed_up_accounts_get_two_workspaces(client, tokens) -> None:
    """The reported bug: a second account could see the first one's workspace."""
    first = tokens("subject-first", "first@example.com")
    second = tokens("subject-second", "second@example.com")

    ws_first = client.post("/api/v1/workspaces", json={"name": "First Team"}, headers=_auth(first)).json()
    assert client.get("/api/v1/auth/me", headers=_auth(second)).json()["id"] == "subject-second"

    mine = client.get("/api/v1/workspaces", headers=_auth(second)).json()
    assert [w["id"] for w in mine] != [ws_first["id"]]
    assert all(w["id"] != ws_first["id"] for w in mine)
    assert client.get(f"/api/v1/workspaces/{ws_first['id']}", headers=_auth(second)).status_code == 404


def test_a_token_cannot_be_replayed_as_another_account(client, tokens) -> None:
    owner = _auth(tokens("owner-x", "x@example.com"))
    ws = client.post("/api/v1/workspaces", json={"name": "Owned"}, headers=owner).json()
    project = client.post(f"/api/v1/workspaces/{ws['id']}/projects", json={"name": "P"}, headers=owner).json()

    intruder = client.get(
        f"/api/v1/projects/{project['id']}", headers=_auth(tokens("owner-y", "y@example.com"))
    )
    assert intruder.status_code == 404


def test_production_refuses_a_disabled_auth() -> None:
    with pytest.raises(ValidationError) as exc:
        Settings(app_env="production", auth_disabled=True)
    assert "auth_disabled" in str(exc.value)
