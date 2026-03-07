# Item Art Generation Pipeline

## Purpose
Generate curated art assets from `docs/data` with a deterministic, resumable pipeline.

This pipeline composes prompts from:
- a general art-direction prompt
- family-level prompt fragments
- item-level art description (`prompt_item_description`)

The generator sends **one item per request** to the OpenAI Images API.

## Files
- Script: `tools/generate_item_art.py`
- Manifest/metadata builder: `tools/build_item_art_manifest.py`
- Prompt/source config: `tools/item_art_prompts.yaml`
- Run state cache: `tools/.cache/item_art_state.json`
- Last run report: `tools/.cache/item_art_last_run.json`
- Default output folder: `apps/web/public/assets/items/generated/`

## Data Sources
Configured in `tools/item_art_prompts.yaml` under `sources`.

Current sources include:
- `docs/data/warrior_melee_weapon_name_ranges_v4.csv`
- `docs/data/ranger_ranged_weapon_name_ranges_v3.csv`
- `docs/data/mage_arcane_weapon_name_ranges_v3.csv`
- `docs/data/heavy_armor_name_ranges_v1.csv`
- `docs/data/light_armor_name_ranges_v1.csv`
- `docs/data/robe_armor_name_ranges_v1.csv`
- `docs/data/jewelry_ring_name_ranges_v1.csv`
- `docs/data/jewelry_necklace_name_ranges_v1.csv`
- `docs/data/character_avatar_prompt_templates_v1.csv` (characters)
- `docs/data/monster_family_members_v1.csv` joined with `docs/data/monster_families_v1.csv` (monsters)

Rows missing `prompt_item_description` are skipped by design.
Current curated item sources include handcrafted `prompt_item_description` values on every row, so the full item set is eligible.
Character sources can map a different prompt column (for example `prompt_character_avatar`) via source config.
Monster sources can merge shared family-row fields such as `background_prompt_shared` before prompt assembly.
Monster rows may optionally provide `background_prompt_override` for setpiece encounters that need their own scene scale or composition.
This is still a single render per monster row, not a separate background compositing pass.

## Prompt Layering
Final prompt is assembled in this order:
1. `general_prompt`
2. source-specific prompt prefix blocks (for example monster family background prompt rows and built-in level-tier direction for monsters)
3. family prompt by computed `family_key` or source-level family prompt
4. item design block from the configured prompt field (`Weapon Design:` wrapper for weapon rows, `Monster Design:` wrapper for monster rows)
5. render constraints from the selected group/general prompt rules

## Weapon Framing Rules
Weapon family prompts enforce a consistent composition language:
- All weapons keep the same diagonal tilt from lower-left to upper-right (shallow rise toward top-right).
- Melee swords: close crop on guard and grip with pommel clearly visible, realistic handle proportions, and only a short starting section of blade visible.
- Melee swords: hilt stays lower-left and blade tip direction stays upper-right, never mirrored.
- Melee axes: close crop on head, only part of haft shown, and haft must reach the lower-left frame edge and be visibly cropped by the border so it clearly continues out of frame.
- Melee axes: if single-bit, cutting edge points right or slight bottom-right, never left.
- Bows: close crop on grip/riser, only partial limbs shown, with the bowstring positioned toward the bottom-left area and clearly separated from the grip/riser.
- Slings: full sling may be shown for readability, and must show two visible cords attached to opposite sides of the pouch.
- Wands and staves: close crop on focus tip/head, only part of shaft/haft shown, and shaft/haft must run to the frame boundary so it reads as continuing out of frame.
- No hands, no characters, no worn presentation in weapon renders.

## Default Render Settings
From `render_defaults` in `tools/item_art_prompts.yaml`:
- model: `gpt-image-1.5`
- size: `1024x1024`
- background: `transparent`
- quality: `medium`

Group overrides can supersede defaults via `group_render_overrides`.
Current override:
- `characters` -> `quality: high`
- `monsters` -> `background: opaque`, `quality: high`

## Environment
Set in `.env` (see `.env.example`):
- `OPENAI_API_KEY` (required for non-dry runs)
- `OPENAI_BASE_URL` (optional, default `https://api.openai.com`)
- `OPENAI_CA_BUNDLE` (optional PEM CA bundle path for TLS verification)

