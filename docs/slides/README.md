# Disaggregated intelligence

A 36-slide tutorial on building reliable Agentforce workflows with focused System One judgment, authored runtime control and selective frontier reasoning. Version 05 has **39.6 minutes of planned narration**, leaving **5.4 minutes** for demonstrations and discussion in a 45-minute session.

[Open version 05 PowerPoint](05-disaggregated-intelligence.pptx) · [Open the interactive HTML](05-disaggregated-intelligence.html).

| Edition | PowerPoint | Interactive HTML | Purpose |
| --- | --- | --- | --- |
| Version 1 | [PPTX](01-disaggregated-intelligence.pptx) | [HTML](01-disaggregated-intelligence.html) | Initial narrative and visual system. |
| Version 2 | [PPTX](02-disaggregated-intelligence.pptx) | [HTML](02-disaggregated-intelligence.html) | Worked contracts, guarded graphs, economics and enlarged training views. |
| Version 3 | [PPTX](03-disaggregated-intelligence.pptx) | [HTML](03-disaggregated-intelligence.html) | Preserved text-first product-return walkthrough. |
| Version 4 | [PPTX](04-disaggregated-intelligence.pptx) | [HTML](04-disaggregated-intelligence.html) | Pictorial workflows and separately movable vector components. |
| Version 5 · current | [PPTX](05-disaggregated-intelligence.pptx) | [HTML](05-disaggregated-intelligence.html) | Explicit access/request branches, one aftercare throughline and styling based on the supplied Salesforce reference. |

The customer asks to exchange headphones and return a separately purchased cable. `koa-action` supplies bounded interpretation; Agent Graph preserves the work and follows configured routes; AgentScript authors the controls. Authoritative services establish facts and transaction outcomes. Frontier reasoning remains available for difficult interpretation that survives the defined gate.

Slides **06–09** make the workflow visible:

- **06 — Access:** identity-service verification, secure sign-in and recheck, denied access, and owned-purchase matching.
- **07 — Request routes:** familiar whole-item returns, exchanges and kit-component returns reach their own handlers; unclear meaning receives clarification.
- **08 — Reasoning gate:** residual interpretation receives a bounded frontier proposal and human validation before returning to the applicable rules.
- **09 — Whole-item policy:** the invented loyalty windows and shipping fees apply only to whole-item returns.

**Slide 36** supplies a reusable vector vocabulary. The [article, blog 09](../blog/09-building-prod.md), [branching specification](../diagrams/returns-branching-spec.md) and speaker notes explain the details without crowding the drawings. The earlier [31-slide version 03](versions/v3-before-returns/README.md) remains archived before its first return insertion.

## Present and explore

The HTML embeds its fonts, art, scripts and notes. Keep the `docs` folder together for neighboring companion links; external references open only when selected.

- Use **← / →**, on-screen controls, wheel or swipe to navigate. **Esc** opens the overview.
- Press **P** for presenter mode and move the audience window to the presentation display. The current preview exposes the example controls; the next preview is for viewing.
- Explore the eight-event aftercare trace, confidence threshold, cost slider/presets and repair exercise. These are constructed examples and call no model or service.
- Use **B** for static mode. Reduced-motion preferences are supported.
- Press **E** for local text editing and use the toolbar or **Cmd/Ctrl+S** to download a revised copy. Presenter notes have separate local edit/reset controls.

The PowerPoint uses purposeful static states and native editable components on **all 36 slides**: **722 text boxes**, **980 drawing shapes** and **623 named groups**. Titles, body copy, code, labels, cards, chart parts, illustrations and backgrounds can be customized directly in PowerPoint. Source links move with their text; all 36 speaker-note sets remain editable. There are no picture objects in the slide content. Arrows remain independently editable geometry and do not automatically reconnect. See the [editing guide](EDITING-V5.md) and [export details](POWERPOINT-EXPORT.md). The [previous version 05 PowerPoint](versions/v5-before-editable/05-disaggregated-intelligence.pptx) is preserved.

The current environment prevents Chromium startup, so current interaction-state checks and local rendering are reported separately from earlier browser-runtime tests. See [verification](verification.md) for the actual scope of completed checks.

## Companion material

- [Tutorial handout and all speaker notes](tutorial-handout.md)
- [PowerPoint editing guide](EDITING-V5.md) · [Open-font pack](assets/editable-v5-fonts.zip) · [Native-component previews](exports/05-disaggregated-intelligence-editable/proof-candidate-04/contact-sheet.jpg)
- [Blog 09](../blog/09-building-prod.md) · [Full-size illustrations and design guide](../diagrams/returns-illustrations.md)
- [Current reusable components](assets/components-v5/README.md) · [Component ZIP](assets/returns-vector-components-v5.zip)
- [Full training pipeline](assets/training-pipeline.svg) · [Figure notes](assets/training-pipeline-notes.md)
- [Source ledger](research/source-ledger.md) · [Current attribution and product-role check](research/v5-throughline-source-check.md)
- [Salesforce style provenance](research/v5-salesforce-style.md)
- [Revision decisions](revision-log.md) · [Verification](verification.md) · [Editable export artifacts](exports/05-disaggregated-intelligence-editable/)

The Salesforce composition is proposed. `koa-action` follows the capability framing in the brief; Jev-specific interfaces remain attributed to TypeSafe. No native adapter, training interface, calibrated confidence output, measured saving or deployed system is invented. Task development and the controlled service pilot are explained as a methodology to perform.

## Build and provenance

The deck retains the guizang layout/presenter runtime and frontend-slides’ fixed 1920 × 1080 stage and offline packaging. Version 05 follows the supplied Salesforce style reference with a blue, sky and mint palette and white cards. Salesforce Sans supplies body typography; Manrope is the documented heading fallback. The workflow insets retain their pastel illustration vocabulary.

Current authoring files are `src/deck-v5.json`, `src/theme-v5.css` and `src/interactions-v5.js`. `src/integrate_returns_v5.py` combines the revised core curriculum with the new illustrations. Build to a new filename:

```sh
python3 docs/slides/src/build_deck.py src/deck-v5.json rebuilt-v5.html
```

The builder refuses to overwrite preserved numbered HTML outputs. The [PowerPoint guide](POWERPOINT-EXPORT.md) documents the native-component conversion and its source-layout, content and rendering checks. Earlier source snapshots and review records remain available; [the version 04 README](README-04.md) describes that preserved edition.
