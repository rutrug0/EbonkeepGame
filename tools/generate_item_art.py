#!/usr/bin/env python3
"""Generate art assets from docs/data CSV definitions via OpenAI Images API.

Behavior:
- One item per API request.
- Prompt layering: general + family + item-specific fields.
- Missing-first reruns: existing files are skipped unless explicitly regenerated.
- Missing/empty `prompt_item_description` rows are skipped.
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
import os
import random
import re
import ssl
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib import error, request

from item_art_catalog import (
    DEFAULT_ENCYCLOPEDIA_JSON_PATH as CATALOG_DEFAULT_ENCYCLOPEDIA_JSON_PATH,
    DEFAULT_ENCYCLOPEDIA_TS_PATH as CATALOG_DEFAULT_ENCYCLOPEDIA_TS_PATH,
    build_encyclopedia_entries,
    build_generated_asset_manifest,
    write_encyclopedia_outputs,
    write_item_manifest_outputs,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = REPO_ROOT / "tools" / "item_art_prompts.yaml"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "apps" / "web" / "public" / "assets" / "items" / "generated"
DEFAULT_CACHE_DIR = REPO_ROOT / "tools" / ".cache"
DEFAULT_STATE_PATH = DEFAULT_CACHE_DIR / "item_art_state.json"
DEFAULT_REPORT_PATH = DEFAULT_CACHE_DIR / "item_art_last_run.json"
DEFAULT_ENV_PATH = REPO_ROOT / ".env"
DEFAULT_MANIFEST_TS_PATH = REPO_ROOT / "apps" / "web" / "src" / "generated" / "itemArtManifest.ts"
DEFAULT_MANIFEST_JSON_PATH = REPO_ROOT / "apps" / "web" / "public" / "assets" / "items" / "generated" / "item_art_manifest.json"
DEFAULT_ENCYCLOPEDIA_TS_PATH = CATALOG_DEFAULT_ENCYCLOPEDIA_TS_PATH
DEFAULT_ENCYCLOPEDIA_JSON_PATH = CATALOG_DEFAULT_ENCYCLOPEDIA_JSON_PATH

TRANSIENT_STATUS_CODES = {429, 500, 502, 503, 504}
CHARACTER_SERIOUS_STYLE_GUARDRAILS = (
    "Character Tone Guardrails:\n\n"
    "serious, grounded medieval fantasy mood\n\n"
    "adult character appearance only (no childlike or teen stylization)\n\n"
    "realistic facial proportions and eye size\n\n"
    "no anime style\n\n"
    "no manga style\n\n"
    "no chibi style\n\n"
    "no cute idol styling\n\n"
    "no exaggerated expressions\n\n"
    "entire head must fit fully in frame, including full hair volume\n\n"
    "leave visible padding above hairline and above tallest hair shapes\n\n"
    "never crop forehead, hair, or top of head by image boundary\n\n"
    "camera framing must include upper torso to waistline; do not zoom to chest-only crop\n\n"
    "keep full head and hair inside a safe frame area with clear top margin\n\n"
    "avoid direct eye contact as a default; off-camera gaze is preferred\n\n"
    "weathered, practical materials and restrained ornamentation"
)
CHARACTER_GAZE_VARIANTS = (
    "Pose and Gaze Variation:\n\n"
    "three-quarter head angle (10-20 degrees) toward viewer left\n\n"
    "eyes looking slightly off-camera left",
    "Pose and Gaze Variation:\n\n"
    "three-quarter head angle (10-20 degrees) toward viewer right\n\n"
    "eyes looking slightly off-camera right",
    "Pose and Gaze Variation:\n\n"
    "near-frontal head angle\n\n"
    "gaze slightly above camera line, not direct eye contact",
    "Pose and Gaze Variation:\n\n"
    "head subtly lowered (5-10 degrees)\n\n"
    "eyes looking past camera toward viewer right",
    "Pose and Gaze Variation:\n\n"
    "head subtly raised (5-10 degrees)\n\n"
    "eyes looking past camera toward viewer left",
)


def character_gaze_block(item_id: str) -> str:
    digest = hashlib.sha256(item_id.encode("utf-8")).hexdigest()
    variant_idx = int(digest[:8], 16) % len(CHARACTER_GAZE_VARIANTS)
    return CHARACTER_GAZE_VARIANTS[variant_idx]


def write_generated_item_manifest(output_dir: Path, config_path: Path) -> None:
    manifest = build_generated_asset_manifest(output_dir)
    write_item_manifest_outputs(
        ts_out=DEFAULT_MANIFEST_TS_PATH,
        json_out=DEFAULT_MANIFEST_JSON_PATH,
        manifest=manifest,
        generated_by="tools/generate_item_art.py",
    )
    encyclopedia_entries = build_encyclopedia_entries(config_path=config_path, repo_root=REPO_ROOT, manifest=manifest)
    write_encyclopedia_outputs(
        ts_out=DEFAULT_ENCYCLOPEDIA_TS_PATH,
        json_out=DEFAULT_ENCYCLOPEDIA_JSON_PATH,
        entries=encyclopedia_entries,
        generated_by="tools/generate_item_art.py",
    )


@dataclass
class ItemRecord:
    item_id: str
    source_id: str
    source_group: str
    csv_path: str
    row_number: int
    major_category: str
    family_key: str
    display_name: str
    output_name: str
    item_type: str
    base_level: int
    level_band: str
    family_prompt: str
    prompt_prefix_blocks: list[str]
    prompt_item_description: str
    flavor_text: str


def load_dotenv(dotenv_path: Path) -> None:
    if not dotenv_path.exists():
        return
    for raw_line in dotenv_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_config(config_path: Path) -> dict[str, Any]:
    text = config_path.read_text(encoding="utf-8")
    # JSON is valid YAML 1.2 and avoids mandatory parser deps.
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    try:
        import yaml  # type: ignore

        data = yaml.safe_load(text)
        if not isinstance(data, dict):
            raise ValueError("Top-level config must be an object/map.")
        return data
    except ImportError as exc:
        raise RuntimeError(
            "Config is not JSON and PyYAML is not installed. "
            "Install pyyaml or keep tools/item_art_prompts.yaml JSON-compatible."
        ) from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate art assets from docs/data CSV files.")
    parser.add_argument(
        "--sources",
        choices=["all", "weapons", "armor", "jewelry", "characters", "monsters"],
        default="all",
        help="Subset of configured sources to process.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Output directory for generated PNG assets.",
    )
    parser.add_argument("--limit", type=int, default=None, help="Process at most N eligible items.")
    parser.add_argument("--dry-run", action="store_true", help="Plan actions only; do not call API or write PNG files.")
    parser.add_argument("--force", action="store_true", help="Regenerate all selected eligible items.")
    parser.add_argument(
        "--regenerate-changed",
        action="store_true",
        help="Opt in to hash-based regeneration when an existing file's prompt/render hash changed.",
    )
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="Generate only missing images (default behavior; kept for compatibility).",
    )
    parser.add_argument("--verbose", action="store_true", help="Verbose per-item logging.")
    parser.add_argument(
        "--random-level-sample",
        action="store_true",
        help="Sample planned items randomly across low/mid/high level bands before applying --limit.",
    )
    parser.add_argument(
        "--random-seed",
        type=int,
        default=None,
        help="Optional seed for deterministic random sampling order.",
    )
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to prompt/source YAML config.")
    parser.add_argument(
        "--weapon-type",
        default=None,
        help="Only include weapon rows matching this type (case-insensitive), e.g. axe.",
    )
    parser.add_argument(
        "--base-level",
        type=int,
        default=None,
        help="Only include rows whose base_level exactly matches this value.",
    )
    parser.add_argument(
        "--armor-archetype",
        default=None,
        help="Only include armor rows matching this archetype (case-insensitive), e.g. heavy.",
    )
    parser.add_argument(
        "--monster-family",
        default=None,
        help="Only include monster rows matching this family_id (case-insensitive), e.g. tallow_cellar_00.",
    )
    parser.add_argument(
        "--ca-bundle",
        default=None,
        help="Path to a PEM CA bundle for TLS verification (optional).",
    )
    parser.add_argument(
        "--insecure",
        action="store_true",
        help="Disable TLS certificate verification (only for local troubleshooting).",
    )
    return parser.parse_args()


def read_csv_rows(csv_path: Path) -> list[dict[str, str]]:
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


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return slug or "item"


def slugify_underscore(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value.lower()).strip("_")
    return slug or "item"


def character_output_name(row: dict[str, str], fallback_sequence: int) -> str:
    main_stat = (row.get("main_stat") or "").strip().lower()
    stat_code_by_main_stat = {
        "strength": "str",
        "intelligence": "int",
        "dexterity": "dex",
    }
    stat_code = stat_code_by_main_stat.get(main_stat, "char")

    character_id = slugify_underscore((row.get("character_id") or "").strip())
    match = re.match(r"^(str|int|dex)_(\d+)", character_id)
    if match:
        stat_code = match.group(1)
        number = int(match.group(2))
        return f"{stat_code}{number}"

    return f"{stat_code}{max(fallback_sequence, 1)}"


def merge_source_lookups(
    *,
    source: dict[str, Any],
    row: dict[str, str],
    repo_root: Path,
    lookup_cache: dict[tuple[str, str], dict[str, dict[str, str]]],
) -> dict[str, str]:
    lookups = source.get("lookups")
    if not isinstance(lookups, list):
        return row

    merged_row = dict(row)
    for lookup in lookups:
        if not isinstance(lookup, dict):
            continue
        lookup_path_raw = str(lookup.get("path", "")).strip()
        source_key = str(lookup.get("source_key", "")).strip()
        lookup_key = str(lookup.get("lookup_key", "")).strip()
        if not lookup_path_raw or not source_key or not lookup_key:
            continue

        lookup_value = (merged_row.get(source_key) or "").strip()
        if not lookup_value:
            continue

        lookup_path = Path(lookup_path_raw)
        if not lookup_path.is_absolute():
            lookup_path = (repo_root / lookup_path).resolve()
        cache_key = (str(lookup_path), lookup_key)
        indexed_rows = lookup_cache.get(cache_key)
        if indexed_rows is None:
            indexed_rows = {}
            for lookup_row in read_csv_rows(lookup_path):
                indexed_value = (lookup_row.get(lookup_key) or "").strip()
                if indexed_value:
                    indexed_rows[indexed_value] = {
                        str(k): ("" if v is None else str(v)) for k, v in lookup_row.items()
                    }
            lookup_cache[cache_key] = indexed_rows

        matched_row = indexed_rows.get(lookup_value)
        if not matched_row:
            continue
        merged_row = dict(matched_row) | merged_row

    return merged_row


def asset_family_for(record: ItemRecord) -> str:
    if record.major_category == "armor":
        parts = record.family_key.split(":")
        archetype = parts[1] if len(parts) > 1 else "armor"
        return f"{slugify_underscore(archetype)}_armor"

    if record.major_category == "jewelry":
        parts = record.family_key.split(":")
        archetype = parts[1] if len(parts) > 1 else "jewelry"
        return slugify_underscore(archetype)

    if record.major_category == "weapon":
        # Source ids are curated and stable, use them as the naming family,
        # stripping version/manual suffixes for readability.
        family = slugify_underscore(record.source_id)
        family = re.sub(r"_v\d+_manual$", "", family)
        family = re.sub(r"_v\d+$", "", family)
        family = re.sub(r"_manual$", "", family)
        return family

    if record.major_category == "monster":
        return "monster"

    return slugify_underscore(record.major_category)


def output_filename_for(record: ItemRecord) -> str:
    family = asset_family_for(record)
    name = slugify_underscore(record.output_name)
    return f"{family}_{name}.png"


def level_band(base_level: int) -> str:
    if base_level <= 16:
        return "low"
    if base_level <= 64:
        return "mid"
    return "high"


def infer_major_category(source: dict[str, Any], row: dict[str, str]) -> str:
    if source.get("major_category"):
        return str(source["major_category"])
    if "weapon_family" in row:
        return "weapon"
    if row.get("major_category"):
        return row["major_category"]
    return "item"


def build_family_key(source: dict[str, Any], row: dict[str, str], major_category: str) -> str:
    if source.get("family_key_template"):
        template = str(source["family_key_template"])
        return template.format(**{k: (v or "") for k, v in row.items()})

    if major_category == "weapon":
        return f"weapon:{row.get('weapon_family', '').strip()}:{row.get('weapon_type', '').strip().lower()}"
    if major_category == "armor":
        return f"armor:{row.get('archetype', '').strip()}:{row.get('slot_family', '').strip()}"
    if major_category == "jewelry":
        return f"jewelry:{row.get('archetype', '').strip()}"
    if major_category == "character":
        return f"character:{(row.get('main_stat') or '').strip().lower()}"
    if major_category == "monster":
        family_id = (row.get("family_id") or "").strip()
        return f"monster:{family_id}" if family_id else "monster"
    return major_category


def resolve_family_prompt(
    source: dict[str, Any],
    row: dict[str, str],
    family_key: str,
    config: dict[str, Any],
) -> str:
    family_prompts = config.get("families", {})
    if isinstance(family_prompts, dict):
        exact_prompt = str(family_prompts.get(family_key, "")).strip()
        if exact_prompt:
            return exact_prompt

    source_prompt = str(source.get("family_prompt", "")).strip()
    if source_prompt:
        try:
            return source_prompt.format(**{k: (v or "") for k, v in row.items()}).strip()
        except KeyError:
            return source_prompt

    return ""


def collect_prompt_prefix_blocks(source: dict[str, Any], row: dict[str, str]) -> list[str]:
    fields = source.get("prompt_prefix_fields")
    if not isinstance(fields, list):
        return []

    blocks: list[str] = []
    background_override = (row.get("background_prompt_override") or "").strip()
    for field in fields:
        field_name = str(field).strip()
        if not field_name:
            continue
        value = (row.get(field_name) or "").strip()
        if field_name == "background_prompt_shared" and background_override:
            value = background_override
        if value:
            blocks.append(value)
    return blocks


def monster_level_direction(base_level: int) -> str:
    if base_level <= 8:
        return (
            "Monster Tier Direction:\n\n"
            "very low-tier enemy\n\n"
            "should look weak, shabby, underfed, badly equipped, and locally dangerous at most\n\n"
            "avoid intimidating elite presence\n\n"
            "avoid heroic menace\n\n"
            "avoid oversized anatomy, exaggerated musculature, or horror-heavy distortion\n\n"
            "prefer poor posture, crude gear, thin limbs, worn cloth, scavenged tools, and low social status readability"
        )
    if base_level <= 20:
        return (
            "Monster Tier Direction:\n\n"
            "low-tier enemy\n\n"
            "should look rough, dangerous, and more capable than common rabble, but still clearly mortal and limited\n\n"
            "avoid elite commander presence\n\n"
            "avoid overt supernatural grandeur"
        )
    if base_level <= 60:
        return (
            "Monster Tier Direction:\n\n"
            "mid-tier enemy\n\n"
            "should look battle-capable, organized, and genuinely threatening\n\n"
            "grounded martial danger is preferred over spectacle"
        )
    if base_level <= 80:
        return (
            "Monster Tier Direction:\n\n"
            "high-tier enemy\n\n"
            "may include restrained arcane elements, ritual marks, subtle glow lines, or controlled supernatural cues\n\n"
            "keep the design grounded and readable"
        )
    return (
        "Monster Tier Direction:\n\n"
        "top-tier enemy\n\n"
        "may approach mythic or legendary presence\n\n"
        "preserve grounded dark fantasy discipline and readable silhouette while allowing rare and elevated visual distinction"
    )


def build_item_record(
    source: dict[str, Any],
    row: dict[str, str],
    row_idx: int,
    config: dict[str, Any],
) -> ItemRecord | None:
    major = infer_major_category(source, row)

    sequence_raw = (row.get("sequence") or "").strip() or str(row_idx)
    try:
        sequence_int = int(sequence_raw)
    except ValueError:
        sequence_int = row_idx

    if major == "weapon":
        display_name = (row.get("weapon_name") or "").strip()
        item_type = (row.get("weapon_type") or "").strip()
    elif major == "character":
        display_name = (row.get("character_name") or "").strip()
        item_type = (row.get("main_stat") or "").strip()
    elif major == "monster":
        display_name = (row.get("monster_name") or "").strip()
        item_type = (row.get("main_stat") or "").strip()
    else:
        display_name = (row.get("item_name") or "").strip()
        item_type = (row.get("item_type") or "").strip()

    display_name_field = str(source.get("display_name_field") or "").strip()
    if display_name_field:
        display_name = (row.get(display_name_field) or "").strip()

    item_type_field = str(source.get("item_type_field") or "").strip()
    if item_type_field:
        item_type = (row.get(item_type_field) or "").strip()

    base_level_field = str(source.get("base_level_field") or "base_level").strip() or "base_level"
    base_level_raw = (row.get(base_level_field) or "0").strip()
    try:
        base_level_int = int(base_level_raw)
    except ValueError:
        base_level_int = 0

    if major == "character":
        prompt_desc = (row.get("prompt_character_avatar") or "").strip()
    else:
        prompt_desc = (row.get("prompt_item_description") or "").strip()
    prompt_field = str(source.get("prompt_field") or "").strip()
    if prompt_field:
        prompt_desc = (row.get(prompt_field) or "").strip()
    if not prompt_desc:
        return None

    output_name = display_name
    if major == "character":
        output_name = character_output_name(row, sequence_int)

    family_key = build_family_key(source, row, major)
    family_prompt = resolve_family_prompt(source, row, family_key, config)
    prompt_prefix_blocks = collect_prompt_prefix_blocks(source, row)
    if major == "monster":
        prompt_prefix_blocks.append(monster_level_direction(base_level_int))
    source_id = str(source["id"])
    item_id = f"{source_id}_{sequence_int:03d}_{slugify(display_name)}"

    return ItemRecord(
        item_id=item_id,
        source_id=source_id,
        source_group=str(source.get("group", "other")),
        csv_path=str(source["path"]),
        row_number=row_idx,
        major_category=major,
        family_key=family_key,
        display_name=display_name,
        output_name=output_name,
        item_type=item_type,
        base_level=base_level_int,
        level_band=level_band(base_level_int),
        family_prompt=family_prompt,
        prompt_prefix_blocks=prompt_prefix_blocks,
        prompt_item_description=prompt_desc,
        flavor_text=(row.get("flavor_text") or "").strip(),
    )


def compose_prompt(record: ItemRecord, config: dict[str, Any]) -> str:
    group_general_prompts = config.get("group_general_prompts", {})
    group_prompt = str(group_general_prompts.get(record.source_group, "")).strip()
    general_prompt = group_prompt or str(config.get("general_prompt", "")).strip()
    if record.major_category == "weapon":
        design_block = f"Weapon Design:\n\n{record.prompt_item_description.strip()}"
    elif record.major_category == "monster":
        design_block = f"Monster Design:\n\n{record.prompt_item_description.strip()}"
    else:
        design_block = record.prompt_item_description.strip()

    blocks = [general_prompt]
    if record.source_group == "characters":
        blocks.append(CHARACTER_SERIOUS_STYLE_GUARDRAILS)
        blocks.append(character_gaze_block(record.item_id))
    blocks.extend(record.prompt_prefix_blocks)
    blocks.extend([record.family_prompt, design_block])
    return "\n\n".join(block for block in blocks if block)


def compute_prompt_hash(model: str, size: str, background: str, quality: str, prompt: str, item_id: str) -> str:
    payload = {
        "model": model,
        "size": size,
        "background": background,
        "quality": quality,
        "prompt": prompt,
        "item_id": item_id,
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def call_openai_image(
    *,
    api_key: str,
    base_url: str,
    model: str,
    prompt: str,
    size: str,
    background: str,
    quality: str,
    ssl_context: ssl.SSLContext,
    max_attempts: int = 5,
    timeout_seconds: int = 180,
) -> bytes:
    endpoint = f"{base_url.rstrip('/')}/v1/images/generations"
    payload = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "background": background,
        "quality": quality,
        "output_format": "png",
        "n": 1,
    }

    raw_body = json.dumps(payload).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    for attempt in range(1, max_attempts + 1):
        req = request.Request(endpoint, data=raw_body, headers=headers, method="POST")
        try:
            with request.urlopen(req, timeout=timeout_seconds, context=ssl_context) as resp:
                response_body = resp.read().decode("utf-8")
            parsed = json.loads(response_body)
            data = parsed.get("data")
            if not isinstance(data, list) or not data:
                raise RuntimeError(f"OpenAI response missing image data: {response_body[:400]}")
            entry = data[0]
            if "b64_json" in entry and entry["b64_json"]:
                return base64.b64decode(entry["b64_json"])
            if "url" in entry and entry["url"]:
                with request.urlopen(entry["url"], timeout=timeout_seconds, context=ssl_context) as image_resp:
                    return image_resp.read()
            raise RuntimeError(f"OpenAI response missing b64_json/url: {response_body[:400]}")
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code in TRANSIENT_STATUS_CODES and attempt < max_attempts:
                time.sleep(2 ** (attempt - 1))
                continue
            raise RuntimeError(f"OpenAI HTTP {exc.code}: {body[:500]}") from exc
        except error.URLError as exc:
            if attempt < max_attempts:
                time.sleep(2 ** (attempt - 1))
                continue
            raise RuntimeError(f"OpenAI network error: {exc}") from exc

    raise RuntimeError("Image generation failed after retries.")


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def save_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def should_include_source(source_group: str, selected: str) -> bool:
    if selected == "all":
        return True
    return source_group == selected


def build_ssl_context(*, insecure: bool, ca_bundle: str | None) -> ssl.SSLContext:
    if insecure:
        return ssl._create_unverified_context()  # noqa: SLF001

    cafile = (ca_bundle or "").strip()
    if cafile:
        return ssl.create_default_context(cafile=cafile)

    # Try certifi first for Windows environments with missing Python cert store.
    try:
        import certifi  # type: ignore

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def resolve_render_settings(config: dict[str, Any], source_group: str) -> dict[str, str]:
    render_defaults = config.get("render_defaults", {})
    settings = {
        "model": str(render_defaults.get("model", "gpt-image-1")),
        "size": str(render_defaults.get("size", "1024x1024")),
        "background": str(render_defaults.get("background", "transparent")),
        "quality": str(render_defaults.get("quality", "low")),
    }

    group_overrides = config.get("group_render_overrides", {})
    if isinstance(group_overrides, dict):
        source_override = group_overrides.get(source_group)
        if isinstance(source_override, dict):
            for key in ("model", "size", "background", "quality"):
                value = source_override.get(key)
                if value is None:
                    continue
                value_text = str(value).strip()
                if value_text:
                    settings[key] = value_text

    return settings


def main() -> int:
    args = parse_args()
    load_dotenv(DEFAULT_ENV_PATH)
    weapon_type_filter = (args.weapon_type or "").strip().lower()
    armor_archetype_filter = (args.armor_archetype or "").strip().lower()
    monster_family_filter = (args.monster_family or "").strip().lower()

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = (REPO_ROOT / config_path).resolve()
    if not config_path.exists():
        print(f"Config file not found: {config_path}", file=sys.stderr)
        return 2

    config = load_config(config_path)

    sources = config.get("sources")
    if not isinstance(sources, list):
        print("Config error: 'sources' must be a list.", file=sys.stderr)
        return 2

    render_defaults = config.get("render_defaults", {})
    default_render_settings = {
        "model": str(render_defaults.get("model", "gpt-image-1")),
        "size": str(render_defaults.get("size", "1024x1024")),
        "background": str(render_defaults.get("background", "transparent")),
        "quality": str(render_defaults.get("quality", "low")),
    }
    base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com")
    api_key = os.environ.get("OPENAI_API_KEY", "")
    env_ca_bundle = os.environ.get("OPENAI_CA_BUNDLE", "").strip()
    cli_ca_bundle = (args.ca_bundle or "").strip()
    ca_bundle = cli_ca_bundle or env_ca_bundle or None
    ssl_context = build_ssl_context(insecure=args.insecure, ca_bundle=ca_bundle)

    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = (REPO_ROOT / output_dir).resolve()

    state = load_json(DEFAULT_STATE_PATH)
    state_items = state.get("items") if isinstance(state.get("items"), dict) else {}

    planned: list[tuple[ItemRecord, str, str, str, dict[str, str]]] = []
    lookup_cache: dict[tuple[str, str], dict[str, dict[str, str]]] = {}
    counts: dict[str, int] = {
        "total_rows": 0,
        "eligible_rows": 0,
        "skipped_missing_prompt": 0,
        "skipped_source_filter": 0,
        "skipped_weapon_type_filter": 0,
        "skipped_base_level_filter": 0,
        "skipped_armor_archetype_filter": 0,
        "skipped_monster_family_filter": 0,
        "skipped_family_prompt": 0,
        "skipped_unchanged": 0,
        "generated": 0,
        "regenerated": 0,
        "failed": 0,
    }

    for source in sources:
        if not isinstance(source, dict):
            continue
        if source.get("enabled") is False:
            counts["skipped_source_filter"] += 1
            continue
        source_group = str(source.get("group", "other"))
        if not should_include_source(source_group, args.sources):
            counts["skipped_source_filter"] += 1
            continue
        source_path_value = source.get("path")
        source_id = source.get("id")
        if not source_path_value or not source_id:
            print(f"Config source missing id/path: {source}", file=sys.stderr)
            return 2
        csv_path = Path(str(source_path_value))
        if not csv_path.is_absolute():
            csv_path = (REPO_ROOT / csv_path).resolve()
        if not csv_path.exists():
            print(f"CSV source not found: {csv_path}", file=sys.stderr)
            return 2

        rows = read_csv_rows(csv_path)
        for idx, row in enumerate(rows, start=1):
            counts["total_rows"] += 1
            row = {str(k): ("" if v is None else str(v)) for k, v in row.items()}
            row = merge_source_lookups(source=source, row=row, repo_root=REPO_ROOT, lookup_cache=lookup_cache)
            source_copy = dict(source)
            source_copy["path"] = str(csv_path)
            record = build_item_record(source_copy, row, idx, config)
            if record is None:
                counts["skipped_missing_prompt"] += 1
                continue

            if weapon_type_filter:
                if record.major_category != "weapon" or record.item_type.strip().lower() != weapon_type_filter:
                    counts["skipped_weapon_type_filter"] += 1
                    continue

            if args.base_level is not None and record.base_level != args.base_level:
                counts["skipped_base_level_filter"] += 1
                continue

            if armor_archetype_filter:
                family_parts = record.family_key.split(":")
                record_armor_archetype = family_parts[1].strip().lower() if len(family_parts) > 1 else ""
                if record.major_category != "armor" or record_armor_archetype != armor_archetype_filter:
                    counts["skipped_armor_archetype_filter"] += 1
                    continue

            if monster_family_filter:
                family_parts = record.family_key.split(":")
                record_monster_family = family_parts[1].strip().lower() if len(family_parts) > 1 else ""
                if record.major_category != "monster" or record_monster_family != monster_family_filter:
                    counts["skipped_monster_family_filter"] += 1
                    continue

            if not record.family_prompt:
                counts["skipped_family_prompt"] += 1
                continue

            final_prompt = compose_prompt(record, config)
            record_render_settings = resolve_render_settings(config, record.source_group)
            prompt_hash = compute_prompt_hash(
                record_render_settings["model"],
                record_render_settings["size"],
                record_render_settings["background"],
                record_render_settings["quality"],
                final_prompt,
                record.item_id,
            )
            # Avoid duplicated directories like armor/armor/... by dropping the family_key prefix.
            family_parts = record.family_key.split(":")
            if family_parts and family_parts[0] == record.major_category:
                family_parts = family_parts[1:]
            rel_parts = [record.major_category] + family_parts + [output_filename_for(record)]
            output_path = output_dir.joinpath(*rel_parts)

            counts["eligible_rows"] += 1
            planned.append((record, final_prompt, prompt_hash, str(output_path), record_render_settings))

    rng = random.Random(args.random_seed)

    if args.random_level_sample and planned:
        by_band: dict[str, list[tuple[ItemRecord, str, str, str, dict[str, str]]]] = {"low": [], "mid": [], "high": []}
        for item in planned:
            record = item[0]
            bucket = by_band.get(record.level_band)
            if bucket is not None:
                bucket.append(item)
            else:
                by_band["mid"].append(item)

        for entries in by_band.values():
            rng.shuffle(entries)

        if args.limit is not None and args.limit >= 0:
            target = args.limit
        else:
            target = len(planned)

        sampled: list[tuple[ItemRecord, str, str, str, dict[str, str]]] = []
        for band in ("low", "mid", "high"):
            if len(sampled) >= target:
                break
            if by_band[band]:
                sampled.append(by_band[band].pop())

        remaining: list[tuple[ItemRecord, str, str, str, dict[str, str]]] = by_band["low"] + by_band["mid"] + by_band["high"]
        rng.shuffle(remaining)
        if len(sampled) < target:
            sampled.extend(remaining[: target - len(sampled)])
        planned = sampled
    elif args.random_seed is not None:
        rng.shuffle(planned)

    if args.limit is not None and args.limit >= 0:
        planned = planned[: args.limit]

    if args.verbose or args.dry_run:
        print(f"Planned eligible items: {len(planned)}")

    if not args.dry_run and not api_key:
        print("OPENAI_API_KEY is required for non-dry runs.", file=sys.stderr)
        return 2

    run_items: list[dict[str, Any]] = []

    for record, final_prompt, prompt_hash, output_path_str, record_render_settings in planned:
        output_path = Path(output_path_str)
        prompt_output_path = output_path.with_suffix(".txt")
        previous = state_items.get(record.item_id, {}) if isinstance(state_items, dict) else {}
        previous_hash = previous.get("hash") if isinstance(previous, dict) else None
        file_exists = output_path.exists()

        action = "generate"
        if args.force:
            action = "regenerate" if file_exists else "generate"
        elif args.regenerate_changed and not args.only_missing:
            if file_exists and previous_hash == prompt_hash:
                action = "skip_unchanged"
            elif file_exists:
                action = "regenerate"
            else:
                action = "generate"
        else:
            # Default pipeline mode: only fill missing assets.
            action = "skip_unchanged" if file_exists else "generate"

        if action == "skip_unchanged":
            counts["skipped_unchanged"] += 1
            if not args.dry_run and file_exists and not prompt_output_path.exists():
                prompt_output_path.parent.mkdir(parents=True, exist_ok=True)
                prompt_output_path.write_text(final_prompt + "\n", encoding="utf-8")
            run_items.append(
                {
                    "item_id": record.item_id,
                    "status": "skipped_unchanged",
                    "output_path": str(output_path),
                    "prompt_path": str(prompt_output_path),
                    "family_key": record.family_key,
                }
            )
            if args.verbose:
                print(f"SKIP {record.item_id} -> {output_path}")
            continue

        if args.dry_run:
            run_items.append(
                {
                    "item_id": record.item_id,
                    "status": f"would_{action}",
                    "output_path": str(output_path),
                    "prompt_path": str(prompt_output_path),
                    "family_key": record.family_key,
                    "prompt_preview": final_prompt[:220],
                }
            )
            if args.verbose:
                print(f"DRYRUN {action.upper()} {record.item_id} -> {output_path}")
            continue

        try:
            model = record_render_settings["model"]
            size = record_render_settings["size"]
            background = record_render_settings["background"]
            quality = record_render_settings["quality"]
            image_bytes = call_openai_image(
                api_key=api_key,
                base_url=base_url,
                model=model,
                prompt=final_prompt,
                size=size,
                background=background,
                quality=quality,
                ssl_context=ssl_context,
            )
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(image_bytes)
            prompt_output_path.write_text(final_prompt + "\n", encoding="utf-8")

            if action == "generate":
                counts["generated"] += 1
            else:
                counts["regenerated"] += 1

            state_items[record.item_id] = {
                "hash": prompt_hash,
                "output_path": str(output_path),
                "family_key": record.family_key,
                "source_id": record.source_id,
                "updated_at": int(time.time()),
                "model": model,
                "size": size,
                "background": background,
                "quality": quality,
            }
            run_items.append(
                {
                    "item_id": record.item_id,
                    "status": action,
                    "output_path": str(output_path),
                    "prompt_path": str(prompt_output_path),
                    "family_key": record.family_key,
                }
            )
            if args.verbose:
                print(f"{action.upper()} {record.item_id} -> {output_path}")
        except Exception as exc:  # noqa: BLE001
            counts["failed"] += 1
            run_items.append(
                {
                    "item_id": record.item_id,
                    "status": "failed",
                    "error": str(exc),
                    "output_path": str(output_path),
                    "prompt_path": str(prompt_output_path),
                    "family_key": record.family_key,
                }
            )
            print(f"FAILED {record.item_id}: {exc}", file=sys.stderr)

    if not args.dry_run:
        save_json(DEFAULT_STATE_PATH, {"items": state_items})
        # Keep the app-side icon manifest in sync as assets are generated/regenerated.
        write_generated_item_manifest(output_dir, config_path)

    report = {
        "timestamp": int(time.time()),
        "config_path": str(config_path),
        "output_dir": str(output_dir),
        "sources_filter": args.sources,
        "weapon_type_filter": weapon_type_filter,
        "base_level_filter": args.base_level,
        "armor_archetype_filter": armor_archetype_filter,
        "monster_family_filter": monster_family_filter,
        "dry_run": args.dry_run,
        "force": args.force,
        "regenerate_changed": args.regenerate_changed,
        "only_missing": args.only_missing,
        "render": {
            "defaults": default_render_settings,
            "group_render_overrides": config.get("group_render_overrides", {}),
            "base_url": base_url,
            "tls_verify": not args.insecure,
            "ca_bundle": ca_bundle or "",
        },
        "sampling": {
            "random_level_sample": args.random_level_sample,
            "random_seed": args.random_seed,
        },
        "counts": counts,
        "items": run_items,
    }
    save_json(DEFAULT_REPORT_PATH, report)

    print(json.dumps({"counts": counts, "report_path": str(DEFAULT_REPORT_PATH)}, indent=2))
    return 1 if counts["failed"] > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
