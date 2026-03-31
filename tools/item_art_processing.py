#!/usr/bin/env python3
"""Helpers for processed in-game item art variants."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


PROCESSED_SUFFIX = "_p"
PROCESSED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
SOURCE_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
PROCESSED_OUTPUT_CONFIG_BY_RULE: dict[str, dict[str, Any]] = {
    "weapon": {
        "target_size": (150, 150),
        "extension": ".png",
        "format": "PNG",
        "save_options": {
            "optimize": True,
            "compress_level": 9,
        },
    },
    "armor": {
        "target_size": (150, 150),
        "extension": ".png",
        "format": "PNG",
        "save_options": {
            "optimize": True,
            "compress_level": 9,
        },
    },
    "jewelry": {
        "target_size": (150, 150),
        "extension": ".png",
        "format": "PNG",
        "save_options": {
            "optimize": True,
            "compress_level": 9,
        },
    },
    "consumable": {
        "target_size": (150, 150),
        "extension": ".png",
        "format": "PNG",
        "save_options": {
            "optimize": True,
            "compress_level": 9,
        },
    },
    "monster": {
        "target_size": (300, 300),
        "extension": ".jpg",
        "format": "JPEG",
        "save_options": {
            "quality": 82,
            "optimize": True,
            "progressive": True,
            "subsampling": 2,
        },
    },
    "travel_stage": {
        "target_size": None,
        "extension": ".jpg",
        "format": "JPEG",
        "save_options": {
            "quality": 82,
            "optimize": True,
            "progressive": True,
            "subsampling": 2,
        },
    },
    "combat_stage": {
        "target_size": None,
        "extension": ".jpg",
        "format": "JPEG",
        "save_options": {
            "quality": 82,
            "optimize": True,
            "progressive": True,
            "subsampling": 2,
        },
    },
    "indoors": {
        "target_size": None,
        "extension": ".jpg",
        "format": "JPEG",
        "save_options": {
            "quality": 82,
            "optimize": True,
            "progressive": True,
            "subsampling": 2,
        },
    },
    "ui_currency": {
        "target_size": (128, 128),
        "extension": ".png",
        "format": "PNG",
        "save_options": {
            "optimize": True,
            "compress_level": 9,
        },
    },
    "ui_shop_offer": {
        "target_size": (192, 192),
        "extension": ".png",
        "format": "PNG",
        "save_options": {
            "optimize": True,
            "compress_level": 9,
        },
    },
    "portrait_avatar": {
        "target_size": (512, 768),
        "extension": ".png",
        "format": "PNG",
        "save_options": {
            "optimize": True,
            "compress_level": 9,
        },
    },
    "portrait_background": {
        "target_size": (768, 1152),
        "extension": ".jpg",
        "format": "JPEG",
        "save_options": {
            "quality": 82,
            "optimize": True,
            "progressive": True,
            "subsampling": 2,
        },
    },
}


@dataclass(frozen=True)
class ProcessedAssetPlan:
    source_path: Path
    output_path: Path
    rule_name: str
    target_size: tuple[int, int] | None
    output_format: str
    save_options: dict[str, Any]
    stale_output_paths: tuple[Path, ...]


def is_processed_asset_path(path: Path) -> bool:
    return path.suffix.lower() in PROCESSED_EXTENSIONS and path.stem.endswith(PROCESSED_SUFFIX)


def processed_variant_name(filename: str, extension: str) -> str:
    path = Path(filename)
    return f"{path.stem}{PROCESSED_SUFFIX}{extension}"


def processed_variant_path(source_path: Path, extension: str) -> Path:
    return source_path.with_name(processed_variant_name(source_path.name, extension))


def infer_major_category_from_relative_path(rel_path: Path) -> str | None:
    if not rel_path.parts:
        return None
    major_category = rel_path.parts[0].strip().lower()
    return major_category or None


def processing_rule_name_for_relative_path(rel_path: Path) -> str | None:
    parts = [part.strip().lower() for part in rel_path.parts]
    if not parts:
        return None

    if len(parts) >= 3 and parts[0] == "items" and parts[1] == "generated":
        parts = parts[2:]
        if not parts:
            return None

    if len(parts) >= 2 and parts[0] == "ui" and parts[1] == "currency":
        return "ui_currency"
    if len(parts) >= 2 and parts[0] == "ui" and parts[1] == "shop-offers":
        return "ui_shop_offer"
    if len(parts) >= 2 and parts[0] == "indoors":
        return "indoors"
    if len(parts) >= 2 and parts[0] == "portraits" and parts[1] == "backgrounds":
        return "portrait_background"
    if len(parts) >= 2 and parts[0] == "portraits":
        return "portrait_avatar"

    major_category = parts[0]
    if major_category in PROCESSED_OUTPUT_CONFIG_BY_RULE:
        return major_category
    return None


def target_size_for_relative_path(rel_path: Path) -> tuple[int, int] | None:
    rule_name = processing_rule_name_for_relative_path(rel_path)
    if not rule_name:
        return None
    config = PROCESSED_OUTPUT_CONFIG_BY_RULE.get(rule_name)
    if not config:
        return None
    target_size = config.get("target_size")
    if target_size is None:
        return None
    return tuple(target_size)


def build_processed_asset_plan(asset_root: Path, source_path: Path) -> ProcessedAssetPlan | None:
    if source_path.suffix.lower() not in SOURCE_IMAGE_EXTENSIONS or is_processed_asset_path(source_path):
        return None

    try:
        rel_path = source_path.relative_to(asset_root)
    except ValueError:
        return None

    rule_name = processing_rule_name_for_relative_path(rel_path)
    if not rule_name:
        return None

    config = PROCESSED_OUTPUT_CONFIG_BY_RULE.get(rule_name)
    if not config:
        return None
    output_extension = str(config["extension"])
    output_path = processed_variant_path(source_path, output_extension)
    stale_output_paths = tuple(
        candidate
        for candidate in (
            processed_variant_path(source_path, ".png"),
            processed_variant_path(source_path, ".jpg"),
            processed_variant_path(source_path, ".jpeg"),
        )
        if candidate != output_path
    )

    return ProcessedAssetPlan(
        source_path=source_path,
        output_path=output_path,
        rule_name=rule_name,
        target_size=tuple(config["target_size"]) if config.get("target_size") is not None else None,
        output_format=str(config["format"]),
        save_options=dict(config["save_options"]),
        stale_output_paths=stale_output_paths,
    )


def cleanup_stale_processed_assets(plan: ProcessedAssetPlan) -> None:
    for stale_path in plan.stale_output_paths:
        if stale_path.exists():
            stale_path.unlink()


def process_asset_plan(plan: ProcessedAssetPlan) -> None:
    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError(
            "Pillow is required to build processed item art variants. Install it with `python -m pip install Pillow`."
        ) from exc

    plan.output_path.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(plan.source_path) as image:
        has_alpha = image.mode in {"RGBA", "LA"} or "transparency" in image.info
        if plan.output_format == "JPEG":
            if has_alpha:
                background = Image.new("RGB", image.size, (0, 0, 0))
                background.paste(image.convert("RGBA"), mask=image.convert("RGBA").getchannel("A"))
                working = background
            else:
                working = image.convert("RGB")
        else:
            working = image.convert("RGBA" if has_alpha else "RGB")
        if plan.target_size is None:
            output_image = working
        else:
            output_image = working.resize(plan.target_size, Image.Resampling.LANCZOS)
        output_image.save(plan.output_path, format=plan.output_format, **plan.save_options)

    cleanup_stale_processed_assets(plan)
