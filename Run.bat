@echo off
setlocal
cd /d "%~dp0"
title 2004Scape Compact Manager
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required to run 2004Scape.
  echo Install Node.js and run Run.bat again.
  pause
  exit /b 1
)
node launcher\manager.js
