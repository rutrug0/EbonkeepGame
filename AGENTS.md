# Ebonkeep Codex Working Guide

This file is the root instruction set for the whole repository.

## Startup Preflight (Required)
Before substantial implementation work:
1. Run `python tools/codex/build_docs_context_pack.py`.
2. Read `.codex/cache/docs_context_pack.md`.
3. Read `docs/codex-context-map.md` for task routing and common commands.
4. Load full text for only the docs directly relevant to the task.

## Dynamic Docs Context Policy
- Treat all `docs/**/*.md` files as project context sources.
- Always include root `README.md` in project context.
- Do not rely on hardcoded document lists, because docs will grow.
- Use the generated context pack for broad awareness, then open full files for task-specific detail.

## Project Map
- `apps/api`: Fastify API modules, auth, persistence, websocket entrypoints.
- `apps/web`: React/Vite UI mockup and gameplay-facing frontend interactions.
- `apps/desktop`: Electron wrapper around web client.
- `packages/shared`: Shared schemas/types and contract constants.
- `docs`: Product, architecture, design, balance, and pipeline docs.
- `docs/data`: Canonical coefficient and generated data tables.
- `tools`: Generators, validators, and migration tooling for data/art pipelines.

## Source of Truth Rules
- API/Web contracts are defined in `packages/shared/src/index.ts`.
- Balance and progression tables are owned by `docs/data/*.csv` and their generator scripts.
- Generated assets and manifests are versioned in git and should be kept in sync with their upstream sources and generators.
- If planning docs and runtime code diverge, treat `packages/shared/src/index.ts`, active app code, and Prisma schema as the current implementation truth. Call out the mismatch instead of silently forcing docs or code to match.

## Task Routing
- Auth/account work: start with `apps/api/src/modules/auth/*` and `packages/shared/src/index.ts`.
- Player/inventory/equipment work: start with `apps/api/src/modules/player/*`, `apps/api/src/modules/inventory/*`, and `packages/shared/src/index.ts`.
- Economy/merchant/shop work: start with `apps/api/src/modules/economy/*`, `apps/web/src/App.tsx`, and shared contracts.
- Combat/contracts work: start with `apps/api/src/modules/combat/*`, `apps/web/src/components/CombatEncounterPanel.tsx`, `apps/web/src/App.tsx`, and shared contracts.
- Auction work: start with `apps/api/src/modules/auction/*` before touching adjacent systems.
- Frontend-only UI work: start with `apps/web/src/App.tsx`, `apps/web/src/styles.css`, and `apps/web/src/components/*`.
- Shared contract work: start with `packages/shared/src/index.ts` and then update API/web consumers.
- Balance/data/art pipeline work: start with the relevant `docs/data/*.csv`, `docs/*.md`, and `tools/*` generator or validator.

## Generated and Derived Files
- Treat `apps/web/src/generated/*` as versioned generated output. When source data or generators change, regenerate these files and keep the checked-in results current.
- Generated item art manifests, prompt sidecars, and similar pipeline outputs should stay synced with the upstream pipeline and remain committed when they are part of the repo output contract.
- In `apps/api/src/services/transactions/`, edit the `.ts` sources by default. Do not manually maintain checked-in `.js` or `.d.ts` sidecars unless the task is specifically about emitted artifacts.
- Prisma migrations are append-only history. Update `apps/api/prisma/schema.prisma`, then create a new migration instead of rewriting old ones unless the user explicitly asks for migration surgery.

## Runtime and Validation Baseline
- Local start: `run-local.bat`
- Local stop: `stop-local.bat`
- Workspace build: `npm.cmd run build`
- API build: `npm.cmd --workspace @ebonkeep/api run build`
- Web typecheck/build: `npm.cmd --workspace @ebonkeep/web run build`

## Known Local Constraints
- In sandboxed environments, Vite build can fail with `spawn EPERM` from `esbuild`.
- API TypeScript build may fail due an existing `ioredis` construct-signature typing issue in `apps/api/src/plugins/redis.ts`.
- The web app currently concentrates a large amount of behavior in `apps/web/src/App.tsx`; keep edits narrow unless the task is explicitly a refactor.
- Local runtime and helper scripts are Windows-first.

## Safety Defaults
- Never use destructive git commands unless explicitly requested.
- Prefer `rg` for text/file search.
- Keep edits scoped to the user request and avoid unrelated refactors.
- When touching generated outputs, update upstream source + generator usage first, then commit the regenerated artifacts that are tracked by the repo.

## Verification Matrix
- Shared contract changes: `npm.cmd --workspace @ebonkeep/shared run build`
- API-only changes: `npm.cmd --workspace @ebonkeep/api run build`
- Web-only changes: `npm.cmd --workspace @ebonkeep/web run build`
- Cross-cutting contract changes: build shared first, then API/web surfaces that consume it.
- Data pipeline changes: rerun only the affected generator/validator and inspect the touched outputs.
- If local services are already running, prefer targeted runtime checks such as `/health`, `/ready`, or the changed route rather than starting unrelated services.

## Local Skill Registry
- `ebonkeep-feature-workflow`: `.codex/skills/ebonkeep-feature-workflow/SKILL.md`
- `ebonkeep-balance-data-workflow`: `.codex/skills/ebonkeep-balance-data-workflow/SKILL.md`
- `ebonkeep-item-art-workflow`: `.codex/skills/ebonkeep-item-art-workflow/SKILL.md`

## Skill Trigger Rules
- Use a skill when the task clearly matches its workflow domain.
- If a user names a skill, use it for that turn.
- If multiple skills could apply, pick the smallest set that fully covers the task.
- Keep context lean: load only references needed for current scope.
