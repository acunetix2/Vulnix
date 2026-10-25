"""Encryption for integration secrets.

Secrets are encrypted at rest and write-only over the API: no response ever
returns plaintext, only a short masked hint.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.core.errors import AppError

_HINT_MAX_CHARS = 4


def _fernet() -> Fernet:
    raw = settings.integration_secret_key
    if not raw:
        raise AppError("SERVER_MISCONFIGURED", "Integration secrets are not configured.", 503)
    # Deriving the key lets operators supply any passphrase instead of having to
    # generate a Fernet key of their own.
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(raw.encode("utf-8")).digest()))


def mask_secret(value: str) -> str:
    stripped = value.strip()
    if len(stripped) <= _HINT_MAX_CHARS:
        # A hint that is the whole secret is not a hint.
        return "..."
    return "..." + stripped[-_HINT_MAX_CHARS:]


def encrypt_secret(value: str) -> tuple[str, str]:
    """Return (ciphertext, masked hint) for a new secret."""
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii"), mask_secret(value)


def decrypt_secret(ciphertext: str | None) -> str | None:
    # A rotated or corrupt key yields None rather than an exception, so one bad
    # row cannot break a whole delivery batch.
    if not ciphertext:
        return None
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None
