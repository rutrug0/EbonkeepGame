# Item Art Generation Pipeline

## Purpose
Generate item art assets from `docs/data` with a deterministic, resumable pipeline.

This pipeline composes prompts from:
- a general art-direction prompt
- family-level prompt fragments
- item-level metadata (`name`, `prompt_item_description`, `flavor_text`)

The generator sends **one item per request** to the OpenAI Images API.

## Files
- Script: `tools/generate_item_art.py`
- Prompt/source config: `tools/item_art_prompts.yaml`
- Run state cache: `tools/.cache/item_art_state.json`
- Last run report: `tools/.cache/item_art_last_run.json`
- Default output folder: `apps/web/public/assets/items/generated/`

## Data Sources
Configured in `tools/item_art_prompts.yaml` under `sources`.

Current sources include:
- `docs/data/warrior_melee_weapon_name_ranges_v4_manual_prompts.csv`
- `docs/data/ranger_ranged_weapon_name_ranges_v2.csv`
- `docs/data/mage_arcane_weapon_name_ranges_v2.csv`
- `docs/data/heavy_armor_name_ranges_v1.csv`
- `docs/data/light_armor_name_ranges_v1.csv`
- `docs/data/robe_armor_name_ranges_v1.csv`
- `docs/data/jewelry_ring_name_ranges_v1.csv`
- `docs/data/jewelry_necklace_name_ranges_v1.csv`

Rows missing `prompt_item_description` are skipped by design.
Current curated item sources include handcrafted `prompt_item_description` values on every row, so the full item set is eligible.

## Prompt Layering
Final prompt is assembled in this order:
1. `general_prompt`
2. family prompt by computed `family_key`
3. item metadata block:
   - item name
   - category/family/type
   - base level and level band
   - `prompt_item_description`
   - `flavor_text`
4. render constraints (single item, transparent background, no text/logo)

## Default Render Settings
From `render_defaults` in `tools/item_art_prompts.yaml`:
- model: `gpt-image-1.5`
- size: `1024x1024`
- background: `transparent`
- quality: `medium`

## Environment
Set in `.env` (see `.env.example`):
- `OPENAI_API_KEY` (required for non-dry runs)
- `OPENAI_BASE_URL` (optional, default `https://api.openai.com`)
- `OPENAI_CA_BUNDLE` (optional PEM CA bundle path for TLS verification)

## CLI Usage
```bash
python tools/generate_item_art.py --dry-run
python tools/generate_item_art.py --sources weapons
python tools/generate_item_art.py --sources all --limit 10 --verbose
python tools/generate_item_art.py --force
python tools/generate_item_art.py --only-missing
python tools/generate_item_art.py --ca-bundle C:\\path\\to\\cacert.pem
python tools/generate_item_art.py --insecure
```

Arguments:
- `--sources all|weapons|armor|jewelry`
- `--output-dir <path>`
- `--limit <n>`
- `--dry-run`
- `--force`
- `--only-missing`
- `--verbose`
- `--config <path>`
- `--ca-bundle <path>`
- `--insecure`

## Rerun Behavior
Pipeline computes a prompt/render hash per item (`model + size + background + quality + prompt + item_id`).

Rules:
- If output file missing: generate.
- If output exists and hash unchanged: skip.
- If output exists and hash changed: regenerate.
- If output was deleted: regenerate on next run.

`--force` overrides and regenerates all eligible rows.
`--only-missing` only fills missing files.

## Output Contract
Default output path pattern:
`apps/web/public/assets/items/generated/<major_category>/<family_key_parts>/<asset_family>_<item_name>.png`

For each generated image, the pipeline also writes:
`apps/web/public/assets/items/generated/<major_category>/<family_key_parts>/<asset_family>_<item_name>.txt`

The `.txt` file contains the exact final prompt used for that item generation.

Examples:
- `.../weapon/melee/sword/warrior_melee_iron_shortsword.png`
- `.../armor/heavy/helmet/heavy_armor_crude_cap.png`
- `.../jewelry/ring/ring_tin_ring.png`

## Operational Notes
- One API request per item.
- Retry with exponential backoff for transient failures (`429`, `5xx`, network).
- Script writes a machine-readable run report after each run.
- Generated assets and cache are ignored by git.
- TLS behavior:
  - default: verified TLS with system CA / `certifi` bundle (if installed)
  - custom CA: `--ca-bundle` or `OPENAI_CA_BUNDLE`
  - troubleshooting only: `--insecure` to disable certificate verification

## Writing Guidance (Curated Tables)
- `flavor_text` is treated as a lore hint in a monk-scribe, cynical narrator voice (dark but defiant).
- Keep `flavor_text` mostly non-arcane across all levels, and avoid referencing the item name inside the sentence.
- Encode arcane cues, glow behavior, and heroic relic qualities primarily in `prompt_item_description`, gated by item level (subtle around `50+`, stronger around `80+`).
