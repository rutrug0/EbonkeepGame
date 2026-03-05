# Codex Context Map

Quick reference for where to work and what to run.

## Core Areas
- API routes and server wiring: `apps/api/src`
- Frontend app behavior and UI: `apps/web/src`
- Shared contracts and schemas: `packages/shared/src/index.ts`
- Product and architecture docs: `docs/*.md`
- Balance/art data tables: `docs/data/*.csv`
- Generators and validators: `tools/*`

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

