"""Pure logic for Example two. No fastapi, no db, no network.

This one takes input, so it also shows where validation belongs: in here, at
the trust boundary, not scattered through the route.
"""
from __future__ import annotations


class InvalidInput(ValueError):
    """Raised for input the user can fix. The route turns it into a 400."""


def process(text: str) -> dict:
    """Whatever this feature does to its input. Replace the body, keep the shape."""
    text = text.strip()
    if not text:
        raise InvalidInput("Type something first.")
    if len(text) > 500:
        raise InvalidInput("Too long — 500 characters at most.")

    words = text.split()
    return {
        "characters": len(text),
        "words": len(words),
        "unique_words": len({w.lower() for w in words}),
    }
