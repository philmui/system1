#!/usr/bin/env node
/* Replace selected full-slide artwork with a fixed frame and movable SVG parts.
 * Usage: node make-component-powerpoint.cjs BASE.pptx MANIFEST.json OUTPUT.pptx
 * Each SVG must already have outlined labels and a separately rendered PNG.
 * The base and all source artwork remain unchanged. Existing output is refused.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const dependencyPaths = [process.env.SLIDES_POWERPOINT_DEPS,
  path.join(os.tmpdir(), 'system1-powerpoint-export'), '/tmp/system1-powerpoint-export',
  path.join(__dirname, 'powerpoint')].filter(Boolean);
const JSZip = require(require.resolve('jszip', { paths: dependencyPaths }));
const { PNG } = require(require.resolve('pngjs', { paths: dependencyPaths }));

const OLD_DISCLOSURE = 'This edition preserves the HTML slide design as one outlined SVG graphic with an embedded PNG fallback. Slide text is vector artwork, not editable PowerPoint paragraphs. Speaker notes remain editable. Use the companion HTML for interaction.';
const NEW_DISCLOSURE = 'COMPONENT POWERPOINT\n\nThis slide uses a fixed vector frame plus separate, independently movable vector illustrations, labels and connectors. Labels are outlined artwork, not native editable text. Speaker notes remain editable. Every vector object has an embedded PNG fallback. Use the Selection Pane to select named parts. Connectors are independent objects; they do not automatically follow moved illustrations. Other slides retain their complete-frame vector artwork.';
const IMAGE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
const ALLOWED_KINDS = new Set(['illustration', 'label', 'connector', 'background', 'decoration', 'badge']);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
function decodeXml(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    if (entity[0] === '#') return String.fromCodePoint(entity[1].toLowerCase() === 'x'
      ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity];
  });
}
function attrs(fragment) {
  return Object.fromEntries([...fragment.matchAll(/([\w:.-]+)\s*=\s*(["'])(.*?)\2/gs)]
    .map(m => [m[1], decodeXml(m[3])]));
}
function relationships(xml) {
  return [...xml.matchAll(/<Relationship\b[^>]*\/?\s*>/g)].map(m => ({ ...attrs(m[0]), raw: m[0] }));
}
function target(base, relative) {
  return path.posix.normalize(path.posix.join(base, relative));
}
function relativePath(base, file) {
  if (typeof file !== 'string' || !file || path.isAbsolute(file)) fail('Manifest asset paths must be relative strings.');
  return path.resolve(base, file);
}
function assertSvg(bytes, label) {
  const svg = bytes.toString('utf8');
  if (!/<(?:[\w.-]+:)?svg\b/.test(svg)) fail(label + ': not an SVG document.');
  if (/<(?:[\w.-]+:)?(?:text|tspan|textPath|foreignObject|image|font|script|iframe)\b/i.test(svg))
    fail(label + ': SVG must contain only outlined vector artwork; text, images and active content are forbidden.');
  if (/@font-face|font-family\s*[:=]|data:font\//i.test(svg)) fail(label + ': SVG has a font dependency.');
  for (const m of svg.matchAll(/(?:xlink:)?href\s*=\s*(["'])(.*?)\1/g))
    if (!m[2].startsWith('#')) fail(label + ': SVG contains a nonlocal reference.');
  for (const m of svg.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g))
    if (!m[2].trim().startsWith('#')) fail(label + ': SVG contains an external style reference.');
  return svg;
}
function assetPair(asset, folder, label) {
  if (!asset || typeof asset !== 'object') fail(label + ': missing asset pair.');
  const svgPath = relativePath(folder, asset.svg), pngPath = relativePath(folder, asset.png);
  const svg = fs.readFileSync(svgPath), png = fs.readFileSync(pngPath);
  assertSvg(svg, label);
  let decoded;
  try { decoded = PNG.sync.read(png, { checkCRC: true }); }
  catch (error) { fail(label + ': invalid PNG fallback: ' + error.message); }
  if (!(decoded.width > 0 && decoded.height > 0)) fail(label + ': empty PNG fallback.');
  return { svg, png, svgPath, pngPath, svgSha256: sha(svg), pngSha256: sha(png),
    pngSize: [decoded.width, decoded.height] };
}
function pictureXml(id, name, kind, pngRel, svgRel, emu) {
  const [x, y, w, h] = emu;
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${escapeXml(name)}" descr="${escapeXml('Reusable ' + kind + '; independently movable vector artwork with PNG fallback.')}"/>` +
    '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>' +
    `<p:blipFill><a:blip r:embed="${pngRel}"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}">` +
    `<asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${svgRel}"/>` +
    '</a:ext></a:extLst></a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
}

(async () => {
  if (process.argv.length !== 5) fail('Usage: node make-component-powerpoint.cjs BASE.pptx MANIFEST.json OUTPUT.pptx');
  const basePath = path.resolve(process.argv[2]), manifestPath = path.resolve(process.argv[3]);
  const output = path.resolve(process.argv[4]), folder = path.dirname(manifestPath);
  if (!output.toLowerCase().endsWith('.pptx') || output === basePath || fs.existsSync(output))
    fail('Use a new .pptx output path; existing output is never overwritten.');
  const baseBuffer = fs.readFileSync(basePath), manifestBuffer = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBuffer.toString('utf8'));
  if(manifest.inputHTMLSha256){
    const baseFolder=path.dirname(basePath);
    const baseReport=JSON.parse(fs.readFileSync(path.join(baseFolder,'export-report.json'),'utf8'));
    const printManifest=JSON.parse(fs.readFileSync(path.join(baseFolder,'manifest.json'),'utf8'));
    if(baseReport.inputSha256!==manifest.inputHTMLSha256 || baseReport.outputSha256!==sha(baseBuffer))fail('Component source or base PowerPoint differs from the verified print export.');
    const provenance=printManifest.inputProvenance;
    if(!Array.isArray(provenance))fail('Missing base print provenance.');
    for(const s of manifest.slides){
      for(const [kind,file] of Object.entries(s.frame)){
        const full=path.resolve(folder,file);
        const expected=provenance.find(p=>path.resolve(baseFolder,p.path)===full);
        if(!expected||expected.sha256!==sha(fs.readFileSync(full)))fail('Frame differs from the verified print: '+s.id+'/'+kind);
      }
      const diagram=provenance.find(p=>p.role==='diagramSource'&&path.basename(p.path)===s.sourceAsset);
      if(!diagram||diagram.sha256!==s.sourceSVGHash)fail('Component source differs from printed composition: '+s.id);
    }
    const proof=JSON.parse(fs.readFileSync(path.join(folder,'component-visual-verification.json'),'utf8'));
    if(!proof.passed||proof.manifestSha256!==sha(manifestBuffer)||proof.inputHTMLSha256!==manifest.inputHTMLSha256)fail('Current complete-page reconstruction must pass before packaging.');
    for(const [file,hash] of Object.entries(proof.verifiedInputs||{}))if(sha(fs.readFileSync(path.resolve(folder,file)))!==hash)fail('A reconstruction input changed: '+file);
  }
  if (!Array.isArray(manifest.stage) || manifest.stage.length !== 2 ||
      !manifest.stage.every(n => Number.isFinite(n) && n > 0)) fail('Manifest stage must contain two positive dimensions.');
  if (!Array.isArray(manifest.slides) || !manifest.slides.length) fail('Manifest must contain selected slides.');
  const [stageW, stageH] = manifest.stage;
  const zip = await JSZip.loadAsync(baseBuffer, { checkCRC32: true });
  async function read(name) {
    const file = zip.file(name);
    if (!file) fail('Missing package member: ' + name);
    return file.async('string');
  }
  const presentation = await read('ppt/presentation.xml');
  const size = attrs(presentation.match(/<p:sldSz\b[^>]*>/)?.[0] || '');
  const cx = Number(size.cx), cy = Number(size.cy);
  if (!(cx > 0 && cy > 0) || Math.abs(cx / cy - stageW / stageH) > 1e-6)
    fail('Manifest stage aspect ratio does not match the PowerPoint.');
  const presRels = new Map(relationships(await read('ppt/_rels/presentation.xml.rels')).map(r => [r.Id, r]));
  const slideMembers = [...presentation.matchAll(/<p:sldId\b[^>]*>/g)].map(m => {
    const rel = presRels.get(attrs(m[0])['r:id']);
    if (!rel) fail('Presentation contains a missing slide relationship.');
    return target('ppt', rel.Target);
  });
  const originals = new Map();
  for (const [name, entry] of Object.entries(zip.files)) if (!entry.dir)
    originals.set(name, sha(await entry.async('nodebuffer')));
  const report = {
    schemaVersion: 1, base: path.basename(basePath), baseSha256: sha(baseBuffer),
    manifest: path.basename(manifestPath), manifestSha256: sha(manifestBuffer),
    output: path.basename(output), stage: manifest.stage, sizeEMU: [cx, cy],
    totalSlideCount: slideMembers.length,
    editability: 'Named illustrations, outlined labels and connectors are independently movable SVG objects. Text remains outlined; connectors do not automatically follow moved illustrations.',
    noteDisclosure: NEW_DISCLOSURE, slides: [], preservedBaseMembers: [],
  };
  const selectedIndices = new Set(), selectedIds = new Set();
  for (const specification of manifest.slides) {
    const { index, id, objects } = specification;
    if (!Number.isInteger(index) || index < 1 || index > slideMembers.length || selectedIndices.has(index))
      fail('Selected slide index is invalid or repeated: ' + index);
    if (typeof id !== 'string' || !id || selectedIds.has(id)) fail('Selected slide id is missing or repeated.');
    selectedIndices.add(index); selectedIds.add(id);
    if (!Array.isArray(objects) || !objects.length) fail('Slide ' + index + ' has no component objects.');
    const member = slideMembers[index - 1];
    const slideDir = path.posix.dirname(member);
    const relMember = slideDir + '/_rels/' + path.posix.basename(member) + '.rels';
    let slideXml = await read(member), relXml = await read(relMember);
    const originalSlide = slideXml, rels = relationships(relXml);
    const byId = new Map(rels.map(r => [r.Id, r]));
    const pictures = [...slideXml.matchAll(/<p:pic\b[\s\S]*?<\/p:pic>/g)];
    if (pictures.length !== 1) fail('Slide ' + index + ': expected one base full-slide picture.');
    const originalPicture = pictures[0][0];
    const meta = attrs(originalPicture.match(/<p:cNvPr\b[^>]*>/)?.[0] || '');
    if (!meta.name?.startsWith(id + ' —')) fail('Slide ' + index + ': id does not match base artwork: ' + meta.name);
    const pngRid = attrs(originalPicture.match(/<a:blip\b[^>]*>/)?.[0] || '')['r:embed'];
    const svgRid = attrs(originalPicture.match(/<asvg:svgBlip\b[^>]*>/)?.[0] || '')['r:embed'];
    if (!byId.has(pngRid) || !byId.has(svgRid)) fail('Slide ' + index + ': missing base SVG/PNG relationship pair.');
    let nextShape = Math.max(...[...slideXml.matchAll(/<p:cNvPr\b[^>]*>/g)].map(m => Number(attrs(m[0]).id))) + 1;
    let nextRel = Math.max(0, ...rels.map(r => Number(r.Id.match(/^rId(\d+)$/)?.[1]) || 0)) + 1;
    const prefix = `component-s${String(index).padStart(2, '0')}`;
    const audit = { index, id, member, relationshipMember: relMember, frame: null, objects: [],
      baseSlideSha256: sha(originalSlide),
      sourceLinks: rels.filter(r => r.Type.endsWith('/hyperlink')).map(r => ({ id: r.Id, target: r.Target, mode: r.TargetMode || '' })) };
    function storePair(pair, suffix) {
      const names = { png: `ppt/media/${prefix}-${suffix}.png`, svg: `ppt/media/${prefix}-${suffix}.svg` };
      if (zip.file(names.png) || zip.file(names.svg)) fail('Component media name already exists: ' + prefix + '-' + suffix);
      zip.file(names.png, pair.png); zip.file(names.svg, pair.svg);
      return { ...names, pngSha256: pair.pngSha256, svgSha256: pair.svgSha256, pngSize: pair.pngSize };
    }
    const framePair = assetPair(specification.frame, folder, 'Slide ' + index + ' frame');
    const frameMedia = storePair(framePair, 'frame');
    for (const [rid, media] of [[pngRid, frameMedia.png], [svgRid, frameMedia.svg]]) {
      const old = byId.get(rid);
      const replacement = old.raw.replace(/\bTarget\s*=\s*(["']).*?\1/, `Target="${escapeXml(path.posix.relative(slideDir, media))}"`);
      relXml = relXml.replace(old.raw, replacement);
    }
    const frameName = `${id} — frame (background and slide chrome)`;
    let framePicture = originalPicture.replace(/<p:cNvPr\b[^>]*>/, tag =>
      tag.replace(/\bname="[^"]*"/, `name="${escapeXml(frameName)}"`)
        .replace(/\bdescr="[^"]*"/, 'descr="Fixed vector frame; foreground illustrations, labels and connectors are separate movable objects."'));
    audit.frame = { name: frameName, shapeId: Number(meta.id), ...frameMedia, emu: [0, 0, cx, cy], pngRel: pngRid, svgRel: svgRid };
    const names = new Set(), newRelations = [], componentPictures = [];
    for (const [position, object] of objects.entries()) {
      if (typeof object.name !== 'string' || !object.name || /[\u0000-\u001f]/.test(object.name) || names.has(object.name))
        fail('Slide ' + index + ': component names must be unique nonempty XML-safe strings.');
      if (!ALLOWED_KINDS.has(object.kind)) fail('Slide ' + index + ': unsupported component kind: ' + object.kind);
      names.add(object.name);
      const bounds = [object.x, object.y, object.w, object.h];
      if (!bounds.every(Number.isFinite) || object.x < 0 || object.y < 0 || object.w <= 0 || object.h <= 0 ||
          object.x + object.w > stageW + 1e-6 || object.y + object.h > stageH + 1e-6)
        fail('Slide ' + index + ': invalid bounds for ' + object.name);
      const pair = assetPair(object, folder, object.name);
      const media = storePair(pair, 'o' + String(position + 1).padStart(3, '0'));
      const pngRel = 'rId' + nextRel++, svgRel = 'rId' + nextRel++;
      for (const [rid, file] of [[pngRel, media.png], [svgRel, media.svg]])
        newRelations.push(`<Relationship Id="${rid}" Type="${IMAGE_REL}" Target="${escapeXml(path.posix.relative(slideDir, file))}"/>`);
      const emu = [Math.round(object.x / stageW * cx), Math.round(object.y / stageH * cy),
        Math.round(object.w / stageW * cx), Math.round(object.h / stageH * cy)];
      if (emu[2] < 1 || emu[3] < 1 || emu[0] + emu[2] > cx + 1 || emu[1] + emu[3] > cy + 1)
        fail('Component is too small or exceeds the slide after EMU conversion: ' + object.name);
      const shapeId = nextShape++, name = `${id} — ${object.kind}: ${object.name}`;
      componentPictures.push(pictureXml(shapeId, name, object.kind, pngRel, svgRel, emu));
      audit.objects.push({ name, sourceName: object.name, kind: object.kind, shapeId, bounds, emu, pngRel, svgRel, ...media });
    }
    // Inserting immediately after the frame keeps existing source hit areas on top.
    slideXml = slideXml.replace(originalPicture, framePicture + componentPictures.join(''));
    if (!relXml.includes('</Relationships>')) fail('Unsupported relationship XML root.');
    relXml = relXml.replace('</Relationships>', newRelations.join('') + '</Relationships>');
    const noteRel = rels.find(r => r.Type.endsWith('/notesSlide'));
    if (!noteRel) fail('Slide ' + index + ': editable speaker notes are required.');
    const noteMember = target(slideDir, noteRel.Target);
    const oldNotes = await read(noteMember);
    if (!oldNotes.includes(escapeXml(OLD_DISCLOSURE))) fail('Slide ' + index + ': expected base-export disclosure was not found.');
    const notes = oldNotes.replace(escapeXml(OLD_DISCLOSURE), escapeXml(NEW_DISCLOSURE));
    zip.file(noteMember, notes); zip.file(member, slideXml); zip.file(relMember, relXml);
    audit.noteMember = noteMember; audit.notesSha256 = sha(notes);
    audit.originalNotesSha256 = sha(oldNotes);
    audit.slideSha256 = sha(slideXml); audit.relationshipsSha256 = sha(relXml);
    audit.objectCount = objects.length;
    if (specification.expectedFullPNG) {
      const expected = fs.readFileSync(relativePath(folder, specification.expectedFullPNG));
      audit.expectedFullPNGSha256 = sha(expected);
    }
    report.slides.push(audit);
  }
  let contentTypes = await read('[Content_Types].xml');
  for (const [extension, contentType] of [['svg', 'image/svg+xml'], ['png', 'image/png']]) {
    const found = [...contentTypes.matchAll(/<Default\b[^>]*>/g)].some(m => attrs(m[0]).Extension?.toLowerCase() === extension);
    if (!found) contentTypes = contentTypes.replace('</Types>', `<Default Extension="${extension}" ContentType="${contentType}"/></Types>`);
  }
  zip.file('[Content_Types].xml', contentTypes);
  for (const [name, hash] of originals) {
    const entry = zip.file(name);
    if (entry && sha(await entry.async('nodebuffer')) === hash) report.preservedBaseMembers.push({ name, sha256: hash });
  }
  report.changedBaseMembers = [...originals.keys()].filter(name => !report.preservedBaseMembers.some(e => e.name === name));
  const outputBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, outputBuffer, { flag: 'wx' });
  report.outputSha256 = sha(outputBuffer);
  report.componentSlideCount = report.slides.length;
  report.movableObjectCount = report.slides.reduce((n, s) => n + s.objects.length, 0);
  fs.writeFileSync(path.join(folder, 'component-package-report.json'), JSON.stringify(report, null, 2) + '\n');
  if (sha(fs.readFileSync(basePath)) !== report.baseSha256 || sha(fs.readFileSync(manifestPath)) !== report.manifestSha256)
    fail('A source changed during export.');
  console.log(`${output}: ${report.componentSlideCount} component slides, ${report.movableObjectCount} independently movable SVG objects; notes and source links preserved.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
