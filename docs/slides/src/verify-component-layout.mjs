/** Reconstruct the object layers independently and compare to the HTML print.
 * Usage: node verify-component-layout.mjs COMPONENT_MANIFEST.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from '../../../frontend/node_modules/playwright/index.mjs';
const require=createRequire(import.meta.url);
const {PNG}=require(require.resolve('pngjs',{paths:[process.env.SLIDES_POWERPOINT_DEPS||'/tmp/system1-powerpoint-export']}));
const file=path.resolve(process.argv[2]),dir=path.dirname(file),manifest=JSON.parse(await fs.readFile(file,'utf8'));
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const results=[];
for(const s of manifest.slides){
  const parts=[{...s.frame,x:0,y:0,w:1920,h:1080},...s.objects];
  const images=await Promise.all(parts.map(async p=>`<img alt="" src="data:image/svg+xml;base64,${(await fs.readFile(path.join(dir,p.svg))).toString('base64')}" style="position:absolute;left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px"/>`));
  const proof=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{width:1920px;height:1080px;margin:0;overflow:hidden;background:white}</style></head><body>${images.join('')}</body></html>`;
  const name=`reconstructed-${String(s.index).padStart(2,'0')}`;
  await fs.writeFile(path.join(dir,name+'.html'),proof);
  await page.setContent(proof);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  const screenshot=await page.screenshot({path:path.join(dir,name+'.png')});
  const a=PNG.sync.read(screenshot),b=PNG.sync.read(await fs.readFile(path.join(dir,s.expectedFullPNG)));
  if(a.width!==b.width||a.height!==b.height)throw Error('Proof dimensions differ');
  let delta=0,changed=0;
  for(let i=0;i<a.data.length;i+=4){let d=0;for(let c=0;c<3;c++)d+=Math.abs(a.data[i+c]-b.data[i+c]);delta+=d;if(d/3>30)changed++}
  const mean=delta/(a.width*a.height*3),fraction=changed/(a.width*a.height);
  results.push({slide:s.index,id:s.id,objectCount:s.objects.length,meanAbsoluteChannelDifference:mean,pixelsOver30Fraction:fraction,passed:mean<2&&fraction<.02});
}
await browser.close();
const report={method:'Chromium reconstruction of independent SVG objects compared to original HTML → PDF → PNG pages; not an Office-render claim.',passed:results.every(r=>r.passed),slides:results};
await fs.writeFile(path.join(dir,'component-visual-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
