# Item Prefix/Affix Scaling Table (Level 1-100)

## Purpose
Defines a backend-friendly scaling model for item prefix/affix roll values from item level 1 to 100, with linear base scaling plus slight geometric amplification for flat stat groups.

## Files
- Coefficients (editable): `docs/data/affix_scaling_coefficients.csv`
- Generated table (backend-ready): `docs/data/affix_scaling_level_1_100.csv`
- Generator script: `tools/generate_affix_scaling_table.ps1`

## Scaling Keys
- `attr_primary`: shared by `strength`, `intelligence`, `dexterity`
- `vitality_primary`: `vitality`
- `damage_primary`: shared by `melee_damage`, `spell_damage`, `ranged_damage`
- `resistance_primary`: shared by `armor`, `spell_shield`, `missile_resistance`
- `max_hitpoints_primary`: `max_hitpoints`
- `crit_chance`: `crit_chance`
- `crit_damage`: `crit_damage`
- `double_attack_chance`: `double_attack_chance`, `extra_attack_chance`

## Roll Formula
For each row in `affix_scaling_coefficients.csv`:

- `linear_effective_level = (1 + level_offset) + ((item_level - 1) * growth_multiplier)`
- `geometric_multiplier = geometric_growth_per_level^(item_level - 1)`
- `effective_level = linear_effective_level * geometric_multiplier`
- `roll_min = round_away_from_zero(effective_level * min_coef)`
- `roll_max = round_away_from_zero(effective_level * max_coef)`
- For `flat` units, minimum value is clamped to at least `1`.

## Unit Semantics
- `flat`: direct stat value.
- `basis_points`: 1% = 100 basis points.

Examples:
- `crit_chance roll = 85` means `+0.85% crit chance`.
- `crit_damage roll = 450` means `+4.50% crit damage`.

## Tier and Affix Roll Rules
- Tier weights per prefix/affix roll:
  - T1: 60%
  - T2: 30%
  - T3: 10%
- Each prefix in the selected prefix pool has equal probability.
- Each suffix in the selected suffix pool has equal probability.
- Weapon power scoring uses these roll values by mapping each affix roll to a tier-bounded damage-equivalent contribution (defined in [06-progression-itemization-and-economy.md](./06-progression-itemization-and-economy.md), `Item Power Score Formula`).
- Tier weights (T1/T2/T3 roll chance) remain unchanged and independent from power coefficient tuning.

## Verified Anchor Example
At item level `1`, `resistance_primary` rolls:
- `T1 = 1-2`
- `T2 = 2-2`
- `T3 = 2-3`

At item level `100`, `attr_primary` `T1` rolls:
- `152-243`

## Current Growth Controls
- Flat stat groups (`attr_primary`, `vitality_primary`, `damage_primary`, `resistance_primary`, `max_hitpoints_primary`):
  - `growth_multiplier = 1.0`
  - `geometric_growth_per_level = 1.0104` (about +1.04% per level)
- Basis-point/chance groups (`crit_chance`, `crit_damage`, `double_attack_chance`):
  - `growth_multiplier = 0.5` (50% slower growth)
  - `geometric_growth_per_level = 1.0` (disabled to avoid runaway non-linear chance scaling)

## Non-Linear Stat Safety (Recommended Global Caps)
Chance-based stats scale linearly per affix, but combat impact is non-linear in aggregate.  
Use global runtime caps to protect balance:

- `crit_chance_total_cap = 6000` (60.00%)
- `double_attack_chance_total_cap = 3500` (35.00%)
- `crit_damage_bonus_cap = 30000` (300.00% bonus)

## How To Rebalance
1. Edit `docs/data/affix_scaling_coefficients.csv`.
2. Regenerate table:
   - `powershell -ExecutionPolicy Bypass -File .\tools\generate_affix_scaling_table.ps1`
3. Commit both updated files.
