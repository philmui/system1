#!/usr/bin/env python3
"""Validate packaged SVG PowerPoint against its export manifest, without modifying either.
Usage: python3 validate-powerpoint.py DECK.pptx [ARTIFACT_DIR] [REPORT.json]
"""
from pathlib import Path
from zipfile import ZipFile
import hashlib,json,posixpath,re,struct,sys
import xml.etree.ElementTree as ET
pptx=Path(sys.argv[1]).resolve()
art=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else pptx.parent/'exports'/pptx.stem
out=Path(sys.argv[3]).resolve() if len(sys.argv)>3 else art/'package-validation.json'
manifest=json.loads((art/'manifest.json').read_text());export=json.loads((art/'export-report.json').read_text())
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','rel':'http://schemas.openxmlformats.org/package/2006/relationships','asvg':'http://schemas.microsoft.com/office/drawing/2016/SVG/main','svg':'http://www.w3.org/2000/svg'}
errors=[];checks={};sha=lambda b:hashlib.sha256(b).hexdigest()
def require(value,message):
 if not value:errors.append(message)
def relbase(name):
 if name=='_rels/.rels':return ''
 return posixpath.dirname(posixpath.dirname(name))
def target(base,value):return posixpath.normpath(posixpath.join(base,value))
with ZipFile(pptx) as z:
 require(z.testzip() is None,'ZIP CRC validation failed')
 names=set(z.namelist());xml={}
 for name in names:
  if name.endswith(('.xml','.rels')):
   try:xml[name]=ET.fromstring(z.read(name))
   except ET.ParseError as e:errors.append(f'{name}: {e}')
 relationships=0;external=0
 for name,root in xml.items():
  if not name.endswith('.rels'):continue
  for rel in root:
   relationships+=1
   if rel.get('TargetMode')=='External':
    external+=1;require(rel.get('Target','').startswith(('https://','http://')),f'Non-web external relationship in {name}')
   else:require(target(relbase(name),rel.get('Target','')) in names,f'Missing relationship target in {name}: {rel.get("Target")}')
 presentation=xml['ppt/presentation.xml'];size=presentation.find('p:sldSz',ns);cx=int(size.get('cx'));cy=int(size.get('cy'))
 require(abs(cx/cy-16/9)<1e-6,'Slide aspect ratio differs from 16:9')
 ordered=presentation.findall('p:sldIdLst/p:sldId',ns);require(len(ordered)==len(manifest['slides']),'Presentation count differs from HTML count')
 presrels={r.get('Id'):r.get('Target') for r in xml['ppt/_rels/presentation.xml.rels']}
 graphic_count=0;note_count=0;clickable=0;total_paths=0
 for i,s in enumerate(manifest['slides'],1):
  require(target('ppt',presrels[ordered[i-1].get('{'+ns['r']+'}id')])==f'ppt/slides/slide{i}.xml',f'Slide order mismatch at {i}')
  root=xml[f'ppt/slides/slide{i}.xml'];rels={r.get('Id'):r for r in xml[f'ppt/slides/_rels/slide{i}.xml.rels']}
  pictures=root.findall('.//p:pic',ns);require(len(pictures)==1,f'Slide {i}: expected one complete graphic')
  picture=pictures[0];meta=picture.find('p:nvPicPr/p:cNvPr',ns);require(meta.get('name','').startswith(s['id']+' —'),f'Slide {i}: wrong slide identity')
  blip=picture.find('.//a:blip',ns);svg_blip=picture.find('.//asvg:svgBlip',ns);require(svg_blip is not None,f'Slide {i}: missing SVG extension')
  if svg_blip is None:continue
  png_name=target('ppt/slides',rels[blip.get('{'+ns['r']+'}embed')].get('Target'));svg_name=target('ppt/slides',rels[svg_blip.get('{'+ns['r']+'}embed')].get('Target'))
  png=z.read(png_name);svg=z.read(svg_name);audit=export['imageAudit'][i-1]
  require(png.startswith(b'\x89PNG\r\n\x1a\n'),f'Slide {i}: invalid PNG fallback')
  require(struct.unpack('>II',png[16:24])==(1920,1080),f'Slide {i}: wrong fallback size')
  require(sha(png)==audit['pngSha256'],f'Slide {i}: fallback is not the verified PDF render')
  require(sha(svg)==audit['svgSha256'],f'Slide {i}: SVG differs from verified artwork')
  svg_root=ET.fromstring(svg);require(not svg_root.findall('.//svg:text',ns),f'Slide {i}: font-dependent SVG text remains')
  require(not svg_root.findall('.//svg:foreignObject',ns),f'Slide {i}: unsupported browser HTML remains')
  for element in svg_root.iter():
   for key,value in element.attrib.items():
    if key.endswith('href'):require(value.startswith(('#','data:')),f'Slide {i}: externally linked SVG asset')
  total_paths+=len(svg_root.findall('.//svg:path',ns));graphic_count+=1
  for x in root.findall('.//a:xfrm',ns):
   off=x.find('a:off',ns);ext=x.find('a:ext',ns)
   if off is None or ext is None:continue
   xx,yy=int(off.get('x')),int(off.get('y'));ww,hh=int(ext.get('cx')),int(ext.get('cy'))
   require(xx>=-1 and yy>=-1 and xx+ww<=cx+1 and yy+hh<=cy+1,f'Slide {i}: object exceeds canvas')
  note_rel=next((r for r in rels.values() if r.get('Type','').endswith('/notesSlide')),None);require(note_rel is not None,f'Slide {i}: missing editable notes')
  if note_rel is not None:
   note_name=target('ppt/slides',note_rel.get('Target'));text='\n'.join(n.text or '' for n in xml[note_name].findall('.//a:t',ns));require('POWERPOINT EXPORT' in text,f'Slide {i}: missing static-state disclosure');require(s['title'] in text,f'Slide {i}: incorrect notes title');require('file:///' not in text,f'Slide {i}: broken local link in notes');note_count+=1
   for l in s['links']:require(l['url'] in text,f'Slide {i}: source URL missing from notes')
   note=s.get('note') or {}
   for point in [note.get('purpose'),*(note.get('talk') or []),note.get('transition')]:
    if point:require(point in text,f'Slide {i}: original speaker-note content missing')
  hyperlink_nodes=root.findall('.//a:hlinkClick',ns);clickable+=len(hyperlink_nodes)
  require(len(hyperlink_nodes)==len(s['links']),f'Slide {i}: clickable source count differs')
  packaged_links=[rels.get(h.get('{'+ns['r']+'}id')) for h in hyperlink_nodes]
  require(all(r is not None and r.get('TargetMode')=='External' for r in packaged_links),f'Slide {i}: source hyperlink has no external relationship')
  require([r.get('Target') if r is not None else None for r in packaged_links]==[l['url'] for l in s['links']],f'Slide {i}: source hyperlink target order differs')
 checks.update({'slideCount':len(ordered),'editableNotesCount':note_count,'vectorArtworkCount':graphic_count,'pngFallbackCount':graphic_count,'vectorPathCount':total_paths,'clickableWebSourceCount':clickable,'externalRelationshipCount':external,'relationshipsChecked':relationships,'sourceHyperlinkTargetsMatch':not any('hyperlink target' in e for e in errors),'originalSpeakerNotesPreserved':not any('speaker-note content' in e for e in errors),'sizeEMU':[cx,cy],'allObjectsWithinCanvas':not any('exceeds canvas' in e for e in errors),'glyphsOutlined':not any('font-dependent' in e for e in errors)})
