#!/usr/bin/env python3
"""Independently inspect a PowerPoint's native editability and preserved content.

This reads the OOXML package; it neither imports the author's exporter nor
certifies a Microsoft PowerPoint rendering.  Source text inventories are checked
against actual native text, not image metadata or accessibility descriptions.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import posixpath
import re
import sys
from zipfile import ZipFile
import xml.etree.ElementTree as ET

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def canon(text: str) -> str:
    # Soft hyphens are layout hints; all other non-whitespace characters matter.
    return re.sub(r"\s+", "", text.replace("\u00ad", ""))


def note_content(text: str) -> str:
    """Allow only the export disclosure and exact obsolete editability wording."""
    text = re.sub(
        r"\n\nPOWERPOINT EXPORT\n\n.*?(?=\n\n(?:WEB REFERENCES|LOCAL COMPANION REFERENCES|SLIDE TEXT REFERENCE)\b|\Z)",
        "\n\nPOWERPOINT EXPORT\n\n[FORMAT DISCLOSURE]",
        text,
        flags=re.S,
    )
    for statement in (
        "Labels are outlined vector artwork. The source SVG assets keep editable source text; speaker notes remain editable PowerPoint text.",
        "Labels, calendars and shipping values are native editable PowerPoint text. Illustration parts are native shapes; speaker notes remain editable text.",
    ):
        text = text.replace(statement, "[COMPONENT EDITABILITY INSTRUCTION]")
    return text


def paragraph_text(root: ET.Element) -> str:
    result = []
    for para in root.findall(".//a:p", NS):
        parts = []
        for child in para:
            if child.tag in (f"{{{NS['a']}}}r", f"{{{NS['a']}}}fld"):
                parts.append(child.findtext("a:t", default="", namespaces=NS))
            elif child.tag == f"{{{NS['a']}}}br":
                parts.append("\n")
        result.append("".join(parts))
    return "\n".join(result)


def source_svg_text(markup: str) -> list[str]:
    """Collect source labels once, excluding title/desc and defs."""
    if not markup:
        return []
    root = ET.fromstring(markup)
    result = []

    def walk(node: ET.Element, in_defs: bool = False) -> None:
        tag = local(node.tag)
        if tag in ("defs", "symbol", "clipPath", "mask", "title", "desc", "style"):
            return
        if tag == "text":
            result.append("".join(node.itertext()))
            return
        for child in node:
            walk(child, in_defs)

    walk(root)
    return result


def inventory(page: dict, folder: Path) -> tuple[list[str], int]:
    texts = []
    svg_count = 0
    for element in page.get("elements", []):
        kind = element.get("type")
        if kind == "text":
            if isinstance(element.get("text"), str):
                texts.append(element["text"])
            elif element.get("lines"):
                texts.extend(
                    "".join(str(run.get("text", "")) for run in line.get("runs", []))
                    for line in element["lines"]
                )
            else:
                raise ValueError(f"No text inventory for element {element.get('id')}")
        elif kind == "svg":
            svg_count += 1
            markup = next((element.get(key) for key in ("svg", "markup", "svgMarkup")
                           if isinstance(element.get(key), str)), None)
            if markup is None and element.get("asset"):
                asset = (folder / element["asset"]).resolve()
                if element.get("sourceSha256") and sha256(asset) != element["sourceSha256"]:
                    raise ValueError(f"Source SVG differs from layout inventory: {asset}")
                markup = asset.read_text()
            if markup is None:
                raise ValueError(f"No source SVG markup for element {element.get('id')}")
            texts.extend(source_svg_text(markup))
    return texts, svg_count


def child_transform(node: ET.Element, scale: tuple[float, float],
                    offset: tuple[float, float]) -> tuple[tuple[float, float], tuple[float, float]]:
    xfrm = node.find("p:grpSpPr/a:xfrm", NS)
    if xfrm is None:
        return scale, offset
    off = xfrm.find("a:off", NS)
    ext = xfrm.find("a:ext", NS)
    child_off = xfrm.find("a:chOff", NS)
    child_ext = xfrm.find("a:chExt", NS)
    if any(el is None for el in (off, ext, child_off, child_ext)):
        raise ValueError("Group transform is incomplete")
    sx = float(ext.attrib["cx"]) / float(child_ext.attrib["cx"])
    sy = float(ext.attrib["cy"]) / float(child_ext.attrib["cy"])
    if sx <= 0 or sy <= 0:
        raise ValueError("Non-positive group scale")
    return ((scale[0] * sx, scale[1] * sy), (
        offset[0] + scale[0] * (float(off.attrib["x"]) - sx * float(child_off.attrib["x"])),
        offset[1] + scale[1] * (float(off.attrib["y"]) - sy * float(child_off.attrib["y"])),
    ))


def validate(args: argparse.Namespace) -> dict:
    baseline = json.loads(args.baseline.read_text())
    manifest = json.loads(args.manifest.read_text())
    pages = manifest.get("pages", manifest.get("slides", []))
    errors, warnings, audit = [], [], []
    report = {
        "schemaVersion": 1,
        "reviewType": "Independent OOXML native-editability inspection",
        "pptx": str(args.pptx), "pptxSha256": sha256(args.pptx),
        "manifest": str(args.manifest), "manifestSha256": sha256(args.manifest),
        "baseline": str(args.baseline), "baselineSha256": sha256(args.baseline),
        "nativeOfficeRendered": False, "slides": audit, "errors": errors, "warnings": warnings,
    }
    provenance = manifest.get("inputProvenance", [])
    if not provenance:
        errors.append("Layout manifest has no input provenance")
    for record in provenance:
        source = (args.manifest.parent / record["path"]).resolve()
        if not source.is_file() or sha256(source) != record["sha256"]:
            errors.append(f"Layout source provenance changed: {record.get('role')} / {source}")
    report["sourceProvenanceChecked"] = len(provenance)
    if args.archived_pptx:
        report["archivedPptx"] = str(args.archived_pptx)
        report["archivedPptxSha256"] = sha256(args.archived_pptx)
        if report["archivedPptxSha256"] != baseline["pptxSHA256"]:
            errors.append("Archived input PPTX differs from independent pre-conversion baseline")
    else:
        warnings.append("Archive identity not inspected; no --archived-pptx argument supplied")

    with ZipFile(args.pptx) as archive:
        bad_member = archive.testzip()
        if bad_member:
            errors.append(f"Corrupt ZIP member: {bad_member}")
        names = set(archive.namelist())
        presentation = ET.fromstring(archive.read("ppt/presentation.xml"))
        pres_rels = {r.attrib["Id"]: r.attrib for r in ET.fromstring(archive.read("ppt/_rels/presentation.xml.rels"))}
        size = presentation.find("p:sldSz", NS)
        width, height = int(size.attrib["cx"]), int(size.attrib["cy"])
        report["sizeEMU"] = [width, height]
        slide_paths = []
        for sid in presentation.findall("p:sldIdLst/p:sldId", NS):
            rel = pres_rels[sid.attrib[f"{{{NS['r']}}}id"]]
            slide_paths.append(posixpath.normpath(posixpath.join("ppt", rel["Target"])))
        report["slideCount"] = len(slide_paths)
        if len(slide_paths) != baseline["slideCount"] or len(pages) != len(slide_paths):
            errors.append("Slide count differs among source manifest, input baseline and native deck")

        # Inspect relationship targets independently of the exporter.
        relationship_count = 0
        for rel_path in names:
            if not rel_path.endswith(".rels"):
                continue
            folder = posixpath.dirname(posixpath.dirname(rel_path))
            for rel in ET.fromstring(archive.read(rel_path)):
                relationship_count += 1
                if rel.attrib.get("TargetMode") == "External":
                    continue
                target = rel.attrib["Target"]
                member = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join(folder, target))
                if member not in names:
                    errors.append(f"Missing relationship target: {rel_path} → {member}")
        report["relationshipsChecked"] = relationship_count

        for i, (member, page, original) in enumerate(zip(slide_paths, pages, baseline["slides"]), 1):
            prefix = f"Slide {i}: "
            slide_errors = []
            root = ET.fromstring(archive.read(member))
            pictures = root.findall(".//p:pic", NS)
            shapes = root.findall(".//p:sp", NS)
            connectors = root.findall(".//p:cxnSp", NS)
            groups = root.findall(".//p:grpSp", NS)
            native_text = [paragraph_text(s) for s in shapes if s.find("p:txBody", NS) is not None]
            expected_text, svg_count = inventory(page, args.manifest.parent)
            actual_chars = Counter(canon("".join(native_text)))
            expected_chars = Counter(canon("".join(expected_text)))
            missing, extra = expected_chars - actual_chars, actual_chars - expected_chars
            native_phrases = [canon(t) for t in native_text]
            unmatched_phrases = [t for t in expected_text
                                 if len(canon(t)) >= 3 and not any(canon(t) in value for value in native_phrases)]
            if pictures:
                slide_errors.append(f"{len(pictures)} picture objects remain instead of native components")
            if root.findall(".//a:blipFill", NS):
                slide_errors.append("Image fills remain in the slide")
            if root.findall(".//p:oleObj", NS):
                slide_errors.append("Opaque embedded OLE objects remain in the slide")
            if not native_text or not actual_chars:
                slide_errors.append("No visible native text content")
            if len(shapes) < 5:
                slide_errors.append("Fewer than five native components; likely a flattened slide")
            if missing or extra:
                slide_errors.append(f"Native text differs from source: missing {dict(missing)}, extra {dict(extra)}")
            if unmatched_phrases:
                slide_errors.append("Source phrases are changed or fragmented across native text objects: "
                                    + repr(unmatched_phrases[:8]))
            ids = [m.attrib.get("id") for m in root.findall(".//p:cNvPr", NS)]
            if len(ids) != len(set(ids)):
                slide_errors.append("Duplicate native component identifiers")
            root_metadata = root.find("p:cSld/p:spTree/p:nvGrpSpPr/p:cNvPr", NS)
            for meta in root.findall(".//p:cNvPr", NS):
                if meta is root_metadata:
                    continue  # The slide's mandatory, non-selectable root container.
                if not meta.attrib.get("name"):
                    slide_errors.append("An unnamed native component is not discoverable in the Selection Pane")
            for locks_tag in ("spLocks", "grpSpLocks"):
                for locks in root.findall(f".//a:{locks_tag}", NS):
                    for attribute in ("noTextEdit", "noSelect", "noMove", "noResize", "noUngrp"):
                        if locks.attrib.get(attribute) in ("1", "true"):
                            slide_errors.append(f"A component is locked against customization: {attribute}")

            # Check that text is genuine visible shape content, not a hidden overlay.
            for shape in shapes:
                body = shape.find("p:txBody", NS)
                if body is None or not paragraph_text(shape).strip():
                    continue
                meta = shape.find("p:nvSpPr/p:cNvPr", NS)
                label = meta.attrib.get("name", "unnamed") if meta is not None else "unnamed"
                if meta is not None and meta.attrib.get("hidden") in ("1", "true"):
                    slide_errors.append(f"Text is hidden: {label}")
                for run in body.findall(".//a:r", NS):
                    if not run.findtext("a:t", default="", namespaces=NS).strip():
                        continue
                    props = run.find("a:rPr", NS)
                    if props is None:
                        continue
                    if props.find("a:noFill", NS) is not None:
                        slide_errors.append(f"Text has no fill: {label}")
                    for alpha in props.findall(".//a:alpha", NS):
                        if int(alpha.attrib["val"]) <= 0:
                            slide_errors.append(f"Text is transparent: {label}")
                    if "sz" in props.attrib and int(props.attrib["sz"]) <= 0:
                        slide_errors.append(f"Text has a non-positive font size: {label}")

            # Inspect geometry and real world bounds through nested group transforms.
            bounds_checked = 0
            rotations = 0
            tolerance = width / float(page.get("width", 1920)) * 2.0

            def walk(container: ET.Element, scale=(1.0, 1.0), offset=(0.0, 0.0)) -> None:
                nonlocal bounds_checked, rotations
                for node in container:
                    if node.tag == f"{{{NS['p']}}}grpSp":
                        child_scale, child_offset = child_transform(node, scale, offset)
                        walk(node, child_scale, child_offset)
                    elif node.tag in (f"{{{NS['p']}}}sp", f"{{{NS['p']}}}cxnSp"):
                        xfrm = node.find("p:spPr/a:xfrm", NS)
                        if xfrm is None:
                            slide_errors.append("Native component has no explicit transform")
                            continue
                        off, ext = xfrm.find("a:off", NS), xfrm.find("a:ext", NS)
                        if off is None or ext is None:
                            slide_errors.append("Native component has an incomplete transform")
                            continue
                        x, y = float(off.attrib["x"]), float(off.attrib["y"])
                        w, h = float(ext.attrib["cx"]), float(ext.attrib["cy"])
                        if w < 0 or h < 0 or (w == 0 and h == 0):
                            slide_errors.append("Native component has an empty/negative extent")
                        x, y, w, h = offset[0] + scale[0] * x, offset[1] + scale[1] * y, scale[0] * w, scale[1] * h
                        if x < -tolerance or y < -tolerance or x + w > width + tolerance or y + h > height + tolerance:
                            meta = node.find(".//p:cNvPr", NS)
                            slide_errors.append(f"Component outside slide: {meta.attrib.get('name', 'unnamed') if meta is not None else 'unnamed'}")
                        if int(xfrm.attrib.get("rot", "0")) % (360 * 60000):
                            rotations += 1
                        bounds_checked += 1

            tree = root.find("p:cSld/p:spTree", NS)
            if tree is not None:
                try:
                    walk(tree)
                except (ValueError, KeyError, ZeroDivisionError) as exc:
                    slide_errors.append(f"Invalid component/group transform: {exc}")
            if rotations:
                warnings.append(prefix + f"{rotations} rotated objects: bounds audit checks their declared unrotated bounds")

            custom_paths = 0
            for custom in root.findall(".//a:custGeom", NS):
                paths = custom.findall("a:pathLst/a:path", NS)
                if not paths:
                    slide_errors.append("Empty custom geometry")
                for path in paths:
                    custom_paths += 1
                    if int(path.attrib.get("w", "0")) <= 0 or int(path.attrib.get("h", "0")) <= 0:
                        slide_errors.append("Custom path lacks positive coordinate dimensions")
                    for command in path:
                        kind = local(command.tag)
                        counts = {"moveTo": 1, "lnTo": 1, "quadBezTo": 2, "cubicBezTo": 3, "close": 0, "arcTo": 0}
                        if kind not in counts or len(command.findall("a:pt", NS)) != counts.get(kind):
                            slide_errors.append(f"Invalid custom path command: {kind}")
                        for pt in command.findall("a:pt", NS):
                            for coordinate in ("x", "y"):
                                if not re.fullmatch(r"-?\d+", pt.attrib.get(coordinate, "")):
                                    slide_errors.append("Non-integer custom path coordinate")
            for rgb in root.findall(".//a:srgbClr", NS):
                if not re.fullmatch(r"[0-9A-Fa-f]{6}", rgb.attrib.get("val", "")):
                    slide_errors.append("Invalid RGB color")
            font_faces = sorted({font.attrib.get("typeface", "") for font in root.findall(".//a:latin", NS)})
            for family in font_faces:
                if family in {"IBMPlexMono", "Plex"}:
                    slide_errors.append(f"CSS-only font alias must map to the actual PowerPoint font family: {family}")

            rel_path = posixpath.dirname(member) + "/_rels/" + posixpath.basename(member) + ".rels"
            relationships = [r.attrib for r in ET.fromstring(archive.read(rel_path))]
            links = [r["Target"] for r in relationships if r["Type"].endswith("/hyperlink")]
            if Counter(links) != Counter(original["links"]):
                slide_errors.append("Web-source hyperlink targets/counts differ from original slide")
            referenced = set()
            for click in root.findall(".//a:hlinkClick", NS):
                if f"{{{NS['r']}}}id" in click.attrib:
                    referenced.add(click.attrib[f"{{{NS['r']}}}id"])
            for rel in relationships:
                if rel["Type"].endswith("/hyperlink") and rel["Id"] not in referenced:
                    slide_errors.append("A source hyperlink relationship has no clickable shape/text")
            note_rels = [r for r in relationships if r["Type"].endswith("/notesSlide")]
            if len(note_rels) != 1:
                slide_errors.append("Expected one editable speaker-notes page")
                notes_match = False
            else:
                note_path = posixpath.normpath(posixpath.join(posixpath.dirname(member), note_rels[0]["Target"]))
                note = ET.fromstring(archive.read(note_path))
                note_text = ["".join(t.itertext()) for t in note.findall(".//a:t", NS)]
                notes_match = canon(note_content("\n".join(note_text))) == canon(note_content("\n".join(original["notes"])))
                if not notes_match:
                    slide_errors.append("Teaching notes changed beyond the PowerPoint-format disclosure")

            # A title should be a real text phrase, not scattered individual glyphs.
            title = canon(page.get("title", ""))
            title_found = bool(title) and any(title in canon(t) for t in native_text)
            if title and not title_found:
                slide_errors.append("Slide title is not contained in a coherent native text component")
            record = {
                "index": i, "id": page.get("id"), "title": page.get("title"),
                "nativeShapes": len(shapes), "nativeConnectors": len(connectors),
                "nativeTextComponents": sum(bool(t.strip()) for t in native_text),
                "nativeGroups": len(groups), "pictureObjects": len(pictures),
                "sourceSVGs": svg_count, "sourceTextBlocks": len(expected_text),
                "nativeTextCharacters": sum(actual_chars.values()),
                "sourceTextCharacters": sum(expected_chars.values()),
                "textInventoryMatches": not missing and not extra,
                "sourcePhrasesPreserved": not unmatched_phrases,
                "titleIsCoherentText": title_found, "boundsChecked": bounds_checked,
                "customGeometryPaths": custom_paths,
                "fontFaces": font_faces,
                "hyperlinksPreserved": len(links), "teachingNotesPreserved": notes_match,
                "errors": slide_errors,
            }
            audit.append(record)
            errors.extend(prefix + e for e in slide_errors)
    report["nativeShapeCount"] = sum(s["nativeShapes"] for s in audit)
    report["nativeTextComponentCount"] = sum(s["nativeTextComponents"] for s in audit)
    report["nativeGroupCount"] = sum(s["nativeGroups"] for s in audit)
    report["pictureObjectCount"] = sum(s["pictureObjects"] for s in audit)
    report["hyperlinkCount"] = sum(s["hyperlinksPreserved"] for s in audit)
    report["passed"] = not errors
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pptx", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--baseline", type=Path,
                        default=Path(__file__).resolve().parents[1] / "reviews/05-editability-baseline.json")
    parser.add_argument("--archived-pptx", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        report = validate(args)
    except Exception as exc:
        report = {"passed": False, "errors": [f"Inspector failed closed: {type(exc).__name__}: {exc}"]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in ("passed", "slideCount", "nativeShapeCount", "nativeTextComponentCount", "nativeGroupCount", "pictureObjectCount", "hyperlinkCount", "errors", "warnings") if key in report}, ensure_ascii=False))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
