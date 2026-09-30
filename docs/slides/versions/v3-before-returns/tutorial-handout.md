# Tutorial handout and speaker notes

Disaggregated intelligence assigns bounded interpretation, open-ended reasoning, workflow control, and service authority to distinct components. The tutorial constructs one proposed Salesforce service workflow, then asks whether that allocation earns acceptable quality, cost, and latency on complete customer cases.

The final deck has 31 slides and 33.8 minutes of planned talk, leaving time within a 40-minute session for demonstrations and discussion. The [source ledger](research/source-ledger.md) records all sixteen requested references and product-claim boundaries. [The final blog](../blog/07-building-prod.md) supplies the original evaluation protocol.

## The artifact to build

Use one frequent routing decision that changes downstream work. Draft this small design before selecting implementation bindings:

| Part | Your artifact | Example in this tutorial |
| --- | --- | --- |
| Question | A bounded judgment and explicit output categories | Which service route is supported now? Include mixed and unclear. |
| Boundary examples | Evidence and a justified label | “Charged twice; service down” → mixed. |
| Input view | Only relevant evidence available at decision time | Conversation prefix + service category definitions. |
| Graph control | Required predecessor, success guard, and failure edge | Verified access permits invoice retrieval; denial blocks the invoice path. |
| Acceptance | Complete-case outcome, horizon, quality margin, minimum saving | An explained invoice with an unresolved outage remains incomplete at the deadline. |

AgentScript's procedure, action-availability, and argument-binding constructs support authored control. The displayed code sketch is language-neutral pseudocode, not a deployable AgentScript application or a documented `koa-action` adapter. Current facts and permissions remain in authoritative services.

## Demonstration guide

The examples are constructed teaching data. No model or service endpoint is called.

| Example | State to inspect | Lesson |
| --- | --- | --- |
| Service trace | Invoice awaiting confirmation, then resolved; outage handed off and unresolved | Emitting an explanation and transferring ownership do not prove whole-case resolution. |
| Confidence gate at 0.75 | 7/12 auto-routed; 2/7 wrong; 5 reviewed | Routing coverage and error have different denominators. |
| Confidence gate at 0.99 | Only the high-scoring wrong example is auto-routed | A stricter threshold need not remove the error. |
| Confidence gate at 1.00 | No accepted routes; automatic error undefined | An empty accepted set is not evidence of zero error. |
| Routing cost at 20% fallback | 0.27 units versus 1.00 | Avoided expensive work can exceed added decision and runtime work. |
| Routing cost at 93% fallback | 1.00 units | Break-even for these invented assumptions. |
| Routing cost at 100% fallback | 1.07 units | The additional decision can increase cost. |
| Credit exercise | Required access and policy checks, then service enforcement | A semantic signal supplies no transaction authority. |

The cost sketch uses G = 1 for the replaced general-model routing call, D = 0.03 for the specialized decision, and O = 0.04 for additional orchestration. Candidate routing cost is D + O + pG. Later invoice explanation and changed service or human work are excluded from this sketch and must enter the full pilot accounting. The review queue in the gate example and the general-model fallback in the cost example are distinct paths.

Routing coverage counts accepted decisions at one gate. Case automation counts incoming cases completed by the deadline without staff handling. A general-model fallback can still be automatic; an accepted route can still leave work unresolved.

PowerPoint editions use deliberate static states: the final unresolved trace state, the 0.75 gate, the 20% cost scenario with alternate outcomes in notes, and the revealed repair. Their vector artwork preserves the layout; PowerPoint speaker notes remain editable. Use the HTML editions to operate the controls.

## Development and evidence

![Training and evaluation pipeline](assets/training-pipeline.svg)

Preserve the source snapshot, record order, timestamps, related-case groups, and derived-example manifest. Split related examples before augmentation. Route-label reviewers use decision-time evidence; later outcomes or future audio can establish separate outcome or endpoint targets without entering the earlier input.

Fit permitted components on training data. Adaptation is optional. Separate calibration fitting from gate selection within development data, freeze the complete candidate, and use an untouched test. A controlled service pilot then compares complete cases under consistent assignment and observation windows. Reviewed feedback belongs to a future dataset; a revised claim needs fresh untouched evidence.

