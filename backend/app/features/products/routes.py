"""HTTP layer for Products. Reads the saved WordPress settings, calls core.

The credentials never travel up to the browser: the screen sends a product id
and the fields to change, this layer supplies the site and the password.
"""
from __future__ import annotations

from typing import Callable

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ... import auth, db
from ...core.wordpress import WpError
from . import core

router = APIRouter(
    prefix="/products",
    tags=["products"],
    dependencies=[Depends(auth.require)],
)


class ProductIn(BaseModel):
    """Every field optional: create needs a name, edit sends only what changed."""

    name: str | None = None
    sku: str | None = None
    regular_price: str | None = None
    sale_price: str | None = None
    stock_status: str | None = None
    status: str | None = None
    description: str | None = None


def _site() -> tuple[str, str, str, int]:
    return (
        db.get("wp_base"),
        db.get("wp_user"),
        db.get("wp_app_password"),
        db.get_int("http_timeout", 20),
    )


def _run(fn: Callable, *args, **kwargs):
    """core raises sentences meant for the user; the browser wants a 400."""
    try:
        return fn(*args, **kwargs)
    except WpError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("")
def list_products(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    orderby: str = "date",
    order: str = "desc",
    status: str = "",
    stock_status: str = "",
) -> dict:
    base, user, password, timeout = _site()
    return _run(
        core.list_products,
        base,
        user,
        password,
        page=page,
        per_page=per_page,
        search=search,
        orderby=orderby,
        order=order,
        status=status,
        stock_status=stock_status,
        timeout=timeout,
    )


@router.post("")
def create_product(body: ProductIn) -> dict:
    base, user, password, timeout = _site()
    return _run(core.create_product, base, user, password, body.model_dump(exclude_none=True), timeout)


@router.put("/{product_id}")
def update_product(product_id: int, body: ProductIn) -> dict:
    base, user, password, timeout = _site()
    return _run(
        core.update_product, base, user, password, product_id, body.model_dump(exclude_none=True), timeout
    )


@router.delete("/{product_id}")
def delete_product(product_id: int, force: bool = False) -> dict:
    base, user, password, timeout = _site()
    return _run(core.delete_product, base, user, password, product_id, force=force, timeout=timeout)
