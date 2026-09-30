#!/usr/bin/env python3
"""Create a local, portable open-font pack for the editable v5 presentation.

This script writes only inside docs/slides/assets.  It never installs fonts and
never copies or changes Salesforce Sans.  Manrope is pinned at the two weights
used by native PowerPoint text; IBM Plex Mono is decoded from its WOFF2 container
without changing font data, family names or permission flags.
"""

from __future__ import annotations

import hashlib
from io import BytesIO
import json
from pathlib import Path
from shutil import copyfile
import zipfile

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


SLIDES = Path(__file__).resolve().parent.parent
SOURCES = SLIDES / 'assets/fonts'
OUTPUT = SLIDES / 'assets/editable-v5-fonts'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def open_font(path):
    return TTFont(path, recalcBBoxes=False, recalcTimestamp=False)


def outline_data(font):
    glyphs = font.getGlyphSet()
    result = {}
    for name in font.getGlyphOrder():
        pen = DecomposingRecordingPen(glyphs)
        glyphs[name].draw(pen)
        result[name] = pen.value
    return result


def metric_data(font):
    hhea = font['hhea']
    os2 = font['OS/2']
    return {'unitsPerEm': font['head'].unitsPerEm,
        'hhea': {'ascent': hhea.ascent, 'descent': hhea.descent,
                 'lineGap': hhea.lineGap, 'advanceWidthMax': hhea.advanceWidthMax},
        'typo': {'ascent': os2.sTypoAscender, 'descent': os2.sTypoDescender,
                 'lineGap': os2.sTypoLineGap},
        'win': {'ascent': os2.usWinAscent, 'descent': os2.usWinDescent},
        'advances': font['hmtx'].metrics}


def semantic_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True,
        separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def names_for_static_manrope(font, weight):
    style = 'Bold' if weight == 700 else 'Regular'
    replacements = {
        1: 'Manrope', 2: style, 3: f'Manrope {style}; local static instance {weight}',
        4: f'Manrope {style}', 6: f'Manrope-{style}', 16: 'Manrope', 17: style,
    }
    for name_id, value in replacements.items():
        records = [record for record in font['name'].names if record.nameID == name_id]
        for record in records:
            font['name'].setName(value, name_id, record.platformID,
                                 record.platEncID, record.langID)
        # Office-compatible Unicode Windows records, including typographic names.
        font['name'].setName(value, name_id, 3, 1, 0x409)
    font['OS/2'].usWeightClass = weight
    font['OS/2'].fsSelection &= ~((1 << 5) | (1 << 6))
    font['OS/2'].fsSelection |= (1 << 5) if weight == 700 else (1 << 6)
    font['head'].macStyle &= ~1
    if weight == 700:
        font['head'].macStyle |= 1


def native_static_roundtrip(font):
    """Apply the integer-coordinate serialization required by TrueType glyf."""
    buffer = BytesIO()
    font.flavor = None
    font.save(buffer, reorderTables=False)
    buffer.seek(0)
    return open_font(buffer)


def outline_rounding(before, after):
    max_delta = 0.0
    changed = 0
    for glyph in before:
        if before[glyph] != after[glyph]:
            changed += 1
        if len(before[glyph]) != len(after[glyph]):
            raise ValueError('Static serialization changed outline topology.')
        for (op1, args1), (op2, args2) in zip(before[glyph], after[glyph]):
            if op1 != op2 or len(args1) != len(args2):
                raise ValueError('Static serialization changed outline commands.')
            for point1, point2 in zip(args1, args2):
                if point1 is None or point2 is None:
                    if point1 != point2:
                        raise ValueError('Static serialization changed a contour terminator.')
                    continue
                max_delta = max(max_delta, *(abs(a-b) for a, b in zip(point1, point2)))
    if max_delta > 1.01:
        raise ValueError(f'Unexpected static glyph-coordinate rounding: {max_delta}')
    return {'maximumCoordinateDifferenceInFontUnits': max_delta,
            'glyphsWithRequiredIntegerRounding': changed,
            'explanation': 'Variable interpolation can produce fractional coordinates. Standard static TrueType serialization rounds to native integer design units; outline topology is preserved.'}


