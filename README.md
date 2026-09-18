# Tool Boilerplate

FastAPI + React + SQLite, served on a single local port. Starting point for
internal tools that get copied to other machines.

```
backend/
  pyproject.toml          dependencies, managed by uv
  app/
    main.py               server: single port, localhost-only, serves the built UI
    db.py                 SQLite key/value settings, secrets encrypted
    crypto.py  auth.py    password, encryption, session token
    api/routes.py         shell endpoints: health, auth, settings
    core/                 logic shared by several features
    features/
      __init__.py         the registry — one line per feature
      example_one/
        core.py           pure logic, no fastapi
        routes.py         this feature's endpoints, own URL prefix
      example_two/
frontend/
  src/
    App.tsx               shell; the sidebar is built from the registry
    lib/api.ts            request(), auth, settings
    features/
      index.ts            the registry — one line per tab
      example-one/
        Page.tsx          the screen
        api.ts            this feature's calls
      example-two/
    pages/                shell screens: Home, Settings, Lock
    styles.css            all styling
run.bat                   double-click to start
```

## Run it

Double-click **`build.bat`** once (installs packages, builds the interface,
runs the checks), then **`run.bat`** every time after.

By hand:

```bash
cd frontend && npm ci && npm run build
```

```bash
cd backend && uv run python -m app.main
```

Opens <http://127.0.0.1:8765> automatically. API docs at `/docs`.

**Give every tool its own port.** Change `PORT` in `backend/app/main.py` before
the first run. Two local tools sharing 8765 means the browser serves tool A's
cached interface against tool B's API — you get a dead UI and a "Not Found"
that points nowhere near the real cause.

## Develop

Two terminals — the Vite dev server proxies `/api` to the Python one, so there
is still only one address to open.

```bash
cd backend && uv run python -m app.main --dev --no-browser
```

```bash
cd frontend && npm run dev
```

Open <http://localhost:5173>. Both sides hot-reload.

## Move it to another machine

The other person needs **neither Python nor Node**.

1. They install uv once — no admin rights needed:
   ```
   powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```
2. Get the files: `git clone`, or GitHub's **Download ZIP**.
3. **If it came as a ZIP: right-click it → Properties → tick Unblock → OK,
   then extract.** Windows tags everything inside a downloaded archive, and
   SmartScreen blocks the `.bat` files with a message that does not explain
   itself. Unblocking the ZIP first saves that fight; after extracting you
   would have to unblock each file separately.
4. Double-click `run.bat`. First run takes about a minute while uv fetches
   Python 3.12 and the locked dependencies.

A ZIP has no git history, so updates mean downloading again. `git clone` lets
them `git pull` instead.

Five files make that work. Losing any one of them is how "it runs on my
machine" starts:

| File | Commit it | Why |
|---|---|---|
| `backend/uv.lock` | **yes** | exact versions of all 49 packages. Without it the other machine resolves the newest ones and you are debugging a different program |
| `backend/.python-version` | **yes** | uv downloads this exact Python, whatever is installed locally |
| `frontend/package-lock.json` | **yes** | same idea for npm — and use `npm ci`, not `npm install`, which is free to bump versions |
| `frontend/dist/` | **yes** | the built interface. No Node on the target machine, so the build has to travel with it |
| `.gitattributes` | **yes** | keeps `.bat` on CRLF; cmd.exe misreads LF-only batch files |
| `backend/data.db` | **never** | your keys, and it is encrypted with your password anyway |

After changing anything in `frontend/src/`, run `npm run build` and commit
`dist/` too — otherwise everyone else keeps seeing the old interface. This is
the single easiest thing to forget.

## Before you trust a change

```bash
cd backend && uv run python check.py    # must print 7/7 PASS
```

Covers encryption round-trip, ciphertext on disk, wrong-password behaviour,
secret masking, and the key-list merge. Those are the parts that fail silently;
everything else shows on screen the moment it breaks.

## The password

