"""Password setup, unlock, and the session token that gates the API.

The password is never stored — only a salt and a verifier (a known string
encrypted with the derived key). Unlock derives the key and tries to read the
verifier back; if that works, the password was right.

Why a token on top of the password: the server listens on localhost, so a page
on the internet can still aim a request at 127.0.0.1. It cannot read the reply
(CORS is closed) but it could write. Requiring a custom header forces a CORS
preflight, which fails — so a blind cross-origin write cannot reach the API.
"""
from __future__ import annotations

import secrets

from fastapi import Header, HTTPException

from . import crypto, db

SALT_KEY = "auth_salt"
CHECK_KEY = "auth_check"
CHECK_VALUE = "unlocked"
MIN_LENGTH = 8

# Session tokens are in memory only: restarting the tool logs everyone out.
_tokens: set[str] = set()


def is_configured() -> bool:
    return bool(db.raw(SALT_KEY))


def state() -> dict:
    return {"configured": is_configured(), "unlocked": crypto.is_unlocked()}


def setup(password: str) -> str:
    if is_configured():
        raise HTTPException(409, "A password is already set for this installation.")
    if len(password) < MIN_LENGTH:
        raise HTTPException(400, f"Password must be at least {MIN_LENGTH} characters.")

    salt = crypto.new_salt()
    crypto.unlock_with(crypto.derive(password, salt))
    db.set_raw(SALT_KEY, salt)
    db.set_raw(CHECK_KEY, crypto.encrypt(CHECK_VALUE))
    return _issue()


def unlock(password: str) -> str:
    salt = db.raw(SALT_KEY)
    if not salt:
        raise HTTPException(409, "No password has been set yet.")

    crypto.unlock_with(crypto.derive(password, salt))
    if crypto.decrypt(db.raw(CHECK_KEY)) != CHECK_VALUE:
        crypto.lock()
        raise HTTPException(401, "Wrong password.")
    return _issue()


def lock() -> None:
    _tokens.clear()
    crypto.lock()


def _issue() -> str:
    token = secrets.token_urlsafe(32)
    _tokens.add(token)
    return token


def require(x_auth: str = Header(default="")) -> None:
    """FastAPI dependency. Put it on every route that touches settings."""
    if not crypto.is_unlocked() or x_auth not in _tokens:
        raise HTTPException(401, "Locked. Enter the password again.")
