# Branching illustration verification

This record covers the new illustrations used by [blog 09](../blog/09-building-prod.md) and [slides 05](../slides/05-disaggregated-intelligence.html). Earlier illustration and PowerPoint review records remain historical evidence for their original files. This record distinguishes source semantics, executed static checks and rendered-export validation.

## Semantic review

The [independent adversarial review](../slides/reviews/05-semantic-adversarial-review.md) checked the new branching contract, source distinctions, manuscript and teaching-state implementation. The shared service boundary, remedy/scope mapping, branch-specific policy and preservation of task relationships are consistent with the [specification](returns-branching-spec.md).

The principal review corrections are explicit in the current sources:

- Identity-service verification gates protected work; missing sessions lead to secure sign-in and the same recheck. Rejection and unavailable evidence never become a frontier-model appeal.
- Page B separates familiar whole-item, exchange and kit-component requests from interpretation difficulty. Its clarification branch now has a visible green reassessment route back to System One.
- Exchange and component handlers obtain their own policy and terms. The numeric Standard/Plus example is visibly scoped to whole-item returns.
- AND tasks remain separate obligations. OR/IF alternatives execute only when selected or triggered, with unknown conditions preserved as pending.
- The frontier path is bounded interpretation followed by human validation and the same supported-combination mapping. It supplies neither missing evidence nor authority.
- The slide authoring sketch explicitly exits after failed identity verification and requires an owned purchase before interpretation. The worked trace distinguishes customer confirmation from a service-issued exchange ID, then resumes the unfinished cable return.

The actual installed `codex:adversarial-review` command was attempted. Its app server exited before review because SQLite state could not be initialized under the restricted `/Users/pmui/.codex` directory. The [raw attempt log](../slides/reviews/05-throughline-codex-review.txt) records the failure. There is no completed Codex-plugin review or approval for this revision; the independent review is a separate check.

## Executed source and content checks

[The source check](returns-branching-source-check.json) records nine well-formed SVGs: four full illustrations, their four slide insets and the component library. All have accessible titles and descriptions, named reusable component groups and no raster-image or foreign-object nodes. XML validity and the absence of raster nodes do not establish legibility or export fidelity.

The same check compared all **110 preserved inputs** against the version 05 preservation baseline. No file changed. This includes earlier numbered blog drafts, slide deliverables, canonical return illustrations and reusable component files. The [previous guide](returns-illustrations-04.md) retains the earlier visual explanation and its original links.

The [blog static check](../blog/reviews/09-static-verification.json) found five figures with nonempty alternative text, all 13 article source links, no missing local targets and no scripts. It identifies the article and reading-copy hashes. Captions were checked against the current SVG labels and accessible descriptions. No browser rendering is implied by those checks.

The [teaching-state report](../slides/reviews/05-teaching-state-static.json) exercises the actual version 05 interaction script in a small DOM harness: eight trace events, four gate cases, three cost cases, state serialization, reset and answer reveal. Its scope is JavaScript state logic; it does not establish layout, browser navigation or presenter synchronization.

## Rendered exports and presentation packaging

Source files use a 1900 × 900 full-illustration canvas or a 1744 × 620 slide inset. The deck’s presentation frame follows the supplied Salesforce reference while the inset drawings retain their pastel vector vocabulary.

[The final local geometry report](returns-branching-geometry-report.json) passed for all nine illustrations and slide insets. Registered bundled fonts were used with librsvg/Pango; isolated actual glyph-ink boxes found no text overlap or out-of-canvas text. PNG previews, vector PDFs and outlined SVGs accompany the source files. This records a local vector-render check, not a browser or Office rendering test.

[The slide layout audit](../slides/exports/05-disaggregated-intelligence/layout-validation.json) passed on all 36 WeasyPrint pages. The [base PowerPoint validation](../slides/exports/05-disaggregated-intelligence/package-validation.json) confirmed 36 note pages, 77 web-source regions and seven embedded PDF fonts, with a maximum PDF/SVG mean channel difference of 0.588/255. That comparison first exposed a gradient clipping defect in PDF-to-SVG conversion. A conservative [normalization](../slides/src/normalize_pdf_svg.py) now handles only the recognized simple full-page pattern; the independent comparison passed afterward.

The five selected compositions contain **208 separately movable objects**, with **34 reusable source assets**. [Complete-page reconstruction](../slides/exports/05-disaggregated-intelligence/components/component-visual-verification.json) passed at a maximum mean channel difference of 0.226/255; [inset reconstruction](../slides/exports/05-disaggregated-intelligence/components/component-body-verification.json) passed at 0.157/255. [The final package validator](../slides/exports/05-disaggregated-intelligence/components/component-package-validation.json) passed for 36 slides, 213 SVG/PNG pairs including the five frames, 758 relationships and 217 preserved base-package members. Notes and source links match the authored input.

The [independent export implementation review](../slides/reviews/05-export-adversarial-review.md) records the provenance and failure-gate corrections. Seventeen negative preflight cases and the read-only version 04 compatibility check passed. These results supplement the semantic review; the Codex-plugin attempt remained blocked before review. Native Office rendering and current Chromium behavior remain unverified.

## Evidence limits

The diagrams are a proposed teaching architecture. Their smaller System One chip and fewer frontier calls communicate allocation, not a measured cost, latency or accuracy result. `koa-action` follows the user-supplied capability framing; Jev has its own interface. No native adapter, compatible schema, training API or calibrated numerical confidence field is established. The merchant policy and worked examples are invented, and no live pilot or deployment was performed.
