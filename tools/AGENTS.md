# Tools Scope Guide

These instructions apply to `tools/**`.

## Pipeline Ownership
- Treat `docs/data/*.csv` as pipeline inputs/outputs tied to scripts in this folder.
- Prefer updating source coefficients/curated rows and rerunning generators over manual output edits.
- Keep script behavior deterministic and backward-compatible where possible.

## Regeneration Mapping
- Affix scaling: `tools/generate_affix_scaling_table.ps1`
- XP requirements: `tools/generate_experience_requirements_table.ps1`
- Training + ducat rewards: `tools/generate_training_and_reward_tables.ps1`
- Weapon tables: `tools/generate_warrior_weapon_tables.ps1`
- Armor/jewelry validation: `tools/generate_armor_jewelry_name_tables.ps1`
- Art generation: `tools/generate_item_art.py`
- Art manifest only: `tools/build_item_art_manifest.py`

## Generated Artifact Safety
- Avoid manual edits of generated manifests or state files unless explicitly requested.
- Keep `.txt` prompt sidecars and manifest outputs in sync with art generation behavior.