font_report=(art/'pdf-fonts.txt').read_text();font_rows=[re.search(r'\s+(yes|no)\s+(yes|no)\s+(yes|no)\s+\d+\s+\d+\s*$',line) for line in font_report.splitlines()[2:]]
require(font_rows and all(m and m.group(1)=='yes' for m in font_rows),'PDF has a nonembedded font or an unparsed font entry')
require(not export['pageErrors'],'Browser export reported JavaScript errors');require(not export['blockedRemoteRequests'],'Export attempted a remote dependency')
require(sha(pptx.read_bytes())==export['outputSha256'],'PowerPoint package changed after export')
checks.update({'pdfEmbeddedFontCount':len(font_rows),'maxMeanImageDifference':max(a['meanAbsoluteChannelDifference'] for a in export['imageAudit']),'maxPixelsOver30Fraction':max(a['pixelsOver30Fraction'] for a in export['imageAudit'])})
report={'powerpoint':pptx.name,'source':manifest['title'],'passed':not errors,'checks':checks,'errors':errors,'limits':'No Microsoft PowerPoint or LibreOffice renderer is installed. Validation covers OOXML/ZIP consistency, bounds, exact packaged-image identity, and independent SVG/PDF raster agreement; it does not claim an Office render.'}
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));sys.exit(bool(errors))
