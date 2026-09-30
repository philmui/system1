# Delivery verification

Verified September 28, 2026. The recommended edition is [version 3, PowerPoint](03-disaggregated-intelligence.pptx) or [version 3, interactive HTML](03-disaggregated-intelligence.html).

## Preserved artifacts

| Edition | HTML slides | PPTX slides | Editable note parts | Vector artwork / PNG fallbacks |
| --- | ---: | ---: | ---: | ---: |
| 1 | 30 | 30 | 30 | 30 / 30 |
| 2 | 31 | 31 | 31 | 31 / 31 |
| 3 | 31 | 31 | 31 | 31 / 31 |

All three HTML editions retain their recorded hashes. PowerPoint export compares each input HTML hash before and after conversion. [Artifact integrity](artifact-integrity.json) records both formats, sizes, slide counts, and SHA-256 values. Earlier editions preserve review history; they do not inherit the later runtime repairs.

## Final HTML

The [content verification report](previews/v3/verification.json) covers every slide at 1280×720, plus 1920×1080 and 390×844 stage checks. It found one active slide at a time, exact 16:9 proportions, no detected content overflow, no JavaScript errors, and no external network requests. The final [contact sheet](previews/v3/contact-sheet.jpg) and selected full-size frames were visually inspected. All 31 slides remain visible at the correct dimensions under print styles.

The arithmetic tests cover the default gate, full routing coverage, a retained high-scoring error, and zero accepted cases with undefined automatic error. Cost presets produce 0.27, 1.00, and 1.07 normalized units. The eight-event trace separates explanation from confirmation and ends with an unresolved outage handoff. Native Space activates the exercise without navigating away.

The runtime suite covers presenter/audience synchronization, preview interaction, freeze/resume, audience closure/reopening, timers, annotations, local notes, editing/export, desktop/mobile controls, and fixed-stage previews. See [runtime review](reviews/runtime-review.md), [v3 interactions](reviews/v3-runtime-interactions.json), [controls](reviews/v3-runtime-controls.json), and [regressions](reviews/v3-runtime-regressions.json).

The targeted second-review regressions were rerun against the sealed final HTML over **file and local HTTP**. Deliberately stale and unacknowledged preview messages were rejected; current interaction worked after acknowledgment; unrelated reveal state survived re-entry; multiline edits survived reload/download; and keyboard traversal left the current preview without entering the inert next preview. Both protocols passed with zero page errors. [Final results](reviews/final-runtime-review2.json).

Swiss static validation passed. The skill's own rendered measurement was skipped because it could not resolve Playwright from its location; independent Playwright checks above supplied the rendered evidence. Presenter validation passed with 31 matching notes, 33.8 planned minutes, and no errors or warnings. Its local validator differs from the supplied skill validator only in three literal English timer labels. The original language-specific failures remain in the first-edition review record. [Swiss result](reviews/v3-swiss-validator.txt), [presenter result](reviews/v3-presenter-validator.txt).

## Review closure

Independent source and teaching critiques informed both revisions, with dispositions in the [revision log](revision-log.md). All sixteen requested resources are accounted for in the [source ledger](research/source-ledger.md). No `koa-action` API, training interface, measured benchmark, or deployed integration is invented.

The actual Codex adversarial-review plugin identified runtime defects in editions 1 and 2. Those were repaired before edition 3 was frozen. The [focused final Codex review](reviews/03-codex-final-verification.txt) returned **approve, no material findings** for the three final fixes. That reviewer inspected the browser evidence and performed syntax/source checks; the browser runs themselves are recorded separately above. An oversized second-review attempt was retained for transparency, then successfully rerun with a narrowed source snapshot.

## PowerPoint

Every package passed ZIP/XML consistency, relationship resolution, canvas bounds, slide order/count, exact original note-content preservation, and exact source-hyperlink checks. Each slide includes outlined SVG artwork and the verified PDF-derived PNG fallback. All source PDFs embed their font subsets; SVG glyphs are paths and need no installed slide fonts.

Independent SVG and PDF rasterizations were compared for every page. The maximum mean channel difference across all editions was 0.284 out of 255. The final edition contains 31 slides, 31 native note parts, 65 clickable web-source regions, and 5,314 vector paths. [Export review](reviews/powerpoint-review.md) and [per-edition reports](exports/03-disaggregated-intelligence/package-validation.json) document the checks and static teaching states.

PowerPoint slide artwork is a vector graphic rather than native editable paragraphs; speaker notes and source-link shapes remain editable. No Microsoft PowerPoint or LibreOffice renderer was available. Verification establishes package consistency and artwork fidelity without claiming an Office-application render. Rebuild instructions are in [POWERPOINT-EXPORT.md](POWERPOINT-EXPORT.md).
