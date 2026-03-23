@echo off
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo Restarting local stack...
call "%ROOT%stop-local.bat"
if errorlevel 1 (
  echo Stop failed. Aborting restart.
  pause
  exit /b 1
)

timeout /t 5 /nobreak >nul

call "%ROOT%run-local.bat"
exit /b %errorlevel%
