#!/usr/bin/env python3
"""Convert the deck's authored SVG drawings to editable PowerPoint geometry.

The converter deliberately fails on unsupported painted SVG features. It does
not rasterize or outline text. SVG paths (including elliptical arcs) become
DrawingML custom geometry; text remains native PowerPoint text. The JSON form
uses SVG units, with ancestor transforms flattened but named groups retained.

Public API:
    convert_svg(svg_text, *, current_color='#000000', name=None) -> dict
    encode_drawing(drawing, placement_px, start_id=1000, emu_per_px=6350)
        -> (xml_fragment, next_id, audit)
    drawing_to_svg(drawing) -> str    # independent editable-geometry proof

Font measurements use local Pango, with the caller's FONTCONFIG_FILE respected.
No network, document mutation, or PowerPoint automation is performed here.
"""
from __future__ import annotations

import argparse
import copy
import ctypes
import ctypes.util
import hashlib
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET

SVG = 'http://www.w3.org/2000/svg'
A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
ET.register_namespace('a', A)
ET.register_namespace('p', P)
NUMBER = r'[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?'
IDENTITY = (1., 0., 0., 1., 0., 0.)
INHERITED = {'fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity',
             'stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset',
             'font-family','font-size','font-weight','font-style','text-anchor',
             'letter-spacing','color','font-feature-settings','visibility'}
PAINTED = {'rect','circle','ellipse','line','path','polyline','polygon','text'}
IGNORED = {'title','desc','metadata','style','defs'}
FORBIDDEN_PROPERTIES = {'clip-path','mask','filter','mix-blend-mode','isolation'}


def tag(element):
    return element.tag.rsplit('}', 1)[-1]


def number(value, default=0.):
    if value is None or value == '':
        return default
    match = re.fullmatch(r'\s*('+NUMBER+r')(?:px)?\s*', str(value))
    if not match:
        raise ValueError(f'Unsupported SVG numeric unit/value: {value!r}')
    result = float(match.group(1))
    if not math.isfinite(result):
        raise ValueError('Non-finite SVG value')
    return result


def numbers(text):
    return [float(x) for x in re.findall(NUMBER, text or '')]


def mul(left, right):
    a,b,c,d,e,f = left; g,h,i,j,k,l = right
    return (a*g+c*h, b*g+d*h, a*i+c*j, b*i+d*j, a*k+c*l+e, b*k+d*l+f)


def point(matrix, x, y):
    a,b,c,d,e,f = matrix
    return [a*x+c*y+e, b*x+d*y+f]


def transform(value):
    if not value:
        return IDENTITY
    matrix = IDENTITY
    cursor = 0
    for match in re.finditer(r'([A-Za-z]+)\s*\(([^)]*)\)', value):
        if value[cursor:match.start()].strip(' ,\t\n'):
            raise ValueError(f'Malformed transform: {value}')
        cursor = match.end()
        name, vals = match.group(1), numbers(match.group(2))
        if name == 'matrix' and len(vals) == 6:
            item = tuple(vals)
        elif name == 'translate' and len(vals) in (1,2):
            item = (1,0,0,1,vals[0],vals[1] if len(vals)==2 else 0)
        elif name == 'scale' and len(vals) in (1,2):
            item = (vals[0],0,0,vals[-1],0,0)
        elif name == 'rotate' and len(vals) in (1,3):
            angle = math.radians(vals[0]); c,s = math.cos(angle),math.sin(angle)
            item = (c,s,-s,c,0,0)
            if len(vals)==3:
                item = mul(mul((1,0,0,1,vals[1],vals[2]),item),(1,0,0,1,-vals[1],-vals[2]))
        elif name in ('skewX','skewY') and len(vals)==1:
            t=math.tan(math.radians(vals[0]));item=(1,0,t,1,0,0) if name=='skewX' else (1,t,0,1,0,0)
        else:
            raise ValueError(f'Unsupported transform: {match.group(0)}')
        matrix=mul(matrix,item)
    if value[cursor:].strip(' ,\t\n'):
        raise ValueError(f'Malformed transform: {value}')
    return matrix


def arc_cubics(x1,y1,rx,ry,rotation,large,sweep,x2,y2):
    """SVG endpoint arc to <=90-degree cubic segments (SVG 1.1 F.6)."""
    if x1==x2 and y1==y2:
        return []
    rx,ry=abs(rx),abs(ry)
    if not rx or not ry:
        return [['L',x2,y2]]
    if large not in (0,1) or sweep not in (0,1):
        raise ValueError('SVG arc flags must be 0 or 1')
    phi=math.radians(rotation%360); cp,sp=math.cos(phi),math.sin(phi)
    dx,dy=(x1-x2)/2,(y1-y2)/2
    xp,yp=cp*dx+sp*dy,-sp*dx+cp*dy
    lam=xp*xp/(rx*rx)+yp*yp/(ry*ry)
    if lam>1:
        k=math.sqrt(lam);rx*=k;ry*=k
    numerator=max(0.,rx*rx*ry*ry-rx*rx*yp*yp-ry*ry*xp*xp)
    denom=rx*rx*yp*yp+ry*ry*xp*xp
    coef=(1 if large!=sweep else -1)*math.sqrt(numerator/denom) if denom else 0.
    cxp,cyp=coef*rx*yp/ry,-coef*ry*xp/rx
    cx=cp*cxp-sp*cyp+(x1+x2)/2; cy=sp*cxp+cp*cyp+(y1+y2)/2
    ux,uy=(xp-cxp)/rx,(yp-cyp)/ry
    vx,vy=(-xp-cxp)/rx,(-yp-cyp)/ry
    theta=math.atan2(uy,ux);delta=math.atan2(ux*vy-uy*vx,ux*vx+uy*vy)
    if not sweep and delta>0:delta-=2*math.pi
    if sweep and delta<0:delta+=2*math.pi
    count=max(1,math.ceil(abs(delta)/(math.pi/2)));step=delta/count
    def loc(t):return (cx+rx*cp*math.cos(t)-ry*sp*math.sin(t),cy+rx*sp*math.cos(t)+ry*cp*math.sin(t))
    def deriv(t):return (-rx*cp*math.sin(t)-ry*sp*math.cos(t),-rx*sp*math.sin(t)+ry*cp*math.cos(t))
    result=[]
    for i in range(count):
        t1,t2=theta+i*step,theta+(i+1)*step;k=4/3*math.tan(step/4)
        p1,p2=loc(t1),loc(t2);d1,d2=deriv(t1),deriv(t2)
        result.append(['C',p1[0]+k*d1[0],p1[1]+k*d1[1],p2[0]-k*d2[0],p2[1]-k*d2[1],p2[0],p2[1]])
    result[-1][-2:]=[x2,y2]
    return result


