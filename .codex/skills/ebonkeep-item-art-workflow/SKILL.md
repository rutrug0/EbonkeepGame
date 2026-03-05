---
name: ebonkeep-item-art-workflow
description: Operate the Ebonkeep item art generation pipeline, including prompt/source configuration, dry-run planning, generation, and manifest synchronization. Use when tasks involve tools/generate_item_art.py, tools/item_art_prompts.yaml, generated item assets, or item art manifest updates.
---

# Ebonkeep Item Art Workflow

## Workflow
1. Update prompt/source configuration in `tools/item_art_prompts.yaml` or curated `prompt_item_description` fields in `docs/data`.
2. Run a dry-run first to confirm scope and eligibility.
3. Generate missing assets or force regeneration as requested.
4. Confirm manifest/state consistency after generation.
5. Avoid manual edits of generated manifest outputs unless explicitly requested.

## Commands
- Dry-run plan:
  - `python tools/generate_item_art.py --dry-run`
- Generate selected sources:
  - `python tools/generate_item_art.py --sources all`
- Force regenerate:
  - `python tools/generate_item_art.py --force`
- Rebuild manifest only:
  - `python tools/build_item_art_manifest.py`

## Notes
- Respect `.env` settings (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_CA_BUNDLE`).
- Use `--ca-bundle` or `--insecure` only for TLS troubleshooting contexts.

