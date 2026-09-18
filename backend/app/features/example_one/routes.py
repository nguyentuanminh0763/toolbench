"""HTTP layer for Example one — a read-only screen.

The prefix is declared here, so the feature owns its whole URL space and
main.py never has to know about it.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ... import auth
from . import core

router = APIRouter(
    prefix="/example-one",
    tags=["example-one"],
    # Drop this line if the feature must work before unlocking.
    dependencies=[Depends(auth.require)],
)


@router.get("/summary")
def summary() -> dict:
    return core.summary()
