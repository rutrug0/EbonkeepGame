# Developer Setup

## Prerequisites
- Windows 10/11
- Node.js 22.x
- npm 10+
- Docker Desktop

## First Run
1. From repo root, run `run-local.bat`.
2. Script will:
   - stop existing local processes and reset docker volumes (`stop-local.bat --purge-data`)
   - create `.env` from `.env.example` (if missing)
   - select a usable local Postgres host port and write it to `.env` as `EBONKEEP_POSTGRES_HOST_PORT`
   - boot Postgres, Redis, Prometheus, Loki, and Grafana with Docker Compose
   - wait for the local observability endpoints to become healthy before opening the app
   - run Prisma generate/migrate/seed
   - start API and Web windows

## Manual Commands
- Install dependencies: `npm install`
- Start infra: `docker compose --env-file .env -f infra/docker/docker-compose.yml up -d`
- Run API: `npm run dev:api`
- Run web: `npm run dev:web`
- Run desktop wrapper: `npm run dev:desktop`
- Run Android-local stack: `run-local-android.bat`
- Launch Android emulator: `run-android-emulator.bat` or `run-android-emulator.bat <AVD_NAME>`

## DB Operations
- Generate Prisma client: `npm run db:generate`
- Apply migrations: `npm run db:migrate`
- Seed local data: `npm run db:seed`

## Common Issues
- Docker not running:
  - Start Docker Desktop and rerun `run-local.bat`.
- Port already in use (`4000`, `5173`, `55432`, `6379`):
  - stop conflicting process or rerun `run-local.bat`; it will rewrite `.env` to a bindable Postgres host port when possible.
- Prisma migration errors:
  - verify `DATABASE_URL` in `.env`.
  - if you get `P1000` auth failures after changing local credentials, reset local db volume:
    - `stop-local.bat --purge-data`
    - then rerun `run-local.bat`
- Prisma `query_engine-windows.dll.node` rename `EPERM` on Windows:
  - `run-local*.bat` now treats the locked engine DLL as recoverable if the existing Prisma client still loads
  - if it still persists outside the launcher, fully stop repo-local Node dev servers and rerun
- App windows left open:
  - run `stop-local.bat`.
- Android emulator cannot be found:
  - install an Android SDK + AVD through Android Studio
  - ensure `ANDROID_SDK_ROOT` or `ANDROID_HOME` points to that SDK, or use the default `%LOCALAPPDATA%\Android\Sdk`

See also:
- [`android-testing.md`](./android-testing.md)
