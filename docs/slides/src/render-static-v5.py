#!/usr/bin/env python3
"""Print the frozen teaching state with WeasyPrint when no browser is available.

The companion verifier executes the actual embedded interaction code before this
step. This renderer checks page/text geometry and emits a manifest consumed by
the existing vector PowerPoint packager. It does not test browser behavior.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse
import argparse
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
from weasyprint import HTML, CSS, default_url_fetcher
from weasyprint.text.ffi import ffi, pango, FROM_UNITS
from normalize_pdf_svg import normalize


class Reader(HTMLParser):
    def __init__(self):
        super().__init__();self.anchors=[];self.current=None;self.words=[];self.interaction=None;self.scenario=None
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='a':self.current={'url':attrs.get('href',''),'label':''}
        if 'data-interaction' in attrs:self.interaction=attrs['data-interaction']
        if 'data-trace-scenario' in attrs:self.scenario=attrs['data-trace-scenario']
    def handle_endtag(self,tag):
        if tag=='a' and self.current:self.anchors.append(self.current);self.current=None
    def handle_data(self,value):
        if value.strip():self.words.append(value.strip())
        if self.current:self.current['label']+=value


def main():
    p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('frozen');p.add_argument('artifacts')
    p.add_argument('--source',default='docs/slides/src/deck-v5.json')
    p.add_argument('--freeze-report',default='docs/slides/reviews/05-teaching-state-integrated.json')
    args=p.parse_args()
    input_path=Path(args.input).resolve();frozen=Path(args.frozen).resolve();out=Path(args.artifacts).resolve()
    out.mkdir(parents=True,exist_ok=True)
    source=Path(args.source).resolve();freeze_report=Path(args.freeze_report).resolve()
    sha=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
    inputs=[]
    def record(file,role):
        file=Path(file).resolve();entry={'role':role,'path':os.path.relpath(file,out),'sha256':sha(file)}
        inputs.append(entry);return entry
    original=input_path.read_text();data=json.loads(source.read_text());html=frozen.read_text()
    frozen_check=json.loads(freeze_report.read_text())
    if not frozen_check.get('passed') or not frozen_check.get('freeze',{}).get('sourcePreserved'):
        raise ValueError('A passing actual-script freeze report is required.')
    if frozen_check['inputSha256']!=sha(input_path) or frozen_check['freeze']['sha256']!=sha(frozen):
        raise ValueError('The frozen teaching state does not belong to this HTML input.')
    fingerprint=re.search(r'<meta name="deck-source-sha256" content="([a-f0-9]+)"',original)
    if not fingerprint or fingerprint[1]!=sha(source):raise ValueError('Source JSON and built HTML differ; rebuild the deck.')
    record(input_path,'sourceHTML');record(frozen,'frozenHTML');record(source,'sourceJSON');record(freeze_report,'freezeReport')
    ordered=[s['id'] for s in data['slides']]
    for candidate in [original,html]:
        if re.findall(r'<section\b[^>]*data-slide-id="([^"]+)"',candidate)!=ordered:
            raise ValueError('HTML and source slide order differ.')
    embedded_notes,_=json.JSONDecoder().raw_decode(original.split('const SPEAKER_NOTES = ',1)[1])
    if [n['id'] for n in embedded_notes]!=ordered:raise ValueError('Embedded notes are not in source slide order.')
    geometry_file=input_path.parent.parent/'diagrams/returns-branching-geometry-report.json'
    figure_report=json.loads(geometry_file.read_text())
    if not figure_report.get('passed'):raise ValueError('Diagram geometry must pass before printing.')
    figure_audit={a['name']+'.svg':a for a in figure_report['artifacts']}
    record(geometry_file,'diagramGeometry')
    # The same outlined geometry is used in the full print and in movable pieces.
    # The standalone interactive HTML retains the original editable SVG sources.
    def portable(match):
        name=match.group(1)
        source=input_path.parent.parent/'diagrams'/name.replace('.svg','.outlined.svg')
        raw=base64.b64decode(match.group(2).split(',',1)[1])
        check=figure_audit[name]
        diagram_source=input_path.parent.parent/'diagrams'/name
        if hashlib.sha256(raw).hexdigest()!=check['sourceSha256'] or sha(diagram_source)!=check['sourceSha256'] or sha(source)!=check['portableSha256']:
            raise ValueError(f'{name}: outlined figure and embedded source are not the verified pair.')
        record(diagram_source,'diagramSource');record(source,'diagramOutline')
        encoded=base64.b64encode(source.read_bytes()).decode()
        return match.group(0).replace(match.group(2),'data:image/svg+xml;base64,'+encoded)
    html=re.sub(r'<img\b[^>]*data-component-asset="([^"]+)"[^>]*src="([^"]+)"[^>]*>',portable,html)
    html=html.replace('Constructed trace; click Next event','Constructed trace · final static state')
    script=(Path(__file__).parent/'export-powerpoint.cjs').read_text()
    export_css=re.search(r'const exportCSS=`([\s\S]*?)`;',script)[1]
    # Explicit block sizing avoids differences in paged flex-height resolution.
    export_css+='''
    .slide .canvas-card{display:block!important}
    .slide-body{height:658px;flex:none!important}
    [data-slide-id="opening"] .slide-body{height:828px}
    .canvas-card .chrome-min{margin-bottom:38px!important}
    .duo-compare:after{display:none!important}
    .trace-eight{display:flex!important;gap:16px;height:220px}
    .trace-eight .tl-h-node{flex:1;width:204px;min-width:0}
    .trace-eight .tl-h-node .num{display:block;text-align:center;line-height:52px}
    '''
    blocked=[]
    def fetch(url,*a,**kw):
        if urlparse(url).scheme in {'http','https'}:
            blocked.append(url);raise ValueError('Remote dependencies are disabled for local export.')
        return default_url_fetcher(url,*a,**kw)
    css=CSS(string=export_css)
    document=HTML(string=html,base_url=input_path.parent.as_uri()+'/',url_fetcher=fetch).render(stylesheets=[css])
    if len(document.pages)!=len(data['slides']):raise ValueError(f'Expected {len(data["slides"])} pages, found {len(document.pages)}')
    document.write_pdf(out/'slides.pdf')
    record(out/'slides.pdf','printedPDF')
    font_report=subprocess.run(['pdffonts',str(out/'slides.pdf')],check=True,capture_output=True,text=True).stdout
    (out/'pdf-fonts.txt').write_text(font_report)
    font_rows=[re.search(r'\s+(yes|no)\s+(yes|no)\s+(yes|no)\s+\d+\s+\d+\s*$',line) for line in font_report.splitlines()[2:]]
    if not font_rows or not all(row and row[1]=='yes' for row in font_rows):raise ValueError('The PDF must embed every used font.')
    record(out/'pdf-fonts.txt','fontAudit')
    sections=re.findall(r'<section\b(?=[^>]*data-slide-id=)[\s\S]*?</section>',html)
    assert len(sections)==len(data['slides'])
    manifest={'title':data['title']+' · v5','renderEngine':'WeasyPrint 69.0 / Pango',
              'fontAudit':{'method':'pdffonts on rendered PDF','allEmbedded':True,'fontCount':len(font_rows)},
              'slides':[],'browserVerified':False,'inputProvenance':inputs}
    geometry={'method':'Pango actual glyph-ink boxes at WeasyPrint baselines and page dimensions; SVG glyph ink verified separately.',
              'limits':'No current Chromium, presenter-window or Microsoft Office rendering check.',
              'pages':[],'blockedRemoteRequests':blocked}
    components=[]
    for i,(page,slide,section) in enumerate(zip(document.pages,data['slides'],sections),1):
        if (page.width,page.height)!=(1920,1080):raise ValueError(f'Page {i} size {page.width}×{page.height}')
        reader=Reader();reader.feed(section)
        anchors={a['url']:a['label'].strip() for a in reader.anchors}
        links=[]
        for typ,url,box,*_ in page.links:
            if typ=='external' and url.startswith(('http://','https://')):
                x,y,right,bottom=box
                links.append({'url':url,'label':anchors.get(url,url),'box':{'x':x,'y':y,'w':right-x,'h':bottom-y}})
        companions=[{'identifier':a['url'].removeprefix('../'),'label':a['label']} for a in reader.anchors if not a['url'].startswith(('http://','https://'))]
        notes=embedded_notes[i-1]
        entry={'index':i,'id':slide['id'],'title':slide['title'],'width':1920,'height':1080,'note':notes,
               'interaction':reader.interaction,'traceScenario':reader.scenario,
               'exercise':'data-exercise' in section,'visibleText':'\n'.join(reader.words),'links':links,'companions':companions}
        if reader.interaction=='trace':
            def field(attr):
                m=re.search(r'<(\w+)\b[^>]*\b'+attr+r'(?:="[^"]*")?[^>]*>([\s\S]*?)</\1>',section)
                if not m:raise ValueError(f'Missing frozen trace field {attr}')
                value=Reader();value.feed(m[2]);return ' '.join(value.words)
            entry.update({'traceCaption':field('data-trace-caption'),'billing':field('data-trace-billing'),
                          'outage':field('data-trace-outage'),'traceEvent':field('data-trace-event')})
        manifest['slides'].append(entry)
        boxes=[]
        for b in page._page_box.descendants():
            if type(b).__name__=='TextBox' and b.text.strip():
                b.pango_layout.reactivate(b.style)
                line,_=b.pango_layout.get_first_line()
                ink=ffi.new('PangoRectangle *')
                pango.pango_layout_line_get_extents(line,ink,ffi.NULL)
                x=b.position_x+ink.x*FROM_UNITS
                y=b.position_y+b.baseline+ink.y*FROM_UNITS
                boxes.append({'text':b.text,'x':x,'y':y,'right':x+ink.width*FROM_UNITS,'bottom':y+ink.height*FROM_UNITS})
                b.pango_layout.deactivate()
        outside=[b for b in boxes if b['x'] < -1 or b['y'] < -1 or b['right'] > 1921 or b['bottom'] > 1081]
        overlaps=[]
        for j,a in enumerate(boxes):
            for b in boxes[j+1:]:
                ix=min(a['right'],b['right'])-max(a['x'],b['x']);iy=min(a['bottom'],b['bottom'])-max(a['y'],b['y'])
                if ix>2 and iy>2:overlaps.append({'a':a['text'],'b':b['text'],'width':round(ix,2),'height':round(iy,2)})
        geometry['pages'].append({'index':i,'id':slide['id'],'textCount':len(boxes),'outOfBounds':outside,'overlaps':overlaps})
        if 'data-component-asset=' in section:components.append(i)
    manifest['blockedRemoteRequests']=blocked
    geometry['passed']=not blocked and not any(p['outOfBounds'] or p['overlaps'] for p in geometry['pages'])
    (out/'layout-validation.json').write_text(json.dumps(geometry,indent=2,ensure_ascii=False)+'\n')
    record(out/'layout-validation.json','layoutValidation')
    if not geometry['passed']:raise ValueError('Text layout failed; fix the reported geometry before packaging.')
    # Render exactly the same slide without its composition to make a fixed frame.
    blank=HTML(string=html,base_url=input_path.parent.as_uri()+'/',url_fetcher=fetch).render(stylesheets=[css,CSS(string='img[data-component-asset]{visibility:hidden!important}')])
    frames=out/'components/frames';frames.mkdir(parents=True,exist_ok=True)
    for index in components:
        stem=frames/f'slide-{index:02}'
        blank.copy([blank.pages[index-1]]).write_pdf(stem.with_suffix('.pdf'))
        subprocess.run(['pdftocairo','-svg',str(stem.with_suffix('.pdf')),str(stem.with_suffix('.svg'))],check=True)
        svg=stem.with_suffix('.svg').read_text()
        svg=re.sub(r'(<svg\b[^>]*?)\bwidth="[^"]*"',r'\1width="1920px"',svg,count=1)
        svg=re.sub(r'(<svg\b[^>]*?)\bheight="[^"]*"',r'\1height="1080px"',svg,count=1)
        svg,flattened=normalize(svg)
        stem.with_suffix('.svg').write_text(svg)
        subprocess.run(['rsvg-convert','-w','1920','-h','1080','-o',str(stem.with_suffix('.png')),str(stem.with_suffix('.svg'))],check=True)
        record(stem.with_suffix('.svg'),'componentFrame');record(stem.with_suffix('.png'),'componentFrameFallback')
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({'pages':len(document.pages),'frames':components,'layoutPassed':geometry['passed'],
        'overlapPages':[p['index'] for p in geometry['pages'] if p['overlaps']],
        'outOfBoundsPages':[p['index'] for p in geometry['pages'] if p['outOfBounds']]}))
    if blocked:raise SystemExit('A remote dependency was attempted.')


if __name__=='__main__':main()