The initial joint null is unacceptable quality loss **or** insufficient cost saving. Rollout requires both the upper uncertainty bound on quality loss to stay below the allowed margin and the lower bound on saving to exceed the required gain. Consequential-error and latency limits also apply. A nonsignificant quality difference is insufficient evidence of acceptable equivalence. No comparative deployment result is reported in this tutorial.

## Slide-by-slide notes

### 01. Disaggregated intelligence

**Purpose:** Introduce disaggregated intelligence as an engineering allocation problem. **Suggested time:** 0.7 min.

System One is a useful engineering term for specialized models that answer bounded questions. It is not a claim about human cognition.

The tutorial will construct a service workflow, inspect its failure boundaries, and define how reliability, cost, and speed would be evaluated.

The Salesforce composition is proposed. Public sources do not establish a koa-action SDK, training interface, or measured benchmark.

**Transition:** First connect the architecture to the four benefits we want.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/), [Composable AI](https://typesafe.ai/manifesto).

### 02. Four benefits. One service to measure.

**Purpose:** Connect requested benefits to concrete mechanisms. **Suggested time:** 1 min.

Significantly lower decision cost and faster inference are the opportunity behind specialization. Their size must be established for the deployed workload.

Reliability means acceptable outcomes. Predictability includes output-shape contracts, permitted paths, and repeated-answer variation. Assess those separately from semantic correctness.

The same complete customer case remains the unit of value. Extra handoffs can consume a primitive-level saving.

**Transition:** Follow one case through the rest of the tutorial.

**References:** [Jev + LangGraph](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph), [Composable AI](https://typesafe.ai/manifesto).

### 03. One customer, two obligations

**Purpose:** Establish the recurring case and its invariant. **Suggested time:** 1.1 min.

Ask the audience to name the invariant: neither request should disappear when the agent changes topics.

A task may be resolved, withdrawn by the customer, or handed off with ownership recorded. These are different statuses; handoff does not equal resolution.

This is a constructed example used to explain state and routing, not a reported customer deployment.

**Transition:** Assign an owner to each kind of work.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/).

### 04. Give each responsibility an owner

**Purpose:** Distinguish models, execution, configuration, and authority. **Suggested time:** 1 min.

AgentScript is the authoring and control language; Agent Graph is the managed runtime that executes configured behavior.

The models produce interpretations or explanations. Backend services retain authority over access and writes, while human review is an explicit branch.

The diagram denotes coordination, not ownership of every component by a model. Each case invokes only the components its configured path needs.

**Transition:** Now move process rules from prose into inspectable structure.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/).

### 05. Process knowledge becomes topology

**Purpose:** Teach which decisions, in which order, over which state. **Suggested time:** 1 min.

Topology encodes procedural domain knowledge: which step may run, what must precede it, and where its input facts come from.

The transformation does not remove all domain knowledge from prompts. Category definitions and authorized facts remain necessary within model calls.

A graph can enforce a poor process consistently. Review and test the topology itself.

**Transition:** Locate the runtime within the broader agent harness.

**References:** [Jev + LangGraph](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph), [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/).

### 06. A runtime sits beneath the harness

**Purpose:** Prevent runtime/harness/configuration conflation. **Suggested time:** 1 min.

LangChain distinguishes its framework, LangGraph runtime, and Deep Agents harness. The comparison helps locate responsibilities.

In this Salesforce example the configured agent is the broader harness, with Agent Graph providing runtime execution and AgentScript authoring control.

This is an architectural analogy, not LangGraph API compatibility or a claim that Agent Graph ships Deep Agents defaults. The public AgentScript repo contains tooling, not the managed runtime.

**Transition:** Define the first decision before selecting its integration.

