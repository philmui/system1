# Curriculum proposal — Disaggregated intelligence

Audience: enterprise engineers and architects. Duration: approximately 38 minutes, including two short audience exercises. Recommended length: 30 slides. Design: warm off-white, dark ink, pastel mint for runtime/state, lavender for semantic models, peach for human/uncertainty paths, and pale blue for trusted services. Arrows have labels. Color always has a redundant text or shape cue.

This tutorial develops an original Salesforce service workflow from [the final local blog](../../blog/07-building-prod.md). It treats `koa-action` capabilities in the user brief as supplied product framing. Public references do not establish its API, training access, native Agent Graph adapter, calibration, or measured performance. Proposed architecture and illustrative economics must be identified accordingly. The deck should not imitate the LangChain article's legal-document example or import Jev benchmarks.

## Teaching arc

1. Allocate responsibility: explain why bounded semantic decisions can earn their own component.
2. Make the graph carry the process: sequence, state, action boundaries, and the evidence visible at each step.
3. Build one service workflow: retain both tasks, apply authored controls, and make failure routes explicit.
4. Make the economic claim testable: coverage, residual risk, whole-case cost, and critical-path latency.
5. Develop the decision from honest evidence: decision-time inputs, grouped splits, adaptation where supported, and a locked test.
6. Earn rollout: end-to-end quality and cost gates, trace diagnosis, and a controlled feedback cycle.

Two recurring visual objects maintain continuity: a customer task ledger with “invoice / outage” rows, and a small graph whose active node is highlighted as the tutorial progresses. Model, state, configuration, and service are distinct graphic shapes throughout.

## Source key

