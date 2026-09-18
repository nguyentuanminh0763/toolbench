@echo off
chcp 65001 >nul
REM For a DEVELOPER machine. End users never need this — frontend/dist is in the
REM repo, so run.bat alone is enough for them.
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
    echo.
    echo  Node is not installed. Get it from https://nodejs.org  ^(LTS^)
    echo.
    pause
    exit /b 1
)

echo [1/3] Installing frontend packages from the lock file...
REM `npm ci` not `npm install`: ci installs the exact versions in
REM package-lock.json. `install` is free to bump them, which is how two
REM machines drift apart.
cd frontend
call npm ci || goto :fail
echo.
echo [2/3] Building the interface...
call npm run build || goto :fail
cd ..

echo.
echo [3/3] Checking the backend...
cd backend
where uv >nul 2>nul
if errorlevel 1 (
    echo.
    echo  uv is not installed. Paste this into PowerShell, then run this again:
    echo.
    echo     powershell -c "irm https://astral.sh/uv/install.ps1 ^| iex"
    echo.
    goto :fail
)
call uv run python check.py || goto :fail
cd ..

echo.
echo  Done. Commit frontend/dist as well, or other machines keep the old interface.
pause
exit /b 0

:fail
echo.
echo  FAILED — read the message above.
pause
exit /b 1
