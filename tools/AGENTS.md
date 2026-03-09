# Tools Scope Guide

These instructions apply to `tools/**`.

## Pipeline Ownership
- Treat `docs/data/*.csv` as pipeline inputs/outputs tied to scripts in this folder.
- Prefer updating source coefficients/curated rows and rerunning generators over manual output edits.
- Keep script behavior deterministic and backward-compatible where possible.
- When a tool changes generated artifacts, summarize which upstream source changed and which derived outputs were regenerated.

## Regeneration Mapping
- Affix scaling: `tools/generate_affix_scaling_table.ps1`
- XP requirements: `tools/generate_experience_requirements_table.ps1`
- Training + ducat rewards: `tools/generate_training_and_reward_tables.ps1`
- Weapon tables: `tools/generate_warrior_weapon_tables.ps1`
- Armor/jewelry validation: `tools/generate_armor_jewelry_name_tables.ps1`
- Art generation: `tools/generate_item_art.py`
- Art manifest only: `tools/build_item_art_manifest.py`

## Generated Artifact Safety
- Generated manifests and similar pipeline outputs are versioned artifacts in this repo; when upstream inputs or generator behavior changes, regenerate them and keep the checked-in outputs current.
- Keep `.txt` prompt sidecars and manifest outputs in sync with art generation behavior.
- Rerun the narrowest generator that covers the change before considering broader regeneration.
- Avoid ad hoc manual edits to generated files when the same change can be made in upstream source data or generator logic.

## Verification
- Prefer dry-run or validation modes when available before expensive regeneration.
- After changing a generator, inspect the smallest representative output set rather than trusting script success alone.
