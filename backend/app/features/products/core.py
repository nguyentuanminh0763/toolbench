"""Pure logic for the Products tab. No fastapi, no db, no settings.

Products are WooCommerce, not core WordPress — they live under /wc/v3/products.
Application Password auth reaches them because WooCommerce checks the logged-in
user's capabilities the same way core WordPress does; no consumer key needed.

Run the checks at the bottom with:

    uv run --frozen python -m app.features.products.core
"""
from __future__ import annotations

from ...core.wordpress import WpError, call

PATH = "/wp-json/wc/v3/products"

# WooCommerce rejects per_page above 100 with a 400.
PER_PAGE_MAX = 100

# A WooCommerce product carries about eighty fields. The table needs these.
FIELDS = (
    "id",
    "name",
    "sku",
    "price",
    "regular_price",
    "sale_price",
    "stock_status",
    "stock_quantity",
    "status",
    "permalink",
    "date_modified",
    "date_modified_gmt",
)

EDITABLE = ("name", "sku", "regular_price", "sale_price", "stock_status", "status", "description")
STOCK_STATUS = ("instock", "outofstock", "onbackorder")
STATUS = ("publish", "draft", "pending", "private")


def _trim(product: dict) -> dict:
    return {key: product.get(key) for key in FIELDS}


def _int(value: object, fallback: int) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return fallback


def _payload(values: dict) -> dict:
    """Validate here, not in the route — so it can be checked without a server."""
    out = {k: v for k, v in values.items() if k in EDITABLE and v is not None}

    if "name" in out:
        out["name"] = str(out["name"]).strip()

    for key in ("regular_price", "sale_price"):
        raw = out.get(key)
        if raw in (None, ""):
            continue
        # WooCommerce stores prices as strings, so a typo sails through and
        # lands as a zero on a live shop. Catch it here instead.
        try:
            float(str(raw).replace(",", "."))
        except ValueError:
            raise WpError(f"{key.replace('_', ' ').capitalize()} must be a number.") from None

    if out.get("stock_status") and out["stock_status"] not in STOCK_STATUS:
        raise WpError(f"Stock status must be one of: {', '.join(STOCK_STATUS)}.")
    if out.get("status") and out["status"] not in STATUS:
        raise WpError(f"Status must be one of: {', '.join(STATUS)}.")

    return out


def _friendlier(error: WpError) -> WpError:
    # ponytail: matching on WordPress's wording. It only ever upgrades the
    # message, so a reworded upstream string costs nothing but the nicety.
    if "No route was found" in str(error):
        return WpError("No WooCommerce on this site — install and activate it, then try again.")
    return error


def list_products(
    base: str,
    user: str,
    app_password: str,
    *,
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    timeout: int = 20,
) -> dict:
    page = max(1, _int(page, 1))
    per_page = min(max(1, _int(per_page, 20)), PER_PAGE_MAX)

    try:
        data, headers = call(
            base,
            user,
            app_password,
            PATH,
            params={"page": page, "per_page": per_page, "search": search},
            timeout=timeout,
        )
    except WpError as e:
        raise _friendlier(e) from e

    if not isinstance(data, list):
        raise WpError("WooCommerce answered with something that is not a product list.")

    return {
        "items": [_trim(p) for p in data],
        "page": page,
        "per_page": per_page,
        "total": _int(headers.get("x-wp-total"), len(data)),
        "pages": _int(headers.get("x-wp-totalpages"), 1),
    }


def create_product(base: str, user: str, app_password: str, values: dict, timeout: int = 20) -> dict:
    body = _payload(values)
    if not body.get("name"):
        raise WpError("A product needs a name.")
    try:
        data, _ = call(base, user, app_password, PATH, method="POST", body=body, timeout=timeout)
    except WpError as e:
        raise _friendlier(e) from e
    return _trim(data if isinstance(data, dict) else {})


def update_product(
    base: str, user: str, app_password: str, product_id: int, values: dict, timeout: int = 20
) -> dict:
    body = _payload(values)
    if not body:
        raise WpError("Nothing to change.")
    data, _ = call(
        base,
        user,
        app_password,
        f"{PATH}/{_int(product_id, 0)}",
        method="PUT",
        body=body,
        timeout=timeout,
    )
    return _trim(data if isinstance(data, dict) else {})


def delete_product(
    base: str, user: str, app_password: str, product_id: int, *, force: bool = False, timeout: int = 20
) -> dict:
    """Trashes by default.

    force=True deletes permanently and WooCommerce offers no undo. This runs
    against a live shop, so the recoverable option is the one that gets to be
    the default.
    """
    data, _ = call(
        base,
        user,
        app_password,
        f"{PATH}/{_int(product_id, 0)}",
        method="DELETE",
        params={"force": "true" if force else "false"},
        timeout=timeout,
    )
    return _trim(data if isinstance(data, dict) else {})


def _check() -> None:
    """Everything that does not need a shop on the other end."""
    assert _int("7", 1) == 7
    assert _int(None, 3) == 3
    assert _int("nonsense", 3) == 3

    assert _payload({"name": "  Lamp  "})["name"] == "Lamp"
    assert "id" not in _payload({"id": 5, "name": "x"}), "only EDITABLE fields go up"
    assert _payload({"regular_price": "19,90"})["regular_price"] == "19,90"

    for bad in ({"regular_price": "cheap"}, {"stock_status": "maybe"}, {"status": "soon"}):
        try:
            _payload(bad)
        except WpError:
            pass
        else:
            raise AssertionError(f"{bad} should have been rejected")

    assert "WooCommerce" in str(_friendlier(WpError("No route was found matching the URL")))
    assert str(_friendlier(WpError("Wrong password"))) == "Wrong password"

    trimmed = _trim({"id": 1, "name": "Lamp", "colour": "red"})
    assert trimmed["id"] == 1 and "colour" not in trimmed
    assert trimmed["date_modified_gmt"] is None, "missing fields come back as None, not KeyError"

    print("products core: all checks pass")


if __name__ == "__main__":
    _check()
