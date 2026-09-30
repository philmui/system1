The editable [version 05 PowerPoint](05-disaggregated-intelligence.pptx) has native PowerPoint text, shapes and nested groups on all 36 slides. Titles, paragraphs, workflow labels, icons, cards, routes and backgrounds can be selected and customized. The [earlier version 05 export](versions/v5-before-editable/05-disaggregated-intelligence.pptx) is preserved for comparison.

Save a working copy before making changes. In desktop PowerPoint, open the **Selection Pane** to see the named objects and their nesting. Select a group to move or resize a complete visual; expand the group, or click again on a member, to edit that member. **Ungroup** is available when you want to reorganize the pieces. Nested illustrations may require more than one level of ungrouping, so keep a copy of the original group for reference.

| What you want to change | How to edit it |
| --- | --- |
| A title, paragraph or diagram label | Select the text object and edit its text normally. Authored line breaks are retained; resize the text box or adjust those breaks after adding words. |
| A card, chip, icon or background | Select the shape, then change **Shape Fill**, **Shape Outline**, size or position. Background gradients are editable fills. |
| A curved icon or workflow route | Select the relevant freeform shape and use **Edit Points**. Arrowheads and their route lines are grouped where they belong together. |
| A complete branch or illustration | Use the Selection Pane to select its group. Copy it to another slide, then adjust its members and route endpoints. |
| A source link | Select the linked source text and edit the hyperlink. Links are attached to native text runs and move with their text box. Replacing linked text or pasting plain text may require restoring the link. |
| Narration | Edit the speaker notes below the slide. |

Moving a node does not automatically reroute the adjacent paths. After rearranging a workflow, adjust its route endpoints and arrowheads, then check which branch each label describes. Grouping keeps a visual together; it does not enforce the business rules shown by that visual.

A short practice edit uses slide **07, “Give familiar requests a direct service route.”** Duplicate that slide first. Edit its title to “A direct route for familiar requests,” then expand its `img · drawing` group in the Selection Pane and find the `exchange` group. Move the exchange illustration slightly, select an individual shape to change its outline, and adjust the adjoining route so that the arrow still points to the intended handler. Edit the nearby native label, check its line breaks, and view the slide at presentation size. The whole-item return, exchange and kit-component routes should remain distinct, with clarification and reasoning exceptions following their own branches.

Slide **36** provides a reusable visual vocabulary. Copy an icon group and its associated text label to a working slide; keep their relative spacing when resizing them. For a coordinated update to the HTML presentation or article, make the corresponding changes in the [slide source](src/deck-v5.json) and the relevant blog or diagram source as well.

The typography uses **Manrope** for headings, **Salesforce Sans** for body text, and **IBM Plex Mono** for code and small technical labels. Manrope is the documented substitute for the Salesforce reference template’s Avant Garde Demi SFDC heading face. Use Salesforce Sans Regular and Bold from your separately licensed installation to retain the body typography.

The [portable open-font pack](assets/editable-v5-fonts.zip) contains Manrope Regular and Bold plus IBM Plex Mono Regular, with the original OFL licenses and a [fidelity manifest](assets/editable-v5-fonts/manifest.json). These files have **not been installed** on your computer. Install them through your operating system’s font manager if needed, then reopen PowerPoint. Their character coverage matches the bundled Latin font subsets; added languages or symbols may need an appropriate additional font.

Salesforce Sans is excluded from that pack. The supplied font files declare `OS/2.fsType=4`, which allows preview-and-print embedding rather than editable embedding; their permission flags have not been changed, and this pack does not redistribute those fonts. If a required font is unavailable, select a replacement consistently throughout your working copy and inspect line breaks and label spacing before sharing it. Font substitution can alter the layout even though the text remains editable.

The [verification record](verification.md) documents the package, content and layout checks and distinguishes them from a native Microsoft Office render. Review your edited copy in desktop PowerPoint before delivery, particularly any slides whose wording, font or workflow layout you changed.
