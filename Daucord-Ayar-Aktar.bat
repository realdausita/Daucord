@echo off
title Daucord Ayar Aktarimi
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js bulunamadi. Lutfen Node.js LTS kurun: https://nodejs.org
    pause
    exit /b 1
)
node "%~dp0installer\migrate-equicord.mjs" %*
echo.
pause
