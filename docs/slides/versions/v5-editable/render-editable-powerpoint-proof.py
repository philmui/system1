#!/usr/bin/env python3
"""Render editable PPTX native DrawingML to independent SVG/PNG proof pages.

This diagnostic reads the PPTX ZIP itself: native geometry, group coordinate
systems, solid/linear fills, and native paragraph/run settings. It never uses
the source HTML/layout manifest to reconstruct text positions. Local Pango
metrics and librsvg paint the proof. This is NOT Microsoft Office rendering,
and cannot certify Office's paragraph or font-shaping implementation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET
import zipfile

from PIL import Image, ImageChops, ImageDraw, ImageFont
from svg_to_editable import A,P,SVG,TextMetrics,mul,point,IDENTITY

R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS={'a':A,'p':P,'r':R}
EMU=6350
ET.register_namespace('',SVG)


def el(parent,name,attrs=None,text=None):
    item=ET.SubElement(parent,f'{{{SVG}}}{name}',{k:str(v) for k,v in (attrs or {}).items()})
    if text is not None:item.text=text
    return item


def fmt(v):return f'{v:.9g}'


def matrix_text(m):return 'matrix('+','.join(fmt(v) for v in m)+')'


def fattr(node,name,default=0):return float(node.get(name,default)) if node is not None else default


def rect(xform):
    off=xform.find('a:off',NS);ext=xform.find('a:ext',NS)
    return [fattr(off,'x')/EMU,fattr(off,'y')/EMU,fattr(ext,'cx')/EMU,fattr(ext,'cy')/EMU]


def rotation(xform,box):
    x,y,w,h=box;angle=fattr(xform,'rot')/60000
    flipx=-1 if xform.get('flipH') in ('1','true') else 1
    flipy=-1 if xform.get('flipV') in ('1','true') else 1
    if not angle and flipx==flipy==1:return IDENTITY
    r=math.radians(angle);c,s=math.cos(r),math.sin(r);cx,cy=x+w/2,y+h/2
    return mul(mul((1,0,0,1,cx,cy),(c*flipx,s*flipx,-s*flipy,c*flipy,0,0)),(1,0,0,1,-cx,-cy))


def group_matrix(prop):
    xf=prop.find('a:xfrm',NS) if prop is not None else None
    if xf is None:return IDENTITY
    b=rect(xf);x,y,w,h=b
    co=xf.find('a:chOff',NS);ce=xf.find('a:chExt',NS)
    cx,cy=fattr(co,'x')/EMU,fattr(co,'y')/EMU
    cw,ch=fattr(ce,'cx')/EMU,fattr(ce,'cy')/EMU
    if not cw or not ch:
        if not w and not h:return IDENTITY
        raise ValueError('Nonzero group extents with zero child extents')
    return mul(rotation(xf,b),(w/cw,0,0,h/ch,x-cx*w/cw,y-cy*h/ch))


class Renderer:
    def __init__(self,width,height,relations):
        self.width=width;self.height=height;self.relations=relations;self.count=0
        self.svg=ET.Element(f'{{{SVG}}}svg',{'width':str(width),'height':str(height),'viewBox':f'0 0 {width} {height}'})
        self.defs=el(self.svg,'defs');self.measure=TextMetrics();self.text=[];self.shapes=0;self.groups=0
    def color(self,node):
        if node is None:return None
        color=node.find('a:srgbClr',NS)
        if color is None:
            system=node.find('a:sysClr',NS)
            if system is not None:return '#'+system.get('lastClr','000000'),1
            raise ValueError('Proof renderer requires explicit sRGB or system colors')
        alpha=color.find('a:alpha',NS)
        return '#'+color.get('val'),fattr(alpha,'val',100000)/100000
    def paint(self,prop,box,attrs):
        fill=prop.find('a:solidFill',NS)
        grad=prop.find('a:gradFill',NS)
        if fill is not None:
            c,a=self.color(fill);attrs['fill']=c
            if a!=1:attrs['fill-opacity']=a
        elif grad is not None:
            lin=grad.find('a:lin',NS)
            if lin is None:raise ValueError('Only linear native gradients are supported')
            if lin.get('scaled','0')!='0':raise ValueError('Scaled DrawingML gradient needs a separate proof implementation')
            x,y,w,h=box;r=math.radians(fattr(lin,'ang')/60000);dx,dy=math.cos(r),math.sin(r)
            length=abs(w*dx)+abs(h*dy);cx,cy=x+w/2,y+h/2
            self.count+=1;gid=f'dml-gradient-{self.count}'
            gradient=el(self.defs,'linearGradient',{'id':gid,'gradientUnits':'userSpaceOnUse',
                         'x1':cx-dx*length/2,'y1':cy-dy*length/2,'x2':cx+dx*length/2,'y2':cy+dy*length/2})
            for stop in grad.findall('a:gsLst/a:gs',NS):
                c,a=self.color(stop);el(gradient,'stop',{'offset':fattr(stop,'pos')/100000,'stop-color':c,'stop-opacity':a})
            attrs['fill']='url(#'+gid+')'
        else:attrs['fill']='none'
        line=prop.find('a:ln',NS)
        if line is not None and line.find('a:solidFill',NS) is not None:
            c,a=self.color(line.find('a:solidFill',NS));width=fattr(line,'w',12700)/EMU
            attrs.update(stroke=c,**{'stroke-width':width,'stroke-opacity':a,
                         'stroke-linecap':{'rnd':'round','sq':'square','flat':'butt'}[line.get('cap','flat')]})
            if line.find('a:round',NS) is not None:attrs['stroke-linejoin']='round'
            elif line.find('a:bevel',NS) is not None:attrs['stroke-linejoin']='bevel'
            else:attrs['stroke-linejoin']='miter'
            dash=line.findall('a:custDash/a:ds',NS)
            if dash:attrs['stroke-dasharray']=' '.join(fmt(fattr(d,k)/100000*width) for d in dash for k in ('d','sp'))
            preset=line.find('a:prstDash',NS)
            if preset is not None and preset.get('val')!='solid':
                table={'dash':[4,3],'dot':[1,3],'lgDash':[8,3],'dashDot':[4,3,1,3],'sysDash':[3,1],'sysDot':[1,1]}
                if preset.get('val') not in table:raise ValueError('Unsupported preset dash '+preset.get('val'))
                attrs['stroke-dasharray']=' '.join(str(n*width) for n in table[preset.get('val')])
            for end in ('headEnd','tailEnd'):
                marker=line.find('a:'+end,NS)
                if marker is not None and marker.get('type','none')!='none':raise ValueError('Native connection arrowheads require explicit rendering')
    def geometry(self,sp,parent,box):
        prop=sp.find('p:spPr',NS);x,y,w,h=box;attrs={};self.paint(prop,box,attrs)
        preset=prop.find('a:prstGeom',NS)
        if preset is not None:
            kind=preset.get('prst')
            if kind=='ellipse':attrs.update(cx=x+w/2,cy=y+h/2,rx=w/2,ry=h/2);el(parent,'ellipse',attrs)
            elif kind in ('rect','roundRect'):
                attrs.update(x=x,y=y,width=w,height=h)
                if kind=='roundRect':
                    gd=preset.find('a:avLst/a:gd',NS);adj=float(gd.get('fmla').split()[1])/100000 if gd is not None else .16667
                    attrs['rx']=adj*min(w,h)
                el(parent,'rect',attrs)
            else:raise ValueError('Unsupported preset '+kind)
        else:
            paths=prop.findall('a:custGeom/a:pathLst/a:path',NS)
            if not paths:raise ValueError('Native shape has no rendered geometry')
            for path in paths:
                pw,ph=fattr(path,'w',w*EMU),fattr(path,'h',h*EMU);commands=[]
                for cmd in path:
                    name=cmd.tag.rsplit('}',1)[-1]
                    letter={'moveTo':'M','lnTo':'L','cubicBezTo':'C','quadBezTo':'Q','close':'Z'}.get(name)
                    if not letter:raise ValueError('Unsupported custom geometry command '+name)
                    coords=[(x+fattr(p,'x')/pw*w,y+fattr(p,'y')/ph*h) for p in cmd]
                    commands.append(letter+' '.join(fmt(n) for pt in coords for n in pt))
                pa=dict(attrs);pa['d']=' '.join(commands)
                if path.get('fill')=='none':pa['fill']='none'
                if path.get('stroke')=='0':pa['stroke']='none'
                el(parent,'path',pa)
        self.shapes+=1
    def run(self,run,default=None):
        prop=run.find('a:rPr',NS) if run is not None else default
        if prop is None:prop=default
        if prop is None:raise ValueError('Missing explicit native text run properties')
        text=run.findtext('a:t','',NS) if run is not None else ''
        face=prop.find('a:latin',NS)
        family=face.get('typeface') if face is not None else 'Arial'
        fs=fattr(prop,'sz',1800)/50
        weight=700 if prop.get('b') in ('1','true') else 400
        italic=prop.get('i') in ('1','true');spacing=fattr(prop,'spc')/50
        measured=self.measure.measure(text or ' ',family,fs,weight,italic,spacing)
        fill=prop.find('a:solidFill',NS);paint=self.color(fill) if fill is not None else ('#000000',1)
        hyperlink=prop.find('a:hlinkClick',NS);href=self.relations.get(hyperlink.get('{'+R+'}id')) if hyperlink is not None else None
        return {'text':text,'family':family,'fontSize':fs,'weight':weight,'italic':italic,'spacing':spacing,'metrics':measured,
                'paint':paint,'underline':prop.get('u') not in (None,'none'),'href':href,'baselineShift':-fattr(prop,'baseline')/100000*fs}
    def paragraphs(self,tb,box):
        body=tb.find('a:bodyPr',NS);x,y,w,h=box
        x+=fattr(body,'lIns',91440)/EMU;y+=fattr(body,'tIns',45720)/EMU
        w-=(fattr(body,'lIns',91440)+fattr(body,'rIns',91440))/EMU
        h-=(fattr(body,'tIns',45720)+fattr(body,'bIns',45720))/EMU
        anchor=body.get('anchor','t')
        if body.get('wrap','square')!='none':raise ValueError('Proof supports explicit authored line breaks only')
        prepared=[]
        for p in tb.findall('a:p',NS):
            pp=p.find('a:pPr',NS);default=p.find('a:endParaRPr',NS)
            if p.find('a:br',NS) is not None:raise ValueError('Explicit native breaks need separate line-box handling')
            runs=[self.run(r,default) for r in p.findall('a:r',NS)]
            if not runs:runs=[self.run(None,default)]
            ascent=max(r['metrics']['ascent']-min(0,r['baselineShift']) for r in runs)
            descent=max(r['metrics']['descent']+max(0,r['baselineShift']) for r in runs)
            lineheight=ascent+descent
            spacing=pp.find('a:lnSpc/a:spcPts',NS) if pp is not None else None
            percent=pp.find('a:lnSpc/a:spcPct',NS) if pp is not None else None
            if spacing is not None:advance=fattr(spacing,'val')/50
            elif percent is not None:advance=lineheight*fattr(percent,'val',100000)/100000
            else:advance=lineheight
            before=pp.find('a:spcBef/a:spcPts',NS) if pp is not None else None
            after=pp.find('a:spcAft/a:spcPts',NS) if pp is not None else None
            prepared.append({'runs':runs,'ascent':ascent,'descent':descent,'advance':advance,
                'before':fattr(before,'val')/50,'after':fattr(after,'val')/50,
                'align':pp.get('algn','l') if pp is not None else 'l',
                'marginLeft':fattr(pp,'marL')/EMU,'marginRight':fattr(pp,'marR')/EMU,'indent':fattr(pp,'indent')/EMU,
                'tabs':[(fattr(t,'pos')/EMU,t.get('algn','l')) for t in pp.findall('a:tabLst/a:tab',NS)] if pp is not None else []})
        content_height=sum(p['before']+p['advance']+p['after'] for p in prepared)
        if anchor=='ctr':y+=(h-content_height)/2
        elif anchor=='b':y+=h-content_height
        elif anchor!='t':raise ValueError('Unsupported body anchor '+anchor)
        baseline=None
        for i,p in enumerate(prepared):
            if i==0:baseline=y+p['before']+p['ascent']
            else:baseline+=prepared[i-1]['advance']+prepared[i-1]['after']+p['before']
            available=w-p['marginLeft']-p['marginRight'];position=p['marginLeft']+p['indent']
            for run in p['runs']:
                if run['text']=='\t':
                    following=[tab for tab in p['tabs'] if tab[0]>position+1e-5]
                    if not following:raise ValueError('Native tab has no subsequent explicit stop')
                    if following[0][1]!='l':raise ValueError('Only left-aligned native tabs supported')
                    position=following[0][0];run['isTab']=True
                else:
                    if '\t' in run['text']:raise ValueError('A native tab embedded inside a text run requires span splitting')
                    run['paragraphOffset']=position
                    position+=run['metrics']['width']
            width=position-p['marginLeft']-p['indent']
            left=x+p['marginLeft']+p['indent']
            if p['align']=='ctr':left+=(available-width)/2
            elif p['align']=='r':left+=available-width
            elif p['align'] not in ('l','just'):raise ValueError('Unsupported paragraph alignment '+p['align'])
            p.update(left=left,baseline=baseline,width=width,bodyX=x)
        return prepared
    def text_body(self,sp,parent,box,matrix):
        tb=sp.find('p:txBody',NS)
        if tb is None:return
        ident=sp.find('p:nvSpPr/p:cNvPr',NS);name=ident.get('name','text');shapeid=ident.get('id')
        paragraphs=self.paragraphs(tb,box)
        for p in paragraphs:
            cursor=p['left']
            for run in p['runs']:
                if run.get('isTab'):continue
                cursor=p['left']+run['paragraphOffset']-p['marginLeft']-p['indent']
                baseline=p['baseline']+run['baselineShift'];c,alpha=run['paint']
                attrs={'x':cursor,'y':baseline,'font-family':run['family'],'font-size':run['fontSize'],'font-weight':run['weight'],
                       'font-style':'italic' if run['italic'] else 'normal','letter-spacing':run['spacing'],
                       'fill':c,'fill-opacity':alpha,'{http://www.w3.org/XML/1998/namespace}space':'preserve'}
                if run['underline']:attrs['text-decoration']='underline'
                holder=el(parent,'a',{'href':run['href']}) if run['href'] else parent
                el(holder,'text',attrs,run['text'])
                ink=run['metrics']['ink'];corners=[point(matrix,cursor+ink[0],baseline+ink[1]),point(matrix,cursor+ink[0]+ink[2],baseline+ink[1]+ink[3])]
                self.text.append({'shapeId':shapeid,'name':name,'text':run['text'],'font':run['family'],'fontSizePx':run['fontSize'],
                                  'bbox':[corners[0][0],corners[0][1],corners[1][0]-corners[0][0],corners[1][1]-corners[0][1]],
                                  'baseline':point(matrix,cursor,baseline)})
                cursor+=run['metrics']['width']
    def walk(self,node,parent,matrix=IDENTITY):
        name=node.tag.rsplit('}',1)[-1]
        if name in ('spTree','grpSp'):
            transform=group_matrix(node.find('p:grpSpPr',NS));world=mul(matrix,transform)
            holder=el(parent,'g',{'transform':matrix_text(transform)}) if transform!=IDENTITY else el(parent,'g')
            if name=='grpSp':self.groups+=1
            for child in node:
                cname=child.tag.rsplit('}',1)[-1]
                if cname in ('sp','grpSp','pic','graphicFrame','cxnSp'):self.walk(child,holder,world)
            return
        if name!='sp':raise ValueError('Unsupported painted slide node '+name)
        prop=node.find('p:spPr',NS);xf=prop.find('a:xfrm',NS)
        if xf is None:raise ValueError('Native shape needs explicit xfrm')
        box=rect(xf);transform=rotation(xf,box)
        holder=el(parent,'g',{'transform':matrix_text(transform)}) if transform!=IDENTITY else el(parent,'g')
        world=mul(matrix,transform)
        self.geometry(node,holder,box);self.text_body(node,holder,box,world)
    def render(self,root):
        bg=root.find('p:cSld/p:bg/p:bgPr',NS)
        if bg is not None:
            attrs={'x':0,'y':0,'width':self.width,'height':self.height};self.paint(bg,[0,0,self.width,self.height],attrs);el(self.svg,'rect',attrs)
        self.walk(root.find('p:cSld/p:spTree',NS),self.svg)
        return ET.tostring(self.svg,encoding='unicode')


def comparison(actual,expected):
    a=Image.open(actual).convert('RGB');b=Image.open(expected).convert('RGB')
    if a.size!=b.size:raise ValueError('Proof/reference sizes differ')
    d=ImageChops.difference(a,b);n=a.width*a.height
    mae=sum((i%256)*count for i,count in enumerate(d.histogram()))/(n*3)
    m=ImageChops.lighter(ImageChops.lighter(*d.split()[:2]),d.split()[2])
    frac=sum(m.histogram()[31:])/n
    return {'meanAbsoluteChannelDifference255':mae,'fractionPixelsAnyChannelOver30':frac}


def contact_sheet(paths,out):
    width=480;height=270;label=24;cols=4;rows=math.ceil(len(paths)/cols)
    sheet=Image.new('RGB',(cols*width,rows*(height+label)),(239,244,248));draw=ImageDraw.Draw(sheet)
    for i,(slide,path) in enumerate(paths):
        x=(i%cols)*width;y=(i//cols)*(height+label)
        image=Image.open(path).convert('RGB').resize((width,height),Image.Resampling.LANCZOS)
        sheet.paste(image,(x,y));draw.text((x+8,y+height+5),f'Slide {slide:02d} · native XML proof',fill=(3,45,96))
    sheet.save(out,quality=92)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pptx',type=Path);parser.add_argument('output',type=Path)
    parser.add_argument('--reference',type=Path);parser.add_argument('--slides',help='comma-separated page numbers; default all')
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    # Match the explicit Fontconfig/FreeType metrics used by TextMetrics.
    # The macOS default CoreText backend otherwise ignores FONTCONFIG_FILE.
    os.environ['PANGOCAIRO_BACKEND']='fc'
    results=[];paths=[]
    with zipfile.ZipFile(args.pptx) as archive:
        presentation=ET.fromstring(archive.read('ppt/presentation.xml'));size=presentation.find('p:sldSz',NS)
        width,height=round(fattr(size,'cx')/EMU),round(fattr(size,'cy')/EMU)
        count=len(presentation.findall('p:sldIdLst/p:sldId',NS))
        selected=list(map(int,args.slides.split(','))) if args.slides else list(range(1,count+1))
        for index in selected:
            root=ET.fromstring(archive.read(f'ppt/slides/slide{index}.xml'))
            rp=f'ppt/slides/_rels/slide{index}.xml.rels';relations={}
            if rp in archive.namelist():relations={n.get('Id'):n.get('Target') for n in ET.fromstring(archive.read(rp))}
            renderer=Renderer(width,height,relations);svg=renderer.render(root)
            source=args.output/f'page-{index:02d}.svg';source.write_text(svg);png=args.output/f'page-{index:02d}.png'
            subprocess.run(['rsvg-convert','-o',str(png),str(source)],check=True,capture_output=True)
            outside=[r for r in renderer.text if r['bbox'][0]<-.5 or r['bbox'][1]<-.5 or r['bbox'][0]+r['bbox'][2]>width+.5 or r['bbox'][1]+r['bbox'][3]>height+.5]
            audit={'slide':index,'nativeShapes':renderer.shapes,'nativeGroups':renderer.groups,'nativeTextRuns':len(renderer.text),'textOutsideSlide':outside,'text':renderer.text}
            if args.reference:
                expected=args.reference/f'page-{index:02d}.png'
                if expected.exists():audit['comparisonToOriginal']=comparison(png,expected)
            (args.output/f'page-{index:02d}-text.json').write_text(json.dumps(renderer.text,indent=2)+'\n')
            results.append({k:v for k,v in audit.items() if k!='text'});paths.append((index,png))
            print(json.dumps(results[-1]),flush=True)
    contact_sheet(paths,args.output/'contact-sheet.jpg')
    report={'method':'Actual PPTX native DrawingML to independent SVG/PNG; Pango logical/ink metrics, librsvg painting. No source HTML/layout-manifest positioning used.',
            'limitations':['Not Microsoft Office rendering; paragraph metrics are a local Pango interpretation of explicit native XML.','Office/font-version-specific shaping and layout can differ.'],
            'pptx':str(args.pptx.resolve()),'pptxSha256':hashlib.sha256(args.pptx.read_bytes()).hexdigest(),
            'rendererSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'size':[width,height],
            'slides':results,'nativeGeometryProofOnly':True}
    (args.output/'native-xml-render-report.json').write_text(json.dumps(report,indent=2)+'\n')


if __name__=='__main__':main()
