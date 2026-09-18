@echo off
chcp 65001 >nul
cd /d "%~dp0backend"

where uv >nul 2>nul
if errorlevel 1 (
    echo.
    echo  uv is not installed. Paste this into PowerShell, then run this file again:
    echo.
    echo     powershell -c "irm https://astral.sh/uv/install.ps1 ^| iex"
    echo.
    pause
    exit /b 1
)

REM First run downloads Python and the dependencies, about a minute.
uv run python -m app.main
pause
