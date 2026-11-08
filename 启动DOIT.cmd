@echo off
cd /d "%~dp0"
if exist "release\DOIT-win32-x64\DOIT.exe" (
  start "" "release\DOIT-win32-x64\DOIT.exe"
) else (
  echo Please build the app first. See README.md.
  pause
)
