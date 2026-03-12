# Codex Context Map

Quick reference for where to work and what to run.

## Core Areas
- API modules and server wiring: `apps/api/src`
- Web app shell and features: `apps/web/src/app`, `apps/web/src/features`
- Shared contracts: `packages/shared/src/core`, `packages/shared/src/domains`
- Product and runtime docs: `docs/*.md`
- Balance/art data tables: `docs/data/*.csv`
- Generators and validators: `tools/*`

## Open First By Task
- Auth/account: `apps/api/src/modules/auth`, `packages/shared/src/domains/auth`, `apps/web/src/features/auth`
- Player/inventory/equipment: `apps/api/src/modules/player`, `apps/api/src/modules/inventory`, `packages/shared/src/domains/player`, `packages/shared/src/domains/inventory`, `apps/web/src/features/player`, `apps/web/src/features/profile`, `apps/web/src/app/AppShell.tsx`
- Economy/merchant/payments: `apps/api/src/modules/economy`, `apps/api/src/modules/payments`, `packages/shared/src/domains/economy`, `apps/web/src/features/economy`
- Combat/contracts: `apps/api/src/modules/combat`, `packages/shared/src/domains/combat`, `apps/web/src/features/combat`, `apps/web/src/features/contracts`
- Guild: `apps/api/src/modules/guild`, `packages/shared/src/domains/guild`, `apps/web/src/features/guild`
- Leaderboard: `apps/api/src/modules/leaderboard`, `packages/shared/src/domains/leaderboard`, `apps/web/src/features/leaderboard`
- Auction: `apps/api/src/modules/auction`, `apps/web/src/features/auction`
- Shared contract updates: the relevant `packages/shared/src/core` or `packages/shared/src/domains/*` entrypoint, then API/web consumers
- Frontend shell/layout: `apps/web/src/app`
- Data changes: relevant `docs/data/*.csv` plus the corresponding `tools/*.ps1` or Python generator
- Item art pipeline: `docs/19-item-art-generation-pipeline.md`, `tools/item_art_prompts.yaml`, `tools/generate_item_art.py`, `tools/build_item_art_manifest.py`

## Common Commands
- Full local stack: `run-local.bat`
- Stop local stack: `stop-local.bat`
- Workspace build: `npm.cmd run build`
- Workspace lint: `npm.cmd run lint`
- Workspace unit tests: `npm.cmd run test:unit`
- Workspace CI test set: `npm.cmd run test:ci`
- Prepare integration/e2e DB: `npm.cmd run test:db:prepare`
- API build: `npm.cmd --workspace @ebonkeep/api run build`
- API unit tests: `npm.cmd --workspace @ebonkeep/api run test:unit`
- API integration tests: `npm.cmd --workspace @ebonkeep/api run test:integration`
- Web build: `npm.cmd --workspace @ebonkeep/web run build`
- Web unit tests: `npm.cmd --workspace @ebonkeep/web run test:unit`
- Web locale validation: `npm.cmd --workspace @ebonkeep/web run i18n:check`
- Shared build: `npm.cmd --workspace @ebonkeep/shared run build`
- Shared unit tests: `npm.cmd --workspace @ebonkeep/shared run test:unit`

## Data Pipeline Commands
- Affix scaling regenerate:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_affix_scaling_table.ps1`
- XP requirements regenerate:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_experience_requirements_table.ps1`
- Training/reward regenerate:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_training_and_reward_tables.ps1`
- Weapon tables regenerate:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_warrior_weapon_tables.ps1`
- Defense tables regenerate:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_defense_scaling_tables.ps1`
- Armor/jewelry validation:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_armor_jewelry_name_tables.ps1`

## Item Art Pipeline Commands
- Plan without generation:
  - `python tools/generate_item_art.py --dry-run`
- Generate missing only:
  - `python tools/generate_item_art.py --sources all`
- Force regenerate:
  - `python tools/generate_item_art.py --force`
- Build processed runtime PNGs:
  - `python tools/process_generated_item_art.py`
- Rebuild manifest only:
  - `python tools/build_item_art_manifest.py`
