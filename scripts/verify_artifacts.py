"""Check local documentation links, retained diagram accessibility and lockfile layout."""

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def current_document(file: Path) -> bool:
    """Historical drafts retain links as written before assets were reorganized."""
    parts = file.relative_to(ROOT).parts
    return not (
        parts[:3] == ("docs", "slides", "versions")
        or parts[:3] == ("docs", "diagrams", "archive")
        or parts[:3] == ("docs", "blog", "reviews")
    )


errors = []
for source in [ROOT / "README.md", *filter(current_document, (ROOT / "docs").rglob("*.md"))]:
    if not source.exists():
        continue
    for link in re.findall(r"\]\(([^)]+)\)", source.read_text()):
        target = link.split("#", 1)[0].split(' "', 1)[0]
        if not target or "://" in target or target.startswith(("mailto:", "#")):
            continue
        if not (source.parent / target).exists():
            errors.append(f"{source.relative_to(ROOT)}: missing relative target {target}")
ns = {"svg": "http://www.w3.org/2000/svg"}
for path in (ROOT / "docs" / "diagrams").glob("*.svg"):
    root = ET.parse(path).getroot()
    if root.find("svg:title", ns) is None or root.find("svg:desc", ns) is None:
        errors.append(f"{path.name}: missing accessible title or description")
if len(list((ROOT / "docs" / "diagrams").glob("*.svg"))) < 5:
    errors.append("Five SVG diagram exports are required")
if not (ROOT / "uv.lock").exists() or not (ROOT / "frontend/package-lock.json").exists():
    errors.append("Expected root Python and frontend npm lockfiles")
if errors:
    print("\n".join(errors))
    sys.exit(1)
print("Relative documentation links, accessible SVGs and dependency lockfile layout: passed")
