# Editable PowerPoint version 05

[05-disaggregated-intelligence.pptx](05-disaggregated-intelligence.pptx) contains native editable components on all 36 slides: **722 text boxes**, **980 drawing shapes** and **623 named groups**. It has no slide-picture objects or image fills. Titles, paragraphs, code, diagram labels, table cells, chart parts, cards, paths and background gradients can be customized in PowerPoint. All 36 speaker-note sets and 77 web-source links are retained.

The [editing guide](EDITING-V5.md) explains the Selection Pane, nested groups, text editing, fills, outlines and freeform points. Source links are attached to their text. Arrows are editable geometry; moving a node does not automatically reroute them. Authored line breaks are retained in coherent text boxes, so adding words may require resizing the box or adjusting its breaks.

The exact [previous version 05 export](versions/v5-before-editable/05-disaggregated-intelligence.pptx) remains available. It contained 31 whole-slide SVG pictures and five compositions of separately movable SVG pictures. Editions 01–04 are unchanged. The reusable [SVG source library](assets/components-v5/README.md) also remains available; the current PPTX converts its illustration geometry and labels to native PowerPoint objects.

## Static teaching states

The PowerPoint retains the same deliberate snapshots as the preceding version 05 export:

- The exchange is **Authorized** and the separately purchased cable return is **Active**. The complete case remains unfinished.
- The confidence threshold is **0.75** on twelve constructed examples, with seven auto-routed and two of those wrong.
- The routing-cost example uses **20%** frontier fallback and **0.27** invented normalized units. Notes retain the break-even and higher-cost cases.
- The repair exercise reveals the required access, policy, confirmation and service controls.

The [HTML companion](05-disaggregated-intelligence.html) supplies the interactive controls. This conversion changes the PowerPoint representation without changing the reasoning, example values or business-rule boundaries.

## Typography and fidelity

The Salesforce reference styling is retained: blue headings, a sky-to-mint background, white and pastel surfaces, Salesforce Sans body text, Manrope headings and IBM Plex Mono code. [Style provenance](research/v5-salesforce-style.md) documents the Manrope substitute for the reference's heading face.

Native text needs the corresponding fonts on the editing computer. The [open-font ZIP](assets/editable-v5-fonts.zip) provides Manrope Regular/Bold and IBM Plex Mono Regular with their OFL licenses. Salesforce Sans remains a separately licensed font; it is not included in that pack. Nothing is installed automatically. PowerPoint can substitute missing fonts, which may change line breaks and spacing.

DrawingML runs use regular or bold styles. The source illustration's intermediate variable-font weights are mapped to those native styles; these small typography differences are visible in the recorded comparisons. There is no claim of exact font equivalence or native Office rendering.

## Rebuild the native components

The conversion uses the existing frozen teaching state and measures its actual layout with WeasyPrint/Pango. Original SVG sources become editable DrawingML geometry and text. The package builder retains the original notes and hyperlink targets, then replaces every slide's picture content with native objects. It never overwrites its input or an existing candidate.

Use the Python rendering dependencies from [requirements-render.txt](src/requirements-render.txt), plus system Pango, Fontconfig, Cairo, librsvg and Poppler. Register the bundled fonts for local measurement before running the extractor and builder:

```sh
python3 docs/slides/src/prepare-local-fonts.py /tmp/slides-v5-fonts
export FONTCONFIG_FILE=/tmp/slides-v5-fonts/fonts.conf
python3 docs/slides/src/extract-editable-layout-v5.py --output NEW-ARTIFACT-DIR/layout-manifest.json
python3 docs/slides/src/build-editable-powerpoint-v5.py docs/slides/versions/v5-before-editable/05-disaggregated-intelligence.pptx NEW-ARTIFACT-DIR/layout-manifest.json NEW-OUTPUT.pptx
python3 docs/slides/src/validate-editable-powerpoint.py NEW-OUTPUT.pptx NEW-ARTIFACT-DIR/layout-manifest.json --archived-pptx docs/slides/versions/v5-before-editable/05-disaggregated-intelligence.pptx --output NEW-ARTIFACT-DIR/independent-validation.json
python3 docs/slides/src/render-editable-powerpoint-proof.py NEW-OUTPUT.pptx NEW-ARTIFACT-DIR/proof --reference docs/slides/exports/05-disaggregated-intelligence
```

The uppercase paths represent new destinations. The extractor defaults to the current unchanged version 05 HTML, source JSON, frozen HTML and passing teaching-state report. If those inputs change, regenerate a matching frozen state and supply the extractor's `--input`, `--frozen`, `--source` and `--freeze-report` arguments. The native builder verifies their hashes before conversion. A changed curriculum requires a deliberately updated validation baseline; the current baseline intentionally rejects content changes.

The SVG converter explicitly selects the Fontconfig/FreeType backend with unhinted metrics. This avoids macOS CoreText silently measuring a fallback font. Native source files and current reports are under [the editable export directory](exports/05-disaggregated-intelligence-editable/).

## Verification

[Independent package/content validation](exports/05-disaggregated-intelligence-editable/independent-editability-validation.json) passed on all 36 slides. It verifies visible native text against the source, named groups, geometry, references, notes, absence of pictures, and archive identity. A separate [editing round trip](exports/05-disaggregated-intelligence-editable/native-editing-roundtrip.json) changed a title, recolored and resized a bar, moved an illustration group, then saved and reopened an isolated copy with python-pptx. Nine deliberate corruptions were rejected by the inspector.

[All-page reconstructions](exports/05-disaggregated-intelligence-editable/proof-candidate-04/native-xml-render-report.json) read the actual PowerPoint XML and render its shapes, text, gradients and groups. The average mean channel difference from the prior artwork is **0.969/255**, with a maximum of **2.636/255**. [Glyph-ink checks](exports/05-disaggregated-intelligence-editable/proof-candidate-04/text-geometry-review.json) found no text outside slides and no intersections between distinct text objects. The [contact sheet](exports/05-disaggregated-intelligence-editable/proof-candidate-04/contact-sheet.jpg) shows the resulting native-object layout.

These are local XML/Pango proofs. Microsoft PowerPoint and LibreOffice are unavailable; a Keynote automation probe also failed before opening a presentation. [Verification](verification.md) and the [independent adversarial review](reviews/05-editability-adversarial-review.md) record those limits. The preceding Codex-plugin attempt remains unsuccessful, and no plugin approval is claimed.
