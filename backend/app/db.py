"""SQLite via the stdlib `sqlite3`. One `data.db` file, nothing to install.

Why settings live in the DB and not in a .env file: the tool gets copied to
other machines and used by non-developers. Asking them to edit .env in Notepad
breaks. In the DB they type it on the Settings screen instead — and `*.db` is
gitignored, so a key can never be committed by accident.

# ponytail: plain key/value on sqlite3. Add SQLModel + Alembic only once the
# tool has real relational tables to migrate.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from . import crypto

DB_PATH = Path(__file__).resolve().parents[1] / "data.db"

# Bookkeeping rows the Settings screen must never see or overwrite.
INTERNAL = ("auth_salt", "auth_check")

# Keys ending in these are secrets: the API returns them masked, never raw.
SECRET_SUFFIXES = ("_key", "_keys", "_password", "_token", "_secret")
# A `_keys` setting holds a JSON list of {id, name, value} instead of one string.
KEY_LIST_SUFFIX = "_keys"
MASK = "••••••••"

# Seeded on first run only — a value edited in the UI is never overwritten.
DEFAULTS = {
    "http_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ToolBot/1.0",
    "http_timeout": "25",
    "ai_provider": "gemini",
    "openai_reasoning": "medium",
}


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init() -> None:
    with connect() as con:
        con.execute(
            "CREATE TABLE IF NOT EXISTS settings ("
            "  key   TEXT PRIMARY KEY,"
            "  value TEXT NOT NULL DEFAULT ''"
            ")"
        )
        con.executemany(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            DEFAULTS.items(),
        )


def is_secret(key: str) -> bool:
    return key.endswith(SECRET_SUFFIXES)


def is_key_list(key: str) -> bool:
    return key.endswith(KEY_LIST_SUFFIX)


def raw(key: str, default: str = "") -> str:
    """Straight out of the table, no decryption. For auth's own bookkeeping."""
    with connect() as con:
        row = con.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_raw(key: str, value: str) -> None:
    with connect() as con:
        con.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )


def get(key: str, default: str = "") -> str:
    """The real, decrypted value. Backend only — never hand this to the browser."""
    stored = raw(key, default)
    return crypto.decrypt(stored) if is_secret(key) else stored


def put(key: str, value: str) -> None:
    """Secrets are encrypted here, at the single boundary to the table — so
    every reader and writer above this line deals in plain text and the
    key-list, masking and merge code needs to know nothing about crypto."""
    set_raw(key, crypto.encrypt(value) if is_secret(key) else value)


def get_int(key: str, default: int) -> int:
    try:
        return int(get(key) or default)
    except ValueError:
        return default


# ------------------------------------------------------------------ key lists


def parse_keys(text: str) -> list[dict]:
    """JSON text -> [{id, name, value}]. Bad JSON yields an empty list, never raises."""
    try:
        items = json.loads(text or "[]")
    except json.JSONDecodeError:
        return []
    if not isinstance(items, list):
        return []
    return [
        {
            "id": str(i.get("id") or ""),
            "name": str(i.get("name") or ""),
            "value": str(i.get("value") or ""),
        }
        for i in items
        if isinstance(i, dict)
    ]


def get_keys(key: str) -> list[dict]:
    """Named keys with real values, in the order the user arranged them."""
    return [e for e in parse_keys(get(key)) if e["value"]]


def get_list(key: str) -> list[str]:
    """Just the key strings, for rotation.

    Trying the next one on a quota error is the caller's job — every provider
    signals "out of quota" differently and the boilerplate cannot guess.
    """
    return [e["value"] for e in get_keys(key)]


def merge_keys(key: str, incoming_raw: str) -> str:
    """Put back the real value of every entry the user left masked.

    Matching is by `id`, not position, so adding, renaming, reordering or
    deleting one key never disturbs the others' stored values.
    """
    stored = {e["id"]: e["value"] for e in parse_keys(get(key))}
    out = []
    for entry in parse_keys(incoming_raw):
        if MASK in entry["value"]:
            entry["value"] = stored.get(entry["id"], "")
        out.append(entry)
    return json.dumps(out, ensure_ascii=False)


# ---------------------------------------------------------------------- read


def _mask(value: str) -> str:
    return MASK + value[-4:]


def snapshot(mask_secrets: bool = True) -> dict[str, str]:
    """Every setting. Masked by default — this is what goes out over the API."""
    with connect() as con:
        rows = con.execute("SELECT key FROM settings ORDER BY key").fetchall()

    out: dict[str, str] = {}
    for row in rows:
        key = row["key"]
        if key in INTERNAL:
            continue
        value = get(key)
        if mask_secrets and is_key_list(key):
            entries = parse_keys(value)
            for e in entries:
                if e["value"]:
                    e["value"] = _mask(e["value"])
            value = json.dumps(entries, ensure_ascii=False)
        elif mask_secrets and is_secret(key) and value:
            value = _mask(value)
        out[key] = value
    return out
