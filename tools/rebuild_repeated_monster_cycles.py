#!/usr/bin/env python3
"""Rebuild repeated monster-family cycles and copied asset folders through level 100."""

from __future__ import annotations

import csv
import re
import shutil
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
MONSTER_FAMILIES_CSV = REPO_ROOT / "docs" / "data" / "monster_families_v1.csv"
MONSTER_MEMBERS_CSV = REPO_ROOT / "docs" / "data" / "monster_family_members_v1.csv"
TRAVEL_STAGES_CSV = REPO_ROOT / "docs" / "data" / "travel_stage_scenes_v1.csv"

MONSTER_ASSET_ROOT = REPO_ROOT / "apps" / "web" / "public" / "assets" / "items" / "generated" / "monster"
COMBAT_STAGE_ASSET_ROOT = REPO_ROOT / "apps" / "web" / "public" / "assets" / "items" / "generated" / "combat_stage"
TRAVEL_STAGE_ASSET_ROOT = REPO_ROOT / "apps" / "web" / "public" / "assets" / "items" / "generated" / "travel_stage"

CANONICAL_BASE_LEVELS = (0, 4, 8, 12)
MAX_BASE_LEVEL = 100
LEVEL_STEP = 4


def read_csv_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = [{str(key): "" if value is None else str(value) for key, value in row.items()} for row in reader]
    return fieldnames, rows


