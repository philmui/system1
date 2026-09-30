# PowerPoint editions

Version 05 carries the 36-slide aftercare tutorial, its speaker notes and source references into PowerPoint. The interactive HTML and static PowerPoint share the same authored story. Earlier numbered editions are preserved.

| Edition | Slides | PowerPoint |
| --- | ---: | --- |
| 1 | 30 | [01-disaggregated-intelligence.pptx](01-disaggregated-intelligence.pptx) |
| 2 | 31 | [02-disaggregated-intelligence.pptx](02-disaggregated-intelligence.pptx) |
| 3 | 34 | [03-disaggregated-intelligence.pptx](03-disaggregated-intelligence.pptx) |
| 4 | 35 | [04-disaggregated-intelligence.pptx](04-disaggregated-intelligence.pptx) |
| 5 · current | 36 | [05-disaggregated-intelligence.pptx](05-disaggregated-intelligence.pptx) |

## Current reusable compositions

| Slide | Composition | Movable objects |
| --- | --- | ---: |
| 06 | Identity and owned purchase, including sign-in/recheck and denial branches. | 51 |
| 07 | Familiar whole-item, exchange and kit-component routes. | 55 |
| 08 | Bounded clarification and frontier reasoning gate. | 47 |
| 09 | Invented whole-item return policy and shipping terms. | 30 |
| 36 | Reusable vector vocabulary. | 25 |

These views retain separate named illustration, label, badge and route objects. Use the Selection Pane to copy or rearrange them; move a node with its caption and reposition its arrows. Calendars and shipping tickets keep their printed values together. Connectors are independent vector arrows and do not automatically reconnect. Outlined labels are vector artwork rather than editable PowerPoint paragraphs; source SVGs retain the editable text. Speaker notes remain native editable text.

Current assets use [components-v5](assets/components-v5/README.md) and [the version 05 ZIP](assets/returns-vector-components-v5.zip), separate from the earlier component library. Proofs and packaging reports belong in `exports/05-disaggregated-intelligence/`. The current export has 208 movable objects and 34 reusable source assets. [Verification](verification.md) links the passed package, geometry and reconstruction reports.

The other slides use complete slide artwork. SVG pictures have PNG compatibility fallbacks. This preserves the visual design while allowing the selected workflow pages to remain rearrangeable. Native Office rendering is a separate check from SVG rendering or inspection of the package’s XML.

## Static teaching states

PowerPoint presents deliberate snapshots of the examples; the notes explain how to walk through the alternatives.

- **Aftercare trace:** the exchange is Authorized and the separately purchased cable return is Active. Service authorization follows customer confirmation and a recheck; the complete case remains unfinished.
- **Confidence gate:** the threshold is 0.75 on twelve constructed examples, with seven auto-routed and two of those wrong.
- **Routing cost:** 20% of routes still use the frontier call, producing 0.27 invented normalized units. Notes retain the 93% break-even and 100% higher-cost cases.
- **Repair exercise:** the required access, policy, confirmation and service controls are revealed.

The static export removes browser navigation and demonstration controls. The companion HTML supplies the interactions. The figures, thresholds, rates and costs are teaching constructions, not provider measurements. Earlier editions retain their original invoice/outage traces; [the version 04 export guide](POWERPOINT-EXPORT-04.md) documents those historical states.

## Current rendering and typography

The current restricted environment prevents Chromium from starting. Version 05 therefore uses a local rendering route based on **WeasyPrint 69 and Pango**, with **librsvg and Poppler** for vector and raster artifacts. Static teaching states are prepared from the authored source and actual interaction script. Rendered outputs must be inspected in their own right; earlier Chromium comparisons do not verify the current pipeline.

The presentation frame follows the supplied Salesforce reference. Salesforce Sans supplies body text, while Manrope is the documented heading fallback for the reference’s compressed AvantGarde font data. The pastel workflow illustrations remain inset artwork. [Style provenance](research/v5-salesforce-style.md) records the reference and font handling.

The rendering process carries source typography into vector artwork and outlined glyphs. The PowerPoint is not claimed to embed installable source font files. PNG fallbacks provide a compatible image representation; they do not make outlined labels editable text. Native speaker notes and source-link objects remain distinct from the slide artwork.

## Verification boundaries

The current verification separates these questions:

| Check | What it establishes |
| --- | --- |
| Source and interaction-state checks | Slide order, notes, authored references and the expected constructed example outcomes. |
| Rendered-artwork inspection | Reading order, visible clipping, overlap, contrast and route clarity in the actual exported pages. |
| Component reconstruction | Whether independently positioned components reconstruct the intended slide artwork. |
| Package validation | Named objects, transforms, SVG/PNG relationships, bounds, source links, preserved notes and package integrity. |
| Native Office render | What the delivered file displays in Microsoft PowerPoint or LibreOffice. This environment has neither renderer. |