First launch asks for a password; every launch after that asks to unlock. It
derives an encryption key (scrypt) that encrypts every secret setting before it
touches `data.db`. Copying that file to another machine yields ciphertext.

- The password itself is never stored — only a salt and a verifier.
- The key lives in memory. Stopping the tool locks it again.
- **There is no reset.** Lose the password and the stored keys are unrecoverable.
- Each person you give the tool to sets their own password and enters their own
  keys. Nothing is shared.

Backups are a separate matter: `data.db` is one file, so copy it somewhere safe.
Restoring it needs the same password.

## Starting a new tool from this

On GitHub: **Settings → tick "Template repository"**. Once, ever.

Then for each new tool: green **Use this template → Create a new repository**.
You get a fresh repo with its own history and no fork link back here.

Four values to change, then it is yours:

| Where | Change |
|---|---|
| `backend/app/main.py:30` | `APP_NAME` |
| `backend/app/main.py:32` | `PORT` — **give every tool its own number.** Two tools on 8765 means the browser serves one tool's cached interface against the other's API |
| `frontend/src/App.tsx:40` | the sidebar `brand` |
| `frontend/index.html:6` | the `<title>` |

Then delete the examples and their two registry lines:

```
backend/app/features/example_one/   example_two/
frontend/src/features/example-one/  example-two/
```

A template is a one-time copy: improvements made here later do not flow into
projects already created from it. Wiring that up (subtree, submodule) costs
more attention than it saves until you are past three or four tools — copy the
one file you want across instead.

## Adding a feature

One tab, one folder on each side. Copy `example_one` / `example-one`, rename,
then add one line to each registry.

```
backend/app/features/my_thing/
  core.py      pure logic — no fastapi, no db, no network
  routes.py    APIRouter(prefix="/my-thing"), calls core
frontend/src/features/my-thing/
  Page.tsx     the screen
  api.ts       this feature's calls, built on request()
```

```python
# backend/app/features/__init__.py
from .my_thing.routes import router as my_thing
ROUTERS = [example_one, example_two, my_thing]
```

```ts
// frontend/src/features/index.ts
{ id: 'my-thing', label: 'My thing', Page: MyThing },
```

That is all — `main.py` and `App.tsx` never change. The sidebar order is the
order of that list.

Two rules that keep this working:

- **`core.py` imports nothing from the framework.** It takes plain values and
  returns plain values, so you can run it from a script or check it with a bare
  `assert` without starting a server. Validation belongs there too; the route
  turns the exception into a 400.
- **Only `lib/api.ts` calls `fetch`.** A feature's `api.ts` uses `request()`
  from it, so every call keeps the auth header and the same error handling.

Logic shared by more than one feature goes in `backend/app/core/` —
`wordpress.py` is there for that reason.

Settings fields: add a line to `GROUPS` in `pages/Settings.tsx`. Nothing to
change in the backend. Field types: `text`, `number`, `select`, `secret`,
`secret-list`.

Keys ending in `_key`, `_keys`, `_password`, `_token` or `_secret` are treated
as secrets automatically — returned masked, and saving a masked value keeps the
stored one. A secret field is replace-all: press **Change** to clear it and
retype. Merging typed lines with masked ones would be guesswork.

Multiple API keys go in a `secret-list` field, one per line. Read them with:

```python
for key in db.get_list("gemini_api_keys"):
    ...  # try this key, move to the next one on a quota error
```

The fallback loop itself is the tool's job — every provider signals "out of
quota" differently.

## Deliberately left out

| Not here | Add when |
|---|---|
| Change / reset password | someone actually needs to rotate it (re-encrypt every secret) |
| Background job runner | the tool has work that takes over ~30 seconds |
| Login / users | more than one person uses the same instance |
| ORM (SQLModel) + migrations | there are real relational tables |
| Tailwind / component library | the UI passes ~10 screens |
| Generated API client | the API passes ~15 endpoints |
| Docker, Postgres, CI | it is deployed to a server instead of copied |
