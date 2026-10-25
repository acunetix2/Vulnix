"""Account control: identity, workspace roles, rename and credential rotation.

Auth is delegated to Supabase, so these tests pin the two halves Vulnix owns:
the profile row it serves to the console, and the fact that a password change is
forwarded rather than stored.
"""

import json

import pytest

from app.modules.auth import routes as auth_routes


@pytest.fixture()
def session(login, client):
    login(user_id="user-me", email="me@example.com")
    return client


def _join(session, name="Primary"):
    return session.post("/api/v1/workspaces", json={"name": name}).json()


def test_me_names_the_account_and_its_roles(session):
    primary = _join(session, "Primary")
    other = _join(session, "Secondary")

    body = session.get("/api/v1/auth/me").json()

    assert body["id"] == "user-me"
    assert body["email"] == "me@example.com"
    assert body["display_name"] is None
    assert {w["name"] for w in body["workspaces"]} == {"Primary", "Secondary"}
    # Every workspace a user can reach is listed with the role they hold there,
    # which is what the account page has to show instead of a static badge.
    for workspace in body["workspaces"]:
        assert workspace["role"] == "owner"
    assert {w["id"] for w in body["workspaces"]} == {primary["id"], other["id"]}


def test_rename_round_trips(session):
    updated = session.patch("/api/v1/auth/me", json={"display_name": "  Ada Lovelace  "})
    assert updated.status_code == 200
    assert updated.json()["display_name"] == "Ada Lovelace"
    assert session.get("/api/v1/auth/me").json()["display_name"] == "Ada Lovelace"


@pytest.mark.parametrize("display_name", ["", "   "])
def test_rename_rejects_blank(session, display_name):
    response = session.patch("/api/v1/auth/me", json={"display_name": display_name})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "DISPLAY_NAME_EMPTY"


def test_rename_rejects_an_overlong_name(session):
    response = session.patch("/api/v1/auth/me", json={"display_name": "a" * 121})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "DISPLAY_NAME_TOO_LONG"


def _other_account(username: str) -> None:
    from app.db.models import User
    from app.db.session import SessionLocal

    db = SessionLocal()
    db.merge(User(id="other-user", email="other@example.com", username=username))
    db.commit()
    db.close()


def test_claiming_a_handle_normalises_it(session):
    claimed = session.patch("/api/v1/auth/me", json={"username": "  @Ada.Lovelace "})
    assert claimed.status_code == 200
    # Typed with an @ and in mixed case; stored as neither, because uniqueness
    # has to be case-insensitive without a second column.
    assert claimed.json()["username"] == "ada.lovelace"
    assert session.get("/api/v1/auth/me").json()["username"] == "ada.lovelace"


def test_name_and_handle_are_written_in_one_pass(session):
    body = session.patch("/api/v1/auth/me", json={"display_name": "Ada", "username": "ada"}).json()
    assert (body["display_name"], body["username"]) == ("Ada", "ada")


def test_keeping_your_own_handle_is_not_a_collision(session):
    session.patch("/api/v1/auth/me", json={"username": "ada"})
    again = session.patch("/api/v1/auth/me", json={"username": "Ada", "display_name": "Ada L"})
    assert again.status_code == 200
    assert again.json()["username"] == "ada"