def parse_path(data):
    tokens=re.findall(r'[A-Za-z]|'+NUMBER,data or '')
    stripped=re.sub(r'[A-Za-z]|'+NUMBER+r'|[\s,]','',data or '')
    if stripped:raise ValueError(f'Invalid SVG path characters: {stripped!r}')
    result=[];i=0;cmd=None;x=y=sx=sy=0.;prev='';cubic=None;quad=None
    arity={'M':2,'L':2,'H':1,'V':1,'C':6,'S':4,'Q':4,'T':2,'A':7,'Z':0}
    while i<len(tokens):
        if tokens[i].isalpha():cmd=tokens[i];i+=1
        if not cmd or cmd.upper() not in arity:raise ValueError(f'Unsupported path command: {cmd}')
        upper=cmd.upper();rel=cmd.islower();n=arity[upper]
        if upper=='Z':
            result.append(['Z']);x,y=sx,sy;cubic=quad=None;prev='Z';cmd=None;continue
        if i+n>len(tokens) or any(t.isalpha() for t in tokens[i:i+n]):raise ValueError('Missing SVG path coordinates')
        vals=list(map(float,tokens[i:i+n]));i+=n
        def xy(a,b):return (a+x,b+y) if rel else (a,b)
        oldx,oldy=x,y
        if upper in ('M','L','T'):
            nx,ny=xy(*vals)
            if upper=='T':
                qx,qy=(2*x-quad[0],2*y-quad[1]) if prev in ('Q','T') else (x,y)
                result.append(['Q',qx,qy,nx,ny]);quad=(qx,qy)
            else:
                result.append([upper,nx,ny])
                if upper=='M':sx,sy=nx,ny;cmd='l' if rel else 'L'
            x,y=nx,ny
        elif upper=='H':x=vals[0]+x if rel else vals[0];result.append(['L',x,y])
        elif upper=='V':y=vals[0]+y if rel else vals[0];result.append(['L',x,y])
        elif upper=='C':
            p1=xy(*vals[:2]);p2=xy(*vals[2:4]);x,y=xy(*vals[4:6]);result.append(['C',*p1,*p2,x,y]);cubic=p2
        elif upper=='S':
            p1=(2*x-cubic[0],2*y-cubic[1]) if prev in ('C','S') else (x,y)
            p2=xy(*vals[:2]);x,y=xy(*vals[2:4]);result.append(['C',*p1,*p2,x,y]);cubic=p2
        elif upper=='Q':
            q=xy(*vals[:2]);x,y=xy(*vals[2:]);result.append(['Q',*q,x,y]);quad=q
        elif upper=='A':
            nx,ny=xy(*vals[-2:]);result.extend(arc_cubics(x,y,*vals[:5],nx,ny));x,y=nx,ny
        if upper not in ('C','S'):cubic=None
        if upper not in ('Q','T'):quad=None
        prev=upper
    return result


def transformed(commands, matrix):
    return [[item[0],*[n for i in range(1,len(item),2) for n in point(matrix,*item[i:i+2])]] for item in commands]


def bounds(commands):
    """Conservative control-point bounds, valid for editing and native xfrm."""
    points=[item[i:i+2] for item in commands for i in range(1,len(item),2)]
    if not points:return [0.,0.,0.,0.]
    xs,ys=zip(*points);return [min(xs),min(ys),max(xs)-min(xs),max(ys)-min(ys)]


def union(boxes):
    if not boxes:return [0.,0.,0.,0.]
    left=min(b[0] for b in boxes);top=min(b[1] for b in boxes)
    return [left,top,max(b[0]+b[2] for b in boxes)-left,max(b[1]+b[3] for b in boxes)-top]


def rect_commands(x,y,w,h,rx=0,ry=0):
    rx=min(w/2,max(0,rx));ry=min(h/2,max(0,ry))
    if not rx or not ry:return [['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']]
    k=.5522847498307936
    return [['M',x+rx,y],['L',x+w-rx,y],['C',x+w-rx+k*rx,y,x+w,y+ry-k*ry,x+w,y+ry],
            ['L',x+w,y+h-ry],['C',x+w,y+h-ry+k*ry,x+w-rx+k*rx,y+h,x+w-rx,y+h],
            ['L',x+rx,y+h],['C',x+rx-k*rx,y+h,x,y+h-ry+k*ry,x,y+h-ry],
            ['L',x,y+ry],['C',x,y+ry-k*ry,x+rx-k*rx,y,x+rx,y],['Z']]


def ellipse_commands(cx,cy,rx,ry):
    k=.5522847498307936
    return [['M',cx+rx,cy],['C',cx+rx,cy+k*ry,cx+k*rx,cy+ry,cx,cy+ry],
            ['C',cx-k*rx,cy+ry,cx-rx,cy+k*ry,cx-rx,cy],
            ['C',cx-rx,cy-k*ry,cx-k*rx,cy-ry,cx,cy-ry],
            ['C',cx+k*rx,cy-ry,cx+rx,cy-k*ry,cx+rx,cy],['Z']]


