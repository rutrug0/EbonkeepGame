#!/usr/bin/env python3
"""Build generated item icon and encyclopedia manifests for app consumption."""

from __future__ import annotations

import argparse
from pathlib import Path

from item_art_catalog import (
    DEFAULT_ASSET_ROOT,
    DEFAULT_CONFIG_PATH,
    DEFAULT_ENCYCLOPEDIA_JSON_PATH,
    DEFAULT_ENCYCLOPEDIA_TS_PATH,
    DEFAULT_MANIFEST_JSON_PATH,
    DEFAULT_MANIFEST_TS_PATH,
    build_encyclopedia_entries,
    build_generated_asset_manifest,
    write_encyclopedia_outputs,
    write_item_manifest_outputs,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TS_OUT = DEFAULT_MANIFEST_TS_PATH
DEFAULT_JSON_OUT = DEFAULT_MANIFEST_JSON_PATH
DEFAULT_ENCYCLOPEDIA_TS_OUT = DEFAULT_ENCYCLOPEDIA_TS_PATH
DEFAULT_ENCYCLOPEDIA_JSON_OUT = DEFAULT_ENCYCLOPEDIA_JSON_PATH


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build generated item icon manifest.")
    p.add_argument("--asset-root", default=str(DEFAULT_ASSET_ROOT))
    p.add_argument("--config", default=str(DEFAULT_CONFIG_PATH))
    p.add_argument("--ts-out", default=str(DEFAULT_TS_OUT))
    p.add_argument("--json-out", default=str(DEFAULT_JSON_OUT))
    p.add_argument("--encyclopedia-ts-out", default=str(DEFAULT_ENCYCLOPEDIA_TS_OUT))
    p.add_argument("--encyclopedia-json-out", default=str(DEFAULT_ENCYCLOPEDIA_JSON_OUT))
    return p.parse_args()


def main() -> int:
    args = parse_args()
    asset_root = Path(args.asset_root)
    config_path = Path(args.config)
    ts_out = Path(args.ts_out)
    json_out = Path(args.json_out)
    encyclopedia_ts_out = Path(args.encyclopedia_ts_out)
    encyclopedia_json_out = Path(args.encyclopedia_json_out)

    if not asset_root.is_absolute():
        asset_root = (REPO_ROOT / asset_root).resolve()
    if not config_path.is_absolute():
        config_path = (REPO_ROOT / config_path).resolve()
    if not ts_out.is_absolute():
        ts_out = (REPO_ROOT / ts_out).resolve()
    if not json_out.is_absolute():
        json_out = (REPO_ROOT / json_out).resolve()
    if not encyclopedia_ts_out.is_absolute():
        encyclopedia_ts_out = (REPO_ROOT / encyclopedia_ts_out).resolve()
    if not encyclopedia_json_out.is_absolute():
        encyclopedia_json_out = (REPO_ROOT / encyclopedia_json_out).resolve()

    manifest = build_generated_asset_manifest(asset_root)
    encyclopedia_entries = build_encyclopedia_entries(config_path=config_path, repo_root=REPO_ROOT, manifest=manifest)

    write_item_manifest_outputs(
        ts_out=ts_out,
        json_out=json_out,
        manifest=manifest,
        generated_by="tools/build_item_art_manifest.py",
    )
    write_encyclopedia_outputs(
        ts_out=encyclopedia_ts_out,
        json_out=encyclopedia_json_out,
        entries=encyclopedia_entries,
        generated_by="tools/build_item_art_manifest.py",
    )

    print(f"Manifest entries: {len(manifest)}")
    print(f"Encyclopedia entries: {len(encyclopedia_entries)}")
    print(f"TS manifest: {ts_out}")
    print(f"JSON manifest: {json_out}")
    print(f"TS encyclopedia: {encyclopedia_ts_out}")
    print(f"JSON encyclopedia: {encyclopedia_json_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
