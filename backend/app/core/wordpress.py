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
from urllib.parse import urlparse

# Cheapest endpoint that proves all three things at once: the site is reachable,
# the REST API is exposed, and the credentials are accepted.
PROBE = "/wp-json/wp/v2/users/me"


def normalise_base(base: str) -> str:
    """'example.com/' -> 'https://example.com'. Typing the scheme is a chore."""
    base = base.strip().rstrip("/")
    if base and "://" not in base:
        base = "https://" + base
    return base


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
    # WordPress shows application passwords in groups of four; the spaces are
    # cosmetic and must come out before the header is built.
    token = base64.b64encode(f"{user}:{app_password.replace(' ', '')}".encode()).decode()
    req = urllib.request.Request(
        base + PROBE,
        headers={"Authorization": f"Basic {token}", "Accept": "application/json"},
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
