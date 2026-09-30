# Version 05: Salesforce reference style

The requested visual reference, `salesforce-style.pptx`, is kept outside the repository because its size exceeds GitHub's regular-file limit. Its four slides match pages 20–23 of the 74-page `salesforce-style.pdf` in the user's Downloads directory. This was checked by slide text, title order and rendered appearance. The reference supplies visual direction; its product claims and customer metrics are not evidence for this tutorial.

## Reference identity and geometry

| Property | Verified value |
|---|---|
| PPTX slides | 4 |
| PPTX canvas | 18,288,000 × 10,287,000 EMU; 20 × 11.25 in; 16:9|
| PDF canvas | 1,440 × 810 pt; 16:9|
| PDF matching pages | 20: Long-Horizon Runtime; 21: Harness Extensibility; 22: Autotuning Intelligent Context; 23: Knowledge Graph Retriever |
| PPTX SHA256 |`d13686d570c7c9f69b9273c9c25156f934e68908e6b7214e2f0287d39e23bf53`|
| PDF SHA256 |`5d632c1ffcd93723f9efcfb3f261a7dd612769e5f43cbeb41e5c421bc9f18944`|

The source PPTX was opened as a ZIP and read without alteration. Font, color and shape properties were inspected in its slide, master and theme XML. The reference uses several inherited themes, so the visible slide styling is more informative than `theme1.xml` alone. Theme 3 is named **2026 SF Corporate Template**. Its palette includes royal blue `#022AC0`, navy `#001E5B`, bright sky `#00B3FF`, pale sky `#CFE9FE`, turquoise `#04E1CB`, yellow `#FCC003`, pink `#FF538A` and lilac `#D17DFE`. Actual slide text also uses navy `#032D60`.

The title on reference slide 2 begins at approximately 90 × 104 px on a 1920 × 1080 stage. Its 56 pt type corresponds to 74.7 CSS px. The main title on reference slide 3 begins approximately 91 × 59 px. Body copy in the reference ranges roughly 20–30 pt, with 33 pt card headings. Rounded white cards occupy the middle of the slides, with diagrams and screenshots given substantial space. The gradient background moves from pale sky at the upper left toward pale mint and white at the lower right.

Reference renders: [20](style-reference/reference-20.png), [21](style-reference/reference-21.png), [22](style-reference/reference-22.png), [23](style-reference/reference-23.png).

## Applied decisions

[theme-v5.css](../src/theme-v5.css) retains the existing 1920 × 1080 stage, 88 px side margins, 170 px heading allocation and the 1744 × 620 illustration bodies. It changes the visual treatment around that geometry:

- Royal blue headings and navy body text on a pale sky-to-mint background echo the supplied slides. Hero slides use a slightly stronger version of the same gradient.
- Salesforce Sans regular and bold are embedded as data-URI WOFF2 faces. Their source locations, hashes and original font metadata are recorded in the [font manifest](../assets/fonts-v5/manifest.json). The installed source fonts were converted without altering their embedding metadata.
- Bold Manrope 700 provides the geometric heading style. The reference uses **Avant Garde Demi SFDC**, but its only available copy is compressed EOT/MTX data inside the PPTX; no usable standalone OpenType font was present. Manrope is an explicit substitution, not a claim to reproduce the corporate font exactly.
- Main headings use 72 px type, with 64 px for long titles. The cover uses 108 px. Font metrics were checked against the available heading width, and the sample cover and closing lines fit their columns.
- White cards and muted pastel nodes use 22 px corners; figures sit on their own softly rounded inset surfaces. Thin blue rules and small source text keep citations legible without competing with the illustrations.
- Original vector illustration colors remain intact. Green denotes the System One branch, lilac denotes frontier reasoning, blue denotes service control and amber denotes clarification or a held case. The illustrations remain reusable SVGs with their original text and named components.
- Code and quantitative annotations retain the bundled IBM Plex Mono. Existing diagram labels retain embedded Manrope. Earlier theme/font files are unchanged.

The reference's product screenshots, logos, customer metrics and claims were not copied into tutorial content. The style adaptation uses native CSS geometry and the tutorial's original illustrations.

## Validation and limits

A four-page local style specimen was rendered with WeasyPrint 69 and inspected after PDF rendering through Poppler: [cover](style-reference/specimen-1.png), [allocation](style-reference/specimen-2.png), [runtime layers](style-reference/specimen-3.png), [close](style-reference/specimen-4.png). The specimen confirms the palette, type hierarchy, titles and major layouts. It is not a replacement for checking every final slide or the final PowerPoint package.

The render exposed a compatibility issue: WeasyPrint rejects intermediate 350/450 numeric weights in the CSS `font` shorthand, although browsers accept them. The new theme uses discrete 400 weights where those shorthands occur, with explicit 700 headings. The cover's leaf nodes also receive slightly reduced internal padding and 27 px titles so “Frontier model” fits without changing its wording.

The restricted environment blocked Chromium's macOS process registration. Consequently, these style specimens are PDF-renderer checks; they are not claimed as Chromium, Microsoft PowerPoint or native Office screenshots. Final export and package checks are recorded separately by the deck build.
