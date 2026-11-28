@echo off
title Daucord Kaldirma
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js bulunamadi. Lutfen Node.js LTS kurun: https://nodejs.org
    pause
    exit /b 1
)
node "%~dp0installer\daucord-installer.mjs" uninstall %*
echo.
pause
