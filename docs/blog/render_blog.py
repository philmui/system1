# /// script
# requires-python = ">=3.11"
# dependencies = ["Markdown==3.8.2"]
# ///
"""Render the final preserved blog as a self-contained local reading page.

Run: uv run --script docs/blog/render_blog.py
The page uses local SVG assets and no external fonts, scripts, or services.
"""
from pathlib import Path
import re
import markdown

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / '09-building-prod.md'
body = markdown.markdown(SOURCE.read_text(), extensions=['tables', 'fenced_code'])
body = re.sub(r'<table>(.*?)</table>', r'<div class="table-scroll"><table>\1</table></div>', body, flags=re.S)
body = re.sub(r'<p>(<img alt="[^"]*" src="([^"]+)"[^>]*>)</p>', r'<figure><div class="diagram-scroll"><a href="\2" aria-label="Open full-size diagram">\1</a></div><a class="enlarge" href="\2">Open full-size diagram ↗</a></figure>', body)
style = '''
:root{color-scheme:light;--ink:#243b46;--muted:#526873;--paper:#fff;--line:#dae6e8;--mint:#e8f5ef;--lilac:#efebfa}
*{box-sizing:border-box}html{background:#f5f8fa;color:var(--ink);scroll-behavior:smooth}
body{margin:0;font-family:Georgia,"Times New Roman",serif;font-size:19px;line-height:1.75}
.topline{height:8px;background:linear-gradient(90deg,#d4e9df 0 36%,#e3daf5 36% 70%,#f8e8bf 70%)}
header,main,footer{max-width:1040px;margin:auto;padding:0 64px}header{padding-top:45px;padding-bottom:25px}
.kicker{font:600 12px/1.5 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
header a,footer a{font:14px/1.5 system-ui,sans-serif}header{display:flex;gap:24px;justify-content:space-between;align-items:center}
main{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding-top:42px;padding-bottom:48px;margin-bottom:24px}
h1,h2,h3{font-family:system-ui,-apple-system,sans-serif;letter-spacing:-.025em;line-height:1.2}
h1{font-size:clamp(34px,4.1vw,48px);font-weight:650;margin:0 0 32px;max-width:830px}h1 code{font-size:.9em}
h2{font-size:28px;margin:48px 0 20px;font-weight:650}h3{font-size:23px}p{margin:0 0 22px}
a{color:#315d75;text-underline-offset:3px;text-decoration-thickness:1px}a:hover{color:#173c54}a:focus-visible{outline:3px solid #759baf;outline-offset:4px}
code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.84em;background:#f0f4f6;padding:.1em .3em;border-radius:4px}
h1 code{background:transparent;padding:0}table{border-collapse:collapse;width:100%;font:15px/1.6 system-ui,sans-serif;margin:4px 0}
th,td{text-align:left;vertical-align:top;padding:14px 16px;border-bottom:1px solid var(--line)}th{background:var(--mint);font-weight:650}td:first-child{min-width:135px}th,td{min-width:180px}
.table-scroll{overflow-x:auto;margin:26px 0 30px;border:1px solid var(--line);border-radius:10px}
figure{margin:30px -28px 14px}.diagram-scroll{overflow:auto;border:1px solid var(--line);border-radius:12px;background:#f9fbfd}figure img{display:block;width:100%;min-width:760px;height:auto}.enlarge{display:block;text-align:right;margin:6px 2px;font:12px/1.5 system-ui,sans-serif}
p:has(> em:only-child){font:14px/1.6 system-ui,sans-serif;color:var(--muted);margin-bottom:30px}
footer{padding-top:4px;padding-bottom:40px;color:var(--muted);font:13px/1.7 system-ui,sans-serif}footer p{margin:0}
@media(max-width:720px){body{font-size:17px;line-height:1.72}header,footer{padding-left:22px;padding-right:22px}header{padding-top:26px;align-items:flex-start}.kicker{max-width:200px}main{margin:0 10px 22px;padding:28px 20px;border-radius:12px}h1{font-size:35px}h2{font-size:25px;margin-top:38px}figure{margin-left:0;margin-right:0}.table-scroll{margin:22px 0}}
@media print{html{background:white}body{font-size:11pt;line-height:1.5}header,footer,.topline,.enlarge{display:none}main{border:0;padding:0;max-width:none}h1{font-size:27pt}h2{font-size:19pt;break-after:avoid}figure{margin:18px 0;break-inside:avoid}figure img{min-width:0}.diagram-scroll,.table-scroll{overflow:visible}a{color:inherit}tr{break-inside:avoid}}
'''
page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Building Prod with koa-action, Agent Graph and AgentScript</title>
<meta name="description" content="A proposed Salesforce architecture for bounded model decisions, guided workflow control, and rigorous evaluation.">
<style>{style}</style></head><body><div class="topline"></div>
<header><span class="kicker">Enterprise agents · Architecture &amp; evaluation</span><a href="README.md">Drafts &amp; review record</a></header>
<main><article>{body}</article></main>
<footer><p>Version 09 · Disaggregated intelligence, branching aftercare and evaluation. See <a href="research/editorial-scope.md">scope and evidence</a> and the <a href="revision-log.md">revision record</a>.</p></footer>
</body></html>'''
(ROOT / 'index.html').write_text(page)
print(f'Rendered {SOURCE.name} → index.html')
