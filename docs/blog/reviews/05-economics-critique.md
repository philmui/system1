# Version 05: economic thesis and reliability

The latest theme is disaggregated enterprise reasoning that preserves reliability while controlling cost. Version 05 still makes latency the primary benefit and relegates cost to a complementary measure. Reframe the introduction, evaluation, and conclusion around a proposed economic hypothesis, without claiming measured Salesforce savings.

## Explain where savings could come from

Assign bounded interpretation to `koa-action`, explicit workflow control to Agent Graph and AgentScript, and difficult explanation or reasoning to an appropriate model. A specialized decision can avoid an expensive call or unnecessary reasoning loop. It also adds inference, integration, and monitoring work. The design saves money only when avoided downstream work exceeds these additions and any extra fallback burden.

More components do not automatically improve reliability. Errors may be correlated, and each new boundary can introduce missing context or incorrect state. Explicit contracts make failures easier to locate; end-to-end evaluation establishes whether outcomes improve.

## Make cost and reliability the joint release criteria

Count each incoming service case once in the denominator; retries add costs, not new cases. Measure mean total cost per attempted case alongside the fraction with an incorrect outcome or any task unresolved at the fixed service deadline. Include every attempt, including failures, escalations, and abandonment.

Cost includes all model calls, tool and runtime work, retries, and measured human handling at declared rates. Include annotation, adaptation, integration, and ongoing operational effort through a stated amortization volume and horizon, or report those fixed costs separately and call the comparison operating cost. A smaller token bill alone does not establish lower total cost.

For the review record, let `p` denote case-failure probability and `μ` mean cost per case. Predeclare a maximum quality-loss margin `δ` and minimum worthwhile cost saving `g`:

```text
H₀: p_candidate − p_baseline ≥ δ
    OR μ_baseline − μ_candidate ≤ g
```

Release requires the upper uncertainty bound for quality loss below `δ` and the lower bound for saving above `g`. Failure to detect a quality difference is insufficient. Retain separate gates for consequential errors and a latency/service-level constraint; cost reduction cannot compensate for violating them. The blog can express this rule in prose instead of displaying the notation.

Compare the same service scope, permissions, and offered workload. Offline paired routing replay can estimate component quality and call cost. Human workload, changed customer behavior, and complete service outcomes require a controlled pilot. Estimate uncertainty at the assignment/dependence unit, such as account groups; repeated calls or paraphrases are not additional independent cases.

## Explain when to keep work together

Avoid splitting a decision when it shares essential context with the next step, already costs little, or usually falls through to the same expensive handler. Decomposition is also a poor economic choice when another round trip violates the latency budget or human fallback consumes the apparent savings. Start with a frequent, bounded decision whose avoided work can be measured, and expand only after the joint comparison passes.
