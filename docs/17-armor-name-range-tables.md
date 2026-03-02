# Armor Name-Range Tables

## Purpose
Define armor item-name progression for level 1-100 using name/range windows and flavor metadata.

This phase includes:
- heavy armor name/range table
- light armor name/range table
- robe armor name/range table

This phase does not include armor stat scaling values.

## Source Files
- Curated heavy table: `docs/data/heavy_armor_name_ranges_v1.csv`
- Curated light table: `docs/data/light_armor_name_ranges_v1.csv`
- Curated robe table: `docs/data/robe_armor_name_ranges_v1.csv`
- Validator: `tools/generate_armor_jewelry_name_tables.ps1`

Armor `item_name` and `flavor_text` fields are manually curated and are not auto-generated.

## CSV Schema
All three armor tables use the same columns:
- `sequence`
- `item_name`
- `item_type`
- `major_category`
- `archetype`
- `slot_family`
- `allowed_class`
- `flavor_text`
- `base_level`
- `drop_min_level`
- `drop_max_level_raw`
- `drop_max_level_capped`

## Field Rules
- `major_category`: always `armor`
- `archetype`:
  - heavy table -> `heavy`
  - light table -> `light`
  - robe table -> `robe`
- `allowed_class`:
  - heavy table -> `warrior`
  - light table -> `ranger`
  - robe table -> `mage`
- `slot_family`: each table includes all of:
  - `helmet`, `upper_armor`, `pauldrons`, `gloves`, `belt`, `lower_armor`, `boots`
  - each slot family has its own 25-row progression
- `item_name`: must be 1-2 words (`max 2 words`)
- `flavor_text`: exactly one sentence per row, ending with `.`

## Progression Rules
- Low base levels (`0-16`) should read basic/simple or even rough quality.
- Mid base levels (`20-64`) should read practical battle-ready quality.
- High base levels (`68-100`) should read elite/advanced quality.
- Avoid overblown naming at low levels.
- Armor `item_name` should stay slot-aware (for example, helmet rows should read like headgear names).
- Flavor art direction should match weapon tables: concise, dark-fantasy, and evocative.
- Flavor text is written manually item-by-item; do not auto-generate prose.

## Range Rules
- 175 rows per armor table (`7 slots * 25 rows per slot`).
- For each slot family, base levels increase by `+4` across that slot's 25 rows.
- Formulas:
  - `base_level = slot_step * 4`, where `slot_step` is `0..24` inside each `slot_family`
  - `drop_min_level = max(0, base_level - 10)`
  - `drop_max_level_raw = base_level + 10`
  - `drop_max_level_capped = min(level_cap, drop_max_level_raw)` where `level_cap` defaults to `100`

Example progression for one slot family (e.g. `belt`):
- step 0 base `0` -> `0..10`
- step 1 base `4` -> `0..14`
- step 2 base `8` -> `0..18`
- step 3 base `12` -> `2..22`

## Edit And Validate
- Manual content path:
  - edit armor tables directly:
    - `docs/data/heavy_armor_name_ranges_v1.csv`
    - `docs/data/light_armor_name_ranges_v1.csv`
    - `docs/data/robe_armor_name_ranges_v1.csv`
- Validation command:
  - `powershell -ExecutionPolicy Bypass -File .\tools\generate_armor_jewelry_name_tables.ps1`

## Deferred
- Armor primary/derived stat scaling values are intentionally deferred.
- Armor ilvl/stat roll scaling tables will be defined in a later phase.
