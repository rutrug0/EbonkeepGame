@echo off
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"
set "PURGE_DATA=0"
if /I "%~1"=="--purge-data" set "PURGE_DATA=1"

echo Stopping spawned terminals...
for %%T in ("Ebonkeep API" "Ebonkeep Web" "Ebonkeep Desktop") do (
  taskkill /FI "WINDOWTITLE eq %%~T*" /T /F >nul 2>&1
)

echo Stopping docker services...
if "%PURGE_DATA%"=="1" (
  docker compose -f "infra\docker\docker-compose.yml" down -v
) else (
  docker compose -f "infra\docker\docker-compose.yml" down
)

echo Local stack stopped.
exit /b 0
