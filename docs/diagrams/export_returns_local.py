#!/usr/bin/env python3
"""Render and inspect native SVGs without a browser.

Requires Pillow, librsvg, Poppler, and an explicit fontconfig file registering the
bundled Manrope font. Geometry uses independently rasterized text ink, including
ancestor transforms, rather than font metric rectangles.
"""
from pathlib import Path
from copy import deepcopy
from tempfile import TemporaryDirectory
import argparse
import hashlib
import json
import os
import re
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image

HERE = Path(__file__).resolve().parent
SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG)
ET.register_namespace('xlink','http://www.w3.org/1999/xlink')


def run(*args, env=None):
    return subprocess.run(args, check=True, capture_output=True, text=True, env=env).stdout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('names',nargs='+')
    parser.add_argument('--fontconfig',required=True)
    parser.add_argument('--report',default='returns-branching-geometry-report.json')
    args = parser.parse_args()
    env = dict(os.environ,FONTCONFIG_FILE=str(Path(args.fontconfig).resolve()))
    font = run('fc-match','-f','%{family}\n%{file}\n','Manrope',env=env).strip().splitlines()
    if not font or 'Manrope' not in font[0]:
        raise SystemExit('Register the actual bundled Manrope before rendering.')
    report = {'method':'librsvg/Pango with registered bundled fonts; Poppler outlines. Text geometry from actual isolated glyph ink.',
              'font':{'family':font[0],'sha256':hashlib.sha256(Path(font[-1]).read_bytes()).hexdigest()},
              'limits':'This is local vector rendering, not a browser or Microsoft Office render.', 'artifacts':[]}
    with TemporaryDirectory(prefix='returns-local-') as temp:
        temp = Path(temp)
        for name in args.names:
            src = HERE/(name+'.svg')
            root = ET.fromstring(src.read_bytes())
            _,_,w,h = map(float,root.attrib['viewBox'].split())
            width,height = int(w),int(h)
            run('rsvg-convert','-w',str(round(width*1.5)),'-h',str(round(height*1.5)),
                '-o',str(HERE/(name+'.png')),str(src),env=env)
            pdf = HERE/(name+'.pdf')
            run('rsvg-convert','-f','pdf','-o',str(pdf),str(src),env=env)
            portable = HERE/(name+'.outlined.svg')
            run('pdftocairo','-svg',str(pdf),str(portable))
            outlined = ET.fromstring(portable.read_bytes())
            outlined.set('width',f'{width}px');outlined.set('height',f'{height}px')
            outlined.set('role','img');outlined.set('aria-labelledby','portable-title portable-desc')
            for i,tag in enumerate(['title','desc']):
                item = deepcopy(root.find(f'{{{SVG}}}{tag}'))
                item.set('id','portable-'+tag);outlined.insert(i,item)
            bad = [e.tag for e in outlined.iter() if e.tag.rsplit('}',1)[-1] in {'text','image','foreignObject'}]
            if bad:raise ValueError(f'{name}: unsupported portable objects: {bad}')
            portable.write_bytes(ET.tostring(outlined,encoding='utf-8',xml_declaration=True))
            parent = {child:el for el in root.iter() for child in el}
            text_boxes = []
            for i,element in enumerate(root.findall(f'.//{{{SVG}}}text')):
                isolated = ET.Element(f'{{{SVG}}}svg', {'width':str(width+200),'height':str(height+200),
                    'viewBox':f'-100 -100 {width+200} {height+200}'})
                isolated.append(deepcopy(root.find(f'{{{SVG}}}defs')))
                current = deepcopy(element)
                p = parent[element]
                while p is not root:
                    wrapper = ET.Element(p.tag,dict(p.attrib));wrapper.append(current);current=wrapper;p=parent[p]
                isolated.append(current)
                one = temp/'one.svg';png = temp/'one.png'
                one.write_bytes(ET.tostring(isolated,encoding='utf-8'))
                run('rsvg-convert','-o',str(png),str(one),env=env)
                with Image.open(png) as img:
                    alpha = img.convert('RGBA').getchannel('A')
                    bbox = alpha.point(lambda x:255 if x>20 else 0).getbbox()
                if bbox:
                    x,y,right,bottom = (n-100 for n in bbox)
                    text_boxes.append({'text':''.join(element.itertext()),'x':x,'y':y,'right':right,'bottom':bottom})
            out_of_bounds = [b for b in text_boxes if b['x'] < 0 or b['y'] < 0 or b['right'] > width or b['bottom'] > height]
            overlaps = []
            for i,a in enumerate(text_boxes):
                for b in text_boxes[i+1:]:
                    ix = min(a['right'],b['right'])-max(a['x'],b['x'])
                    iy = min(a['bottom'],b['bottom'])-max(a['y'],b['y'])
                    if ix>1 and iy>1:overlaps.append({'a':a['text'],'b':b['text'],'width':ix,'height':iy})
            report['artifacts'].append({'name':name,'canvas':{'width':width,'height':height},
                'textCount':len(text_boxes),'outOfBounds':out_of_bounds,'overlaps':overlaps,
                'nativeVector':True,'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),
                'portableSha256':hashlib.sha256(portable.read_bytes()).hexdigest()})
            print(f'{name}: {len(text_boxes)} text items, {len(out_of_bounds)} outside, {len(overlaps)} overlaps')
    if Path(args.report).name!=args.report:raise ValueError('Report must be a filename in docs/diagrams.')
    report['passed'] = not any(a['outOfBounds'] or a['overlaps'] for a in report['artifacts'])
    (HERE/args.report).write_text(json.dumps(report,indent=2)+'\n')
    raise SystemExit(not report['passed'])


if __name__=='__main__':main()