def color(value,current='#000000'):
    value=(value or 'none').strip()
    if value=='none':return None
    if value=='currentColor':value=current
    names={'black':'#000000','white':'#ffffff','transparent':'#00000000'}
    value=names.get(value.lower(),value)
    if value.startswith('#'):
        h=value[1:]
        if len(h) in (3,4):h=''.join(c*2 for c in h)
        if len(h) not in (6,8) or re.search('[^a-fA-F0-9]',h):raise ValueError(f'Invalid SVG color: {value}')
        return {'color':h[:6].upper(),'alpha':int(h[6:8],16)/255 if len(h)==8 else 1.}
    m=re.fullmatch(r'rgba?\(([^)]*)\)',value)
    if m:
        vals=[v.strip() for v in m.group(1).split(',')]
        if len(vals) not in (3,4):raise ValueError(f'Invalid RGB color: {value}')
        rgb=[round(float(x[:-1])*2.55) if x.endswith('%') else round(float(x)) for x in vals[:3]]
        if any(not 0<=x<=255 for x in rgb):raise ValueError('RGB channel outside 0..255')
        return {'color':''.join(f'{v:02X}' for v in rgb),'alpha':float(vals[3]) if len(vals)==4 else 1.}
    raise ValueError(f'Unsupported paint (gradients/patterns require explicit implementation): {value}')


class TextMetrics:
    """Pango logical and glyph-ink rectangles relative to a real baseline."""
    class Rect(ctypes.Structure):
        _fields_=[('x',ctypes.c_int),('y',ctypes.c_int),('width',ctypes.c_int),('height',ctypes.c_int)]
    def __init__(self):
        def library(name):
            found=ctypes.util.find_library(name)
            if not found:
                matches=list(Path('/opt/homebrew/lib').glob(f'lib{name}*.dylib'))
                found=str(matches[0]) if matches else None
            if not found:raise RuntimeError(f'Native text measurement requires local {name}.')
            return ctypes.CDLL(found)
        self.p=library('pango-1.0');self.pc=library('pangocairo-1.0');self.g=library('gobject-2.0');self.cairo=library('cairo')
        self.pc.pango_cairo_font_map_get_default.restype=ctypes.c_void_p
        self.pc.pango_cairo_font_map_new_for_font_type.argtypes=[ctypes.c_int]
        self.pc.pango_cairo_font_map_new_for_font_type.restype=ctypes.c_void_p
        self.p.pango_font_map_create_context.argtypes=[ctypes.c_void_p];self.p.pango_font_map_create_context.restype=ctypes.c_void_p
        self.p.pango_layout_new.argtypes=[ctypes.c_void_p];self.p.pango_layout_new.restype=ctypes.c_void_p
        self.p.pango_font_description_new.restype=ctypes.c_void_p
        for n,types in [('pango_font_description_set_family',[ctypes.c_void_p,ctypes.c_char_p]),
                        ('pango_font_description_set_weight',[ctypes.c_void_p,ctypes.c_int]),
                        ('pango_font_description_set_style',[ctypes.c_void_p,ctypes.c_int]),
                        ('pango_font_description_set_absolute_size',[ctypes.c_void_p,ctypes.c_double]),
                        ('pango_layout_set_font_description',[ctypes.c_void_p,ctypes.c_void_p]),
                        ('pango_layout_set_text',[ctypes.c_void_p,ctypes.c_char_p,ctypes.c_int]),
                        ('pango_layout_get_extents',[ctypes.c_void_p,ctypes.POINTER(self.Rect),ctypes.POINTER(self.Rect)]),
                        ('pango_layout_get_baseline',[ctypes.c_void_p]),
                        ('pango_font_description_free',[ctypes.c_void_p]),
                        ('pango_layout_set_attributes',[ctypes.c_void_p,ctypes.c_void_p]),
                        ('pango_attr_list_insert',[ctypes.c_void_p,ctypes.c_void_p]),
                        ('pango_attr_list_unref',[ctypes.c_void_p])]:
            getattr(self.p,n).argtypes=types
        self.p.pango_attr_list_new.restype=ctypes.c_void_p
        self.p.pango_attr_letter_spacing_new.argtypes=[ctypes.c_int];self.p.pango_attr_letter_spacing_new.restype=ctypes.c_void_p
        self.p.pango_attr_font_features_new.argtypes=[ctypes.c_char_p];self.p.pango_attr_font_features_new.restype=ctypes.c_void_p
        self.g.g_object_unref.argtypes=[ctypes.c_void_p]
        # macOS's default Cairo font map is CoreText. It ignores the caller's
        # explicit Fontconfig file and can silently measure fallback faces.
        # CAIRO_FONT_TYPE_FT (1) selects Pango's Fontconfig/FreeType backend.
        self.fontmap=self.pc.pango_cairo_font_map_new_for_font_type(1)
        if not self.fontmap:raise RuntimeError('A Fontconfig/FreeType Pango backend is required to measure the bundled fonts.')
        self.context=self.p.pango_font_map_create_context(self.fontmap)
        self.p.pango_context_set_round_glyph_positions.argtypes=[ctypes.c_void_p,ctypes.c_int]
        self.p.pango_context_set_round_glyph_positions(self.context,0)
        self.cairo.cairo_font_options_create.restype=ctypes.c_void_p
        self.cairo.cairo_font_options_set_hint_metrics.argtypes=[ctypes.c_void_p,ctypes.c_int]
        self.cairo.cairo_font_options_destroy.argtypes=[ctypes.c_void_p]
        self.pc.pango_cairo_context_set_font_options.argtypes=[ctypes.c_void_p,ctypes.c_void_p]
        options=self.cairo.cairo_font_options_create()
        # CAIRO_HINT_METRICS_OFF (1) retains real hhea ascent/descent. Glyph
        # rounding alone leaves Manrope108's115.12793 ascent rounded to116.
        self.cairo.cairo_font_options_set_hint_metrics(options,1)
        self.pc.pango_cairo_context_set_font_options(self.context,options)
        self.cairo.cairo_font_options_destroy(options)
        self.cache={}
    def measure(self,text,family,size,weight=400,italic=False,letter_spacing=0,features=''):
        key=(text,family,size,weight,italic,letter_spacing,features)
        if key in self.cache:return copy.deepcopy(self.cache[key])
        layout=self.p.pango_layout_new(self.context);font=self.p.pango_font_description_new()
        attrs=self.p.pango_attr_list_new()
        try:
            self.p.pango_font_description_set_family(font,family.encode())
            self.p.pango_font_description_set_weight(font,weight)
            self.p.pango_font_description_set_style(font,2 if italic else 0)
            self.p.pango_font_description_set_absolute_size(font,size*1024)
            self.p.pango_layout_set_font_description(layout,font)
            self.p.pango_layout_set_text(layout,text.encode(),-1)
            if letter_spacing:self.p.pango_attr_list_insert(attrs,self.p.pango_attr_letter_spacing_new(round(letter_spacing*1024)))
            if features:
                normalized=re.sub(r'["\']([a-zA-Z0-9]+)["\']\s+(\d+)',r'\1=\2',features)
                self.p.pango_attr_list_insert(attrs,self.p.pango_attr_font_features_new(normalized.encode()))
            self.p.pango_layout_set_attributes(layout,attrs)
            ink,logical=self.Rect(),self.Rect()
            self.p.pango_layout_get_extents(layout,ctypes.byref(ink),ctypes.byref(logical))
            baseline=self.p.pango_layout_get_baseline(layout)/1024
            result={'width':logical.width/1024,'height':logical.height/1024,
                    'ascent':baseline-logical.y/1024,'descent':(logical.y+logical.height)/1024-baseline,
                    'ink':[ink.x/1024,ink.y/1024-baseline,ink.width/1024,ink.height/1024],
                    'method':'Pango native logical and ink extents'}
            self.cache[key]=result;return copy.deepcopy(result)
        finally:
            self.p.pango_attr_list_unref(attrs);self.p.pango_font_description_free(font);self.g.g_object_unref(layout)


