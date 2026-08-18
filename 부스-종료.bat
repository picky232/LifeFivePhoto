@echo off
rem Stop the server and turn off the mobile hotspot.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-booth.ps1"
pause
