# Ebonkeep Codex Working Guide

This file is the root instruction set for the whole repository.

## Startup Preflight (Required)
Before substantial implementation work:
1. Run `python tools/codex/build_docs_context_pack.py`.
2. Read `.codex/cache/docs_context_pack.md`.
3. Load full text for only the docs directly relevant to the task.

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
- Generated assets and manifests should be produced by scripts, not manually maintained.

## Runtime and Validation Baseline
- Local start: `run-local.bat`
- Local stop: `stop-local.bat`
- Workspace build: `npm.cmd run build`
- API build: `npm.cmd --workspace @ebonkeep/api run build`
- Web typecheck/build: `npm.cmd --workspace @ebonkeep/web run build`

## Known Local Constraints
- In sandboxed environments, Vite build can fail with `spawn EPERM` from `esbuild`.
- API TypeScript build may fail due an existing `ioredis` construct-signature typing issue in `apps/api/src/plugins/redis.ts`.

## Safety Defaults
- Never use destructive git commands unless explicitly requested.
- Prefer `rg` for text/file search.
- Keep edits scoped to the user request and avoid unrelated refactors.
- When touching generated outputs, update upstream source + generator usage first.

## Local Skill Registry
- `ebonkeep-feature-workflow`: `.codex/skills/ebonkeep-feature-workflow/SKILL.md`
- `ebonkeep-balance-data-workflow`: `.codex/skills/ebonkeep-balance-data-workflow/SKILL.md`
- `ebonkeep-item-art-workflow`: `.codex/skills/ebonkeep-item-art-workflow/SKILL.md`

## Skill Trigger Rules
- Use a skill when the task clearly matches its workflow domain.
- If a user names a skill, use it for that turn.
- If multiple skills could apply, pick the smallest set that fully covers the task.
- Keep context lean: load only references needed for current scope.

