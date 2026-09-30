#!/usr/bin/env python3
"""Rebuild every slide as native, named PowerPoint text and drawing objects.

The source layout is measured from the frozen HTML. Original source SVGs become
DrawingML geometry, never pictures; Unicode text stays native throughout. The
previous package supplies its notes, links, masters and slide order. Always
build a new candidate and validate it before replacing a user-facing artifact.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED

from svg_to_editable import convert_svg, encode_drawing

A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'
CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
for prefix, ns in [('a', A), ('p', P), ('r', R)]:
    ET.register_namespace(prefix, ns)
NS = {'a': A, 'p': P, 'r': R}
EMU = 6350
DISCLOSURE = (
    'All 36 slides use native PowerPoint text, shapes and named groups. '
    'Titles, paragraphs, code, labels, chart parts and illustration geometry '
    'can be edited, recolored, copied and rearranged. Select a group, then '
    'select its child or ungroup it to customize a part. Source links move '
    'with their native text. Connectors are editable geometry and do not '
    'automatically reconnect. Speaker notes remain editable. The companion '
    'HTML retains the interactive teaching examples. For the intended '
    'typography, install Salesforce Sans, Manrope and IBM Plex Mono.'
)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def sub(parent, ns, tag, attrs=None, text=None):
    e = ET.SubElement(parent, f'{{{ns}}}{tag}', {k: str(v) for k, v in (attrs or {}).items()})
    if text is not None:
        e.text = text
    return e


def emu(value):
    return round(float(value) * EMU)


def box_union(boxes):
    xs = [b['x'] for b in boxes]; ys = [b['y'] for b in boxes]
    rs = [b['x'] + b['w'] for b in boxes]; bs = [b['y'] + b['h'] for b in boxes]
    return {'x': min(xs), 'y': min(ys), 'w': max(rs) - min(xs), 'h': max(bs) - min(ys)}


def color(parent, value, opacity=1):
    rgb = sub(parent, A, 'srgbClr', {'val': value.get('hex', value.get('color', '000000'))})
    alpha = max(0, min(1, value.get('alpha', 1) * opacity))
    if alpha < 1:
        sub(rgb, A, 'alpha', {'val': round(alpha * 100000)})


def fill(parent, value, opacity=1):
    if not value or value.get('alpha', 1) * opacity <= 0:
        sub(parent, A, 'noFill')
    else:
        color(sub(parent, A, 'solidFill'), value, opacity)


def xfrm(parent, box):
    f = sub(parent, A, 'xfrm')
    sub(f, A, 'off', {'x': emu(box['x']), 'y': emu(box['y'])})
    sub(f, A, 'ext', {'cx': max(1, emu(box['w'])), 'cy': max(1, emu(box['h']))})
    return f


def shifted(element):
    """Flatten only the actually used, fully inspected CSS translations."""
    e = copy.deepcopy(element)
    dx = dy = 0
    for matrix in e.get('transforms', []):
        if len(matrix) != 6 or any(abs(a - b) > 1e-7 for a, b in zip(matrix[:4], [1, 0, 0, 1])):
            raise ValueError(f"Unsupported transform on {e['id']}: {matrix}")
        dx += matrix[4]; dy += matrix[5]
    if dx or dy:
        def shift_box(b):
            if b:
                b['x'] += dx; b['y'] += dy
        for name in ('box', 'borderBox', 'contentBox'):
            shift_box(e.get(name))
        for line in e.get('lines', []):
            shift_box(line['box'])
            line['baseline'] += dy
            line['absoluteBaseline'] = line['baseline']
            for run in line['runs']:
                shift_box(run['box']); shift_box(run.get('inkBox'))
                run['baseline'] += dy; run['absoluteBaseline'] = run['baseline']
        if e['type'] == 'line':
            e['start'] = [e['start'][0] + dx, e['start'][1] + dy]
            e['end'] = [e['end'][0] + dx, e['end'][1] + dy]
    e['transforms'] = []
    return e


def rounded_geometry(parent, box, radii):
    w, h = box['w'], box['h']
    radii = [[min(float(rx), w / 2), min(float(ry), h / 2)] for rx, ry in radii]
    if not any(rx or ry for rx, ry in radii):
        sub(sub(parent, A, 'prstGeom', {'prst': 'rect'}), A, 'avLst'); return
    if all(abs(rx - w / 2) < .01 and abs(ry - h / 2) < .01 for rx, ry in radii):
        sub(sub(parent, A, 'prstGeom', {'prst': 'ellipse'}), A, 'avLst'); return
    if all(abs(rx - radii[0][0]) < .01 and abs(ry - radii[0][1]) < .01 for rx, ry in radii) and abs(radii[0][0] - radii[0][1]) < .01:
        geom = sub(parent, A, 'prstGeom', {'prst': 'roundRect'})
        av = sub(geom, A, 'avLst')
        sub(av, A, 'gd', {'name': 'adj', 'fmla': f'val {round(radii[0][0] / min(w, h) * 100000)}'})
        return
    tl, tr, br, bl = radii
    geom = sub(parent, A, 'custGeom')
    for t in ('avLst', 'gdLst', 'ahLst', 'cxnLst'):
        sub(geom, A, t)
    sub(geom, A, 'rect', {'l': '0', 't': '0', 'r': 'r', 'b': 'b'})
    path = sub(sub(geom, A, 'pathLst'), A, 'path', {'w': max(1, emu(w)), 'h': max(1, emu(h)), 'fill': 'norm', 'stroke': '1', 'extrusionOk': '0'})
    # Cubic circular corners use the same quarter-circle approximation as SVG.
    k = .5522847498307936
    commands = [('moveTo', [tl[0], 0]), ('lnTo', [w-tr[0], 0]),
        ('cubicBezTo', [w-tr[0]+k*tr[0], 0, w, tr[1]-k*tr[1], w, tr[1]]),
        ('lnTo', [w, h-br[1]]), ('cubicBezTo', [w, h-br[1]+k*br[1], w-br[0]+k*br[0], h, w-br[0], h]),
        ('lnTo', [bl[0], h]), ('cubicBezTo', [bl[0]-k*bl[0], h, 0, h-bl[1]+k*bl[1], 0, h-bl[1]]),
        ('lnTo', [0, tl[1]]), ('cubicBezTo', [0, tl[1]-k*tl[1], tl[0]-k*tl[0], 0, tl[0], 0])]
    for kind, points in commands:
        node = sub(path, A, kind)
        for j in range(0, len(points), 2):
            sub(node, A, 'pt', {'x': emu(points[j]), 'y': emu(points[j + 1])})
    sub(path, A, 'close')


class Builder:
    def __init__(self, slide, relations, folder):
        self.slide = slide; self.relations = relations; self.folder = folder
        self.next_id = 1000; self.audit = {'index': slide['index'], 'id': slide['id'], 'title': slide['title'], 'elements': [], 'vectors': [], 'groups': [], 'clipAdaptations': [], 'nativeTextBoxes': 0, 'nativeShapes': 0}
        self.links = [r for r in relations if r.get('Type', '').endswith('/hyperlink')]
        self.used_links = set()

    def ident(self):
        value = self.next_id; self.next_id += 1; return value

    def shell(self, name, box, text=False, descr=None):
        shape = ET.Element(f'{{{P}}}sp'); nv = sub(shape, P, 'nvSpPr'); ident = self.ident()
        attrs = {'id': ident, 'name': name}
        if descr:
            attrs['descr'] = descr
        sub(nv, P, 'cNvPr', attrs); sub(nv, P, 'cNvSpPr', {'txBox': '1'} if text else {}); sub(nv, P, 'nvPr')
        prop = sub(shape, P, 'spPr'); xfrm(prop, box)
        return shape, prop, ident

    def name(self, e, suffix=''):
        source = e.get('source', {})
        role = source.get('data-edit-id') or ' '.join(source.get('classes', [])) or source.get('tag') or e['type']
        text = re.sub(r'\s+', ' ', e.get('text', ''))[:78]
        return f"{self.slide['index']:02} · {role}{': ' + text if text else ''}{suffix} [{e['id']}]"

    def line(self, name, start, end, spec, opacity=1):
        x, y = min(start[0], end[0]), min(start[1], end[1])
        box = {'x': x, 'y': y, 'w': max(.001, abs(end[0] - start[0])), 'h': max(.001, abs(end[1] - start[1]))}
        shape, prop, ident = self.shell(name, box)
        geom = sub(prop, A, 'custGeom')
        for t in ('avLst', 'gdLst', 'ahLst', 'cxnLst'):
            sub(geom, A, t)
        sub(geom, A, 'rect', {'l': '0', 't': '0', 'r': 'r', 'b': 'b'})
        p = sub(sub(geom, A, 'pathLst'), A, 'path', {'w': max(1, emu(box['w'])), 'h': max(1, emu(box['h'])), 'fill': 'none', 'stroke': '1'})
        for tag, pt in [('moveTo', start), ('lnTo', end)]:
            sub(sub(p, A, tag), A, 'pt', {'x': emu(pt[0] - x), 'y': emu(pt[1] - y)})
        sub(prop, A, 'noFill')
        ln = sub(prop, A, 'ln', {'w': max(1, emu(spec['width'])), 'cap': 'flat'})
        fill(ln, spec['color'], opacity)
        style = spec.get('style', 'solid')
        if style not in ('solid', 'dashed', 'dotted'):
            raise ValueError('Unsupported CSS line style: ' + style)
        sub(ln, A, 'prstDash', {'val': {'solid': 'solid', 'dashed': 'dash', 'dotted': 'dot'}[style]})
        self.audit['nativeShapes'] += 1
        return shape, box, ident

    def shapes(self, e):
        out = []; b = e['box']; opacity = e['opacity']
        if e.get('fill') and e['fill'].get('alpha', 1) > 0 or e.get('backgroundLayers'):
            shape, prop, ident = self.shell(self.name(e, ' · surface'), b)
            rounded_geometry(prop, b, e.get('radii', [[0, 0]] * 4))
            layers = e.get('backgroundLayers', [])
            if layers:
                if len(layers) != 1 or layers[0]['type'] != 'linearGradient' or layers[0].get('repeating'):
                    raise ValueError('Only verified simple gradients are supported: ' + e['id'])
                layer = layers[0]
                grad = sub(prop, A, 'gradFill', {'rotWithShape': '1'})
                stops = sub(grad, A, 'gsLst')
                for stop, c in zip(layer['stopPositions'], layer['colors']):
                    color(sub(stops, A, 'gs', {'pos': round(stop * 100000)}), c, opacity)
                # CSS 0deg points upward; DrawingML 0deg points right.
                angle = (math.degrees(layer['direction']) - 90) % 360
                sub(grad, A, 'lin', {'ang': round(angle * 60000), 'scaled': '0'})
            else:
                fill(prop, e.get('fill'), opacity)
            sub(sub(prop, A, 'ln'), A, 'noFill')
            out.append((shape, b, ident)); self.audit['nativeShapes'] += 1
        borders = e.get('borders', {})
        if borders:
            values = list(borders.values())
            uniform = len(values) == 4 and all(v == values[0] for v in values)
            if uniform:
                spec = values[0]; width = spec['width']
                box = {'x': b['x'] + width / 2, 'y': b['y'] + width / 2, 'w': b['w'] - width, 'h': b['h'] - width}
                shape, prop, ident = self.shell(self.name(e, ' · outline'), box)
                radii = [[max(0, rx-width/2), max(0, ry-width/2)] for rx, ry in e.get('radii', [[0,0]]*4)]
                rounded_geometry(prop, box, radii); sub(prop, A, 'noFill')
                ln = sub(prop, A, 'ln', {'w': emu(width), 'algn': 'ctr'}); fill(ln, spec['color'], opacity)
                sub(ln, A, 'prstDash', {'val': {'solid': 'solid', 'dashed': 'dash', 'dotted': 'dot'}[spec['style']]})
                out.append((shape, box, ident)); self.audit['nativeShapes'] += 1
            else:
                for side, spec in borders.items():
                    w = spec['width']; x, y = b['x'], b['y']; right = x+b['w']; bottom = y+b['h']
                    endpoints = {'top': ([x, y+w/2], [right, y+w/2]), 'bottom': ([x, bottom-w/2], [right, bottom-w/2]),
                        'left': ([x+w/2, y], [x+w/2, bottom]), 'right': ([right-w/2, y], [right-w/2, bottom])}
                    out.append(self.line(self.name(e, ' · '+side+' border'), *endpoints[side], spec, opacity))
        return out

    def link(self, run):
        url = run.get('hyperlink')
        if not url or not url.startswith(('https://', 'http://')):
            return None
        candidates = [r for r in self.links if r['Target'] == url]
        if not candidates:
            raise ValueError('Native text hyperlink is missing from original package: ' + url)
        # A URL may have several original hit regions (wrapped text). Prefer an
        # unused original relationship while preserving every original target.
        selected = next((r for r in candidates if r['Id'] not in self.used_links), candidates[0])
        self.used_links.add(selected['Id']); return selected['Id']

    def rpr(self, parent, run, tag='rPr', linked=True):
        fs = run['fontSize']; spacing = run.get('letterSpacing', 0)
        spacing = spacing if isinstance(spacing, (int, float)) else 0
        attrs = {'lang': 'en-US', 'sz': max(100, round(fs * 50)), 'b': int(run['fontWeight'] >= 600),
            'i': int(run['fontStyle'] == 'italic'), 'kern': '0', 'spc': round(spacing * 50), 'dirty': '0'}
        if 'underline' in run.get('textDecoration', ''):
            attrs['u'] = 'sng'
        p = sub(parent, A, tag, attrs)
        fill(p, run['color'], run.get('opacity', 1))
        family = run['fontFamily'][0]
        family = {'Plex': 'IBM Plex Mono', 'IBMPlexMono': 'IBM Plex Mono'}.get(family, family)
        for t in ('latin', 'ea', 'cs'):
            sub(p, A, t, {'typeface': family})
        if linked:
            rid = self.link(run)
            if rid:
                sub(p, A, 'hlinkClick', {f'{{{R}}}id': rid, 'tooltip': run.get('text', '')})
        return p

    def text(self, e):
        lines = e['lines']; first = lines[0]
        if not lines or not any(line['runs'] for line in lines):
            raise ValueError('Empty native text block: ' + e['id'])
        box = dict(e['box'])
        # Office starts a top-anchored body at font ascent. Put the first
        # baseline at the Pango baseline; paragraph spacing retains later ones.
        ascent = max(r.get('logicalAscent', r['fontSize']) for r in first['runs'])
        box['y'] = first['baseline'] - ascent
        bottom = max(line['baseline'] + max(r.get('logicalDescent', r['fontSize']*.3) for r in line['runs']) for line in lines)
        box['h'] = max(box['h'], bottom-box['y']) + 1
        # A two-pixel editing allowance avoids needless wrap at rounding edges.
        box['w'] = max(box['w'], max(line['box']['w'] for line in lines)) + 2
        if box['x'] + box['w'] > 1920:
            box['w'] = 1920-box['x']
        shape, prop, ident = self.shell(self.name(e), box, True, 'Native editable Unicode text; authored line breaks retained.')
        sub(sub(prop, A, 'prstGeom', {'prst': 'rect'}), A, 'avLst')
        sub(prop, A, 'noFill'); sub(sub(prop, A, 'ln'), A, 'noFill')
        body = sub(shape, P, 'txBody')
        bp = sub(body, A, 'bodyPr', {'wrap': 'none', 'lIns': '0', 'rIns': '0', 'tIns': '0', 'bIns': '0', 'anchor': 't', 'anchorCtr': '0', 'vertOverflow': 'overflow', 'horzOverflow': 'overflow', 'spcFirstLastPara': '0'})
        sub(bp, A, 'noAutofit'); sub(body, A, 'lstStyle')
        for index, line in enumerate(lines):
            p = sub(body, A, 'p')
            # Each rendered line is one paragraph in the same coherent box.
            # Its left indent retains inline/block layout without word boxes.
            left = max(0, line['runs'][0]['box']['x']-box['x'])
            # Each authored line is a separate paragraph. Keep its paragraph
            # margin at zero and place the first character with first-line
            # indent, so custom tab stops are unambiguously body-relative.
            pp = sub(p, A, 'pPr', {'marL': '0', 'marR': '0', 'indent': emu(left), 'algn': 'l', 'fontAlgn': 'base'})
            step = (lines[index+1]['baseline']-line['baseline']) if index+1 < len(lines) else line['box']['h']
            sub(sub(pp, A, 'lnSpc'), A, 'spcPts', {'val': max(1, round(step*50))})
            for t in ('spcBef', 'spcAft'):
                sub(sub(pp, A, t), A, 'spcPts', {'val': '0'})
            sub(pp, A, 'buNone')
            gaps = {}
            for j, (previous, following) in enumerate(zip(line['runs'], line['runs'][1:]), 1):
                gap = following['box']['x'] - previous['box']['x'] - previous['box']['w']
                if gap > .5:
                    gaps[j] = max(0, following['box']['x'] - box['x'])
                elif gap < -.5:
                    raise ValueError(f"Overlapping inline runs need explicit handling: {e['id']}")
            if gaps:
                tabs = sub(pp, A, 'tabLst')
                for pos in sorted(set(gaps.values())):
                    sub(tabs, A, 'tab', {'pos': emu(pos), 'algn': 'l'})
            for j, run in enumerate(line['runs']):
                if j in gaps:
                    spacer = sub(p, A, 'r'); self.rpr(spacer, line['runs'][j-1], linked=False)
                    sub(spacer, A, 't', {'{http://www.w3.org/XML/1998/namespace}space': 'preserve'}, '\t')
                r = sub(p, A, 'r'); self.rpr(r, run)
                t = sub(r, A, 't', text=run['text'])
                if run['text'] != run['text'].strip():
                    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
            self.rpr(p, line['runs'][-1], 'endParaRPr', False)
        self.audit['nativeTextBoxes'] += 1
        return shape, box, ident

    def vector(self, e):
        path = self.folder / e['asset']
        if sha(path) != e['sourceSha256']:
            raise ValueError('A source drawing changed: '+str(path))
        drawing = convert_svg(path.read_text(), current_color='#'+e['color']['hex'], name=self.name(e, ' · drawing'))
        placement = e['box']
        opacity = e.get('opacity', 1)
        def visit(items):
            for item in items:
                if item['kind'] == 'group':
                    visit(item['children'])
                else:
                    for k in ('fill', 'stroke'):
                        if item.get(k): item[k]['alpha'] = item[k].get('alpha', 1)*opacity
        visit(drawing['elements'])
        # The return panels have a rounded CSS viewport, and their only ink in
        # its corner regions is their canvas rectangle. Round that editable
        # rectangle itself instead of introducing a raster mask or overlay.
        clips = [c for c in e.get('clips', []) if any(any(r) for r in c.get('radii', []))]
        if clips:
            clip = clips[-1]
            if clip['box'] != placement:
                raise ValueError('Unsupported displaced rounded SVG clip: '+e['id'])
            vx, vy, vw, vh = drawing['viewBox']
            candidates = []
            def canvases(items):
                for item in items:
                    if item['kind'] == 'group': canvases(item['children'])
                    elif item.get('primitive', {}).get('shape') == 'rect' and all(abs(a-b)<.01 for a,b in zip(item['bbox'],[vx,vy,vw,vh])):
                        candidates.append(item)
            canvases(drawing['elements'])
            if len(candidates) != 1:
                raise ValueError('Rounded panel requires one identifiable native canvas: '+e['id'])
            item = candidates[0]; radius = clip['radii'][0][0] * vw/placement['w']
            item['primitive'].update(shape='roundRect',rx=radius,ry=radius)
            from svg_to_editable import rect_commands
            item['commands'] = rect_commands(vx,vy,vw,vh,radius,radius)
            self.audit['clipAdaptations'].append({'element':e['id'],'method':'Round only the native panel canvas; foreground lies within its rounded inset.','radius':radius})
        xml, self.next_id, audit = encode_drawing(drawing, placement, self.next_id, EMU)
        self.audit['vectors'].append({'element':e['id'],'asset':e['asset'],**audit})
        self.audit['nativeShapes'] += audit['nativeShapes']; self.audit['nativeTextBoxes'] += audit['nativeTextBoxes']
        group = ET.fromstring(xml)
        ident = int(group.find('p:nvGrpSpPr/p:cNvPr', NS).get('id'))
        return group, placement, ident

    def group(self, members, name, source):
        box = box_union([b for _, b, _ in members]); group = ET.Element(f'{{{P}}}grpSp')
        nv = sub(group, P, 'nvGrpSpPr'); ident = self.ident()
        sub(nv, P, 'cNvPr', {'id': ident, 'name': name}); sub(nv, P, 'cNvGrpSpPr'); sub(nv, P, 'nvPr')
        prop = sub(group, P, 'grpSpPr'); xf = xfrm(prop, box)
        sub(xf, A, 'chOff', {'x': emu(box['x']), 'y': emu(box['y'])})
        sub(xf, A, 'chExt', {'cx': max(1, emu(box['w'])), 'cy': max(1, emu(box['h']))})
        for element, _, _ in members:
            group.append(element)
        self.audit['groups'].append({'id':ident, 'name':name,'source':source,'children':[i for _,_,i in members]})
        return group, box, ident

    def build(self):
        group_classes = {'node','card','brief-card','stat','sample','ledger-row','tl-h-node','stack-block','pill','step','source-line','deck-head','chrome-min','formula','quote','callout'}
        groups = [g for g in self.slide['groups'] if len(g['elementIds']) > 1 and (set(g['classes']) & group_classes or g['tag'] == 'p')]
        ownership = {}
        for g in sorted(groups, key=lambda g:len(g['id'])):
            for eid in g['elementIds']:
                ownership[eid] = g
        entries = []
        for raw in self.slide['elements']:
            e = shifted(raw)
            if e['source'].get('tag') == 'body' or 'deck-viewport' in e['source'].get('classes', []):
                continue  # Redundant white HTML shell beneath the slide canvas.
            if e['type'] == 'shape': parts = self.shapes(e)
            elif e['type'] == 'line': parts = [self.line(self.name(e),e['start'],e['end'],e['line'],e['opacity'])]
            elif e['type'] == 'text': parts = [self.text(e)]
            elif e['type'] == 'svg': parts = [self.vector(e)]
            else: raise ValueError('Unsupported native element: '+e['type'])
            self.audit['elements'].append({'id':e['id'],'type':e['type'],'shapeIds':[p[2] for p in parts],'sourceBox':e['box'],'text':e.get('text')})
            entries.append({'element':e,'parts':parts,'group':ownership.get(e['id'])})
        # Group only contiguous semantic units; keep the exact painting order.
        output = []; index = 0
        while index < len(entries):
            entry = entries[index]; g = entry['group']; members = list(entry['parts']); end = index + 1
            if g:
                while end < len(entries) and entries[end]['group'] and entries[end]['group']['id'] == g['id']:
                    members.extend(entries[end]['parts']); end += 1
            if g and len(members)>1:
                role = ' '.join(g['classes']) or g['tag']
                title = next((r['element'].get('text','') for r in entries[index:end] if r['element']['type']=='text'), '')
                title = re.sub(r'\s+',' ',title)[:75]
                output.append(self.group(members,f"{self.slide['index']:02} · {role}: {title}",g['id'])[0])
            else:
                output.extend(node for node,_,_ in members)
            index = end
        unused = [r['Id'] for r in self.links if r['Id'] not in self.used_links]
        if unused:
            raise ValueError(f"Slide {self.slide['index']} has source links without editable labels: {unused}")
        self.audit['sourceLinkCount'] = len(self.links)
        return output, self.audit


def rewrite_notes(raw):
    root = ET.fromstring(raw)
    changes = []
    for t in root.findall('.//a:t', NS):
        old = t.text or ''
        match = re.search(r'(?<=POWERPOINT EXPORT\n\n)(?:COMPONENT POWERPOINT\n\n)?(?:This edition preserves|This slide uses)[\s\S]*?(?=\n\n|$)', old)
        if match:
            old_disclosure = match.group(0)
            t.text = old.replace(old_disclosure, DISCLOSURE, 1)
            changes.append({'before':old_disclosure,'after':DISCLOSURE})
        before = 'Labels are outlined vector artwork. The source SVG assets keep editable source text; speaker notes remain editable PowerPoint text.'
        after = 'Labels, calendars and shipping values are native editable PowerPoint text. Illustration parts are native shapes; speaker notes remain editable text.'
        if before in (t.text or ''):
            t.text = t.text.replace(before, after)
            changes.append({'before':before,'after':after})
    if not any(DISCLOSURE in (t.text or '') for t in root.findall('.//a:t',NS)):
        raise ValueError('Original note export disclosure was not recognized')
    return ET.tostring(root, encoding='utf-8', xml_declaration=True), changes


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('base'); p.add_argument('manifest'); p.add_argument('output')
    args = p.parse_args(); base = Path(args.base).resolve(); manifest_path = Path(args.manifest).resolve(); out = Path(args.output).resolve()
    if out.exists() or out == base or out.suffix != '.pptx':
        raise ValueError('Use a new .pptx candidate output; never overwrite inputs while building.')
    data = json.loads(manifest_path.read_text()); folder = manifest_path.parent
    for provenance in data['inputProvenance']:
        if sha(folder / provenance['path']) != provenance['sha256']:
            raise ValueError('An extraction input changed: '+provenance['role'])
    if data.get('warnings') or data.get('blockedRemoteRequests'):
        raise ValueError('Resolve layout warnings and external dependencies first.')
    with ZipFile(base) as z:
        files = {name:z.read(name) for name in z.namelist() if not name.endswith('/')}
    report = {'method':'Native DrawingML text, shapes and named semantic groups; no slide pictures.', 'base':str(base), 'baseSha256':sha(base), 'manifest':str(manifest_path), 'manifestSha256':sha(manifest_path), 'slides':[], 'notesChanges':[], 'nativeOfficeRendered':False}
    for slide in data['slides']:
        index = slide['index']; name = f'ppt/slides/slide{index}.xml'; relname = f'ppt/slides/_rels/slide{index}.xml.rels'
        root = ET.fromstring(files[name]); relroot = ET.fromstring(files[relname])
        rels = [dict(r.attrib) for r in relroot]
        nodes, audit = Builder(slide, rels, folder).build()
        tree = root.find('p:cSld/p:spTree', NS)
        for child in list(tree):
            if child.tag not in (f'{{{P}}}nvGrpSpPr',f'{{{P}}}grpSpPr'):
                tree.remove(child)
        for node in nodes: tree.append(node)
        root.find('p:cSld',NS).set('name',slide['title'])
        files[name] = ET.tostring(root,encoding='utf-8',xml_declaration=True)
        for rel in list(relroot):
            if rel.get('Type','').endswith('/image'): relroot.remove(rel)
        files[relname] = ET.tostring(relroot,encoding='utf-8',xml_declaration=True)
        note = f'ppt/notesSlides/notesSlide{index}.xml'
        files[note], changes = rewrite_notes(files[note])
        report['notesChanges'].append({'index':index,'changes':changes})
        report['slides'].append(audit)
    # Remove unreachable prior artwork; no image assets are required by native
    # slides. This also prevents hidden/duplicated flattened artwork lingering.
    removed = [n for n in files if n.startswith('ppt/media/')]
    for name in removed: del files[name]
    types = ET.fromstring(files['[Content_Types].xml'])
    for child in list(types):
        if child.get('PartName','').lstrip('/') in removed: types.remove(child)
    files['[Content_Types].xml'] = ET.tostring(types,encoding='utf-8',xml_declaration=True)
    for name in list(files):
        if name.startswith('ppt/theme/') and name.endswith('.xml'):
            theme = ET.fromstring(files[name])
            for role, family in [('majorFont','Manrope'),('minorFont','Salesforce Sans')]:
                latin = theme.find(f'.//a:{role}/a:latin',NS)
                if latin is not None: latin.set('typeface',family)
            files[name] = ET.tostring(theme,encoding='utf-8',xml_declaration=True)
    out.parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(out,'w',ZIP_DEFLATED,compresslevel=9) as z:
        for name, content in files.items(): z.writestr(name,content)
    report.update(output=str(out),outputSha256=sha(out),bytes=out.stat().st_size,slideCount=len(report['slides']),removedArtworkMembers=len(removed))
    report['totals'] = {key:sum(s[key] for s in report['slides']) for key in ['nativeTextBoxes','nativeShapes','sourceLinkCount']}
    report['totals']['nativeGroups'] = sum(len(s['groups'])+sum(v['nativeGroups'] for v in s['vectors']) for s in report['slides'])
    (folder/'native-build-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({k:report[k] for k in ['slideCount','totals','bytes','output','outputSha256']},indent=2))


if __name__ == '__main__':
    main()