_METRICS=None
def metrics():
    global _METRICS
    if _METRICS is None:_METRICS=TextMetrics()
    return _METRICS


def declarations(text):
    return {m.group(1).strip():m.group(2).strip() for m in re.finditer(r'([^:;{}]+):([^;{}]+)',text or '')}


class Converter:
    def __init__(self,root,current_color,name):
        self.root=root;self.current_color=current_color;self.name=name
        self.defs={n.attrib['id']:n for n in root.iter() if 'id' in n.attrib}
        self.css=[];self.counter=0;self.warnings=[]
        for node in root.iter():
            if tag(node)=='style':
                css=re.sub(r'/\*.*?\*/','',node.text or '',flags=re.S)
                css=re.sub(r'@font-face\s*\{[^}]*\}','',css,flags=re.S)
                for match in re.finditer(r'([^{}]+)\{([^{}]*)\}',css):
                    for selector in match.group(1).split(','):
                        selector=selector.strip()
                        if not re.fullmatch(r'(?:[\w-]+)?(?:[.#][\w-]+)*|\*',selector):
                            raise ValueError(f'Unsupported SVG CSS selector: {selector}')
                        self.css.append((selector,declarations(match.group(2))))
    def style(self,node,inherited):
        style={k:v for k,v in inherited.items() if k in INHERITED}
        # Presentation attributes have lower specificity than author CSS rules.
        style.update({k:v for k,v in node.attrib.items() if k in INHERITED or k in ('opacity','marker-start','marker-mid','marker-end','vector-effect','display')})
        matched=[]
        for i,(selector,decl) in enumerate(self.css):
            tagname=re.match(r'^[\w-]+',selector);classes=re.findall(r'\.([\w-]+)',selector);ids=re.findall(r'#([\w-]+)',selector)
            if ((not tagname or tagname.group()==tag(node)) and all(c in node.get('class','').split() for c in classes)
                and all(node.get('id')==s for s in ids)):
                matched.append((len(ids)*100+len(classes)*10+(1 if tagname else 0),i,decl))
        for _,_,decl in sorted(matched):style.update(decl)
        style.update(declarations(node.get('style','')))
        for prop in FORBIDDEN_PROPERTIES:
            val=style.get(prop,node.get(prop))
            if val and val not in ('none','normal','auto'):raise ValueError(f'Unsupported SVG effect: {prop}={val}')
        for key in ('fill','stroke'):
            if style.get(key)=='inherit':style[key]=inherited.get(key,'black' if key=='fill' else 'none')
        return style
    def name_of(self,node,suffix=''):
        self.counter+=1
        name=node.get('data-component') or node.get('aria-label') or node.get('id') or tag(node)
        return f'{name}{suffix} · {self.counter}'
    def walk(self,node,matrix=IDENTITY,inherited=None,opacity=1.,marker=False):
        kind=tag(node)
        if kind in IGNORED:return []
        if kind not in PAINTED|{'g','svg'}:raise ValueError(f'Unsupported SVG element: {kind}')
        inherited=inherited or {'fill':'black','stroke':'none','color':self.current_color,'font-family':'Arial','font-size':'16','font-weight':'400'}
        style=self.style(node,inherited)
        if style.get('display')=='none' or style.get('visibility')=='hidden':return []
        matrix=mul(matrix,transform(node.get('transform')))
        opacity*=number(style.get('opacity'),1)
        if not 0<=opacity<=1:raise ValueError('Opacity outside 0..1')
        if kind in ('g','svg'):
            children=[]
            for child in node:children.extend(self.walk(child,matrix,style,opacity))
            if not children:return []
            return [{'kind':'group','name':self.name_of(node),'component':node.get('data-component'),
                     'children':children,'bbox':union([c['bbox'] for c in children])}]
        current=style.get('color',self.current_color)
        fill=color(style.get('fill','black'),current)
        stroke=color(style.get('stroke','none'),current)
        scale=math.sqrt(abs(matrix[0]*matrix[3]-matrix[1]*matrix[2]))
        if fill:fill['alpha']*=opacity*number(style.get('fill-opacity'),1)
        if stroke:
            stroke.update(width=number(style.get('stroke-width'),1)*scale,
                          alpha=stroke['alpha']*opacity*number(style.get('stroke-opacity'),1),
                          cap=style.get('stroke-linecap','butt'),join=style.get('stroke-linejoin','miter'),
                          dash=[v*scale for v in numbers(style.get('stroke-dasharray'))] if style.get('stroke-dasharray','none')!='none' else [],
                          dashOffset=number(style.get('stroke-dashoffset'))*scale,
                          nonScaling=style.get('vector-effect')=='non-scaling-stroke')
            if stroke['dashOffset']:raise ValueError('Non-zero stroke dash offset is unsupported in native PowerPoint geometry')
        if kind=='text':return [self.text(node,matrix,style,fill)]
        if not fill and not stroke:return []
        if style.get('fill-rule','nonzero')!='nonzero':raise ValueError('Even-odd fill requires explicit path winding conversion')
        primitive=None
        if kind=='path':commands=parse_path(node.get('d',''))
        elif kind=='line':commands=[['M',number(node.get('x1')),number(node.get('y1'))],['L',number(node.get('x2')),number(node.get('y2'))]];fill=None
        elif kind in ('polyline','polygon'):
            vals=numbers(node.get('points'))
            if len(vals)%2:raise ValueError('Odd number of polygon coordinates')
            commands=[['M' if i==0 else 'L',*vals[i:i+2]] for i in range(0,len(vals),2)]
            if kind=='polygon':commands.append(['Z'])
        elif kind=='rect':
            x,y,w,h=[number(node.get(k)) for k in ('x','y','width','height')]
            if w<0 or h<0:raise ValueError('Negative SVG rect size')
            rx=number(node.get('rx',node.get('ry')));ry=number(node.get('ry',node.get('rx')))
            commands=rect_commands(x,y,w,h,rx,ry)
            if abs(matrix[1])+abs(matrix[2])<1e-9 and matrix[0]>0 and matrix[3]>0:
                xx,yy=point(matrix,x,y);primitive={'shape':'roundRect' if rx and ry else 'rect','x':xx,'y':yy,'w':w*matrix[0],'h':h*matrix[3],'rx':rx*matrix[0],'ry':ry*matrix[3]}
        elif kind in ('circle','ellipse'):
            cx,cy=number(node.get('cx')),number(node.get('cy'))
            rx=number(node.get('r' if kind=='circle' else 'rx'));ry=number(node.get('r' if kind=='circle' else 'ry'))
            commands=ellipse_commands(cx,cy,rx,ry)
            if abs(matrix[1])+abs(matrix[2])<1e-9 and matrix[0]>0 and matrix[3]>0:
                xx,yy=point(matrix,cx-rx,cy-ry);primitive={'shape':'ellipse','x':xx,'y':yy,'w':2*rx*matrix[0],'h':2*ry*matrix[3]}
        else:raise AssertionError(kind)
        raw_commands=commands;commands=transformed(commands,matrix)
        if not commands:return []
        item={'kind':'path','name':self.name_of(node),'commands':commands,'bbox':bounds(commands),'fill':fill,'stroke':stroke,'sourceTag':kind}
        if primitive:item['primitive']=primitive
        markers=[]
        for side in ('start','mid','end'):
            reference=style.get('marker-'+side,node.get('marker-'+side))
            if not reference or reference=='none':continue
            if side=='mid':raise ValueError('Mid-path markers are not currently supported')
            match=re.fullmatch(r'url\(\s*["\']?#([^\s)"\']+)["\']?\s*\)',reference)
            if not match or match.group(1) not in self.defs:raise ValueError(f'Unknown SVG marker: {reference}')
            markers.extend(self.marker(self.defs[match.group(1)],raw_commands,matrix,number(style.get('stroke-width'),1),side,opacity))
        if markers:
            children=[item,*markers]
            return [{'kind':'group','name':item['name']+' + arrowhead','children':children,'bbox':union([c['bbox'] for c in children]),'component':'connector'}]
        return [item]
    def marker(self,marker,commands,matrix,stroke_width,side,opacity):
        segments=[];current=None;substart=None
        for command in commands:
            c=command[0]
            if c=='M':current=command[1:];substart=current
            elif c=='Z':
                if current!=substart:segments.append((current,substart,current,substart))
                current=substart
            else:
                end=command[-2:]
                start_tangent=command[1:3] if c in ('C','Q') else end
                end_tangent=command[-4:-2] if c in ('C','Q') else current
                segments.append((current,end,start_tangent,end_tangent));current=end
        if not segments:return []
        segment=segments[0] if side=='start' else segments[-1]
        anchor=segment[0] if side=='start' else segment[1]
        tangent=(segment[2][0]-segment[0][0],segment[2][1]-segment[0][1]) if side=='start' else (segment[1][0]-segment[3][0],segment[1][1]-segment[3][1])
        if tangent==(0,0):tangent=(segment[1][0]-segment[0][0],segment[1][1]-segment[0][1])
        orient=marker.get('orient','0')
        angle=math.atan2(tangent[1],tangent[0]) if orient in ('auto','auto-start-reverse') else math.radians(number(orient))
        if orient=='auto-start-reverse' and side=='start':angle+=math.pi
        width,height=number(marker.get('markerWidth'),3),number(marker.get('markerHeight'),3)
        unit=stroke_width if marker.get('markerUnits','strokeWidth')=='strokeWidth' else 1.
        if marker.get('markerUnits','strokeWidth') not in ('strokeWidth','userSpaceOnUse'):raise ValueError('Unsupported markerUnits')
        refx,refy=number(marker.get('refX')),number(marker.get('refY'))
        if marker.get('viewBox'):
            vx,vy,vw,vh=numbers(marker.get('viewBox'));sx,sy=width/vw,height/vh
            if marker.get('preserveAspectRatio','xMidYMid meet')!='none':
                s=min(sx,sy);view=(s,0,0,s,(width-vw*s)/2-vx*s,(height-vh*s)/2-vy*s)
            else:view=(sx,0,0,sy,-vx*sx,-vy*sy)
            refx,refy=point(view,refx,refy)
        else:view=IDENTITY
        c,s=math.cos(angle),math.sin(angle)
        local=mul(mul(mul((1,0,0,1,*anchor),(c,s,-s,c,0,0)),(unit,0,0,unit,0,0)),(1,0,0,1,-refx,-refy))
        local=mul(mul(matrix,local),view)
        children=[]
        for child in marker:children.extend(self.walk(child,local,{'fill':'black','stroke':'none','color':self.current_color},opacity,True))
        if not children:return []
        return [{'kind':'group','name':marker.get('id','arrow')+' '+side,'component':'arrowhead','children':children,'bbox':union([c['bbox'] for c in children])}]
    def text(self,node,matrix,style,fill):
        if list(node):raise ValueError('SVG text spans require explicit line/span conversion; unsupported in these source drawings')
        if style.get('font-style','normal') not in ('normal','italic'):raise ValueError('Unsupported font style')
        if abs(matrix[1])+abs(matrix[2])>1e-8 or matrix[0]<=0 or matrix[3]<=0:raise ValueError('Rotated/skewed/reflected SVG text requires explicit native text-box rotation support')
        if abs(matrix[0]-matrix[3])>1e-6:raise ValueError('Nonuniform SVG text scaling cannot be represented by editable PowerPoint text without distortion')
        if node.get('textLength') or node.get('lengthAdjust'):raise ValueError('SVG textLength is unsupported')
        value=''.join(node.itertext())
        if not value:return {'kind':'text','name':self.name_of(node),'text':'','bbox':[0,0,0,0],'fontSize':0}
        x,y=point(matrix,number(node.get('x'))+number(node.get('dx')),number(node.get('y'))+number(node.get('dy')))
        fs=number(style.get('font-size'),16)*matrix[3]
        family=style.get('font-family','Arial').split(',')[0].strip(' "\'')
        rawweight=style.get('font-weight','400');weight=int({'normal':'400','bold':'700'}.get(rawweight,rawweight))
        spacing=number(style.get('letter-spacing'),0)*matrix[0]
        features=style.get('font-feature-settings','')
        measured=metrics().measure(value,family,fs,weight,style.get('font-style')=='italic',spacing,features)
        anchor=style.get('text-anchor','start')
        if anchor not in ('start','middle','end'):raise ValueError('Unsupported text-anchor')
        left=x-measured['width']*{'start':0,'middle':.5,'end':1}[anchor]
        ink=measured['ink'];ibox=[left+ink[0],y+ink[1],ink[2],ink[3]]
        return {'kind':'text','name':self.name_of(node),'text':value,'x':x,'y':y,'fontFamily':family,
                'fontSize':fs,'fontWeight':weight,'fontStyle':style.get('font-style','normal'),
                'letterSpacing':spacing,'fontFeatures':features,'anchor':anchor,'fill':fill,
                'bbox':[left,y-measured['ascent'],measured['width'],measured['height']],
                'inkBBox':ibox,'metrics':measured}


