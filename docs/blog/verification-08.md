# Verification record

The current deliverable contains eight numbered Markdown drafts, the rendered [version 08 reading copy](index.html), three pictorial return illustrations, the retained training pipeline, and source/review records. Versions 01–07, the [version 07 reading copy](07-reading-copy.html), and [the first version 08 before redesign](reviews/08-before-illustrated-redesign.md) remain available. These checks verify the writing and illustration artifacts; they do not establish a working Salesforce integration or an evaluated production system.

## Review results

For the original seven-draft sequence, the installed `codex:adversarial-review` plugin reviewed isolated copies of the article, source notes, and relevant vectors. Its raw reports for [01](reviews/01-codex-adversarial.txt) and [06](reviews/06-codex-adversarial.txt) each identified one material issue: future information leaking into decision inputs, and a diagram bypassing the controlled service pilot. Both were addressed in version 07 and remain corrected in 08. Those reports retain their original `needs-attention` verdicts.

Version 08's [independent content review](reviews/08-adversarial-content-review.md) verified the repairs to missing-status handling, the incoming-case cost denominator, and confidence-source attribution. Its recorded hash identifies the pre-redesign article it reviewed. The [editorial notes](reviews/08-editorial-notes.md) describe the subsequent plain-language and figure changes. The methods, evaluation, and failure-diagnosis sections are unchanged from the first 08 apart from the training figure number.

The [pictorial logic review](../diagrams/returns-pictorial-logic-review.md) checked the new artwork and current article together. Its findings are resolved: the detour labels both unclear and complex requests, human review has an unresolved hold exit, and the canonical image paths display the revised artwork. Both architectures retain service authority; the policy figures show confirmation before authorization. The separate [Codex pictorial review](../diagrams/returns-pictorial-codex-review.txt) completed with an **approve** verdict and no material findings. Its scope covered the three rendered illustrations, blog 08, and four included teaching slides; the report found their authority, branching, policy, and confirmation explanations consistent.

## Executed artifact checks

- Compared drafts 01–07 with every existing SHA-256, byte count, and word count in [draft-integrity.json](draft-integrity.json). All seven matched. Added version 08: 3,465 words and 25,063 bytes, SHA-256 `042deb51b870350e530de2812db4f388453f070ebce17cb7e137af3b424086b5`.
- Confirmed the requested title, four numbered figures, and the absence of stale invoice/outage or unrelated gait/JEPA narrative. The final article embeds architecture comparison, loyalty policy, reasoning fallback, and training pipeline in that order.
- Inspected the three pictorial SVGs and rendered previews. Their identity card, receipt, calendar, shipping-ticket, model-chip, and review scenes agree with the article's reading cues and captions. The final fallback also shows unresolved review returning to hold.
- Opened the regenerated `index.html` in Chromium at **1440 × 1000** and **390 × 844**. All four figure images loaded with nonempty alternative text. Document width matched the viewport in both cases, with no horizontal page overflow. Wide figures and tables remain inside scrollable containers on mobile.
- Confirmed all **11 external source links** from the Markdown are present in the rendered page and all rendered local links resolve. All four images use local SVG files. No remote scripts or fonts are required, and the browser reported no page errors, console errors, or failed requests.
- Saved the article, reading-copy, and four-figure hashes with the browser results in [the render verification report](reviews/08-render-verification.json). Retained [desktop](previews/08-desktop.png) and [mobile](previews/08-mobile.png) page captures, [desktop opening](previews/08-desktop-opening.png), [mobile opening](previews/08-mobile-opening.png), and individual figure captures under `previews/`. The openings and rendered fallback figure were visually inspected.

The diagrams also appear on slides 06–08 of [slide version 04](../slides/04-disaggregated-intelligence.html), with a reusable vector component library on slide 35. Slide export and presentation checks are recorded in the slide deliverable's own verification files.

The retained pipeline requires offline qualification followed by a controlled service pilot; rollout requires pilot acceptance. Test examples have no path back to fitting, and reviewed production feedback enters a future dataset. Earlier drafts retain their earlier pipeline asset.

## Evidence limits

The supplied resources and access details are documented in the [research notes](research/editorial-scope.md). The article uses the user's description of `koa-action` and labels the proposed integration and task-development process. It does not invent an SDK, native adapter, training access, calibrated confidence field, deployment result, cost saving, or production guarantee. The merchant tiers, deadlines, shipping charges, and worked cases are hypothetical. No model was trained, no service pilot was run, and no site was published during this writing task.
