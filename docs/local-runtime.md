# Local Runtime

## Overview
Local runtime starts:
- Postgres (`localhost:<EBONKEEP_POSTGRES_HOST_PORT from .env>`, prefers `55432` and falls back automatically if Windows blocks it)
- Redis (`localhost:6379`)
- API (`http://localhost:4000`)
- Web (`http://localhost:5173`)
- Electron desktop shell is optional (`npm run dev:desktop`)

## Start
- `run-local.bat`

## Stop
- `stop-local.bat`

## Readiness Endpoints
- API health: `GET /health`
- API ready: `GET /ready`

## Dev Auth Flow
- Use `POST /v1/dev/guest-login`.
- Web client includes a "Login as Guest" button.
- Token is stored in local storage and used for protected endpoints.

## WebSocket
- Endpoint: `ws://localhost:4000/ws`
- Sends `ServerTimeSync` heartbeat payload.
- Echoes incoming messages in a `SystemStatusChanged` envelope for connectivity checks.
