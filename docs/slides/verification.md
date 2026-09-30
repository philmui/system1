# Delivery verification

The current [version 05 PowerPoint](05-disaggregated-intelligence.pptx) uses native editable components on all **36 slides**. It preserves the 39.6-minute tutorial, static teaching states and speaker notes. The exact [preceding version 05 PowerPoint](versions/v5-before-editable/05-disaggregated-intelligence.pptx) is archived; its earlier SVG-picture checks apply to that file.

## Native editability and content

[Independent OOXML validation](exports/05-disaggregated-intelligence-editable/independent-editability-validation.json) passed with:

| Check | Result |
| --- | ---: |
| Slides | 36 |
| Native text boxes | 722 |
| Native drawing shapes, excluding text boxes | 980 |
| Named groups, including nested groups | 623 |
| Picture objects or image fills in slide content | 0 |
| Preserved clickable web-source links | 77 |
| Package relationships checked | 270 |

The inspector reads the delivered package independently of the builder. It compares the actual visible native text and coherent phrases with **617 HTML text blocks and 105 SVG labels**, checks unique IDs, native geometry, group transforms and bounds, rejects editing locks, verifies every original web target is clickable, and verifies the pre-conversion archive. Hyperlinks belong to editable text runs instead of fixed transparent hit areas.

All teaching content, slide order, static example values and narration are preserved. Only the obsolete export-format disclosures and one appendix instruction about outlined labels are updated in the PowerPoint notes. The final trace still has an Authorized exchange and an Active cable return; the whole case remains unfinished.

A [native editing round trip](exports/05-disaggregated-intelligence-editable/native-editing-roundtrip.json) used python-pptx 1.0.2 to edit a title, recolor and resize a chart bar, move a whole-kit group, save the copy and reopen it. The delivered candidate was unchanged. This verifies practical package-level editing through another library, not desktop PowerPoint interaction. [Nine isolated corruption probes](reviews/05-editability-negative-probes.json) were all rejected.

## Layout and visual reconstruction

[Source-layout extraction](exports/05-disaggregated-intelligence-editable/layout-extraction-validation.json) passed on all 36 pages. Every visible HTML text leaf was captured once, including absolutely positioned diagram nodes. The manifest retains actual paint order, semantic ancestry, inline styles, source hashes, original SVG assets, measured baselines and glyph ink bounds.

The independent [native-XML renderer](src/render-editable-powerpoint-proof.py) reads the actual PPTX's geometry, text, gradients and group transforms. It does not obtain positions from the HTML layout manifest. Its [36-page report](exports/05-disaggregated-intelligence-editable/proof-candidate-04/native-xml-render-report.json) binds the render to the final candidate's exact hash. The average mean channel difference from the preceding artwork is **0.969/255**; the largest is **2.636/255**, on slide 07. The five workflow/library views show modest typography differences because editable regular/bold styles replace intermediate SVG font weights and the earlier outlined font rendering.

[The text-geometry check](exports/05-disaggregated-intelligence-editable/proof-candidate-04/text-geometry-review.json) found **zero text outside slides** and **zero glyph-ink intersections between distinct native text objects**. All 36 pages were visually reviewed, including the full-size workflow and source slides. [The contact sheet](exports/05-disaggregated-intelligence-editable/proof-candidate-04/contact-sheet.jpg) and individual PNG/SVG proofs are retained.

The local proofs use Pango and librsvg. They are not a native Microsoft Office render. PowerPoint and LibreOffice are not installed, and [the Keynote automation probe](exports/05-disaggregated-intelligence-editable/native-render-attempt.json) failed at application access without opening or exporting a presentation. Chromium also remains unavailable; no new browser-runtime result is claimed.

## Independent adversarial review

The [native-editability review](reviews/05-editability-adversarial-review.md) is complete with no unresolved material issue in its inspected scope. It corrected a native font-family alias, preserved measured inline spacing using native tabs, and verified coherent editable text rather than hidden overlays or glyph fragments. A font-metric mismatch was also caught: macOS's default CoreText backend ignored the local Fontconfig selection. The SVG converter now explicitly uses Fontconfig/FreeType with unhinted metrics, and all native-label boxes were rebuilt before the final checks.

The review is separate from the requested Codex plugin. [The previous actual plugin attempt](reviews/05-throughline-codex-review.txt) failed before reviewing because its state database could not be initialized in the restricted Codex directory. There is no completed plugin approval. The independent semantic review from the preceding edition remains [available](reviews/05-semantic-adversarial-review.md); the new source-text and notes comparisons establish that its reviewed reasoning is retained.

## Typography and editing limits

All titles, paragraphs, labels, code, chart parts, illustration geometry and background fills are editable native objects. Use the Selection Pane to navigate the named nested groups. Authored line breaks remain in the text boxes; longer edits may need resizing or new breaks. Paths are editable but do not automatically reconnect when their nodes move.

The [editing guide](EDITING-V5.md) and [open-font pack](assets/editable-v5-fonts.zip) explain font setup. Manrope and IBM Plex Mono are supplied under their original OFL licenses. Salesforce Sans remains a separately licensed installation; its embedding permissions were not changed, and it is not bundled as an editable embedded font. Nothing was installed globally. Missing or substituted fonts can change spacing in desktop PowerPoint.

## Preservation and provenance

The input PowerPoint's SHA-256 is `ebedf78a586cc1379a46eaee93f82739c270116056091ebf09334bde3aab9b3b`; the byte-for-byte archive is linked above. The unchanged HTML, blog and source illustrations remain available. Editions 01–04 are preserved. [Artifact integrity](artifact-integrity.json) identifies the current editable PPTX and the preceding export separately.

Current implementation files are [the layout extractor](src/extract-editable-layout-v5.py), [the native SVG converter](src/svg_to_editable.py), [the PowerPoint builder](src/build-editable-powerpoint-v5.py) and [the independent validator](src/validate-editable-powerpoint.py). [Build instructions](POWERPOINT-EXPORT.md) describe the required inputs and new-output policy. Historical artwork proofs remain under `exports/05-disaggregated-intelligence/`; native proofs and current reports are under `exports/05-disaggregated-intelligence-editable/`.
