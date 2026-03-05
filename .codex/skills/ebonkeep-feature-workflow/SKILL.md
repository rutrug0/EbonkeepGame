---
name: ebonkeep-feature-workflow
description: Implement API and web feature changes for Ebonkeep with shared contract alignment, scoped module updates, and targeted verification. Use when tasks involve inventory/combat/economy/profile behavior or coordinated changes across apps/api, apps/web, and packages/shared.
---

# Ebonkeep Feature Workflow

## Workflow
1. Identify impacted areas in `apps/api`, `apps/web`, and `packages/shared/src/index.ts`.
2. Update shared schemas/types first when contract shape changes are needed.
3. Apply API route/module changes and frontend usage changes in the same pass.
4. Keep changes scoped to the request and preserve current module boundaries.
5. Run focused checks, then broader checks when needed.

## Verification
- API build:
  - `npm.cmd --workspace @ebonkeep/api run build`
- Web typecheck:
  - `cmd /d /s /c "cd apps\\web && node ..\\..\\node_modules\\typescript\\bin\\tsc -p tsconfig.json --noEmit"`

## Notes
- If API build fails at `apps/api/src/plugins/redis.ts` due existing `ioredis` typing behavior, treat it as pre-existing unless your task touches that area.
- Keep route auth semantics explicit (`preHandler: fastify.authenticate` where required).

