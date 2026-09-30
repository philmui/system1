#!/usr/bin/env python3
"""Independently validate the movable-vector PowerPoint package.

Usage: python3 validate-component-powerpoint.py FINAL.pptx LAYER-MANIFEST.json

This verifies ZIP/OOXML structure, exact source-artwork identity, bounds,
Selection Pane names, disclosures, source links and unchanged base members.
The selected frames and objects must contain no raster image or font-dependent
SVG content. Legacy, unchanged full-slide artwork is outside that purity claim.
Office rendering and visual reconstruction are separate checks.
"""

from __future__ import annotations

import binascii
import hashlib
import json
import math
import posixpath
import re
import struct
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile


NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "asvg": "http://schemas.microsoft.com/office/drawing/2016/SVG/main",
    "svg": "http://www.w3.org/2000/svg",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
}
OLD_DISCLOSURE = "This edition preserves the HTML slide design as one outlined SVG graphic with an embedded PNG fallback. Slide text is vector artwork, not editable PowerPoint paragraphs. Speaker notes remain editable. Use the companion HTML for interaction."
NEW_DISCLOSURE = "COMPONENT POWERPOINT\n\nThis slide uses a fixed vector frame plus separate, independently movable vector illustrations, labels and connectors. Labels are outlined artwork, not native editable text. Speaker notes remain editable. Every vector object has an embedded PNG fallback. Use the Selection Pane to select named parts. Connectors are independent objects; they do not automatically follow moved illustrations. Other slides retain their complete-frame vector artwork."
KINDS = {"illustration", "label", "connector", "background", "decoration", "badge"}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def xml_escape(value):
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&apos;")


def target(folder, value):
    return posixpath.normpath(posixpath.join(folder, value))


def relationship_base(name):
    return "" if name == "_rels/.rels" else posixpath.dirname(posixpath.dirname(name))


def local_name(tag):
    return tag.rsplit("}", 1)[-1]


def inspect_svg(data, label, require):
    raw = data.decode("utf-8")
    require("<!DOCTYPE" not in raw and "<!ENTITY" not in raw, f"{label}: unsupported SVG entities")
    root = ET.fromstring(data)
    require(root.tag == "{" + NS["svg"] + "}svg", f"{label}: wrong SVG root")
    forbidden = {"text", "tspan", "textPath", "foreignObject", "image", "font", "script", "iframe"}
    require(not any(local_name(e.tag) in forbidden for e in root.iter()),
            f"{label}: raster, text, font, or active content inside SVG")
    require(not re.search(r"@font-face|font-family\s*[:=]|data:font/", raw, re.I),
            f"{label}: SVG font dependency")
    ids = [e.get("id") for e in root.iter() if e.get("id")]
    require(len(ids) == len(set(ids)), f"{label}: duplicate internal SVG id")
    for element in root.iter():
        for name, value in element.attrib.items():
            if local_name(name) == "href":
                require(value.startswith("#"), f"{label}: nonlocal SVG reference")
                if value.startswith("#"):
                    require(value[1:] in ids, f"{label}: broken SVG fragment reference {value}")
            require(not local_name(name).lower().startswith("on"), f"{label}: active SVG event handler")
    for m in re.finditer(r"url\(\s*(['\"]?)(.*?)\1\s*\)", raw):
        require(m.group(2).strip().startswith("#"), f"{label}: external SVG style reference")
    return len(root.findall(".//svg:path", NS))


