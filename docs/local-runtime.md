# Local Runtime

## Overview
Local runtime starts:
- Postgres (`localhost:<EBONKEEP_POSTGRES_HOST_PORT from .env>`, prefers `55432` and falls back automatically if Windows blocks it)
- Redis (`localhost:6379`)
- Prometheus (`http://localhost:9090`)
- Loki (`http://localhost:3100`)
- Grafana (`http://localhost:3000`, default local login `admin / admin`)
- API (`http://localhost:4000`)
- Web (`http://localhost:5173`)
- Electron desktop shell is optional (`npm run dev:desktop`)

## Start
- `run-local.bat`
- `run-local-android.bat` for Android emulator browser testing

## Stop
- `stop-local.bat`

## Readiness Endpoints
- API health: `GET /health`
- API ready: `GET /ready`
- API observability summary: `GET /health/observability`
- Prometheus ready: `GET http://localhost:9090/-/ready`
- Loki ready: `GET http://localhost:3100/ready`
- Grafana health: `GET http://localhost:3000/api/health`

## Dev Auth Flow
- Use `POST /v1/dev/guest-login`.
- Web client includes a "Login as Guest" button.
- Token is stored in local storage and used for protected endpoints.

## WebSocket
- Endpoint: `ws://localhost:4000/ws`
- Sends `ServerTimeSync` heartbeat payload.
- Echoes incoming messages in a `SystemStatusChanged` envelope for connectivity checks.

Android emulator testing:
- Use `http://10.0.2.2:5173` for the web app.
- Use `run-local-android.bat` so the frontend talks to `10.0.2.2` instead of `localhost`.
- See [`android-testing.md`](./android-testing.md) for setup and SDK/AVD instructions.
