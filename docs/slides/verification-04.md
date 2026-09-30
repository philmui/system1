# Delivery verification

Verified September 29, 2026. Current deliverables are [version 04 PowerPoint](04-disaggregated-intelligence.pptx) and [interactive HTML](04-disaggregated-intelligence.html): 35 slides, including the pictorial return walkthrough on 06–08 and the reusable component library on 35.

## Pictorial design and meaning

The architecture comparison, loyalty policy and reasoning detour use original pastel objects with short captions. Full-size PNGs and presentation-scale slide views were inspected for reading order, arrow direction, visible label overlap, clipping, policy terms and service authority. The [diagram geometry reports](../diagrams/returns-geometry-report.json) and [slide-view geometry report](../diagrams/returns-slide-geometry-report.json) show loaded required fonts, no out-of-canvas text and no overlapping visible glyph-ink boxes. Font metric boxes are used for canvas bounds, while actual glyph ink is used for overlap so empty ascent/descent space around large calendar numbers does not create false positives.

The [independent logic review](../diagrams/returns-pictorial-logic-review.md) identified the missing initially-complex route label and the need to publish the canonical assets. Both were fixed. A second visual review led to the explicit human-review hold exit. The [actual Codex pictorial review](../diagrams/returns-pictorial-codex-review.txt) returned **approve, no material findings** after inspecting the original PNGs, blog 08, and the four relevant slides. No deployed adapter, benchmark, or actual merchant policy is claimed.

## HTML and speaker notes

The [35-slide content check](previews/v4/verification.json) passed at 1280×720, with fixed-stage checks at 1920×1080 and 390×844. It verified the stage ratio, absence of detected content overflow, one active slide, all 35 printed pages, no page errors and no network dependencies. The confidence examples, cost presets, eight-event trace and keyboard-operated repair exercise passed their expected outcomes. The [contact sheet](previews/v4/contact-sheet.jpg) and [return walkthrough preview](previews/v4/returns-walkthrough.jpg) provide a visual record.

The [runtime suite](reviews/v4-runtime.json) passed presenter/audience synchronization, example control synchronization, freeze/resume, closing/reopening the audience, notes, local edit/export, navigation and mobile bounds. The runtime itself was not changed for version 04. Earlier targeted runtime regression evidence remains linked in [the historical verification](versions/v3-before-returns/verification-original.md).

[Presenter validation](reviews/v4-presenter-validator.txt) passed with 35 matching notes, 38.2 planned minutes in a 45-minute session, and no errors or warnings. [Swiss static validation](reviews/v4-swiss-validator.txt) passed. It retains a warning about an inherited custom grid and could not resolve its own Playwright installation; the separate rendered checks above provide that coverage.

## PowerPoint objects and visual proof

| Slide | Composition | Separately movable vector objects |
| --- | --- | ---: |
| 06 | Architecture comparison | 53 |
| 07 | Reasoning detour | 47 |
| 08 | Loyalty policy and shipping | 27 |
| 35 | Reusable component library | 25 |
| Total | Four rebuilt slides | 152 |

Each of these slides also has a separate frame. The 156 frame/object pairs have exact SVG and transparent PNG relationships in the package. The [component validator](exports/04-disaggregated-intelligence/components/component-package-validation.json) passed 631 relationship checks, confirmed all named transforms and source-asset hashes, and checked 214 unchanged base-package members. Source links and all original speaker-note content remain, with the export-format disclosure updated on the four rebuilt slides. The 35-slide [base export validation](exports/04-disaggregated-intelligence/package-validation.json) records 35 notes and 69 clickable web-source regions.

The [independent layout reconstruction](exports/04-disaggregated-intelligence/components/component-visual-verification.json) places each separate SVG over its frame and compares the result with the original HTML print render. All four slides passed. The maximum mean channel difference is 0.579 out of 255, with at most 0.557% of pixels differing by more than 30 levels. This checks actual decomposed rendering rather than trusting object counts alone. New frames and components contain only vector geometry and outlined glyphs; the claim is scoped to those slides because inherited artwork can include small raster effects.

The actual Codex [component implementation review](reviews/04-component-codex-review.txt) returned **approve, no material findings**. It independently inspected the delivered PowerPoint and confirmed the 152 separate named vector objects, intact crops, matching transparent fallbacks, and preserved source links, original notes and unrelated slides. Its raw result is retained alongside the automated evidence.

Labels are independently movable vector artwork, not native text boxes. Arrows move independently and do not automatically follow relocated nodes. Speaker notes remain editable text; source SVGs retain editable paths and any text. No Microsoft PowerPoint or LibreOffice renderer is installed. These checks establish package structure and rendered SVG agreement without claiming an Office-application render.

## Preservation and reproducibility

The six version 01–03 HTML/PPTX files match the hashes observed before version 04 was built. The earlier authorized version 03 return insertion already changed that edition from 31 to 34 slides; its original files remain archived. The inherited integrity record contained a version 01 HTML hash that did not match the file as found before this revision. That file was preserved, and both historical and observed hashes remain in [artifact integrity](artifact-integrity.json); no unsupported claim is made that every historical hash still matches.

Blog drafts 01–07 retain their recorded hashes. The five application diagram SVGs, five JSON sources and their renderer also remain unchanged, as recorded in [the diagram preservation check](../diagrams/returns-preservation-check.json). Rebuild commands are in [PowerPoint export details](POWERPOINT-EXPORT.md), with version 04 source in `src/deck-v4.json` and its snapshot in `versions/v4`.
