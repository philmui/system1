#!/usr/bin/env node
/* Faithful HTML → print PDF → outlined SVG + PNG fallback → PowerPoint.
 * Usage: node docs/slides/src/export-powerpoint.cjs INPUT.html OUTPUT.pptx [ARTIFACT_DIR]
 * Dependencies: npm ci --prefix docs/slides/src/powerpoint; Playwright; Poppler; librsvg.
 * The HTML input is never modified. SVG artwork is not editable native text.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const {pathToFileURL}=require('node:url'),{execFileSync}=require('node:child_process');
const dependencyPaths=[process.env.SLIDES_POWERPOINT_DEPS,path.join(os.tmpdir(),'system1-powerpoint-export'),path.join(__dirname,'powerpoint')].filter(Boolean);
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve(__dirname,'../../../frontend')]}));
const PptxGenJS=require(require.resolve('pptxgenjs',{paths:dependencyPaths}));
const JSZip=require(require.resolve('jszip',{paths:dependencyPaths}));
const {PNG}=require(require.resolve('pngjs',{paths:dependencyPaths}));
const input=path.resolve(process.argv[2]||''),output=path.resolve(process.argv[3]||'');
if(!process.argv[2]||!process.argv[3])throw Error('Usage: node export-powerpoint.cjs INPUT.html OUTPUT.pptx [ARTIFACT_DIR]');
if(input===output||!output.endsWith('.pptx'))throw Error('Use a separate .pptx output path.');
if(fs.existsSync(output))throw Error('Refusing to overwrite an existing PowerPoint edition: '+output);
const artifacts=path.resolve(process.argv[4]||path.join(path.dirname(output),'exports',path.basename(output,'.pptx')));
fs.mkdirSync(artifacts,{recursive:true});
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:20*1024*1024});
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const W=13.3333333333,H=7.5;
const exportCSS=`
@page{size:1920px 1080px;margin:0}
@media print{
 html,body{margin:0!important;padding:0!important;width:1920px!important;height:auto!important;overflow:visible!important;background:white!important}
 .deck-viewport{position:static!important;inset:auto!important;overflow:visible!important}
 #deck.deck-stage{position:static!important;display:block!important;width:1920px!important;height:auto!important;overflow:visible!important;transform:none!important;visibility:visible!important}
 #deck>.slide{position:relative!important;inset:auto!important;display:block!important;width:1920px!important;height:1080px!important;margin:0!important;visibility:visible!important;opacity:1!important;break-after:page!important;page-break-after:always!important;overflow:hidden!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}
 #deck>.slide:last-child{break-after:auto!important;page-break-after:auto!important}
 #nav,#hint,#overview,#ppt-presenter,.deck-edit-ui,.edit-hotzone,#deck-announcer{display:none!important}
 .slide *{animation:none!important;transition:none!important;caret-color:transparent!important}
 .slide [data-anim],.slide .node,.slide .hidden-answer{opacity:1!important;visibility:visible!important;transform:none!important}
 .slide .bad-path{opacity:.2!important}.bad-path .diagram{min-height:0!important;height:100%!important}
 .interaction input,.interaction button,.exercise-button,.cost-presets{display:none!important}
}
`;
function staticNote(slide){
 const a=['POWERPOINT EXPORT','This edition preserves the HTML slide design as one outlined SVG graphic with an embedded PNG fallback. Slide text is vector artwork, not editable PowerPoint paragraphs. Speaker notes remain editable. Use the companion HTML for interaction.'];
 if(slide.interaction==='trace'&&slide.traceScenario==='returns')a.push('STATIC TRACE: '+slide.traceCaption+'. Exchange: '+slide.billing+'; cable return: '+slide.outage+'. '+slide.traceEvent,'Walkthrough: verify identity, match the owned purchase, interpret both AND tasks, prioritize the exchange, check exchange policy and stock, confirm its terms, obtain a service-issued exchange ID after rechecks, and resume the cable return. The cable is a separately purchased line item. Its return remains unfinished; exchange authorization does not claim completed shipping.');
 else if(slide.interaction==='trace')a.push('STATIC TRACE: '+slide.traceCaption+'. Invoice: '+slide.billing+'; outage: '+slide.outage+'. '+slide.traceEvent,'Walkthrough: capture both requested obligations, prioritize billing, verify access, retrieve authorized facts, explain, confirm resolution, and resume the unresolved outage. '+(slide.outage==='Handed off'?'The last state records technical support accepting the handoff; it does not claim the outage is resolved.':'The last state leaves the outage active and unresolved.'));
 if(slide.interaction==='gate')a.push('STATIC CONFIDENCE EXAMPLE: threshold 0.75. The twelve examples and scores are constructed teaching data. The HTML slider changes which examples are auto-routed at this decision point; a high-scoring mistake can survive a stricter gate. Threshold selection requires independent calibration and evaluation.');
 if(slide.interaction==='cost')a.push('STATIC COST EXAMPLE: 20% of routes still use the expensive routing stage. With invented normalized units G=1, D=0.03 and O=0.04, candidate cost is 0.27 versus 1.00 (73% lower for this routing stage only). At 93% fallback the candidate breaks even; at 100% it costs 1.07, or 7% more. This excludes later explanation, service work and changed human costs; it is not a vendor benchmark.');
 if(slide.exercise)a.push(slide.visibleText.includes('Exchange requested')?'STATIC EXERCISE: the repair is revealed. A predicted exchange request must still pass verified access, owned-purchase matching, exchange rules, inventory, confirmed terms, and service authorization. The model score is not permission to transact.':'STATIC EXERCISE: the repair is revealed. Before showing the repair, ask what is missing between a predicted credit request and a financial action. The repair verifies account access, checks policy, and enforces authorization in the service. The diagram size correction is export-only for the first HTML edition.');
 return a.join('\n\n');
}
function speakerText(slide){const n=slide.note||{},a=[n.title||slide.title];if(n.section)a.push('Section: '+n.section);if(n.purpose)a.push('Purpose: '+n.purpose);if(n.minutes)a.push('Suggested speaking time: '+n.minutes+' minutes');if(n.talk?.length)a.push('TALKING POINTS\n'+n.talk.map(x=>'• '+x).join('\n'));if(n.transition)a.push('Transition: '+n.transition);a.push(staticNote(slide));if(slide.links.length)a.push('WEB REFERENCES\n'+slide.links.map(l=>l.label+'\n'+l.url).join('\n\n'));if(slide.companions.length)a.push('LOCAL COMPANION REFERENCES\n'+slide.companions.map(l=>l.label+' — '+l.identifier).join('\n')+'\nThese identifiers refer to the accompanying repository and are not broken file hyperlinks.');a.push('SLIDE TEXT REFERENCE\n'+slide.visibleText);return a.join('\n\n')}
(async()=>{
 const sourceHash=sha(fs.readFileSync(input));
 const pageErrors=[],remoteRequests=[];let manifest;const pdf=path.join(artifacts,'slides.pdf');
 if(process.env.SLIDES_PRINT_MANIFEST){
  const printManifest=path.resolve(process.env.SLIDES_PRINT_MANIFEST);
  manifest=JSON.parse(fs.readFileSync(printManifest,'utf8'));
  if(!fs.existsSync(pdf))throw Error('The pre-rendered slides.pdf is required beside the print manifest.');
  const provenance=manifest.inputProvenance;
  if(!Array.isArray(provenance)||!provenance.length)throw Error('A verified print provenance chain is required.');
  for(const role of ['sourceHTML','frozenHTML','sourceJSON','freezeReport','diagramGeometry','diagramSource','diagramOutline','printedPDF','fontAudit','layoutValidation','componentFrame','componentFrameFallback'])if(!provenance.some(p=>p.role===role))throw Error('Missing required print provenance role: '+role);
  for(const item of provenance){const file=path.resolve(path.dirname(printManifest),item.path);if(!fs.existsSync(file)||sha(fs.readFileSync(file))!==item.sha256)throw Error('A print input or output changed: '+item.role);}
  const origin=provenance.find(p=>p.role==='sourceHTML'),printed=provenance.find(p=>p.role==='printedPDF');
  if(!origin||origin.sha256!==sourceHash||path.resolve(path.dirname(printManifest),origin.path)!==input)throw Error('Printed content belongs to a different HTML source.');
  if(!printed||printed.sha256!==sha(fs.readFileSync(pdf)))throw Error('Printed PDF does not match provenance.');
  const layout=provenance.find(p=>p.role==='layoutValidation');
  if(!layout||!JSON.parse(fs.readFileSync(path.resolve(path.dirname(printManifest),layout.path),'utf8')).passed)throw Error('Passing layout validation is required.');
  if(!manifest.fontAudit?.allEmbedded)throw Error('A successful PDF font audit is required.');
  remoteRequests.push(...(manifest.blockedRemoteRequests||[]));
 }else{
 const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));await context.route(/^https?:/,r=>{remoteRequests.push(r.request().url());return r.abort()});
 await page.goto(pathToFileURL(input).href,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);await page.addStyleTag({content:exportCSS});
 // Freeze deterministic teaching states in memory only. V1 exposes event controls; later editions also expose state snapshots.
 await page.evaluate(()=>{window.__setLowPowerMode?.(true,{persist:false});const q=s=>document.querySelector('#deck '+s);for(const [selector,value] of [['[data-interaction="gate"] input','.75'],['[data-interaction="cost"] input','20']]){const e=q(selector);if(e){e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}))}}const next=q('[data-trace-next]');let guard=0;while(next&&!next.disabled&&guard++<32)next.click();document.querySelectorAll('#deck [data-exercise]').forEach(el=>{if(!el.classList.contains('show-answer'))el.querySelector('[data-reveal-answer]')?.click()});document.querySelectorAll('#deck>.slide').forEach(el=>{el.inert=false;el.setAttribute('aria-hidden','false')});const trace=q('[data-interaction="trace"]');if(trace){const status=trace.closest('.slide').querySelector('.source-line span:last-child');if(status)status.textContent='Constructed trace · final static state';}});
 await page.emulateMedia({media:'print'});await page.waitForTimeout(100);
 manifest=await page.evaluate(()=>({title:document.title,fontsLoaded:document.fonts.status,slides:[...document.querySelectorAll('#deck>.slide')].map((s,i)=>{const r=s.getBoundingClientRect(),q=x=>s.querySelector(x)?.textContent?.trim()||'';const all=[...s.querySelectorAll('a[href]')].map(a=>{const box=a.getBoundingClientRect();return {label:a.textContent.trim(),raw:a.getAttribute('href'),url:a.href,box:{x:box.left-r.left,y:box.top-r.top,w:box.width,h:box.height}}});return {index:i+1,id:s.dataset.slideId,title:s.dataset.title||s.getAttribute('aria-label'),note:window.__SPEAKER_NOTES__?.find(n=>n.id===s.dataset.slideId),width:r.width,height:r.height,interaction:s.querySelector('[data-interaction]')?.dataset.interaction||null,traceScenario:s.querySelector('[data-interaction="trace"]')?.dataset.traceScenario||null,exercise:!!s.querySelector('[data-exercise]'),traceCaption:q('[data-trace-caption]'),traceEvent:q('[data-trace-event]'),billing:q('[data-trace-billing]'),outage:q('[data-trace-outage]'),visibleText:s.innerText,links:all.filter(l=>/^https?:/.test(l.url)),companions:all.filter(l=>!/^https?:/.test(l.url)).map(l=>({label:l.label,identifier:l.raw.replace(/^\.\.\//,'')}))}})}));
 if(manifest.fontsLoaded!=='loaded'||manifest.slides.some(s=>s.width!==1920||s.height!==1080))throw Error('Print stage or fonts are not ready.');
 await page.pdf({path:pdf,printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});await browser.close();
 }
 const info=run('pdfinfo',[pdf]),pageCount=Number(info.match(/Pages:\s+(\d+)/)?.[1]);if(pageCount!==manifest.slides.length)throw Error(`PDF page count ${pageCount} differs from ${manifest.slides.length} slides.`);
 const fontReport=run('pdffonts',[pdf]);fs.writeFileSync(path.join(artifacts,'pdf-fonts.txt'),fontReport);fs.writeFileSync(path.join(artifacts,'pdf-info.txt'),info);
 console.log(`Printed ${pageCount} slides; creating outlined vector artwork.`);
 run('pdftocairo',['-png','-r','96',pdf,path.join(artifacts,'page')]);
 const rasterNames=fs.readdirSync(artifacts).filter(n=>/^page-\d+\.png$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));if(rasterNames.length!==pageCount)throw Error('Unexpected PNG count.');
 const pptx=new PptxGenJS();pptx.defineLayout({name:'HTML_16_9',width:W,height:H});pptx.layout='HTML_16_9';pptx.author='Salesforce · tutorial';pptx.subject='Disaggregated intelligence for enterprise agentic reasoning';pptx.title=manifest.title;pptx.company='Salesforce';pptx.lang='en-US';pptx.theme={headFontFace:'Arial',bodyFontFace:'Arial',lang:'en-US'};
 const imageAudit=[];
 for(const slide of manifest.slides){
  const num=String(slide.index).padStart(2,'0'),svgPath=path.join(artifacts,`slide-${num}.svg`),pngPath=path.join(artifacts,rasterNames[slide.index-1]);run('pdftocairo',['-svg','-f',String(slide.index),'-l',String(slide.index),pdf,svgPath]);
  if(process.env.SLIDES_PRINT_MANIFEST)run('python3',[path.join(__dirname,'normalize_pdf_svg.py'),svgPath]);
  let svg=fs.readFileSync(svgPath,'utf8');svg=svg.replace(/<svg\b([^>]*)>/,(_,attrs)=>'<svg'+attrs.replace(/\bwidth="[^"]*"/,'width="1920px"').replace(/\bheight="[^"]*"/,'height="1080px"')+'>');fs.writeFileSync(svgPath,svg);
  if(/<text\b/.test(svg)||/<foreignObject\b/.test(svg))throw Error('Vector conversion retained text/font or browser-only objects.');
  const proof=path.join(artifacts,`svg-proof-${num}.png`);run('rsvg-convert',['-w','1920','-h','1080','-o',proof,svgPath]);const png=PNG.sync.read(fs.readFileSync(pngPath)),converted=PNG.sync.read(fs.readFileSync(proof));if(png.width!==1920||png.height!==1080||converted.width!==1920||converted.height!==1080)throw Error('Wrong fallback/proof dimensions.');let diff=0,changed=0;for(let j=0;j<png.data.length;j+=4){let d=0;for(let c=0;c<3;c++)d+=Math.abs(png.data[j+c]-converted.data[j+c]);diff+=d;if(d/3>30)changed++}const mean=diff/(png.width*png.height*3),fraction=changed/(png.width*png.height);if(mean>8||fraction>.08)throw Error(`SVG rendering deviates from PDF page ${slide.index}: mean ${mean.toFixed(2)}, changed ${(fraction*100).toFixed(1)}%`);
  fs.unlinkSync(proof);
  const ps=pptx.addSlide();ps.background={color:'FFFFFF'};ps.addImage({data:'image/svg+xml;base64,'+Buffer.from(svg).toString('base64'),x:0,y:0,w:W,h:H,objectName:`${slide.id} — outlined slide artwork`,altText:slide.title+'. See editable speaker notes for the full text, sources and static-state explanation.'});
  // Invisible hyperlink hit areas overlay the original source labels without changing their appearance.
  for(const l of slide.links){const x=Math.max(0,l.box.x),y=Math.max(0,l.box.y),w=Math.min(l.box.w,1920-x),h=Math.min(l.box.h,1080-y);if(w>0&&h>0)ps.addShape(pptx.ShapeType.rect,{x:x/1920*W,y:y/1080*H,w:w/1920*W,h:h/1080*H,line:{transparency:100},fill:{color:'FFFFFF',transparency:100},hyperlink:{url:l.url,tooltip:l.label},objectName:'Source: '+l.label});}
  ps.addNotes(speakerText(slide));imageAudit.push({slide:slide.index,id:slide.id,svg:path.basename(svgPath),fallback:path.basename(pngPath),glyphsOutlined:true,meanAbsoluteChannelDifference:mean,pixelsOver30Fraction:fraction,pngSha256:sha(fs.readFileSync(pngPath)),svgSha256:sha(Buffer.from(svg))});
 }
 // PptxGenJS emits the standard SVG + PNG relationship pair. Its Node SVG-preview path uses a placeholder;
 // replace that fallback package member with the independently rendered PDF PNG before delivery.
 const archive=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer',compression:true}));
 for(const s of manifest.slides){const rels=await archive.file(`ppt/slides/_rels/slide${s.index}.xml.rels`).async('string');const targets=[...rels.matchAll(/<Relationship\b[^>]*Type="[^"]*\/image"[^>]*Target="([^"]+)"[^>]*\/?\s*>/g)].map(m=>m[1]);const png=targets.find(x=>x.endsWith('.png')),svg=targets.find(x=>x.endsWith('.svg'));if(!png||!svg)throw Error('Missing SVG/fallback package pair.');archive.file(path.posix.normalize(path.posix.join('ppt/slides',png)),fs.readFileSync(path.join(artifacts,rasterNames[s.index-1])));}
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,await archive.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
 const report={input:path.basename(input),output:path.basename(output),inputSha256:sourceHash,outputSha256:sha(fs.readFileSync(output)),slides:pageCount,sizeInches:[W,H],renderEngine:manifest.renderEngine||'Chromium',browserVerified:!process.env.SLIDES_PRINT_MANIFEST,pageErrors,blockedRemoteRequests:remoteRequests,fonts:'Source HTML uses embedded fonts; PDF embeds subsets; SVG converts slide glyphs to paths. Editable notes use native Office text.',editable:'Speaker notes and hyperlink shapes; slide artwork is SVG, not native paragraphs.',imageAudit};
 fs.writeFileSync(path.join(artifacts,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(artifacts,'export-report.json'),JSON.stringify(report,null,2)+'\n');
 if(sha(fs.readFileSync(input))!==sourceHash)throw Error('Input HTML changed during export.');
 console.log(`${output}: ${pageCount} slides, ${(fs.statSync(output).size/1024/1024).toFixed(2)} MiB; source HTML unchanged.`);
})().catch(error=>{console.error(error);process.exitCode=1});
