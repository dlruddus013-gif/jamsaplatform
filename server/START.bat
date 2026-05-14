@echo off
title JamsaMuseum Server
color 0A
echo.
echo  ========================================
echo    JamsaMuseum Server Starting...
echo  ========================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Node.js not found!
    echo  Download from https://nodejs.org
    goto DONE
)
echo  [OK] Node.js found

if not exist "package.json" (
    echo  [ERROR] package.json not found!
    goto DONE
)
echo  [OK] package.json found

if not exist "node_modules" (
    echo.
    echo  Installing packages... please wait 3-5 min
    echo.
    call npm install
)

if not exist "node_modules\puppeteer" (
    echo.
    echo  Installing Puppeteer... please wait 3-5 min
    echo.
    call npm install puppeteer
)

echo.
echo  Starting server...
echo  URL: http://localhost:3500
echo.

start "" "http://localhost:3500" >nul 2>nul

set NO_BROWSER=1
node server.js

echo.
echo  ========================================
echo  Server stopped. Check error above.
echo  ========================================

:DONE
echo.
echo  Press any key to close...
pause >nul
