@echo off
setlocal
cd /d "%~dp0"
title 2004Scape Progressive Launcher

echo.
echo ========================================
echo   2004Scape Progressive Launcher
echo ========================================
echo.

if not exist "engine\launcher.ts" (
    echo Could not find engine\launcher.ts.
    echo Make sure you are running this from the server folder.
    echo.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed or is not on PATH.
    echo Install Node.js, then run this file again.
    echo.
    pause
    exit /b 1
)

where npx >nul 2>nul
if errorlevel 1 (
    echo npm/npx is not installed or is not on PATH.
    echo Reinstall Node.js with npm enabled, then run this file again.
    echo.
    pause
    exit /b 1
)

cd engine
echo Starting launcher...
echo.
npx tsx launcher.ts

echo.
echo Launcher closed.
pause
