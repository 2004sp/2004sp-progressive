@echo off
setlocal
cd /d "%~dp0"
title 2004Scape Progressive Launcher

rem Engine-TS revision 254 is Bun-targeted. Make sure Bun is available even if it is not on PATH yet.
where bun >nul 2>nul
if errorlevel 1 (
    if exist "%USERPROFILE%\.bun\bin\bun.exe" (
        set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
    )
)
where bun >nul 2>nul
if errorlevel 1 (
    echo Bun is required to build the engine, but it was not found.
    echo Expected location: %USERPROFILE%\.bun\bin\bun.exe
    echo.
    pause
    exit /b 1
)

call :progress 0 "Preparing launcher"

echo.
echo ========================================
echo   2004Scape Progressive Launcher
echo ========================================
echo.

call :progress 10 "Installing engine dependencies"
pushd engine
call npm install
popd

if not exist "engine\.build_complete" (
    call :progress 12 "Building engine (first run only)"
    pushd engine
    set "BUILD_VERBOSE=true"
    call npm run build
    if errorlevel 1 (
        set "BUILD_VERBOSE="
        popd
        echo.
        echo Engine build failed. The full stack trace is shown above.
        echo.
        pause
        exit /b 1
    )
    set "BUILD_VERBOSE="
    echo. > .build_complete
    popd
)

call :progress 15 "Checking files"
if not exist "engine\launcher.ts" (
    echo Could not find engine\launcher.ts.
    echo Make sure you are running this from the server folder.
    echo.
    pause
    exit /b 1
)
if not exist "engine\launcher-job.ps1" (
    echo Could not find engine\launcher-job.ps1.
    echo Make sure your branch is fully up to date.
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
powershell -NoProfile -ExecutionPolicy Bypass -File launcher-job.ps1

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