def convert_svg(svg_text, *, current_color='#000000', name=None):
    root=ET.fromstring(svg_text)
    if tag(root)!='svg':raise ValueError('SVG root required')
    vb=numbers(root.get('viewBox'))
    if not vb:vb=[0,0,number(root.get('width')),number(root.get('height'))]
    if len(vb)!=4 or vb[2]<=0 or vb[3]<=0:raise ValueError('SVG needs a positive four-number viewBox')
    converter=Converter(root,current_color,name)
    elements=converter.walk(root)
    if len(elements)==1 and elements[0]['kind']=='group':elements=elements[0]['children']
    title=next((''.join(n.itertext()) for n in root if tag(n)=='title'),None)
    drawing={'schema':'editable-svg-1','name':name or title or root.get('aria-label') or 'Editable vector drawing',
             'viewBox':vb,'width':number(root.get('width'),vb[2]),'height':number(root.get('height'),vb[3]),
             'preserveAspectRatio':root.get('preserveAspectRatio','xMidYMid meet'),
             'elements':elements,'bbox':union([e['bbox'] for e in elements]),
             'warnings':converter.warnings,'sourceSha256':hashlib.sha256(svg_text.encode()).hexdigest()}
    return drawing


def sub(parent,ns,name,attrs=None,text=None):
    node=ET.SubElement(parent,f'{{{ns}}}{name}',{k:str(v) for k,v in (attrs or {}).items()})
    if text is not None:node.text=text
    return node


