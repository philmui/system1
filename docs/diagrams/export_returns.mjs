/** Render the original SVGs with their embedded fonts and verify text geometry.
 * Uses the workspace's existing Playwright installation; no package changes.
 *   node docs/diagrams/export_returns.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from '../../frontend/node_modules/playwright/index.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const reportOption = args.find(a=>a.startsWith('--report='));
const requestedNames = args.filter(a=>!a.startsWith('--report='));
const names = requestedNames.length ? requestedNames : ['returns-comparison', 'returns-policy'];
const browser = await chromium.launch({ headless: true });
const report = { method: 'Chromium with embedded Manrope and IBM Plex Mono', artifacts: [] };
try {
  for (const name of names) {
    const svg = await fs.readFile(path.join(dir, `${name}.svg`), 'utf8');
    const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    const width = Number(w), height = Number(h);
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1.5 });
    const page = await context.newPage();
    await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
      @page { size: ${width}px ${height}px; margin: 0; }
      * { box-sizing: border-box; } html, body { margin: 0; padding: 0; width: ${width}px; height: ${height}px; }
      svg { display: block; width: ${width}px; height: ${height}px; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style></head><body>${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => {
      const root = document.querySelector('svg');
      const view = root.viewBox.baseVal;
      const requiredFonts = new Set([...root.querySelectorAll('text')].map(el =>
        getComputedStyle(el).fontFamily.split(',')[0].trim().replaceAll('"','')));
      const inkContext = document.createElement('canvas').getContext('2d');
      const texts = [...root.querySelectorAll('text')].map(el => {
        const b = el.getBBox(), m = el.getCTM();
        const corners = [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]]
          .map(([x,y]) => new DOMPoint(x,y).matrixTransform(m));
        const x = Math.min(...corners.map(p=>p.x)), y = Math.min(...corners.map(p=>p.y));
        const right = Math.max(...corners.map(p=>p.x)), bottom = Math.max(...corners.map(p=>p.y));
        const bounds = el.dataset.box ? el.dataset.box.split(',').map(Number) : [0,0,view.width,view.height];
        // SVG getBBox includes font ascent/descent for unused glyphs. At mixed
        // sizes (a large calendar number beside small labels) those empty metric
        // boxes can overlap even though no rendered ink does. Check overlaps
        // using the actual glyph ink, retaining getBBox for canvas boundaries.
        const style=getComputedStyle(el);
        inkContext.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        inkContext.letterSpacing=style.letterSpacing==='normal'?'0px':style.letterSpacing;
        const inkMetrics=inkContext.measureText(el.textContent);
        const anchor=el.getAttribute('text-anchor')||'start';
        const tx=el.x.baseVal[0].value-el.getComputedTextLength()*(anchor==='middle'?.5:anchor==='end'?1:0);
        const ty=el.y.baseVal[0].value;
        const inkPoints=[[tx-inkMetrics.actualBoundingBoxLeft,ty-inkMetrics.actualBoundingBoxAscent],
          [tx+inkMetrics.actualBoundingBoxRight,ty-inkMetrics.actualBoundingBoxAscent],
          [tx-inkMetrics.actualBoundingBoxLeft,ty+inkMetrics.actualBoundingBoxDescent],
          [tx+inkMetrics.actualBoundingBoxRight,ty+inkMetrics.actualBoundingBoxDescent]]
          .map(([px,py])=>new DOMPoint(px,py).matrixTransform(m));
        const ink={x:Math.min(...inkPoints.map(p=>p.x)),y:Math.min(...inkPoints.map(p=>p.y)),
          right:Math.max(...inkPoints.map(p=>p.x)),bottom:Math.max(...inkPoints.map(p=>p.y))};
        return { text: el.textContent, x, y, right, bottom, bounds, ink };
      });
      const outOfBounds = texts.filter(t => t.x < t.bounds[0]-1 || t.y < t.bounds[1]-1 ||
        t.right > t.bounds[0]+t.bounds[2]+1 || t.bottom > t.bounds[1]+t.bounds[3]+1);
      const overlaps = [];
      for (let i=0; i<texts.length; i++) for(let j=i+1;j<texts.length;j++) {
        const a=texts[i].ink, b=texts[j].ink;
        const ix=Math.min(a.right,b.right)-Math.max(a.x,b.x);
        const iy=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
        if(ix>1 && iy>1) overlaps.push({ a:texts[i].text, b:texts[j].text, width:ix, height:iy });
      }
      return { textCount:texts.length, overlapMethod:'Actual glyph-ink boxes; font metric boxes retained for canvas bounds.', fontStatus:document.fonts.status,
        fonts:[...document.fonts].map(f=>({family:f.family,status:f.status,required:requiredFonts.has(f.family)})),
        canvas:{width:view.width,height:view.height}, outOfBounds, overlaps };
    });
    await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
    await page.pdf({ path:path.join(dir, `${name}.pdf`), preferCSSPageSize:true, printBackground:true });
    const outlined = path.join(dir, `${name}.outlined.svg`);
    execFileSync('pdftocairo', ['-svg', path.join(dir, `${name}.pdf`), outlined]);
    let portable = await fs.readFile(outlined, 'utf8');
    const title = svg.match(/<title id="title">([\s\S]*?)<\/title>/)[1];
    const description = svg.match(/<desc id="desc">([\s\S]*?)<\/desc>/)[1];
    portable = portable.replace(/<svg\b([^>]*)>/, (_, attrs) => '<svg' + attrs
      .replace(/\bwidth="[^"]*"/, `width="${width}px"`)
      .replace(/\bheight="[^"]*"/, `height="${height}px"`) +
      ` role="img" aria-labelledby="portable-title portable-desc"><title id="portable-title">${title}</title><desc id="portable-desc">${description}</desc>`);
    if (/<text\b|<foreignObject\b/.test(portable)) throw new Error('Outlined export retained text or browser-only objects');
    await fs.writeFile(outlined, portable);
    report.artifacts.push({ name, ...geometry });
    console.log(`${name}: ${geometry.textCount} text elements; ${geometry.outOfBounds.length} outside declared bounds; ${geometry.overlaps.length} text overlaps`);
    await context.close();
  }
} finally {
  await browser.close();
}
const reportName = reportOption?.slice('--report='.length) || (names.every(n=>n.startsWith('returns-slide-')) ? 'returns-slide-geometry-report.json' : 'returns-geometry-report.json');
if(path.basename(reportName)!==reportName)throw new Error('Report must be a filename within docs/diagrams.');
await fs.writeFile(path.join(dir, reportName), JSON.stringify(report,null,2)+'\n');
if(report.artifacts.some(a=>a.outOfBounds.length || a.overlaps.length || a.fonts.some(f=>f.required && f.status!=='loaded')))
  process.exitCode = 1;
