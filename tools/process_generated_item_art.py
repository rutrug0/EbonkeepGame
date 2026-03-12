#!/usr/bin/env python3
"""Build processed in-game PNG variants for generated item art."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from item_art_processing import build_processed_asset_plan, cleanup_stale_processed_assets, process_asset_plan


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ASSET_ROOT = REPO_ROOT / "apps" / "web" / "public" / "assets"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build processed in-game PNG variants for generated item art.")
    parser.add_argument("--asset-root", default=str(DEFAULT_ASSET_ROOT), help="Root folder for generated item art.")
    parser.add_argument("--force", action="store_true", help="Regenerate processed variants even when they already exist.")
    parser.add_argument("--dry-run", action="store_true", help="Plan changes without writing files.")
    parser.add_argument("--limit", type=int, default=None, help="Process at most N eligible source PNGs.")
    parser.add_argument("--verbose", action="store_true", help="Log each processed asset.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    asset_root = Path(args.asset_root)
    if not asset_root.is_absolute():
        asset_root = (REPO_ROOT / asset_root).resolve()

    if not asset_root.exists():
        raise SystemExit(f"Asset root not found: {asset_root}")

    counts = {
        "total_source_png": 0,
        "processable": 0,
        "processed": 0,
        "skipped_existing": 0,
        "skipped_unsupported": 0,
        "stale_deleted": 0,
    }

    planned = []
    for pattern in ("*.png", "*.jpg", "*.jpeg"):
        for source_path in sorted(asset_root.rglob(pattern)):
            counts["total_source_png"] += 1
            plan = build_processed_asset_plan(asset_root, source_path)
            if plan is None:
                counts["skipped_unsupported"] += 1
                continue
            counts["processable"] += 1
            planned.append(plan)

    if args.limit is not None and args.limit >= 0:
        planned = planned[: args.limit]

    for plan in planned:
        stale_existing = [path for path in plan.stale_output_paths if path.exists()]
        if plan.output_path.exists() and not args.force:
            if not args.dry_run and stale_existing:
                cleanup_stale_processed_assets(plan)
                counts["stale_deleted"] += len(stale_existing)
            counts["skipped_existing"] += 1
            if args.verbose:
                print(f"SKIP {plan.source_path} -> {plan.output_path}")
            continue

        if args.dry_run:
            if args.verbose:
                size_label = (
                    f"{plan.target_size[0]}x{plan.target_size[1]}"
                    if plan.target_size is not None
                    else "source-size"
                )
                print(
                    f"DRYRUN {plan.source_path} -> {plan.output_path} "
                    f"({size_label}, {plan.output_format})"
                )
            continue

        process_asset_plan(plan)
        counts["processed"] += 1
        counts["stale_deleted"] += len(stale_existing)
        if args.verbose:
            size_label = (
                f"{plan.target_size[0]}x{plan.target_size[1]}"
                if plan.target_size is not None
                else "source-size"
            )
            print(
                f"WRITE {plan.source_path} -> {plan.output_path} "
                f"({size_label}, {plan.output_format})"
            )

    print(json.dumps({"asset_root": str(asset_root), "counts": counts}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
