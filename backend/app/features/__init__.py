"""One folder per feature. Everything a feature owns lives inside its folder.

    features/<name>/
        core.py     pure logic — no fastapi, no db; callable from a test or a CLI
        routes.py   the HTTP layer for this feature, and nothing else

Adding one: copy `example_one`, rename, then add a line below. The registry is
an explicit list on purpose — scanning the folder to auto-import would save
one line and cost you every debugging session where a feature silently fails
to load.
"""
from .products.routes import router as products

ROUTERS = [products]
