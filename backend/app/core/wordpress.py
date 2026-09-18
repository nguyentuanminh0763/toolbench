"""Talking to WordPress. Pure logic — takes values in, returns a result out.

No fastapi and no db import here, so it can be called from a CLI or a test with
made-up values. That is the rule for everything under core/.

One GET with Basic auth does not justify a dependency; urllib is enough.
"""
from __future__ import annotations

import base64
import json
import urllib.error
import urllib.request
from urllib.parse import urlencode, urlparse

# Cheapest endpoint that proves all three things at once: the site is reachable,
# the REST API is exposed, and the credentials are accepted.
PROBE = "/wp-json/wp/v2/users/me"


class WpError(Exception):
    """A sentence meant for the user. The route turns it into a 400."""


def normalise_base(base: str) -> str:
    """'example.com/' -> 'https://example.com'. Typing the scheme is a chore."""
    base = base.strip().rstrip("/")
    if base and "://" not in base:
        base = "https://" + base
    return base


def _basic(user: str, app_password: str) -> str:
    # WordPress shows application passwords in groups of four; the spaces are
    # cosmetic and must come out before the header is built.
    return base64.b64encode(f"{user}:{app_password.replace(' ', '')}".encode()).decode()


def call(
    base: str,
    user: str,
    app_password: str,
    path: str,
    *,
    method: str = "GET",
    params: dict | None = None,
    body: dict | None = None,
    timeout: int = 20,
) -> tuple[object, dict[str, str]]:
    """One authenticated REST call. Returns (parsed json, response headers).

    The headers are not incidental: WordPress reports the row count in
    X-WP-Total and the page count in X-WP-TotalPages, and there is nowhere
    else to read them from. Raises WpError with something worth showing.
    """
    base = normalise_base(base)
    if not base:
        raise WpError("No site URL yet — fill it in under Settings → Connections.")
    if not user or not app_password:
        raise WpError("No username or application password yet — Settings → Connections.")
    # Same rule as test_connection: never put the password on the wire in clear.
    if urlparse(base).scheme != "https":
        raise WpError("Use https — over http the application password is sent in clear text.")

    url = base + path
    if params:
        # Drop the empties so an untouched search box does not become "search=".
        clean = {k: str(v) for k, v in params.items() if v not in ("", None)}
        if clean:
            url += "?" + urlencode(clean)

    payload = json.dumps(body).encode() if body is not None else None
    headers = {
        "Authorization": f"Basic {_basic(user, app_password)}",
        "Accept": "application/json",
    }
    if payload is not None:
        headers["Content-Type"] = "application/json"

    host = urlparse(base).netloc or base
    req = urllib.request.Request(url, data=payload, method=method, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read()
            got = {k.lower(): v for k, v in res.headers.items()}
    except urllib.error.HTTPError as e:
        raise WpError(_explain_api(e, host)) from e
    except urllib.error.URLError as e:
        raise WpError(f"Cannot reach {host} — {e.reason}") from e
    except TimeoutError as e:
        raise WpError(f"{host} did not answer within {timeout} seconds.") from e

    if not raw:
        return None, got
    try:
        return json.loads(raw), got
    except json.JSONDecodeError as e:
        raise WpError(f"{host} answered, but not with JSON.") from e


def _explain_api(e: urllib.error.HTTPError, host: str) -> str:
    # WordPress puts a written sentence in the body — "Sorry, you are not
    # allowed to edit this product" beats anything we could invent from a code.
    try:
        message = json.loads(e.read()).get("message")
    except Exception:  # error path: a failure here must not hide the HTTP error
        message = None
    if message:
        return str(message)
    if e.code == 401:
        return "Wrong username or application password."
    if e.code == 403:
        return "The site rejected this account. A security plugin may be blocking the REST API."
    return f"{host} returned HTTP {e.code}."


def test_connection(base: str, user: str, app_password: str, timeout: int = 20) -> dict:
    """{ok, message} — never raises, the caller shows `message` as-is."""
    base = normalise_base(base)
    if not base:
        return {"ok": False, "message": "Fill in the site URL first."}
    if not user or not app_password:
        return {"ok": False, "message": "Fill in the username and application password first."}

    parts = urlparse(base)
    host = parts.netloc or base
    # Basic auth over plain http puts the application password on the wire in
    # clear text. Refuse rather than warn: nobody reads a warning that sits
    # next to a green tick.
    if parts.scheme != "https":
        return {
            "ok": False,
            "message": "Use https — over http the application password is sent in clear text.",
        }
    req = urllib.request.Request(
        base + PROBE,
        headers={"Authorization": f"Basic {_basic(user, app_password)}", "Accept": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            me = json.loads(res.read())
    except urllib.error.HTTPError as e:
        return {"ok": False, "message": _explain(e, host)}
    except urllib.error.URLError as e:
        return {"ok": False, "message": f"Cannot reach {host} — {e.reason}"}
    except (TimeoutError, json.JSONDecodeError):
        return {"ok": False, "message": f"{host} answered, but not with WordPress JSON."}

    name = me.get("name") or me.get("slug") or "unknown"
    roles = ", ".join(me.get("roles") or []) or "no role reported"
    # Reading works with any account; writing needs edit rights. Say so now
    # rather than letting the first publish fail with a bare 403.
    can_write = bool((me.get("capabilities") or {}).get("edit_posts"))
    suffix = "" if can_write else " — read only, this account cannot create posts"
    return {"ok": True, "message": f"Connected as {name} ({roles}){suffix}"}


def _explain(e: urllib.error.HTTPError, host: str) -> str:
    if e.code == 401:
        return "Wrong username or application password."
    if e.code == 403:
        return "The site rejected this account. A security plugin may be blocking the REST API."
    if e.code == 404:
        return f"No REST API at {host}. Check the URL, or whether /wp-json is disabled."
    return f"{host} returned HTTP {e.code}."
