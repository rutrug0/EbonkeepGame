# API Scope Guide

These instructions apply to `apps/api/**`.

## Contract Discipline
- Align request/response shapes with `packages/shared/src/index.ts` schemas.
- Add or update shared schemas before wiring API changes in route handlers.
- Keep module boundaries explicit under `src/modules/*`.

## Route and Auth Rules
- Use `preHandler: fastify.authenticate` for protected routes.
- Validate request payloads with Zod schemas from shared package where available.
- Register new routes/plugins in `src/index.ts` with consistent ordering.

## Persistence Rules
- For schema changes, update `prisma/schema.prisma` and create migrations.
- Do not hand-edit migration history files beyond generated intent.
- Keep seed behavior deterministic for local setup.

## Verification
- Prefer focused checks first, then broader build:
  - `npm.cmd --workspace @ebonkeep/api run build`

