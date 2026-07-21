@echo off
setlocal
cd /d "%~dp0"
title 2004Scape Progressive Launcher

call :progress 0 "Preparing launcher"

echo.
echo ========================================
echo   2004Scape Progressive Launcher
echo ========================================
echo.

call :progress 15 "Checking files"
if not exist "engine\launcher.ts" (
    echo Could not find engine\launcher.ts.
    echo Make sure you are running this from the server folder.
    echo.
    pause
    exit /b 1
)

call :progress 35 "Checking Node.js"
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed or is not on PATH.
    echo Install Node.js, then run this file again.
    echo.
    pause
    exit /b 1
)

call :progress 55 "Checking npm/npx"
where npx >nul 2>nul
if errorlevel 1 (
    echo npm/npx is not installed or is not on PATH.
    echo Reinstall Node.js with npm enabled, then run this file again.
    echo.
    pause
    exit /b 1
)

call :progress 75 "Entering engine"
cd engine
call :progress 90 "Starting launcher"
echo Starting launcher...
echo.
npx tsx launcher.ts

echo.
call :progress 100 "Launcher closed"
echo Launcher closed.
pause
exit /b 0

:progress
set "percent=%~1"
set "message=%~2"
if "%percent%"=="0" set "bar=[----------]"
if "%percent%"=="15" set "bar=[##--------]"
if "%percent%"=="35" set "bar=[####------]"
if "%percent%"=="55" set "bar=[######----]"
if "%percent%"=="75" set "bar=[########--]"
if "%percent%"=="90" set "bar=[#########-]"
if "%percent%"=="100" set "bar=[##########]"
echo %bar% %percent%%% %message%
exit /b 0
