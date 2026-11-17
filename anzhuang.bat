@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Node.js Installer

echo.
echo  ==============================================
echo    Node.js Installer
echo  ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :notfound

for /f "delims=" %%v in ('node -v') do set NODEV=%%v
echo  [OK] Node.js found in PATH.
echo       Version: !NODEV!
echo.
echo  You can close this window and double-click start.bat.
echo.
pause
exit /b 0

:notfound
echo  [..] Node.js NOT found in system PATH.
echo.
echo  Trying automatic install via winget ...
echo.

where winget >nul 2>nul
if errorlevel 1 goto :nowinget

winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
if not errorlevel 1 goto :installed

echo.
echo  [WARN] winget install failed or was cancelled.
goto :manual

:nowinget
echo  [..] winget is not available on this computer.
goto :manual

:installed
echo.
echo  ==============================================
echo   [OK] Node.js installed successfully!
echo.
echo   IMPORTANT: Close ALL command windows first,
echo   then double-click start.bat to start the system.
echo  ==============================================
echo.
pause
exit /b 0

:manual
echo.
echo  ==============================================
echo   Please install Node.js manually:
echo.
echo   1. The download page will open now
echo   2. Click the green LTS button, download it
echo   3. Run the installer, click Next all the way
echo   4. Then close this window and double-click start.bat
echo  ==============================================
echo.
start "" "https://nodejs.org/en/download"
echo  Opening nodejs.org ...
echo.
pause
exit /b 0
