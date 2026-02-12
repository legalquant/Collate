@echo off
setlocal enabledelayedexpansion
title Collate
echo.
echo   Collate - See every comment in one place
echo   ─────────────────────────────────────────
echo.

:: ─── Check Node.js is available ───────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Node.js is not installed or not on PATH.
    echo   Download it from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: ─── Kill any previous Collate server on ports 5173/4173 ──────────
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo   Stopping previous instance ^(PID %%a^)...
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":4173 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: ─── Navigate to web directory ────────────────────────────────────
cd /d "%~dp0web"

:: ─── Install dependencies if needed ──────────────────────────────
if not exist "node_modules" (
    echo   Installing dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo   npm install failed. Check the output above.
        pause
        exit /b 1
    )
    echo.
)

:: ─── Build if needed ──────────────────────────────────────────────
if not exist "dist\index.html" (
    echo   Building production bundle...
    echo.
    call npm run build
    if errorlevel 1 (
        echo.
        echo   Build failed. Check the output above.
        pause
        exit /b 1
    )
    echo.
)

:: ─── Open browser first (server takes a moment) ──────────────────
echo   Starting server...
start "" "http://localhost:5173"

:: ─── Serve using the local vite binary directly ───────────────────
:: Using the local binary avoids npx resolution issues in CMD
echo.
echo   ─────────────────────────────────────────
echo   Collate is running at http://localhost:5173
echo   Press Ctrl+C or close this window to stop.
echo   ─────────────────────────────────────────
echo.

:: Run vite preview in the foreground — closing this window kills it
call "node_modules\.bin\vite.cmd" preview --port 5173 --strictPort