## CLI Usage
```bash
python tools/generate_item_art.py --dry-run
python tools/generate_item_art.py --sources weapons
python tools/generate_item_art.py --sources armor --armor-archetype heavy --base-level 0
python tools/generate_item_art.py --sources monsters --monster-family tallow_cellar_00 --dry-run --verbose
python tools/generate_item_art.py --sources all --limit 10 --verbose
python tools/generate_item_art.py --force
python tools/generate_item_art.py --regenerate-changed
python tools/generate_item_art.py --ca-bundle C:\\path\\to\\cacert.pem
python tools/generate_item_art.py --insecure
```

Arguments:
- `--sources all|weapons|armor|jewelry|characters|monsters`
- `--output-dir <path>`
- `--limit <n>`
- `--base-level <n>`
- `--armor-archetype <heavy|light|robe>`
- `--monster-family <family_id>`
- `--dry-run`
- `--force`
- `--regenerate-changed`
- `--only-missing`
- `--verbose`
- `--config <path>`
- `--ca-bundle <path>`
- `--insecure`

## Rerun Behavior
Default mode only fills missing assets.

Rules:
- If output file missing: generate.
- If output exists: skip (even if prompt/config changed).
- If output was deleted: generate on next run.

`--force` overrides and regenerates all eligible rows.
`--regenerate-changed` opt-in restores hash-based regeneration (`model + size + background + quality + prompt + item_id`).
`--only-missing` is equivalent to the default mode.

## Output Contract
Default output path pattern:
`apps/web/public/assets/items/generated/<major_category>/<family_key_parts>/<asset_family>_<item_name>.png`

For each generated image, the pipeline also writes:
`apps/web/public/assets/items/generated/<major_category>/<family_key_parts>/<asset_family>_<item_name>.txt`

The `.txt` file contains the exact final prompt used for that item generation.

Generated app metadata files:
- `apps/web/src/generated/itemArtManifest.ts` (icon key -> PNG path map)
- `apps/web/public/assets/items/generated/item_art_manifest.json`
- `apps/web/src/generated/itemEncyclopediaData.ts` (catalog entries with base levels/families/icons)
- `apps/web/public/assets/items/generated/item_encyclopedia_data.json`

Character naming convention:
- Character portrait filenames are sequence IDs by stat family, not character names.
- Pattern: `character_<stat_code><n>.png` where stat code is `str`, `int`, or `dex`.
- Examples: `character_str1.png`, `character_int3.png`, `character_dex10.png`.

Monster naming convention:
- Monster filenames are family-scoped.
- Pattern: `monster/<family_id>/monster_<monster_name>.png`
- Example: `monster/tallow_cellar_00/monster_grease_gnawer.png`

Examples:
- `.../weapon/melee/sword/warrior_melee_iron_shortsword.png`
- `.../armor/heavy/helmet/heavy_armor_crude_cap.png`
- `.../jewelry/ring/ring_tin_ring.png`
- `.../monster/tallow_cellar_00/monster_grease_gnawer.png`

## Operational Notes
- One API request per item.
- Retry with exponential backoff for transient failures (`429`, `5xx`, network).
- Script writes a machine-readable run report after each run.
- Manifest + encyclopedia metadata are refreshed from current generated assets and `docs/data` tables.
- Generated assets and cache are ignored by git.
- TLS behavior:
  - default: verified TLS with system CA / `certifi` bundle (if installed)
  - custom CA: `--ca-bundle` or `OPENAI_CA_BUNDLE`
  - troubleshooting only: `--insecure` to disable certificate verification

## Writing Guidance (Curated Tables)
- `flavor_text` is lore metadata for item text systems and is not injected into image prompts.
- Encode arcane cues, glow behavior, and heroic relic qualities primarily in `prompt_item_description`, gated by item level (subtle around `50+`, stronger around `80+`).
- For monsters, keep family-wide environment direction in `background_prompt_shared` on the family table and keep monster-specific anatomy, gear, stance, and threat cues in `prompt_monster_fullbody`.
- Use row-level `background_prompt_override` sparingly for exceptional encounters such as group bosses that need a wider chamber, altered framing, or stronger environmental scale cues than the base family scene.
- Each monster family should feel like a distinct zone in ambience. Preserve strong internal consistency within one family, but make different zones clearly distinct from one another in mood, palette bias, landmark language, and environmental feel.
- Monster prompts should stay grounded at low levels, grow tougher and more disciplined through mid levels, introduce restrained arcane elements around `60+`, and reserve mythic language for `80+`.
- Very low levels such as `0`, `4`, and `8` should read weak, poorly equipped, and only locally dangerous. Avoid intimidating elite silhouettes at those tiers.
- Monster scenes should be a little clearer and less oppressive than pure horror art so the monster remains easy to read against the family background.
