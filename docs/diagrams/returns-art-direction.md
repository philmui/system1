# Art direction: product returns, two ways to allocate intelligence

The comparison should be legible before its labels are read: the left column repeatedly visits a large lavender reasoning node; the right follows a short mint and ink graph, with a single lavender exception branch at the edge. Both columns reach the same backend authority. This makes the architectural difference visible without implying that a language model authenticates a customer or approves a financial action.

## Main composition

Use a 2400 × 1760 landscape poster, warm paper `#F7F8F3`, with 88 px outer margins. The extra vertical space gives the return process room to breathe; forcing this comparison into a standard widescreen slide would either shrink the labels or hide essential controls.

- **Title zone, y = 76–245.** One title, approximately 76 px Manrope semibold: “A return should not need a frontier model at every turn.” A 31 px explanatory line introduces disaggregated intelligence. Keep the longer architecture definition in the accompanying notes.
- **Two comparison panels, y = 300–1350.** Left starts at x = 88, right at x = 1224; each is 1088 px wide. A 48 px gap separates them. Give the panels thin, low-contrast borders and 28 px corner radii. Use the same vertical checkpoints in both columns so the eye can compare one business obligation at a time.
- **Shared authority band, y = 1390–1545.** A blue-tinted horizontal strip states the common backend contract: “Verified identity → owned order → policy result → authorized return.” A brief second line states that loyalty affects the published policy, while model suggestions cannot override it. Do not connect this band as a second execution path; it explains the identical authority boundary in both implementations.
- **Outcome strip and legend, y = 1580–1680.** Parallel labels compare allocation of reasoning: “Frontier inference throughout” and “Bounded decisions; frontier fallback when needed.” Keep cost and speed directional, with an explicit statement that actual gains depend on escalation rate and service measurements. No decorative percentage or fabricated benchmark.

Use 44–48 px panel titles, 32–35 px node headings, 28–30 px explanatory lines, and a minimum of 24 px for source notes. Render any compact source address as a short linked title; the notes carry full URLs.

## Reading order and graph grammar

Keep execution top-to-bottom. Four aligned checkpoints are sufficient for the main comparison:

1. **Understand the request.** The input is a short customer utterance. On the left, a frontier model interprets and routes it. On the right, `koa-action` or `Jev` returns a bounded intent or reason label. Include an explicit `unclear` outcome; an unsupported semantic label must not become an authorization.
2. **Verify the customer.** A trusted identity service performs authentication in both columns. The left revisits the frontier model to choose the next step. The right uses a fixed guard on the service result. An authentication failure goes to reauthentication or stop, never to the reasoning fallback.
3. **Match the purchase.** The order service verifies receipt, customer ownership, and item identity in both columns. The model can help classify a messy description, while the authoritative match comes from the service. A missing or contradictory receipt goes to evidence collection or review.
4. **Apply policy and commit.** A versioned policy function uses authoritative loyalty tier and order facts to determine eligibility and shipping treatment. The backend validates the request and creates the return once. Label the fee outcome “waived” or “customer pays” only after eligibility passes.

Represent the repeated frontier calls on the left using one recognizable lavender capsule at each checkpoint, linked by a lavender rail. Label the panel “Same frontier model, invoked at each decision.” Avoid a giant brain illustration, a tangled spaghetti path, or distressed/red styling; those add judgment without teaching the mechanism.

On the right, use an ink graph spine and mint capsules only for genuine semantic decisions. Keep deterministic guards as small labeled junctions and trusted services as blue cards. A compact header above the graph says “AgentScript configures · Agent Graph executes.” A single amber dashed branch labeled “Still unresolved after clarification” reaches a lavender frontier-reasoning card. Its return arrow must enter validation or review, rather than jump directly to the accepted-return output. Label that output “proposed interpretation” so sophisticated reasoning never implies policy authority.

Do not imply every rejected return is sent to a frontier model. A known policy failure is an ordinary graph result. Human review is the terminal path when evidence remains unresolved or an exception requires an authorized person.

## Companion policy detail

The main comparison should not carry a full loyalty truth table. Produce a second 1920 × 1250 vector with the same typography and palette, titled “The policy decides the return and the fee.” Label all rules as an **illustrative merchant policy**.

The cleanest layout is a two-step explanation: an eligibility gate above, then a compact loyalty/fee table below. The fee table is explicitly scoped to **eligible returns only**. Put the merchant-caused or item-defect fee waiver ahead of loyalty if that is part of the example policy; otherwise omit that dimension. A loyal customer must not bypass identity, ownership, prohibited-item restrictions, or mandatory consumer rights. Never invent legal entitlements in the example.

A specific narrated example can anchor the table: an authenticated customer, owned receipt, 18-day-old purchase, and a verified loyalty tier. Use the exact same facts in both architecture panels. Show two nearby alternative outcomes for different loyalty tiers, while keeping the return eligibility decision separate from the shipping-fee decision. The accompanying notes should carry complete Boolean predicates and priority rules.

## Visual system

| Role | Fill | Strong stroke or label |
| --- | --- | --- |
| Paper and white space | `#F7F8F3` / `#FFFFFF` | Ink `#243E42` |
| Frontier reasoning | Lilac `#E5DFF3` | Plum `#655482` |
| System One decisions | Mint `#D3E8DF` | Green `#326956` |
| Trusted identity, order, policy, and commit services | Blue `#D8E8EF` | Blue-gray `#3C6475` |
| Uncertainty and review | Sand `#F5E6B9` | Ochre `#86682C` |
| Invalid or missing evidence | Peach `#F2D8CB` | Brown `#885744` |

Use color as a second cue, not the only cue. Rounded capsules represent model inference; squared service cards represent authoritative operations; small diamonds or explicit `if` labels represent graph guards. Use one arrow style for ordinary execution and a dashed style for escalation. Keep every connector outside text boxes, attach arrowheads to ports, and place labels on paper-colored backing when an edge approaches another line.

Manrope is available locally in `docs/slides/assets/fonts/Manrope.woff2`; IBM Plex Mono suits short branch labels and code identifiers. Embed the display font in the browser SVG. Preserve editable text in the source SVG and, if needed for portable export, provide a distinct outlined copy rather than replacing the editable asset.

## Checks that matter

At 50% zoom, the overall contrast, each business checkpoint, and the fallback destination should remain obvious. At native size, confirm that no connector crosses a label, the shared backend band cannot be mistaken for an execution node, and every failure exit has a named destination. Check a grayscale preview for role legibility. Include `<title>` and `<desc>` with a full text alternative, and create a PNG preview only as a convenience; the SVG remains the primary artifact.

The most likely design failure is cramming policy detail into the right column while leaving the left visually simple. Preserve equal visual obligations in both panels and move the full rule table into the companion figure. The most likely conceptual failure is allowing the purple fallback arrow to bypass blue backend authority. That edge must visibly return to a guard or review.