def solid(parent,paint):
    if not paint or paint.get('alpha',1)<=0:sub(parent,A,'noFill');return
    fill=sub(parent,A,'solidFill');rgb=sub(fill,A,'srgbClr',{'val':paint['color']})
    if paint.get('alpha',1)<1:sub(rgb,A,'alpha',{'val':max(0,min(100000,round(paint['alpha']*100000)))})


class DrawingMLEncoder:
    def __init__(self,drawing,placement,start_id,emu_per_px):
        self.next_id=start_id;self.emu=emu_per_px;self.drawing=drawing
        vx,vy,vw,vh=drawing['viewBox'];self.sx=placement['w']/vw;self.sy=placement['h']/vh
        self.ox=placement['x']-vx*self.sx;self.oy=placement['y']-vy*self.sy
        par=drawing.get('preserveAspectRatio','xMidYMid meet').strip()
        if par!='none':
            match=re.fullmatch(r'(?:defer\s+)?(x(?:Min|Mid|Max)Y(?:Min|Mid|Max))(?:\s+(meet|slice))?',par)
            if not match:raise ValueError(f'Unsupported preserveAspectRatio: {par}')
            align,mode=match.group(1),match.group(2) or 'meet'
            if mode=='slice':raise ValueError('SVG slice viewport requires native clipping support')
            s=min(self.sx,self.sy);mx={'Min':0,'Mid':.5,'Max':1}[align[1:4]];my={'Min':0,'Mid':.5,'Max':1}[align[5:8]]
            self.sx=self.sy=s;self.ox=placement['x']+(placement['w']-vw*s)*mx-vx*s;self.oy=placement['y']+(placement['h']-vh*s)*my-vy*s
        self.audit={'nativeGroups':0,'nativeShapes':0,'nativeTextBoxes':0,'pictures':0,'text':[],
                    'sourceSha256':drawing.get('sourceSha256'),'warnings':list(drawing.get('warnings',[]))}
    def id(self):
        value=self.next_id;self.next_id+=1;return value
    def pxpoint(self,x,y):return [self.ox+x*self.sx,self.oy+y*self.sy]
    def xy(self,x,y):return [round(v*self.emu) for v in self.pxpoint(x,y)]
    def box(self,b):
        x,y=self.xy(b[0],b[1]);return [x,y,max(1,round(b[2]*self.sx*self.emu)),max(1,round(b[3]*self.sy*self.emu))]
    def group(self,items,name,bbox):
        g=ET.Element(f'{{{P}}}grpSp');nv=sub(g,P,'nvGrpSpPr');sub(nv,P,'cNvPr',{'id':self.id(),'name':name});sub(nv,P,'cNvGrpSpPr');sub(nv,P,'nvPr')
        prop=sub(g,P,'grpSpPr');xfrm=sub(prop,A,'xfrm');x,y,w,h=self.box(bbox)
        for t,a in [('off',{'x':x,'y':y}),('ext',{'cx':w,'cy':h}),('chOff',{'x':x,'y':y}),('chExt',{'cx':w,'cy':h})]:sub(xfrm,A,t,a)
        self.audit['nativeGroups']+=1
        for item in items:g.append(self.element(item))
        return g
    def element(self,item):
        if item['kind']=='group':return self.group(item['children'],item['name'],item['bbox'])
        sp=ET.Element(f'{{{P}}}sp');nv=sub(sp,P,'nvSpPr');shapeid=self.id()
        sub(nv,P,'cNvPr',{'id':shapeid,'name':item['name']});sub(nv,P,'cNvSpPr',{'txBox':'1'} if item['kind']=='text' else {});sub(nv,P,'nvPr')
        prop=sub(sp,P,'spPr');xf=sub(prop,A,'xfrm');x,y,w,h=self.box(item['bbox'])
        if item['kind']=='text':
            if abs(self.sx-self.sy)>1e-6:raise ValueError('Drawing placement nonuniformly scales editable text')
            # Native text uses a padded editing box with a baseline based on
            # Pango's real font ascent. The 0-margin body retains one line.
            fs=item['fontSize']*self.sy*self.emu/12700
            x-=round(.25*self.emu);w+=round(.5*self.emu)
            h+=round(item['fontSize']*.16*self.sy*self.emu)
            sub(xf,A,'off',{'x':x,'y':y});sub(xf,A,'ext',{'cx':w,'cy':h})
            geom=sub(prop,A,'prstGeom',{'prst':'rect'});sub(geom,A,'avLst');sub(prop,A,'noFill');ln=sub(prop,A,'ln');sub(ln,A,'noFill')
            tb=sub(sp,P,'txBody');body=sub(tb,A,'bodyPr',{'wrap':'none','lIns':'0','tIns':'0','rIns':'0','bIns':'0','anchor':'t','anchorCtr':'0','vertOverflow':'overflow','horzOverflow':'overflow'});sub(body,A,'noAutofit');sub(tb,A,'lstStyle')
            para=sub(tb,A,'p');align={'start':'l','middle':'ctr','end':'r'}[item['anchor']]
            pp=sub(para,A,'pPr',{'algn':align,'marL':'0','marR':'0','indent':'0','fontAlgn':'base'})
            ls=sub(pp,A,'lnSpc');sub(ls,A,'spcPts',{'val':round(item['metrics']['height']*self.sy*self.emu/12700*100)})
            for field in ('spcBef','spcAft'):sub(sub(pp,A,field),A,'spcPts',{'val':'0'})
            run=sub(para,A,'r');rp=sub(run,A,'rPr',{'lang':'en-US','sz':max(100,round(fs*100)),'b':'1' if item['fontWeight']>=600 else '0',
                         'i':'1' if item.get('fontStyle')=='italic' else '0','kern':'0',
                         'spc':round(item.get('letterSpacing',0)*self.sx*self.emu/12700*100),'dirty':'0'})
            solid(rp,item['fill']);sub(rp,A,'latin',{'typeface':item['fontFamily']});sub(rp,A,'ea',{'typeface':item['fontFamily']});sub(rp,A,'cs',{'typeface':item['fontFamily']})
            sub(run,A,'t',text=item['text']);sub(para,A,'endParaRPr',{'lang':'en-US','sz':round(fs*100)})
            self.audit['nativeTextBoxes']+=1;self.audit['text'].append({'id':shapeid,'text':item['text'],'font':item['fontFamily'],'fontSizePt':fs,
               'sourceWeight':item['fontWeight'],'nativeWeight':700 if item['fontWeight']>=600 else 400,
               'bboxPx':[x/self.emu,y/self.emu,w/self.emu,h/self.emu],'baselinePx':self.pxpoint(item['x'],item['y'])})
            return sp
        sub(xf,A,'off',{'x':x,'y':y});sub(xf,A,'ext',{'cx':w,'cy':h})
        primitive=item.get('primitive');use_primitive=primitive and (primitive['shape']!='roundRect' or abs(primitive.get('rx',0)*self.sx-primitive.get('ry',0)*self.sy)<1e-5)
        if use_primitive:
            geom=sub(prop,A,'prstGeom',{'prst':primitive['shape']});av=sub(geom,A,'avLst')
            if primitive['shape']=='roundRect':
                radius=primitive['rx']*self.sx;shorter=min(primitive['w']*self.sx,primitive['h']*self.sy)
                sub(av,A,'gd',{'name':'adj','fmla':f'val {round(min(.5,radius/shorter)*100000)}'})
        else:
            geom=sub(prop,A,'custGeom')
            for t in ('avLst','gdLst','ahLst','cxnLst'):sub(geom,A,t)
            sub(geom,A,'rect',{'l':'0','t':'0','r':'r','b':'b'})
            paths=sub(geom,A,'pathLst');path=sub(paths,A,'path',{'w':w,'h':h,'fill':'norm' if item.get('fill') else 'none','stroke':'1' if item.get('stroke') else '0','extrusionOk':'0'})
            for cmd in item['commands']:
                c=cmd[0]
                node=sub(path,A,{'M':'moveTo','L':'lnTo','C':'cubicBezTo','Q':'quadBezTo','Z':'close'}[c])
                for i in range(1,len(cmd),2):
                    xx,yy=self.xy(*cmd[i:i+2]);sub(node,A,'pt',{'x':xx-x,'y':yy-y})
        solid(prop,item.get('fill'))
        stroke=item.get('stroke')
        if stroke:
            scalefactor=1 if stroke.get('nonScaling') else math.sqrt(abs(self.sx*self.sy))
            line=sub(prop,A,'ln',{'w':max(1,round(stroke['width']*scalefactor*self.emu)),
                                  'cap':{'butt':'flat','round':'rnd','square':'sq'}.get(stroke.get('cap'),'flat'),'cmpd':'sng','algn':'ctr'})
            solid(line,stroke)
            if stroke.get('dash'):
                dash=stroke['dash'];dash=dash*2 if len(dash)%2 else dash
                cd=sub(line,A,'custDash')
                for i in range(0,len(dash),2):sub(cd,A,'ds',{'d':max(1,round(dash[i]/stroke['width']*100000)),'sp':max(1,round(dash[i+1]/stroke['width']*100000))})
            else:sub(line,A,'prstDash',{'val':'solid'})
            join=stroke.get('join','miter')
            if join=='round':sub(line,A,'round')
            elif join=='bevel':sub(line,A,'bevel')
            else:sub(line,A,'miter',{'lim':'400000'})
            sub(line,A,'headEnd',{'type':'none','w':'med','len':'med'});sub(line,A,'tailEnd',{'type':'none','w':'med','len':'med'})
        else:sub(sub(prop,A,'ln'),A,'noFill')
        self.audit['nativeShapes']+=1;return sp


