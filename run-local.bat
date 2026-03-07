@echo off
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"
set "FAILED=0"

echo [1/8] Checking prerequisites...
where docker >nul 2>&1
if errorlevel 1 (
  echo Docker is required but was not found in PATH.
  set "FAILED=1"
  goto :fail
)
docker compose version >nul 2>&1
if errorlevel 1 (
  echo Docker Compose v2 plugin is required but not available.
  set "FAILED=1"
  goto :fail
)
docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop is installed but not running.
  echo Start Docker Desktop and wait until engine status is healthy, then rerun.
  set "FAILED=1"
  goto :fail
)
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required but was not found in PATH.
  set "FAILED=1"
  goto :fail
)
for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%v"
if %NODE_MAJOR% LSS 22 (
  echo Node.js 22.x or newer is required. Found major version %NODE_MAJOR%.
  set "FAILED=1"
  goto :fail
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo npm is required but was not found in PATH.
  set "FAILED=1"
  goto :fail
)
for /f %%v in ('npm.cmd -v') do set "NPM_VERSION=%%v"
for /f "tokens=1 delims=." %%v in ("%NPM_VERSION%") do set "NPM_MAJOR=%%v"
if %NPM_MAJOR% LSS 10 (
  echo npm 10+ is required. Found version %NPM_VERSION%.
  echo This repo uses npm workspaces.
  set "FAILED=1"
  goto :fail
)

if not exist ".env" (
  echo [2/8] Creating .env from .env.example...
  copy /y ".env.example" ".env" >nul
)
echo [2/8] Normalizing default local DB URL...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$path='.env'; if (Test-Path $path) { $raw=Get-Content -Raw $path; $old='DATABASE_URL=postgresql://ebonkeep:ebonkeep@localhost:5432/ebonkeep?schema=public'; $new='DATABASE_URL=postgresql://ebonkeep:ebonkeep@localhost:55432/ebonkeep?schema=public'; if ($raw.Contains($old)) { $raw=$raw.Replace($old,$new); Set-Content -Path $path -Value $raw -Encoding UTF8 -NoNewline; Write-Output 'Updated DATABASE_URL port to 55432 in .env'; } }"
if errorlevel 1 (
  echo Failed to normalize .env database URL.
  set "FAILED=1"
  goto :fail
)
echo [2/8] Syncing app env files...
copy /y ".env" "apps\api\.env" >nul
if errorlevel 1 (
  echo Failed to sync apps\api\.env from root .env.
  set "FAILED=1"
  goto :fail
)
copy /y ".env" "apps\web\.env" >nul
if errorlevel 1 (
  echo Failed to sync apps\web\.env from root .env.
  set "FAILED=1"
  goto :fail
)

echo [3/8] Resetting local services/data and starting Postgres and Redis...
call "%ROOT%stop-local.bat" >nul 2>&1
if errorlevel 1 (
  echo Failed to stop local services.
  set "FAILED=1"
  goto :fail
)
timeout /t 2 /nobreak >nul
docker compose -f "infra\docker\docker-compose.yml" up -d
if errorlevel 1 (
  echo Failed to start docker services.
  set "FAILED=1"
  goto :fail
)

echo [4/8] Waiting for services...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\windows\wait-for-port.ps1" -HostName "localhost" -Port 55432 -TimeoutSeconds 90
if errorlevel 1 (
  set "FAILED=1"
  goto :fail
)
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\windows\wait-for-port.ps1" -HostName "localhost" -Port 6379 -TimeoutSeconds 90
if errorlevel 1 (
  set "FAILED=1"
  goto :fail
)

echo [5/8] Installing dependencies (if needed)...
if not exist "node_modules\.bin\prisma.cmd" (
  call npm.cmd install
  if errorlevel 1 (
    echo npm install failed.
    set "FAILED=1"
    goto :fail
  )
)

echo [6/8] Running DB generate/migrate/seed...
call npm.cmd run db:generate
if errorlevel 1 (
  echo db:generate failed on first attempt. Retrying after brief wait...
  timeout /t 2 /nobreak >nul
  del /q "node_modules\.prisma\client\query_engine-windows.dll.node.tmp*" >nul 2>&1
  call npm.cmd run db:generate
  if errorlevel 1 (
    set "FAILED=1"
    goto :fail
  )
)
call npm.cmd run db:migrate
if errorlevel 1 (
  set "FAILED=1"
  goto :fail
)
call npm.cmd run db:seed
if errorlevel 1 (
  set "FAILED=1"
  goto :fail
)

echo [7/8] Launching API and Web dev servers...
start "Ebonkeep API" cmd /k "cd /d %ROOT% && npm.cmd run dev:api"
start "Ebonkeep Web" cmd /k "cd /d %ROOT% && npm.cmd run dev:web"

echo [8/8] Waiting for web client...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\windows\wait-for-port.ps1" -HostName "localhost" -Port 5173 -TimeoutSeconds 120
if errorlevel 1 (
  echo Web server did not start in time.
  set "FAILED=1"
  goto :fail
)
start "" "http://localhost:5173"

echo Local stack started.
echo API: http://localhost:4000
echo Web: http://localhost:5173
echo Desktop shell is not auto-started by run-local.bat.
echo Run stop-local.bat to stop services and spawned windows.
exit /b 0

:fail
if "%FAILED%"=="1" (
  echo.
  echo Local stack startup failed.
  echo If this window was opened by double-click, run run-local.bat from an existing terminal to keep logs visible.
  pause
)
exit /b 1
