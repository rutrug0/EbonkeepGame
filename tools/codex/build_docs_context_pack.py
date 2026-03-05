#!/usr/bin/env python3
"""Build a dynamic markdown context pack for Codex startup.

Discovery policy:
- Include all markdown files under docs/**/*.md
- Include root README.md when present
- Keep ordering deterministic by relative path

Output:
- .codex/cache/docs_context_pack.md
"""

from __future__ import annotations

import argparse
import hashlib
import re
from collections import OrderedDict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_PATH = REPO_ROOT / ".codex" / "cache" / "docs_context_pack.md"
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*$")


@dataclass
class Heading:
    level: int
    title: str
    line_number: int


@dataclass
class DocSummary:
    path: Path
    title: str
    sha256: str
    modified_utc: str
    headings: list[Heading]
    snippets_by_heading: OrderedDict[str, list[str]]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Codex docs context pack.")
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT_PATH),
        help="Output markdown file path.",
    )
    parser.add_argument(
        "--max-snippet-chars",
        type=int,
        default=280,
        help="Maximum characters per snippet.",
    )
    parser.add_argument(
        "--max-snippets-per-heading",
        type=int,
        default=2,
        help="Maximum snippets captured per heading section.",
    )
    return parser.parse_args()


def normalize_text(value: str) -> str:
    compact = " ".join(value.strip().split())
    return compact


def shorten(value: str, max_chars: int) -> str:
    if len(value) <= max_chars:
        return value
    if max_chars <= 3:
        return value[:max_chars]
    return value[: max_chars - 3].rstrip() + "..."


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def discover_markdown_files(repo_root: Path) -> list[Path]:
    docs_root = repo_root / "docs"
    discovered: set[Path] = set()

    if docs_root.exists():
        for path in docs_root.rglob("*.md"):
            if path.is_file():
                discovered.add(path.resolve())

    readme_path = repo_root / "README.md"
    if readme_path.exists():
        discovered.add(readme_path.resolve())

    return sorted(discovered, key=lambda path: path.relative_to(repo_root).as_posix().lower())


def parse_doc(path: Path, max_chars: int, max_snippets_per_heading: int) -> DocSummary:
    raw = path.read_text(encoding="utf-8", errors="replace")
    lines = raw.splitlines()

    headings: list[Heading] = []
    snippets_by_heading: OrderedDict[str, list[str]] = OrderedDict()
    current_heading = "Document Lead"
    snippets_by_heading[current_heading] = []

    paragraph_buffer: list[str] = []
    in_code_block = False

    def flush_paragraph() -> None:
        if not paragraph_buffer:
            return
        paragraph = normalize_text(" ".join(paragraph_buffer))
        paragraph_buffer.clear()
        if not paragraph:
            return

        heading_snippets = snippets_by_heading.setdefault(current_heading, [])
        if len(heading_snippets) >= max_snippets_per_heading:
            return
        heading_snippets.append(shorten(paragraph, max_chars))

    for line_number, line in enumerate(lines, start=1):
        stripped = line.strip()

        if stripped.startswith("```"):
            flush_paragraph()
            in_code_block = not in_code_block
            continue

        if in_code_block:
            continue

        heading_match = HEADING_RE.match(line)
        if heading_match:
            flush_paragraph()
            level = len(heading_match.group(1))
            heading_title = normalize_text(heading_match.group(2))
            if not heading_title:
                continue
            headings.append(Heading(level=level, title=heading_title, line_number=line_number))
            current_heading = heading_title
            snippets_by_heading.setdefault(current_heading, [])
            continue

        if not stripped:
            flush_paragraph()
            continue

        paragraph_buffer.append(stripped)

    flush_paragraph()

    title = next((heading.title for heading in headings if heading.level == 1), path.stem)
    modified = datetime.fromtimestamp(path.stat().st_mtime, tz=UTC).replace(microsecond=0).isoformat()

    return DocSummary(
        path=path,
        title=title,
        sha256=sha256_text(raw),
        modified_utc=modified,
        headings=headings,
        snippets_by_heading=snippets_by_heading,
    )


def render_pack(repo_root: Path, summaries: list[DocSummary]) -> str:
    now = datetime.now(tz=UTC).replace(microsecond=0).isoformat()
    output: list[str] = []
    output.append("# Ebonkeep Docs Context Pack")
    output.append("")
    output.append(f"- Generated (UTC): `{now}`")
    output.append(f"- Repository Root: `{repo_root}`")
    output.append(f"- Discovered Markdown Files: `{len(summaries)}`")
    output.append("- Discovery Policy: `docs/**/*.md` + `README.md` (dynamic, non-hardcoded)")
    output.append("")
    output.append("This file is intended for Codex startup awareness.")
    output.append("Load full source markdown files for task-specific detail after reading this pack.")
    output.append("")

    for summary in summaries:
        relative_path = summary.path.relative_to(repo_root).as_posix()
        output.append("---")
        output.append("")
        output.append(f"## `{relative_path}`")
        output.append(f"- Title: `{summary.title}`")
        output.append(f"- SHA256: `{summary.sha256}`")
        output.append(f"- Last Modified (UTC): `{summary.modified_utc}`")
        output.append("")
        output.append("### Heading Tree")
        if summary.headings:
            for heading in summary.headings:
                output.append(
                    f"- `H{heading.level}` line `{heading.line_number}`: {heading.title}"
                )
        else:
            output.append("- (No markdown headings found)")
        output.append("")
        output.append("### Key Snippets")
        emitted = False
        for heading_title, snippets in summary.snippets_by_heading.items():
            for snippet in snippets:
                output.append(f"- `{heading_title}`: {snippet}")
                emitted = True
        if not emitted:
            output.append("- (No paragraph snippets captured)")
        output.append("")

    return "\n".join(output).rstrip() + "\n"


def main() -> int:
    args = parse_args()
    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = (REPO_ROOT / output_path).resolve()

    markdown_files = discover_markdown_files(REPO_ROOT)
    summaries = [
        parse_doc(path, max_chars=args.max_snippet_chars, max_snippets_per_heading=args.max_snippets_per_heading)
        for path in markdown_files
    ]
    pack = render_pack(REPO_ROOT, summaries)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(pack, encoding="utf-8")

    print(f"Wrote context pack: {output_path}")
    print(f"Discovered markdown files: {len(markdown_files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

