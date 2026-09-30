# Building Prod with `koa-action`, Agent Graph and AgentScript

A customer asks an enterprise agent, “I want to return these headphones.” The agent needs to establish who is asking, match the purchase, interpret the request, and apply the merchant’s return policy. Loyalty status may change both the deadline and the shipping fee. Much of this work already has a precise answer in an identity service, an order record, or a business rule. Invoking a frontier language model to choose every next step adds expensive inference to a process whose dependencies are largely known.

**Disaggregated intelligence** separates those responsibilities and assigns each to a component with an explicit contract. A specialized model interprets a bounded question; a graph coordinates the work; authorized services establish facts and execute transactions. More demanding reasoning remains available where the customer’s situation requires it. This allocation makes reliability and cost part of the same architectural decision: the system can constrain consequential actions while reserving expensive inference for the uncertainty that remains.

In the Salesforce design developed here, `koa-action` is the System One model for focused judgments. Agent Graph supplies the managed Agentforce workflow runtime, and AgentScript configures how learned reasoning interacts with programmed control. “System One” describes the model’s intended role in making fast, narrow decisions; its correctness still needs to be evaluated for the task.

[LangChain’s *Building Prod with Jev and LangGraph*](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph) supplies the specialization argument behind this discussion, while [TypeSafe’s manifesto](https://typesafe.ai/manifesto) develops the idea of semantic judgments as composable software components. The Salesforce composition and merchant workflow below are proposed designs. These sources do not establish a native `koa-action` adapter, its training interface, or measured savings for this integration.

## Read the architecture through one return

The illustration compares two ways to process the same customer request. Both use the same authoritative services and must satisfy the same business requirements.

![Two product-return architectures with the same backend safeguards. The wrapper repeatedly invokes a frontier LLM to select the next step. The disaggregated graph performs mandatory service checks, uses koa-action or Jev for bounded semantic routing, and reserves frontier interpretation for complex cases after clarification and a policy precheck.](../diagrams/returns-comparison.svg)

*Figure 1. The allocation of decisions changes between the panels; backend authority stays fixed. Blue steps authenticate, verify the purchase, enforce policy, and create the return. The green decision node supplies a bounded semantic judgment. The secondary reasoning path rejoins the same policy checks before a return can be authorized. This is an architecture comparison, not a measured performance result. [Open the full-size vector illustration](../diagrams/returns-comparison.svg).*

On the left, a frontier model repeatedly selects the next action from the context accumulated so far. A service performs the action and returns its result, which becomes context for another model call. We call this illustrated design *wrapper intelligence*. The model still has no authority to authenticate the customer or waive a fee. A well-designed wrapper can enforce those requirements through its tools; the comparison concerns how often the model is asked to interpret state and choose the next step.

On the right, known dependencies are authored in the graph. Authentication precedes the protected order lookup, a matched purchase precedes policy handling, and an accepted quote precedes the write. A `koa-action` decision node classifies the customer’s meaning where language introduces uncertainty. Jev is an alternative example of this model role, with its own interface and behavior. It is not a drop-in Salesforce integration established by this illustration.

This is how procedural domain knowledge enters the graph’s topology—the arrangement of its nodes and transitions. The topology specifies which decisions occur, their prerequisites, and the context each receives. Current purchase facts remain in application records, policy rules remain versioned business logic, and semantic category definitions remain explicit model inputs. Salesforce’s [Agent Graph account](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/) describes this separation between workflow structure and the capabilities inside a node. The comparison with LangGraph is architectural; Agent Graph is Salesforce’s managed runtime with its own contracts.

## Give each step the evidence it needs

The return graph makes a useful distinction between trusted facts, model judgments, and progress through the workflow. A semantic route can change which question is asked next. It cannot rewrite who owns the order.

| Step | Evidence available to the step | Result it may establish |
| --- | --- | --- |
| Authenticate | The secure session and identity-service result. | Verified principal and permitted account access. |
| Match receipt | That principal, an order identifier, and authorized purchase records. | Owned order, item, delivery time, and available return quantity. |
| Route the reason | The conversation so far, relevant authorized case context, and category definitions. | A proposed `routine`, `unclear`, or `complex` semantic route. |
| Apply policy and fee | Verified purchase facts, membership tier, original request time, and policy version. | Eligibility, a reason for denial or hold, and a shipping quote if eligible. |
| Confirm and authorize | Trusted identifiers, accepted terms, current service checks, and a request key for retry handling. | The actual transaction outcome and a service-issued return ID. |

The first two steps run through trusted services. An uploaded receipt can help locate a purchase, but the order service must bind it to the authenticated customer and the requested item. Failed authentication leads to secure sign-in or an authorized support route. A receipt mismatch requires verification. Neither failure becomes a request for a more persuasive model interpretation.

The semantic node asks a narrower question: does the customer clearly want this ordinary return, is a necessary part of the request missing, or does the narrative require more involved interpretation? Those three labels are application definitions, not a claimed `koa-action` response schema. A routine result advances to policy. An invalid response or timeout takes a bounded retry and then human handling; a technical model failure does not establish that the customer’s request is complex.

Classification is the capability used here. Other focused decisions may use scoring against a rubric, semantic endpointing to assess whether a spoken turn is complete, or noul for a binary proposition such as whether cancellation was requested. [TypeSafe documents Noul’s numerical semantics](https://docs.typesafe.ai/primitives/noul) for Jev; the corresponding `koa-action` schema and calibration behavior are unspecified in the supplied public sources. These judgments need separate definitions and evaluations.

## Make eligibility and shipping explicit

Consider this **illustrative merchant policy**, invented for the example:

| Verified loyalty tier | Ordinary return deadline | Shipping for an eligible return |
| --- | --- | --- |
| Standard | Request received within 30 days after delivery, inclusive. | Customer pays $5. |
| Plus | Request received within 60 days after delivery, inclusive. | Waived. |

Both tiers require a returnable item and sufficient unreturned quantity. Membership comes from the authorized membership service, rather than a claim in the conversation. Missing or contradictory required facts leave the case pending verification; an unknown tier cannot silently become Standard. A required manual assessment also leaves the case pending. The policy includes no discretionary fee waiver or exception approval.

The policy service compares the original request-received timestamp with the delivery deadline in the merchant’s declared time zone. Preserving that request timestamp matters: clarification should not make an on-time request late. The graph retains the verified facts and the policy version that produced each decision.

An authenticated Standard customer returning an eligible item on day 18 receives a $5 shipping quote. A Plus customer making the same request on day 45 receives a waived-shipping quote. A Standard customer on day 45 is outside this ordinary policy. A longer explanation of that last request does not create eligibility, so it does not justify frontier escalation. These are worked cases, not observed customer outcomes.

For an eligible request, the customer confirms the item, quantity, and shipping terms. Declining the quote cancels the operation; no reply leaves it awaiting confirmation. The return service then rechecks access, the current policy and tier, and remaining quantity before committing. Changed terms require a new confirmation; a free label cannot silently become a paid one. The service uses an idempotency key—a stable identifier for this logical request—to coordinate retries. If a timeout leaves the write outcome unknown, the workflow reconciles that identifier before attempting another write.

Only a successful service result with a return ID and the confirmed shipping label reaches “return authorized.” A quote, an attempted write, and a queued review are different states. Warehouse inspection and any refund settlement occur later and are outside this example.

## Escalate the question that remains

The illustration’s side branch begins with clarification and inexpensive policy checks. An `unclear` or `complex` route permits one useful customer clarification, after which the workflow reassesses the request. If the answer makes it routine, it rejoins ordinary policy handling without frontier inference. This follows the broader pattern in [TypeSafe’s intent-routing example](https://docs.typesafe.ai/patterns/intent-routing): match the handler to the question the application needs answered.

Before any frontier call, the graph runs the known mandatory policy checks. Although the main policy box appears later in the illustration, the side branch reuses that procedure as a precheck. A known out-of-window request exits through the policy result. Required facts that remain missing or unverified go to verification or hold. The frontier model receives only a substantive interpretation problem that remains after those checks pass.

For example, an authenticated Standard customer on day 20 may describe a completed repair, an unresolved replacement offer, and a return they want only if the replacement cannot proceed. Any missing repair or replacement status first goes to verification or hold. Once the required status facts are established and ordinary eligibility checks pass, one clarification may still leave difficulty interpreting the conditional request and separating it from other outstanding commitments. The graph permits one scoped frontier interpretation attempt, using that verified history and the remaining question. A human validates its proposal, which is stored separately from trusted facts; a timeout or unusable result goes to human handling or hold.

If the reviewer can establish that an ordinary return is requested, verified information rejoins the same policy step and produces the same $5 quote. The reviewer has no policy-override authority in this teaching flow. If the intended outcome or a required fact remains unresolved, the case stays on hold. Any replacement inquiry remains recorded or is explicitly handed off; routing the return first cannot erase another requested task.

![Detailed illustrative return workflow, showing mandatory identity and receipt gates, clarification before frontier reasoning, human validation back into the same policy, Standard and Plus deadlines and fees, and confirmation followed by a verified service write.](../diagrams/returns-policy.svg)

*Figure 2. Read from the shared prerequisites through the optional interpretation lane, then apply policy and confirm the resulting quote. Standard day 18 and Plus day 45 illustrate eligible requests with different shipping terms; Standard day 45 illustrates a known denial. Missing facts remain pending, and an uncertain write is reconciled before retrying. All tiers, deadlines, fees, and cases are hypothetical. [Open the full-size policy illustration](../diagrams/returns-policy.svg).*

The routine path can use standard customer messages and confirmation templates to finish without frontier reasoning. Any generated customer-facing copy is an additional design choice and belongs in the cost accounting. Specialization reduces unnecessary reasoning only when the workflow actually avoids that work.

## Configure guided determinism with AgentScript

Neuro-symbolic reasoning combines learned language interpretation with explicit software state and rules. AgentScript is the authoring layer for that combination in Agent Graph. Guided determinism constrains where an uncertain judgment can affect execution; it does not make the judgment infallible.

The [AgentScript control-plane article](https://www.salesforce.com/blog/agent-script-control-plane/) describes typed state, action-input bindings, and `available when` conditions that filter the actions offered during model reasoning. In this proposed workflow, mandatory authentication and policy procedures execute through authored control logic. Merely making an action available does not ensure that a model selects it or completes it. Consequential identifiers and entitlements must come from trusted service outputs, with writes to those fields restricted accordingly.

Salesforce’s [enterprise-agent engineering discussion](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/) likewise places identity verification ahead of controlled transactional work. The backend still enforces its own requirements when creating the return. AgentScript’s [open repository](https://github.com/salesforce/agentscript) provides language tooling; the managed execution runtime is separate. A useful implementation review therefore checks both the authored graph and the services it invokes.

## Account for the whole service path

The economic hypothesis is that replacing repeated frontier decisions with bounded interpretation and authored transitions avoids more work than the new components add. Avoiding those calls may also shorten the routine path’s response time. The same structure makes permitted transitions easier to predict and inspect. Semantic accuracy and repeatability remain empirical questions: a smaller model can make the same mistake consistently, and an explicit graph can contain a wrong rule.

Choose a frequent bounded decision that changes downstream work. If most requests still invoke the same frontier model immediately afterward, the new classifier may only add a round trip. Excessive clarification or a poorly chosen escalation gate can move the expense into customer effort and human queues. Tightly coupled reasoning may be cheaper to keep together when splitting it discards needed context.

For a pilot, measure observed operating cost per incoming case over a declared service window. Count the case once, while adding all its follow-up work: specialized decisions, frontier calls, tools, runtime usage, retries, reconciliation, and measured human handling at stated rates. Report correct completion and automated coverage—the fraction handled without escalation—beside cost and latency. Keep outstanding obligations visible when the window ends.

Report labeling, supported adaptation, integration, and maintenance investment separately. A total-cost estimate must allocate that investment over a stated volume and horizon and account for work continuing beyond the pilot. Use the same boundaries for the wrapper and disaggregated systems, including equivalent backend safeguards and customer service requirements. Fewer frontier calls establish the proposed mechanism; lower operating cost per incoming case must be measured.

## Train and test without losing the evidence

Begin by changing the bounded routing decision while holding the surrounding workflow fixed. Reviewers label `routine`, `unclear`, or `complex` using only the evidence available at that decision and adjudicate disagreements. Retain requests that combine returns with other tasks. Preserve a versioned source snapshot with record order, timestamps, case relationships, and a manifest linking derived examples to their origins.

Each model input stops at the decision time. A later customer answer can support a later decision snapshot or an outcome label, but cannot leak into the initial route input. For semantic endpointing, the same principle excludes future audio from the prefix being evaluated. These boundaries preserve what the deployed component could actually have known.

![Proposed task-development pipeline: related records are split before augmentation, training and development produce frozen artifacts for a locked test, and a controlled service pilot precedes rollout. Reviewed production feedback enters a later dataset.](assets/training-pipeline-final.svg)

*Figure 3. Proposed task development and validation. Preserve source records and decision-time inputs, split related examples before augmentation, and freeze the model configuration and gates before the locked test. A controlled service pilot then evaluates the complete workflow. This is not a description of `koa-action` pretraining.*

Group related and duplicate cases before assigning partitions; generated variants stay with their sources. Use account groups for an unseen-account claim or a later-time cohort for a future-traffic claim, documenting boundary exclusions. Preserve the source records and their relationships while recording changes introduced by redaction, filtering, or resampling. Those transformations may change the distribution, so retaining the original data does not mean claiming that every derived dataset has an unchanged shape.

Fit learned preprocessing and any supported adaptation on training data. If direct `koa-action` adaptation is unavailable, develop the fixed model’s application configuration. [TypeSafe documents confidence as a summary of distribution concentration](https://docs.typesafe.ai/confidence); its relationship to correctness still needs local validation. Where numerical gates are supported, separate calibration fitting from threshold selection within development data, then freeze the decision definitions, transformations, model configuration, and workflow policy. Reviewed production feedback enters a later dataset; tuning requires fresh untouched evidence for a new performance claim.

## Test reliability and cost together

A correct return outcome may be an authorization under confirmed terms or a justified denial. A plausible explanation alone does not complete the work. Define a failed case as an incorrect outcome or a requested task unresolved by a fixed service deadline, and track pending verification, abandonment, and accepted handoffs separately. The unresolved replacement inquiry in the complex example still counts. Measure consequential errors, such as an unauthorized return or an unconfirmed fee, across incoming cases and within predeclared relevant cohorts identified independently of either system’s chosen routes.

Before testing, declare the maximum tolerable increase in failed-case rate and the minimum worthwhile operating-cost saving per incoming case. The joint null hypothesis is that quality loss reaches the allowed margin or savings do not exceed the required gain. To accept the candidate, the upper uncertainty bound on quality loss must fall below the margin and the lower bound on savings must exceed the target. Separate consequential-error and latency limits must also pass. A nonsignificant quality difference cannot establish acceptable equivalence.

A paired offline comparison first asks `koa-action` and a frontier model the same routing question on the same held-out snapshots. Hold graph structure, authorized facts, and available actions fixed, selecting any numerical gates separately on development data under the same quality constraints. Measure decision errors and client-observed call cost and latency, including retries. This isolates the model substitution; it does not establish the benefit of changing the entire architecture shown in Figure 1.

The workflow comparison requires a controlled service pilot because replay cannot reveal how different routes affect real customers or review queues. Randomize assignment by case or account group, retain that assignment, and use the same observation horizon and merchant policy. Record operating cost, correct completion by the deadline, and time to completion with unfinished cases accounted for. Address queue-capacity differences or interference between groups. Set sample size and uncertainty methods in advance, respecting related cases and the groups assigned together. Repeating one conversation measures repeatability, not new customer situations.

No comparative results are reported here. If the evidence cannot exclude unacceptable quality loss or establish the required saving, the proposed allocation has not earned broader rollout.

## Let failures identify the next change

Suppose the conditional return is authorized while the replacement question disappears. If the semantic output was `routine`, inspect its decision-time context and category definition. If it was `complex`, inspect the transition or state update that lost the pending task. An incorrect shipping fee points to membership evidence, policy execution, or quote handling. An unknown write recorded as success points to transaction reconciliation. These failures require different changes, even when the customer sees the same unsatisfactory outcome.

Preserve the failing case and replay the corrected path before another evaluation. Offline judges can help prioritize traces, as illustrated by [LangSmith’s evaluator integration](https://www.langchain.com/blog/jev-is-now-available-in-langsmith-evals), but [repeatable judging does not establish correctness](https://www.langchain.com/blog/jev-agent-evals-langsmith). Review apparent automated successes as well as escalations using independently adjudicated labels. Post-run feedback cannot prevent a transaction that already occurred.

Disaggregated intelligence makes the allocation of reasoning inspectable and revisable. `koa-action` supplies a focused judgment; AgentScript and Agent Graph give that judgment a controlled place in the business process. In the return example, the practical test is whether the customer reaches a correct outcome under the merchant’s policy, every requested task remains accounted for, and the complete service path meets its cost and latency requirements. Frontier reasoning earns its place by resolving difficult remaining interpretation, while routine work follows the structure the enterprise already knows.
