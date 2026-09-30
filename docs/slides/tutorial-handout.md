# Tutorial handout and speaker notes

Disaggregated intelligence assigns bounded semantic judgments to focused models and gives an authored runtime responsibility for coordinating the work. In the proposed Agentforce design, `koa-action` interprets familiar requests, Agent Graph preserves state and executes the routes, and AgentScript authors their controls. Trusted services retain facts and transaction authority. Frontier reasoning is available for interpretation that still needs it after the defined gate.

Version 05 has **36 slides and 39.6 minutes of planned narration**, leaving **5.4 minutes** for demonstrations and discussion in a 45-minute session. The [source ledger](research/source-ledger.md), [current source check](research/v5-throughline-source-check.md) and [blog 09](../blog/09-building-prod.md) record the evidence and design boundaries. The presentation frame follows the [supplied Salesforce styling reference](research/v5-salesforce-style.md); its workflow insets retain simple pastel vector objects.

## One customer case to follow

“Exchange these headphones and return the spare cable.” Purchase records establish that the cable was purchased separately. System One proposes two AND tasks; the graph retains both. The cable’s return concerns a whole purchased item. A cable included inside the headphone kit would instead require component scope and the applicable kit policy.

Slides 06–09 separate the shared access gates, familiar request routes, reasoning gate and whole-item policy. Secure sign-in returns to an authoritative identity recheck. A clear exchange or component request can use its configured handler directly. Missing evidence, an unsupported handler and unresolved interpretation have different routes.

The eight-event trace on slide 20 ends with an **Authorized** exchange and an **Active** cable return. The latter still needs its policy, confirmation and authorization. At the defined service deadline, an unfinished AND obligation makes the case incomplete. OR/IF alternatives follow the customer’s actual choice or condition; an inactive alternative is unselected or untriggered rather than unfinished work.

## The artifact to build

Choose a frequent semantic decision that changes downstream work, then draft its contract before selecting integration bindings.

| Part | Your artifact | Example in this tutorial |
| --- | --- | --- |
| Question | A bounded judgment with clear application fields | Identify remedy, purchased-unit scope and interpretation status. |
| Boundary examples | Evidence and justified labels | A separately purchased cable is a whole item; a cable inside the headphone kit is a component. |
| Input view | Relevant evidence available at decision time | Conversation prefix and verified candidate items. |
| Graph control | Required predecessor, supported mapping and failure route | Verified identity precedes protected purchase lookup; unclear meaning leads to useful clarification. |
| Task state | Obligations, alternatives, conditions and actual results | Preserve the cable return while the exchange runs; never commit both sides of an OR choice. |
| Acceptance | Whole-case outcome, horizon and quality/cost/latency limits | An authorized exchange with an active cable return remains incomplete at the deadline. |

AgentScript’s procedure, action-availability and argument-binding constructs support authored control. The slide sketch is language-neutral pseudocode, not runnable AgentScript or a documented `koa-action` adapter. Its required checks also belong in the authoritative service.

## Demonstration guide

The examples use constructed teaching data and call no model or service endpoint.

| Example | State to inspect | Lesson |
| --- | --- | --- |
| Aftercare trace | Exchange quote → customer confirmation → service authorization; cable return then Active | Confirmation and a service result differ, and one successful task cannot erase another. |
| Confidence gate at 0.75 | 7/12 auto-routed; 2/7 wrong; 5 reviewed | Routing coverage and error have different denominators. |
| Confidence gate at 0.99 | Only the high-scoring wrong example is auto-routed | A stricter threshold need not remove the error. |
| Confidence gate at 1.00 | No accepted routes; automatic error undefined | An empty accepted set is not evidence of zero error. |
| Routing cost at 20% fallback | 0.27 units versus 1.00 | Avoided frontier work can exceed added decision and runtime work. |
| Routing cost at 93% fallback | 1.00 units | Break-even for these invented assumptions. |
| Routing cost at 100% fallback | 1.07 units | The additional decision can increase cost. |
| Exchange exercise | Identity, purchase, exchange policy, stock, terms and confirmation precede the write | A semantic signal supplies no transaction authority. |

The cost sketch uses G = 1 for the replaced frontier routing call, D = 0.03 for specialized judgment and O = 0.04 for added orchestration. Candidate routing cost is D + O + pG. Later messages, business services and human work are excluded from this small calculation and must enter whole-case accounting. The review queue in the gate example and the frontier fallback in the cost example are distinct destinations.

Routing coverage counts accepted decisions at one gate. Case automation counts incoming cases completed by the deadline without staff handling. A frontier fallback can still be automatic, and an accepted route can leave the case unresolved. Training inputs stop at the decision-time boundary; related cases and their variants stay together when data are split. A controlled service pilot is required to support complete-workflow claims.

