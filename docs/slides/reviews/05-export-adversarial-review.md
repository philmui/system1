# Version 05: independent export implementation review

Reviewed September 29, 2026. No unresolved material implementation defect was identified after the corrections below. This review covers the export mechanism; delivery still requires a successful final v5 render, reconstruction check and package validation. It does not claim a Chromium or Microsoft PowerPoint rendering pass, or a successful Codex plugin review.

The review read the actual local renderer, diagram exporter, static teaching-state adapter, full-slide PowerPoint exporter, component exporter, reconstruction checker and OOXML packager. It also checked the installed WeasyPrint 69 link-geometry implementation and the existing independent PowerPoint validators. Earlier editions were used only as read-only inputs to an isolated compatibility test.

## Findings and corrections

| Material finding | Resolution verified in the implementation |
| --- | --- |
| A previously rendered PDF could be paired with newer HTML and notes while the export report recorded only the newer source hash. | The builder now fingerprints the source JSON in the HTML. Local rendering requires a passing freeze report bound to the current HTML and frozen markup, verifies slide order, and reads the actual notes embedded in the HTML. Its manifest records the complete input/output hash chain. Packaging verifies the required provenance roles and file hashes, source identity, and the specific PDF before creating a deck. |
| Newly edited diagram sources could diverge from older SVGs embedded in the deck or their outlined print copies. | Rendering checks the embedded raw SVG, current on-disk raw SVG, and outlined SVG against the passed diagram geometry audit. Component packaging binds its source SVG hashes to the compositions used in the verified print. |
| A failed text-layout audit produced a `passed: false` report but did not prevent packaging. | The renderer now fails when geometry fails. The PowerPoint exporter independently requires a passing, hash-bound layout report. |
| The local renderer claimed browser font readiness and repeated trace values as constants. | It now audits actual PDF font embedding with `pdffonts` and extracts the displayed trace fields from the frozen markup. It explicitly records that browser verification did not occur. The static trace footer identifies the final static state. |
| Individually valid components could be combined with a stale frame or a different base deck. | New component manifests carry the HTML source hash. Packaging binds the base PPTX, print report, frame paths and hashes, diagram sources, and passing complete-page reconstruction to that same source. It rejects changed reconstruction inputs. |
| Adding v5 requirements could break the preserved v4 component workflow. | New provenance requirements are conditional on the new manifest's `inputHTMLSha256` field. The actual v4 manifest lacks that field. A read-only v4 repackage into `/tmp` passed the existing structural validator. |

## Verification performed

[Nine full-slide preflight cases](05-export-negative-checks.json) invoked the actual exporter against isolated copies of the completed print provenance. Each rejected before a PPTX was created: missing provenance, stale frozen HTML, changed current HTML, mismatched PDF, a different source path, failed layout, failed font audit, a missing freeze record, and a missing font record.

[Eight component preflight cases](05-component-preflight-negative-checks.json) invoked the actual new component guard with isolated synthetic inputs. Mismatched source/base/frame/diagram identities, failed or stale reconstruction, and a changed verified object were rejected before archive parsing. These cases test rejection behavior; they do not certify a real v5 package.

[The v4 compatibility check](05-legacy-component-regression.json) used a copied manifest with rebased paths in `/tmp`. It read the original base and component assets without changing them. The current packager and existing package validator confirmed 35 slides, four component slides and 152 movable SVG objects, with preserved notes and hyperlinks. Reports and the temporary PPTX were written only under `/tmp`; the historical package report was not overwritten.

The preservation baseline contained 110 prior files. Every recorded byte count and SHA-256 still matched when checked during this review. This includes earlier blog and slide editions and the prior graphical component library. The exporter also refuses to replace an existing published PowerPoint file.

The current PDF font audit listed embedded Salesforce Sans, Manrope, IBM Plex Mono, and fallback glyph fonts. Link rectangles were checked against WeasyPrint's installed `gather_anchors` implementation: its returned coordinates are opposite corners, so conversion to width and height in the renderer is correct. Speaker notes come from the built HTML, source hyperlinks retain their web targets, and repository references remain descriptive local identifiers.

## Required final artifact checks

The actual v5 complete-page reconstruction must pass for all five component slides before component packaging. The base PowerPoint must pass `validate-powerpoint.py`, and the final component edition must pass `validate-component-powerpoint.py`. The latter verifies separate SVG/PNG relationships, object names and placements, outlined vector contents, unchanged unselected slides, notes changed only by the editability disclosure, and preserved hyperlinks. These are structural and independently rendered vector checks, not an Office application rendering test.

The actual Codex plugin attempt remains [documented separately](05-throughline-codex-review.txt): its state database could not initialize under the filesystem sandbox. That failure is not an approval and does not replace the independent review recorded here.