def verify(expected, saved, source_path, target_path, family, weight, operation):
    outlines_before = outline_data(expected)
    outlines_after = outline_data(saved)
    metrics_before = metric_data(expected)
    metrics_after = metric_data(saved)
    checks = {
        'glyphOrderUnchanged': expected.getGlyphOrder() == saved.getGlyphOrder(),
        'glyphOutlinesUnchanged': outlines_before == outlines_after,
        'horizontalAndVerticalMetricsUnchanged': metrics_before == metrics_after,
        'characterMapUnchanged': expected.getBestCmap() == saved.getBestCmap(),
        'embeddingPermissionFlagsUnchanged': expected['OS/2'].fsType == saved['OS/2'].fsType,
        'staticFont': 'fvar' not in saved and 'gvar' not in saved,
    }
    # Layout features remain identical after static instancing/container decode.
    shaping = {}
    for tag in ('GSUB', 'GPOS', 'GDEF', 'kern'):
        shaping[tag] = ((tag not in expected and tag not in saved) or
            (tag in expected and tag in saved and
             expected.getTableData(tag) == saved.getTableData(tag)))
    checks['shapingTablesUnchanged'] = all(shaping.values())
    if not all(checks.values()):
        raise ValueError(f'{target_path.name}: font fidelity failed: {checks}')
    return {'family': family, 'style': 'Bold' if weight == 700 else 'Regular',
        'weight': weight, 'file': target_path.name, 'sha256': sha(target_path),
        'source': str(source_path.relative_to(SLIDES)), 'sourceSha256': sha(source_path),
        'operation': operation, 'embeddingFsType': saved['OS/2'].fsType,
        'glyphCount': saved['maxp'].numGlyphs,
        'characterMapEntries': len(saved.getBestCmap()),
        'outlinesSha256': semantic_hash(outlines_after),
        'metricsSha256': semantic_hash(metrics_after),
        'metrics': {key: value for key, value in metrics_after.items() if key != 'advances'},
        'checks': checks, 'shapingTableChecks': shaping}


def make_manrope(weight):
    source_path = SOURCES / 'Manrope.woff2'
    source = open_font(source_path)
    # This source has a wght default of 200 and a legacy ExtraLight family name.
    # Instantiate the selected weight before correcting its static-family names.
    interpolated = instantiateVariableFont(source, {'wght': weight}, inplace=False,
                                            optimize=True, updateFontNames=False)
    fractional_outlines = outline_data(interpolated)
    expected = native_static_roundtrip(interpolated)
    rounding = outline_rounding(fractional_outlines, outline_data(expected))
    target = instantiateVariableFont(open_font(source_path), {'wght': weight},
                                     inplace=False, optimize=True, updateFontNames=False)
    names_for_static_manrope(target, weight)
    target.flavor = None
    target_path = OUTPUT / f'Manrope-{"Bold" if weight == 700 else "Regular"}.ttf'
    target.save(target_path, reorderTables=False)
    saved = open_font(target_path)
    for name_id in (1, 16):
        if saved['name'].getDebugName(name_id) != 'Manrope':
            raise ValueError('Static Manrope family metadata is incorrect.')
    entry = verify(expected, saved, source_path, target_path, 'Manrope', weight,
        f'Static instance at wght={weight}; family/style metadata corrected for native Office selection.')
    entry['license'] = 'manrope-OFL.txt'
    entry['fidelityReference'] = f'The original variable source instantiated at wght={weight} and serialized as standard TrueType; no subsequent outline, advance, cmap or shaping changes.'
    entry['staticSerializationRounding'] = rounding
    return entry