PowerPoint uses static teaching states: the trace’s final unfinished case, a 0.75 threshold, 20% routing fallback and a revealed repair. Speaker notes retain the other states and their meanings. The HTML supplies the interactive controls. Current static-state tests and rendering checks are described in [verification](verification.md), separately from browser tests performed for older editions.

The [component library](assets/components-v5/README.md) retains reusable SVG sources. The current PowerPoint has native editable text, drawing shapes and named groups on all 36 slides, including the reusable vocabulary on slide 36. Move a node and its caption together, then reposition its arrows. Labels and policy values can be edited directly in PowerPoint. The [editing guide](EDITING-V5.md) explains grouping, typography and the open-font pack.

## Slide-by-slide speaker notes

These notes are generated from the current 36-slide source so slide order, timing, transitions and source references remain consistent with the deck.


### 01. Disaggregated intelligence

**Purpose:** Introduce disaggregated intelligence as an engineering allocation problem. **Suggested time:** 0.7 min.


Disaggregated intelligence assigns different jobs to components suited to them. Services establish facts and authority; specialized models supply bounded semantic judgments; the runtime coordinates the resulting work.

For Agentforce, AgentScript authors the controls, Agent Graph executes the workflow, and koa-action supplies focused decisions under an evaluated application contract. Frontier reasoning remains available for difficult interpretation.

Choose the least expensive component that meets the decision’s quality and latency requirements, then measure the whole service. Reliability, predictability, lower cost and faster inference are the goals; their realized gains require evidence.

System One names a model role here, not human cognition. This composition is proposed: public sources reviewed do not establish a koa-action SDK, native adapter, training interface or benchmark.

**Transition:** Follow one product-aftercare case from authority checks to complete-case evaluation.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/), [Composable AI](https://typesafe.ai/manifesto), [Jev + LangGraph](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph).


### 02. Four benefits. One service to measure.

**Purpose:** Connect requested benefits to concrete mechanisms. **Suggested time:** 1 min.


Specialization creates an opportunity for much lower decision cost and faster inference when a bounded task does not require frontier reasoning. The workload and accepted error rate determine the gain.

Agent Graph makes permitted paths and recovery behavior inspectable, while AgentScript expresses the controls around model choice. Required service checks still execute. Predictable control does not itself establish semantic correctness.

Keep the complete customer case as the unit of value. A fast exchange route that loses the requested cable return fails the service, even if its local classifier is accurate.

**Transition:** Follow one case through the rest of the tutorial.

**References:** [Jev + LangGraph](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph), [Composable AI](https://typesafe.ai/manifesto).


### 03. One customer, two obligations

**Purpose:** Establish the recurring case and its invariant. **Suggested time:** 1.1 min.


The purchase records establish that the spare cable was purchased separately, so its return concerns a complete purchased item. A cable removed from the headphone kit would require the component handler instead.

The customer asks for an exchange AND a cable return. Preserve both obligations and their item references; finishing the first cannot erase the second.

This case is a constructed teaching example. Later we will stop the trace after an exchange authorization while the cable task is active, so the whole case remains unfinished.

**Transition:** Assign an owner to each kind of work.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/).


### 04. Give each responsibility an owner

**Purpose:** Distinguish models, execution, configuration, and authority. **Suggested time:** 1 min.


The throughline is allocation plus coordination. koa-action supplies a bounded interpretation; Agent Graph coordinates task state and escalation; AgentScript configures the controls that constrain each judgment’s effect.

Backend services establish identity, ownership, stock and policy outcomes. They also enforce their requirements when writing. A high model score cannot substitute for any of these results.

A clear exchange or kit-component return may use System One and a configured handler without frontier reasoning. A request can have many business steps while remaining easy to interpret.

The human branch handles configured review and unresolved cases. A reviewer’s interpretation does not invent a missing handler or confer policy-override authority.

**Transition:** Now move process rules from prose into inspectable structure.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/).


### 05. Process knowledge becomes topology

**Purpose:** Teach which decisions, in which order, over which state. **Suggested time:** 1 min.


Procedural domain knowledge enters topology: the nodes and transitions specify what runs first, which evidence each step sees and where it can go next.

The small graph previews the shared front desk. Verified identity allows protected purchase lookup. Missing sessions, rejection and unavailable services have distinct routes, expanded on the next illustration.

Live purchase facts remain in application records, business policy remains explicit code or configuration, and category definitions remain in the semantic node’s context. Moving process dependencies into a graph does not eliminate these inputs.

Review the graph itself. It can consistently encode an incorrect policy or accidentally lose a requested task.

**Transition:** Expand the front desk, then follow three familiar request types.

**References:** [Jev + LangGraph](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph), [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/).


### 06. Start with identity and an owned purchase

**Purpose:** Separate authoritative access gates from the choice of model allocation. **Suggested time:** 1.2 min.


