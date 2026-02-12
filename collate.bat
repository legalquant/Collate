@echo off
title Collate — Document Review
echo.
echo  ╔═══════════════════════════════════════════╗
echo  ║  Collate — See every comment in one place ║
echo  ╚═══════════════════════════════════════════╝
echo.

:: ─── Kill any previous Collate server instances ───────────────────
echo  Checking for previous instances...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo  Stopping previous instance (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4173 " ^| findstr "LISTENING"') do (
    echo  Stopping previous preview instance (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
)

:: ─── Check if production build exists ─────────────────────────────
if not exist "%~dp0web\dist\index.html" (
    echo.
    echo  No production build found. Building...
    echo.
    cd /d "%~dp0web"
    call npm run build
    if errorlevel 1 (
        echo.
        echo  Build failed. Please check for errors above.
        pause
        exit /b 1
    )
)

:: ─── Serve the production build ───────────────────────────────────
echo.
echo  Starting Collate...
echo  Press Ctrl+C to stop.
echo.

cd /d "%~dp0web"

:: Use vite preview (serves the dist folder on port 4173)
:: Start it in the background, then open the browser
start "" /B npx vite preview --port 5173 --strictPort

:: Wait for server to start
timeout /t 2 /nobreak >nul

:: Open in default browser
start "" "http://localhost:5173"

echo  ───────────────────────────────────────────
echo  Collate is running at http://localhost:5173
echo  Close this window to stop the server.
echo  ───────────────────────────────────────────
echo.

:: Keep the window open (the server runs in background)
:: When user closes window, the server process dies too
cmd /k
