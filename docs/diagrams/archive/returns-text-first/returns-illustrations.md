# Product returns: two ways to allocate intelligence

The comparison follows one request through authentication, receipt matching, interpretation, policy and shipping, and return authorization. Both architectures rely on the same service-enforced rules. Their difference is the allocation of model inference: a frontier model selects each next step on the left; an authored graph and a bounded System One decision handle the routine path on the right.

- **Architecture comparison:** [editable SVG](returns-comparison.svg), [outlined SVG](returns-comparison.outlined.svg), [PNG preview](returns-comparison.png), [vector PDF](returns-comparison.pdf).
- **Policy and fallback detail:** [editable SVG](returns-policy.svg), [outlined SVG](returns-policy.outlined.svg), [PNG preview](returns-policy.png), [vector PDF](returns-policy.pdf).
- **Presentation:** [version 03 HTML](../slides/03-disaggregated-intelligence.html), [PowerPoint](../slides/03-disaggregated-intelligence.pptx).
- **Worked explanation:** [blog version 08](../blog/08-building-prod.md).

The policy is invented for teaching: Standard requests received within 30 days after delivery cost $5 in return shipping; Plus requests within 60 days have shipping waived. Both require verified ownership, a returnable item, sufficient remaining quantity, and confirmation of the shipping quote. Acceptance means the backend has issued a return authorization, not that a refund has settled.

The optional reasoning branch first seeks a useful clarification and checks known policy constraints. Missing evidence stays pending, and known ineligibility declines the ordinary request. Only residual semantic complexity can reach the frontier model. Its proposal goes through human validation and the same policy step. Neither a model nor the reviewer has a policy-override mechanism in this example.

`koa-action` uses the capability framing supplied in the brief. Jev is another example of a specialized decision model, with separate documented interfaces. The figures propose a composition; they do not establish a native adapter, measured inference advantage, or production deployment. The [complete workflow specification](returns-workflow-spec.md) records the branch contracts and six worked cases.

The conceptual basis is Salesforce’s [Agent Graph discussion](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/) and [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/), together with [LangChain’s Jev and LangGraph example](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph) and [TypeSafe’s intent-routing pattern](https://docs.typesafe.ai/patterns/intent-routing). The merchant policy, diagrams, and worked cases are original teaching material.

The original SVGs retain text and embed Manrope and IBM Plex Mono for browser portability. The PDFs preserve vector artwork and embedded font subsets. A separate outlined SVG export is supplied for editors that do not support embedded web fonts. Color is supplemented by labels, model capsules, service cards, and distinct fallback connectors. Every original SVG has a title and full text alternative.

Rebuild the main artwork with `python3 docs/diagrams/build_returns.py`, then run `node docs/diagrams/export_returns.mjs` for browser-rendered PNG/PDF exports and text geometry checks. The slide views have separate generators beside these files. Existing application-architecture diagrams use their original renderer and are unaffected.
