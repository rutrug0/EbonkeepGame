# Shared Contracts Guide

These instructions apply to `packages/shared/**`.

## Ownership
- Core primitives live in `src/core`.
- Domain contracts live in `src/domains/{auth,player,inventory,combat,economy,guild,leaderboard}`.
- `src/index.ts` is a compatibility barrel. Do not treat it as the preferred place for new contract definitions.

## Change Rules
- Put new or refactored contracts in the owning core or domain entrypoint.
- Prefer additive contract changes over breaking renames/removals unless the task explicitly requires a break.
- Keep Zod schemas, exported TypeScript types, and related constants aligned in the same change.
- `src/core` must not depend on domain modules.
- Domain modules may depend on `src/core`, but should not reach across to another domain's internals.

## Coordination
- After changing shared contracts, update touched API route handlers, web feature adapters, and UI assumptions in the same task when feasible.
- Prefer `@ebonkeep/shared/<domain>` and `@ebonkeep/shared/core` imports in consumers you touch.
- If docs still describe the old contract shape, call out the mismatch or update the stale guidance when it is adjacent to your change.

## Verification
- Build/typecheck: `npm.cmd --workspace @ebonkeep/shared run build`
- Unit tests: `npm.cmd --workspace @ebonkeep/shared run test:unit`
- Lint: `npm.cmd --workspace @ebonkeep/shared run lint`
- If consumers changed, build the touched API/web workspaces after shared passes.
