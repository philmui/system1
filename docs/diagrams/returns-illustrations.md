# Product aftercare: two allocations of intelligence

The current illustration sequence explains how bounded semantic judgments and authored runtime control can reduce routine dependence on a frontier model. System One identifies familiar work; Agent Graph coordinates its steps and exceptions; AgentScript authors the controls. Trusted services establish identity, owned purchases, applicable policy and transaction results in both compared architectures.

## Follow the two main pictures

| Picture | What to follow | Editable vector |
| --- | --- | --- |
| **A — the shared front desk** | Identity branches to verified continuation, secure sign-in followed by recheck, or a stop. Missing or mismatched purchase evidence returns to verification. Small allocation diagrams compare repeated frontier calls with the authored service path. | [SVG](returns-comparison-access.svg) · [PNG](returns-comparison-access.png) · [PDF](returns-comparison-access.pdf) · [Outlined SVG](returns-comparison-access.outlined.svg) · [Slide inset](returns-slide-access.svg) |
| **B — familiar requests** | Three supported examples use different handlers: a whole-item return, a whole-item exchange and a kit-component return. Only eligible offers reach confirmation and a service result. Unclear meaning first receives clarification. | [SVG](returns-comparison-routing.svg) · [PNG](returns-comparison-routing.png) · [PDF](returns-comparison-routing.pdf) · [Outlined SVG](returns-comparison-routing.outlined.svg) · [Slide inset](returns-slide-routing.svg) |

Page A ends at the **B** continuation badge. Page B begins with verified access and purchase ownership; it does not repeat or skip the earlier requirements. Its **C** badge opens an expanded view of that same clarification event and the downstream reasoning gate. Unavailable services and bounded technical recovery remain explicit in the accessible descriptions and notes without crowding the main pictures.

The figures show supported combinations, not an exhaustive classifier taxonomy. A separately purchased cable is a whole item; a cable included in a purchased headphone kit has component scope. A component exchange needs its own registered handler and policy. An absent handler goes to configured specialist handling.

## Expand policy, reasoning or the reusable objects

| View | Purpose | Editable vector |
| --- | --- | --- |
| **Whole-item policy** | Invented Standard/Plus deadlines and shipping terms; customer confirmation precedes authoritative service approval. | [SVG](returns-whole-item-policy.svg) · [PNG](returns-whole-item-policy.png) · [PDF](returns-whole-item-policy.pdf) · [Outlined SVG](returns-whole-item-policy.outlined.svg) · [Slide inset](returns-slide-whole-item-policy.svg) |
| **Reasoning gate C** | A useful clarification precedes branch-aware evidence checks. Only unresolved meaning with the relevant facts and checks satisfied reaches a scoped frontier proposal and human validation. | [SVG](returns-reasoning-gate.svg) · [PNG](returns-reasoning-gate.png) · [PDF](returns-reasoning-gate.pdf) · [Outlined SVG](returns-reasoning-gate.outlined.svg) · [Slide inset](returns-slide-reasoning-gate.svg) |
| **Component library** | Twelve recognizable objects for identity, sign-in, products, models, review, confirmation and service outcomes. | [Library SVG](returns-branching-component-library.svg) |

The whole-item teaching policy permits eligible Standard requests within 30 days after delivery with $5 return shipping, and Plus requests within 60 days with shipping waived. The last day is included. Both require verified ownership, a returnable item, sufficient unreturned quantity and confirmation of the quote. Exchange and kit-component handlers obtain their own rules; these numbers do not apply to them.

A known exchange, component return, multi-task request or simple condition does not automatically require a frontier model. Missing identity, purchase, inventory or policy evidence goes to the responsible service, verification or hold. Human validation returns task structure through the same allowed-combination mapping and applicable handler; it grants no new authority. Final service authorization is distinct from shipment, inspection or refund settlement.

## Use the story in the article and presentation

[Blog version 09](../blog/09-building-prod.md) develops the full reasoning and evaluation protocol. [Slide version 05](../slides/05-disaggregated-intelligence.html) and its [PowerPoint edition](../slides/05-disaggregated-intelligence.pptx) use the same headphone-exchange and separately purchased cable-return case. The slideshow’s Salesforce presentation frame and the pastel diagram insets serve different visual roles.

The SVG scene groups carry descriptive component metadata. The current PowerPoint converts those sources into native editable shapes, text and named groups; the same treatment now covers all 36 slides. Labels, calendar values and shipping amounts can be changed directly in PowerPoint. Move a node together with its label and reposition its route endpoints, since the paths do not automatically reconnect. The 34 reusable SVG source assets remain available separately. The [editing guide](../slides/EDITING-V5.md) explains customization, and [slide verification](../slides/verification.md) records the actual checks and rendering limits. The earlier 208-object SVG-picture export is preserved in [the version 05 archive](../slides/versions/v5-before-editable/05-disaggregated-intelligence.pptx).

The [branching specification](returns-branching-spec.md) is the semantic contract. AND retains every obligation; OR and IF retain alternatives until selected or triggered, and only the selected alternative may commit. The [design rationale](returns-branching-design.md) explains the two-picture layout and its visual vocabulary.

## Source and evidence boundaries

The conceptual basis is Salesforce’s [Agent Graph discussion](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/) and [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/), alongside [LangChain’s Jev and LangGraph example](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph) and [TypeSafe’s construction guide](https://docs.typesafe.ai/concepts/how-to-build-with-system-one). The direct service mapping, merchant policy and worked cases are original teaching designs. TypeSafe’s intent-routing example uses a specialist language model for its return/exchange branch; these drawings propose a different implementation to evaluate.

`koa-action` follows the capability framing supplied in the brief. Jev illustrates the same bounded-decision role with its own interface. The figures establish neither API compatibility nor a native Salesforce adapter, and contain no measured cost, speed or reliability comparison. Public Koa reasoning-model claims are not transferred to `koa-action`. The [fresh source check](../slides/research/v5-throughline-source-check.md) records these distinctions.

## Rebuild the current SVG sources

```sh
python3 docs/diagrams/build_returns_branching_access.py
python3 docs/diagrams/build_returns_branching_routes.py
python3 docs/diagrams/build_returns_reasoning_gate.py
python3 docs/diagrams/build_returns_branching_support.py
```

The source SVGs use embedded display fonts and accessible titles and descriptions. They contain native vector artwork. Rendering and export checks for this revision are recorded in [current verification](returns-branching-verification.md), separately from the earlier browser-based checks. The [version 04 illustration guide](returns-illustrations-04.md), old artwork and earlier review logs remain unchanged.
