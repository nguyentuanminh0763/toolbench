"""Thin HTTP layer. No business logic here.

New feature: write pure logic in `app/core/<name>.py`, then call it from here.
Anything that touches settings gets `Depends(auth.require)`.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .. import auth, db
from ..core import wordpress

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"ok": True}


# --------------------------------------------------------------------- auth


class PasswordIn(BaseModel):
    password: str


@router.get("/auth/state")
def auth_state() -> dict:
    """Open on purpose — the UI has to know which screen to show before login."""
    return auth.state()


@router.post("/auth/setup")
def auth_setup(body: PasswordIn) -> dict:
    return {"token": auth.setup(body.password)}


@router.post("/auth/unlock")
def auth_unlock(body: PasswordIn) -> dict:
    return {"token": auth.unlock(body.password)}


@router.post("/auth/lock")
def auth_lock() -> dict:
    auth.lock()
    return {"ok": True}


# ----------------------------------------------------------------- settings


class SettingsIn(BaseModel):
    values: dict[str, str]


@router.get("/settings", dependencies=[Depends(auth.require)])
def read_settings() -> dict[str, str]:
    """Secrets come back masked. Real keys never reach the browser."""
    return db.snapshot(mask_secrets=True)


@router.put("/settings", dependencies=[Depends(auth.require)])
def write_settings(body: SettingsIn) -> dict[str, str]:
    for key, value in body.values.items():
        if key in db.INTERNAL:
            continue
        if db.is_key_list(key):
            # Per entry: a masked one keeps its stored value, a typed one wins.
            # Lets the user add a fourth key without retyping the first three.
            db.put(key, db.merge_keys(key, value))
        elif db.is_secret(key) and db.MASK in value:
            # Field still shows the mask and was not retyped — keep what is
            # stored. Without this guard, one Save turns the key into "••••".
            continue
        else:
            db.put(key, value)
    return db.snapshot(mask_secrets=True)


@router.post("/wordpress/test", dependencies=[Depends(auth.require)])
def wordpress_test() -> dict:
    """Tests the SAVED settings on purpose — the password never has to travel
    back up from the browser just to be checked."""
    return wordpress.test_connection(
        db.get("wp_base"),
        db.get("wp_user"),
        db.get("wp_app_password"),
        timeout=db.get_int("http_timeout", 20),
    )
