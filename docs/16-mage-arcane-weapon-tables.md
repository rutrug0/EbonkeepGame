# Mage Arcane Weapon Tables

## Purpose
Define mage arcane weapon progression with:
- shared `ilvl` scaling independent of weapon name
- rarity effects (`+5%` damage per rarity step)
- wide variance damage profile from the intelligence category
- weapon name/range table with class/family metadata and level-band flavor text

## Source Files
- Damage coefficients: `docs/data/warrior_weapon_damage_coefficients_v2.csv`
- Damage category profiles: `docs/data/weapon_damage_category_profiles.csv`
- Generated scaling table: `docs/data/mage_arcane_weapon_ilvl_scaling_v1.csv`
- Generated name/range table: `docs/data/mage_arcane_weapon_name_ranges_v3.csv`
- Curated art-prompt source: `docs/data/mage_arcane_weapon_name_ranges_v2.csv`
- Generator: `tools/generate_warrior_weapon_tables.ps1`

## Name Table Metadata Columns
`docs/data/mage_arcane_weapon_name_ranges_v3.csv` includes:
- `weapon_family` (always `arcane` for this table)
- `allowed_class` (always `mage` for this table)
- `weapon_type` (`Wand` or `Staff`)
- `flavor_text` (single-sentence lore hint line, used as item identity text)

`docs/data/mage_arcane_weapon_name_ranges_v2.csv` is the curated source used by the item art pipeline and includes:
- `prompt_item_description` (hand-authored per-row item art prompt)

### Flavor Text Voice Rules (Curated Tables)
- Never include the item name in `flavor_text`.
- 1-2 sentences per row, ending with `.`.
- Punctuation: commas and periods are allowed. Do not use `;`, `!`, or `?`.
- Voice target: monk-scribe, cynical narrator, dark but defiant.
- Keep `flavor_text` mostly non-arcane across all levels; reserve arcane emphasis for `prompt_item_description`.

## Drop Range Rules
- Weapon sequence base levels increase by `+4`.
- Drop window is `base_level +/- 10`.
- Lower bound is clamped to `0`.
- Upper bound is capped to current level cap (default `100`).

## Damage Scaling Rules
- `ilvl` range: `0..100`
- Intelligence/arcane profile uses wide template spread (`22%`).
- Item creation rolls and possible attack roll columns follow the same model as warrior melee:
  - template range by rarity
  - item min/max roll bands
  - per-hit roll between generated min/max

## Regenerate
`powershell -ExecutionPolicy Bypass -File .\tools\generate_warrior_weapon_tables.ps1`
