#!/usr/bin/env python3
"""Extract the painted v5 slide layout as editable PowerPoint primitives.

This is a layout extractor, not an image-to-shape tracer.  It uses the original
HTML, CSS and SVG sources, and observes WeasyPrint's actual drawing order.  Text
is retained as Unicode rich-text blocks with measured lines and runs; no glyph
outline is substituted for a paragraph.  The page coordinate system is the
authored 1920 x 1080 CSS-pixel canvas.

Run with the repository's documented local WeasyPrint/Pango environment.  The
result records every source hash, DOM ancestry, clip and transform so that the
PowerPoint builder can reject unsupported geometry rather than hide it.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import re
from urllib.parse import unquote_to_bytes, urlparse
from xml.etree import ElementTree as ET

from weasyprint import CSS, HTML, default_url_fetcher
import weasyprint.document as document_module
import weasyprint.draw as draw_module
from weasyprint.draw.color import get_color
from weasyprint.formatting_structure import boxes
from weasyprint.layout.replaced import replacedbox_layout
from weasyprint.text.ffi import ffi, pango, FROM_UNITS


ROOT = Path(__file__).resolve().parents[3]
SEMANTIC_CLASSES = {
    'node', 'card', 'brief-card', 'half', 'stack-block', 'tl-h-node', 'pill',
    'sample', 'stat', 'diagram', 'mini-visual', 'deck-head', 'chrome-min',
    'source-line', 'trace-event-line', 'step', 'cost-bar-row', 'formula',
    'callout', 'quote', 'checklist', 'ledger-row', 'contract-fallbacks',
}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def rnd(value):
    return round(float(value), 6)


def simple(value):
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        return rnd(value)
    if isinstance(value, dict):
        return {str(k): simple(v) for k, v in value.items()}
    if isinstance(value, (set, frozenset)):
        return sorted(simple(v) for v in value)
    if isinstance(value, (tuple, list)):
        if hasattr(value, 'unit'):
            return {'value': rnd(value.value), 'unit': value.unit}
        return [simple(v) for v in value]
    return str(value)


def rgba(value):
    if value is None:
        return None
    color = value.to('srgb')
    channels = [max(0, min(1, float(c))) for c in color[:3]]
    return {'hex': ''.join(f'{round(c * 255):02X}' for c in channels),
            'alpha': rnd(color.alpha), 'srgb': [rnd(c) for c in channels]}


def rect(x, y, w, h):
    return dict(zip(('x', 'y', 'w', 'h'), map(rnd, (x, y, w, h))))


def border_box(box):
    return rect(box.border_box_x(), box.border_box_y(),
                box.border_width(), box.border_height())


def content_box(box):
    return rect(box.content_box_x(), box.content_box_y(), box.width, box.height)


def local_tag(tag):
    return str(tag).split('}')[-1]


def box_children(box):
    """Include absolute placeholders, which descendants() omits by default."""
    if hasattr(box, '_box'):
        box = box._box
    return [child._box if hasattr(child, '_box') else child
            for child in box.all_children()]


class Extractor:
    def __init__(self, html_object, document, source, output):
        self.html_object = html_object
        self.document = document
        self.source = source
        self.output = output
        self.asset_dir = output.parent / 'layout-assets'
        self.asset_dir.mkdir(parents=True, exist_ok=True)
        self.dom = {}
        self.parents = {}
        self.box_info = {}
        self.bg_owners = {}
        self.block_groups = {}
        self.pages = []
        self.page_index = -1
        self.contexts = []
        self.order = 0
        self.table_border_depth = 0
        self.warnings = []
        self.painted_text_ids = []
        self._index_dom(html_object.etree_element, '', [])
        for page_index, page in enumerate(document.pages):
            self._index_boxes(page._page_box, page_index)

    def _index_dom(self, element, path, ancestors):
        tag = local_tag(element.tag)
        if not path:
            path = '/html[1]'
        classes = element.get('class', '').split()
        entry = {'tag': tag, 'classes': classes, 'domPath': path}
        for attr in ('id', 'data-slide-id', 'data-edit-id', 'data-component-asset',
                     'role', 'aria-label', 'alt'):
            if element.get(attr):
                entry[attr] = element.get(attr)
        semantic = bool(set(classes) & SEMANTIC_CLASSES) or tag in {
            'section', 'h1', 'h2', 'h3', 'p', 'pre', 'li', 'td', 'th'}
        entry['semantic'] = semantic
        entry['ancestorPaths'] = [a['domPath'] for a in ancestors]
        entry['semanticAncestors'] = [
            {'domPath': a['domPath'], 'tag': a['tag'], 'classes': a['classes']}
            for a in ancestors if a['semantic']]
        self.dom[id(element)] = entry
        counts = {}
        for child in element:
            child_tag = local_tag(child.tag)
            counts[child_tag] = counts.get(child_tag, 0) + 1
            self.parents[id(child)] = element
            self._index_dom(child, f'{path}/{child_tag}[{counts[child_tag]}]',
                            [*ancestors, entry])

    def source_for(self, box):
        if box.element is not None:
            source = dict(self.dom.get(id(box.element), {}))
        else:
            source = {'tag': 'page', 'classes': [], 'domPath': '/page'}
        source['boxType'] = type(box).__name__
        if box.element_tag and '::' in box.element_tag:
            source['pseudo'] = box.element_tag.split('::', 1)[1]
        return source

    def _index_boxes(self, box, page_index, line=None, owner=None):
        if hasattr(box, '_box'):
            box = box._box
        children = box_children(box)
        if any(isinstance(child, boxes.LineBox) for child in children):
            owner = box
        if isinstance(box, boxes.LineBox):
            line = box
        entry = {'pageIndex': page_index, 'line': line, 'owner': owner, 'box': box}
        self.box_info[id(box)] = entry
        if box.background is not None:
            self.bg_owners[id(box.background)] = box
        if owner is not None:
            self.block_groups[id(owner)] = owner
        for child in children:
            self._index_boxes(child, page_index, line, owner)

    def inherited_state(self):
        opacity = 1.0
        transforms = []
        clips = []
        for context in self.contexts:
            opacity *= context['opacity']
            if context['transform']:
                transforms.append(context['transform'])
            if context['clip']:
                clips.append(context['clip'])
        return {'opacity': rnd(opacity), 'transforms': transforms, 'clips': clips}

    def event(self, value):
        self.order += 1
        value.update({'zOrder': self.order, **self.inherited_state()})
        value['id'] = f'p{self.page_index + 1:02}-e{self.order:04}'
        self.pages[self.page_index]['_events'].append(value)
        return value

    def context(self, box):
        transform = getattr(box, 'transformation_matrix', None)
        clip = None
        if box.style['overflow'] != 'visible' and not isinstance(box, boxes.PageBox):
            values = box.rounded_padding_box()
            clip = {'kind': 'overflow', 'overflow': box.style['overflow'],
                    'box': rect(*values[:4]), 'radii': simple(values[4:]),
                    'source': self.source_for(box)['domPath']}
        if box.is_absolutely_positioned() and box.style['clip']:
            clip = {'kind': 'css-clip', 'values': simple(box.style['clip']),
                    'box': border_box(box), 'source': self.source_for(box)['domPath']}
        return {'opacity': box.style['opacity'],
                'transform': simple(transform.values) if transform else None,
                'clip': clip}

    def background(self, bg):
        if bg is None or self.page_index < 0:
            return
        owner = self.bg_owners.get(id(bg))
        if owner is None:
            return
        if owner.style['visibility'] != 'visible':
            return
        color = rgba(bg.color)
        layers = []
        for layer in bg.layers:
            image = layer.image
            if image is None:
                continue
            spec = {'kind': type(image).__name__, 'size': simple(layer.size),
                    'position': simple(layer.position), 'repeat': simple(layer.repeat),
                    'paintingArea': rect(*layer.painting_area),
                    'positioningArea': rect(*layer.positioning_area),
                    'clippedBoxes': simple(layer.clipped_boxes)}
            if type(image).__name__ == 'LinearGradient':
                scale, kind, points, positions, colors, hints = image.layout(
                    layer.size[0], layer.size[1], bg.style)
                spec.update({'type': 'linearGradient', 'directionType': image.direction_type,
                    'direction': simple(image.direction), 'repeating': image.repeating,
                    'points': simple(points), 'stopPositions': simple(positions),
                    'colors': [rgba(c) for c in colors], 'hints': simple(hints)})
            else:
                self.warnings.append({'page': self.page_index + 1,
                    'kind': 'background-image', 'type': type(image).__name__,
                    'source': self.source_for(owner)})
            layers.append(spec)
        if color['alpha'] == 0 and not layers:
            return
        clipped = bg.layers[-1].clipped_boxes if bg.layers else []
        self.event({'type': 'shape', 'paintRole': 'background',
            'source': self.source_for(owner), 'box': border_box(owner),
            'radii': simple(owner.rounded_border_box()[4:]),
            'fill': color, 'backgroundLayers': layers, 'borders': {},
            'backgroundClip': simple(clipped)})

    def border(self, box):
        if self.page_index < 0 or box.style['visibility'] != 'visible':
            return
        borders = {}
        for side in ('top', 'right', 'bottom', 'left'):
            width = getattr(box, f'border_{side}_width', 0)
            if not width:
                continue
            color = rgba(get_color(box.style, f'border_{side}_color'))
            style = box.style[f'border_{side}_style']
            if color['alpha'] and style not in ('none', 'hidden'):
                borders[side] = {'width': rnd(width), 'style': style, 'color': color}
        if not borders:
            return
        source = self.source_for(box)
        events = self.pages[self.page_index]['_events']
        last = events[-1] if events else None
        if (last and last['type'] == 'shape' and last.get('paintRole') == 'background'
                and last['source']['domPath'] == source['domPath']
                and last['box'] == border_box(box)):
            last['borders'] = borders
            last['paintRole'] = 'background-and-border'
        else:
            self.event({'type': 'shape', 'paintRole': 'border', 'source': source,
                'box': border_box(box), 'radii': simple(box.rounded_border_box()[4:]),
                'fill': None, 'backgroundLayers': [], 'borders': borders})

    def text(self, box):
        if box.style['visibility'] != 'visible' or not box.text:
            return
        self.painted_text_ids.append(id(box))
        info = self.box_info.get(id(box))
        if info is None:
            # StackingContext copies parent boxes, but leaves leaf TextBoxes intact.
            raise ValueError(f'Painted text was absent from layout index: {box.text!r}')
        line, owner = info['line'], info['owner']
        if owner is None:
            owner = box
        style = box.style
        box.pango_layout.reactivate(style)
        pango_line, _ = box.pango_layout.get_first_line()
        ink = ffi.new('PangoRectangle *')
        logical = ffi.new('PangoRectangle *')
        pango.pango_layout_line_get_extents(pango_line, ink, logical)
        ink_box = rect(box.position_x + ink.x * FROM_UNITS,
            box.position_y + box.baseline + ink.y * FROM_UNITS,
            ink.width * FROM_UNITS, ink.height * FROM_UNITS)
        actual_fonts = []
        ascent = descent = 0
        font_run = pango_line.runs[0]
        while font_run != ffi.NULL:
            font = font_run.data.item.analysis.font
            metrics = pango.pango_font_get_metrics(font, box.pango_layout.language)
            font_ascent = pango.pango_font_metrics_get_ascent(metrics) * FROM_UNITS
            font_descent = pango.pango_font_metrics_get_descent(metrics) * FROM_UNITS
            pango.pango_font_metrics_unref(metrics)
            description = pango.pango_font_describe_with_absolute_size(font)
            family = ffi.string(pango.pango_font_description_get_family(description)).decode()
            pango.pango_font_description_free(description)
            if family not in actual_fonts:
                actual_fonts.append(family)
            ascent, descent = max(ascent, font_ascent), max(descent, font_descent)
            font_run = font_run.next
        # Logical extents span the font line box relative to its baseline.  Keep
        # these separately from actual glyph ink, which depends on the string.
        logical_ascent = -logical.y * FROM_UNITS
        logical_descent = (logical.y + logical.height) * FROM_UNITS
        box.pango_layout.deactivate()
        hyperlink = None
        current = box.element
        while current is not None:
            if current.get('href'):
                hyperlink = current.get('href')
                break
            current = self.parents.get(id(current))
        run = {
            'text': box.text, 'source': self.source_for(box),
            'box': rect(box.position_x, box.position_y, box.width, box.height),
            'inkBox': ink_box, 'baseline': rnd(box.position_y + box.baseline),
            'absoluteBaseline': rnd(box.position_y + box.baseline),
            'baselineOffset': rnd(box.baseline), 'ascent': rnd(ascent),
            'descent': rnd(descent), 'actualFontFamilies': actual_fonts,
            'logicalAscent': rnd(logical_ascent), 'logicalDescent': rnd(logical_descent),
            'logicalExtent': rect(logical.x * FROM_UNITS, logical.y * FROM_UNITS,
                                  logical.width * FROM_UNITS, logical.height * FROM_UNITS),
            'fontFamily': list(style['font_family']), 'fontSize': rnd(style['font_size']),
            'fontWeight': style['font_weight'], 'fontStyle': style['font_style'],
            'fontStretch': style['font_stretch'], 'color': rgba(style['color']),
            'letterSpacing': simple(style['letter_spacing']),
            'wordSpacing': simple(style['word_spacing']),
            'lineHeight': simple(style['line_height']),
            'textDecoration': simple(style['text_decoration_line']),
            'textDecorationColor': rgba(get_color(style, 'text_decoration_color')),
            'textTransform': style['text_transform'], 'whiteSpace': style['white_space'],
            'hyperlink': hyperlink,
        }
        if line is not None:
                line_spec = {'id': id(line),
                'box': rect(line.position_x, line.position_y, line.width, line.height),
                'baseline': rnd(line.position_y + line.baseline),
                'absoluteBaseline': rnd(line.position_y + line.baseline),
                'explicitBreak': any(local_tag(child.element_tag or '') == 'br'
                    for child in line.descendants(placeholders=True))}
        else:
            line_spec = {'id': id(box), 'box': run['box'],
                         'baseline': run['baseline'],
                         'absoluteBaseline': run['baseline'], 'explicitBreak': False}
        self.event({'type': '_textRun', 'run': run, '_owner': id(owner),
                    '_line': line_spec})

    def svg(self, box):
        if box.style['visibility'] != 'visible' or not box.width or not box.height:
            return
        w, h, x, y = replacedbox_layout(box)
        if w <= 0 or h <= 0:
            return
        element = box.element
        tag = local_tag(element.tag)
        source = self.source_for(box)
        if tag == 'svg':
            raw = ET.tostring(element, encoding='utf-8')
        elif tag == 'img' and element.get('src', '').startswith('data:image/svg+xml'):
            header, payload = element.get('src').split(',', 1)
            raw = base64.b64decode(payload) if ';base64' in header else unquote_to_bytes(payload)
        elif tag == 'img':
            parsed = urlparse(element.get('src', ''))
            if parsed.scheme not in ('', 'file'):
                raise ValueError(f'Unsupported replaced image: {element.get("src", "")[:80]}')
            raw = Path(parsed.path).read_bytes()
        else:
            raise ValueError(f'Unsupported replaced element: {tag}')
        root = ET.fromstring(raw)
        if local_tag(root.tag) != 'svg':
            raise ValueError('Every current illustration should be source SVG, not a bitmap.')
        digest = hashlib.sha256(raw).hexdigest()
        asset_name = f'slide-{self.page_index + 1:02}-svg-{digest[:12]}.svg'
        (self.asset_dir / asset_name).write_bytes(raw)
        self.event({'type': 'svg', 'source': source, 'box': rect(x, y, w, h),
            'contentBox': content_box(box), 'asset': 'layout-assets/' + asset_name,
            'sourceSha256': digest, 'viewBox': root.get('viewBox'),
            'preserveAspectRatio': root.get('preserveAspectRatio', 'xMidYMid meet'),
            'objectFit': box.style['object_fit'], 'color': rgba(box.style['color']),
            'fontFamily': list(box.style['font_family']),
            'fontSize': rnd(box.style['font_size']),
            'textNodeCount': sum(local_tag(e.tag) == 'text' for e in root.iter()),
            'rasterNodeCount': sum(local_tag(e.tag) == 'image' for e in root.iter())})

    def table_line(self, x1, y1, x2, y2, width, style, color):
        if not self.table_border_depth:
            return
        self.event({'type': 'line', 'paintRole': 'collapsed-table-border',
                    'box': rect(min(x1, x2), min(y1, y2), abs(x2-x1), abs(y2-y1)),
                    'start': [rnd(x1), rnd(y1)], 'end': [rnd(x2), rnd(y2)],
                    'line': {'width': rnd(width), 'style': style, 'color': rgba(color)},
                    'source': self.source_for(self.contexts[-1]['_box'])})

    def capture(self):
        """Observe the renderer's real draw order instead of guessing from DOM order."""
        originals = {name: getattr(draw_module, name) for name in (
            'draw_stacking_context', 'draw_background', 'draw_border', 'draw_text',
            'draw_replacedbox', 'draw_collapsed_borders', 'draw_line')}
        original_page = document_module.draw_page

        def page_hook(page, stream):
            self.page_index += 1
            self.order = 0
            slide = self.source['slides'][self.page_index]
            self.pages.append({'index': self.page_index + 1, 'id': slide['id'],
                'title': slide['title'], 'width': 1920, 'height': 1080, '_events': []})
            return original_page(page, stream)

        def context_hook(stream, context):
            state = self.context(context.box)
            state['_box'] = context.box
            self.contexts.append(state)
            try:
                return originals['draw_stacking_context'](stream, context)
            finally:
                self.contexts.pop()

        def background_hook(stream, bg, *args, **kwargs):
            self.background(bg)
            return originals['draw_background'](stream, bg, *args, **kwargs)

        def border_hook(stream, box):
            self.border(box)
            return originals['draw_border'](stream, box)

        def text_hook(stream, box, *args, **kwargs):
            self.text(box)
            return originals['draw_text'](stream, box, *args, **kwargs)

        def replaced_hook(stream, box):
            self.svg(box)
            return originals['draw_replacedbox'](stream, box)

        def table_hook(stream, table):
            self.table_border_depth += 1
            try:
                return originals['draw_collapsed_borders'](stream, table)
            finally:
                self.table_border_depth -= 1

        def line_hook(stream, x1, y1, x2, y2, width, style, color, *args, **kwargs):
            self.table_line(x1, y1, x2, y2, width, style, color)
            return originals['draw_line'](stream, x1, y1, x2, y2, width, style,
                                           color, *args, **kwargs)

        document_module.draw_page = page_hook
        for name, fn in [('draw_stacking_context', context_hook),
                ('draw_background', background_hook), ('draw_border', border_hook),
                ('draw_text', text_hook), ('draw_replacedbox', replaced_hook),
                ('draw_collapsed_borders', table_hook), ('draw_line', line_hook)]:
            setattr(draw_module, name, fn)
        try:
            # PDF bytes are a side effect of observing normal native rendering;
            # no screenshot or outlined glyph from this PDF enters the manifest.
            pdf = self.document.write_pdf()
            self.paint_pdf_sha256 = hashlib.sha256(pdf).hexdigest()
        finally:
            document_module.draw_page = original_page
            for name, fn in originals.items():
                setattr(draw_module, name, fn)
        self._coalesce_text()
        return self.pages

    def _coalesce_text(self):
        for page in self.pages:
            events = page.pop('_events')
            groups = {}
            elements = []
            for event in events:
                if event['type'] != '_textRun':
                    elements.append(event)
                    continue
                owner_id = event['_owner']
                group = groups.setdefault(owner_id, {'events': [], 'lines': {}})
                group['events'].append(event)
                line = event['_line']
                rendered_line = group['lines'].setdefault(line['id'], {
                    'box': line['box'], 'baseline': line['baseline'],
                    'absoluteBaseline': line['absoluteBaseline'],
                    'explicitBreak': line['explicitBreak'], 'runs': []})
                event['run']['opacity'] = event['opacity']
                event['run']['transforms'] = event['transforms']
                rendered_line['runs'].append(event['run'])
            for owner_id, group in groups.items():
                owner = self.block_groups.get(owner_id)
                group_events = group['events']
                if owner is None:
                    raise ValueError('Painted text block has no indexed owner.')
                lines = list(group['lines'].values())
                # Stable visual order within each block, preserving inline runs.
                lines.sort(key=lambda line: (line['box']['y'], line['box']['x']))
                for line in lines:
                    line['text'] = ''.join(run['text'] for run in line['runs'])
                source = self.source_for(owner)
                first, last = group_events[0], group_events[-1]
                text = '\n'.join(line['text'] for line in lines)
                logical = ' '.join(line['text'] for line in lines)
                if owner.style['white_space'] in ('pre', 'pre-wrap', 'pre-line'):
                    logical = text
                element = {'id': f'p{page["index"]:02}-text-{len(elements):04}',
                    'type': 'text', 'zOrder': last['zOrder'],
                    'paintRange': [first['zOrder'], last['zOrder']],
                    'source': source, 'box': content_box(owner),
                    'borderBox': border_box(owner), 'text': text,
                    'logicalText': logical, 'lines': lines,
                    'align': owner.style['text_align_all'],
                    'direction': owner.style['direction'],
                    'whiteSpace': owner.style['white_space'],
                    'lineHeight': simple(owner.style['line_height']),
                    'opacity': last['opacity'], 'transforms': last['transforms'],
                    'clips': last['clips'],
                    'nativeTextRequired': True}
                elements.append(element)
            elements.sort(key=lambda element: element['zOrder'])
            page['elements'] = elements
            page['stats'] = {kind: sum(el['type'] == kind for el in elements)
                             for kind in ('shape', 'line', 'text', 'svg')}
            page['stats']['textRuns'] = sum(len(line['runs'])
                for element in elements if element['type'] == 'text'
                for line in element['lines'])
            page['stats']['characters'] = sum(len(element['text'])
                for element in elements if element['type'] == 'text')
            page['groups'] = self._groups_for_page(elements)

    def _groups_for_page(self, elements):
        groups = {}
        for element in elements:
            source = element.get('source', {})
            ancestors = source.get('semanticAncestors', [])
            if source.get('semantic'):
                ancestors = [*ancestors, source]
            for ancestor in ancestors:
                path = ancestor['domPath']
                if ancestor['tag'] == 'section':
                    continue
                group = groups.setdefault(path, {
                    'id': path, 'tag': ancestor['tag'],
                    'classes': ancestor.get('classes', []), 'elementIds': []})
                group['elementIds'].append(element['id'])
        return list(groups.values())

    def validate(self):
        expected = {box_id for box_id, entry in self.box_info.items()
                    if isinstance(entry['box'], boxes.TextBox)
                    and entry['box'].text
                    and entry['box'].style['visibility'] == 'visible'}
        captured = set(self.painted_text_ids)
        coverage = {'visibleTextLeavesInLayout': len(expected),
                    'paintedTextRuns': len(self.painted_text_ids),
                    'allVisibleTextCaptured': expected == captured,
                    'duplicatePaintedTextRuns': len(self.painted_text_ids)-len(captured)}
        geometry = []
        transforms = []
        for page in self.pages:
            inks = []
            for element in page['elements']:
                if element['transforms']:
                    transforms.append({'page': page['index'], 'id': element['id'],
                        'matrices': element['transforms'],
                        'translationsOnly': all(t[:4] == [1, 0, 0, 1]
                                                for t in element['transforms'])})
                if element['type'] != 'text':
                    continue
                for line in element['lines']:
                    for run in line['runs']:
                        if not run['text'].strip():
                            continue
                        ink = dict(run['inkBox'])
                        for matrix in run['transforms']:
                            if matrix[:4] != [1, 0, 0, 1]:
                                raise ValueError('Non-translation text transform needs an expanded geometry audit.')
                            ink['x'] += matrix[4]
                            ink['y'] += matrix[5]
                        ink['text'] = run['text']
                        inks.append(ink)
            outside = [ink for ink in inks if ink['x'] < -1 or ink['y'] < -1
                       or ink['x']+ink['w'] > 1921 or ink['y']+ink['h'] > 1081]
            overlaps = []
            for index, first in enumerate(inks):
                for second in inks[index+1:]:
                    dx = min(first['x']+first['w'], second['x']+second['w'])-max(first['x'], second['x'])
                    dy = min(first['y']+first['h'], second['y']+second['h'])-max(first['y'], second['y'])
                    if dx > 2 and dy > 2:
                        overlaps.append({'a': first['text'], 'b': second['text'],
                                          'width': rnd(dx), 'height': rnd(dy)})
            geometry.append({'index': page['index'], 'textInkBoxes': len(inks),
                             'outside': outside, 'overlaps': overlaps})
        return {'method': 'All original layout text leaves (including absolute placeholders) compared to actual paint hooks; translated Pango glyph ink checked against page bounds and other HTML text.',
                'coverage': coverage, 'transforms': transforms, 'textGeometry': geometry,
                'passed': coverage['allVisibleTextCaptured']
                    and coverage['duplicatePaintedTextRuns'] == 0
                    and not any(page['outside'] or page['overlaps'] for page in geometry),
                'limits': 'SVG text is retained in original source assets and audited by the native-vector converter; this check does not render Office text.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', default='docs/slides/05-disaggregated-intelligence.html')
    parser.add_argument('--frozen', default='docs/slides/exports/05-disaggregated-intelligence/static-frozen.html')
    parser.add_argument('--source', default='docs/slides/src/deck-v5.json')
    parser.add_argument('--freeze-report', default='docs/slides/reviews/05-teaching-state-integrated.json')
    parser.add_argument('--output', default='docs/slides/exports/05-disaggregated-intelligence-editable/layout-manifest.json')
    args = parser.parse_args()
    input_path, frozen_path, source_path, output = [Path(value).resolve()
        for value in (args.input, args.frozen, args.source, args.output)]
    output.parent.mkdir(parents=True, exist_ok=True)
    source = json.loads(source_path.read_text())
    original_html = input_path.read_text()
    html = frozen_path.read_text()
    fingerprint = re.search(r'<meta name="deck-source-sha256" content="([a-f0-9]+)"', original_html)
    if not fingerprint or fingerprint[1] != sha(source_path):
        raise ValueError('Source JSON and built HTML differ.')
    freeze_path = Path(args.freeze_report).resolve()
    freeze = json.loads(freeze_path.read_text())
    if (not freeze.get('passed') or not freeze.get('freeze', {}).get('sourcePreserved')
            or freeze.get('inputSha256') != sha(input_path)
            or freeze.get('freeze', {}).get('sha256') != sha(frozen_path)):
        raise ValueError('The frozen state is not the passing state of this source HTML.')
    order = [slide['id'] for slide in source['slides']]
    for candidate in (original_html, html):
        if re.findall(r'<section\b[^>]*data-slide-id="([^"]+)"', candidate) != order:
            raise ValueError('Source/HTML slide order differs.')
    # Same successful pagination/layout overrides as the approved v5 renderer.
    export_script = Path(__file__).with_name('export-powerpoint.cjs')
    render_script = Path(__file__).with_name('render-static-v5.py')
    export_css = re.search(r'const exportCSS=`([\s\S]*?)`;', export_script.read_text())[1]
    local_css = re.search(r"export_css\+='''([\s\S]*?)'''", render_script.read_text())[1]
    html = html.replace('Constructed trace; click Next event',
                        'Constructed trace · final static state')
    blocked = []

    def fetch(url, *arguments, **kwargs):
        if urlparse(url).scheme in ('http', 'https'):
            blocked.append(url)
            raise ValueError('Remote assets are disabled in editable export.')
        return default_url_fetcher(url, *arguments, **kwargs)

    html_object = HTML(string=html, base_url=input_path.parent.as_uri()+'/',
                       url_fetcher=fetch)
    document = html_object.render(stylesheets=[CSS(string=export_css+local_css)])
    if len(document.pages) != len(order):
        raise ValueError('Rendered page count differs from source.')
    if any((page.width, page.height) != (1920, 1080) for page in document.pages):
        raise ValueError('Unexpected slide canvas dimensions.')
    extractor = Extractor(html_object, document, source, output)
    pages = extractor.capture()
    validation = extractor.validate()
    notes, _ = json.JSONDecoder().raw_decode(original_html.split('const SPEAKER_NOTES = ', 1)[1])
    for page, note in zip(pages, notes):
        page['notes'] = note
        page['notesSha256'] = hashlib.sha256(json.dumps(note, sort_keys=True,
            ensure_ascii=False).encode()).hexdigest()
    inputs = []
    for role, path in [('sourceHTML', input_path), ('frozenHTML', frozen_path),
            ('sourceJSON', source_path), ('exportCSSSource', export_script),
            ('localCSSSource', render_script), ('freezeReport', freeze_path),
            ('extractor', Path(__file__))]:
        inputs.append({'role': role, 'path': os.path.relpath(path, output.parent),
                       'sha256': sha(path)})
    manifest = {'schemaVersion': 1, 'title': source['title'],
        'method': 'WeasyPrint 69 / Pango source-layout and native paint-order extraction',
        'coordinateSystem': {'width': 1920, 'height': 1080, 'unit': 'css-px',
                             'recommendedEMUPerPixel': 6350, 'recommendedPointPerPixel': 0.5},
        'textPolicy': 'Unicode rich-text blocks; rendered lines and style runs retained; no outlined glyph substitution.',
        'svgPolicy': 'Original source SVG; no PDF outlines or rasterized slide assets.',
        'limitations': ['Native Microsoft Office rendering is not performed by this extractor.',
                       'Transforms and clips must be honored or explicitly rejected by the builder.'],
        'inputProvenance': inputs, 'blockedRemoteRequests': blocked,
        'warnings': extractor.warnings, 'slides': pages}
    manifest['totals'] = {key: sum(page['stats'][key] for page in pages)
                          for key in pages[0]['stats']}
    temporary = output.with_suffix(output.suffix+'.tmp')
    temporary.write_text(json.dumps(manifest, indent=2, ensure_ascii=False)+'\n')
    os.replace(temporary, output)
    validation['manifestSha256'] = sha(output)
    validation['manifest'] = output.name
    (output.parent/'layout-extraction-validation.json').write_text(
        json.dumps(validation, indent=2, ensure_ascii=False)+'\n')
    print(json.dumps({'output': str(output), 'pages': len(pages),
                      'totals': manifest['totals'], 'warnings': extractor.warnings,
                      'blockedRemoteRequests': blocked,
                      'layoutPassed': validation['passed']}, ensure_ascii=False))
    if blocked or extractor.warnings or not validation['passed']:
        raise SystemExit('Extraction includes unsupported/blocked assets; inspect the manifest.')


if __name__ == '__main__':
    main()
