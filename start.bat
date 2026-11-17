@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found in PATH.
  echo Please install Node.js from https://nodejs.org, then retry.
  pause
  exit /b 1
)
node server.js
pause
