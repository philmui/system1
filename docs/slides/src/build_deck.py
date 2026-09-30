"""Build a standalone deck from an authored slide manifest and a local shell.

No browser runtime dependency is needed. CSS, fonts, SVGs, JS and notes are embedded.
Usage: python3 docs/slides/src/build_deck.py src/deck-v1.json working.html
Paths are relative to docs/slides. Preserved numbered outputs are not overwritten.
"""
from pathlib import Path
import sys,json,re,base64,html,hashlib
ROOT=Path(__file__).resolve().parent.parent
src=ROOT/sys.argv[1]; dest=ROOT/sys.argv[2]
data=json.loads(src.read_text()); template=(ROOT/'src/shell.html').read_text()
fonts=''
for name,weight in [('Manrope','200 800'),('IBMPlexMono','400')]:
 raw=base64.b64encode((ROOT/'assets/fonts'/f'{name}.woff2').read_bytes()).decode()
 fonts+=f'@font-face{{font-family:"{name}";src:url(data:font/woff2;base64,{raw}) format("woff2");font-weight:{weight};font-display:swap}}\n'
head='<meta name="deck-source-sha256" content="'+hashlib.sha256(src.read_bytes()).hexdigest()+'">\n<style>\n'+fonts+(ROOT/data.get('theme_css','src/theme.css')).read_text()+'\n</style>'
sections=[];notes=[]
for n,s in enumerate(data['slides']):
 body=s['body']; eid=[0]
 def edit(m):
  tag,attrs=m.group(1),m.group(2)
  if 'data-edit-id' in attrs or 'data-trace-' in attrs:return m.group()
  eid[0]+=1
  return f'<{tag}{attrs} data-edit-id="{s["id"]}-text-{eid[0]}">'
 body=re.sub(r'<(h3|p)(\s[^>]*|)>',edit,body)
 def asset(m):
  f=ROOT/'assets'/m.group(1)
  mime='image/svg+xml' if f.suffix=='.svg' else 'image/png'
  return 'src="data:'+mime+';base64,'+base64.b64encode(f.read_bytes()).decode()+'"'
 body=re.sub(r'src="ASSET:([^"]+)"',asset,body)
 links=' · '.join(f'<a href="{html.escape(data["sources"][k][1])}" target="_blank" rel="noopener">{html.escape(data["sources"][k][0])}</a>' for k in s['sources'])
 title=html.escape(s['title']); cls='long' if len(s['title'])>49 else ''
 header='' if s['id']=='opening' else f'<header class="deck-head"><div class="t-meta" data-edit-id="{s["id"]}-eyebrow">{html.escape(s["eyebrow"])}</div><h2 class="{cls}" data-edit-id="{s["id"]}-title">{title}</h2></header>'
 sections.append(f'''<!-- === SLIDE {n+1:02d}: {s['id'].upper()} === -->
<section class="slide {s['theme']} {'split' if s['layout'] in ['S03','S10'] else ''}" data-slide-id="{s['id']}" data-layout="{s['layout']}" data-title="{title}" aria-label="{n+1}. {title}">
<div class="canvas-card"><div class="chrome-min"><div class="l">DISAGGREGATED INTELLIGENCE</div><div class="r">{n+1:02d} / {len(data['slides']):02d}</div></div>{header}<div class="slide-body">{body}</div><footer class="source-line"><span>{links}</span><span>{html.escape(s['status'])}</span></footer></div></section>''')
 notes.append({'id':s['id'],'title':s['title'],'section':s['eyebrow'].split(' / ')[0],'purpose':s['purpose'],'talk':s['talk'],'transition':s['transition'],'minutes':s['minutes']})
notes_json=json.dumps(notes,ensure_ascii=False).replace('</','<\\/')
interaction_script=ROOT/data.get('interaction_script','src/interactions.js')
out=template.replace('<!-- DECK_HEAD -->',head).replace('<!-- DECK_SLIDES -->','\n'.join(sections)).replace('const SPEAKER_NOTES = /* DECK_NOTES */ [];','const SPEAKER_NOTES = '+notes_json+';').replace('<!-- DECK_SCRIPT -->','<script>\n'+interaction_script.read_text()+'\n</script>')
out=re.sub(r'<title>.*?</title>',f'<title>{html.escape(data["title"])} · v{data["version"]}</title>',out,count=1)
assert 'DECK_SLIDES' not in out and 'DECK_NOTES' not in out
if dest.exists() and re.match(r'\d{2}-',dest.name):raise SystemExit('Refusing to overwrite a preserved version')
dest.write_text(out)
print(f'{dest.name}: {len(notes)} slides, {len(out):,} characters')
