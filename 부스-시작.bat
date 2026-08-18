@echo off
rem Turn on the mobile hotspot and start the server.
rem Closing this window stops the server.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-booth.ps1"
pause
