---
name: ebonkeep-balance-data-workflow
description: Edit and regenerate Ebonkeep progression and balance data tables under docs/data using the project generator scripts. Use when tasks involve affix scaling, XP curve, passive training, ducat rewards, weapon tables, armor tables, or jewelry tables.
---

# Ebonkeep Balance/Data Workflow

## Workflow
1. Locate the owning source table or coefficient file in `docs/data`.
2. Update only source inputs for the requested balance change.
3. Regenerate or validate with the matching script in `tools`.
4. Verify column shape and row expectations remain valid.
5. Check API/web consumers if schema columns changed.

## Script Mapping
- Affix scaling:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_affix_scaling_table.ps1`
- Experience requirements:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_experience_requirements_table.ps1`
- Passive training + mission ducats:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_training_and_reward_tables.ps1`
- Weapon tables:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_warrior_weapon_tables.ps1`
- Armor/jewelry validation:
  - `powershell -ExecutionPolicy Bypass -File .\\tools\\generate_armor_jewelry_name_tables.ps1`

## Notes
- Do not hand-maintain generated outputs when a script exists.
- Keep balancing edits traceable by naming the updated source file and regeneration command.

