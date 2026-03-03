# Jewelry Name-Range Tables

## Purpose
Define jewelry item-name progression for level 1-100 using name/range windows and flavor metadata.

This phase includes:
- ring name/range table
- necklace name/range table

This phase does not include jewelry stat scaling values.

## Source Files
- Curated ring table: `docs/data/jewelry_ring_name_ranges_v1.csv`
- Curated necklace table: `docs/data/jewelry_necklace_name_ranges_v1.csv`
- Validator: `tools/generate_armor_jewelry_name_tables.ps1`

## CSV Schema
Both jewelry tables use the same columns:
- `sequence`
- `item_name`
- `item_type`
- `major_category`
- `archetype`
- `slot_family`
- `allowed_class`
- `flavor_text`
- `prompt_item_description`
- `base_level`
- `drop_min_level`
- `drop_max_level_raw`
- `drop_max_level_capped`

## Field Rules
- `major_category`: always `jewelry`
- Ring table:
  - `archetype = ring`
  - `slot_family = ring`
  - `allowed_class = all`
- Necklace table:
  - `archetype = necklace`
  - `slot_family = necklace`
  - `allowed_class = all`
- `item_name`: must be 1-2 words (`max 2 words`)
- `flavor_text`: 1-2 sentences per row, ending with `.`
- `prompt_item_description`: handcrafted per-row art prompt text used by the item art pipeline

### Flavor Text Voice Rules
- Never include the item name in `flavor_text`.
- 1-2 sentences per row, ending with `.`.
- Punctuation: commas and periods are allowed. Do not use `;`, `!`, or `?`.
- Voice target: monk-scribe, cynical narrator, dark but defiant.
- Keep `flavor_text` mostly non-arcane across all levels; reserve arcane emphasis for `prompt_item_description`.

## Progression Rules
- Low base levels (`0-16`) should be plain/basic in name and tone.
- Mid base levels (`20-64`) should reflect reliable, battle-proven quality.
- High base levels (`68-100`) can use elite or relic-tier tone.
- Avoid advanced/mythic naming at low levels.
- Flavor art direction should match weapon tables: concise, dark-fantasy, and evocative.
- Flavor text is written manually item-by-item; do not auto-generate prose.
- Avoid explicit arcane effects language in `flavor_text` even at high levels; keep the lore grounded and let the art prompt carry arcane cues.
- Keep visible arcane cues in `prompt_item_description` rare, and largely limited to high-tier base levels (`80+`).
- Prompt text should be individually authored per item and avoid formulaic repeated phrasing.
- Flavor quality gates:
  - no duplicate `flavor_text` lines inside each jewelry table
  - avoid repeating the same sentence skeleton across adjacent progression rows
  - vary opening language and cadence so each row reads handcrafted

## Range Rules
- 25 rows per table.
- Sequence base levels increase by `+4`.
- Formulas:
  - `base_level = (sequence - 1) * 4`
  - `drop_min_level = max(0, base_level - 10)`
  - `drop_max_level_raw = base_level + 10`
  - `drop_max_level_capped = min(level_cap, drop_max_level_raw)` where `level_cap` defaults to `100`

Example progression:
- row 1 base `0` -> `0..10`
- row 2 base `4` -> `0..14`
- row 3 base `8` -> `0..18`
- row 4 base `12` -> `2..22`

## Edit And Validate
- Edit jewelry tables directly:
  - `docs/data/jewelry_ring_name_ranges_v1.csv`
  - `docs/data/jewelry_necklace_name_ranges_v1.csv`
- Validate:
  - `powershell -ExecutionPolicy Bypass -File .\tools\generate_armor_jewelry_name_tables.ps1`

## Deferred
- Jewelry primary/derived stat scaling values are intentionally deferred.
- Jewelry ilvl/stat roll scaling tables will be defined in a later phase.
