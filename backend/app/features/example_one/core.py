"""Pure logic for Example one. No fastapi, no db, no network.

Keeping it that way is what lets you call it from a script, or check it with a
plain `assert`, without starting a server.
"""
from __future__ import annotations

from datetime import datetime


def summary(now: datetime | None = None) -> dict:
    """Whatever this feature computes. Replace the body, keep the shape.

    `now` is injectable so a test can pin the clock instead of hoping the
    assertion runs in the same second.
    """
    now = now or datetime.now()
    return {
        "title": "Example one",
        "rows": [
            {"label": "Generated at", "value": now.strftime("%H:%M:%S")},
            {"label": "Day of year", "value": str(now.timetuple().tm_yday)},
        ],
    }