The final package validation passed: 36 slides, 208 movable objects on five component slides, 213 SVG/PNG pairs, 758 relationships and 217 preserved base members. Notes and source links match their authored inputs. The base export has 36 note pages, 77 web-source regions and seven embedded PDF fonts.

All nine diagram geometry audits and all 36 slide layout audits passed. Maximum mean absolute channel differences were 0.588/255 for PDF versus SVG, 0.226/255 for complete-page component reconstruction and 0.157/255 for the insets. The first fidelity comparison exposed a PDF-to-SVG gradient clipping defect; the conservative `normalize_pdf_svg.py` correction recognizes only the affected simple full-page pattern. Independent comparisons passed afterward. Exact reports are linked in [verification](verification.md). A passing static DOM test does not establish presenter synchronization or browser keyboard behavior. A valid PPTX ZIP does not establish visual fidelity. No current native Office-render result is claimed.

The installed Codex adversarial command also failed before reviewing this revision because its state database could not be initialized in the restricted Codex directory. [The actual attempt](reviews/05-throughline-codex-review.txt) and [independent semantic review](reviews/05-semantic-adversarial-review.md) are separate records.

## Build the authored deck

Rebuild into a new filename so numbered deliverables remain intact:

```sh
python3 docs/slides/src/build_deck.py src/deck-v5.json rebuilt-v5.html
```

The current renderer dependencies are pinned in [requirements-render.txt](src/requirements-render.txt). Also install the repository’s Node dependencies, the pinned PowerPoint packages in `src/powerpoint`, and system Pango/Fontconfig, librsvg and Poppler. Keep package installations outside the delivered slides directory. The executed stages are:

```sh
python3 docs/slides/src/prepare-local-fonts.py /tmp/slides-v5-fonts
node docs/slides/src/verify-teaching-state-v5.cjs INPUT.html FREEZE-REPORT.json --freeze-output FROZEN.html
python3 docs/slides/src/render-static-v5.py INPUT.html FROZEN.html ARTIFACT-DIR --source docs/slides/src/deck-v5.json --freeze-report FREEZE-REPORT.json
SLIDES_PRINT_MANIFEST=ARTIFACT-DIR/manifest.json node docs/slides/src/export-powerpoint.cjs INPUT.html ARTIFACT-DIR/artwork-base.pptx ARTIFACT-DIR
python3 docs/slides/src/validate-powerpoint.py ARTIFACT-DIR/artwork-base.pptx ARTIFACT-DIR
python3 docs/slides/src/export-components-local.py INPUT.html ARTIFACT-DIR/components NEW-ASSET-DIR --fontconfig /tmp/slides-v5-fonts/fonts.conf
python3 docs/slides/src/verify-components-local.py ARTIFACT-DIR/components/manifest.json INPUT.html --fontconfig /tmp/slides-v5-fonts/fonts.conf
node docs/slides/src/make-component-powerpoint.cjs ARTIFACT-DIR/artwork-base.pptx ARTIFACT-DIR/components/manifest.json NEW-OUTPUT.pptx
python3 docs/slides/src/validate-component-powerpoint.py NEW-OUTPUT.pptx ARTIFACT-DIR/components/manifest.json
```

The uppercase paths stand for a matching source HTML, new freeze report, static copy, artifact directory, asset directory and new output PowerPoint. Use the Python environment installed from the pinned rendering requirements. Register the fonts before preparing diagrams; `docs/diagrams/export_returns_local.py` accepts the diagram basenames and `--fontconfig /tmp/slides-v5-fonts/fonts.conf`, writes the outlined SVG/PNG/PDF files and requires a passing geometry report before printing. Fontconfig can also be selected through `FONTCONFIG_FILE`. `SLIDES_POWERPOINT_DEPS` selects the external Node package directory.

The exporter binds its inputs to the print manifest and refuses an existing PowerPoint output. No rebuild should overwrite earlier numbered HTML/PPTX or component assets. Complete proof files are retained in `exports/05-disaggregated-intelligence/`.

The earlier Chromium → Poppler → PptxGenJS route, its dependencies and version 04 reproduction commands remain in [the archived guide](POWERPOINT-EXPORT-04.md). Version 04’s 152 objects, 22 source components and earlier image-comparison statistics describe that edition only. Version 03’s original 31-slide pair also remains in [the pre-insertion archive](versions/v3-before-returns/README.md).
