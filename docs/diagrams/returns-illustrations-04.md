# Product returns: two ways to allocate intelligence

The comparison follows one request through authentication, receipt matching, interpretation, policy and shipping, and return authorization. Both architectures rely on the same service-enforced rules. Their difference is the allocation of model inference: a frontier model selects each next step on the left; an authored graph and a bounded System One decision handle the routine path on the right.

- **Architecture comparison:** [editable SVG](returns-comparison.svg), [outlined SVG](returns-comparison.outlined.svg), [PNG preview](returns-comparison.png), [vector PDF](returns-comparison.pdf).
- **Loyalty policy and shipping:** [editable SVG](returns-policy.svg), [outlined SVG](returns-policy.outlined.svg), [PNG preview](returns-policy.png), [vector PDF](returns-policy.pdf).
- **Reasoning detour:** [editable SVG](returns-fallback.svg), [outlined SVG](returns-fallback.outlined.svg), [PNG preview](returns-fallback.png), [vector PDF](returns-fallback.pdf).
- **Presentation:** [version 04 HTML](../slides/04-disaggregated-intelligence.html), [PowerPoint](../slides/04-disaggregated-intelligence.pptx), [reusable component assets](../slides/assets/components/README.md).
- **Worked explanation:** [blog version 08](../blog/08-building-prod.md).

The policy is invented for teaching: Standard requests received within 30 days after delivery cost $5 in return shipping; Plus requests within 60 days have shipping waived. Both require verified ownership, a returnable item, sufficient remaining quantity, and confirmation of the shipping quote. Acceptance means the backend has issued a return authorization, not that a refund has settled.

The optional reasoning branch first seeks a useful clarification and checks known policy constraints. Missing evidence stays pending, and known ineligibility declines the ordinary request. Only residual semantic complexity can reach the frontier model. Its proposal goes through human validation and the same policy step. Neither a model nor the reviewer has a policy-override mechanism in this example.

`koa-action` uses the capability framing supplied in the brief. Jev is another example of a specialized decision model, with separate documented interfaces. The figures propose a composition; they do not establish a native adapter, measured inference advantage, or production deployment. The [complete workflow specification](returns-workflow-spec.md) records the branch contracts and six worked cases.

The conceptual basis is Salesforce’s [Agent Graph discussion](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/) and [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/), together with [LangChain’s Jev and LangGraph example](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph) and [TypeSafe’s intent-routing pattern](https://docs.typesafe.ai/patterns/intent-routing). The merchant policy, diagrams, and worked cases are original teaching material.

The figures use large illustrated objects instead of text-bearing workflow cards. Identity cards and receipts establish the purchase, calendars show the loyalty windows, tickets show shipping, and the customer confirms before the service authorizes the return. A large lilac chip identifies frontier reasoning; a smaller mint chip identifies the System One decision. Dashed connectors distinguish the optional reasoning detour from the main route.

The original SVGs retain editable text and embed Manrope and IBM Plex Mono for browser portability. PDFs preserve vector artwork and embedded font subsets. Outlined SVGs preserve the typography in editors without embedded-font support. Every original SVG has an accessible title and description. In PowerPoint 04, illustrations, labels and route objects are independently movable; the three figures and the library span 152 objects. Source SVGs for 22 reusable components are also provided.

Rebuild the pictorial artwork and its exports:

```sh
python3 docs/diagrams/build_returns_illustrated.py
node docs/diagrams/export_returns.mjs returns-comparison returns-policy returns-fallback
node docs/diagrams/export_returns.mjs returns-slide-comparison returns-slide-policy returns-slide-fallback
```

The checks measure canvas boundaries with font metric boxes and text overlap with actual glyph-ink boxes; large calendar numbers can overlap unused font ascent/descent without overlapping visible text. The prior text-first art is archived in `archive/returns-text-first`. Existing application-architecture diagrams use their original renderer. See [verification and review closure](returns-verification.md) for the evidence.