Follow the shared front desk before comparing models. The identity service supplies a result. Verified access permits protected purchase lookup; neither model grants authentication.

The no-login branch goes through secure sign-in and returns to the same identity check. The denied branch stops protected work and can offer permitted account support. A service outage also holds or takes bounded recovery; unknown does not mean verified.

The matched purchase binds owned line items to the authenticated customer. Missing identifiers or a mismatch go to purchase verification and recheck. Only a verified purchase reaches page B; item or kit-component binding can still need clarification there.

Both architecture choices retain these safeguards. In the selected wrapper design, frontier inference proposes the next step around each service result. In the disaggregated design, authored transitions carry the known process and call a small decision model only for bounded meaning.

Agent Graph coordinates execution and state. AgentScript configures the control. This is an architectural comparison with LangGraph, not an API compatibility claim or a hosted LangGraph implementation. More predictable transitions create an opportunity for cheaper, faster handling; measurement must establish the gain.

**Transition:** With access and purchase established, identify the requested remedy and affected unit.

**References:** [Reliable enterprise agents](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/), [Jev + LangGraph](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph), [Access and allocation · A](../diagrams/returns-comparison-access.svg).


### 07. Give familiar requests a direct service route

**Purpose:** Show that a familiar exchange or kit-part return can use bounded judgment and a configured service route. **Suggested time:** 1.4 min.


The small chip answers bounded questions: what remedy is requested, which owned item or kit component is affected, and whether the meaning is clear enough. An authored supported-combination mapping chooses a handler. The three pictured mappings are whole-item return, whole-item exchange and kit-component return.

The open headphone kit means the complete purchased product; the highlighted cable means one component of that kit. A spare cable purchased as its own line item is an ordinary whole-item return. In the ongoing two-task case, the purchase service has established that the spare cable was bought separately.

A clear exchange goes to exchange rules and inventory. A clear kit-component return goes to component identity and kit-part rules. Both can be handled without frontier interpretation. Their terms are independent of the whole-item return policy on the later calendar slide.

The graph follows only registered handlers. Component exchange is a different combination; if the merchant has not registered it, configured specialist handling receives the correctly understood request. Neither model invents a policy or supported route.

The eligible-quote junction describes a common finish for each selected task. It does not merge their rules. Confirm the exact action and terms; the service rechecks before issuing the corresponding authorization. Missing facts hold and known ineligibility follows the affected handler.

Clarification can settle an ambiguous item or remedy and return to reassessment. Only meaning that remains unresolved can enter reasoning gate C. Keep AND obligations, OR choices and IF conditions. An exchange for blue if in stock, otherwise return, can be authored logic: unknown stock holds, and only the selected alternative may commit.

