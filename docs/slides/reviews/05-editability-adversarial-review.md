# Version 05: independent native-editability review

This review concerns the conversion of all 36 slides to native PowerPoint content. It is separate from the earlier review of movable SVG artwork. The requested Codex plugin could not initialize its state database in this restricted environment during the preceding task; [that attempt](05-throughline-codex-review.txt) remains the recorded plugin outcome. The present review is an independent adversarial inspection, not plugin approval or a Microsoft PowerPoint rendering test.

## Baseline and acceptance criteria

The [independent baseline](05-editability-baseline.json) was captured before replacement. The original file contained zero native slide-text runs. Thirty-one slides used one complete-slide picture; five used separate SVG pictures with outlined labels. It contained 36 notes pages and 77 source hyperlinks. The original PowerPoint must remain byte-for-byte available in [the archive](../versions/v5-before-editable/05-disaggregated-intelligence.pptx).

The conversion must provide editable titles, paragraphs, code, labels and table cells; native shapes for bars, cards, paths and backgrounds; and named logical groups for illustrations. Moving or recoloring an object must not require an external SVG editor. Source hyperlinks must move with their editable labels. The conversion must preserve the teaching content, current example states, slide order, 16:9 geometry and speaker notes, except for replacing the obsolete export-format disclosure and the library's obsolete editing instructions.

Hidden text overlays do not meet this requirement. Neither does editable text placed on top of unchanged outlined labels. A complete-slide raster or vector picture with a few editable additions remains a flattened slide. The new deck must contain no picture objects or image fills in its slide content.

The [independent inspector](../src/validate-editable-powerpoint.py) reads the actual OOXML without importing the author's converter. It checks native text against the source inventory, verifies coherent titles and visible text, checks named objects and nested group bounds, checks custom-geometry syntax and package relationships, and compares notes and clickable web targets with the captured baseline. These checks establish package structure and content preservation; they do not establish native Office rendering.

## Final artifact review

**Passed for the artifact with SHA-256 `fb31adb6115c535b73cbffefa43edd269600a961b79c9059b85bd0d52b017e03`.** There is no unresolved material defect in the native-editability and content-preservation scope of this review. This is the candidate approved for replacing the requested version 05 filename; the preceding SVG-based file remains archived.

The [independent package inspection](../exports/05-disaggregated-intelligence-editable/independent-editability-validation.json) confirms **36 slides, 722 native text components, 980 drawing components and 623 native groups**. The 1,702 `p:sp` objects include both text and drawings; groups are counted separately. No slide contains a picture object or image fill. All 77 original web-source hyperlinks remain clickable through their editable labels. The source character inventory and ordered phrases match, including all SVG labels, and every slide title remains a coherent text component. Native objects have names, positive extents and valid group transforms; text is visible and is not locked against editing. Teaching notes are preserved except for the explicitly identified format and editing-guidance corrections.

The [editing round trip](../exports/05-disaggregated-intelligence-editable/native-editing-roundtrip.json) used the separate `python-pptx` 1.0.2 object model to read all 36 slides, edit a title, recolor and resize a cost bar, and move the grouped whole-kit illustration. It saved and reopened an isolated copy and verified all four changes through the API. The delivered input was unchanged and the temporary copy was removed. This establishes ordinary native object-model editability; it does not simulate mouse interaction in PowerPoint.

[Nine negative probes](05-editability-negative-probes.json) independently challenged the inspector with reordered text, a picture object, transparent text, an editing lock, a lost clickable source link, an off-slide text box, an unresolved CSS font alias, an invalid custom-path coordinate and changed teaching notes. Each intentionally damaged copy was rejected for the intended reason. The unmodified candidate passed first, and all temporary files were removed.

## Findings addressed

| Finding | Verified correction |
| --- | --- |
| The earlier composition provided movable outlined artwork but no native slide text. | All 36 slides were rebuilt from measured HTML and authored SVG sources as native text, shapes and groups. Prior images and their unused media were removed. SVG text follows a dedicated native-text path; its glyphs are not duplicated as underlying geometry. |
| The initial note updater assumed the export disclosure occupied its own `a:t` node. Actual notes stored an entire page in one text node. | The updater replaces only the identified export subsection, plus the exact obsolete library-editing sentence. Independent comparison protects the remaining teaching content. |
| The HTML used the private CSS font alias `IBMPlexMono`, which was carried into an early candidate. | Native runs now name the real `IBM Plex Mono` family. The inspector rejects both unresolved private aliases. |
| Concatenating rich-text runs discarded eight intentional inline gaps, including five numbered instructions on slide 34. | Native tab stops retain those gaps. Paragraphs use zero left margin and an explicit first-line indent, so tab positions have an unambiguous origin. The source-label links remain attached to their native runs. Microsoft's [DrawingML tab documentation](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.tabstop?view=openxml-3.0.1) defines positions relative to the left margin. |
| The parallel geometry review found that macOS Pango could measure fallback fonts through its default CoreText backend. | The SVG converter now uses an explicit Fontconfig font map with fractional positioning and unhinted metrics. The final geometry reports bind to the corrected converter and final candidate. |

The [vector acceptance report](05-native-vector-acceptance.json) covers all 24 SVG occurrences and preserves 105 source labels as native text. Its independent DrawingML path reconstruction found a largest geometry-only mean channel difference of about **0.000219 out of 255**. The [full-deck proof](../exports/05-disaggregated-intelligence-editable/proof-candidate-04/native-xml-render-report.json) reads the actual PPTX XML and reconstructs all 36 pages, including native fonts, paragraph spacing, tabs, groups and gradients. Its mean difference from the previous artwork is **0.969 out of 255**, with a maximum of **2.636** on slide 07. The [text-geometry review](../exports/05-disaggregated-intelligence-editable/proof-candidate-04/text-geometry-review.json) found no distinct text-component ink overlaps or out-of-slide ink. These are local geometry and font interpretations, not Office screenshots.

## Practical limits

The deck keeps authored line breaks in coherent text boxes. Longer replacement text may require adjusting its box or wrapping. Native chart bars and cells can be edited individually; they are ordinary shapes and text rather than a spreadsheet-driven chart. Arrow geometry remains editable but does not automatically reconnect when a node moves.

Fonts are not embedded. Install Salesforce Sans, Manrope and IBM Plex Mono for the intended typography, or use PowerPoint's font replacement. Font-version differences can affect layout. The [Keynote availability probe](../exports/05-disaggregated-intelligence-editable/native-render-attempt.json) failed before opening a document, and neither Microsoft PowerPoint nor LibreOffice was available. No native Office-rendering pass is claimed.
