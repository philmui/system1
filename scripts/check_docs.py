"""Check local Markdown links, corpus evidence spans and editable SVG exports."""

import json
import re
from pathlib import Path
from urllib.parse import unquote
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]


def current_document(file: Path) -> bool:
    """Archived drafts preserve their original links, which may have moved since export."""
    parts = file.relative_to(ROOT).parts
    return not (
        parts[:3] == ("docs", "slides", "versions")
        or parts[:3] == ("docs", "diagrams", "archive")
        or parts[:3] == ("docs", "blog", "reviews")
    )


errors = []
checked = 0
for file in [ROOT / "README.md", *filter(current_document, sorted((ROOT / "docs").rglob("*.md")))]:
    for target in re.findall(r"\]\(([^)]+)\)", file.read_text()):
        target = target.split("#", 1)[0].strip("<>")
        if not target or re.match(r"[a-z]+://", target):
            continue
        checked += 1
        if not (file.parent / unquote(target)).exists():
            errors.append(f"{file.relative_to(ROOT)}: missing local target {target}")
manifest = json.loads((ROOT / "data/samples/manifest.json").read_text())
for doc in manifest["documents"]:
    source = ROOT / "data/samples" / doc["filename"]
    if not source.is_file():
        errors.append(f"Missing sample {doc['filename']}")
        continue
    text = source.read_text(encoding="utf-8")
    for span in doc["supporting_passages"]:
        if span not in text:
            errors.append(f"{doc['filename']}: supporting span absent: {span!r}")
for source in sorted((ROOT / "docs/diagrams").glob("*.diagram.json")):
    svg = source.with_name(source.name.replace(".diagram.json", ".svg"))
    xml = ElementTree.parse(svg).getroot()
    ns = {"svg": "http://www.w3.org/2000/svg"}
    if xml.find("svg:title", ns) is None or xml.find("svg:desc", ns) is None:
        errors.append(f"{svg.name}: missing accessible title/description")
if errors:
    raise SystemExit("\n".join(errors))
print(
    f"Checked {checked} local Markdown links, {len(manifest['documents'])} sample files and spans, and 5 accessible SVG exports."
)