**Transition:** Expand the exception path and examine what must hold before frontier interpretation is useful.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/), [Intent routing](https://docs.typesafe.ai/patterns/intent-routing), [Bounded request routes · B](../diagrams/returns-comparison-routing.svg).


### 08. Reserve frontier reasoning for unresolved meaning

**Purpose:** Make the frontier model a scoped interpretation resource with explicit preconditions and a guarded return path. **Suggested time:** 1.5 min.


The verified-access and purchase label is a precondition. Read the green route first: clear meaning reaches the authored mapping and its appropriate handler. An unsupported combination goes to configured specialist handling rather than an invented route.

The detour first asks one useful clarification. If that resolves the meaning, reassess the task and follow its handler without frontier reasoning. More business steps, an exchange, a component request, or a familiar if-condition does not itself make interpretation difficult.

Facts and checks are branch-aware. Obtain missing evidence from authoritative services; hold when it cannot be obtained. Apply known mandatory rules for the affected handler. A whole-item return deadline does not globally reject an exchange or kit-component request.

Only substantive interpretation that remains after clarification, with the relevant facts and known checks satisfied, reaches one scoped frontier attempt. It receives the authorized history and remaining question, then proposes a task structure; it does not replace service facts.

A human validates item references and AND, OR and IF relationships, or holds the case. Validated interpretation re-enters the same supported-combination mapping and the applicable handler. Neither human validation nor model output grants a policy override.

Only an eligible selected task reaches confirmed terms and an authoritative service write. Bound technical recovery, reconcile an unknown write outcome, and retain every unfinished obligation. Measure the cost of this detour, including any added review, in whole-case evaluation.

**Transition:** Scope a concrete policy to one handler so that its rules cannot spill into other remedies.

**References:** [Intent routing](https://docs.typesafe.ai/patterns/intent-routing), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/), [Reasoning gate · C](../diagrams/returns-reasoning-gate.svg).


### 09. Whole-item returns follow their own policy

**Purpose:** Separate trusted eligibility and fee rules from semantic interpretation and from transaction success. **Suggested time:** 1.2 min.


The scope label matters: this invented merchant table applies only to whole-item returns. A separate service owns exchange rules; kit-component returns have their own rules and terms. These values are not Salesforce product policy.

A verified owned purchase provides the delivery time, original request time, loyalty tier, item eligibility and available unreturned quantity. Missing or contradictory required facts stay pending. Keep the original request timestamp through retries and handoffs.

Standard permits an eligible request within 30 days inclusive and quotes five-dollar shipping. Plus permits 60 days inclusive and waives shipping. Standard day18 and Plus day45 can qualify if the other rules hold; Standard day45 fails this ordinary return window.

Confirm the specific items, quantity and quote. The backend rechecks authority, policy and accepted terms before recording an idempotent return authorization. Changed terms require renewed confirmation; a label in this drawing means authorization, not completed shipping or settled refund.

A known rule failure does not justify a frontier appeal. A separate eligible task can continue under its own policy while the declined task retains its outcome. This scoped service authority makes the authored route predictable.

**Transition:** Now connect the illustrated application to the runtime, authored controls and model contracts beneath it.

**References:** [Whole-item return policy](../diagrams/returns-whole-item-policy.svg), [Tutorial evaluation protocol](../blog/09-building-prod.md).


### 10. A runtime sits beneath the harness

**Purpose:** Prevent runtime/harness/configuration conflation. **Suggested time:** 1 min.


Once judgments and services are separated, the runtime coordinates state and decides which configured step executes next. Agent Graph occupies that runtime role in Agentforce.

AgentScript authors the controls around model choice. The wider agent harness also includes context strategy, tools, operational policy and recovery.

LangChain’s distinction among its framework, LangGraph runtime and Deep Agents harness provides an architectural analogy. It does not imply LangGraph API compatibility or Deep Agents defaults in Agentforce.

The public AgentScript repository contains language tooling; Salesforce’s managed runtime is a separate component.

**Transition:** Define the first decision before selecting its integration.

**References:** [Runtime, framework, harness](https://www.langchain.com/blog/deep-agents-vs-langchain-vs-langgraph), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/).


### 11. Separate the remedy, the unit and the uncertainty

**Purpose:** Give a bounded task a testable contract. **Suggested time:** 1 min.


Separate requested remedy, purchased-unit scope and interpretation status. Exchange does not mean difficult; a whole-item return can still be ambiguous.

The three familiar supported combinations shown earlier are whole-item return, whole-item exchange and kit-component return. These examples are not an exhaustive provider taxonomy. A component exchange is one request, supported only if its own handler and policy are configured.

Tie every task to verified candidate items and preserve AND, OR and IF relationships. AND retains every obligation; OR waits for a choice; IF evaluates the customer’s actual condition using authoritative facts.

These are conceptual application fields, not a documented koa-action response schema. A timeout or malformed result uses bounded technical recovery and must not default into a transaction.

**Transition:** Match the question to the right primitive.

**References:** [TypeSafe quickstart](https://docs.typesafe.ai/introduction/quickstart), [Intent routing](https://docs.typesafe.ai/patterns/intent-routing), [Structured decision criteria](https://docs.typesafe.ai/primitives/advanced).


### 12. Four bounded decisions, four contracts

**Purpose:** Cover the four user-specified koa-action capabilities. **Suggested time:** 1 min.


This tutorial uses koa-action for classification, noul, scoring, and semantic endpointing, following the capability framing supplied for the Salesforce composition.

TypeSafe documents analogous decision concepts, but its SDK fields, batching, calibration, and training claims do not define a Salesforce interface.

Each primitive needs its own target and error measure. A rubric score and the probability of a binary proposition are not interchangeable.

**Transition:** Make that semantic distinction tangible.

**References:** [TypeSafe quickstart](https://docs.typesafe.ai/introduction/quickstart), [Noul](https://docs.typesafe.ai/primitives/noul), [Score](https://docs.typesafe.ai/primitives/score).


### 13. Probability and intensity answer different questions

**Purpose:** Explain binary proposition estimates versus severity rubrics. **Suggested time:** 1 min.


TypeSafe’s Noul is the probability of the yes answer; its Score uses ordered rubric levels and can be fractional.

A mean rubric score can hide different distributions. Preserve the output meaning that the downstream rule actually uses.

The corresponding koa-action fields, ranges, and calibration require their own verified contract. No numeric Salesforce response is shown here.

**Transition:** A decision about when to respond has an additional time boundary.

**References:** [Noul](https://docs.typesafe.ai/primitives/noul), [Score](https://docs.typesafe.ai/primitives/score).


### 14. Endpointing is a decision in time

**Purpose:** Explain semantic endpointing and temporal leakage. **Suggested time:** 1 min.


Imagine the spoken request: Exchange these headphones … and return the spare cable. Ending the turn at the pause can drop the second obligation before the routing model sees it.

The waveform is illustrative. Semantic endpointing asks whether the spoken turn has ended using only the available audio prefix. Future speech may establish the reference label, but must not enter the earlier input.

Measure premature cutoff and delay separately. Keep all prefixes from a conversation together when splitting data; a fast endpointing call still needs the right decision-time evidence.

**Transition:** Next decide which decisions may run in parallel.

**References:** [Building with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one).


### 15. Split work along information dependencies

**Purpose:** Separate execution independence from causality. **Suggested time:** 1 min.


Two bounded questions may read the same authorized snapshot without depending on one another’s output. This is a workflow-design pattern, not a claim about native koa-action batching.

A task that needs a new service fact must wait. Protected purchase retrieval follows verified identity; selecting an affected item depends on the authorized candidate list.

Independent execution does not imply statistically independent errors. Missing context can affect remedy and urgency together. Two requested transactions also cannot be assumed safe to commit in parallel.

**Transition:** Make each node’s evidence window explicit.

**References:** [Building with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one), [A harness with Jev](https://www.langchain.com/blog/building-a-harness-with-jev).


### 16. Each node sees a different view of the case

**Purpose:** Teach context boundaries as authored data dependencies. **Suggested time:** 1 min.


Agent Graph determines when evidence exists and which view of state each node receives. AgentScript authors the relevant controls and bindings.

A model interprets the request using the conversation prefix and authorized candidate items. Its proposed item reference must be validated; it cannot make the customer the owner of an order.

The selected handler obtains its own rules, stock and terms. Narrow context can reduce work, but excluding a required fact can reduce quality. Version and evaluate the input view.

**Transition:** Use that state to preserve the mixed request.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/), [Building with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one).


### 17. State preserves work across a branch

**Purpose:** Make persistent obligations visible. **Suggested time:** 1 min.


In this AND request, both tasks stay in graph state. The customer starts with the exchange; the cable return waits and then resumes after the exchange service records its authorized result.

OR and IF have different semantics. Keep alternatives until one is selected or its stated condition is met. Inactive alternatives are unselected or untriggered, not unresolved obligations.

For Exchange for blue if in stock; otherwise return, unknown stock remains pending. A different exchange-policy denial does not silently activate the stock-conditioned alternative. Only the selected action may commit.

A time or turn budget bounds priority clarification. A handoff records receiving ownership and every outstanding obligation; it does not finish the customer’s work.

**Transition:** This is where neural interpretation meets explicit control.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/).


### 18. Guided determinism gives uncertainty a place

**Purpose:** Explain neuro-symbolic reasoning in plain terms. **Suggested time:** 1 min.


Neuro-symbolic reasoning combines learned interpretation with explicit software state and rules. System One contributes the judgment; AgentScript authors its permitted effect; Agent Graph executes the resulting path.

Guided determinism makes the transition constraints inspectable. Classification remains fallible, and explicit controls alone do not guarantee eventual completion.

The semantic model, route definitions and business services can evolve at their own boundaries when the composition is versioned and tested.

**Transition:** Three AgentScript concepts make that boundary concrete.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/).


### 19. Availability and required execution differ

**Purpose:** Teach precise AgentScript control semantics. **Suggested time:** 1 min.


The left sketch is language-neutral design pseudocode, not runnable AgentScript or a documented koa-action adapter. Action definitions, dialect and deployment configuration are omitted. The requireOwnedOrder helper stops for verification or hold unless authoritative ownership is established.

Required identity, purchase and applicable policy checks belong in authored procedure logic. An available-when condition filters model choices; it does not force the check to execute.

Bound inputs use trusted service state for consequential identifiers and entitlements. Services independently enforce authority and current policy when committing.

The selected handler follows its own rules, obtains customer confirmation, rechecks accepted terms and records the actual service result. Graph state retains the other task.

**Transition:** Walk the proposed request through all of its owners.

**References:** [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/), [AgentScript specification](https://github.com/salesforce/agentscript/blob/main/SPEC.md).


### 20. Authorize the exchange, then resume the cable return

**Purpose:** Follow the aftercare case while distinguishing interpretation, confirmation, service authorization and unfinished work. **Suggested time:** 1.6 min.


The eight events follow the same customer case: Exchange these headphones and return the spare cable. The cable is a separately purchased item, not a component removed from the headphone kit.

First the identity service verifies access, then the order service matches the owned purchase. System One proposes the two AND tasks and their item references; the graph validates that each has a supported handler.

The customer chooses the exchange first. Exchange rules, stock and terms produce an eligible offer, leaving the task Awaiting confirmation. These are the exchange service’s rules, not the invented whole-item return table.

Customer confirmation still precedes authorization. The service rechecks authority, policy, stock and accepted terms, then records the exchange ID. Authorized means that service outcome, not a shipped replacement or settled refund.

Finally Agent Graph activates the cable return. The exchange is Authorized and the cable return is Active. The full case remains unfinished. This clear supported path needs no frontier call; unresolved interpretation has its separate gated route.

**Transition:** Now design the non-happy paths.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/), [Reliable enterprise agents](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/).


### 21. Failure routes are part of the program

**Purpose:** Connect reliability to failure contracts. **Suggested time:** 1 min.


A graph needs meaningful timeout, invalid-output, and handoff routes rather than a default business action.

A resumed workflow can reuse a recorded decision, but this alone does not guarantee exactly-once external side effects.

Transaction-specific safeguards belong in the service performing the write. Recovery must retain the unfinished tasks.

**Transition:** A valid decision can still be semantically wrong.

**References:** [Reliable enterprise agents](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/), [AgentScript specification](https://github.com/salesforce/agentscript/blob/main/SPEC.md).


### 22. Confidence needs evidence in your domain

**Purpose:** Distinguish signal concentration from correctness and permission. **Suggested time:** 1 min.


This schematic focuses on the remedy question for one task: return, exchange or other. Purchased-unit scope and task relationships remain separate fields, so parts is not a competing remedy label.

TypeSafe defines Choice and Score confidence from distribution concentration. Noul has no separate confidence field. A concentrated answer distribution can still be wrong.

The picture is not a returned koa-action distribution. Validate any provider signal against independently adjudicated labels and choose gates on development data. A numerical score does not establish identity, eligibility or permission.

**Transition:** Explore what a stricter gate does to a small labeled sample.

**References:** [Confidence routing](https://docs.typesafe.ai/patterns/confidence-routing), [Confidence semantics](https://docs.typesafe.ai/confidence).


### 23. A stricter gate moves work somewhere

**Purpose:** Teach selection, error rate, and coverage without fabricated evidence. **Suggested time:** 1.6 min.


All twelve cases and their scores are constructed teaching data. The signal is uncalibrated and is not a real koa-action field.

Automatic routing coverage is accepted routing decisions divided by twelve. Automatic error uses only accepted decisions; with zero accepted decisions it is undefined. This is a routing metric, not completed-case automation.

A high-scoring error remains when the threshold rises. Escalations still consume capacity, and errors need not decline monotonically on this sample.

**Transition:** Next account for the work that the routing gate adds and avoids.

**References:** [Confidence routing](https://docs.typesafe.ai/patterns/confidence-routing), [Confidence semantics](https://docs.typesafe.ai/confidence).


### 24. Savings depend on avoiding expensive work

**Purpose:** Explain conditional economics with transparent algebra. **Suggested time:** 1.6 min.


This isolates a routing decision replaced by a specialized model. Every constant is invented for teaching; G is one expensive routing call, D is specialized judgment, O is added orchestration and p is the fraction still requiring G.

At p=0.20 the candidate routing cost is 0.27 normalized units, 73% below the one-unit baseline. At p=0.93 they break even. If every case still needs G, adding D and O makes the routing stage 7% more expensive.

Familiar exchange and return paths can use service offers and standard messages without frontier generation. Any generated explanation, tool call, retry, review, reconciliation or unfinished obligation must enter whole-case accounting.

The prior synthetic review queue and the frontier routing fallback G here are distinct destinations. Measure actual routes and their capacity costs. Setup and maintenance need an explicit volume and horizon for a total-cost claim.

**Transition:** Inference latency has an equally important boundary.

**References:** [Composable AI](https://typesafe.ai/manifesto), [Building with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one).


### 25. Fast inference helps the path that uses it

**Purpose:** Separate primitive speed from workflow speed. **Suggested time:** 1 min.


The diagram begins after identity and ownership are established. System One interprets the task, then its handler checks the applicable rules and prepares an offer. A familiar route can use a standard message rather than frontier generation.

Specialized inference may shorten a repeated semantic step. Complete-case latency also includes services, customer confirmation, recovery and human queues. Measure decision latency, response latency and completion time separately.

Report latency distributions at the relevant load, including transport and retries. Retain unfinished cases in service-time analysis rather than averaging completed cases alone.

**Transition:** Apply the control model to a deliberately incomplete design.

**References:** [Jev + LangGraph](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph).


### 26. Find the missing boundary

**Purpose:** Check whether the learner can separate prediction from authority. **Suggested time:** 1.3 min.


The initial design is intentionally incomplete: recognizing an exchange request immediately reaches a business write. Allow a short pause, then reveal the missing controls.

A strong model score cannot repair missing identity and ownership checks, exchange policy and stock checks, or customer confirmation of the offered terms. Place required steps in authored control and enforce their results again in the service.

Retain the cable return through this repair. Reconcile an unknown exchange-write outcome before retrying, using transaction safeguards appropriate to the service.

**Transition:** Training examples must respect the same decision boundaries.

**References:** [Reliable enterprise agents](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/).


### 27. Begin the dataset at the decision boundary

**Purpose:** Prevent future information leaking into model features. **Suggested time:** 1 min.


Freeze the source snapshot and reconstruct what the semantic node could access at the decision time: conversation prefix, verified candidate items and relevant current state.

Independent reviewers label remedy, purchased-unit scope, interpretation status and AND/OR/IF relationships. Keep the separately purchased cable distinct from a cable inside a kit.

A later clarification cannot leak into an earlier input. Preserve record order, timestamps and derivation links. Document filtering and redaction because they can change the model-visible distribution.

**Transition:** Separate fitting and selection from final evaluation.

**References:** [Tutorial evaluation protocol](../blog/09-building-prod.md).


### 28. Split examples before developing the decision

**Purpose:** Show independent data partitions and keep related examples together before fitting or augmentation. **Suggested time:** 1.1 min.


This is proposed task development, not a description of koa-action foundation-model training or a supported fine-tuning interface. If direct adaptation is unavailable, retain the fixed model and develop its application configuration.

Inputs contain only the conversation prefix and trusted state available at the decision time. Route labels use that evidence. Later outcomes or future audio may establish separate outcome or endpoint targets; they cannot enter the earlier model input. Preserve timestamps, record order, and the derivation manifest.

Group related cases and duplicates before assigning partitions. Create augmentations afterward and keep every variant in its source partition. Account-level groups and later-time cohorts answer different generalization questions.

Fit learned transforms and any permitted adaptation on training data. Separate calibration fitting from gate selection within development data. The locked test is excluded from all iteration. The solid branches carry different samples, not successive copies of one dataset.

**Transition:** Now follow the frozen artifacts and the evidence needed for release.

**References:** [Tutorial evaluation protocol](../blog/09-building-prod.md).


### 29. Freeze the workflow before earning release

**Purpose:** Separate model artifacts, locked evaluation, and live-service qualification. **Suggested time:** 1.1 min.


The purple dashed arrow carries frozen model and configuration artifacts. A separate green arrow carries untouched examples into the locked evaluation. The artifacts include model version, learned transforms, decision definitions, thresholds, and the workflow policy.

Passing offline gates qualifies the candidate for a randomized service pilot. The black arrows indicate release qualification; the offline test examples do not become the pilot traffic. Use equivalent permissions, tools, and service requirements for the baseline and candidate.

Predeclare the pilot assignment unit, observation horizon, failure definition, quality margin, minimum worthwhile saving, and latency limits. Keep related cases assigned consistently and account for interference through shared review queues.

Roll out only when the predefined pilot gates pass. Track cost per incoming case beside resolution and automatic coverage, including unfinished work. Reviewed feedback goes to a future dataset. If tuning follows a failure, evaluate the new candidate with fresh untouched evidence.

The full standalone illustration remains available as assets/training-pipeline.svg and assets/training-pipeline.png; these focus views enlarge its two teaching responsibilities without changing its semantics.

**Transition:** Choose the grouping or time split that matches the deployment claim.

**References:** [Tutorial evaluation protocol](../blog/09-building-prod.md).


### 30. Choose the split that matches the claim

**Purpose:** Distinguish independent cases from repeated observations. **Suggested time:** 1 min.


Unseen-account performance and future-traffic performance are different claims and may need separate tests.

Assign related cases and near duplicates together, and generate training augmentations only after partitioning.

One conversation evaluated many times still represents one customer situation. Repeated judgments estimate repeatability, not generalization over new cases.

**Transition:** Define what evidence would earn a rollout.

**References:** [Tutorial evaluation protocol](../blog/09-building-prod.md), [Jev-as-a-Judge](https://www.langchain.com/blog/jev-agent-evals-langsmith).


### 31. Lower cost must come with acceptable quality

**Purpose:** Explain the joint acceptance rule with schematic intervals and the whole-case outcome. **Suggested time:** 2 min.


These uncertainty ranges are schematic, not measured results. Predeclare the quality margin, required saving, sample size, grouping and analysis method before testing.

Quality passes only when the upper uncertainty bound on increased failed-case rate lies below the allowed loss. Cost passes only when the lower bound on saving per incoming case exceeds the required gain. Both must pass; this picture’s candidate still waits.

The worked trace ends with an Authorized exchange and an Active cable return. If that AND obligation remains unresolved at the fixed service deadline, the whole case is incomplete. Count each incoming case once.

For OR or IF requests, only the selected or triggered action is an active obligation; inactive alternatives are unselected or untriggered. A justified policy denial can be a correct outcome. Define these statuses before evaluating.

Consequential-error and latency limits are additional gates, using predeclared relevant cohorts independent of either system’s routes. Include unresolved work. The joint null is unacceptable quality loss OR insufficient saving; a nonsignificant difference cannot establish acceptable equivalence.

**Transition:** First isolate the decision on held-out snapshots, then measure the whole service in a controlled pilot.

**References:** [Tutorial evaluation protocol](../blog/09-building-prod.md).


### 32. Evaluate the decision, then the service

**Purpose:** Prevent offline results being overextended to service economics. **Suggested time:** 1.5 min.


Offline replay isolates the bounded decision. It cannot estimate how changed dialogue affects customers or how escalations affect queue capacity.

In the pilot, keep assignment stable and account for related cases and interference through shared queues. Use the same observation horizon in both arms.

Report observed operating cost per incoming case with resolution and coverage. Disclose setup and maintenance costs separately; total ownership estimates need an explicit volume and horizon.

Case automation counts incoming cases completed by the deadline without staff handling. Routing coverage counts decisions accepted automatically at one gate. A model fallback can remain automatic; an accepted routing decision can still lead to an unresolved case.

**Transition:** When an outcome fails, diagnose the responsible boundary.

**References:** [Tutorial evaluation protocol](../blog/09-building-prod.md).


### 33. Diagnose the boundary that failed

**Purpose:** Connect disaggregation to targeted learning from failure. **Suggested time:** 1 min.


If only the exchange was proposed, inspect decision definitions and the authorized context for the omitted cable request. If both tasks were recorded, inspect the graph transition that dropped the cable task.

A component return charged under the whole-item fee points to policy scope or handler selection. Executing both sides of an OR request points to a lost task relationship. Each failure has a different repair.

Offline judges can prioritize traces, but require validation against independent references. Review apparent successes as well as escalations; post-run feedback cannot prevent a write that has already occurred.

**Transition:** Finish by identifying one worthwhile first change.

**References:** [Jev in LangSmith Evals](https://www.langchain.com/blog/jev-is-now-available-in-langsmith-evals), [Jev-as-a-Judge](https://www.langchain.com/blog/jev-agent-evals-langsmith).


### 34. Start with one decision that changes the path

**Purpose:** Give the audience a bounded practical next step. **Suggested time:** 0.7 min.


The throughline is an Agentforce composition: koa-action supplies bounded semantic judgment, Agent Graph coordinates state and escalation, and AgentScript defines the controls. Trusted services retain facts and transaction authority.

Frontier reasoning remains available when a scoped interpretation problem survives clarification and required evidence checks. Familiar exchanges and component returns can use their configured service routes directly.

LangChain’s September 25, 2026 article attributes the unbundling argument to Jaya Gupta and advocates cheap by default, frontier on exception. Its three-year historical framing is not a measured survey, so this tutorial makes the allocation argument without turning it into a Salesforce development timeline.

The practical artifact is a bounded decision contract and a small graph. Evaluate complete cases, including every active obligation, before claiming reliability, lower operating cost or shorter completion time.

**Transition:** Use the source notes and full blog for the details behind this tutorial.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/), [Composable AI](https://typesafe.ai/manifesto), [Jev + LangGraph](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph), [Throughline source check](research/v5-throughline-source-check.md).


### 35. Read the evidence behind the architecture

**Purpose:** Provide inspectable source provenance and product boundaries. **Suggested time:** 0.5 min.


The source ledger covers the requested Salesforce, LangChain and TypeSafe resources. The v5 source check records the historical-attribution boundary and the separation between public Koa reasoning and the user-framed koa-action System One component.

The direct exchange/component service design, merchant policy and proposed evaluation are authored teaching material. TypeSafe’s intent-routing example instead uses a specialist language model; this tutorial’s service mapping must earn its own evidence.

No native koa-action adapter, common Jev/Salesforce schema, fine-tuning access, calibrated confidence output or benchmark is asserted. Consult blog 09 and the branching specification for the complete design contract.

**Transition:** End of tutorial.

**References:** [Guided determinism tutorial](https://everythingagents.org/topics/guided-determinism), [Confidence semantics](https://docs.typesafe.ai/confidence).


### 36. Reuse the visual vocabulary in another workflow

**Purpose:** Provide a reusable visual vocabulary for another enterprise workflow. **Suggested time:** 0.5 min.


This optional appendix provides independently movable vector illustrations for another workflow. In PowerPoint, use the Selection Pane to select, copy, resize or rearrange a named object.

The four workflow views and this library retain separate illustrations, labels and routes. Move a node and its label together, then reposition its connectors. The arrows are vector objects; they do not automatically reconnect.

Labels, calendars and shipping values are native editable PowerPoint text. Illustration parts are native shapes; speaker notes remain editable text. Calendars and shipping tickets preserve their printed values as a unit.

Keep the meaning consistent when reusing a component: services establish authority, System One interprets bounded meaning, Agent Graph coordinates transitions and state, AgentScript authors the controls, and a frontier model proposes an interpretation only when the configured exception path calls for it.

**Transition:** Use this vocabulary to sketch another workflow with the same separation of interpretation and authority.

**References:** [Reusable vector components](assets/components-v5/README.md).
