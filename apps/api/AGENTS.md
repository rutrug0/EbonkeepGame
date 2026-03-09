# API Scope Guide

These instructions apply to `apps/api/**`.

## Contract Discipline
- Align request/response shapes with `packages/shared/src/index.ts` schemas.
- Add or update shared schemas before wiring API changes in route handlers.
- Keep module boundaries explicit under `src/modules/*`.
- Prefer additive contract changes over breaking renames unless the task explicitly calls for a contract break.

## Route and Auth Rules
- Use `preHandler: fastify.authenticate` for protected routes.
- Validate request payloads with Zod schemas from shared package where available.
- Register new routes/plugins in `src/index.ts` with consistent ordering.
- If a route contract changes, update the corresponding frontend adapter in `apps/web/src/api.ts` in the same change when applicable.

## Persistence Rules
- For schema changes, update `prisma/schema.prisma` and create migrations.
- Do not hand-edit migration history files beyond generated intent.
- Keep seed behavior deterministic for local setup.
- Treat Prisma migrations as append-only unless the user explicitly requests history cleanup.
- Prefer editing `.ts` source files rather than checked-in emitted `.js` or `.d.ts` siblings.

## Hotspots
- Auction work is concentrated under `src/modules/auction/*`; open that module first before changing general API plumbing.
- Player state composition flows through `src/modules/player/state-service.ts`; inventory/equipment changes often need to update that path too.

## Verification
- Prefer focused checks first, then broader build:
  - `npm.cmd --workspace @ebonkeep/api run build`
- If the local stack is already running, verify the smallest affected route or readiness endpoint before attempting broader manual testing.