def encode_drawing(drawing,placement_px,start_id=1000,emu_per_px=6350):
    for key in ('x','y','w','h'):
        if key not in placement_px or not math.isfinite(placement_px[key]):raise ValueError(f'Missing/invalid placement {key}')
    if placement_px['w']<=0 or placement_px['h']<=0:raise ValueError('Positive drawing placement required')
    encoder=DrawingMLEncoder(drawing,placement_px,start_id,emu_per_px)
    group=encoder.group(drawing['elements'],drawing['name'],drawing['bbox'])
    return ET.tostring(group,encoding='unicode'),encoder.next_id,encoder.audit


def drawing_to_svg(drawing):
    """Render the normalized JSON as SVG, retaining native text for proofing."""
    root=ET.Element('svg',{'xmlns':SVG,'width':str(drawing['width']),'height':str(drawing['height']),
                           'viewBox':' '.join(map(str,drawing['viewBox'])),'preserveAspectRatio':drawing['preserveAspectRatio']})
    def paint(attrs,item):
        f=item.get('fill');s=item.get('stroke');attrs['fill']='#'+f['color'] if f else 'none'
        if f and f.get('alpha',1)!=1:attrs['fill-opacity']=str(f['alpha'])
        if s:
            attrs.update(stroke='#'+s['color'],**{'stroke-width':str(s['width']),'stroke-linecap':s['cap'],'stroke-linejoin':s['join']})
            if s.get('alpha',1)!=1:attrs['stroke-opacity']=str(s['alpha'])
            if s.get('dash'):attrs['stroke-dasharray']=' '.join(map(str,s['dash']))
            if s.get('nonScaling'):attrs['vector-effect']='non-scaling-stroke'
    def append(parent,item):
        if item['kind']=='group':
            group=ET.SubElement(parent,'g',{'data-name':item['name']})
            for child in item['children']:append(group,child)
        elif item['kind']=='path':
            attrs={'d':' '.join(c[0]+(' '.join(f'{v:.8g}' for v in c[1:])) for c in item['commands'])};paint(attrs,item);ET.SubElement(parent,'path',attrs)
        else:
            attrs={'x':str(item['x']),'y':str(item['y']),'font-family':item['fontFamily'],'font-size':str(item['fontSize']),
                   'font-weight':str(item['fontWeight']),'text-anchor':item['anchor'],'font-style':item.get('fontStyle','normal'),
                   'letter-spacing':str(item.get('letterSpacing',0))}
            if item.get('fontFeatures'):attrs['style']='font-feature-settings:'+item['fontFeatures']
            paint(attrs,item);ET.SubElement(parent,'text',attrs).text=item['text']
    for item in drawing['elements']:append(root,item)
    return ET.tostring(root,encoding='unicode')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input',type=Path);parser.add_argument('output',type=Path)
    parser.add_argument('--xml',type=Path);parser.add_argument('--proof-svg',type=Path)
    parser.add_argument('--current-color',default='#000000');parser.add_argument('--placement',help='x,y,w,h pixels')
    args=parser.parse_args();drawing=convert_svg(args.input.read_text(),current_color=args.current_color,name=args.input.stem)
    args.output.write_text(json.dumps(drawing,indent=2)+'\n')
    if args.proof_svg:args.proof_svg.write_text(drawing_to_svg(drawing))
    if args.xml:
        vals=numbers(args.placement) if args.placement else [0,0,drawing['width'],drawing['height']]
        if len(vals)!=4:parser.error('--placement requires x,y,w,h')
        fragment,_,audit=encode_drawing(drawing,dict(zip(('x','y','w','h'),vals)))
        args.xml.write_text(fragment);print(json.dumps(audit,indent=2))


if __name__=='__main__':main()
