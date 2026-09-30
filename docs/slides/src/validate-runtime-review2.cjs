/* Second-review browser regressions. Usage: node validate-runtime-review2.cjs deck.html [results.json] */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {pathToFileURL}=require('node:url');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve(__dirname,'../../../frontend')]}));
const input=path.resolve(process.argv[2]||'docs/slides/03-disaggregated-intelligence.html');
const output=process.argv[3]&&path.resolve(process.argv[3]);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'slides-review2-'));
async function hydrated(page){await page.waitForFunction(()=>{const s=window.__pptPresenter.debugState();return s.currentPreviewRevision>0&&s.currentPreviewRevision===s.previewAppliedRevision})}
async function main(){
  const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(fs.readFileSync(input))});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true});const results=[];
  try{
    for(const url of [pathToFileURL(input).href,`http://127.0.0.1:${server.address().port}/deck.html`]){
      const result={protocol:url.split(':')[0],errors:[]};const context=await browser.newContext({viewport:{width:1280,height:720},acceptDownloads:true});
      context.on('page',p=>p.on('pageerror',e=>result.errors.push(e.message)));
      // Deliberately hold the incoming hydration to probe the actual message gap.
      await context.addInitScript(()=>{window.__heldHydrations=[];addEventListener('message',e=>{if(window.__holdHydration&&e.data?.type==='preview-goto'){e.stopImmediatePropagation();window.__heldHydrations.push(e.data)}})});
      const page=await context.newPage();await page.goto(url);
      const indices=await page.evaluate(()=>Object.fromEntries(['gate','exercise'].map(k=>{const el=document.querySelector(k==='gate'?'[data-interaction="gate"]':'[data-exercise]');return[k,[...document.querySelectorAll('#deck>.slide')].indexOf(el.closest('.slide'))]})));
      await page.evaluate(i=>window.deckGo(i),indices.gate);
      let popup=page.waitForEvent('popup');await page.locator('#ppt-presenter-btn').click();let audience=await popup;await audience.waitForLoadState();await hydrated(page);
      const frame=await page.locator('#ppt-current-frame').contentFrame();
      const current=page.frames().find(f=>f.url().includes('interactive=1'));
      const stale=await current.evaluate(()=>({state:window.__teachingExamples.snapshot(),revision:window.__pptPresenter.debugState().appliedPreviewRevision,index:window.__currentSlideIndex,session:window.__pptPresenter.debugState().session}));
      await current.evaluate(()=>window.__holdHydration=true);
      await page.locator('#ppt-exit').click();await page.evaluate(i=>window.deckGo(i),indices.exercise);await page.locator('[data-reveal-answer]').click();
      await page.evaluate(i=>window.deckGo(i),indices.gate);await page.locator('#gate-threshold').focus();await page.keyboard.press('End');
      popup=page.waitForEvent('popup');await page.locator('#ppt-presenter-btn').click();audience=await popup;await audience.waitForLoadState();
      await current.waitForFunction(()=>window.__heldHydrations.length>0);
      const pending=await page.evaluate(()=>window.__pptPresenter.debugState());
      const send=async revision=>current.evaluate(({stale,revision})=>parent.postMessage({__guizangPptSync:1,session:stale.session,role:'preview',type:'examples',revision,index:stale.index,examples:stale.state},'*'),{stale,revision});
      await send(stale.revision);await send(pending.currentPreviewRevision);await page.waitForTimeout(50);
      result.pendingHydration={inert:await page.locator('#ppt-current-frame').evaluate(e=>e.inert),applied:pending.previewAppliedRevision,state:await page.evaluate(()=>window.__teachingExamples.snapshot())};
      await current.evaluate(()=>{window.__holdHydration=false;const messages=window.__heldHydrations.splice(0);for(const data of messages)dispatchEvent(new MessageEvent('message',{data,source:parent}))});
      await hydrated(page);await send(stale.revision);await page.waitForTimeout(50);
      result.afterHydration={parent:await page.evaluate(()=>window.__teachingExamples.snapshot()),preview:await current.evaluate(()=>window.__teachingExamples.snapshot()),audience:await audience.evaluate(()=>window.__teachingExamples.snapshot()),inert:await page.locator('#ppt-current-frame').evaluate(e=>e.inert)};
      await frame.locator('#gate-threshold').focus();await frame.locator('#gate-threshold').press('Home');await page.waitForFunction(()=>window.__teachingExamples.snapshot().gateThreshold===.5);await audience.waitForFunction(()=>window.__teachingExamples.snapshot().gateThreshold===.5);
      result.validInteraction={parent:await page.evaluate(()=>window.__teachingExamples.snapshot()),audience:await audience.evaluate(()=>window.__teachingExamples.snapshot())};
      // The next preview is excluded from focus; the current preview allows browser traversal.
      result.nextPreview=await page.locator('#ppt-next-frame').evaluate(e=>({inert:e.inert,tabIndex:e.tabIndex,hidden:e.getAttribute('aria-hidden')}));
      const next=page.frames().find(f=>f.url().includes('mode=preview')&&!f.url().includes('interactive=1'));
      result.nextDeckInert=await next.locator('#deck').evaluate(e=>e.inert);
      result.previewKeys=await next.evaluate(()=>[{key:'Tab'},{key:'Tab',shiftKey:true},{key:'Escape'}].map(init=>{const e=new KeyboardEvent('keydown',{...init,bubbles:true,cancelable:true});document.body.dispatchEvent(e);return {...init,prevented:e.defaultPrevented}}));
      const links=frame.locator('#deck>.slide.active .source-line a');await links.last().focus();await page.keyboard.press('Tab');
      result.focusAfterPreview=await page.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id}));
      // Saving must serialize the authored <br> boundaries and restore them in both HTML copies.
      await page.locator('#ppt-exit').click();await page.evaluate(()=>{window.deckGo(0);window.__deckEditor.setEditing(true)});
      const edits={};for(const id of ['opening-main','opening-sub']){edits[id]=await page.locator(`[data-edit-id="${id}"]`).evaluate(node=>{node.appendChild(document.createTextNode(' revised'));node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:' revised'}));return node.innerText})}
      result.expectedEdits=edits;await page.reload();result.reloadedEdits={};for(const id of Object.keys(edits))result.reloadedEdits[id]=await page.locator(`[data-edit-id="${id}"]`).innerText();
      const downloadP=page.waitForEvent('download');await page.evaluate(()=>window.__deckEditor.download());const download=await downloadP;const exported=path.join(temp,`${result.protocol}.html`);await download.saveAs(exported);const copy=await context.newPage();await copy.goto(pathToFileURL(exported).href);result.exportedEdits={};for(const id of Object.keys(edits))result.exportedEdits[id]=await copy.locator(`[data-edit-id="${id}"]`).innerText();
      const revealed=s=>Object.values(s.reveals).every(Boolean);
      result.passed=result.errors.length===0&&result.pendingHydration.inert&&result.pendingHydration.applied===0&&result.pendingHydration.state.gateThreshold===1&&revealed(result.pendingHydration.state)&&!result.afterHydration.inert&&['parent','preview','audience'].every(k=>result.afterHydration[k].gateThreshold===1&&revealed(result.afterHydration[k]))&&['parent','audience'].every(k=>result.validInteraction[k].gateThreshold===.5&&revealed(result.validInteraction[k]))&&result.nextPreview.inert&&result.nextPreview.tabIndex===-1&&result.nextDeckInert&&result.previewKeys.every(k=>!k.prevented)&&result.focusAfterPreview.id!=='ppt-current-frame'&&result.focusAfterPreview.id!=='ppt-next-frame'&&Object.keys(edits).every(id=>edits[id].includes('\n')&&edits[id]===result.reloadedEdits[id]&&edits[id]===result.exportedEdits[id]);
      results.push(result);await context.close();
    }
  }finally{await browser.close();server.close();fs.rmSync(temp,{recursive:true,force:true})}
  if(output)fs.writeFileSync(output,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.passed))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exit(1)});
