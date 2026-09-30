#!/usr/bin/env python3
"""Compare movable SVG reconstruction to complete figures and optional pages.

Usage: python3 verify-components-local.py MANIFEST.json INPUT.html \
    --fontconfig /tmp/system1-fonts.conf

Each object is rendered from its outlined SVG, placed from the manifest and
compared to a direct render of the complete source SVG. When complete page
PNGs are present, the blank frame plus objects is also compared to those
independent full-page renders. This is not a native Office rendering check.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess

from PIL import Image, ImageChops


def render(path, width, height, env):
    result = subprocess.run(["rsvg-convert", "-w", str(width), "-h", str(height), str(path)],
                            env=env, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return Image.open(io.BytesIO(result.stdout)).convert("RGBA")


def compare(actual, expected):
    if actual.size != expected.size:
        raise ValueError(f"Different proof dimensions: {actual.size} and {expected.size}")
    difference = ImageChops.difference(actual.convert("RGB"), expected.convert("RGB"))
    pixels = actual.width * actual.height
    mean = sum((i % 256) * count for i, count in enumerate(difference.histogram())) / (pixels * 3)
    channels = difference.split()
    # Saturation above255 does not affect the test for RGB-channel sum >90.
    summed = ImageChops.add(ImageChops.add(channels[0], channels[1]), channels[2])
    fraction = sum(summed.histogram()[91:]) / pixels
    return {"meanAbsoluteChannelDifference": mean, "pixelsOver30Fraction": fraction,
            "passed": mean < 2 and fraction < .02}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("input", type=Path)
    parser.add_argument("--fontconfig", type=Path, required=True)
    args = parser.parse_args()
    manifest_path = args.manifest.resolve()
    directory = manifest_path.parent
    manifest = json.loads(manifest_path.read_text())
    input_hash = hashlib.sha256(args.input.read_bytes()).hexdigest()
    if manifest.get('inputHTMLSha256') != input_hash:
        raise ValueError('Component manifest belongs to a different HTML source.')
    proof_inputs = {}
    def record(file):
        file=Path(file).resolve()
        proof_inputs[os.path.relpath(file,directory)]=hashlib.sha256(file.read_bytes()).hexdigest()
    record(manifest_path);record(args.input)
    spec = importlib.util.spec_from_file_location("local_component_export", Path(__file__).with_name("export-components-local.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    parsed = module.Compositions()
    parsed.feed(args.input.read_text())
    compositions = {c["id"]: c for c in parsed.items}
    env = dict(os.environ)
    env["FONTCONFIG_FILE"] = str(args.fontconfig.resolve())
    body_results, page_results = [], []
    for slide in manifest["slides"]:
        c = compositions[slide["id"]]
        if hashlib.sha256(c["svg"].encode()).hexdigest() != slide["sourceSVGHash"]:
            raise ValueError(f'{slide["id"]}: source composition changed after component export')
        source = directory / f'figure-source-{slide["index"]:02d}.svg'
        source.write_text(c["svg"])
        expected = render(source, 1744, 620, env)
        actual = Image.new("RGBA", (1744, 620), (0, 0, 0, 0))
        page = Image.open(directory / slide["frame"]["png"]).convert("RGBA")
        record(directory / slide['frame']['svg']);record(directory / slide['frame']['png'])
        if page.size != (1920, 1080):
            raise ValueError(f'{slide["id"]}: frame must be1920 ×1080')
        for obj in slide["objects"]:
            values = [obj[k] for k in ["x", "y", "w", "h"]]
            if any(abs(round(v) - v) > 1e-6 for v in values):
                raise ValueError("This native-pixel reconstruction requires integer object transforms")
            x, y, w, h = map(round, values)
            layer = render(directory / obj["svg"], w, h, env)
            record(directory / obj['svg']);record(directory / obj['png'])
            actual.alpha_composite(layer, (x - 88, y - 292))
            page.alpha_composite(layer, (x, y))
        actual.save(directory / f'figure-reconstructed-{slide["index"]:02d}.png')
        expected.save(directory / f'figure-expected-{slide["index"]:02d}.png')
        page.save(directory / f'reconstructed-{slide["index"]:02d}.png')
        result = {"slide": slide["index"], "id": slide["id"], "objectCount": len(slide["objects"]),
                  **compare(actual, expected)}
        body_results.append(result)
        print(f'{slide["id"]}: figure mean error {result["meanAbsoluteChannelDifference"]:.4f}/255', flush=True)
        full_page = directory / slide["expectedFullPNG"]
        if full_page.exists():
            record(full_page)
            page_results.append({"slide": slide["index"], "id": slide["id"], "objectCount": len(slide["objects"]),
                                 **compare(page, Image.open(full_page).convert("RGBA"))})
    report = {"method": "Independent librsvg renders of outlined SVG objects reconstructed from manifest coordinates and compared to complete raw source SVGs; not an Office-render claim.",
              "passed": all(r["passed"] for r in body_results), "slides": body_results}
    (directory / "component-body-verification.json").write_text(json.dumps(report, indent=2) + "\n")
    if len(page_results) == len(manifest["slides"]):
        page_report = {"method": "Blank frame plus separately rendered SVG objects compared to independent complete-page PDF renders; not an Office-render claim.",
                       "passed": all(r["passed"] for r in page_results), "slides": page_results,
                       "manifestSha256":hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
                       "inputHTMLSha256":input_hash,"verifiedInputs":proof_inputs}
        (directory / "component-visual-verification.json").write_text(json.dumps(page_report, indent=2) + "\n")
        print(json.dumps(page_report, indent=2))
    elif page_results:
        raise ValueError("Full-page references are only partially available; finish rendering before the full-page check")
    if not report["passed"] or any(not r["passed"] for r in page_results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
