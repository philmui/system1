#!/usr/bin/env python3
"""Challenge the independent native-content inspector using isolated mutations."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
from zipfile import ZipFile, ZIP_DEFLATED
import xml.etree.ElementTree as ET

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def hash_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def first_text_shape(root):
    return next(s for s in root.findall(".//p:sp", NS) if s.find("p:txBody", NS) is not None)


def edit(root, kind):
    shape = first_text_shape(root)
    if kind == "text-order":
        text = shape.find(".//a:t", NS)
        words = text.text.split()
        text.text = " ".join(reversed(words))
    elif kind == "picture":
        ET.SubElement(root.find("p:cSld/p:spTree", NS), f"{{{NS['p']}}}pic")
    elif kind == "hidden-text":
        rgb = shape.find(".//a:rPr/a:solidFill/a:srgbClr", NS)
        for child in list(rgb):
            if child.tag == f"{{{NS['a']}}}alpha":
                rgb.remove(child)
        ET.SubElement(rgb, f"{{{NS['a']}}}alpha", {"val": "0"})
    elif kind == "locked-text":
        meta = shape.find("p:nvSpPr/p:cNvSpPr", NS)
        ET.SubElement(meta, f"{{{NS['a']}}}spLocks", {"noTextEdit": "1"})
    elif kind == "lost-click":
        first = root.find(".//a:hlinkClick", NS)
        rel = first.attrib[f"{{{NS['r']}}}id"]
        for parent in root.iter():
            for child in list(parent):
                if child.tag == f"{{{NS['a']}}}hlinkClick" and child.attrib.get(f"{{{NS['r']}}}id") == rel:
                    parent.remove(child)
    elif kind == "out-of-bounds":
        shape.find("p:spPr/a:xfrm/a:off", NS).set("x", "24384000")
    elif kind == "font-alias":
        shape.find(".//a:latin", NS).set("typeface", "IBMPlexMono")
    elif kind == "invalid-path":
        root.find(".//a:custGeom/a:pathLst/a:path/a:moveTo/a:pt", NS).set("x", "NaN")
    else:
        raise ValueError(kind)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pptx", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("report", type=Path)
    parser.add_argument("--archived-pptx", type=Path, required=True)
    args = parser.parse_args()
    inspector_path = Path(__file__).with_name("validate-editable-powerpoint.py")
    spec = importlib.util.spec_from_file_location("native_editability_inspector", inspector_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    baseline = Path(__file__).resolve().parents[1] / "reviews/05-editability-baseline.json"
    params = dict(manifest=args.manifest, baseline=baseline, archived_pptx=args.archived_pptx)
    positive = module.validate(SimpleNamespace(pptx=args.pptx, **params))
    if not positive["passed"]:
        raise AssertionError(f"Unmodified candidate must pass first: {positive['errors']}")
    original_hash = hash_file(args.pptx)
    with ZipFile(args.pptx) as archive:
        package = {name: archive.read(name) for name in archive.namelist()}
    cases = [
        ("text-order", "Source phrases are changed"),
        ("picture", "picture objects remain"),
        ("hidden-text", "Text is transparent"),
        ("locked-text", "locked against customization"),
        ("lost-click", "no clickable shape/text"),
        ("out-of-bounds", "Component outside slide"),
        ("font-alias", "CSS-only font alias"),
        ("invalid-path", "Non-integer custom path coordinate"),
        ("teaching-notes", "Teaching notes changed"),
    ]
    results = []
    with tempfile.TemporaryDirectory(prefix="system1-editability-rejections-") as folder:
        for kind, expected_error in cases:
            member = "ppt/notesSlides/notesSlide1.xml" if kind == "teaching-notes" else "ppt/slides/slide1.xml"
            root = ET.fromstring(package[member])
            if kind == "teaching-notes":
                text = root.find(".//a:t", NS)
                assert "Services establish facts and authority" in text.text
                text.text = text.text.replace("Services establish facts and authority", "Models establish authority", 1)
            else:
                edit(root, kind)
            changed = Path(folder) / f"{kind}.pptx"
            with ZipFile(changed, "w", ZIP_DEFLATED) as archive:
                for name, value in package.items():
                    archive.writestr(name, ET.tostring(root, encoding="utf-8", xml_declaration=True) if name == member else value)
            result = module.validate(SimpleNamespace(pptx=changed, **params))
            relevant = [error for error in result["errors"] if expected_error in error]
            if result["passed"] or not relevant:
                raise AssertionError(f"Mutation did not trigger its intended rejection: {kind} / {result['errors']}")
            results.append({"case": kind, "rejected": True, "reason": relevant[0]})
    assert hash_file(args.pptx) == original_hash
    report = {"passed": True, "method": "Independent inspector invoked against isolated, deliberately damaged OOXML packages",
              "input": str(args.pptx), "inputSha256": original_hash,
              "inspectorSha256": hash_file(inspector_path), "unmodifiedCandidatePassed": True,
              "negativeCases": results, "inputUnchanged": True, "temporaryCopiesRemoved": True}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"passed": True, "negativeCases": len(results), "inputUnchanged": True}))


if __name__ == "__main__":
    main()
