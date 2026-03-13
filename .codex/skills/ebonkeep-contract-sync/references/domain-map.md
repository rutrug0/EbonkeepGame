# Domain Map

Use this file when the owning shared domain or consumer surface is not obvious.

## Shared Contract Roots

- `packages/shared/src/core`
  Use for primitives, enums, locale definitions, stat trees, shared constants, and types that more than one domain depends on.
- `packages/shared/src/domains/auth/index.ts`
- `packages/shared/src/domains/player/index.ts`
- `packages/shared/src/domains/inventory/index.ts`
- `packages/shared/src/domains/combat/index.ts`
- `packages/shared/src/domains/economy/index.ts`
- `packages/shared/src/domains/guild/index.ts`
- `packages/shared/src/domains/leaderboard/index.ts`
- `packages/shared/src/index.ts`
  Compatibility barrel only. Do not prefer it for new definitions.

## Consumer Start Points

- Auth/account
  API: `apps/api/src/modules/auth`
  Web: `apps/web/src/features/auth`
  Shared: `packages/shared/src/domains/auth`
- Player/inventory/equipment
  API: `apps/api/src/modules/player`, `apps/api/src/modules/inventory`
  Web: `apps/web/src/features/player`, `apps/web/src/features/profile`, `apps/web/src/app/AppShell.tsx`
  Shared: `packages/shared/src/domains/player`, `packages/shared/src/domains/inventory`
- Economy/merchant/payments
  API: `apps/api/src/modules/economy`, `apps/api/src/modules/payments`
  Web: `apps/web/src/features/economy`
  Shared: `packages/shared/src/domains/economy`
- Combat/contracts
  API: `apps/api/src/modules/combat`
  Web: `apps/web/src/features/combat`, `apps/web/src/features/contracts`
  Shared: `packages/shared/src/domains/combat`
- Guild
  API: `apps/api/src/modules/guild`
  Web: `apps/web/src/features/guild`
  Shared: `packages/shared/src/domains/guild`
- Leaderboard
  API: `apps/api/src/modules/leaderboard`
  Web: `apps/web/src/features/leaderboard`
  Shared: `packages/shared/src/domains/leaderboard`
- Auction
  API: `apps/api/src/modules/auction`
  Web: `apps/web/src/features/auction`

## Common Coordination Patterns

### Request or response contract changes

1. Update the shared schema and exported type.
2. Update the Fastify route and service code in the owning API module.
3. Update the matching web feature API adapter.
4. Update any UI assumptions that consume the changed data.

### Shared primitive changes

Examples: locale enum, stat keys, class mappings, equipment slot ids.

1. Change `packages/shared/src/core`.
2. Search both `apps/api` and `apps/web` for dependent code paths.
3. Prefer domain entrypoint imports in touched files instead of the root shared barrel.

### Persistence-backed changes

1. Update the shared contract.
2. Update `apps/api/prisma/schema.prisma` if stored state changes.
3. Create a new migration.
4. Update API handlers and web consumers.
