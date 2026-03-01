# Ebonkeep

High-level implementation planning docs live in [`docs/`](docs/), starting with [`docs/00-index.md`](docs/00-index.md).

## Development Foundation

Monorepo structure:
- `apps/api` - Fastify + Zod backend modular monolith scaffold.
- `apps/web` - React + Vite web client scaffold.
- `apps/desktop` - Electron desktop wrapper scaffold.
- `packages/shared` - shared contracts and schemas.
- `infra/docker` - local Postgres/Redis compose stack.

## Local Run (Windows)

1. Run `run-local.bat` from repo root.
2. Open web at `http://localhost:5173`.
3. Use the in-app guest login and load player state.
4. Stop everything with `stop-local.bat`.

See:
- [`docs/dev-setup.md`](docs/dev-setup.md)
- [`docs/local-runtime.md`](docs/local-runtime.md)