def make_ibm():
    source_path = SOURCES / 'IBMPlexMono.woff2'
    expected = open_font(source_path)
    target = open_font(source_path)
    target.flavor = None
    target_path = OUTPUT / 'IBMPlexMono-Regular.ttf'
    target.save(target_path, reorderTables=False)
    saved = open_font(target_path)
    if expected.getTableData('name') != saved.getTableData('name'):
        raise ValueError('IBM font names and license metadata must be unchanged.')
    entry = verify(expected, saved, source_path, target_path, 'IBM Plex Mono', 400,
        'Lossless WOFF2 container decoding to TrueType; font names, design, data and permission flags preserved.')
    # head.checkSumAdjustment depends on the outer font container.  All other
    # reconstructed table bytes must remain identical during container decoding.
    table_checks = {tag: expected.getTableData(tag) == saved.getTableData(tag)
                    for tag in expected.keys() if tag not in ('GlyphOrder', 'head')}
    entry['reconstructedTableChecks'] = table_checks
    if not all(table_checks.values()):
        raise ValueError(f'IBM font data changed during WOFF2 decode: {table_checks}')
    entry['license'] = 'ibmplexmono-OFL.txt'
    entry['fidelityReference'] = 'Original bundled WOFF2 font data, with all reconstructed tables except container checksum adjustment compared byte for byte.'
    return entry


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    fonts = [make_manrope(400), make_manrope(700), make_ibm()]
    licenses = []
    for name in ('manrope-OFL.txt', 'ibmplexmono-OFL.txt'):
        copyfile(SOURCES / name, OUTPUT / name)
        licenses.append({'file': name, 'sha256': sha(OUTPUT / name),
                         'source': str((SOURCES / name).relative_to(SLIDES)),
                         'copiedWithoutChanges': True})
    manifest = {'purpose': 'Open font companions for the native editable v5 slides',
        'installedGlobally': False, 'sourceFontFilesChanged': False,
        'fonts': fonts, 'licenses': licenses,
        'excludedFont': {'family': 'Salesforce Sans',
            'reason': 'The supplied fonts declare OS/2.fsType=4 (preview-and-print embedding). They are not embedded for editing, converted, or redistributed by this pack. Use a separately licensed installation.',
            'permissionFlagsChanged': False},
        'coverage': 'These are the existing bundled Latin subsets. They preserve their original character coverage and do not add other scripts or symbols.',
        'generator': 'docs/slides/src/prepare-editable-v5-fonts.py',
        'generatorSha256': sha(Path(__file__)),
        'passed': all(all(font['checks'].values()) for font in fonts)}
    (OUTPUT/'manifest.json').write_text(json.dumps(manifest, indent=2,
                                                  ensure_ascii=False)+'\n')
    (OUTPUT/'README.md').write_text('''This folder contains the open-font companions for the editable version 05 slides. No fonts have been installed on your computer.

- `Manrope-Regular.ttf` and `Manrope-Bold.ttf` are static 400/700 instances of the bundled Manrope variable font. Their family name is **Manrope**, so PowerPoint can select the intended weight without the source font’s legacy “ExtraLight” family name.
- `IBMPlexMono-Regular.ttf` contains the original **IBM Plex Mono** font decoded from its WOFF2 container. Its names, outlines, metrics, shaping tables and permission flags are unchanged.

Both licenses are included unchanged. These files retain the character coverage of the existing Latin subsets; additional languages or symbols may require an appropriate font installed separately. The [manifest](manifest.json) records source and output hashes and verifies the glyph outlines, advances, character maps and line metrics. Manrope is compared with the source variable font instantiated at the matching weight.

**Salesforce Sans is not included.** Use your separately licensed Salesforce Sans Regular and Bold installation to retain the body typography. The supplied Salesforce fonts declare `OS/2.fsType=4`, which permits preview-and-print embedding rather than editable embedding; this pack does not change that setting or redistribute those fonts. Manrope remains the presentation’s documented heading substitute for the reference template’s Avant Garde Demi SFDC.

To make the open fonts available in PowerPoint, install these TTF files through your operating system’s font manager and reopen PowerPoint. That is a user action; this repository has not installed them. If you already have an appropriate Manrope and IBM Plex Mono installation, use that installation and avoid duplicate faces.

See [the editing guide](../../EDITING-V5.md) for the presentation’s object structure and a short editing exercise.
''')
    archive = OUTPUT.with_suffix('.zip')
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as zipped:
        for path in sorted(OUTPUT.iterdir()):
            if path.is_file():
                zipped.write(path, arcname=OUTPUT.name+'/'+path.name)
    print(json.dumps({'directory': str(OUTPUT), 'archive': str(archive),
                      'fonts': [font['file'] for font in fonts],
                      'passed': manifest['passed'], 'installedGlobally': False}, indent=2))


if __name__ == '__main__':
    main()
