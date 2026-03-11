# Ebonkeep Agent Guide

This file applies to the whole repo. Read a nested `AGENTS.md` only when you work inside that subtree.

## Start Here
- For substantial work, run `python tools/codex/build_docs_context_pack.py`.
- Read `.codex/cache/docs_context_pack.md` for broad context.
- Read `README.md` and `docs/codex-context-map.md`.
- Then open only the docs directly relevant to the task. Do not preload large parts of `docs/`.

## Keep Current
- If you discover this file is stale while already touching adjacent docs or workflow guidance, update the stale lines in the same change. Keep the edit narrow.

## Repo Map
- `apps/api`: Fastify API. Main code lives in `src/modules/*`, `src/routes`, `src/plugins`, and `prisma/`.
- `apps/web`: React/Vite client. App orchestration is in `src/app/AppShell.tsx`; feature code is in `src/features/*`; generated assets/data live in `src/generated/*`.
- `apps/desktop`: Electron wrapper around the web client. Keep it thin.
- `packages/shared`: shared contracts. Core primitives are in `src/core`; domain contracts are in `src/domains/{auth,player,inventory,combat,economy,guild,leaderboard}`; `src/index.ts` is a compatibility barrel.
- `docs`: product, architecture, runtime, and pipeline docs.
- `docs/data`: canonical balance/data tables used by generators.
- `tools`: generators, validators, test DB prep, and Codex helpers.
- `tests/e2e`: Playwright coverage.

## Open First By Task
- Auth/account: `apps/api/src/modules/auth`, `packages/shared/src/domains/auth`, `apps/web/src/features/auth`
- Player/inventory/equipment: `apps/api/src/modules/player`, `apps/api/src/modules/inventory`, `packages/shared/src/domains/player`, `packages/shared/src/domains/inventory`, `apps/web/src/features/player`, `apps/web/src/features/profile`, `apps/web/src/app/AppShell.tsx`
- Economy/merchant/shop/payments: `apps/api/src/modules/economy`, `apps/api/src/modules/payments`, `packages/shared/src/domains/economy`, `apps/web/src/features/economy`
- Combat/contracts: `apps/api/src/modules/combat`, `packages/shared/src/domains/combat`, `apps/web/src/features/combat`, `apps/web/src/features/contracts`
- Guild: `apps/api/src/modules/guild`, `packages/shared/src/domains/guild`, `apps/web/src/features/guild`
- Leaderboard: `apps/api/src/modules/leaderboard`, `packages/shared/src/domains/leaderboard`, `apps/web/src/features/leaderboard`
- Auction: `apps/api/src/modules/auction`, `apps/web/src/features/auction`
- Frontend shell/layout: `apps/web/src/app`, then the specific `apps/web/src/features/*` folder
- Shared contract changes: start in `packages/shared/src/core` or the relevant `packages/shared/src/domains/*` entrypoint, then update API/web consumers
- Data or art pipeline: relevant `docs/data/*.csv`, `tools/*.ps1`, `tools/*.py`, and generated outputs under `apps/web/src/generated/*`

## Canonical Commands
- Full local stack: `run-local.bat`
- Stop local stack: `stop-local.bat`
- Workspace build: `npm.cmd run build`
- Workspace lint: `npm.cmd run lint`
- Workspace unit+integration+smoke: `npm.cmd run test:ci`
- Workspace unit tests only: `npm.cmd run test:unit`
- Prepare integration/e2e DB: `npm.cmd run test:db:prepare`
- API build/typecheck: `npm.cmd --workspace @ebonkeep/api run build`
- API unit tests: `npm.cmd --workspace @ebonkeep/api run test:unit`
- API integration tests: `npm.cmd --workspace @ebonkeep/api run test:integration`
- Web build/typecheck: `npm.cmd --workspace @ebonkeep/web run build`
- Web unit tests: `npm.cmd --workspace @ebonkeep/web run test:unit`
- Web locale validation: `npm.cmd --workspace @ebonkeep/web run i18n:check`
- Shared build/typecheck: `npm.cmd --workspace @ebonkeep/shared run build`
- Shared unit tests: `npm.cmd --workspace @ebonkeep/shared run test:unit`
- Playwright smoke: `npm.cmd run test:smoke`
- Playwright full e2e: `npm.cmd run test:e2e`
- There is no separate repo-wide typecheck script. Use the workspace `build` commands above when you need TypeScript validation.

## Repo-Specific Conventions
- New or refactored shared imports should use `@ebonkeep/shared/<domain>` or `@ebonkeep/shared/core`. The root `@ebonkeep/shared` barrel exists for compatibility only.
- In the web app, app-layer code belongs in `apps/web/src/app`; domain UI/state belongs in `apps/web/src/features/*`; shared web utilities belong in `apps/web/src/lib`, `src/constants`, `src/i18n`, or `src/generated`.
- Keep API changes within the owning module under `apps/api/src/modules/*`; avoid cross-module leakage through unrelated routes or services.
- Treat `apps/web/src/generated/*` as generated, versioned output. Update the generator or upstream source first, then regenerate.
- Treat Prisma migrations as append-only. Change `apps/api/prisma/schema.prisma`, then create a new migration; do not rewrite old migrations unless explicitly asked.
- If docs disagree with runtime code, treat current code plus Prisma schema plus shared contracts as implementation truth and call out the mismatch.

## Do Not
- Do not manually maintain generated web assets or generated sidecars when a tool or source file should be changed instead.
- Do not add new hardcoded API URLs in web feature code; use the existing feature API modules or `apps/web/src/lib/api/system.ts`.
- Do not use the root shared barrel in newly touched refactored files just because it is convenient.
- Do not assume `apps/web/src/App.tsx` is the main hotspot anymore; the active shell lives in `apps/web/src/app/AppShell.tsx`.
- Do not rewrite old Prisma migrations or emitted JS sidecars unless the task is explicitly about artifacts/history.
- Do not load large swaths of docs by default. Start narrow.

## Done When
- The touched surface builds successfully.
- The relevant lint and test commands for the touched surface pass.
- If shared contracts changed, build `packages/shared` first, then every touched consumer workspace.
- If generator or pipeline code changed, regenerate the tracked outputs that depend on it and inspect the affected artifacts.
- If a local stack is already running and the change affects runtime behavior, verify the smallest affected route, screen, or workflow rather than stopping at static checks.

## Nested AGENTS
- `apps/api/AGENTS.md`: keep for API-specific contract, auth, and persistence rules.
- `apps/web/AGENTS.md`: keep for web-specific UI, generated asset, and localization rules.
- `packages/shared/AGENTS.md`: keep for contract package rules.
- `tools/AGENTS.md`: keep for pipeline and generator rules.
- `apps/desktop/AGENTS.md`: keep only if you are touching Electron wrapper behavior.
