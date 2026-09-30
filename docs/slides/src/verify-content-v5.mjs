/* Browser verification for the authored deck and its teaching examples.
   Usage: node docs/slides/src/verify-content-v5.mjs <deck.html> <report-directory> */
import {chromium} from '../../../frontend/node_modules/playwright/index.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const input=resolve(process.argv[2]),dir=resolve(process.argv[3]);
await mkdir(dir,{recursive:true});
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'});
const page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
await page.goto(pathToFileURL(input).href);await page.evaluate(()=>document.fonts.ready);
const report={input,slides:[],examples:{},viewports:[],errors,network};
const ids=await page.locator('#deck>.slide').evaluateAll(ss=>ss.map(s=>s.dataset.slideId));
async function go(id){const i=ids.indexOf(id);assert(i>=0,id);await page.evaluate(i=>window.deckGo(i),i);await page.waitForTimeout(50)}
for(let i=0;i<ids.length;i++){
 await go(ids[i]);
 const entry=await page.evaluate(()=>{const s=document.querySelector('#deck>.slide.active'),r=s.getBoundingClientRect();return{id:s.dataset.slideId,active:document.querySelectorAll('#deck>.slide.active').length,stage:{width:r.width,height:r.height},overflow:[...s.querySelectorAll('h1,h2,h3,p,.node,.card,.half,.slide-body,.source-line')].flatMap(e=>{const b=e.getBoundingClientRect();if(getComputedStyle(e).visibility==='hidden')return[];return(e.scrollHeight>e.clientHeight+6&&e.clientHeight>10)||(b.bottom>r.bottom-40&&b.height>5)?[{tag:e.tagName,text:e.textContent.slice(0,70),height:e.clientHeight,scrollHeight:e.scrollHeight,bottom:b.bottom}]:[]})}});
 report.slides.push(entry);assert.equal(entry.active,1);assert(Math.abs(entry.stage.width/entry.stage.height-16/9)<.001);assert.deepEqual(entry.overflow,[],ids[i]);
 await page.screenshot({path:`${dir}/${String(i+1).padStart(2,'0')}.png`});
}
await go('gate');report.examples.gate=[];
for(const [value,coverage,error,review] of [['0.5','100%','33%','0'],['0.75','58%','29%','5'],['0.99','8%','100%','11'],['1','0%','—','12']]){
 await page.locator('#gate-threshold').evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))},value);
 const got=await page.locator('[data-interaction=gate]').evaluate(e=>({coverage:e.querySelector('[data-gate-coverage]').textContent,error:e.querySelector('[data-gate-error]').textContent,review:e.querySelector('[data-gate-review]').textContent}));
 assert.deepEqual(got,{coverage,error,review});report.examples.gate.push({value,...got});
}
await page.screenshot({path:`${dir}/gate-zero-coverage.png`});
await go('economics');report.examples.cost=[];
for(const [p,total,saving] of [['20','0.27 normalized units','73% lower'],['93','1.00 normalized units','Break-even'],['100','1.07 normalized units','7% higher']]){
 await page.locator(`[data-cost-preset="${p}"]`).click();const got={total:await page.locator('[data-cost-total]').textContent(),saving:await page.locator('[data-cost-saving]').textContent()};assert.deepEqual(got,{total,saving});report.examples.cost.push({p,...got});
}
await page.screenshot({path:`${dir}/cost-failure.png`});
await go('trace');await page.locator('[data-trace-reset]').click();report.examples.trace=[];
assert.equal(await page.locator('[data-interaction=trace]').getAttribute('data-trace-scenario'),'returns');
assert.deepEqual(await page.locator('[data-interaction=trace] .trace-state .tag').allTextContents(),['Exchange','Cable return']);
assert.equal(await page.locator('[data-interaction=trace] [data-trace-step]').count(),8);
const expectedTrace=[
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
 const state={billing:await page.locator('[data-trace-billing]').textContent(),outage:await page.locator('[data-trace-outage]').textContent(),event:await page.locator('[data-trace-event]').textContent()};report.examples.trace.push(state);
 assert.equal(state.billing,expectedTrace[i][0]);assert.equal(state.outage,expectedTrace[i][1]);assert.match(state.event,expectedTrace[i][2]);
 if(i===4){assert.equal(state.billing,'Awaiting confirmation');await page.screenshot({path:`${dir}/trace-awaiting-confirmation.png`})}
 if(i===5){assert.equal(state.billing,'Confirmed');assert.equal(state.outage,'Pending');assert.match(state.event,/authorization is still pending/)}
 if(i===6){assert.equal(state.billing,'Authorized');assert.equal(state.outage,'Pending');assert.match(state.event,/service issues an exchange ID/)}
 if(i<7)await page.locator('[data-trace-next]').click();
}
assert.equal(report.examples.trace[7].billing,'Authorized');assert.equal(report.examples.trace[7].outage,'Active');assert.match(report.examples.trace[7].event,/unfinished/);assert(await page.locator('[data-trace-next]').isDisabled());
await page.screenshot({path:`${dir}/trace-cable-return-active.png`});
await go('exercise');const before=await page.evaluate(()=>window.__currentSlideIndex);await page.locator('[data-reveal-answer]').focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>window.__currentSlideIndex),before);assert.equal(await page.locator('[data-reveal-answer]').getAttribute('aria-expanded'),'true');await page.screenshot({path:`${dir}/exercise-repair.png`});
for(const viewport of [{width:1920,height:1080},{width:390,height:844}]){
 await page.setViewportSize(viewport);await go('opening');const r=await page.locator('#deck').boundingBox();assert(Math.abs(r.width/r.height-16/9)<.001);assert(r.x>=-.1&&r.y>=-.1&&r.x+r.width<=viewport.width+.1&&r.y+r.height<=viewport.height+.1);report.viewports.push({viewport,stage:r});await page.screenshot({path:`${dir}/${viewport.width===390?'phone':'full-stage'}.png`});
}
await page.setViewportSize({width:1280,height:720});await page.emulateMedia({media:'print'});
report.print=await page.locator('#deck>.slide').evaluateAll(ss=>({visible:ss.filter(s=>getComputedStyle(s).visibility==='visible'&&getComputedStyle(s).opacity==='1').length,heights:[...new Set(ss.map(s=>s.offsetHeight))]}));assert.equal(report.print.visible,ids.length);assert.deepEqual(report.print.heights,[1080]);
assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
await writeFile(`${dir}/verification.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({slides:ids.length,errors,network,checks:'All layout, arithmetic, trace, keyboard, fixed-stage, and print checks passed.'}));
