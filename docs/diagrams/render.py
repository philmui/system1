"""Render editable *.diagram.json layouts as standalone, accessible SVGs.

Run: uv run python docs/diagrams/render.py
Only Python's standard library is needed. Coordinates are explicit so diagrams
remain stable and can be edited without a browser or diagram service.
"""

import json
from html import escape
from pathlib import Path

HERE = Path(__file__).parent
PALETTE = {
    "blue": ("#edf4ff", "#2563a0"),
    "teal": ("#e9f7f1", "#20725c"),
    "amber": ("#fff4db", "#906419"),
    "purple": ("#f4efff", "#76539a"),
    "gray": ("#f2f4f7", "#5d6878"),
    "red": ("#fff0ef", "#aa4a46"),
}


def render(path: Path) -> None:
    spec = json.loads(path.read_text())
    w, h = spec["size"]
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc">',
        f'<title id="title">{escape(spec["title"])}</title>',
        f'<desc id="desc">{escape(spec["description"])}</desc>',
        '<defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 Z" fill="#617082"/></marker></defs>',
        '<style>text {font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;fill:#213047} .title {font-size:26px;font-weight:650} .subtitle {font-size:15px;fill:#5d6878} .label {font-size:15px;font-weight:600} .body {font-size:13px;fill:#46546a} .edge-label {font-size:12px;fill:#4b596d} .lane {font-size:14px;font-weight:600}</style>',
        f'<rect width="{w}" height="{h}" rx="16" fill="#fff"/>',
        f'<text class="title" x="32" y="42">{escape(spec["title"])}</text>',
        f'<text class="subtitle" x="32" y="68">{escape(spec["subtitle"])}</text>',
    ]
    for group in spec.get("groups", []):
        x, y, gw, gh = group["rect"]
        out.extend(
            [
                f'<rect x="{x}" y="{y}" width="{gw}" height="{gh}" rx="16" fill="#fafbfd" stroke="#d3dbe6" stroke-dasharray="6 5"/>',
                f'<text class="lane" x="{x + 18}" y="{y + 25}">{escape(group["label"])}</text>',
            ]
        )
    for line in spec.get("lifelines", []):
        x, y1, y2 = line
        out.append(
            f'<path d="M{x},{y1} V{y2}" fill="none" stroke="#cad3df" stroke-width="2" stroke-dasharray="5 5"/>'
        )
    for edge in spec["edges"]:
        points = " ".join(f"{x},{y}" for x, y in edge["points"])
        dash = ' stroke-dasharray="5 5"' if edge.get("dashed") else ""
        out.append(
            f'<polyline points="{points}" fill="none" stroke="#617082" stroke-width="1.8" stroke-linejoin="round" marker-end="url(#arrow)"{dash}/>'
        )
        if edge.get("label"):
            x, y = edge["label_at"]
            label = edge["label"]
            width = len(label) * 6.5 + 12
            out.extend(
                [
                    f'<rect x="{x - width / 2}" y="{y - 13}" width="{width}" height="18" rx="4" fill="#fff"/>',
                    f'<text class="edge-label" text-anchor="middle" x="{x}" y="{y}">{escape(label)}</text>',
                ]
            )
    for node in spec["nodes"]:
        x, y, nw, nh = node["rect"]
        bg, fg = PALETTE[node.get("color", "gray")]
        out.extend(
            [
                f'<rect x="{x}" y="{y}" width="{nw}" height="{nh}" rx="11" fill="{bg}" stroke="{fg}" stroke-width="1.4"/>',
                f'<text class="label" text-anchor="middle" x="{x + nw / 2}" y="{y + 28}">{escape(node["label"])}</text>',
            ]
        )
        for i, line in enumerate(node.get("body", [])):
            out.append(
                f'<text class="body" text-anchor="middle" x="{x + nw / 2}" y="{y + 50 + i * 19}">{escape(line)}</text>'
            )
    for note in spec.get("notes", []):
        x, y = note["at"]
        for i, line in enumerate(note["lines"]):
            out.append(f'<text class="body" x="{x}" y="{y + i * 21}">{escape(line)}</text>')
    out.append("</svg>")
    path.with_name(path.name.replace(".diagram.json", ".svg")).write_text("\n".join(out) + "\n")


if __name__ == "__main__":
    for source in sorted(HERE.glob("*.diagram.json")):
        render(source)
        print(source.name.replace(".diagram.json", ".svg"))