| Key | Source | Appropriate use |
| --- | --- | --- |
| B | [Local final blog](../../blog/07-building-prod.md) | Original Salesforce design and methodological recommendations. |
| S1 | [Agent Graph and guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/) | Explicit topology, state, handoffs, and authored control. |
| S2 | [Autonomous and reliable enterprise agents](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/) | Separate language interpretation from controlled enterprise operations. |
| S3 | [Agent Script control plane](https://www.salesforce.com/blog/agent-script-control-plane/) | Typed state, deterministic procedures, bindings, and action availability. |
| S4 | [Guided determinism tutorial](https://everythingagents.org/topics/guided-determinism) | Teaching analogies and debugging prompts; not a formal runtime contract. |
| S5 | [Agent Script repository](https://github.com/salesforce/agentscript) and [specification](https://github.com/salesforce/agentscript/blob/main/SPEC.md) | Language tooling and verified syntax concepts; the managed runtime is excluded. |
| L1 | [Building Prod with Jev and LangGraph](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph) | Bounded decisions composed with a graph runtime. |
| L2 | [Building a Harness with Jev](https://www.langchain.com/blog/building-a-harness-with-jev) | Decision points inside an agent loop. |
| L3 | [Jev in LangSmith Evals](https://www.langchain.com/blog/jev-is-now-available-in-langsmith-evals) | Trace assessment workflow and rubric-based evaluators. |
| L4 | [Jev-as-a-Judge](https://www.langchain.com/blog/jev-agent-evals-langsmith) | Correctness and repeatability are separate quantities; narrow study scope. |
| L5 | [Deep Agents vs LangChain vs LangGraph](https://www.langchain.com/blog/deep-agents-vs-langchain-vs-langgraph) | Runtime, framework, and harness are different abstraction levels. |
| T1 | [Composable AI manifesto](https://typesafe.ai/manifesto) | Semantic decisions composed with ordinary software. |
| T2 | [TypeSafe quickstart](https://docs.typesafe.ai/introduction/quickstart) | Typed decision concepts; interface applies to Jev only. |
| T3 | [Confidence routing](https://docs.typesafe.ai/patterns/confidence-routing) | Explicit uncertainty branches, task-dependent gates. |
| T4 | [Intent routing](https://docs.typesafe.ai/patterns/intent-routing) | Code, specialized reasoning, or human paths. |
| T5 | [Advanced structure](https://docs.typesafe.ai/primitives/advanced) | Narrow category definitions and hierarchical decisions. |
| T6 | [How to build with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) | Narrow questions, relevant context, composed results. |
| T7 | [Confidence](https://docs.typesafe.ai/confidence) | Concentration-based confidence is not locally measured correctness. |
| T8 | [Noul](https://docs.typesafe.ai/primitives/noul) and [Score](https://docs.typesafe.ai/primitives/score) | Proposition probability and rubric intensity have different meanings. |

## Per-slide proposal

### 01 — Disaggregated intelligence

- **Purpose:** Establish the idea and the Salesforce stack immediately.
- **On-slide text:** “Building enterprise reasoning with `koa-action`, Agent Graph, and AgentScript.” Subline: “Allocate each decision to the component that can meet its contract.”
- **Visual:** Large expressive graph. One incoming service request fans into a lavender decision capsule, a mint workflow path, a pale-blue lookup, and a peach review branch. A generous title area; no logo wall.
- **Speaker cue:** This is a tutorial in allocating work. System One means a specialized model that answers a bounded question; it is an engineering analogy, not a claim about cognition.
- **Source / status:** B, T1, S1. Proposed Salesforce composition.

### 02 — Four benefits, one condition

- **Purpose:** Connect reliability, predictability, lower cost, and faster inference to the design mechanism.
- **On-slide text:** “Bounded judgments can make behavior easier to test and keep expensive reasoning off routine paths. The benefit survives only if the complete service still meets its quality, cost, and latency requirements.”
- **Visual:** Four outward paths from “explicit decision contract”: reliability → testable errors; predictability → bounded outputs; cost → avoided work; speed → shorter critical path. A thin shared baseline reads “measure the full case.”
- **Speaker cue:** Significant savings and speed improvements are goals to establish on this workload. A smaller call adds overhead if it never changes downstream work.
- **Source / status:** B, T1, T6. Architectural rationale; no benchmark claim.

### 03 — One customer, two obligations

- **Purpose:** Give every later design decision a concrete service consequence.
- **On-slide text:** Customer: “Why was I charged twice, and why is my service down?” Ledger: “Invoice question — pending. Outage — pending.” Prompt: “What must remain true after every transition?”
- **Visual:** A customer utterance bubble entering an initially empty task ledger. Under it, a faint potential graph offers billing, technical, mixed, and unclear routes.
- **Speaker cue:** Give the audience 15 seconds. The key invariant is that both obligations remain recorded until resolved, withdrawn, or accepted by a named receiving queue. Producing an explanation is not sufficient evidence of resolution.
- **Source / status:** B. Constructed service example.

### 04 — Assign each responsibility an owner

- **Purpose:** Prevent model/runtime/configuration/backend conflation.
- **On-slide text:** `koa-action`: bounded semantic judgments. Generative model: open-ended reasoning and explanation. Agent Graph: state and execution paths. AgentScript: authored controls. Services: authoritative facts and authorized actions.
- **Visual:** A real architecture diagram, not five equal cards: AgentScript configures a central Agent Graph; runtime invokes decision model, generative model, and trusted services; human handoff leaves a recorded branch.
- **Speaker cue:** One component may fail without changing another's authority. The model may propose a route; the transaction service decides whether a requested write is allowed.
- **Source / status:** B, S1–S3. Proposed integration; documented role concepts.

### 05 — Encode process knowledge in the graph

- **Purpose:** Teach the user's central topology thesis without claiming all domain knowledge disappears from prompts.
- **On-slide text:** “Choose which decision happens, what must precede it, and which state it can read.” Small footer: “Definitions and evidence still belong in the decision's context.”
- **Visual:** Left: a long instruction paragraph with the clauses “check access,” “fetch invoice,” and “explain” highlighted. Right: those clauses become ordered nodes with a blocked bypass edge. Use a restrained animated transformation.
- **Speaker cue:** Process knowledge becomes reviewable topology. Class boundaries and retrieved facts still matter inside a node. A graph can faithfully enforce a badly designed process, so topology requires tests too.
- **Source / status:** S1, S2, L1, L5; original synthesis.

### 06 — Runtime, harness, and configuration

- **Purpose:** Disambiguate layers before teaching the implementation.
- **On-slide text:** “A runtime executes the workflow. A harness supplies the surrounding loop, context, and tool policy. Configuration expresses the authored behavior.” Salesforce mapping: Agent Graph / your configured agent / AgentScript.
- **Visual:** Three nested bands with a side comparison: LangGraph = runtime; LangChain = framework; Deep Agents = harness. Label “architectural comparison.”
- **Speaker cue:** A runtime is infrastructure underneath the agent's chosen behavior. Agent Graph is not asserted to be hosted LangGraph, nor is its API interchangeable. The public AgentScript repository contains tooling, not the managed execution runtime.
- **Source / status:** S1, S3, S5, L5. Keep L5-derived text under 200 words across deck and notes.

### 07 — Start with a decision contract

- **Purpose:** Make decomposition concrete and testable.
- **On-slide text:** “Question: Which service route is supported now? Input: the conversation so far. Output: billing / technical / account access / mixed / unclear. Fallback: clarify within a budget, then hand off.”
- **Visual:** A large contract sheet with four connected rows: question, evidence, allowed answer, failure behavior. `mixed` and `unclear` are visibly first-class outputs.
- **Speaker cue:** These are application-defined labels, not a Salesforce response schema. Include positive and negative examples for boundaries, such as disputed charges versus changing a password.
- **Source / status:** B, T2, T4–T6. Illustrative application contract.

### 08 — Match the primitive to the question

- **Purpose:** Explain all four requested `koa-action` capabilities without giving them a fake common API.
- **On-slide text:** Classification → “Which route?” Noul → “Was cancellation requested?” Scoring → “How urgent under this rubric?” Semantic endpointing → “Has the spoken turn finished?”
- **Visual:** Four horizontal rows; each has a distinct input and output mark: labeled branch, yes/no probability dial, anchored ordinal ladder, audio prefix endpoint. No arbitrary performance numbers.
- **Speaker cue:** The user brief supplies these `koa-action` capabilities. TypeSafe documents analogous concepts; its names, fields, batching, and calibration cannot establish Salesforce behavior. Define what every output means before writing a gate.
- **Source / status:** User framing, B, T2, T8.

### 09 — A proposition and a severity score answer different questions

- **Purpose:** Resolve the most likely primitive misunderstanding.
- **On-slide text:** “Noul estimates a yes/no proposition. A score locates evidence on a defined rubric. A middle proposition estimate does not mean a medium-intensity event.”
- **Visual:** Left: cancellation proposition with uncertain probability; right: urgency ladder with concrete anchors “can wait / work disrupted / critical service blocked.” Label any values “illustrative semantics.”
- **Speaker cue:** TypeSafe defines Noul as a probability-valued yes answer. An urgency score can be aggregated from rubric levels and is not automatically a probability. The corresponding `koa-action` contract remains unspecified in these references.
- **Source / status:** T8, B. Jev semantics with explicit Salesforce boundary.

### 10 — Endpointing is a decision in time

- **Purpose:** Show that a fast primitive has its own asymmetric errors and leakage risks.
- **On-slide text:** “Decide from the audio prefix available now. A premature cut interrupts the customer; waiting too long increases delay.”
- **Visual:** Clean waveform with a vertical “decision now” cursor; future audio is faded and behind a dashed boundary. A second line shows the two error directions.
- **Speaker cue:** A later audio segment may establish the evaluation label, but cannot enter the earlier input. Evaluate premature cutoffs and delay separately, and keep every prefix of one conversation in one data partition.
- **Source / status:** B; methodological recommendation for user-specified capability.

### 11 — Split where the boundary earns its keep

- **Purpose:** Avoid “more small models always wins.”
- **On-slide text:** “Parallelize questions that can use the same evidence independently. Sequence decisions that need new facts. Keep coupled reasoning together when splitting loses context or adds avoidable round trips.”
- **Visual:** Two paths: a fan-out of intent and cancellation checks from one snapshot; a dependent access → invoice lookup → explanation chain. A small bracket denotes repeated-network overhead.
- **Speaker cue:** Independent execution does not mean statistically independent errors. One model weakness or missing fact can affect several judgments. Choose decomposition based on information dependencies and observed economics.
- **Source / status:** T6, L2, B; original design advice.

### 12 — Give each node only the evidence its question needs

- **Purpose:** Teach context as part of graph topology.
- **On-slide text:** “Routing reads the request. Access checks read trusted identity state. Explanation reads authorized invoice facts. Each boundary exposes a different view of the case.”
- **Visual:** One full case-state spine with three highlighted read windows feeding three nodes. Trusted identity is a solid blue record; user language is lavender. No arrow lets a claimed account ID become verified identity.
- **Speaker cue:** Narrow context improves inspectability and can reduce unnecessary processing. It can also remove necessary evidence, so context selection is versioned and evaluated. The graph decides when new evidence becomes available.
- **Source / status:** S1–S3, T6, B.

### 13 — Preserve mixed intent through the branch

- **Purpose:** Show state as more than a transcript.
- **On-slide text:** “Route = mixed → ask which task to start → billing active; outage pending.” State ledger: “Requested / active / resolved / handed off.”
- **Visual:** The graph from slide 3 now includes a bounded clarification loop, a pending-task ledger, and a return edge from billing to outage. Active nodes move in a reveal sequence.
- **Speaker cue:** Explicitly record a customer's change of priority or withdrawal. Clarification has a turn or time limit; the receiving queue must accept a handoff. The graph alone does not know what business completion means.
- **Source / status:** B, S1. Proposed state design.

### 14 — Guided determinism gives uncertainty a controlled place

- **Purpose:** Explain neuro-symbolic reasoning simply and accurately.
- **On-slide text:** “Neural interpretation resolves language uncertainty. Explicit state and procedures govern required steps. AgentScript authors how those two kinds of reasoning meet.”
- **Visual:** Alternating lavender semantic nodes and mint deterministic nodes on a single track, ending at a blue service action. Edges include guards such as “access verified.”
- **Speaker cue:** Guided determinism constrains the effect of uncertain judgments. It does not make classifications infallible or guarantee completion. The title should not suggest all outputs become deterministic.
- **Source / status:** S1–S5, B.

### 15 — Authored availability and mandatory procedure do different jobs

- **Purpose:** Teach an important AgentScript control distinction.
- **On-slide text:** “A required check belongs in procedure logic. `available when` controls actions offered during model reasoning. Bound arguments constrain inputs. The service rechecks authorization before a write.”
- **Visual:** Four small consecutive annotations over the existing graph: required access check; eligible action set; trusted ID binding; backend authorization. If code is shown, use a verified fragment or label it “design pseudocode.”
- **Speaker cue:** Filtering the available actions does not force the model to choose one. A successful parser check does not validate a deployment. Do not invent a `koa-action` target URI or an SDK.
- **Source / status:** S3, S5, B. Documented concepts with proposed composition.

### 16 — Follow one complete service trace

- **Purpose:** Turn abstract architecture into a memorable execution story.
- **On-slide text:** “1 Interpret both tasks → 2 clarify priority → 3 verify access → 4 fetch invoice facts → 5 explain and confirm → 6 resume the outage.”
- **Visual:** Timeline with component ownership above each step and task-ledger state below. “Explanation delivered” and “task resolved” appear as distinct events. Show outcome predicates rather than a green check based only on generated prose.
- **Speaker cue:** This is a constructed trace. If the invoice remains disputed, leave it open or record an accepted handoff. Keep the outage visible throughout. The generative model is used where a grounded explanation helps.
- **Source / status:** B, S1–S3. Constructed example.

### 17 — Failure routes are part of the program

- **Purpose:** Make reliability concrete at integration boundaries.
- **On-slide text:** “Invalid answer → validate and fall back. Timeout → bounded retry or handoff. Unauthorized write → service rejects. Repeated write → transaction safeguard.”
- **Visual:** Main graph with four short peach recovery branches, each returning to an explicit state or terminal handoff. A loop has a visible attempt budget.
- **Speaker cue:** A fallback must retain pending obligations. Workflow state does not provide exactly-once side effects; safeguards belong in the service implementing the write. Replaying a corrected trace is useful before another evaluation.
- **Source / status:** B, S2, S5; design guidance.

### 18 — Confidence needs local evidence

- **Purpose:** Stop confidence from becoming a disguised authorization decision.
- **On-slide text:** “A concentrated output can still be wrong. Select routing gates on labeled development data. Identity, policy, and permission remain trusted service checks.”
- **Visual:** Two separate concepts: a peaked option distribution and an observed-correctness tally. A dotted arrow says “validate the relationship.” A solid barrier separates the score from authorization.
- **Speaker cue:** TypeSafe defines Choice/Score confidence from distribution spread; Noul has no separate confidence field. Any `koa-action` uncertainty signal needs its own specified meaning. Never use the same numerical cutoff merely because both systems call it confidence.
- **Source / status:** T3, T7, T8, B.

### 19 — A stricter gate moves work somewhere

- **Purpose:** Teach risk/coverage and queue consequences before showing cost.
- **On-slide text:** “Track automated coverage beside error among automated cases. Escalation still consumes time and capacity. Sample apparent successes as well as handoffs.”
- **Visual:** An interactive threshold slider with an explicitly hypothetical population of dots flowing to automatic handling or review. Show counts, never implied deployment metrics; explain the construction in notes.
- **Speaker cue:** Error need not improve monotonically on every dataset. Review capacity can change latency and outcomes. The decision is a constrained operating point, not “maximize confidence.” If implementation cannot support a transparent simulation, use a static qualitative flow instead.
- **Source / status:** T3, B. Illustrative mechanism, not findings.

### 20 — Avoided work must exceed added work

- **Purpose:** Explain break-even with one intelligible algebraic model.
- **On-slide text:** “Baseline: G. Candidate: D + O + pG. Lower cost when D + O < (1 − p)G.” Legend: “D decision cost; O added orchestration; p fraction still using the same generative stage.”
- **Visual:** Stacked cost bars controlled by sliders for `p` and decision overhead; use normalized cost units. A visible break-even line changes color only when the inequality holds.
- **Speaker cue:** This deliberately simple illustration assumes the same generative-stage cost when invoked and excludes changed service/human costs. Then expand to whole-case accounting: all calls, tools, retries, follow-ups, and measured human work. Compare at equal service requirements and include unresolved obligations. Amortize build and maintenance investment separately over a stated horizon.
- **Source / status:** B, original algebra. Illustrative, not a `koa-action` estimate.

### 21 — Faster inference helps only the path that uses it

- **Purpose:** Distinguish primitive latency from time to resolution.
- **On-slide text:** “Measure client-observed decision latency, end-to-end response latency, and time to resolution. Retries, sequential dependencies, and review queues can dominate the total.”
- **Visual:** A route diagram above a timeline: short decision call → lookup → explanation, versus short decision call → review queue. Parallel checks share a time bracket; dependent steps add.
- **Speaker cue:** Do not invent milliseconds. Measure p50 and p95 on the relevant route with arrival load recorded. For resolution, account for cases still unfinished at the observation deadline; completed-only averages reward abandonment.
- **Source / status:** B; methodological recommendation.

### 22 — Exercise: find the missing boundary

- **Purpose:** Require transfer of the mental model.
- **On-slide text:** “The classifier identifies a credit request with a strong score. The next node issues the credit. What must change?”
- **Visual:** A deliberately incomplete mini-graph. On reveal, insert trusted access and policy checks, a service-side authorization boundary, a bounded fallback, and a task-ledger update. Clearly mark the initial graph as an exercise.
- **Speaker cue:** Give 45 seconds for pairs or audience answers. The strongest answer names both workflow ordering and the backend's independent enforcement. A score threshold by itself is not a repair.
- **Source / status:** B, S2–S3. Constructed exercise.

### 23 — Begin the dataset at the decision boundary

- **Purpose:** Connect runtime contracts to supervised evidence.
- **On-slide text:** “Freeze the source snapshot. Label the question supported at decision time. Preserve record order, timestamps, case relationships, and the derivation manifest.”
- **Visual:** A transcript timeline cut at the decision; the input crop and independently adjudicated target travel separately into a versioned example record. Future turns are visible but cannot enter the input.
- **Speaker cue:** Reviewers should label mixed and unclear cases and adjudicate disagreement. Later outcomes may inform an outcome label but cannot leak into earlier evidence. Document redaction and filtering because they can change the data distribution.
- **Source / status:** B. Proposed methodology.

### 24 — Build a training pipeline that protects the test

- **Purpose:** Deliver the requested main vector illustration with a meaningful pedagogical purpose.
- **On-slide text:** “Group before splitting. Fit on training data. Tune on development data. Freeze before the locked test. Pilot before rollout.” Footer: “Proposed task development workflow; adaptation only where supported.”
- **Visual:** Pastel SVG pipeline with immutable source snapshot → grouping/deduplication → three separated lanes. Train lane: permitted adaptation or application component fitting. Development lane: calibration fitting and threshold selection, separated. Test lane: locked evaluation consumes frozen artifacts. All meet at acceptance gates, then controlled pilot, monitored rollout, reviewed feedback to a future dataset.
- **Speaker cue:** The illustration must not imply internal `koa-action` pretraining or public fine-tuning access. If model adaptation is unavailable, use the fixed model and fit application configuration. No feedback arrow returns to the current test set.
- **Source / status:** B, methodological proposal informed by T6.

### 25 — Choose the split that matches the claim

- **Purpose:** Explain dependence and generalization visually.
- **On-slide text:** “New-account performance: hold out account groups. Future-traffic performance: reserve a later-time cohort. Keep duplicates, related cases, and generated variants with their source.”
- **Visual:** Left: colored account-family groups assigned to partitions as intact bundles. Right: a time axis with a strict cutoff. A crossed example shows near-duplicate turns crossing partitions.
- **Speaker cue:** These are different deployment claims and may require separate tests. State boundary exclusions and deduplication rules. Generate augmentations only after the split. Repeated judgments of one trace measure repeatability, not additional case diversity.
- **Source / status:** B, L4; proposed evaluation design.

### 26 — Predeclare what would earn a rollout

- **Purpose:** Make “reliable and cheaper” a falsifiable joint claim.
- **On-slide text:** “Accept only if quality loss stays below its margin and saving exceeds its target. Consequential-error and latency limits must pass separately.” Two interval conditions: “upper bound on failure-rate increase < allowed margin” and “lower bound on saving per incoming case > required gain.”
- **Visual:** Two simple horizontal uncertainty intervals relative to predeclared limits, labelled “illustrative decision rule.” Include a fail state where cost clears but quality does not.
- **Speaker cue:** The null is unacceptable quality loss OR insufficient saving. A nonsignificant difference cannot establish acceptable equivalence. Define failed case as incorrect outcome or any requested task unresolved at a fixed deadline; include the outage. Set sample size and uncertainty method in advance.
- **Source / status:** B. Proposed statistical acceptance design, no reported results.

### 27 — Evaluate the decision, then the service

- **Purpose:** Keep offline studies and real-world causal evidence distinct.
- **On-slide text:** “Offline: same held-out snapshots, same route question, fixed permissions. Pilot: persistent randomized case/account assignment, equal observation windows, full service outcomes.”
- **Visual:** Two-stage evidence ladder: paired offline decision comparison → controlled service pilot → wider rollout. Under the pilot, ledger shows quality, coverage, cost, latency, and unfinished work.
- **Speaker cue:** Choose each model's gate separately on development data under the same quality constraints. Replay cannot reveal changed customer behavior or review-queue load. Account for related cases, assignment groups, and interference through shared queues.
- **Source / status:** B. Proposed experiment.

### 28 — Diagnose the boundary that failed

- **Purpose:** Show why disaggregation can make improvement more targeted.
- **On-slide text:** “Invoice explained; outage lost. Route = billing? Inspect evidence and decision labels. Route = mixed? Inspect the state transition. Correct trace, wrong outcome? Inspect the service and resolution rule.”
- **Visual:** Trace tree with three highlighted diagnostic branches. A small offline judge icon points to “prioritize review”; an independent human label remains a separate source.
- **Speaker cue:** Jev evaluator examples motivate low-cost trace triage, not verified correctness for this system. Repeatability and reference agreement are different. Sample apparent successes too. A post-run evaluator cannot prevent an action that already happened.
- **Source / status:** B, L3–L4. Constructed failure; original diagnostic method.

### 29 — Start with one decision that changes the path

- **Purpose:** Leave a concrete implementation sequence and a compelling close.
- **On-slide text:** “Choose a frequent bounded decision. Give it a testable contract. Put sequence and context in the graph. Keep business authority in trusted services. Earn expansion with end-to-end evidence.”
- **Visual:** The opening graph returns with one node emphasized, then the full task ledger shows both service obligations with honest final status. Four compact outcome captions: testable behavior, controlled variation, measured cost, measured latency.
- **Speaker cue:** Reliability and cost can improve together when the allocation is right, but the claim belongs to the measured service path. The next useful artifact is a contract and a small graph, followed by a held-out evaluation—not an unbounded rewrite of the whole agent.
- **Source / status:** B, S1–S3, T1, T6. Synthesis.

### 30 — Sources and implementation boundaries

- **Purpose:** Make the tutorial inspectable and useful after the talk.
- **On-slide text:** Three linked source clusters: Salesforce control/runtime; LangChain composition/evaluation; TypeSafe decision patterns. Link the complete local research ledger. Boundary note: “Proposed integration. No `koa-action` benchmark, public API, or training interface asserted.”
- **Visual:** A clean typographic reference layout with 3 columns and selected short links, using minimum legible size; move complete citations into speaker notes or a companion file rather than cramming all URLs.
- **Speaker cue:** The source ledger should map all 16 requested web pages plus the local article to content use. AgentScript repository and specification support language concepts; they do not establish a runnable managed deployment.
- **Source / status:** All source keys.

## Design and teaching tradeoffs

- The user asks for tutorial density and presentation drama. Use one claim and one explanatory visual per slide, with detail in presenter notes. A separate readable handout can carry contracts, source caveats, and the full evaluation procedure.
- Avoid beginning with a disclaimer wall. Establish the proposed-integration boundary in a short visible note on slide 4 and specific notes where APIs, output semantics, training access, or performance matter.
- The deck should visibly distinguish documented language behavior, proposed workflow choices, and hypothetical numeric examples. A small status label near the visual is sufficient; repeated large warning banners would impede teaching.
- Use reveal animation for the task ledger, context windows, and failure diagnosis. Honor reduced motion. All final states must remain clear when printed or read without animation.
- Use two substantive interactions at most: routing-gate effects and cost break-even. Both need an explicit construction and accessible keyboard controls. If no empirical dataset supports a risk curve, use hypothetical dots with transparent labels, never an apparently measured smooth chart.
- Keep arrows mostly left-to-right. A feedback path must say “future dataset version,” and no training/tuning arrow touches the locked test.
- No benchmark percentages or milliseconds appear in the core story. Discuss significant cost and speed improvements as achievable objectives whose magnitude must be demonstrated.
- Include errors and unfinished obligations in the economics; otherwise an attractive diagram can accidentally teach the system to save money by doing less of the customer's work.

## Version strategy for three preserved decks

1. **V1 — Establish the model.** Deliver the complete 30-slide teaching arc and all major graphics. Review for architectural truth, source boundaries, and cognitive overload.
2. **V2 — Repair understanding gaps.** Make source status local to each claim; improve the mixed-intent state trace, AgentScript procedure/availability distinction, risk/coverage explanation, and cost exclusions based on critique. Review for trace correctness, misleading metrics, visual hierarchy, and interaction accessibility.
3. **V3 — Teach under realistic presentation conditions.** Tighten text after rendering, strengthen exercise reveals, test reduced motion, presenter notes, print states, keyboard navigation, and narrow viewports. Add all evidence and review dispositions to a companion record. Each version is a separate immutable deliverable after completion.

## Adversarial questions for reviewers

1. Can a reader confuse an inferred integration for a documented Salesforce capability?
2. Does any arrow imply a model can authorize an account action?
3. Can a mixed-intent request silently lose a task or count an explanation as resolution?
4. Does the confidence visual imply a probability of correctness or monotonic risk reduction without evidence?
5. Does any economics result omit work that moved into tools, humans, future follow-up, or uncompleted cases?
6. Does the training pipeline leak future evidence or let tuning reach the test set?
7. Does any example silently import Jev API, calibration, training, or benchmark properties into `koa-action`?
8. Can the slide be understood without its animation, color, or speaker notes?
9. Does the topology thesis still leave room for definitions and factual context inside model calls?
10. Does the final teaching sequence give an engineer a bounded first change they can actually evaluate?
