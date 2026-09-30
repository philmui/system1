# PowerPoint editions

Version 04 PowerPoint mirrors the current HTML edition: slide count, order, illustrations, source labels, and speaker notes travel together in a single `.pptx` file. The earlier numbered files remain available as review history, with their observed integrity recorded separately.

| Edition | Slides | PowerPoint |
|---|---:|---|
| 1 | 30 | [01-disaggregated-intelligence.pptx](01-disaggregated-intelligence.pptx) |
| 2 | 31 | [02-disaggregated-intelligence.pptx](02-disaggregated-intelligence.pptx) |
| 3 | 34 | [03-disaggregated-intelligence.pptx](03-disaggregated-intelligence.pptx) |
| 4 · recommended | 35 | [04-disaggregated-intelligence.pptx](04-disaggregated-intelligence.pptx) |

Version 04 replaces the text-first return views with large pictorial objects in slides 06–08 and adds a component library on slide 35. Those four slides contain 152 independently movable vector objects plus a frame per slide. Illustrations, labels, badges and arrows have descriptive PowerPoint Selection Pane names. Calendars and shipping tickets keep their printed values together. The source library includes 22 reusable [SVG components](assets/components/README.md).

The other slides retain whole-slide artwork. Version 03 remains available, and its original 31-slide HTML/PPTX pair is retained in [the pre-insertion archive](versions/v3-before-returns/README.md). Current version 04 proofs are in `exports/04-disaggregated-intelligence`; earlier proofs remain in their original directories.

Artwork uses **SVG with outlined text**, accompanied by matching PNG fallbacks. Whole-slide fallbacks are 1920×1080; component fallbacks are transparent images at twice their authored pixel dimensions. The slide typography needs no installed source fonts. Labels can be moved and resized as vector objects; they are not native editable PowerPoint paragraphs. The source SVG files retain editable paths and text. Speaker notes and source-link shapes remain native PowerPoint objects. The [PptxGenJS image documentation](https://gitbrent.github.io/PptxGenJS/docs/api-images/) describes SVG image support in recent desktop PowerPoint and Microsoft 365.

To rearrange a workflow, select an illustration and its label together, then reposition the route objects. The connectors are separate vector arrows; they do not automatically reconnect. The optional library slide provides a clean starting set for copy/paste. Slide notes explain these affordances.

The source HTML embeds its fonts. Chromium embeds font subsets in the intermediate PDF, and the PDF-to-SVG conversion turns slide glyphs into paths. Editable speaker notes use native Office text; no claim is made that installable font files are embedded in the `.pptx`.

## Static teaching states

PowerPoint preserves a deliberate static state of each interactive example; the notes explain the corresponding walkthrough and link back to the companion material.

- **Trace:** edition 1 ends with billing resolved and the outage active. Later editions end with an accepted technical-support handoff while the outage remains unresolved. Edition 3 places the shared event caption above both obligation cards, so it cannot be mistaken for invoice-specific status.
- **Confidence gate:** the threshold is 0.75 on the twelve constructed examples.
- **Cost model:** the fallback rate is 20%. Notes also explain the 93% break-even and 100% higher-cost scenarios. These are invented routing-stage units, not provider benchmarks.
- **Repair exercise:** the repair is visible and the flawed path is faded.

Browser navigation, editing controls, sliders, and action buttons are removed for print. The edition 1 exercise diagram receives a print-only size correction. Export never changes its input HTML. The requested version 03 update was authored separately, checked, and substituted after archiving its earlier files. Public source labels have clickable PowerPoint link regions and full URLs in notes; repository references are recorded as companion identifiers, not broken file hyperlinks.

## Export and verification

The initial exporter uses the actual HTML layout: Chromium print PDF → Poppler SVG with outlined glyphs → PptxGenJS. A Poppler PNG and an independently rendered SVG are compared for every page. The verified PNG replaces the library's Node-side SVG preview placeholder before the package is written. Version 04 then replaces four complete slide images with empty frames plus tightly cropped, separately printed and outlined SVG objects. Each object has its own PowerPoint picture, transform, SVG relationship and PNG fallback.

An independent reconstruction positions those objects over their frames and compares the result to the original print pages. All four passed, with a maximum mean channel difference of 0.579 out of 255. The component package validator checks exact object identities, tight transforms, layer order, descriptive names, SVG/PNG pairs, source links, note preservation and unchanged inherited package members. New frames and component SVGs contain no raster image nodes or font-dependent text; this claim is scoped to the rebuilt slides because some inherited artwork contains raster effects.

Artifacts under `exports/<edition>/` include the PDF, individual SVG/PNG artwork, font report, source manifest, image-comparison results, and package-validation report. The validator checks slide order/count, 16:9 dimensions, every original purpose/talking point/transition in notes, exact source hyperlink targets in order, ZIP/XML relationships, object bounds, self-contained SVGs, and exact packaged-artwork/fallback hashes.

No Microsoft PowerPoint or LibreOffice renderer is installed in this environment. Validation therefore establishes package consistency and artwork fidelity without claiming a render in either Office application.

## Rebuild

Prerequisites are Node.js, the repository's Playwright installation and Chromium, Poppler (`pdftocairo`, `pdfinfo`, `pdffonts`), and librsvg (`rsvg-convert`). Packaging dependencies are pinned in `src/powerpoint/package.json` and its lockfile. Keep the installed dependency tree outside the delivered slides folder:

```sh
SLIDES_POWERPOINT_DEPS="$(mktemp -d /tmp/slides-powerpoint-deps.XXXXXX)"
cp docs/slides/src/powerpoint/package*.json "$SLIDES_POWERPOINT_DEPS/"
npm ci --prefix "$SLIDES_POWERPOINT_DEPS" --ignore-scripts --no-audit --no-fund
export SLIDES_POWERPOINT_DEPS

node docs/slides/src/export-powerpoint.cjs INPUT.html OUTPUT.pptx
python3 docs/slides/src/validate-powerpoint.py OUTPUT.pptx
```

The exporter refuses to overwrite an existing `.pptx`. An optional third argument chooses the artifact directory; the validator accepts that directory as its second argument and an optional report path as its third. The exporter checks the input hash before and after conversion.

For the current component edition, use new output paths when rebuilding:

```sh
python3 docs/diagrams/build_returns_illustrated.py
python3 docs/slides/src/integrate_returns_v4.py
python3 docs/slides/src/build_deck.py src/deck-v4.json rebuilt-v4.html
node docs/slides/src/export-powerpoint.cjs docs/slides/rebuilt-v4.html docs/slides/exports/rebuilt-v4/artwork-base.pptx docs/slides/exports/rebuilt-v4
python3 docs/slides/src/validate-powerpoint.py docs/slides/exports/rebuilt-v4/artwork-base.pptx docs/slides/exports/rebuilt-v4
node docs/slides/src/export-components.mjs docs/slides/rebuilt-v4.html docs/slides/exports/rebuilt-v4/components
node docs/slides/src/verify-component-layout.mjs docs/slides/exports/rebuilt-v4/components/manifest.json
node docs/slides/src/make-component-powerpoint.cjs docs/slides/exports/rebuilt-v4/artwork-base.pptx docs/slides/exports/rebuilt-v4/components/manifest.json docs/slides/rebuilt-v4.pptx
python3 docs/slides/src/validate-component-powerpoint.py docs/slides/rebuilt-v4.pptx docs/slides/exports/rebuilt-v4/components/manifest.json
```

The base-artwork validation and final-component validation are separate reports because the final package deliberately has multiple pictures on the selected slides. Their paths are linked from [verification](verification.md).
