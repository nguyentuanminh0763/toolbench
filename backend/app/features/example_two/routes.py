"""HTTP layer for Example two — a screen that sends something in."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ... import auth
from . import core

router = APIRouter(
    prefix="/example-two",
    tags=["example-two"],
    dependencies=[Depends(auth.require)],
)


class ProcessIn(BaseModel):
    text: str


@router.post("/process")
def process(body: ProcessIn) -> dict:
    try:
        return core.process(body.text)
    except core.InvalidInput as e:
        # core raises a plain exception; turning it into HTTP is the route's
        # job, which is what keeps core importable without fastapi.
        raise HTTPException(400, str(e))
