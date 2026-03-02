# Warrior Melee Weapon Tables

## Purpose
Define warrior melee weapon progression with:
- shared `ilvl` scaling independent of weapon name
- rarity effects (`+5%` damage per rarity step)
- nested roll ranges (template -> item creation rolls -> per-hit attack roll)
- weapon name table with level availability windows and flavor metadata

## Source Files
- Damage coefficients: `docs/data/warrior_weapon_damage_coefficients_v2.csv`
- Damage category profiles: `docs/data/weapon_damage_category_profiles.csv`
- Generated scaling table: `docs/data/warrior_melee_weapon_ilvl_scaling_v2.csv`
- Generated name/range table: `docs/data/warrior_melee_weapon_name_ranges_v4.csv`
- Generator: `tools/generate_warrior_weapon_tables.ps1`

## Name Table Metadata Columns
`docs/data/warrior_melee_weapon_name_ranges_v4.csv` includes:
- `weapon_family` (always `melee` for this table)
- `allowed_class` (always `warrior` for this table)
- `weapon_type` (`Sword` or `Axe`)
- `flavor_text` (single dark-fantasy flavor line tuned to the weapon row)

## Drop Range Rules (Name Table)
- Weapon sequence base levels increase by `+4`.
- Drop window is `base_level +/- 10`.
- Lower bound is clamped to `0`.
- Upper bound includes:
  - `drop_max_level_raw` (raw formula result)
  - `drop_max_level_capped` (capped to current level cap, default `100`)

This matches examples:
- item 1 base `0` -> `0..10`
- item 2 base `4` -> `0..14`
- item 3 base `8` -> `0..18`
- item 4 base `12` -> `2..22`

## Damage Scaling Rules (ilvl Table)
- `ilvl` range: `0..100`
- Common average damage:
  - `common_avg = base_avg_common + avg_growth_per_ilvl * ilvl`
- Strength/melee template range is narrow:
  - `template_min = common_avg * rarity_multiplier * (1 - spread)`
  - `template_max = common_avg * rarity_multiplier * (1 + spread)`
- Item creation rolls each endpoint separately with variance:
  - `item_roll_min in [template_min * (1-variance), template_min * (1+variance)]`
  - `item_roll_max in [template_max * (1-variance), template_max * (1+variance)]`
- Actual attack hit then rolls between the item's generated min/max.

Rarity multipliers:
- Common: `1.00`
- Uncommon: `1.05`
- Rare: `1.10`
- Epic: `1.15`

## Main Stat Damage Rule (Global, No Cap)
Main stat contributes linearly to flat damage for all damage archetypes:
- `strength` -> melee flat bonus
- `intelligence` -> spell flat bonus
- `agility` (`dexterity`) -> ranged flat bonus

Rule:
- `flat_main_stat_bonus = main_stat * 0.10`

Examples:
- `100 strength` -> `+10` flat damage
- `10,000 strength` -> `+1,000` flat damage

This is uncapped and is not stored per-weapon table row.

## Category Range Profiles (For Future Tables)
- Strength: narrow (`10%` template spread)
- Agility: medium (`16%`)
- Intelligence: wide (`22%`)

## Regenerate
`powershell -ExecutionPolicy Bypass -File .\tools\generate_warrior_weapon_tables.ps1`
