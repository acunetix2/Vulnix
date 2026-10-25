"""Fernet round-trip and secret masking."""

import pytest

from app.core import crypto
from app.core.config import settings
from app.core.errors import AppError

SECRET = "fixture-secret-value"


def test_round_trip(monkeypatch) -> None:
    monkeypatch.setattr(settings, "integration_secret_key", "key-one")
    token, hint = crypto.encrypt_secret(SECRET)
    assert token != SECRET
    assert crypto.decrypt_secret(token) == SECRET


def test_hint_shows_only_the_tail(monkeypatch) -> None:
    monkeypatch.setattr(settings, "integration_secret_key", "key-one")
    _, hint = crypto.encrypt_secret(SECRET)
    assert hint == "..." + SECRET[-4:]
    assert SECRET[:-4] not in hint


def test_short_secret_gets_no_hint(monkeypatch) -> None:
    monkeypatch.setattr(settings, "integration_secret_key", "key-one")
    assert crypto.mask_secret("abcd") == "..."


def test_missing_key_fails_closed(monkeypatch) -> None:
    monkeypatch.setattr(settings, "integration_secret_key", "")
    with pytest.raises(AppError) as exc:
        crypto.encrypt_secret(SECRET)
    assert exc.value.status_code == 503


def test_other_key_cannot_decrypt(monkeypatch) -> None:
    monkeypatch.setattr(settings, "integration_secret_key", "key-one")
    token, _ = crypto.encrypt_secret(SECRET)
    monkeypatch.setattr(settings, "integration_secret_key", "key-two")
    assert crypto.decrypt_secret(token) is None


def test_empty_ciphertext_decrypts_to_none(monkeypatch) -> None:
    monkeypatch.setattr(settings, "integration_secret_key", "key-one")
    assert crypto.decrypt_secret(None) is None
    assert crypto.decrypt_secret("") is None
