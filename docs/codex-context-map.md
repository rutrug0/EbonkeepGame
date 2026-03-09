# Codex Context Map

Quick reference for where to work and what to run.

## Core Areas
- API routes and server wiring: `apps/api/src`
- Frontend app behavior and UI: `apps/web/src`
- Shared contracts and schemas: `packages/shared/src/index.ts`
- Product and architecture docs: `docs/*.md`
- Balance/art data tables: `docs/data/*.csv`
- Generators and validators: `tools/*`

## Open First By Task
- Auth/account: `apps/api/src/modules/auth/routes.ts`, `packages/shared/src/index.ts`
- Player/inventory/equipment: `apps/api/src/modules/player/state-service.ts`, `apps/api/src/modules/inventory/routes.ts`, `packages/shared/src/index.ts`
- Economy/merchant: `apps/api/src/modules/economy/*`, `apps/web/src/App.tsx`
- Combat/contracts: `apps/api/src/modules/combat/routes.ts`, `apps/web/src/components/CombatEncounterPanel.tsx`, `apps/web/src/App.tsx`
- Auction: `apps/api/src/modules/auction/*`
- Shared contract updates: `packages/shared/src/index.ts`, then API/web consumers
- Balance/data changes: relevant `docs/data/*.csv` plus the corresponding `tools/*.ps1` or Python generator
- Item art pipeline: `docs/19-item-art-generation-pipeline.md`, `tools/item_art_prompts.yaml`, `tools/generate_item_art.py`, `tools/build_item_art_manifest.py`

## Common Commands
- Full local stack: `run-local.bat`
- Stop local stack: `stop-local.bat`
- Workspace build: `npm.cmd run build`
- API build: `npm.cmd --workspace @ebonkeep/api run build`
- Web build: `npm.cmd --workspace @ebonkeep/web run build`

## Data Pipeline Commands
- Affix scaling regenerate:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_affix_scaling_table.ps1`
- XP requirements regenerate:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_experience_requirements_table.ps1`
- Training/reward regenerate:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_training_and_reward_tables.ps1`
- Weapon tables regenerate:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_warrior_weapon_tables.ps1`
- Armor/jewelry validation:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_armor_jewelry_name_tables.ps1`

## Item Art Pipeline Commands
- Plan without generation:
  - `python tools/generate_item_art.py --dry-run`
- Generate missing only:
  - `python tools/generate_item_art.py --sources all`
- Force regenerate:
  - `python tools/generate_item_art.py --force`
- Rebuild manifest only:
  - `python tools/build_item_art_manifest.py`
