/** Export named vector components and empty slide frames for the editable layout.
 * Usage: node export-components.mjs INPUT.html ARTIFACT_DIR/components
 * Every isolated object is printed with the same embedded fonts as the HTML,
 * outlined with Poppler, then cropped to a tight transparent SVG/PNG pair.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {chromium} from '../../../frontend/node_modules/playwright/index.mjs';

const input=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);
const assets=path.resolve(path.dirname(input),'assets/components');
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:20*1024*1024});
for(const p of [out,path.join(out,'frames'),path.join(out,'objects'),assets])await fs.mkdir(p,{recursive:true});
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));
await context.route(/^https?:/,r=>{network.push(r.request().url());return r.abort()});
await page.goto(pathToFileURL(input).href);await page.evaluate(()=>document.fonts.ready);
// Match the existing faithful exporter, without changing the authored HTML.
const exporter=await fs.readFile(path.join(path.dirname(new URL(import.meta.url).pathname),'export-powerpoint.cjs'),'utf8');
const css=exporter.match(/const exportCSS=`([\s\S]*?)`;/)[1];
await page.addStyleTag({content:css});
await page.evaluate(()=>{window.__setLowPowerMode?.(true,{persist:false});document.querySelectorAll('#deck>.slide').forEach(s=>{s.inert=false;s.setAttribute('aria-hidden','false')})});
await page.emulateMedia({media:'print'});
const compositions=await page.evaluate(()=>[...document.querySelectorAll('#deck>.slide')].flatMap((s,i)=>{
  const image=s.querySelector('img[data-component-asset]');if(!image)return [];
  const sr=s.getBoundingClientRect(),b=image.getBoundingClientRect();
  return [{index:i+1,id:s.dataset.slideId,asset:image.dataset.componentAsset,svg:new TextDecoder().decode(Uint8Array.from(atob(image.src.split(',')[1]),c=>c.charCodeAt(0))),x:b.x-sr.x,y:b.y-sr.y,w:b.width,h:b.height}];
}));
if(compositions.length!==4)throw Error('Expected the three workflows and their component library.');
const hide=await page.addStyleTag({content:'img[data-component-asset]{visibility:hidden!important}'});
for(const c of compositions){
  const n=String(c.index).padStart(2,'0'),stem=path.join(out,'frames',`slide-${n}`);
  await page.pdf({path:stem+'.pdf',pageRanges:String(c.index),preferCSSPageSize:true,printBackground:true});
  run('pdftocairo',['-svg',stem+'.pdf',stem+'.svg']);
  let svg=await fs.readFile(stem+'.svg','utf8');
  svg=svg.replace(/<svg\b([^>]*)>/,(_,a)=>'<svg'+a.replace(/\bwidth="[^"]*"/,'width="1920px"').replace(/\bheight="[^"]*"/,'height="1080px"')+'>');
  await fs.writeFile(stem+'.svg',svg);
  run('rsvg-convert',['-w','1920','-h','1080','-o',stem+'.png',stem+'.svg']);
  c.frame={svg:`frames/slide-${n}.svg`,png:`frames/slide-${n}.png`};
}
await hide.evaluate(e=>e.remove());
const extraction=await context.newPage();
const all=[];
for(const c of compositions){
  await extraction.setViewportSize({width:1744,height:620});
  await extraction.setContent('<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>'+c.svg+'</body></html>');
  await extraction.evaluate(()=>document.fonts.ready);
  const raw=await extraction.evaluate(()=>{
    const root=document.querySelector('svg'),defs=root.querySelector('defs').outerHTML,selected=[];
    const visit=e=>{for(const el of e.children){
      if(['defs','title','desc'].includes(el.localName))continue;
      if(el.dataset.component){selected.push(el);continue}
      if(el.localName==='g'){visit(el);continue}
      selected.push(el);
    }};visit(root);
    return selected.map((el,i)=>{
      const b=el.getBoundingClientRect(),pad=12;
      const x=Math.max(0,Math.floor(b.x-pad)),y=Math.max(0,Math.floor(b.y-pad));
      const right=Math.min(1744,Math.ceil(b.right+pad)),bottom=Math.min(620,Math.ceil(b.bottom+pad));
      if(right<=x||bottom<=y)throw Error('Empty object bounds');
      const tag=el.localName;
      const kind=el.dataset.kind||(tag==='text'?'label':tag==='path'?'connector':(i===0?'background':'decoration'));
      const label=el.dataset.component||(tag==='text'?el.textContent.trim():`${kind}-${i+1}`);
      let clone=el.cloneNode(true),current=clone,p=el.parentElement;
      while(p!==root){const g=p.cloneNode(false);g.appendChild(current);current=g;p=p.parentElement}
      const safeName=label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      const outer=`<svg xmlns="http://www.w3.org/2000/svg" width="1744" height="620" viewBox="0 0 1744 620">${defs}${current.outerHTML}</svg>`;
      return {label,kind,key:el.dataset.component||null,slug:safeName,box:{x,y,w:right-x,h:bottom-y},outer};
    });
  });
  c.objects=[];
  for(let i=0;i<raw.length;i++){
    const o=raw[i],stem=`${c.id}-${String(i+1).padStart(2,'0')}-${o.slug}`;
    const object={name:`${c.id} / ${o.label} / ${i+1}`,kind:o.kind,svg:`objects/${stem}.svg`,png:`objects/${stem}.png`,
      x:c.x+o.box.x*c.w/1744,y:c.y+o.box.y*c.h/620,w:o.box.w*c.w/1744,h:o.box.h*c.h/620};
    c.objects.push(object);all.push({object,raw:o,stem});
  }
  console.log(`${c.id}: ${raw.length} separately movable vector objects`);
}
// Printing all isolated objects in one pass preserves exact source glyphs and
// avoids any dependency on Office having Manrope installed.
await extraction.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:1744px 620px;margin:0}html,body{margin:0;padding:0;background:transparent}
.object-page{width:1744px;height:620px;break-after:page;overflow:hidden;background:transparent}
.object-page:last-child{break-after:auto}svg{display:block;width:1744px;height:620px}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>${all.map(o=>`<div class="object-page">${o.raw.outer}</div>`).join('')}</body></html>`);
await extraction.evaluate(()=>document.fonts.ready);
const objectPDF=path.join(out,'isolated-objects.pdf');
await extraction.pdf({path:objectPDF,printBackground:true,preferCSSPageSize:true});
const pages=Number(run('pdfinfo',[objectPDF]).match(/Pages:\s+(\d+)/)[1]);
if(pages!==all.length)throw Error(`Object page count ${pages} differs from ${all.length}`);
const library=[];const published=new Set();
for(let i=0;i<all.length;i++){
  const {object,raw,stem}=all[i],file=path.join(out,object.svg),b=raw.box;
  run('pdftocairo',['-svg','-f',String(i+1),'-l',String(i+1),objectPDF,file]);
  let svg=await fs.readFile(file,'utf8');
  svg=svg.replace(/<svg\b([^>]*)>/,(_,a)=>'<svg'+a
    .replace(/\bwidth="[^"]*"/,`width="${b.w}px"`)
    .replace(/\bheight="[^"]*"/,`height="${b.h}px"`)
    .replace(/\bviewBox="[^"]*"/,`viewBox="${b.x*.75} ${b.y*.75} ${b.w*.75} ${b.h*.75}"`)+'>');
  if(/<text\b|<foreignObject\b|<image\b/.test(svg))throw Error('A component retained text, HTML or raster artwork: '+stem);
  await fs.writeFile(file,svg);
  run('rsvg-convert',['-w',String(Math.ceil(b.w*2)),'-h',String(Math.ceil(b.h*2)),'-o',path.join(out,object.png),file]);
  if(raw.key&&['illustration','badge'].includes(raw.kind)&&!published.has(raw.key)){
    published.add(raw.key);
    const name=raw.key;
    let editable=raw.outer.replace('width="1744" height="620" viewBox="0 0 1744 620"',`width="${b.w}" height="${b.h}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}"`);
    if(!/<text\b/.test(editable))editable=editable.replace(/<style>[\s\S]*?<\/style>/,'');
    await fs.writeFile(path.join(assets,name+'.svg'),editable);
    await fs.copyFile(file,path.join(assets,name+'.outlined.svg'));
    await fs.copyFile(path.join(out,object.png),path.join(assets,name+'.png'));
    library.push({name,source:name+'.svg',portable:name+'.outlined.svg',preview:name+'.png'});
  }
}
const manifest={inputHTML:path.basename(input),stage:[1920,1080],method:'Individually outlined, tightly cropped vector objects; no raster artwork inside SVG.',slides:compositions.map(c=>({index:c.index,id:c.id,frame:c.frame,objects:c.objects,expectedFullPNG:`../page-${String(c.index).padStart(2,'0')}.png`})),errors,blockedRemoteRequests:network};
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(assets,'manifest.json'),JSON.stringify(library,null,2)+'\n');
await fs.writeFile(path.join(assets,'README.md'),`# Reusable return illustrations\n\nVersion 04 contains these original vector objects in slides 06–08 and the component library on slide 35. In PowerPoint, use the Selection Pane to select, copy, move or resize a named object. Labels and arrows are separate vector objects; calendars and shipping tickets keep their printed values together. Arrows do not automatically reconnect when a node moves.\n\nThe source SVGs keep editable paths and any source text. Portable SVGs outline the text so fonts are not required. PNGs are transparent compatibility previews. The presentation itself uses SVG with a corresponding PNG fallback for older Office versions. Speaker notes remain editable text.\n\n| Component | Source SVG | Portable SVG | Preview |\n|---|---|---|---|\n${library.map(o=>`| ${o.name} | [SVG](${o.source}) | [Outlined](${o.portable}) | [PNG](${o.preview}) |`).join('\n')}\n`);
await browser.close();
if(errors.length||network.length)throw Error('Browser errors or network dependencies in component export.');
console.log(`Exported ${all.length} objects and ${library.length} reusable assets to ${out}`);
