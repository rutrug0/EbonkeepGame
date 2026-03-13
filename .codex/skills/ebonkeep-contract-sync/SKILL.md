---
name: ebonkeep-contract-sync
description: Coordinate shared-contract changes across Ebonkeep's monorepo. Use when modifying Zod schemas or exported types under packages/shared, changing request or response payloads, adding or reshaping API contracts, updating web feature adapters to match backend changes, or deciding which workspaces and tests must be rebuilt after a contract change.
---

# Ebonkeep Contract Sync

Use a shared-first workflow for contract changes. Start in `packages/shared`, carry the change through the owning API module and affected web feature code, then run the narrowest required verification in the right order.

## Workflow

1. Identify the owning domain before editing anything.
   Open `packages/shared/src/core` for primitives and shared locale or stat definitions.
   Open `packages/shared/src/domains/<domain>/index.ts` for domain contracts.
   Read [references/domain-map.md](./references/domain-map.md) if the ownership is unclear.

2. Change shared contracts first.
   Keep Zod schema, exported TypeScript type, and related constants aligned in the same edit.
   Prefer additive changes over breaking renames or removals unless the task explicitly requires a break.
   Prefer `@ebonkeep/shared/<domain>` or `@ebonkeep/shared/core` imports in touched consumers. Do not introduce new uses of the root `@ebonkeep/shared` barrel just because it is convenient.

3. Propagate the contract to runtime consumers.
   Update the owning Fastify module under `apps/api/src/modules/*`.
   If the route shape changes, update the corresponding frontend adapter in the same change.
   In the web app, keep app-shell orchestration in `apps/web/src/app` and domain logic in the owning `apps/web/src/features/*` folder.

4. Handle persistence only when the contract change crosses into stored state.
   If the API change requires schema changes, update `apps/api/prisma/schema.prisma` and create a new migration.
   Treat migrations as append-only. Do not rewrite old migrations.

5. Verify in dependency order.
   Run `npm.cmd --workspace @ebonkeep/shared run build` first.
   Then run the touched consumer builds, usually `@ebonkeep/api` and `@ebonkeep/web`.
   Use [references/verification.md](./references/verification.md) for the exact command matrix.

## Decision Points

### Shared only

Use this when the change is internal to `packages/shared` and no consumer behavior changed yet.
Build and test `@ebonkeep/shared`.

### Shared plus API

Use this when request validation, response payloads, or route handlers changed.
Update the shared contract first, then the owning API module, then build shared before API.

### Shared plus web

Use this when frontend adapters or UI assumptions changed without API logic changes.
Update shared first, then the owning feature API and UI code, then build shared before web.

### Shared plus API plus web

This is the default for real contract work.
Assume all touched consumers must move in the same change unless local evidence proves otherwise.

## Repo Rules To Enforce

- `packages/shared/src/core` must not depend on domain modules.
- Domain modules may depend on `src/core`, but should not reach into another domain's internals.
- Keep API changes inside the owning module under `apps/api/src/modules/*`.
- Do not grow `apps/web/src/api.ts`; prefer feature-local API modules.
- If docs near the touched code are stale, update the adjacent guidance in the same change.

## References

- [references/domain-map.md](./references/domain-map.md): start points and ownership map
- [references/verification.md](./references/verification.md): build and test order after contract changes
