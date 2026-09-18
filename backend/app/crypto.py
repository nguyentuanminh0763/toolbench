"""Encryption of the secret settings, keyed by a password the user types.

Threat this actually addresses: someone copies `data.db` off the machine. They
get ciphertext and nothing else. A login screen alone would not have helped —
the file is readable by any SQLite viewer.

The derived key lives in memory only, for as long as the server runs. Stopping
the tool locks it again. There is no recovery: forget the password and the
stored keys are gone, which is the point.

Fernet = AES-128-CBC + HMAC-SHA256, authenticated. scrypt makes guessing the
password expensive. Both come from `cryptography` — never hand-roll this part.
"""
from __future__ import annotations

import base64
import os

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

PREFIX = "enc:"

# n=2**15 costs ~100 ms per attempt here — unnoticeable once at unlock, brutal
# for anyone trying a password list against a stolen data.db.
_SCRYPT = dict(length=32, n=2**15, r=8, p=1)

_key: bytes | None = None


def new_salt() -> str:
    return base64.b64encode(os.urandom(16)).decode()


def derive(password: str, salt_b64: str) -> bytes:
    salt = base64.b64decode(salt_b64)
    raw = Scrypt(salt=salt, **_SCRYPT).derive(password.encode())
    return base64.urlsafe_b64encode(raw)


def unlock_with(key: bytes) -> None:
    global _key
    _key = key


def lock() -> None:
    global _key
    _key = None


def is_unlocked() -> bool:
    return _key is not None


def encrypt(plain: str) -> str:
    """Empty stays empty — no point storing ciphertext for a blank field."""
    if not plain:
        return ""
    if _key is None:
        raise RuntimeError("locked: cannot encrypt before unlock")
    return PREFIX + Fernet(_key).encrypt(plain.encode()).decode()


def decrypt(stored: str) -> str:
    """Anything without the prefix is returned as-is, so a value written before
    encryption existed still reads back instead of blowing up."""
    if not stored or not stored.startswith(PREFIX):
        return stored
    if _key is None:
        return ""
    try:
        return Fernet(_key).decrypt(stored[len(PREFIX):].encode()).decode()
    except InvalidToken:
        # Wrong key, or the row was tampered with. Report nothing rather than
        # handing back garbage that would be sent to an API as a credential.
        return ""
