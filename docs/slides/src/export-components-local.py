#!/usr/bin/env python3
"""Export movable SVG components without a browser.

Usage:
    python3 export-components-local.py INPUT.html OUTPUT/components \
        assets/components-v5 --fontconfig /tmp/system1-fonts.conf

The HTML is the source of the five SVG compositions. Named component groups
stay together; unnamed groups are traversed so labels and routes can move
independently. Librsvg supplies actual ink bounds and PDF outlines. Blank
slide frames are produced separately by the full-deck renderer.
"""
from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

from PIL import Image

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", XLINK_NS)
CANVAS = (1744, 620)
FIGURE = (88, 292, 1744, 620)
STAGE = (1920, 1080)
PAD = 12
METHOD_VERSION = "librsvg-components-v1"
KINDS = {"illustration", "label", "connector", "background", "decoration", "badge"}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def local(tag):
    return tag.rsplit("}", 1)[-1]


class Compositions(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.section_stack = []
        self.slide_count = 0
        self.items = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "section":
            if "slide" in a.get("class", "").split() and a.get("data-slide-id"):
                self.slide_count += 1
                self.section_stack.append({"index": self.slide_count, "id": a["data-slide-id"]})
            else:
                self.section_stack.append(None)
        if tag == "img" and a.get("data-component-asset"):
            slide = next((v for v in reversed(self.section_stack) if v), None)
            if not slide:
                raise ValueError("Component image is outside a numbered slide")
            src = a.get("src", "")
            if not src.startswith("data:image/svg+xml;base64,"):
                raise ValueError("Component images must be embedded base64 SVGs")
            svg = base64.b64decode(src.split(",", 1)[1], validate=True).decode("utf-8")
            self.items.append({**slide, "asset": a["data-component-asset"], "svg": svg})

    def handle_endtag(self, tag):
        if tag == "section" and self.section_stack:
            self.section_stack.pop()


def object_sources(svg):
    root = ET.fromstring(svg)
    view = [float(v) for v in root.get("viewBox", "").split()]
    if view != [0, 0, *CANVAS]:
        raise ValueError(f"Expected a 1744 × 620 figure, got {view}")
    definitions = [copy.deepcopy(e) for e in root if local(e.tag) == "defs"]
    selected = []

    def visit(parent, ancestors):
        for el in parent:
            if local(el.tag) in {"defs", "title", "desc"}:
                continue
            if el.get("data-component"):
                selected.append((el, ancestors))
            elif local(el.tag) == "g":
                visit(el, ancestors + [el])
            else:
                selected.append((el, ancestors))

    visit(root, [])
    results = []
    for i, (el, ancestors) in enumerate(selected):
        tag = local(el.tag)
        kind = el.get("data-kind") or ("label" if tag == "text" else "connector" if tag == "path"
                                       else "background" if i == 0 else "decoration")
        if kind not in KINDS:
            raise ValueError(f"Unsupported component kind {kind}")
        label = el.get("data-component") or ("".join(el.itertext()).strip() if tag == "text"
                                            else f"{kind}-{i + 1}")
        slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-") or f"object-{i + 1}"
        current = copy.deepcopy(el)
        for ancestor in reversed(ancestors):
            wrapper = ET.Element(ancestor.tag, dict(ancestor.attrib))
            wrapper.append(current)
            current = wrapper
        isolated = ET.Element("{" + SVG_NS + "}svg", {
            "width": str(CANVAS[0]), "height": str(CANVAS[1]), "viewBox": "0 0 1744 620",
        })
        for definition in definitions:
            isolated.append(copy.deepcopy(definition))
        isolated.append(current)
        results.append({"label": label, "kind": kind, "key": el.get("data-component"),
                        "slug": slug, "outer": ET.tostring(isolated, encoding="unicode")})
    return results


def assert_outlined(svg, label):
    root = ET.fromstring(svg)
    forbidden = {"text", "tspan", "textPath", "foreignObject", "image", "font", "script", "iframe"}
    if any(local(e.tag) in forbidden for e in root.iter()):
        raise ValueError(f"{label}: output is not entirely outlined vector artwork")
    if re.search(r"@font-face|font-family\s*[:=]|data:font/", svg, re.I):
        raise ValueError(f"{label}: font dependency retained")
    ids = [e.get("id") for e in root.iter() if e.get("id")]
    if len(ids) != len(set(ids)):
        raise ValueError(f"{label}: duplicate SVG id")
    for el in root.iter():
        for key, value in el.attrib.items():
            if local(key) == "href" and (not value.startswith("#") or value[1:] not in ids):
                raise ValueError(f"{label}: nonlocal or unresolved SVG reference")
            if local(key).lower().startswith("on"):
                raise ValueError(f"{label}: active SVG attribute")
    return root


def run(args, env):
    return subprocess.run(args, env=env, check=True, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE).stdout


def render_object(entry, output, scratch, env, cache_entry, signature):
    raw, stem = entry["raw"], entry["stem"]
    svg_path = output / "objects" / (stem + ".svg")
    png_path = output / "objects" / (stem + ".png")
    if cache_entry and cache_entry.get("signature") == signature and svg_path.is_file() and png_path.is_file():
        if (sha(svg_path.read_bytes()) == cache_entry.get("svgSha256") and
                sha(png_path.read_bytes()) == cache_entry.get("pngSha256")):
            return entry, cache_entry, True

    source = scratch / (stem + ".source.svg")
    full_png = scratch / (stem + ".ink.png")
    full_pdf = scratch / (stem + ".pdf")
    outlined = scratch / (stem + ".outlined.svg")
    source.write_text(raw["outer"], encoding="utf-8")
    run(["rsvg-convert", "-w", "1744", "-h", "620", "-o", str(full_png), str(source)], env)
    with Image.open(full_png) as picture:
        if picture.size != CANVAS:
            raise ValueError(f"{stem}: wrong raster dimensions {picture.size}")
        ink = picture.convert("RGBA").getchannel("A").getbbox()
    if ink is None:
        raise ValueError(f"{stem}: component has no visible ink")
    x, y = max(0, ink[0] - PAD), max(0, ink[1] - PAD)
    right, bottom = min(CANVAS[0], ink[2] + PAD), min(CANVAS[1], ink[3] + PAD)
    box = {"x": x, "y": y, "w": right - x, "h": bottom - y}

    run(["rsvg-convert", "--format", "pdf", "-o", str(full_pdf), str(source)], env)
    run(["pdftocairo", "-svg", str(full_pdf), str(outlined)], env)
    portable = assert_outlined(outlined.read_text(), stem)
    view = [float(v) for v in portable.get("viewBox", "").split()]
    if len(view) != 4 or view[:2] != [0, 0]:
        raise ValueError(f"{stem}: unexpected PDF coordinate system {view}")
    sx, sy = view[2] / CANVAS[0], view[3] / CANVAS[1]
    if abs(sx - 0.75) > 1e-6 or abs(sy - 0.75) > 1e-6:
        raise ValueError(f"{stem}: PDF points do not match the expected 96dpi SVG scale")
    portable.set("width", f'{box["w"]}px')
    portable.set("height", f'{box["h"]}px')
    portable.set("viewBox", f'{x * sx:g} {y * sy:g} {box["w"] * sx:g} {box["h"] * sy:g}')
    svg_path.write_text(ET.tostring(portable, encoding="unicode") + "\n", encoding="utf-8")
    run(["rsvg-convert", "-w", str(box["w"] * 2), "-h", str(box["h"] * 2),
         "-o", str(png_path), str(svg_path)], env)
    with Image.open(png_path) as picture:
        if picture.size != (box["w"] * 2, box["h"] * 2):
            raise ValueError(f"{stem}: wrong compatibility PNG dimensions")
    return entry, {"signature": signature, "box": box, "ink": list(ink),
                   "svgSha256": sha(svg_path.read_bytes()), "pngSha256": sha(png_path.read_bytes())}, False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("assets", type=Path)
    parser.add_argument("--fontconfig", type=Path, required=True)
    parser.add_argument("--jobs", type=int, default=4)
    args = parser.parse_args()
    source, output, assets = (p.resolve() for p in (args.input, args.output, args.assets))
    if assets == source.parent / "assets" / "components":
        raise SystemExit("Use the new components-v5 folder; preserve the earlier component library")
    if any(re.match(r"0[1-4]-", part) for part in output.parts):
        raise SystemExit("Use a new version05 export folder; earlier editions are preserved")
    if not 1 <= args.jobs <= 8:
        raise SystemExit("--jobs must be between 1 and 8")
    for folder in [output, output / "objects", output / "frames", assets]:
        folder.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    env["FONTCONFIG_FILE"] = str(args.fontconfig.resolve())
    fontconfig_hash = sha(args.fontconfig.read_bytes())
    input_bytes = source.read_bytes()
    html = input_bytes.decode("utf-8")
    parsed = Compositions()
    parsed.feed(html)
    if len(parsed.items) != 5:
        raise SystemExit(f"Expected five component compositions, found {len(parsed.items)}")
    if len({c["index"] for c in parsed.items}) != len(parsed.items):
        raise SystemExit("Each selected slide must contain one component composition")
    cache_path = output / "local-component-cache.json"
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    pending = []
    for c in parsed.items:
        c["objects"] = []
        c["sourceSha256"] = sha(c["svg"].encode())
        raw_objects = object_sources(c["svg"])
        for i, raw in enumerate(raw_objects):
            pending.append({"composition": c, "index": i, "raw": raw,
                            "stem": f'{c["id"]}-{i + 1:02d}-{raw["slug"]}'})
        print(f'{c["id"]}: {len(raw_objects)} separately movable vector objects', flush=True)
    results, new_cache, reused = {}, {}, 0
    with tempfile.TemporaryDirectory(prefix="system1-component-outlines-") as temporary:
        scratch = Path(temporary)
        with ThreadPoolExecutor(max_workers=args.jobs) as executor:
            futures = []
            for entry in pending:
                signature = sha((METHOD_VERSION + fontconfig_hash + entry["raw"]["outer"]).encode())
                futures.append(executor.submit(render_object, entry, output, scratch, env,
                                               cache.get(entry["stem"]), signature))
            for n, future in enumerate(as_completed(futures), 1):
                entry, audit, was_reused = future.result()
                results[entry["stem"]] = audit
                new_cache[entry["stem"]] = audit
                reused += int(was_reused)
                if n % 25 == 0 or n == len(pending):
                    print(f'Outlined {n}/{len(pending)} objects ({reused} reused)', flush=True)

    library, published = [], set()
    for entry in pending:
        c, raw, stem = entry["composition"], entry["raw"], entry["stem"]
        audit, b = results[stem], results[stem]["box"]
        object_record = {"name": f'{c["id"]} / {raw["label"]} / {entry["index"] + 1}',
                         "kind": raw["kind"], "svg": f"objects/{stem}.svg", "png": f"objects/{stem}.png",
                         "x": FIGURE[0] + b["x"], "y": FIGURE[1] + b["y"], "w": b["w"], "h": b["h"]}
        c["objects"].append(object_record)
        if raw["key"] and raw["kind"] in {"illustration", "badge"} and raw["key"] not in published:
            published.add(raw["key"])
            name = re.sub(r"[^A-Za-z0-9._-]+", "-", raw["key"])
            editable = ET.fromstring(raw["outer"])
            editable.set("width", str(b["w"]))
            editable.set("height", str(b["h"]))
            editable.set("viewBox", f'{b["x"]} {b["y"]} {b["w"]} {b["h"]}')
            if not any(local(e.tag) == "text" for e in editable.iter()):
                for definition in editable:
                    if local(definition.tag) == "defs":
                        for child in list(definition):
                            if local(child.tag) == "style":
                                definition.remove(child)
            (assets / (name + ".svg")).write_text(ET.tostring(editable, encoding="unicode") + "\n")
            shutil.copyfile(output / object_record["svg"], assets / (name + ".outlined.svg"))
            shutil.copyfile(output / object_record["png"], assets / (name + ".png"))
            library.append({"name": name, "source": name + ".svg", "portable": name + ".outlined.svg",
                            "preview": name + ".png"})

    slides = [{"index": c["index"], "id": c["id"],
               "frame": {"svg": f'frames/slide-{c["index"]:02d}.svg', "png": f'frames/slide-{c["index"]:02d}.png'},
               "objects": c["objects"], "expectedFullPNG": f'../page-{c["index"]:02d}.png',
               "sourceAsset": c["asset"], "sourceSVGHash": c["sourceSha256"]} for c in parsed.items]
    manifest = {"inputHTML": source.name, "inputHTMLSha256": sha(input_bytes), "stage": list(STAGE),
                "method": "Librsvg ink bounds with 12px padding; individual PDF outlines cropped to native SVG/PNG pairs. Blank frames supplied separately. No browser or raster artwork inside component SVGs.",
                "fontconfigSha256": fontconfig_hash, "slides": slides, "errors": [], "blockedRemoteRequests": []}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    cache_path.write_text(json.dumps(new_cache, indent=2) + "\n")
    (assets / "manifest.json").write_text(json.dumps(library, indent=2) + "\n")
    numbers = ", ".join(f'{c["index"]:02d}' for c in parsed.items)
    rows = "\n".join(f'| {o["name"]} | [SVG]({o["source"]}) | [Outlined]({o["portable"]}) | [PNG]({o["preview"]}) |' for o in library)
    (assets / "README.md").write_text(f'''# Reusable branching return illustrations

Version 05 contains these original vector objects on slides {numbers}. In PowerPoint, use the Selection Pane to select, copy, move or resize a named object. Labels and connectors are independent objects; calendars and shipping tickets keep their printed values together. Connectors do not automatically follow moved illustrations.

Source SVGs retain editable geometry and any source text. Portable SVGs outline all text and need no installed fonts. PNGs are transparent compatibility previews rendered at twice the object dimensions. Speaker notes remain editable text. The five complete compositions remain available in docs/diagrams.

This library was exported locally with librsvg and Poppler. It is not a native Office rendering check. The original source compositions and previous libraries are preserved.

| Component | Source SVG | Portable SVG | Preview |
|---|---|---|---|
{rows}
''')
    report = {"method": METHOD_VERSION, "inputHTML": source.name, "inputHTMLSha256": manifest["inputHTMLSha256"],
              "componentSlideCount": len(slides), "movableObjectCount": len(pending), "libraryCount": len(library),
              "reusedObjectCount": reused, "paddingPx": PAD, "pngScale": 2, "figurePlacement": list(FIGURE),
              "framesPresent": all((output / f).is_file() for s in slides for f in s["frame"].values()),
              "allComponentsOutlined": True, "inputChangedDuringExport": source.read_bytes() != input_bytes,
              "sourceSVGHashes": {c["asset"]: c["sourceSha256"] for c in parsed.items}}
    (output / "local-component-export-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f'Exported {len(pending)} objects and {len(library)} reusable assets to {output}', flush=True)


if __name__ == "__main__":
    main()
