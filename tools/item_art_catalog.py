#!/usr/bin/env python3
"""Shared helpers for generated item art manifest and encyclopedia metadata."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = REPO_ROOT / "tools" / "item_art_prompts.yaml"
DEFAULT_ASSET_ROOT = REPO_ROOT / "apps" / "web" / "public" / "assets" / "items" / "generated"
DEFAULT_MANIFEST_TS_PATH = REPO_ROOT / "apps" / "web" / "src" / "generated" / "itemArtManifest.ts"
DEFAULT_MANIFEST_JSON_PATH = DEFAULT_ASSET_ROOT / "item_art_manifest.json"
DEFAULT_ENCYCLOPEDIA_TS_PATH = REPO_ROOT / "apps" / "web" / "src" / "generated" / "itemEncyclopediaData.ts"
DEFAULT_ENCYCLOPEDIA_JSON_PATH = DEFAULT_ASSET_ROOT / "item_encyclopedia_data.json"


def load_config(config_path: Path) -> dict[str, Any]:
    text = config_path.read_text(encoding="utf-8")
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
        raise ValueError("Top-level config must be an object/map.")
    except json.JSONDecodeError:
        pass

    try:
        import yaml  # type: ignore

        parsed = yaml.safe_load(text)
        if isinstance(parsed, dict):
            return parsed
        raise ValueError("Top-level config must be an object/map.")
    except ImportError as exc:
        raise RuntimeError(
            "Config is not JSON and PyYAML is not installed. "
            "Install pyyaml or keep tools/item_art_prompts.yaml JSON-compatible."
        ) from exc


def read_csv_rows(csv_path: Path) -> list[dict[str, str]]:
    import csv

    encodings = ["utf-8-sig", "utf-8", "cp1252", "latin-1"]
    last_error: Exception | None = None
    for encoding in encodings:
        try:
            with csv_path.open("r", encoding=encoding, newline="") as handle:
                return list(csv.DictReader(handle))
        except UnicodeDecodeError as exc:
            last_error = exc
    if last_error is not None:
        raise last_error
    return []


def normalize_name_for_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def normalize_identifier(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return normalized


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("_", " ").strip())


def parse_int(raw: str | None, fallback: int = 0) -> int:
    if raw is None:
        return fallback
    text = raw.strip()
    if not text:
        return fallback
    try:
        return int(float(text))
    except ValueError:
        return fallback


def key_for_generated_asset(rel: Path) -> tuple[str, str] | None:
    parts = rel.parts
    if len(parts) < 3:
        return None

    major = parts[0]
    filename = rel.stem.lower().replace("-", "_")

    if major == "weapon":
        if len(parts) < 4:
            return None
        weapon_archetype = parts[1].lower()
        family_prefix_by_arch = {
            "melee": "warrior_melee",
            "ranged": "ranger_ranged",
            "arcane": "mage_arcane",
        }
        family_prefix = family_prefix_by_arch.get(weapon_archetype, weapon_archetype)
        prefix = f"{family_prefix}_"
        item_slug = filename[len(prefix) :] if filename.startswith(prefix) else filename
        key = f"weapon:{weapon_archetype}:{normalize_name_for_key(item_slug.replace('_', ' '))}"
        return key, f"/assets/items/generated/{rel.as_posix()}"

    if major == "armor":
        if len(parts) < 4:
            return None
        armor_archetype = parts[1].lower()
        family_prefix = f"{armor_archetype}_armor_"
        item_slug = filename[len(family_prefix) :] if filename.startswith(family_prefix) else filename
        key = f"armor:{armor_archetype}:{normalize_name_for_key(item_slug.replace('_', ' '))}"
        return key, f"/assets/items/generated/{rel.as_posix()}"

    if major == "jewelry":
        if len(parts) < 3:
            return None
        jewelry_type = parts[1].lower()
        family_prefix = f"{jewelry_type}_"
        item_slug = filename[len(family_prefix) :] if filename.startswith(family_prefix) else filename
        key = f"jewelry:{jewelry_type}:{normalize_name_for_key(item_slug.replace('_', ' '))}"
        return key, f"/assets/items/generated/{rel.as_posix()}"

    if major == "character":
        if len(parts) < 3:
            return None
        stat_family = parts[1].lower()
        key = f"character:{stat_family}:{filename}"
        return key, f"/assets/items/generated/{rel.as_posix()}"

    return None


def build_generated_asset_manifest(asset_root: Path) -> dict[str, str]:
    manifest: dict[str, str] = {}
    for png in sorted(asset_root.rglob("*.png")):
        rel = png.relative_to(asset_root)
        parsed = key_for_generated_asset(rel)
        if not parsed:
            continue
        key, path = parsed
        manifest[key] = path
    return manifest


def write_item_manifest_outputs(
    ts_out: Path,
    json_out: Path,
    manifest: dict[str, str],
    generated_by: str,
) -> None:
    ts_out.parent.mkdir(parents=True, exist_ok=True)
    ts_body = json.dumps(manifest, indent=2, ensure_ascii=True)
    ts_out.write_text(
        f"// Auto-generated by {generated_by}\n"
        "// Do not edit manually.\n\n"
        "export const GENERATED_ITEM_ICON_PATHS: Record<string, string> = "
        f"{ts_body};\n",
        encoding="utf-8",
    )

    json_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def derive_catalog_fields(major_category: str, row: dict[str, str]) -> dict[str, str] | None:
    if major_category == "weapon":
        archetype = normalize_identifier(
            row.get("weapon_family", "") or row.get("weapon_archetype", "") or row.get("archetype", "")
        )
        item_name = (row.get("weapon_name") or row.get("item_name") or "").strip()
        if not archetype or not item_name:
            return None
        family = normalize_identifier(row.get("weapon_type", "") or row.get("item_type", "") or archetype)
        return {
            "key": f"weapon:{archetype}:{normalize_name_for_key(item_name)}",
            "archetype": archetype,
            "family": family,
            "slotFamily": normalize_identifier(row.get("slot_family", "")),
            "itemType": normalize_text(row.get("weapon_type", "") or row.get("item_type", "") or family),
            "itemName": item_name,
        }

    if major_category == "armor":
        archetype = normalize_identifier(row.get("archetype", ""))
        item_name = (row.get("item_name") or "").strip()
        if not archetype or not item_name:
            return None
        slot_family = normalize_identifier(row.get("slot_family", "") or row.get("item_type", ""))
        return {
            "key": f"armor:{archetype}:{normalize_name_for_key(item_name)}",
            "archetype": archetype,
            "family": slot_family,
            "slotFamily": slot_family,
            "itemType": normalize_text(row.get("item_type", "") or slot_family),
            "itemName": item_name,
        }

    if major_category == "jewelry":
        archetype = normalize_identifier(row.get("archetype", "") or row.get("item_type", ""))
        item_name = (row.get("item_name") or "").strip()
        if not archetype or not item_name:
            return None
        slot_family = normalize_identifier(row.get("slot_family", "") or archetype)
        return {
            "key": f"jewelry:{archetype}:{normalize_name_for_key(item_name)}",
            "archetype": archetype,
            "family": archetype,
            "slotFamily": slot_family,
            "itemType": normalize_text(row.get("item_type", "") or archetype),
            "itemName": item_name,
        }

    return None


def build_encyclopedia_entries(
    config_path: Path,
    repo_root: Path,
    manifest: dict[str, str],
) -> list[dict[str, Any]]:
    config = load_config(config_path)
    sources = config.get("sources", [])
    if not isinstance(sources, list):
        return []

    rows: list[dict[str, Any]] = []
    for source in sources:
        if not isinstance(source, dict):
            continue
        major_category = str(source.get("major_category", "")).strip().lower()
        if major_category not in {"weapon", "armor", "jewelry"}:
            continue

        source_id = str(source.get("id", "")).strip()
        csv_path_raw = str(source.get("path", "")).strip()
        if not csv_path_raw:
            continue
        csv_path = Path(csv_path_raw)
        if not csv_path.is_absolute():
            csv_path = (repo_root / csv_path).resolve()
        if not csv_path.exists():
            continue

        for row in read_csv_rows(csv_path):
            fields = derive_catalog_fields(major_category, row)
            if not fields:
                continue

            key = fields["key"]
            rows.append(
                {
                    "key": key,
                    "majorCategory": major_category,
                    "archetype": fields["archetype"],
                    "family": fields["family"],
                    "slotFamily": fields["slotFamily"],
                    "itemType": fields["itemType"],
                    "itemName": fields["itemName"],
                    "flavorText": (row.get("flavor_text") or "").strip(),
                    "baseLevel": parse_int(row.get("base_level"), 0),
                    "dropMinLevel": parse_int(row.get("drop_min_level"), 0),
                    "dropMaxLevel": parse_int(row.get("drop_max_level_capped"), 0),
                    "iconPath": manifest.get(key),
                    "sourceId": source_id,
                    "sequence": parse_int(row.get("sequence"), 0),
                }
            )

    rows.sort(
        key=lambda item: (
            item["majorCategory"],
            item["archetype"],
            item["baseLevel"],
            item["family"],
            item["sequence"],
            item["itemName"].lower(),
        )
    )
    return rows


def write_encyclopedia_outputs(
    ts_out: Path,
    json_out: Path,
    entries: list[dict[str, Any]],
    generated_by: str,
) -> None:
    ts_out.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(entries, indent=2, ensure_ascii=True)
    content = (
        f"// Auto-generated by {generated_by}\n"
        "// Do not edit manually.\n\n"
        "export type GeneratedEncyclopediaItem = {\n"
        "  key: string;\n"
        "  majorCategory: string;\n"
        "  archetype: string;\n"
        "  family: string;\n"
        "  slotFamily: string;\n"
        "  itemType: string;\n"
        "  itemName: string;\n"
        "  flavorText: string;\n"
        "  baseLevel: number;\n"
        "  dropMinLevel: number;\n"
        "  dropMaxLevel: number;\n"
        "  iconPath: string | null;\n"
        "  sourceId: string;\n"
        "  sequence: number;\n"
        "};\n\n"
        "export const GENERATED_ITEM_ENCYCLOPEDIA_DATA: GeneratedEncyclopediaItem[] = "
        f"{body};\n"
    )
    ts_out.write_text(content, encoding="utf-8")

    json_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
