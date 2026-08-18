@echo off
rem Start the server only. Use this when the hotspot is already on.
chcp 65001 >nul
cd /d "%~dp0server"
node server.js
pause
