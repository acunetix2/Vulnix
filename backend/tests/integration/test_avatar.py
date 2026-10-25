"""Profile pictures: what the console can show for an account.

Two paths land on the same column - a sign-in provider's own photo, and a file
uploaded by someone who signed up with an email - so both are pinned here, plus
the rule that the second never overwrites the first.
"""

import base64

import pytest

from app.db.models import User
from app.db.session import SessionLocal

# A real 1x1 transparent PNG: the endpoint reads the bytes, not the claim.
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
    "YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


@pytest.fixture()
def session(login, client):
    login(user_id="user-avatar", email="avatar@example.com")
    return client


def _upload(session, data: bytes, filename="pic.png"):
    return session.post(
        "/api/v1/auth/me/avatar",
        files={"file": (filename, data, "image/png")},
    )


def test_an_uploaded_picture_is_stored_and_served(session):
    body = _upload(session, PNG).json()
    assert body["avatar_url"].startswith("/auth/avatars/")

    served = session.get(f"/api/v1{body['avatar_url']}")
    assert served.status_code == 200
    assert served.content == PNG
    assert served.headers["content-type"] == "image/png"
    # The name is generated per upload and never reused, so a browser may keep it.
    assert "immutable" in served.headers["cache-control"]


def test_the_profile_row_carries_the_picture(session):
    uploaded = _upload(session, PNG).json()["avatar_url"]
    assert session.get("/api/v1/auth/me").json()["avatar_url"] == uploaded


def test_replacing_a_picture_discards_the_previous_one(session):
    first = _upload(session, PNG).json()["avatar_url"]
    second = _upload(session, PNG).json()["avatar_url"]
    assert first != second

    assert session.get(f"/api/v1{first}").status_code == 404
    assert session.get(f"/api/v1{second}").status_code == 200


def test_a_file_that_is_not_a_picture_is_refused(session):
    response = _upload(session, b"<svg onload=alert(1)>", filename="pic.svg")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "AVATAR_UNSUPPORTED"
    assert session.get("/api/v1/auth/me").json()["avatar_url"] is None


def test_an_oversized_picture_is_refused(session):
    response = _upload(session, PNG + b"\0" * (2 * 1024 * 1024))
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "AVATAR_TOO_LARGE"


def test_only_a_generated_name_can_be_read(session):
    # Path traversal and guessed names both miss; nothing reaches the filesystem.
    for name in ["..%2F..%2Fetc%2Fpasswd", "config.png", "0" * 32 + ".png"]:
        assert session.get(f"/api/v1/auth/avatars/{name}").status_code in (404, 400)


def test_a_provider_photo_fills_an_empty_row_but_never_overwrites_one(session):
    from app.modules.auth.routes import _adopt_provider_profile

    db = SessionLocal()
    try:
        _adopt_provider_profile(
            db,
            {
                "id": "user-avatar",
                "email": "avatar@example.com",
                "display_name": "Ada Lovelace",
                "avatar_url": "https://avatars.example/ada.png",
            },
        )
        row = db.get(User, "user-avatar")
        assert row.display_name == "Ada Lovelace"
        assert row.avatar_url == "https://avatars.example/ada.png"

        uploaded = _upload(session, PNG).json()["avatar_url"]
        _adopt_provider_profile(
            db,
            {
                "id": "user-avatar",
                "email": "avatar@example.com",
                "display_name": "Someone Else",
                "avatar_url": "https://avatars.example/other.png",
            },
        )
        db.expire_all()
        row = db.get(User, "user-avatar")
        # A picture the account chose outranks whatever a later sign-in offers.
        assert row.avatar_url == uploaded
        assert row.display_name == "Ada Lovelace"
    finally:
        db.close()