def test_a_handle_taken_by_another_account_is_refused(session):
    _other_account("ada")
    response = session.patch("/api/v1/auth/me", json={"username": "@ADA"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "USERNAME_TAKEN"
    assert session.get("/api/v1/auth/me").json()["username"] is None


@pytest.mark.parametrize("username", ["a b", "_ada", "ada-", "ada!", "ada/b", "éada"])
def test_handle_shape_is_enforced(session, username):
    response = session.patch("/api/v1/auth/me", json={"username": username})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "USERNAME_INVALID"


@pytest.mark.parametrize(
    "username,code",
    [
        ("ad", "USERNAME_TOO_SHORT"),
        ("@", "USERNAME_TOO_SHORT"),
        ("@@", "USERNAME_TOO_SHORT"),
        ("a" * 31, "USERNAME_TOO_LONG"),
    ],
)
def test_handle_length_is_enforced(session, username, code):
    # Too short or too long never reaches the shape check, and each answer names
    # the rule it broke rather than returning a generic validation failure.
    response = session.patch("/api/v1/auth/me", json={"username": username})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == code
    assert response.json()["error"]["message"]


@pytest.mark.parametrize("username", ["admin", "Vulnix", "support"])
def test_staff_shaped_handles_stay_reserved(session, username):
    response = session.patch("/api/v1/auth/me", json={"username": username})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "USERNAME_RESERVED"


def test_the_handle_is_what_names_the_account_to_others(session):
    ws = _join(session, "Primary")
    session.patch("/api/v1/auth/me", json={"username": "ada"})
    assert ws["name"] == "Primary"

    member = session.get(f"/api/v1/workspaces/{ws['id']}/members").json()[0]
    assert member["label"] == "ada"
    # The identifier is still served for API use; nothing about it is rendered.
    assert member["user_id"] == "user-me"


def test_the_welcome_sequence_is_offered_until_it_is_closed(session):
    # SQLite hands a naive column back while the value written in the same call is
    # aware, so compare the instant rather than the serialized spelling.
    def moment(value):
        return value.rstrip("Z")

    assert session.get("/api/v1/auth/me").json()["onboarding_completed_at"] is None

    first = session.post("/api/v1/auth/me/onboarding").json()["onboarding_completed_at"]
    assert first

    # The stamp records the first close, not the last call, so a second device
    # finishing the same sequence cannot rewrite when the account did it.
    again = session.post("/api/v1/auth/me/onboarding").json()["onboarding_completed_at"]
    assert moment(again) == moment(first)
    assert moment(session.get("/api/v1/auth/me").json()["onboarding_completed_at"]) == moment(first)


def test_closing_the_sequence_keeps_the_names_already_claimed(session):
    session.patch("/api/v1/auth/me", json={"display_name": "Ada", "username": "ada"})
    body = session.post("/api/v1/auth/me/onboarding").json()

    assert (body["display_name"], body["username"]) == ("Ada", "ada")
    assert body["onboarding_completed_at"]


def test_me_requires_a_session(client, monkeypatch):
    from app.core.config import settings
    from app.main import app

    # The suite runs with auth off; this proves /auth/me is not an anonymous
    # directory of accounts when the deployment does verify tokens.
    monkeypatch.setattr(settings, "auth_disabled", False)
    monkeypatch.setattr(settings, "supabase_jwt_secret", "test-secret")
    app.dependency_overrides.clear()

    assert client.get("/api/v1/auth/me").status_code == 401


class _Response:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)

    def json(self):
        return self._payload


class _Client:
    captured = None
    response = _Response(200, {"email": "me@example.com"})

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def put(self, url, json=None, headers=None, timeout=None):
        _Client.captured = {"url": url, "json": json, "headers": headers or {}, "timeout": timeout}
        return _Client.response


@pytest.fixture()
def identity(monkeypatch):
    _Client.captured = None
    _Client.response = _Response(200, {"email": "me@example.com"})
    monkeypatch.setattr(auth_routes, "get_supabase_url", lambda: "https://auth.test")
    monkeypatch.setattr(auth_routes, "get_supabase_anon_key", lambda: "anon-key")
    monkeypatch.setattr(auth_routes.httpx, "AsyncClient", _Client)
    return _Client


def test_password_change_is_forwarded_not_stored(session, identity):
    response = session.put(
        "/api/v1/auth/password",
        json={"password": "a-long-new-secret"},
        headers={"Authorization": "Bearer caller-token"},
    )

    assert response.status_code == 200
    assert response.json() == {"changed": True}
    assert identity.captured["url"] == "https://auth.test/auth/v1/user"
    assert identity.captured["json"] == {"password": "a-long-new-secret"}
    # The caller's own session authorizes the change - never a service key.
    assert identity.captured["headers"]["Authorization"] == "Bearer caller-token"


def test_password_change_without_a_session_is_refused(session, identity):
    assert session.put("/api/v1/auth/password", json={"password": "a-long-new-secret"}).status_code == 401


def test_password_change_surfaces_the_provider_message(session, identity):
    identity.response = _Response(422, {"msg": "Recent login required"})

    body = session.put(
        "/api/v1/auth/password",
        json={"password": "a-long-new-secret"},
        headers={"Authorization": "Bearer caller-token"},
    ).json()

    assert "Recent login required" in json.dumps(body)


def test_password_change_is_throttled(session, identity):
    for _ in range(5):
        assert (
            session.put(
                "/api/v1/auth/password",
                json={"password": "a-long-new-secret"},
                headers={"Authorization": "Bearer caller-token"},
            ).status_code
            == 200
        )

    sixth = session.put(
        "/api/v1/auth/password",
        json={"password": "a-long-new-secret"},
        headers={"Authorization": "Bearer caller-token"},
    )
    assert sixth.status_code == 429


def test_short_password_is_rejected_before_the_provider(session, identity):
    response = session.put(
        "/api/v1/auth/password",
        json={"password": "short"},
        headers={"Authorization": "Bearer caller-token"},
    )

    assert response.status_code == 422
    assert identity.captured is None
