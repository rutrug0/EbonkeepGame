#!/usr/bin/env python3
"""Migrate previously generated item art assets to the current naming/path convention.

Moves:
- <output>/<major>/<major>/<...>/<item_id>.png -> <output>/<major>/<...>/<asset_family>_<item_name>.png
- also moves the matching .txt prompt file

Also updates tools/.cache/item_art_state.json output_path entries to the new paths.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

# Allow importing sibling tooling modules when executed as:
#   python tools/migrate_item_art_assets.py
THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

from generate_item_art import (  # type: ignore
    DEFAULT_CONFIG_PATH,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_STATE_PATH,
    build_item_record,
    load_config,
    load_json,
    output_filename_for,
    read_csv_rows,
)
from build_item_art_manifest import (  # type: ignore
    DEFAULT_JSON_OUT as DEFAULT_MANIFEST_JSON_OUT,
    DEFAULT_TS_OUT as DEFAULT_MANIFEST_TS_OUT,
    build_manifest,
    write_ts_manifest,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Migrate generated item art filenames to the new convention.")
    p.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to tools/item_art_prompts.yaml")
    p.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Generated asset root directory")
    p.add_argument("--state", default=str(DEFAULT_STATE_PATH), help="Path to tools/.cache/item_art_state.json")
    p.add_argument("--dry-run", action="store_true", help="Print planned moves only")
    p.add_argument(
        "--delete-duplicates",
        action="store_true",
        help="If both old and new files exist and are identical, delete the old file.",
    )
    return p.parse_args()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def main() -> int:
    args = parse_args()

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = (Path.cwd() / config_path).resolve()
    config = load_config(config_path)

    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = (Path.cwd() / output_dir).resolve()

    state_path = Path(args.state)
    if not state_path.is_absolute():
        state_path = (Path.cwd() / state_path).resolve()

    sources = config.get("sources")
    if not isinstance(sources, list):
        raise SystemExit("Config error: 'sources' must be a list.")

    state: dict[str, Any] = load_json(state_path)
    state_items = state.get("items") if isinstance(state.get("items"), dict) else {}

    planned_moves: list[tuple[Path, Path]] = []
    planned_deletes: list[Path] = []
    updated_state = 0

    for source in sources:
        if not isinstance(source, dict):
            continue
        source_id = source.get("id")
        source_group = source.get("group", "")
        source_path_value = source.get("path")
        if not source_id or not source_path_value:
            continue

        csv_path = Path(str(source_path_value))
        if not csv_path.is_absolute():
            csv_path = (Path.cwd() / csv_path).resolve()
        if not csv_path.exists():
            continue

        rows = read_csv_rows(csv_path)
        for idx, row in enumerate(rows, start=1):
            row = {str(k): ("" if v is None else str(v)) for k, v in row.items()}
            src = dict(source)
            src["id"] = str(source_id)
            src["group"] = str(source_group)
            src["path"] = str(csv_path)
            record = build_item_record(src, row, idx)
            if record is None:
                continue

            # Old path (pre-simplification):
            old_rel_parts = [record.major_category] + record.family_key.split(":") + [f"{record.item_id}.png"]
            old_png = output_dir.joinpath(*old_rel_parts)
            old_txt = old_png.with_suffix(".txt")

            # New path (current):
            family_parts = record.family_key.split(":")
            if family_parts and family_parts[0] == record.major_category:
                family_parts = family_parts[1:]
            new_png = output_dir.joinpath(record.major_category, *family_parts, output_filename_for(record))
            new_txt = new_png.with_suffix(".txt")

            if old_png.exists():
                if new_png.exists():
                    if args.delete_duplicates:
                        try:
                            if sha256_file(old_png) == sha256_file(new_png):
                                planned_deletes.append(old_png)
                                if old_txt.exists() and new_txt.exists():
                                    if sha256_file(old_txt) == sha256_file(new_txt):
                                        planned_deletes.append(old_txt)
                        except Exception:
                            # If hashing fails, do nothing destructive.
                            pass
                else:
                    planned_moves.append((old_png, new_png))
                    if old_txt.exists():
                        planned_moves.append((old_txt, new_txt))

            # Keep state paths in sync with new output path if the item is known.
            prev = state_items.get(record.item_id) if isinstance(state_items, dict) else None
            if isinstance(prev, dict):
                new_out = str(new_png)
                if prev.get("output_path") != new_out:
                    prev["output_path"] = new_out
                    state_items[record.item_id] = prev
                    updated_state += 1

    if args.dry_run:
        print(f"Planned moves: {len(planned_moves)}")
        for src, dst in planned_moves[:200]:
            print(f"MOVE {src} -> {dst}")
        if len(planned_moves) > 200:
            print(f"... ({len(planned_moves) - 200} more)")
        print(f"Planned deletes: {len(planned_deletes)}")
        for p in planned_deletes[:200]:
            print(f"DELETE {p}")
        if len(planned_deletes) > 200:
            print(f"... ({len(planned_deletes) - 200} more)")
        print(f"State entries that would be updated: {updated_state}")
        return 0

    moved = 0
    for src, dst in planned_moves:
        ensure_parent(dst)
        if dst.exists():
            continue
        src.rename(dst)
        moved += 1

    deleted = 0
    for p in planned_deletes:
        if p.exists():
            p.unlink()
            deleted += 1

    if isinstance(state_items, dict):
        state["items"] = state_items
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # Rebuild app manifest after path migration so mockups can auto-resolve assets.
    manifest = build_manifest(output_dir)
    write_ts_manifest(DEFAULT_MANIFEST_TS_OUT, manifest)
    DEFAULT_MANIFEST_JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    DEFAULT_MANIFEST_JSON_OUT.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # Optional: clean empty legacy dirs like armor/armor, weapon/weapon, jewelry/jewelry.
    for legacy in ("armor/armor", "weapon/weapon", "jewelry/jewelry"):
        legacy_dir = output_dir / legacy
        if legacy_dir.exists():
            # remove empty dirs bottom-up
            for sub in sorted(legacy_dir.rglob("*"), key=lambda p: len(str(p)), reverse=True):
                if sub.is_dir():
                    try:
                        sub.rmdir()
                    except OSError:
                        pass
            try:
                legacy_dir.rmdir()
            except OSError:
                pass

    print(f"Moved files: {moved}")
    print(f"Deleted duplicates: {deleted}")
    print(f"Updated state entries: {updated_state}")
    print(f"Manifest entries: {len(manifest)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
