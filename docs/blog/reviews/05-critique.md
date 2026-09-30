# Strategic critique of version 05

Reviewed `05-building-prod.md` under the user's updated instruction: the main theme is disaggregated intelligence for enterprise agentic reasoning, motivated by reliability and cost control. Earlier evidence and workflow corrections remain valid, but the organizing premise must change. Version 05 currently presents a routing experiment whose primary expected benefit is lower latency. That is too narrow for the revised thesis.

## 1. Put allocation of reasoning at the center

Replace the opening routing hypothesis with a clear architectural proposition. Enterprise workflows contain different kinds of work: uncertain interpretation, open-ended reasoning, exact rule evaluation, and authorized execution. Disaggregated intelligence means assigning each operation to a component whose contract fits that work, then making the boundaries observable.

Present the invoice-and-outage case immediately afterward as a demonstration of this division. `koa-action` handles the bounded intake judgment; a generative model explains unusual charges or works through an unfamiliar issue; configured runtime logic retains both requests; trusted services determine what the caller may access or change. A human receives cases requiring authority or judgment outside the automatic path.

Explain why this matters commercially: repeated semantic decisions can consume model budget, while errors at state or action boundaries can create rework and expensive escalation. The actual savings remain a hypothesis for measurement. Avoid asserting that smaller models, more components, or disaggregation inherently produce lower cost or correct outcomes. The reliability benefit comes from explicit responsibilities and enforceable boundaries, supported by evaluation.

## 2. Show the full division of work before zooming into routing

Add a compact allocation table or equivalent connected prose before the detailed contract:

| Work in the proposed service system | Responsible component | What the boundary accomplishes |
| --- | --- | --- |
| Bounded semantic judgments | `koa-action` | Supplies a constrained decision that the workflow can validate. |
| Open-ended reasoning and explanation | A suitable generative model | Handles work whose useful response cannot be fully enumerated in advance. |
| State, sequencing, and allowed transitions | Agent Graph | Preserves task obligations and coordinates execution. |
| Authored decision and action rules | AgentScript | Configures where model choice is available and where explicit procedure governs. |
| Exact records, permissions, and transactions | Trusted services | Establishes authoritative facts and enforces business actions. |
| Exceptional authority or unresolved ambiguity | A human review path | Retains accountability where automatic handling has not been justified. |

Keep Agent Graph and AgentScript distinct: one executes the managed workflow, and the other expresses its configuration. Calling the whole runtime deterministic would erase the model-driven reasoning it coordinates. Guided determinism describes the authored constraints around those decisions.

The existing routing contract then becomes one example of a reusable allocation pattern. Its value is that readers can apply the same reasoning to scoring, noul, semantic endpointing, and later service decisions, without assuming those capabilities share an API or an evaluation result.

## 3. Make reliability acceptance primary and whole-workflow cost the economic test

Rewrite the evaluation premise. The candidate first has to satisfy the declared service-quality limit and consequential-action gates. Among candidates that meet those conditions, test whether the proposed allocation reduces the total cost of handling the same workload. Treat latency as an operational constraint or secondary outcome rather than the main motivation.

Count the work that the allocation actually causes: decision and generative calls, retries, tool and runtime execution, review effort, and corrective work. A lower price per classification can be overwhelmed by more fallbacks or human handling. Use consistent cost accounting across comparison arms; no price or savings estimate is available from the supplied evidence.

Keep cost per attempted case together with the fraction of cases completed and harmful-error measures. Cost per successful case alone can hide abandoned requests; cost per attempt alone can reward doing very little. The same two-request example explains this problem more clearly than another abstract qualification.

Component replay still isolates the bounded decision change. The controlled service pilot establishes whether that change improves the economics of the full process at acceptable reliability. Neither experiment should be described as already performed.

## 4. Let methodology support the architectural argument

Preserve the training illustration and the leakage controls developed through earlier reviews, but shorten their main-text treatment. Decision-time evidence, grouped partitions, development-only tuning, and a locked test are the minimum conditions for trusting a component comparison. The article need not develop every reporting detail before returning to its central idea.

Retain the dropped-outage debugging example. It is now especially valuable: an incorrect semantic result calls for examination of the decision component, while a lost task after a correct `mixed` result points to state-transition logic. Correcting the responsible component demonstrates what disaggregation buys the engineering team.

End with the architecture's enterprise consequence: teams can decide which work warrants specialized judgment, which requires generative reasoning, and which must remain under explicit rules and accountable authority, while testing the cost of the complete service outcome. Avoid ending with only a recommendation to optimize another classifier.

## Preserve intentionally

Keep the source attribution, proposed-integration disclosure, confidence-versus-correctness distinction, authorization boundary, and original customer-service example. Do not add imported benchmarks, invented economics, a claim that `koa-action` replaces generative reasoning, or a universal claim that the proposed allocation is already necessary or sufficient for reliable production systems.
