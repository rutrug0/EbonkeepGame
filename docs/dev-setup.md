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
   - boot Postgres and Redis with Docker Compose
   - run Prisma generate/migrate/seed
   - start API and Web windows

## Manual Commands
- Install dependencies: `npm install`
- Start infra: `docker compose -f infra/docker/docker-compose.yml up -d`
- Run API: `npm run dev:api`
- Run web: `npm run dev:web`
- Run desktop wrapper: `npm run dev:desktop`

## DB Operations
- Generate Prisma client: `npm run db:generate`
- Apply migrations: `npm run db:migrate`
- Seed local data: `npm run db:seed`

## Common Issues
- Docker not running:
  - Start Docker Desktop and rerun `run-local.bat`.
- Port already in use (`4000`, `5173`, `55432`, `6379`):
  - stop conflicting process or edit `.env` + compose ports.
- Prisma migration errors:
  - verify `DATABASE_URL` in `.env`.
  - if you get `P1000` auth failures after changing local credentials, reset local db volume:
    - `stop-local.bat --purge-data`
    - then rerun `run-local.bat`
- App windows left open:
  - run `stop-local.bat`.
