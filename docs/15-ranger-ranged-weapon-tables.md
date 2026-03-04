# Ranger Ranged Weapon Tables

## Purpose
Define ranger ranged weapon progression with:
- shared `ilvl` scaling independent of weapon name
- rarity effects (`+5%` damage per rarity step)
- medium variance damage profile from the agility category
- weapon name/range table with class/family metadata and level-band flavor text

## Source Files
- Damage coefficients: `docs/data/warrior_weapon_damage_coefficients_v2.csv`
- Damage category profiles: `docs/data/weapon_damage_category_profiles.csv`
- Generated scaling table: `docs/data/ranger_ranged_weapon_ilvl_scaling_v1.csv`
- Generated name/range table: `docs/data/ranger_ranged_weapon_name_ranges_v3.csv`
- Generator: `tools/generate_warrior_weapon_tables.ps1`

## Name Table Metadata Columns
`docs/data/ranger_ranged_weapon_name_ranges_v3.csv` includes:
- `weapon_family` (always `ranged` for this table)
- `allowed_class` (always `ranger` for this table)
- `weapon_type` (`Bow` or `Sling`)
- `flavor_text` (single-sentence lore hint line, used as item identity text)
- `prompt_item_description` (hand-authored per-row item art prompt)

### Flavor Text Voice Rules (Curated Tables)
- Never include the item name in `flavor_text`.
- 1-2 sentences per row, ending with `.`.
- Punctuation: commas and periods are allowed. Do not use `;`, `!`, or `?`.
- Voice target: monk-scribe, cynical narrator, dark but defiant.
- Keep `flavor_text` mostly non-arcane across all levels; reserve arcane emphasis for `prompt_item_description`.

## Drop Range Rules
- Weapon sequence base levels increase by `+4`.
- Curated weapon rows follow strict type alternation by sequence: `Sling` then `Bow`, repeating.
- Drop window is `base_level +/- 10`.
- Lower bound is clamped to `0`.
- Upper bound is capped to current level cap (default `100`).

## Damage Scaling Rules
- `ilvl` range: `0..100`
- Agility/ranged profile uses medium template spread (`16%`).
- Item creation rolls and possible attack roll columns follow the same model as warrior melee:
  - template range by rarity
  - item min/max roll bands
  - per-hit roll between generated min/max
- Runtime also applies base-level influence (no clamp) using:
  - `multiplier = (1 - w) + w * ((base_avg_common + avg_growth_per_ilvl * base_level) / (base_avg_common + avg_growth_per_ilvl * ilvl))`
  - `w = base_level_influence_weight` from `docs/data/warrior_weapon_damage_coefficients_v2.csv` (default `0.25`)
  - multiplier is applied post-lookup to roll windows before min/max damage are rolled.
- After base min/max rolls are generated, direct damage affixes (`ranged_damage`) add a calibrated flat delta to both rolled min and rolled max based on tier-bounded damage-equivalent mapping.

## Regenerate
`powershell -ExecutionPolicy Bypass -File .\tools\generate_warrior_weapon_tables.ps1`
