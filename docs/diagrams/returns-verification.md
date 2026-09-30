# Return illustration verification

The current figures use people and physical objects to explain the workflows, with detailed rules in [blog 08](../blog/08-building-prod.md) and the speaker notes of [slides 04](../slides/04-disaggregated-intelligence.html). The three posters and three presentation views are native SVG drawings with embedded fonts, accessible titles and full descriptions. Portable SVG copies outline the glyphs; PNG and PDF counterparts are supplied.

## Meaning and design

The [independent semantic review](returns-pictorial-logic-review.md) checked the policy against the pictures and article. The architecture comparison keeps four numbered service checkpoints on both sides, with an unnumbered System One interpretation switch in the graph path. The fallback goes through clarification and the same mandatory precheck, distinguishes decline from hold, and returns validated information to the same policy. The policy calendars use the invented Standard/Plus deadlines and fees; customer confirmation precedes a separate service-approval shield and the authorized parcel.

The initially complex route was added to the short fallback label. Human review also received an explicit hold exit. Canonical blog links now refer to the current pictorial designs. The actual [Codex adversarial review](returns-pictorial-codex-review.txt) inspected the full rendered artwork, article and four relevant slides and returned **approve, no material findings**.

## Rendering and reusable vectors

All six final SVGs pass the [poster](returns-geometry-report.json) and [slide](returns-slide-geometry-report.json) geometry checks: loaded required fonts, no canvas overflow and no visible text-ink overlap. Large figures were inspected both at native size and within the presentation. Bounds use SVG font metrics; overlap uses actual glyph ink to avoid false positives from unused ascent/descent around large numbers.

PowerPoint 04 decomposes the workflows and component library into 152 independently movable SVG objects. Their SVG and transparent PNG pairs, names, transforms, notes and source relationships are checked in the [package report](../slides/exports/04-disaggregated-intelligence/components/component-package-validation.json). An independent [rendered reconstruction](../slides/exports/04-disaggregated-intelligence/components/component-visual-verification.json) matches the original layout within a maximum mean channel difference of 0.579/255. Office rendering was not available; the evidence concerns package structure and actual SVG reconstruction.

The [asset library](../slides/assets/components/README.md) contains 22 reusable source SVGs, outlined SVGs and previews. The final deck has a clean component library on slide 35. Arrows and outlined labels are separately movable; arrows do not reconnect automatically. The actual [Codex component review](../slides/reviews/04-component-codex-review.txt) inspected the final package and returned **approve, no material findings**.

## Preservation

The original five application SVGs, their five JSON files and their renderer match their pre-task hashes in [the preservation check](returns-preservation-check.json). Earlier text-first return artwork remains in `archive/returns-text-first`. The current build entry point is `build_returns_illustrated.py`; its three composition modules share `returns_illustration_primitives.py`.
