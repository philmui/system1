This folder contains the open-font companions for the editable version 05 slides. No fonts have been installed on your computer.

- `Manrope-Regular.ttf` and `Manrope-Bold.ttf` are static 400/700 instances of the bundled Manrope variable font. Their family name is **Manrope**, so PowerPoint can select the intended weight without the source font’s legacy “ExtraLight” family name.
- `IBMPlexMono-Regular.ttf` contains the original **IBM Plex Mono** font decoded from its WOFF2 container. Its names, outlines, metrics, shaping tables and permission flags are unchanged.

Both licenses are included unchanged. These files retain the character coverage of the existing Latin subsets; additional languages or symbols may require an appropriate font installed separately. The [manifest](manifest.json) records source and output hashes and verifies the glyph outlines, advances, character maps and line metrics. Manrope is compared with the source variable font instantiated at the matching weight.

**Salesforce Sans is not included.** Use your separately licensed Salesforce Sans Regular and Bold installation to retain the body typography. The supplied Salesforce fonts declare `OS/2.fsType=4`, which permits preview-and-print embedding rather than editable embedding; this pack does not change that setting or redistribute those fonts. Manrope remains the presentation’s documented heading substitute for the reference template’s Avant Garde Demi SFDC.

To make the open fonts available in PowerPoint, install these TTF files through your operating system’s font manager and reopen PowerPoint. That is a user action; this repository has not installed them. If you already have an appropriate Manrope and IBM Plex Mono installation, use that installation and avoid duplicate faces.

See [the editing guide](../../EDITING-V5.md) for the presentation’s object structure and a short editing exercise.
