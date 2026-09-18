"""Server: FastAPI + the built React app, on a single port.

Three safety locks — do not remove:

1. Binds 127.0.0.1 only. Switching to "0.0.0.0" exposes the tool to the LAN.
2. Rejects unknown Host headers. Without this, any website can point their
   domain at 127.0.0.1 and call this API (DNS rebinding).
3. CORS is opened only with --dev, and only for the local Vite port.

Run:
    uv run python -m app.main          # normal, opens the browser
    uv run python -m app.main --dev    # reload on .py change
"""
from __future__ import annotations

import argparse
import socket
import webbrowser
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from . import db
from .api.routes import router
from .features import ROUTERS as FEATURE_ROUTERS

APP_NAME = "Toolbench"
HOST = "127.0.0.1"
PORT = 8770
# No port here: the middleware strips the port before matching, and it rejects
# any pattern whose "*" is not a leading "*." at startup.
ALLOWED_HOSTS = ("localhost", "127.0.0.1")
DEV_ORIGIN = "http://localhost:5173"

# backend/app/main.py -> three levels up is the project root
ROOT = Path(__file__).resolve().parents[2]
WEB_DIST = ROOT / "frontend" / "dist"


def create_app(dev: bool = False) -> FastAPI:
    # Here, not in main(): under --dev the reloader builds the app in a child
    # process that never runs main(), and so would a bare `uvicorn app.main:...`.
    # CREATE TABLE IF NOT EXISTS, so calling it twice costs nothing.
    db.init()

    app = FastAPI(title=APP_NAME, docs_url="/docs", redoc_url=None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(ALLOWED_HOSTS))

    if dev:
        from fastapi.middleware.cors import CORSMiddleware

        app.add_middleware(
            CORSMiddleware,
            allow_origins=[DEV_ORIGIN],
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(router, prefix="/api")
    # Each feature declares its own prefix, so this line never changes.
    for feature_router in FEATURE_ROUTERS:
        app.include_router(feature_router, prefix="/api")
    _mount_frontend(app)
    return app


def create_app_dev() -> FastAPI:
    """Zero-argument factory — uvicorn --reload only accepts an import string."""
    return create_app(dev=True)


def _mount_frontend(app: FastAPI) -> None:
    if WEB_DIST.is_dir():
        # html=True serves index.html at "/". Mount LAST so it does not
        # swallow the /api routes.
        app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
        return

    @app.get("/", response_class=HTMLResponse)
    def not_built() -> str:
        return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Frontend not built</title><style>
body{{font-family:system-ui,Segoe UI,sans-serif;max-width:640px;margin:60px auto;
padding:0 20px;line-height:1.7;color:#1a2330}}
code{{background:#eef1f6;padding:2px 7px;border-radius:5px}}
pre{{background:#0f172a;color:#e2e8f0;padding:16px;border-radius:10px}}
</style></head><body>
<h1>Frontend not built</h1>
<p>The server is fine, but <code>{WEB_DIST}</code> does not exist.</p>
<pre>cd frontend
npm install
npm run build</pre>
<p>The API still works: <a href="/docs">API docs</a>.</p>
</body></html>"""


def _free_port(port: int) -> int:
    """Step to the next port if this one is taken, instead of crashing."""
    for step in range(20):
        candidate = port + step
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind((HOST, candidate))
                return candidate
            except OSError:
                continue
    return port


def main() -> None:
    import uvicorn

    p = argparse.ArgumentParser(description=APP_NAME)
    p.add_argument("--dev", action="store_true", help="reload on .py change")
    p.add_argument("--port", type=int, default=PORT)
    p.add_argument("--no-browser", action="store_true")
    args = p.parse_args()

    port = _free_port(args.port)
    url = f"http://{HOST}:{port}"

    print("=" * 60)
    print(f" {APP_NAME}")
    print("=" * 60)
    print(f" Open:      {url}")
    print(f" API docs:  {url}/docs")
    print(" Stop:      Ctrl + C in this window")
    print("=" * 60)

    if not args.no_browser:
        import threading

        # Small delay so uvicorn is listening before the browser arrives.
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()

    if args.dev:
        # Watch app/ only: node_modules is huge, and every `npm run build`
        # writing to frontend/dist would pointlessly restart the server.
        uvicorn.run("app.main:create_app_dev", factory=True, reload=True,
                    reload_dirs=[str(Path(__file__).parent)],
                    host=HOST, port=port, log_level="warning")
    else:
        uvicorn.run(create_app(), host=HOST, port=port, log_level="warning")


if __name__ == "__main__":
    main()
