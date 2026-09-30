# Independent visual review: product-return illustrations

Reviewed the rendered `returns-comparison.png` and `returns-policy.png`, their SVG coordinates, and `build_returns.py`. I also inspected reductions at exactly 50% of the SVG canvas size: 1400 × 960 for the comparison and 1200 × 1070 for the policy figure. The PNG exports are rendered at 1.5× SVG size, so halving the PNG alone is not the 50% readability check. Artwork was not modified during this review.

## Findings

### V1 — Medium: the companion figure makes its architectural scope ambiguous

**Location:** `returns-policy.svg`, subtitle at (88, 216), followed by the green step 03 card at (1628, 265).

The subtitle says the figure shows safeguards “shared by both architectures,” but the top-level sequence contains `koa-action or Jev · bounded labels`, and the exception lane is specifically the disaggregated execution path. A reader encountering this image independently can conclude that the wrapper architecture also contains a System One model. This weakens the central comparison.

**Recommended fix:** Scope the subtitle explicitly: “The disaggregated return flow, with the same backend safeguards.” The policy and authorization requirements remain shared; the model allocation shown here belongs to the right-hand architecture. Alternatively make step 03 architecture-neutral, but that loses useful continuity with the main comparison. Relabeling is the smaller and clearer change.

### V2 — Medium: essential exception labels shrink below the intended reading size

**Location:** `returns-comparison.svg`, branch region x = 2218–2676, y = 978–1487. The labels `unclear / complex`, `resolved`, and rotated `validated facts` use 19 px; `still complex + eligible` uses 21 px. These become 9.5–10.5 px at the 50% view.

The titles and ordinary service descriptions remain readable, but the conditions governing the most consequential branch become annotation-sized. The rotated text makes the return path harder to scan, precisely where the reader needs to understand that frontier reasoning cannot approve the return. This is a hierarchy problem rather than a font-rendering defect.

**Recommended fix:** Raise routing conditions to at least 24 px, permitting two lines and a little more branch spacing. Keep the small step numbers unchanged because they are secondary navigation cues. Replace rotated `validated facts` with a horizontal label or rely on a clear directional return arrow and the existing “Validate facts or hold” card copy. Do not solve this by shrinking service text or increasing the entire canvas; use the available branch margin.

### V3 — Medium: two return paths merge into one undirected vertical rail

**Location:** `returns-comparison.svg`, the green rail at x = 2270 from y = 1129 to y = 1426, with its single leftward arrow entering policy at y = 1219.

The clarification return and human-validation return are both encoded correctly in the path data. Visually, however, they form one continuous vertical rail with no direction marker on either arm and no visible merge point. At 50%, the reader can initially read this as a connection between clarification and human review, or as a side bus feeding multiple steps. The nearby confirmation card makes the upward rejoin less immediate to parse.

**Recommended fix:** Add a downward arrowhead on the upper arm and an upward arrowhead on the lower arm, plus a small merge dot at (2270, 1219), keeping the existing leftward policy arrow. Another valid solution is two visibly separate return arrows entering different ports on the policy card. The first solution preserves the current layout with less visual noise. The return must continue to enter **Apply policy + fee**, never **Confirm + authorize**.

### V4 — Low: the wrapper’s semantic node mixes authority and inference styling

**Location:** `returns-comparison.svg`, left step 03, (500, 978), generated through `Drawing.service(...)`.

“Route the reason” uses a pale lavender background but retains the blue service icon, blue descriptive text, blue step number, and service-card geometry. The legend assigns blue to a trusted service. This mixed treatment is a subtle contradiction: the copy correctly says “Model output,” but the secondary styling partly presents that output as authoritative service data.

**Recommended fix:** Give this one row plum icon and detail text, including its step number. Keep its aligned geometry for comparison. There is no need for another inference capsule; the repeated frontier call immediately to its left already supplies the model.

### V5 — Low: the exception lane in the companion competes with the policy lesson

**Location:** `returns-policy.svg`, exception container y = 479–866 and the lines directly below its three cards.

The figure spends nearly as much vertical space restating the reasoning fallback as it does presenting the loyalty rules and worked outcomes. It also repeats missing-evidence and no-bypass language already established by the top gates and policy prerequisites. The result is more like a compact specification than an illustration focused on how loyalty affects eligibility and shipping.

**Recommended fix:** Preserve the three exception cards and their branch conditions, but reduce the two full-width explanatory lines to one concise statement, for example: “Missing evidence or failed inference stays pending; all earlier gates still apply.” Keep retry limits, unknown-write reconciliation, and the full exception contract in the workflow notes. Use the recovered space as separation before step 04 or to increase the policy table’s text size. This is an editorial improvement, not a correctness requirement.

## Revision priority and acceptance checks

Address V1–V3 before final delivery. V4 is a small consistency fix. Treat V5 as an optional tradeoff: the companion may retain more detail if it is explicitly described as a reference poster rather than a projection slide.

After revision, inspect the comparison again at 1400 × 960. The observer should be able to follow the green routine route, identify the narrow frontier fallback, and trace both return arrows into policy without rotating their head or enlarging the image. Check that all blue backend operations are visually consistent in both columns and that only the right-hand route assigns semantic classification to `koa-action` or `Jev`.

No clipped text, crossing text/connector collisions, or direct frontier-to-authorization edge was visible in the inspected renders. The open issues concern scope, hierarchy, and interpretation of the small exception branch rather than missing artwork.