**References:** [Runtime, framework, harness](https://www.langchain.com/blog/deep-agents-vs-langchain-vs-langgraph), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/).

### 07. Start with a decision contract

**Purpose:** Give a bounded task a testable contract. **Suggested time:** 1 min.

The labels are application choices, not a documented koa-action response schema. Mixed and unclear are first-class outcomes.

Provide positive and negative examples at the category boundaries. The same contract controls labeling and evaluation.

A timeout or malformed result must not default into a business transaction. Specify its fallback separately from semantic ambiguity.

**Transition:** Match the question to the right primitive.

**References:** [TypeSafe quickstart](https://docs.typesafe.ai/introduction/quickstart), [Intent routing](https://docs.typesafe.ai/patterns/intent-routing), [Structured decision criteria](https://docs.typesafe.ai/primitives/advanced).

### 08. Four bounded decisions, four contracts

**Purpose:** Cover the four user-specified koa-action capabilities. **Suggested time:** 1 min.

This tutorial uses koa-action for classification, noul, scoring, and semantic endpointing, following the capability framing supplied for the Salesforce composition.

TypeSafe documents analogous decision concepts, but its SDK fields, batching, calibration, and training claims do not define a Salesforce interface.

Each primitive needs its own target and error measure. A rubric score and the probability of a binary proposition are not interchangeable.

**Transition:** Make that semantic distinction tangible.

**References:** [TypeSafe quickstart](https://docs.typesafe.ai/introduction/quickstart), [Noul](https://docs.typesafe.ai/primitives/noul), [Score](https://docs.typesafe.ai/primitives/score).

### 09. Probability and intensity answer different questions

**Purpose:** Explain binary proposition estimates versus severity rubrics. **Suggested time:** 1 min.

TypeSafe’s Noul is the probability of the yes answer; its Score uses ordered rubric levels and can be fractional.

A mean rubric score can hide different distributions. Preserve the output meaning that the downstream rule actually uses.

The corresponding koa-action fields, ranges, and calibration require their own verified contract. No numeric Salesforce response is shown here.

**Transition:** A decision about when to respond has an additional time boundary.

**References:** [Noul](https://docs.typesafe.ai/primitives/noul), [Score](https://docs.typesafe.ai/primitives/score).

### 10. Endpointing is a decision in time

**Purpose:** Explain semantic endpointing and temporal leakage. **Suggested time:** 1 min.

The waveform is illustrative. The task asks whether a spoken turn has ended using only the available prefix.

Future speech may establish the reference label, but it must not become part of the earlier input.

Measure premature cutoff and delay separately. Keep all prefixes of a conversation together when splitting data.

**Transition:** Next decide which decisions may run in parallel.

**References:** [Building with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one).

### 11. Split work along information dependencies

**Purpose:** Separate execution independence from causality. **Suggested time:** 1 min.

Independent questions can read the same snapshot; a later step that needs a new fact must wait for that fact.

This is a workflow-design pattern, not a claim about a native koa-action batching API.

Parallel question execution does not imply statistically independent errors. Missing evidence can affect several judgments at once.

**Transition:** Make each node’s evidence window explicit.

**References:** [Building with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one), [A harness with Jev](https://www.langchain.com/blog/building-a-harness-with-jev).

### 12. Each node sees a different view of the case

**Purpose:** Teach context boundaries as authored data dependencies. **Suggested time:** 1 min.

Graph design determines what information exists before a node runs and which part of state it receives.

A customer-provided account identifier does not become a verified identity because it appears in a model output.

Narrowing context can reduce unnecessary processing, but removing a required fact can reduce quality. Version and evaluate the context selection.

**Transition:** Use that state to preserve the mixed request.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/), [Building with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one).

### 13. State preserves work across a branch

**Purpose:** Make persistent obligations visible. **Suggested time:** 1 min.

The application records requested, active, resolved, and handed-off task states separately.

An explanation is an event, not a proof of resolution. The completion rule should reference the actual business outcome or customer confirmation.

The clarification loop has a time or turn budget. A handoff retains outstanding work and receiving ownership.

**Transition:** This is where neural interpretation meets explicit control.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/).

### 14. Guided determinism gives uncertainty a place

**Purpose:** Explain neuro-symbolic reasoning in plain terms. **Suggested time:** 1 min.

Neuro-symbolic reasoning combines learned interpretation with explicit software rules and state.

Guided determinism describes constraints on the effect of model judgments. It does not guarantee perfect classification, identical prose, or eventual completion.

The configuration and the model can evolve independently when their boundary is explicit and tested.

**Transition:** Three AgentScript concepts make that boundary concrete.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/).

### 15. Availability and required execution differ

**Purpose:** Teach precise AgentScript control semantics. **Suggested time:** 1 min.

These are language constructs, not a runnable integration. Action definitions, dialect, and deployment configuration are omitted.

An availability guard controls the offered action set. Required verification belongs in deterministic procedure logic and must also be enforced by the business service.

Bind trusted account context rather than allowing model extraction to establish authority. No email-found lookup alone is sufficient authentication.

The left sketch is language-neutral design pseudocode, not valid AgentScript syntax or a documented adapter. It connects the required procedure, failure route, action gate and trusted argument binding to this case.

**Transition:** Walk the proposed request through all of its owners.

**References:** [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/), [AgentScript specification](https://github.com/salesforce/agentscript/blob/main/SPEC.md).

### 16. A billing path preserves the outage task

**Purpose:** Follow a constructed mixed-intent case and distinguish completion from accepted handoff. **Suggested time:** 1.6 min.

The same customer asks about an invoice and an outage. The constructed classifier output is mixed, so the graph records two pending obligations.

Advance to Explain: delivering the response leaves the invoice awaiting confirmation. Only the next event meets this example’s resolution condition.

The graph resumes the outage task, then an identified queue accepts the handoff. The outage remains unresolved; the whole customer case is not yet complete.

At the handoff, point out that the workflow preserved work and recorded a receiving owner. The service still owes the customer an outage outcome.

**Transition:** Now design the non-happy paths.

**References:** [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/), [Reliable enterprise agents](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/).

### 17. Failure routes are part of the program

**Purpose:** Connect reliability to failure contracts. **Suggested time:** 1 min.

A graph needs meaningful timeout, invalid-output, and handoff routes rather than a default business action.

A resumed workflow can reuse a recorded decision, but this alone does not guarantee exactly-once external side effects.

Transaction-specific safeguards belong in the service performing the write. Recovery must retain the unfinished tasks.

**Transition:** A valid decision can still be semantically wrong.

**References:** [Reliable enterprise agents](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/), [AgentScript specification](https://github.com/salesforce/agentscript/blob/main/SPEC.md).

### 18. Confidence needs evidence in your domain

**Purpose:** Distinguish signal concentration from correctness and permission. **Suggested time:** 1 min.

TypeSafe defines Choice and Score confidence from distribution concentration. Noul has no separate confidence field.

The picture is schematic and does not display a returned koa-action distribution. Any provider signal needs a specified meaning and local validation.

A score cannot authorize a business action. Numerical gates are application operating points, not universal constants.

**Transition:** Explore what a stricter gate does to a small labeled sample.

**References:** [Confidence routing](https://docs.typesafe.ai/patterns/confidence-routing), [Confidence semantics](https://docs.typesafe.ai/confidence).

### 19. A stricter gate moves work somewhere

**Purpose:** Teach selection, error rate, and coverage without fabricated evidence. **Suggested time:** 1.6 min.

All twelve cases and their scores are constructed teaching data. The signal is uncalibrated and is not a real koa-action field.

Automatic routing coverage is accepted routing decisions divided by twelve. Automatic error uses only accepted decisions; with zero accepted decisions it is undefined. This is a routing metric, not completed-case automation.

A high-scoring error remains when the threshold rises. Escalations still consume capacity, and errors need not decline monotonically on this sample.

**Transition:** Next account for the work that the routing gate adds and avoids.

**References:** [Confidence routing](https://docs.typesafe.ai/patterns/confidence-routing), [Confidence semantics](https://docs.typesafe.ai/confidence).

### 20. Savings depend on avoiding expensive work

**Purpose:** Explain conditional economics with transparent algebra. **Suggested time:** 1.6 min.

This isolates the routing call replaced by a specialized decision. G does not include the later model call that explains the invoice. Every constant is invented for teaching.

At p=0.20, candidate routing cost is 0.27 of one baseline unit. At p=0.93 the paths break even; at p=1, adding a decision makes the routing stage 7% more expensive.

Whole-case savings must include any changed explanations, tools, retries, human work and unresolved obligations. Added development and maintenance investment also needs an explicit volume and horizon.

The review queue in the previous synthetic gate example and the general-model routing fallback G here are different destinations. Measure the actual destination chosen by each workflow.

**Transition:** Inference latency has an equally important boundary.

**References:** [Composable AI](https://typesafe.ai/manifesto), [Building with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one).

### 21. Fast inference helps the path that uses it

**Purpose:** Separate primitive speed from workflow speed. **Suggested time:** 1 min.

Specialized inference can shorten a repeated semantic step. A faster classifier does not by itself establish faster service resolution.

Client-observed call latency includes transport and retries; parallel branches affect critical-path duration differently from serial dependencies.

Measure distribution tails as well as typical latency at the relevant load. Include unfinished cases when reporting resolution, rather than averaging completed cases alone.

**Transition:** Apply the control model to a deliberately incomplete design.

**References:** [Jev + LangGraph](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph).

### 22. Find the missing boundary

**Purpose:** Check whether the learner can separate prediction from authority. **Suggested time:** 1.3 min.

Allow a short pause before revealing the repair. The initial diagram is intentionally incomplete.

The strongest answer identifies both authored ordering and independent backend enforcement. Raising the classifier threshold alone does not repair the design.

Also retain pending tasks and specify a bounded fallback. A credit operation has consequences outside the model response.

**Transition:** Training examples must respect the same decision boundaries.

**References:** [Reliable enterprise agents](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/), [AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/).

### 23. Begin the dataset at the decision boundary

**Purpose:** Prevent future information leaking into model features. **Suggested time:** 1 min.

Freeze the source snapshot and reconstruct what the routing node could actually access at the timestamp.

Use independently adjudicated route labels, including mixed and unclear cases. Reviewers labeling the next step see the decision-time evidence.

Record redaction, filtering, and derived examples. Preserving the source does not mean transformations leave the model-visible distribution unchanged.

**Transition:** Separate fitting and selection from final evaluation.

**References:** [Tutorial evaluation protocol](../blog/07-building-prod.md).

### 24. Split examples before developing the decision

**Purpose:** Show independent data partitions and keep related examples together before fitting or augmentation. **Suggested time:** 1.1 min.

This is proposed task development, not a description of koa-action foundation-model training or a supported fine-tuning interface. If direct adaptation is unavailable, retain the fixed model and develop its application configuration.

Inputs contain only the conversation prefix and trusted state available at the decision time. Route labels use that evidence. Later outcomes or future audio may establish separate outcome or endpoint targets; they cannot enter the earlier model input. Preserve timestamps, record order, and the derivation manifest.

Group related cases and duplicates before assigning partitions. Create augmentations afterward and keep every variant in its source partition. Account-level groups and later-time cohorts answer different generalization questions.

Fit learned transforms and any permitted adaptation on training data. Separate calibration fitting from gate selection within development data. The locked test is excluded from all iteration. The solid branches carry different samples, not successive copies of one dataset.

**Transition:** Now follow the frozen artifacts and the evidence needed for release.

**References:** [Tutorial evaluation protocol](../blog/07-building-prod.md).

### 25. Freeze the workflow before earning release

**Purpose:** Separate model artifacts, locked evaluation, and live-service qualification. **Suggested time:** 1.1 min.

The purple dashed arrow carries frozen model and configuration artifacts. A separate green arrow carries untouched examples into the locked evaluation. The artifacts include model version, learned transforms, decision definitions, thresholds, and the workflow policy.

Passing offline gates qualifies the candidate for a randomized service pilot. The black arrows indicate release qualification; the offline test examples do not become the pilot traffic. Use equivalent permissions, tools, and service requirements for the baseline and candidate.

Predeclare the pilot assignment unit, observation horizon, failure definition, quality margin, minimum worthwhile saving, and latency limits. Keep related cases assigned consistently and account for interference through shared review queues.

Roll out only when the predefined pilot gates pass. Track cost per incoming case beside resolution and automatic coverage, including unfinished work. Reviewed feedback goes to a future dataset. If tuning follows a failure, evaluate the new candidate with fresh untouched evidence.

The full standalone illustration remains available as assets/training-pipeline.svg and assets/training-pipeline.png; these focus views enlarge its two teaching responsibilities without changing its semantics.

**Transition:** Choose the grouping or time split that matches the deployment claim.

**References:** [Tutorial evaluation protocol](../blog/07-building-prod.md).

### 26. Choose the split that matches the claim

**Purpose:** Distinguish independent cases from repeated observations. **Suggested time:** 1 min.

Unseen-account performance and future-traffic performance are different claims and may need separate tests.

Assign related cases and near duplicates together, and generate training augmentations only after partitioning.

One conversation evaluated many times still represents one customer situation. Repeated judgments estimate repeatability, not generalization over new cases.

**Transition:** Define what evidence would earn a rollout.

**References:** [Tutorial evaluation protocol](../blog/07-building-prod.md), [Jev-as-a-Judge](https://www.langchain.com/blog/jev-agent-evals-langsmith).

### 27. Lower cost must come with acceptable quality

**Purpose:** Explain the joint acceptance rule with schematic intervals and the whole-case outcome. **Suggested time:** 2 min.

These ranges are schematic shapes, not results, effect sizes, or measurement precision. Their only purpose is to show how a predeclared limit is compared with an uncertainty bound. Limits and the analysis method must be chosen before testing.

On the left, the upper bound on the increase in failed-case rate reaches beyond the maximum allowed loss. Quality has not passed even if the point estimate might look reassuring. On the right, the lower bound on saving per incoming case clears the minimum required gain. Both conditions must pass before rollout, so this candidate waits.

The worked trace has an invoice resolved and an outage handed off with work still outstanding. At the fixed service deadline that is an incomplete case. An incorrect outcome or any unresolved requested task counts as a failed case; count each incoming case once.

Consequential-action limits and response/resolution latency limits are additional gates. Assess harmful actions across all incoming cases and an independently defined relevant cohort shared by both systems. Record unresolved cases rather than averaging only completed service.

The formal joint null is unacceptable quality loss OR insufficient saving. Failure to find a significant quality difference is insufficient evidence of acceptable equivalence. Predeclare sample size, grouping, and the uncertainty method; retain the statistical detail in the companion notes.

**Transition:** First isolate the decision on held-out snapshots, then measure the whole service in a controlled pilot.

**References:** [Tutorial evaluation protocol](../blog/07-building-prod.md).

### 28. Evaluate the decision, then the service

**Purpose:** Prevent offline results being overextended to service economics. **Suggested time:** 1.5 min.

Offline replay isolates the bounded decision. It cannot estimate how changed dialogue affects customers or how escalations affect queue capacity.

In the pilot, keep assignment stable and account for related cases and interference through shared queues. Use the same observation horizon in both arms.

Report observed operating cost per incoming case with resolution and coverage. Disclose setup and maintenance costs separately; total ownership estimates need an explicit volume and horizon.

Case automation counts incoming cases completed by the deadline without staff handling. Routing coverage counts decisions accepted automatically at one gate. A model fallback can remain automatic; an accepted routing decision can still lead to an unresolved case.

**Transition:** When an outcome fails, diagnose the responsible boundary.

**References:** [Tutorial evaluation protocol](../blog/07-building-prod.md).

### 29. Diagnose the boundary that failed

**Purpose:** Connect disaggregation to targeted learning from failure. **Suggested time:** 1 min.

A wrong route can motivate better decision data. A correct mixed route followed by dropped state calls for a workflow repair.

Offline semantic judges can prioritize traces, but require validation against independent references. Repeatability is a separate property from correctness.

Sample apparent successes as well as escalations. A post-run evaluation score cannot prevent an action that has already happened.

**Transition:** Finish by identifying one worthwhile first change.

**References:** [Jev in LangSmith Evals](https://www.langchain.com/blog/jev-is-now-available-in-langsmith-evals), [Jev-as-a-Judge](https://www.langchain.com/blog/jev-agent-evals-langsmith).

### 30. Start with one decision that changes the path

**Purpose:** Give the audience a bounded practical next step. **Suggested time:** 0.7 min.

The tutorial’s central claim is an allocation principle: specialize judgment where it earns its place, retain general reasoning where needed, and make control explicit.

Predictable contracts and runtime paths create an inspectable system; correctness and economics still require evidence from complete cases.

The next engineering artifact is a decision contract and a small graph, followed by held-out evaluation and a controlled pilot.

Build assignment: draft the route question, mixed and unclear examples, the node’s input view, its guarded failure edge, and a full-case acceptance rule. The handout records this compact artifact.

**Transition:** Use the source notes and full blog for the details behind this tutorial.

**References:** [Composable AI](https://typesafe.ai/manifesto), [Agent Graph / guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/).

### 31. Read the evidence behind the architecture

**Purpose:** Provide inspectable source provenance and product boundaries. **Suggested time:** 0.5 min.

The complete research ledger covers all sixteen requested web resources plus the final local blog and supplementary primary documentation.

The Salesforce stack roles are grounded in the user brief and public graph/language resources; integration examples and training protocols remain proposals.

No koa-action benchmark, SDK contract, fine-tuning access, or native adapter is asserted. The diagrams and numeric interactions are independently authored teaching examples.

**Transition:** End of tutorial.

**References:** [Guided determinism tutorial](https://everythingagents.org/topics/guided-determinism), [Confidence semantics](https://docs.typesafe.ai/confidence).

