#!/usr/bin/env python3
"""Flatten a simple page-sized gradient pattern in Poppler's SVG output.

Some PDF gradient tiles are emitted with an undersized paint rectangle. Replacing
that identity-tiled, page-sized paint with its existing linear gradient avoids a
visible white cutoff. This only accepts a chain of full-page clips and one plain
gradient rectangle. Independent PDF/SVG pixel comparison remains mandatory.
"""
from pathlib import Path
import json
import re
import sys
import xml.etree.ElementTree as ET


def normalize(svg):
    root=ET.fromstring(svg)
    view=list(map(float,root.get('viewBox','').split()))
    if len(view)!=4 or view[:2]!=[0,0]:return svg,0
    _,_,w,h=view
    ids={e.get('id'):e for e in root.iter() if e.get('id')}
    tag=lambda e:e.tag.rsplit('}',1)[-1]
    number=lambda e,k,default=0:float(e.get(k,str(default)))
    def full_clip(value):
        m=re.fullmatch(r'url\(#([^)]*)\)',value)
        if not m or m[1] not in ids:return False
        clip=ids[m[1]]
        if tag(clip)!='clipPath' or len(clip)!=1:return False
        e=clip[0]
        if tag(e)=='rect':return [number(e,k) for k in ['x','y','width','height']]==[0,0,w,h]
        if tag(e)=='path':
            d=e.get('d','')
            if set(re.findall('[A-Za-z]',d))-{'M','L','Z'}:return False
            coords=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',d)))
            return len(coords)%2==0 and set(zip(coords[::2],coords[1::2]))=={(0,0),(w,0),(w,h),(0,h)}
        return False
    def leaves(e,seen):
        if id(e) in seen or 'transform' in e.attrib:return None
        seen=seen|{id(e)}
        if e.get('clip-path') and not full_clip(e.get('clip-path')):return None
        if tag(e) in {'pattern','g'}:
            result=[]
            for child in e:
                found=leaves(child,seen)
                if found is None:return None
                result.extend(found)
            return result
        if tag(e)=='use':
            if number(e,'x') or number(e,'y'):return None
            ref=e.get('{http://www.w3.org/1999/xlink}href',e.get('href',''))
            return leaves(ids[ref[1:]],seen) if ref.startswith('#') and ref[1:] in ids else None
        if tag(e)=='rect':return [e]
        return None
    count=0
    for e in root.iter():
        if tag(e)!='pattern' or e.get('patternUnits')!='userSpaceOnUse':continue
        if list(map(float,e.get('viewBox','').split()))!=view:continue
        if [number(e,k) for k in ['x','y','width','height']]!=[0,0,w,h]:continue
        transform=e.get('patternTransform','matrix(1,0,0,1,0,0)')
        matrix=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',transform)))
        if len(matrix)!=6 or matrix[:4]!=[1,0,0,1]:continue
        if abs(matrix[4]/w-round(matrix[4]/w))>1e-9 or abs(matrix[5]/h-round(matrix[5]/h))>1e-9:continue
        paint=leaves(e,set())
        if not paint or len(paint)!=1:continue
        fill=paint[0].get('fill','');m=re.fullmatch(r'url\(#([^)]*)\)',fill)
        if not m or m[1] not in ids or tag(ids[m[1]])!='linearGradient':continue
        old='fill="url(#'+e.get('id')+')"'
        if old in svg:
            svg=svg.replace(old,'fill="'+fill+'"');count+=1
    return svg,count


if __name__=='__main__':
    file=Path(sys.argv[1]);svg,count=normalize(file.read_text())
    if count:file.write_text(svg)
    print(json.dumps({'gradientPatternsFlattened':count}))
