#!/usr/bin/env python3
"""Acceptance checks for native SVG conversion, independent of Office rendering.

Checks actual layout SVG occurrences, native XML IDs/text preservation, rejects
unsupported painted features, and independently decodes native geometry back
into SVG to check coordinate/color/stroke preservation. Native Office text
layout is not inferred from the generated proof.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from PIL import Image, ImageChops
import svg_to_editable as native

NS={'a':native.A,'p':native.P}


def decoded_native_geometry(xml, width, height, emu=6350):
    root=ET.fromstring(xml)
    svg=ET.Element('svg',{'xmlns':native.SVG,'width':str(width),'height':str(height),'viewBox':f'0 0 {width} {height}'})
    def paint(prop,attrs):
        fill=prop.find('a:solidFill/a:srgbClr',NS)
        attrs['fill']='#'+fill.get('val') if fill is not None else 'none'
        if fill is not None and fill.find('a:alpha',NS) is not None:attrs['fill-opacity']=str(int(fill.find('a:alpha',NS).get('val'))/100000)
        line=prop.find('a:ln',NS)
        if line is not None:
            stroke=line.find('a:solidFill/a:srgbClr',NS)
            if stroke is not None:
                width=int(line.get('w'))/emu
                attrs.update(stroke='#'+stroke.get('val'),**{'stroke-width':str(width),'stroke-linecap':{'rnd':'round','sq':'square','flat':'butt'}[line.get('cap','flat')]})
                if line.find('a:round',NS) is not None:attrs['stroke-linejoin']='round'
                elif line.find('a:bevel',NS) is not None:attrs['stroke-linejoin']='bevel'
                else:attrs['stroke-linejoin']='miter'
                alpha=stroke.find('a:alpha',NS)
                if alpha is not None:attrs['stroke-opacity']=str(int(alpha.get('val'))/100000)
                dash=line.findall('a:custDash/a:ds',NS)
                if dash:attrs['stroke-dasharray']=' '.join(str(int(d.get(k))/100000*width) for d in dash for k in ('d','sp'))
    for sp in root.findall('.//p:sp',NS):
        if sp.find('p:txBody',NS) is not None:continue
        prop=sp.find('p:spPr',NS);xf=prop.find('a:xfrm',NS)
        off,ext=xf.find('a:off',NS),xf.find('a:ext',NS)
        x,y=int(off.get('x'))/emu,int(off.get('y'))/emu
        w,h=int(ext.get('cx'))/emu,int(ext.get('cy'))/emu
        preset=prop.find('a:prstGeom',NS);attrs={};paint(prop,attrs)
        if preset is not None:
            kind=preset.get('prst')
            if kind=='ellipse':attrs.update(cx=str(x+w/2),cy=str(y+h/2),rx=str(w/2),ry=str(h/2));ET.SubElement(svg,'ellipse',attrs)
            elif kind in ('rect','roundRect'):
                attrs.update(x=str(x),y=str(y),width=str(w),height=str(h))
                if kind=='roundRect':
                    adj=int(preset.find('a:avLst/a:gd',NS).get('fmla').split()[1])/100000
                    attrs['rx']=str(adj*min(w,h))
                ET.SubElement(svg,'rect',attrs)
            else:raise AssertionError(f'Unexpected preset geometry: {kind}')
        else:
            commands=[]
            for path in prop.findall('a:custGeom/a:pathLst/a:path',NS):
                pw,ph=int(path.get('w')),int(path.get('h'))
                for cmd in path:
                    letter={'moveTo':'M','lnTo':'L','cubicBezTo':'C','quadBezTo':'Q','close':'Z'}[native.tag(cmd)]
                    points=[(x+int(p.get('x'))/pw*w,y+int(p.get('y'))/ph*h) for p in cmd]
                    commands.append(letter+' '.join(str(n) for pair in points for n in pair))
            attrs['d']=' '.join(commands);ET.SubElement(svg,'path',attrs)
    return ET.tostring(svg,encoding='unicode')


def geometry_only(drawing):
    result=copy.deepcopy(drawing)
    def without(items):
        out=[]
        for item in items:
            if item['kind']=='text':continue
            if item['kind']=='group':item['children']=without(item['children'])
            out.append(item)
        return out
    result['elements']=without(result['elements'])
    return result


def render_compare(actual,expected,directory):
    for key,svg in [('actual',actual),('expected',expected)]:
        source=directory/(key+'.svg');source.write_text(svg)
        subprocess.run(['rsvg-convert','-o',str(directory/(key+'.png')),str(source)],check=True,capture_output=True)
    images=[]
    for key in ('actual','expected'):
        source=Image.open(directory/(key+'.png')).convert('RGBA')
        background=Image.new('RGBA',source.size,'white');background.alpha_composite(source);images.append(background.convert('RGB'))
    assert images[0].size==images[1].size
    difference=ImageChops.difference(*images)
    return sum((i%256)*n for i,n in enumerate(difference.histogram()))/(images[0].width*images[0].height*3)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest',type=Path);parser.add_argument('report',type=Path)
    args=parser.parse_args();manifest=json.loads(args.manifest.read_text());directory=args.manifest.parent
    results=[];totals={'nativeGroups':0,'nativeShapes':0,'nativeTextBoxes':0,'pictures':0}
    with tempfile.TemporaryDirectory(prefix='native-vector-check-') as tmp:
        tmp=Path(tmp)
        for slide in manifest['slides']:
            for item in slide['elements']:
                if item['type']!='svg':continue
                source=(directory/item['asset']).read_text()
                drawing=native.convert_svg(source,current_color='#'+item['color']['hex'],name=f'Slide {slide["index"]}: {slide["title"]}')
                fragment,next_id,audit=native.encode_drawing(drawing,item['contentBox'],start_id=1000)
                root=ET.fromstring(fragment);ids=[n.get('id') for n in root.findall('.//p:cNvPr',NS)]
                assert len(ids)==len(set(ids))==next_id-1000
                assert len(root.findall('.//p:pic',NS))==0
                assert len(root.findall('.//a:t',NS))==item['textNodeCount']==audit['nativeTextBoxes']
                for k in totals:totals[k]+=audit[k]
                # Measure native path encoding separately from text layout.
                natural={'x':0,'y':0,'w':drawing['width'],'h':drawing['height']}
                geometry=geometry_only(drawing)
                native_xml,_,_=native.encode_drawing(geometry,natural)
                decoded=decoded_native_geometry(native_xml,drawing['width'],drawing['height'])
                expected=native.drawing_to_svg(geometry)
                difference=render_compare(decoded,expected,tmp)
                assert difference<.025,(slide['index'],difference)
                results.append({'slide':slide['index'],'asset':item['asset'],'sourceSha256':drawing['sourceSha256'],
                                'nativeShapes':audit['nativeShapes'],'nativeTextBoxes':audit['nativeTextBoxes'],
                                'nativeGroups':audit['nativeGroups'],'nativeGeometryRoundtripMeanError255':difference})
        # Independent SVG inputs exercise arc radii correction, sweep/large-arc,
        # implicit repeated coordinates, relative smooth curves, and transforms.
        path_cases=[
            'M20 90 A40 35 15 1 1 100 90 A40 35 15 1 1 20 90Z',
            'M10 10 a3 2 45 0 1 130 90',
            'M20 20q20-10 30 20t30 20m-30-10c10 0 10 20 20 20s30-10 20-40',
            'M10 10 30 10 30 30H60v30h-50z',
        ]
        arc_results=[]
        for data in path_cases:
            source=f'<svg xmlns="{native.SVG}" width="180" height="160" viewBox="0 0 180 160"><g transform="translate(5 5) rotate(4 80 70)" fill="none" stroke="#135E66" stroke-width="3"><path d="{data}"/></g></svg>'
            d=native.convert_svg(source);error=render_compare(native.drawing_to_svg(d),source,tmp)
            assert error<.1,(data,error)
            arc_results.append({'inputPath':data,'normalizedGeometryMeanError255':error})
        rejected=[]
        bad=[('filter','<rect width="10" height="10" filter="url(#blur)"/>'),
             ('clipping','<path d="M0 0L10 10" clip-path="url(#clip)"/>'),
             ('paint server','<rect width="10" height="10" fill="url(#gradient)"/>'),
             ('foreign object','<foreignObject/>'),
             ('embedded image','<image width="10" height="10" href="anything.png"/>'),
             ('text rotation','<text x="0" y="10" transform="rotate(20)">label</text>'),
             ('even-odd fill','<path d="M0 0L10 0L0 10Z" fill-rule="evenodd"/>'),
             ('unknown marker','<path d="M0 0L10 10" marker-end="url(#missing)"/>')]
        for label,body in bad:
            try:native.convert_svg(f'<svg xmlns="{native.SVG}" viewBox="0 0 20 20">{body}</svg>')
            except ValueError as error:rejected.append({'case':label,'reason':str(error)})
            else:raise AssertionError(f'Unsupported {label} was silently accepted')
    report={'passed':True,'method':'All actual layout SVGs to native DrawingML. Independent XML geometry decoding + librsvg pixel comparison; exact source text-node preservation and unique IDs. Synthetic arc/path comparisons and eight fail-closed cases.',
            'limitations':['Does not render in Microsoft Office.','Geometry proof excludes native Office font shaping; text remains editable with explicit family/size/weight and source-baseline metrics.'],
            'inputManifestSha256':hashlib.sha256(args.manifest.read_bytes()).hexdigest(),
            'converterSha256':hashlib.sha256(Path(native.__file__).read_bytes()).hexdigest(),
            'svgOccurrences':len(results),'totals':totals,'results':results,'pathCases':arc_results,'rejectedUnsupportedCases':rejected}
    args.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'passed':True,'svgOccurrences':len(results),'totals':totals,
                      'maxNativeGeometryRoundtripMeanError255':max(r['nativeGeometryRoundtripMeanError255'] for r in results),
                      'pathCases':len(arc_results),'rejectedUnsupportedCases':len(rejected)},indent=2))


if __name__=='__main__':main()
