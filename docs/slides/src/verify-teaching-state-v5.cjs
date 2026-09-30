/* Execute the authored teaching logic without a browser.
 * This checks state and arithmetic, not layout, browser APIs, or presenter sync.
 * Usage: node verify-teaching-state-v5.cjs <deck.json|deck.html> <report.json>
 *          [--freeze-output static.html]
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const crypto = require('node:crypto');

const args=process.argv.slice(2),freezeIndex=args.indexOf('--freeze-output');
let freezeOutput=null;
if(freezeIndex>=0){
  assert(args[freezeIndex+1]&&!args[freezeIndex+1].startsWith('--'),'--freeze-output needs a path.');
  freezeOutput=path.resolve(args[freezeIndex+1]);args.splice(freezeIndex,2);
}
const input = path.resolve(args[0] || 'docs/slides/src/deck-core-v5.json');
const output = args[1] ? path.resolve(args[1]) : null;
assert.notEqual(freezeOutput,input,'Static output must not replace the authored input.');
const source = fs.readFileSync(input, 'utf8');
let html = source;
if (input.endsWith('.json')) {
  const deck = JSON.parse(source);
  html = '<div id="deck">' + deck.slides.map(s =>
    `<section data-slide-id="${s.id}">${s.body}</section>`).join('') + '</div>';
}
const parser = String.raw`
import json,sys
from html.parser import HTMLParser
class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root={'tag':'document','attrs':{},'children':[]}
        self.stack=[self.root]
    def handle_starttag(self,tag,attrs):
        node={'tag':tag,'attrs':dict((k,v or '') for k,v in attrs),'children':[]}
        self.stack[-1]['children'].append(node)
        if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:
            self.stack.append(node)
    def handle_startendtag(self,tag,attrs):
        self.stack[-1]['children'].append({'tag':tag,'attrs':dict((k,v or '') for k,v in attrs),'children':[]})
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i]['tag']==tag:
                self.stack=self.stack[:i]
                break
    def handle_data(self,data):
        self.stack[-1]['children'].append(data)
p=Tree();p.feed(sys.stdin.read());json.dump(p.root,sys.stdout)
`;
const parsed = spawnSync('python3', ['-c', parser], {input: html, encoding:'utf8', maxBuffer:64*1024*1024});
if (parsed.status !== 0) throw new Error(parsed.stderr || 'HTML parsing failed');

// Only DOM operations actually used by the local teaching script are adapted.
// Real authored markup supplies the elements; no replacement widget is built.
class Element {
  constructor(raw, parent=null) {
    this.tagName = raw.tag.toUpperCase(); this.attrs=raw.attrs; this.parentElement=parent;
    this.childNodes=raw.children.map(x => typeof x==='string' ? x : new Element(x,this));
    this.style={}; this.listeners={}; this.value=this.attrs.value || '';
    this.disabled=Object.hasOwn(this.attrs,'disabled');
    this.classList={
      contains: c => (this.attrs.class || '').split(/\s+/).includes(c),
      toggle: (c,force) => {
        const classes=new Set((this.attrs.class || '').split(/\s+/).filter(Boolean));
        const on=force===undefined ? !classes.has(c) : force;
        if(on)classes.add(c);else classes.delete(c);
        this.attrs.class=[...classes].join(' ');return on;
      }
    };
  }
  get children(){return this.childNodes.filter(x=>x instanceof Element)}
  get firstElementChild(){return this.children[0] || null}
  get nextElementSibling(){const peers=this.parentElement?.children || [];return peers[peers.indexOf(this)+1] || null}
  get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]))}
  get textContent(){return this.childNodes.map(x=>typeof x==='string'?x:x.textContent).join('')}
  set textContent(v){this.childNodes=[String(v)]}
  get innerHTML(){return this._html || ''}
  set innerHTML(v){this._html=String(v)}
  setAttribute(k,v){this.attrs[k]=String(v)}
  getAttribute(k){return Object.hasOwn(this.attrs,k)?this.attrs[k]:null}
  addEventListener(type,fn){(this.listeners[type] ||= []).push(fn)}
  dispatch(type){for(const fn of this.listeners[type] || [])fn({type,target:this})}
  matches(selector){
    if(selector.startsWith('#'))return this.attrs.id===selector.slice(1);
    if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));
    if(selector.startsWith('[')){
      const m=selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]*)["']?)?\]$/);
      if(!m)throw new Error(`Unsupported test selector: ${selector}`);
      return Object.hasOwn(this.attrs,m[1])&&(m[2]===undefined||this.attrs[m[1]]===m[2]);
    }
    return this.tagName===selector.toUpperCase();
  }
  closest(selector){for(let e=this;e;e=e.parentElement)if(e.matches(selector))return e;return null}
  querySelectorAll(selector){
    const parts=selector.trim().split(/\s+/),last=parts.pop(),result=[];
    const walk=node=>{for(const child of node.children){
      if(child.matches(last)){
        let ancestor=child.parentElement,found=true;
        for(let i=parts.length-1;i>=0;i--){
          while(ancestor&&!ancestor.matches(parts[i]))ancestor=ancestor.parentElement;
          if(!ancestor){found=false;break}ancestor=ancestor.parentElement;
        }
        if(found)result.push(child);
      }walk(child);
    }};walk(this);return result;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0] || null}
}
const document=new Element(JSON.parse(parsed.stdout));
let notifications=0;
const window={__pptPresenter:{exampleChanged:()=>notifications++}};
let scriptFile=path.join(__dirname,'interactions-v5.js');
let script=fs.readFileSync(scriptFile,'utf8');
if(!input.endsWith('.json')){
  const candidates=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
    .map(m=>m[1]).filter(s=>s.includes('/* === TRANSPARENT, LOCAL TEACHING EXAMPLES === */'));
  assert.equal(candidates.length,1,'Find exactly one embedded teaching script in the authored HTML.');
  script=candidates[0];scriptFile=input+'#teaching-script';
}
vm.runInNewContext(script,{document,window},{filename:scriptFile,timeout:5000});
const api=window.__teachingExamples;
const gate=document.querySelector('[data-interaction="gate"]');
const cost=document.querySelector('[data-interaction="cost"]');
const trace=document.querySelector('[data-interaction="trace"]');
assert(gate&&cost&&trace,'All authored teaching widgets must exist.');
const read=(root,selector)=>root.querySelector(selector).textContent;
const report={input,inputSha256:crypto.createHash('sha256').update(source).digest('hex'),scriptOrigin:scriptFile,scriptSha256:crypto.createHash('sha256').update(script).digest('hex'),method:'Actual v5 teaching script executed with a minimal DOM adapter over authored markup.',limitations:['No layout or pixel rendering check.','No real browser keyboard, media, export, or presenter-window check.'],gate:[],cost:[],trace:[]};
for(const [threshold,coverage,error,review] of [[.5,'100%','33%','0'],[.75,'58%','29%','5'],[.99,'8%','100%','11'],[1,'0%','—','12']]){
  const el=gate.querySelector('input');el.value=String(threshold);el.dispatch('input');
  const actual={coverage:read(gate,'[data-gate-coverage]'),error:read(gate,'[data-gate-error]'),review:read(gate,'[data-gate-review]')};
  assert.deepEqual(actual,{coverage,error,review});report.gate.push({threshold,...actual});
}
for(const [fallback,total,saving] of [[20,'0.27 normalized units','73% lower'],[93,'1.00 normalized units','Break-even'],[100,'1.07 normalized units','7% higher']]){
  cost.querySelector(`[data-cost-preset="${fallback}"]`).dispatch('click');
  const actual={total:read(cost,'[data-cost-total]'),saving:read(cost,'[data-cost-saving]')};
  assert.deepEqual(actual,{total,saving});report.cost.push({fallback,...actual});
}
assert.equal(trace.dataset.traceScenario,'returns');
assert.deepEqual(trace.querySelectorAll('.tag').map(x=>x.textContent),['Exchange','Cable return']);
assert.equal(trace.querySelectorAll('[data-trace-step]').length,8);
trace.querySelector('[data-trace-reset]').dispatch('click');
const expected=[
 ['Pending','Pending',/identity service verifies.*before protected order lookup/],
 ['Pending','Pending',/purchase service.*spare cable was purchased separately/],
 ['Pending','Pending',/System One records two AND tasks/],
 ['Active','Pending',/customer chooses.*exchange first/],
 ['Awaiting confirmation','Pending',/exchange service checks its own policy and stock/],
 ['Confirmed','Pending',/authorization is still pending/],
 ['Authorized','Pending',/service issues an exchange ID after rechecking authority, policy, stock, and accepted terms/],
 ['Authorized','Active',/Agent Graph resumes.*unfinished/]
];
for(let i=0;i<8;i++){
 const actual={exchange:read(trace,'[data-trace-billing]'),cableReturn:read(trace,'[data-trace-outage]'),event:read(trace,'[data-trace-event]')};
 assert.equal(actual.exchange,expected[i][0]);assert.equal(actual.cableReturn,expected[i][1]);assert.match(actual.event,expected[i][2]);
 assert.equal(read(trace,'[data-trace-caption]'),`Event ${i+1} of 8`);
 assert.equal(trace.querySelectorAll('.current').length,1);report.trace.push(actual);
 if(i<7)trace.querySelector('[data-trace-next]').dispatch('click');
}
assert.equal(trace.querySelector('[data-trace-next]').disabled,true);
const saved=JSON.parse(JSON.stringify(api.snapshot()));
trace.querySelector('[data-trace-reset]').dispatch('click');assert.equal(api.snapshot().traceIndex,0);
api.apply(saved);assert.equal(api.snapshot().traceIndex,7);assert.equal(read(trace,'[data-trace-outage]'),'Active');
const exercise=document.querySelector('[data-exercise]');exercise.querySelector('[data-reveal-answer]').dispatch('click');
assert.equal(exercise.querySelector('[data-reveal-answer]').getAttribute('aria-expanded'),'true');
const revealed=JSON.parse(JSON.stringify(api.snapshot()));exercise.querySelector('[data-reveal-answer]').dispatch('click');
api.apply(revealed);assert.equal(exercise.classList.contains('show-answer'),true);
const before=JSON.stringify(api.snapshot());api.apply({...saved,version:999,traceIndex:0});assert.equal(JSON.stringify(api.snapshot()),before);
api.apply({...saved,gateThreshold:4,fallbackPercent:-10,traceIndex:99});
assert.equal(api.snapshot().gateThreshold,1);assert.equal(api.snapshot().fallbackPercent,0);assert.equal(api.snapshot().traceIndex,7);
assert(notifications>0);
report.state={reset:true,serializedRestoration:true,exerciseRestoration:true,unknownVersionIgnored:true,boundsApplied:true,changeNotifications:notifications};
if(freezeOutput){
  assert(!input.endsWith('.json'),'Freeze the integrated HTML, which includes its actual CSS and assets.');
  const frozen=JSON.parse(JSON.stringify(api.snapshot()));
  frozen.gateThreshold=.75;frozen.fallbackPercent=20;frozen.traceIndex=7;
  for(const key of Object.keys(frozen.reveals))frozen.reveals[key]=true;
  api.apply(frozen);
  const escapeText=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const escapeAttr=s=>escapeText(s).replace(/"/g,'&quot;');
  const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  // HTMLParser lowercases names. Restore the SVG names that HTML5 parsers
  // normally normalize when entering foreign SVG content.
  const svgTags={lineargradient:'linearGradient',radialgradient:'radialGradient',clippath:'clipPath',textpath:'textPath',foreignobject:'foreignObject',fegaussianblur:'feGaussianBlur',feoffset:'feOffset',fecolormatrix:'feColorMatrix',femerge:'feMerge',femergenode:'feMergeNode',fedropshadow:'feDropShadow'};
  const svgAttrs={viewbox:'viewBox',preserveaspectratio:'preserveAspectRatio',markerwidth:'markerWidth',markerheight:'markerHeight',markerunits:'markerUnits',refx:'refX',refy:'refY',gradientunits:'gradientUnits',gradienttransform:'gradientTransform',patternunits:'patternUnits',patterncontentunits:'patternContentUnits',patterntransform:'patternTransform',textlength:'textLength',lengthadjust:'lengthAdjust',attributename:'attributeName',basefrequency:'baseFrequency',stddeviation:'stdDeviation',filterunits:'filterUnits'};
  function serialize(node,inSvg=false,raw=false){
    if(typeof node==='string')return raw?node:escapeText(node);
    const lower=node.tagName.toLowerCase();
    if(lower==='document')return node.childNodes.map(n=>serialize(n)).join('');
    if(lower==='script')return '';
    const svg=inSvg||lower==='svg',tag=svg?(svgTags[lower]||lower):lower;
    const attrs={...node.attrs};
    const changedStyle=Object.entries(node.style).map(([k,v])=>`${k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}:${v}`).join(';');
    if(changedStyle)attrs.style=(attrs.style?attrs.style.replace(/;?$/,';'):'')+changedStyle+';';
    if(lower==='input')attrs.value=String(node.value);
    if(node.disabled)attrs.disabled='';else delete attrs.disabled;
    const attributes=Object.entries(attrs).map(([k,v])=>` ${svg?(svgAttrs[k]||k):k}="${escapeAttr(v)}"`).join('');
    const start=`<${tag}${attributes}>`;
    if(voidTags.has(lower))return start;
    const content=node._html!==undefined?node._html:node.childNodes.map(n=>serialize(n,svg&&lower!=='foreignobject',lower==='style')).join('');
    return start+content+`</${tag}>`;
  }
  const frozenHtml='<!doctype html>\n'+serialize(document);
  fs.mkdirSync(path.dirname(freezeOutput),{recursive:true});fs.writeFileSync(freezeOutput,frozenHtml);
  report.freeze={output:freezeOutput,sha256:crypto.createHash('sha256').update(frozenHtml).digest('hex'),state:JSON.parse(JSON.stringify(api.snapshot())),scriptsOmitted:true,sourcePreserved:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex')===report.inputSha256};
}
report.passed=true;
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify({passed:true,traceEvents:report.trace.length,gateBoundaries:report.gate.length,costBoundaries:report.cost.length,method:report.method,limitations:report.limitations},null,2));
