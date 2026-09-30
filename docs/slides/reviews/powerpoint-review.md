# PowerPoint export review

The exports use the preserved HTML editions as their only layout source. No slide was hand-recreated or approximated with a new layout. Each 16:9 PowerPoint contains outlined SVG artwork, a separately verified PNG fallback, editable notes, and transparent clickable regions over the source labels.

| Edition | Slides / notes / vector images / fallbacks | Clickable web references | Package validation |
|---|---:|---:|---|
| 1 | 30 / 30 / 30 / 30 | 69 | Passed |
| 2 | 31 / 31 / 31 / 31 | 65 | Passed |
| 3 | 31 / 31 / 31 / 31 | 65 | Passed |

A separate read-only audit found no blocking export defect in editions 1 and 2. Its suggested stronger checks were added to the reusable validator: source URLs must match the original order, and every original purpose, talking point, and transition must survive in editable notes. All three final packages pass those checks.

All package XML and relationships resolve, all objects lie within the slide canvas, and packaged image hashes match the verified artifacts. Each source PDF embeds its font subsets; SVG artwork contains glyph paths without live SVG text or external font/image dependencies. Browser export recorded no JavaScript errors or network requests. Source HTML hashes are unchanged.

Poppler's page PNGs were compared with an independent librsvg render of every SVG. Maximum mean per-channel difference was 0.284 out of 255 for edition 1 and 0.233 for editions 2 and 3; fewer than 0.065% of pixels differed by more than 30 channel levels. The small differences are consistent with renderer antialiasing differences; the package also retains the original PDF-derived fallback. The packaged PNG is the original verified Poppler rendering, not PptxGenJS's default Node SVG-preview placeholder.

The static states are explicit in notes: the gate uses 0.75, cost uses the illustrative 20% fallback case, the repair is revealed, and the trace ends unresolved for the outage. Edition 1 records an active outage; editions 2 and 3 record an accepted handoff. Numeric walkthroughs also explain break-even and a higher-cost outcome.

## Cross-format finding

The edition 2 final trace rendering exposed a teaching ambiguity: its shared event narration appeared inside the Invoice card even when describing the unresolved outage handoff. This prompted an edition 3 change placing the narration above both obligation cards. Visual inspection of its exported slide 16 confirms that the shared handoff narration now sits above the separate Invoice: Resolved and Outage: Handed off cards. Earlier editions remain preserved, and their PowerPoints reproduce their original structure. The edition 1 exercise diagram receives the documented print-only height correction so it cannot extend into the revealed repair.

Edition 3 contains 31 ordered slides, 31 native speaker-note parts, 31 SVG graphics, 31 verified PNG fallbacks, 65 exact source hyperlinks, and 5,314 vector paths. The 6.68 MiB package has no out-of-bounds objects or unresolved relationships; the source PDF embeds 45 font subsets. Its source HTML SHA-256 remains `974d26b5263cf0bbfa6cfc8f5e4a86cd1630e9f677fbb9ba2076ed46277c49b6`.

## Limits and reproducibility

The environment has no Microsoft PowerPoint or LibreOffice renderer. Checks establish OOXML/ZIP consistency, object bounds, packaged-image identity, and independent SVG/PDF visual agreement; they do not claim rendering in an Office application. SVG artwork is not native editable paragraph text. Editable speaker notes, source links, and the complete HTML companion retain the authoring and instructional detail.

Rebuild instructions, dependency pins, static-state disclosures, and validator commands are in [POWERPOINT-EXPORT.md](../POWERPOINT-EXPORT.md). Per-edition manifests, font reports, comparison results, and package validation live under `exports/<edition>/`. Installed dependencies stay in a temporary cache; no `node_modules` tree is included in `docs/slides`.