def write_csv_rows(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def slugify_underscore(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value.lower()).strip("_")
    return slug or "item"


def format_level_suffix(level: int) -> str:
    return f"{level:02d}" if level < 100 else str(level)


def replace_family_level_suffix(family_id: str, level: int) -> str:
    return re.sub(r"_\d+$", f"_{format_level_suffix(level)}", family_id)


def roman_numeral(value: int) -> str:
    numerals = (
        (1000, "M"),
        (900, "CM"),
        (500, "D"),
        (400, "CD"),
        (100, "C"),
        (90, "XC"),
        (50, "L"),
        (40, "XL"),
        (10, "X"),
        (9, "IX"),
        (5, "V"),
        (4, "IV"),
        (1, "I"),
    )
    result: list[str] = []
    remainder = value
    for arabic, roman in numerals:
        while remainder >= arabic:
            result.append(roman)
            remainder -= arabic
    return "".join(result)


def append_cycle_suffix(value: str, cycle_index: int) -> str:
    if not value or cycle_index == 0:
        return value
    return f"{value} {roman_numeral(cycle_index + 1)}"


def collect_matching_files(directory: Path, stem: str) -> list[Path]:
    matches = list(directory.glob(f"{stem}.*"))
    matches.extend(directory.glob(f"{stem}_p.*"))
    unique_matches = sorted({path.resolve() for path in matches})
    return [Path(path) for path in unique_matches]


def copy_asset_group(source_dir: Path, target_dir: Path, source_stem: str, target_stem: str) -> int:
    matches = collect_matching_files(source_dir, source_stem)
    if not matches:
        raise FileNotFoundError(f"Missing asset source '{source_stem}' in '{source_dir}'.")

    copied = 0
    for source_path in matches:
        target_name = source_path.name.replace(source_stem, target_stem, 1)
        shutil.copy2(source_path, target_dir / target_name)
        copied += 1
    return copied


def main() -> int:
    family_fields, family_rows = read_csv_rows(MONSTER_FAMILIES_CSV)
    member_fields, member_rows = read_csv_rows(MONSTER_MEMBERS_CSV)
    travel_fields, travel_rows = read_csv_rows(TRAVEL_STAGES_CSV)

    canonical_family_rows = sorted(
        (row for row in family_rows if int(row.get("base_level", "0") or "0") in CANONICAL_BASE_LEVELS),
        key=lambda row: int(row["base_level"]),
    )
    if [int(row["base_level"]) for row in canonical_family_rows] != list(CANONICAL_BASE_LEVELS):
        raise ValueError("Expected canonical monster families at base levels 0, 4, 8, and 12.")

    canonical_family_by_base = {int(row["base_level"]): row for row in canonical_family_rows}
    canonical_family_ids = [row["family_id"] for row in canonical_family_rows]
    canonical_members_by_family = {
        family_id: [row for row in member_rows if row.get("family_id") == family_id] for family_id in canonical_family_ids
    }
    canonical_travel_by_family = {
        family_id: [row for row in travel_rows if row.get("family_id") == family_id] for family_id in canonical_family_ids
    }

    generated_family_rows: list[dict[str, str]] = []
    generated_member_rows: list[dict[str, str]] = []
    generated_travel_rows: list[dict[str, str]] = []
    generated_family_ids: list[str] = []
    asset_copy_plan: list[tuple[str, str, list[tuple[str, str]], list[tuple[str, str]], list[tuple[str, str]]]] = []
    travel_sequence = 1

    for level in range(0, MAX_BASE_LEVEL + LEVEL_STEP, LEVEL_STEP):
        canonical_base = level % 16
        cycle_index = level // 16
        source_family = canonical_family_by_base[canonical_base]
        target_family_id = replace_family_level_suffix(source_family["family_id"], level)
        generated_family_ids.append(target_family_id)

        target_family = dict(source_family)
        target_family["base_level"] = str(level)
        target_family["family_id"] = target_family_id
        target_family["family_name"] = append_cycle_suffix(source_family.get("family_name", ""), cycle_index)
        target_family["location_name"] = append_cycle_suffix(source_family.get("location_name", ""), cycle_index)
        target_family["combat_stage_name"] = append_cycle_suffix(source_family.get("combat_stage_name", ""), cycle_index)
        generated_family_rows.append(target_family)

        member_name_pairs: list[tuple[str, str]] = []
        target_members = []
        for source_member in canonical_members_by_family[source_family["family_id"]]:
            target_member = dict(source_member)
            target_member["family_id"] = target_family_id
            target_member["monster_name"] = append_cycle_suffix(source_member.get("monster_name", ""), cycle_index)
            generated_member_rows.append(target_member)
            target_members.append(target_member)
            member_name_pairs.append((source_member.get("monster_name", ""), target_member["monster_name"]))

        combat_stage_pairs = [
            (source_family.get("combat_stage_name", ""), target_family.get("combat_stage_name", ""))
        ]
        travel_scene_pairs: list[tuple[str, str]] = []
        for source_travel in canonical_travel_by_family[source_family["family_id"]]:
            target_travel = dict(source_travel)
            target_travel["sequence"] = str(travel_sequence)
            target_travel["family_id"] = target_family_id
            target_travel["base_level"] = str(level)
            target_travel["display_name"] = append_cycle_suffix(source_travel.get("display_name", ""), cycle_index)
            generated_travel_rows.append(target_travel)
            travel_scene_pairs.append((source_travel.get("scene_name", ""), target_travel.get("scene_name", "")))
            travel_sequence += 1

        asset_copy_plan.append(
            (
                source_family["family_id"],
                target_family_id,
                member_name_pairs,
                combat_stage_pairs,
                travel_scene_pairs,
            )
        )

    write_csv_rows(MONSTER_FAMILIES_CSV, family_fields, generated_family_rows)
    write_csv_rows(MONSTER_MEMBERS_CSV, member_fields, generated_member_rows)
    write_csv_rows(TRAVEL_STAGES_CSV, travel_fields, generated_travel_rows)

    repeated_family_ids = [family_id for family_id in generated_family_ids if family_id not in canonical_family_ids]
    for asset_root in (MONSTER_ASSET_ROOT, COMBAT_STAGE_ASSET_ROOT, TRAVEL_STAGE_ASSET_ROOT):
        for family_id in repeated_family_ids:
            target_dir = asset_root / family_id
            if target_dir.exists():
                shutil.rmtree(target_dir)
        for stale_dir in asset_root.glob("temporary_zone_*"):
            if stale_dir.is_dir():
                shutil.rmtree(stale_dir)

    total_copied_assets = 0
    for source_family_id, target_family_id, member_pairs, combat_pairs, travel_pairs in asset_copy_plan:
        if target_family_id in canonical_family_ids:
            continue

        monster_source_dir = MONSTER_ASSET_ROOT / source_family_id
        monster_target_dir = MONSTER_ASSET_ROOT / target_family_id
        combat_source_dir = COMBAT_STAGE_ASSET_ROOT / source_family_id
        combat_target_dir = COMBAT_STAGE_ASSET_ROOT / target_family_id
        travel_source_dir = TRAVEL_STAGE_ASSET_ROOT / source_family_id
        travel_target_dir = TRAVEL_STAGE_ASSET_ROOT / target_family_id

        monster_target_dir.mkdir(parents=True, exist_ok=True)
        combat_target_dir.mkdir(parents=True, exist_ok=True)
        travel_target_dir.mkdir(parents=True, exist_ok=True)

        for source_name, target_name in member_pairs:
            total_copied_assets += copy_asset_group(
                monster_source_dir,
                monster_target_dir,
                f"monster_{slugify_underscore(source_name)}",
                f"monster_{slugify_underscore(target_name)}",
            )
        for source_name, target_name in combat_pairs:
            total_copied_assets += copy_asset_group(
                combat_source_dir,
                combat_target_dir,
                f"combat_stage_{slugify_underscore(source_name)}",
                f"combat_stage_{slugify_underscore(target_name)}",
            )
        for source_name, target_name in travel_pairs:
            total_copied_assets += copy_asset_group(
                travel_source_dir,
                travel_target_dir,
                f"travel_stage_{slugify_underscore(source_name)}",
                f"travel_stage_{slugify_underscore(target_name)}",
            )

    print(f"Monster families: {len(generated_family_rows)}")
    print(f"Monster members: {len(generated_member_rows)}")
    print(f"Travel stages: {len(generated_travel_rows)}")
    print(f"Repeated family folders: {len(repeated_family_ids)}")
    print(f"Copied asset files: {total_copied_assets}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
