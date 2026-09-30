# Design rationale: branching without a wall of text

The illustration must let a newcomer trace what happens to a product request and explain why a frontier model is needed only on some paths. The redesign uses two main pictures because access and interpretation answer different questions. Combining every authority branch, request type, policy and exception into one picture made the reader parse an implementation specification before seeing the idea.

## A — establish the shared entrance

[Picture A](returns-comparison-access.svg) places the customer, identity check and matched purchase on a readable left-to-right route. The identity object is neutral until the authoritative result determines the branch. Secure sign-in returns to the same check; denied access ends protected work. Missing or mismatched purchase evidence returns through verification to the purchase check. Completing a recovery screen never creates a shortcut.

Both model allocations use this same front desk. Compact chip-and-service diagrams at the right show their different inference patterns without duplicating a dense workflow: the wrapper repeatedly calls the frontier model, while the disaggregated design follows authored dependencies and uses System One for language judgment. This is a comparison of model allocation under equivalent safeguards.

The **B** continuation badge appears only after a matched owned purchase. Service outages, invalid responses and bounded recovery are described in notes and accessible text, where they can be explained accurately without adding another equally prominent main route.

## B — make each request recognizable

[Picture B](returns-comparison-routing.svg) replaces prose-heavy decision cards with a whole headphone kit, two parcels exchanging places, and a cable identified within its kit. A short example beside each object makes the affected unit concrete. System One supplies bounded judgments; authored graph logic maps supported combinations to the appropriate handler.

The three examples vary remedy and scope: return the whole purchased kit, exchange the complete item, or return a component of the kit. Their aligned rows lead to different service checks. The common exit is labeled **Eligible quotes**, and confirmation is repeated conceptually **for each selected task**. These labels prevent the shared drawing from implying shared eligibility rules or one confirmation for every listed option.

The drawing’s three rows do not define a complete model taxonomy. Component exchange, unsupported remedies and unclear item references have their own configured handling in the specification. In the recurring blog and slide case, the spare cable was purchased separately; it therefore uses the whole-item return handler. That case is deliberately distinguished from the cable drawn inside the kit.

## Keep request type separate from difficulty

An exchange or component request can have a clear interpretation even when its business procedure has several steps. The amber clarification route leaves the semantic node separately from the three familiar paths and returns for reassessment when the answer resolves the meaning. Only a remaining interpretation problem continues at **C**.

The [expanded reasoning gate](returns-reasoning-gate.svg) magnifies the same clarification event from Picture B and keeps frontier reasoning behind the applicable evidence checks. Missing facts hold, known policy failures follow their handler’s result, and the frontier output stays a proposal for human validation. Validated task structure re-enters the same allowed mapping and rules. Neither a model nor a reviewer can invent a missing service or entitlement.

AND, OR and IF relationships remain in task state. AND retains each obligation; OR and IF activate only the selected or triggered alternative. Unknown stock does not satisfy an out-of-stock condition, and a different policy denial cannot silently broaden the customer’s instruction. The short reminder in Picture B points to these semantics in the article and notes.

## Use physical objects and a consistent hierarchy

People, purchase records and recognizable products carry the main meaning. Model chips identify semantic processing, while calendars and shipping tickets make the invented whole-item policy visible. Mint routes emphasize familiar progression; amber identifies clarification; lilac identifies frontier reasoning. Labels, symbols and edge direction carry the meaning independently of color.

The policy has its own [scoped picture](returns-whole-item-policy.svg). Its visible whole-item label prevents the numeric teaching rules from silently spreading to exchanges or kit components. Confirmation precedes the authoritative service result throughout the sequence. An authorization graphic represents a recorded request, not completed shipping or settlement.

Each full illustration has a 1900 × 900 canvas; its slide inset uses 1744 × 620. Short visible labels remain separate from the more detailed accessible descriptions and speaker notes. The pastel illustration vocabulary is retained inside the version 05 presentation frame, which follows the user’s Salesforce styling reference.

## Preserve reusable vector objects

Scenes, labels, badges and routes have named SVG component groups. The [component library](returns-branching-component-library.svg) collects twelve objects that can be reused without redrawing the workflow. Exported PowerPoint objects should preserve this separation. Labels may be outlined for portability; the editable source text remains in the SVG. Connectors are independent vector arrows and need repositioning after nodes move.

The new files have distinct names. They preserve the previous diagrams and the meaning of blog 08 and slides 04. Current content is shared by [blog 09](../blog/09-building-prod.md), [slides 05](../slides/05-disaggregated-intelligence.html) and the [branching specification](returns-branching-spec.md). Evidence limits and executed checks belong in [current verification](returns-branching-verification.md), rather than being inferred from an older review approval.
