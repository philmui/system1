# Disaggregated intelligence

A speaker-led technical tutorial on allocating enterprise reasoning across `koa-action`, Agent Graph, AgentScript, generative models, and authoritative services. Version 04 has 35 illustrated slides, including an optional component library, for approximately 45 minutes with demonstrations and discussion.

[Open version 04 PowerPoint](04-disaggregated-intelligence.pptx) · [Open the interactive HTML](04-disaggregated-intelligence.html).

| Edition | PowerPoint | Interactive HTML | Purpose |
| --- | --- | --- | --- |
| Version 1 | [PPTX](01-disaggregated-intelligence.pptx) | [HTML](01-disaggregated-intelligence.html) | Initial narrative and visual system; preserved for review history. |
| Version 2 | [PPTX](02-disaggregated-intelligence.pptx) | [HTML](02-disaggregated-intelligence.html) | Worked contracts, guarded graphs, clearer economics, enlarged training views, and presenter fixes. |
| Version 3 | [PPTX](03-disaggregated-intelligence.pptx) | [HTML](03-disaggregated-intelligence.html) | Preserved text-first product-return walkthrough. |
| Version 4 · current | [PPTX](04-disaggregated-intelligence.pptx) | [HTML](04-disaggregated-intelligence.html) | Pictorial workflows with separate movable vector objects and a reusable component library. |

Slides **06–08** explain product returns through large illustrated objects: identity cards, receipts, model chips, policy calendars, shipping tickets, people, and parcels. They cover the architectural comparison, the guarded frontier branch, and loyalty-based eligibility and shipping. **Slide 35** is a component library. Full rules remain in speaker notes and [blog 08](../blog/08-building-prod.md). The [earlier 31-slide version 03](versions/v3-before-returns/README.md) is archived before the first return insertion.

The HTML files embed their fonts, illustrations, styles, scripts, and notes. They open locally without a server or network connection. Reference links use the web or neighboring companion files only when selected. Keep the `docs` folder together to retain local companion links.

In version 04 PowerPoint, the four return/component slides contain **152 separately movable vector objects**, including illustrations, labels, badges, and arrows. Use PowerPoint's Selection Pane to copy, resize or rearrange them. Calendars and shipping tickets keep their printed values together; arrows remain separate and do not reconnect automatically. Labels are outlined vector artwork, while speaker notes are editable text. The other slides retain the earlier whole-slide artwork format. Every SVG has a PNG compatibility fallback. See [the component library](assets/components/README.md) and [PowerPoint export details](POWERPOINT-EXPORT.md).

## Present and explore

- Use **← / →**, the on-screen controls, wheel, or swipe to navigate. **Esc** opens the slide overview.
- Press **P** for presenter mode. Move the audience window to the presentation display. The current-slide preview accepts the example controls and synchronizes their state with the audience. Next-slide preview is a preview only.
- Operate the confidence threshold, cost fallback slider/presets, eight-event case trace, and repair exercise directly on their slides. These are constructed teaching examples; they make no provider calls.
- Use **B** for static mode. Reduced-motion preferences are respected.
- Press **E** for local text editing. Use the editing toolbar or **Cmd/Ctrl+S** to download a revised copy. Presenter notes have their own local edit/reset controls. The preserved editions on disk are never overwritten by browser editing.

The notes supply each slide's purpose, talk track, transition, and suggested timing. Browser storage retains local preferences and edits; the downloaded copy is the portable artifact.

## Companion material

- [Tutorial handout and speaker notes](tutorial-handout.md)
- [Full training pipeline — SVG](assets/training-pipeline.svg) · [PNG](assets/training-pipeline.png) · [Figure notes](assets/training-pipeline-notes.md)
- [Source and claim ledger](research/source-ledger.md), covering all sixteen requested references
- [Return illustrations and full-size vector files](../diagrams/returns-illustrations.md)
- [Underlying article, blog version 08](../blog/08-building-prod.md)
- [Revision decisions](revision-log.md) · [Verification](verification.md)
- [Reusable vector assets](assets/components/README.md) · [Component ZIP](assets/returns-vector-components.zip)
- [Current contact sheet](previews/v4/contact-sheet.jpg)

The Salesforce composition is a proposed architecture. The brief supplies the `koa-action` capability framing; no public adapter, training interface, performance benchmark, or production deployment is invented. Jev-specific output semantics remain attributed to TypeSafe. The data pipeline describes task development and evaluation, including optional adaptation only where supported.

## Build and provenance

The deck combines guizang's Swiss layout and presenter runtime with frontend-slides' fixed 1920×1080 stage, offline packaging, and editing. The requested pastel palette takes precedence over preset palette restrictions. See [skill integration](research/skill-integration.md).

The current source is `src/deck-v4.json`; the shell, theme, and teaching interactions are in `src`. Rebuild to a new filename:

```sh
python3 docs/slides/src/build_deck.py src/deck-v4.json rebuilt-final.html
```

The builder refuses to overwrite a preserved numbered HTML file. Build to a new filename for review; the current numbered version 03 was replaced only at the user's explicit request, after archiving the preceding files. Earlier source snapshots are in `versions`. Font licenses are in `assets/fonts`. Reviews retain raw Codex output as well as independent content critiques; browser results distinguish automated checks from visual inspection.

`src/integrate_returns_v4.py` creates version 04 from the preserved version 03 source, updates the pictorial views and notes, and appends the component library. `src/export-components.mjs` creates tight vector objects; `src/make-component-powerpoint.cjs` packages them as separately selectable PowerPoint pictures. See the export instructions for the full reproducible sequence.