def inspect_png(data, label, require):
    require(data.startswith(b"\x89PNG\r\n\x1a\n"), f"{label}: PNG signature")
    position, dimensions, ended = 8, None, False
    while position + 12 <= len(data):
        length = struct.unpack(">I", data[position:position + 4])[0]
        kind = data[position + 4:position + 8]
        end = position + 12 + length
        require(end <= len(data), f"{label}: truncated PNG chunk")
        if end > len(data):
            break
        payload = data[position + 8:position + 8 + length]
        expected_crc = struct.unpack(">I", data[position + 8 + length:end])[0]
        require((binascii.crc32(kind + payload) & 0xffffffff) == expected_crc,
                f"{label}: PNG chunk CRC mismatch")
        if kind == b"IHDR":
            require(len(payload) == 13, f"{label}: invalid PNG header")
            dimensions = list(struct.unpack(">II", payload[:8]))
            require(all(n > 0 for n in dimensions), f"{label}: empty PNG")
        if kind == b"IEND":
            ended = True
            require(end == len(data), f"{label}: bytes after PNG end")
            break
        position = end
    require(ended and dimensions is not None, f"{label}: missing PNG header or end")
    return dimensions


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python3 validate-component-powerpoint.py FINAL.pptx LAYER-MANIFEST.json")
    powerpoint = Path(sys.argv[1]).resolve()
    manifest_path = Path(sys.argv[2]).resolve()
    folder = manifest_path.parent
    output_report = folder / "component-package-validation.json"
    errors, checks = [], {}

    def require(condition, message):
        if not condition:
            errors.append(message)

    def asset_path(value):
        require(isinstance(value, str) and not Path(value).is_absolute(), "Manifest asset path must be relative")
        return (folder / value).resolve()

    try:
        manifest_bytes = manifest_path.read_bytes()
        manifest = json.loads(manifest_bytes)
        report = json.loads((folder / "component-package-report.json").read_text())
        require(sha(manifest_bytes) == report["manifestSha256"], "Manifest changed after packaging")
        require(sha(powerpoint.read_bytes()) == report["outputSha256"], "PowerPoint changed after packaging")
        require(report["noteDisclosure"] == NEW_DISCLOSURE, "Incorrect report disclosure")
        stage_w, stage_h = manifest["stage"]
        require(stage_w > 0 and stage_h > 0, "Invalid stage dimensions")
        selected = {s["index"]: s for s in manifest["slides"]}
        require(len(selected) == len(manifest["slides"]), "Duplicate selected slide index")
        audit_by_index = {s["index"]: s for s in report["slides"]}
        require(set(selected) == set(audit_by_index), "Manifest/report selected slide mismatch")
        component_count, paths, png_count, svg_count, link_count = 0, 0, 0, 0, 0

        with ZipFile(powerpoint) as archive:
            require(archive.testzip() is None, "ZIP CRC failure")
            names = set(archive.namelist())
            require(len(names) == len(archive.namelist()), "Duplicate ZIP member name")
            xml = {name: ET.fromstring(archive.read(name)) for name in names
                   if name.endswith((".xml", ".rels"))}
            relationship_count = 0
            for name, root in xml.items():
                if not name.endswith(".rels"):
                    continue
                rel_ids = [r.get("Id") for r in root]
                require(len(rel_ids) == len(set(rel_ids)), f"Duplicate relationship id in {name}")
                for rel in root:
                    relationship_count += 1
                    if rel.get("TargetMode") == "External":
                        require(rel.get("Target", "").startswith(("https://", "http://")),
                                f"Unexpected external relationship in {name}")
                    else:
                        require(target(relationship_base(name), rel.get("Target", "")) in names,
                                f"Broken relationship target in {name}: {rel.get('Target')}")

            content_types = xml["[Content_Types].xml"]
            defaults = {d.get("Extension"): d.get("ContentType")
                        for d in content_types.findall("ct:Default", NS)}
            require(defaults.get("svg") == "image/svg+xml", "SVG content type missing")
            require(defaults.get("png") == "image/png", "PNG content type missing")
            presentation = xml["ppt/presentation.xml"]
            size = presentation.find("p:sldSz", NS)
            cx, cy = int(size.get("cx")), int(size.get("cy"))
            require([cx, cy] == report["sizeEMU"], "Presentation size differs from package report")
            require(abs(cx / cy - stage_w / stage_h) < 1e-6, "Stage aspect ratio mismatch")
            pres_rels = {r.get("Id"): r for r in xml["ppt/_rels/presentation.xml.rels"]}
            members = [target("ppt", pres_rels[s.get("{" + NS["r"] + "}id")].get("Target"))
                       for s in presentation.findall("p:sldIdLst/p:sldId", NS)]
            require(len(members) == report["totalSlideCount"], "Presentation slide count changed")
            preserved = {e["name"]: e["sha256"] for e in report["preservedBaseMembers"]}
            require(len(preserved) == len(report["preservedBaseMembers"]), "Duplicate preserved-member entry")
            for name, expected in preserved.items():
                require(name in names and sha(archive.read(name)) == expected,
                        f"Base package member changed unexpectedly: {name}")
            allowed_changes = {"[Content_Types].xml"}

            for index, member in enumerate(members, 1):
                slide = xml[member]
                slide_folder = posixpath.dirname(member)
                rel_member = slide_folder + "/_rels/" + posixpath.basename(member) + ".rels"
                rels = {r.get("Id"): r for r in xml[rel_member]}
                object_ids = [e.get("id") for e in slide.findall(".//p:cNvPr", NS)]
                require(len(object_ids) == len(set(object_ids)), f"Slide {index}: duplicate shape id")
                for transform in slide.findall(".//a:xfrm", NS):
                    off, ext = transform.find("a:off", NS), transform.find("a:ext", NS)
                    if off is None or ext is None:
                        continue
                    xx, yy = int(off.get("x")), int(off.get("y"))
                    ww, hh = int(ext.get("cx")), int(ext.get("cy"))
                    require(xx >= -1 and yy >= -1 and ww >= 0 and hh >= 0 and
                            xx + ww <= cx + 1 and yy + hh <= cy + 1,
                            f"Slide {index}: object outside slide bounds")
                if index not in selected:
                    require(member in preserved and rel_member in preserved,
                            f"Slide {index}: unselected slide was not preserved exactly")
                    for rel in rels.values():
                        if rel.get("Type", "").endswith("/notesSlide"):
                            require(target(slide_folder, rel.get("Target")) in preserved,
                                    f"Slide {index}: unselected notes were not preserved exactly")
                    continue

                spec, audit = selected[index], audit_by_index[index]
                require(audit["id"] == spec["id"] and audit["member"] == member,
                        f"Slide {index}: wrong source identity")
                require(sha(archive.read(member)) == audit["slideSha256"], f"Slide {index}: changed slide XML")
                require(sha(archive.read(rel_member)) == audit["relationshipsSha256"],
                        f"Slide {index}: changed relationship XML")
                picture_list = slide.findall("p:cSld/p:spTree/p:pic", NS)
                require(len(picture_list) == 1 + len(spec["objects"]), f"Slide {index}: wrong component picture count")
                require(len(audit["objects"]) == len(spec["objects"]), f"Slide {index}: report component count")
                expected_names = [f"{spec['id']} — frame (background and slide chrome)"] + [
                    f"{spec['id']} — {o['kind']}: {o['name']}" for o in spec["objects"]]
                names_in_slide = [p.find("p:nvPicPr/p:cNvPr", NS).get("name") for p in picture_list]
                require(names_in_slide == expected_names, f"Slide {index}: component names or z-order changed")
                require(len(names_in_slide) == len(set(names_in_slide)), f"Slide {index}: duplicate Selection Pane name")
                pairs = [(spec["frame"], audit["frame"], [0, 0, cx, cy])] + [
                    (o, a, [int(math.floor(o["x"] / stage_w * cx + .5)), int(math.floor(o["y"] / stage_h * cy + .5)),
                            int(math.floor(o["w"] / stage_w * cx + .5)), int(math.floor(o["h"] / stage_h * cy + .5))])
                    for o, a in zip(spec["objects"], audit["objects"])]

                for picture, (source, image_audit, expected_emu) in zip(picture_list, pairs):
                    label = f"Slide {index}: {image_audit['name']}"
                    meta = picture.find("p:nvPicPr/p:cNvPr", NS)
                    require(int(meta.get("id")) == image_audit["shapeId"], label + ": shape id mismatch")
                    require(bool(meta.get("descr")), label + ": missing object description")
                    locks = picture.find("p:nvPicPr/p:cNvPicPr/a:picLocks", NS)
                    require(locks is None or locks.get("noMove") != "1", label + ": object movement is locked")
                    png_blip = picture.find("p:blipFill/a:blip", NS)
                    svg_blip = picture.find(".//asvg:svgBlip", NS)
                    require(png_blip is not None and svg_blip is not None, label + ": missing SVG/PNG pair")
                    if png_blip is None or svg_blip is None:
                        continue
                    png_rel = png_blip.get("{" + NS["r"] + "}embed")
                    svg_rel = svg_blip.get("{" + NS["r"] + "}embed")
                    require(png_rel == image_audit["pngRel"] and svg_rel == image_audit["svgRel"],
                            label + ": relationship pair mismatch")
                    for rid in (png_rel, svg_rel):
                        require(rid in rels and rels[rid].get("Type", "").endswith("/image"), label + ": nonimage relationship")
                    png_name = target(slide_folder, rels[png_rel].get("Target"))
                    svg_name = target(slide_folder, rels[svg_rel].get("Target"))
                    require(png_name == image_audit["png"] and svg_name == image_audit["svg"],
                            label + ": media target mismatch")
                    png_data, svg_data = archive.read(png_name), archive.read(svg_name)
                    require(sha(png_data) == image_audit["pngSha256"] == sha(asset_path(source["png"]).read_bytes()),
                            label + ": PNG does not match source artwork")
                    require(sha(svg_data) == image_audit["svgSha256"] == sha(asset_path(source["svg"]).read_bytes()),
                            label + ": SVG does not match source artwork")
                    require(inspect_png(png_data, label, require) == image_audit["pngSize"], label + ": PNG dimension mismatch")
                    paths += inspect_svg(svg_data, label, require)
                    png_count += 1
                    svg_count += 1
                    transform = picture.find("p:spPr/a:xfrm", NS)
                    off, ext = transform.find("a:off", NS), transform.find("a:ext", NS)
                    actual_emu = [int(off.get("x")), int(off.get("y")), int(ext.get("cx")), int(ext.get("cy"))]
                    require(actual_emu == expected_emu == image_audit["emu"], label + ": placement or dimensions changed")
                    if source is not spec["frame"]:
                        require(source["kind"] in KINDS, label + ": unknown component kind")
                        component_count += 1

                notes_rel = next((r for r in rels.values() if r.get("Type", "").endswith("/notesSlide")), None)
                require(notes_rel is not None, f"Slide {index}: missing editable notes")
                note_name = target(slide_folder, notes_rel.get("Target"))
                allowed_changes.update((member, rel_member, note_name))
                notes_raw = archive.read(note_name)
                require(note_name == audit["noteMember"] and sha(notes_raw) == audit["notesSha256"],
                        f"Slide {index}: notes differ from package report")
                note_text = "\n".join(e.text or "" for e in xml[note_name].findall(".//a:t", NS))
                require(NEW_DISCLOSURE in note_text and OLD_DISCLOSURE not in note_text,
                        f"Slide {index}: editability disclosure missing or stale")
                restored = notes_raw.decode().replace(xml_escape(NEW_DISCLOSURE), xml_escape(OLD_DISCLOSURE), 1)
                require(sha(restored.encode()) == audit["originalNotesSha256"],
                        f"Slide {index}: original notes were altered beyond the disclosure")
                links = [{"id": r.get("Id"), "target": r.get("Target"), "mode": r.get("TargetMode", "")}
                         for r in xml[rel_member] if r.get("Type", "").endswith("/hyperlink")]
                require(links == audit["sourceLinks"], f"Slide {index}: source links were changed")
                hyperlink_ids = [e.get("{" + NS["r"] + "}id") for e in slide.findall(".//a:hlinkClick", NS)]
                require(set(hyperlink_ids) == {r["id"] for r in links}, f"Slide {index}: source hit-area mismatch")
                link_count += len(hyperlink_ids)
                if spec.get("expectedFullPNG"):
                    require(sha(asset_path(spec["expectedFullPNG"]).read_bytes()) == audit["expectedFullPNGSha256"],
                            f"Slide {index}: expected full render changed")

            require(set(report["changedBaseMembers"]) <= allowed_changes, "Unexpected modifications to the base package")
            require(component_count == report["movableObjectCount"], "Movable-object total differs from report")
            checks.update({
                "slideCount": len(members), "componentSlideCount": len(selected),
                "movableObjectCount": component_count, "selectedSVGCount": svg_count,
                "selectedPNGFallbackCount": png_count, "selectedVectorPathCount": paths,
                "sourceHyperlinksOnComponentSlides": link_count,
                "relationshipsChecked": relationship_count, "preservedBaseMembersChecked": len(preserved),
                "sizeEMU": [cx, cy], "selectionPaneNamesMatch": not any("names" in e or "Selection Pane" in e for e in errors),
                "selectedArtworkMatchesSources": not any("source artwork" in e for e in errors),
                "originalNotesPreservedExceptDisclosure": not any("original notes" in e for e in errors),
                "unselectedSlidesPreservedExactly": not any("unselected" in e for e in errors),
            })
    except Exception as exc:
        errors.append(f"Validation could not complete: {type(exc).__name__}: {exc}")

    result = {
        "powerpoint": powerpoint.name, "manifest": manifest_path.name,
        "passed": not errors, "checks": checks, "errors": errors,
        "limits": "Structural validation of selected movable SVG/PNG objects and unchanged base members. Legacy unselected artwork is preserved, not certified raster-free. This does not claim a Microsoft PowerPoint render, an automatic connector rerouting test, or visual reconstruction agreement.",
    }
    output_report.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    raise SystemExit(bool(errors))


if __name__ == "__main__":
    main()
