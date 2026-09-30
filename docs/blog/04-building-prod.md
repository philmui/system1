# Building Prod with `koa-action`, Agent Graph and AgentScript

A customer writes, “My invoice looks wrong, and the service has stopped working.” A useful agent has to preserve both requests, establish which account the customer can access, and choose what to handle first. Language interpretation is part of the work; so are business rules and the execution of ordinary software.

That combination gives a fast decision model a practical role. `koa-action`, our System One model, is intended for bounded decisions including classification, noul, scoring, and semantic endpointing. Agent Graph coordinates the Agentforce workflow, while AgentScript configures the state, conditions, and actions that shape its behavior.

[LangChain’s *Building Prod with Jev and LangGraph*](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph) motivates a similar division of work. Here we develop an original Salesforce service example. The integration and training process are proposals: the supplied public sources do not establish a `koa-action` API, fine-tuning interface, or benchmark for this design.

## Start with the decision contract

For our customer’s message, the first decision is which handling route to enter. Define that question before choosing a model. A single route can represent a mixed request without discarding either of its underlying tasks.

| Part of the proposed application contract | Definition |
| --- | --- |
| Evidence | The conversation available so far, with the relevant service context. |
| Allowed routes | `billing`, `technical`, `account_access`, `mixed`, or `unclear`. |
| Mixed request | Preserve both tasks; ask the customer which to address first. |
| Unusable result | A timeout or invalid response enters a configured fallback; it never selects a business action by default. |
| Clarification limit | After a predefined turn or time budget, offer a human handoff and retain unresolved tasks. |

These are application design choices, not `koa-action` response fields. The other capabilities address different questions. A rubric-based score can estimate urgency. Semantic endpointing assesses whether a spoken turn is complete enough to process. For noul, the proposed use is a binary semantic assessment—for example, whether cancellation was requested. TypeSafe uses [Noul](https://docs.typesafe.ai/primitives/noul) for a probability-valued yes/no judgment; its exact semantics and schema are not a verified contract for `koa-action`.

If an integration supplies numerical decision signals, preserve what each means. A proposition probability, an urgency score, and a confidence summary are different quantities. Their decision thresholds need separate validation.

## Follow the request through Agent Graph

A graph connects units of work through allowed transitions. State holds the information those steps share. In this example, state includes the customer’s two requests, the active task, and the trusted account context available to the current session.

Suppose the model returns the proposed `mixed` route. The workflow asks which problem should come first; the customer chooses the invoice. The billing task becomes active, and the outage remains pending. After the system establishes the caller’s access to the selected account, an authorized lookup supplies the invoice facts. A specialist language model can then explain an unfamiliar charge. The workflow records that the explanation was delivered, then waits for the configured resolution criterion, such as customer confirmation. An accepted handoff is recorded separately from resolution, with the receiving queue and outstanding work retained. The outage stays pending until addressed or explicitly reprioritized; the system does not count a generated claim of completion as a completed task.

The distinction between a model result and a transition matters. `mixed` is an interpretation. Preserving two tasks and asking a priority question are configured behavior. The account lookup supplies facts within an already authorized scope; merely finding an account does not authenticate its caller.

Salesforce’s [Agent Graph description](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/) explains how explicit state and graph structure support hybrid reasoning. The useful LangGraph comparison is architectural. Agent Graph is a Salesforce-managed Agentforce runtime, not a claim of LangGraph API compatibility.

## Give AgentScript an explicit control job

AgentScript expresses how the Agent Graph workflow combines learned interpretation with programmed rules. This is the neuro-symbolic aspect: neural models process language, while explicit state and conditions govern the permitted process. Guided determinism concerns those authored constraints; model judgments and generated explanations can still be wrong.

In our proposed service flow, AgentScript would specify the mixed-request branch, retain the pending task, and establish the preconditions for the billing path. The [public control-plane article](https://www.salesforce.com/blog/agent-script-control-plane/) describes `available when`, which filters actions offered during model reasoning. An available action may still go unselected. A mandatory precheck belongs in deterministic procedure logic before the relevant business action, and the transaction service must enforce authorization itself.

If the customer later requests a credit, the service performing that write must check the caller, account, and current eligibility. Account identifiers used for consequential actions should be bound from trusted application state rather than accepted from model extraction. A high-scoring “credit requested” judgment cannot supply any of these permissions.

The [open Agent Script repository](https://github.com/salesforce/agentscript) contains language tooling; execution remains in Salesforce’s managed runtime. This makes the authoring boundary concrete without requiring an invented SDK example.

## Preserve the evidence before training

The learning problem begins with the next-route contract. Reviewers should label the route justified by the evidence available at that decision, including `mixed` and `unclear`, and adjudicate disagreements. A label for the customer’s eventual resolution answers a different question from a label for the appropriate next step.

Freeze a versioned source snapshot with record identifiers, turn order, timestamps, and case relationships. For each example, reconstruct only the conversation prefix and trusted account-state snapshot available at the decision time. Subsequent turns and outcomes may support a separate outcome label; they must not enter the earlier model input. Reviewers labeling the appropriate next route should see the same decision-time evidence as the model.

This distinction is especially important for semantic endpointing. A recording’s future speech reveals whether the customer continued, so it can supply the target label while remaining excluded from the prefix being judged. Measure premature cutoffs and delay after a true turn ending separately. Keep every prefix from a conversation in the same partition.

![Proposed training and validation pipeline: a versioned dataset splits before augmentation into training, validation, and locked testing; only frozen artifacts reach the test, and monitored feedback feeds a future dataset.](assets/training-pipeline.svg)

*Figure 1. Proposed task adaptation and evaluation for `koa-action` decisions. Training data fits supported components; validation selects calibration and routing rules; the locked test evaluates the frozen workflow. Reviewed production feedback enters a future dataset. This is an application-development design, not a disclosed `koa-action` pretraining process.*

Split related cases into training, validation, and test groups before creating paraphrases or other variants. Check for duplicates across boundaries, and keep derived examples with their source. If the claim concerns unseen accounts, group by account; if it concerns future traffic, reserve a later-time cohort and prevent related records from leaking across that boundary. Record any exclusions so the evaluated population is clear.

Preserving the dataset means retaining the source records and their structure, with a manifest linking every derived example to its origin and partition. Redaction, filtering, and resampling can change what the model sees; record those changes and report their counts. We cannot claim that training leaves the dataset’s exact distribution unchanged.

Fit learned preprocessing and any supported adaptation on training data only. If `koa-action` cannot be adapted, omit that step and evaluate the fixed model with application-level configuration. Keep calibration fitting separate from threshold selection within the development data, then freeze the model, decision definitions, preprocessing, and routing policy. Test cases have no role in choosing any of them.

## Decide what would count as an improvement

For this example, define workflow quality as the fraction of attempted cases with an incorrect outcome or any requested task unresolved at the end of a fixed service window. Both the billing request and outage count. Track consequential mistakes, such as an unauthorized credit, separately within all cases that reach the corresponding action opportunity. An aggregate service metric must not hide those failures.

Specify a maximum tolerable increase in the case-failure rate and a minimum worthwhile latency improvement before testing. The null hypothesis is that quality loss reaches the allowed margin or the latency benefit falls short of the required gain. Release needs uncertainty bounds supporting both requirements. Failure to detect a quality difference is insufficient, and rare-action safety gates may still block a candidate that passes the overall comparison.

First compare `koa-action` with a general-purpose model answering the same next-route question on the same held-out snapshots. Hold graph structure, authoritative facts, and available actions fixed. Select each model’s numerical gates on development data under the same quality constraints; their signal scales may differ. This paired replay estimates decision quality and client-observed decision latency, including retries. It cannot measure how real customers or review queues respond to changed routes.

Then assess the complete workflow in a separately controlled service pilot. Define its latency clock from intake to resolution within the service window, keep unresolved cases in the outcome report, and include waits, retries, fallback calls, and human work. Comparing only completed cases can favor a system that abandons difficult ones. Choose a time-to-resolution analysis that accounts for unresolved cases; record total cost per attempted case and the fraction completed by the deadline as complementary measures.

Report automatic coverage alongside error among automatically handled cases. Estimate uncertainty at the independent case or account-group level, with the sample size and confidence procedure chosen before opening the test. Repeated calls on the same conversation measure repeatability; they do not create independent customer situations. If the bounds cannot rule out unacceptable loss, the result is inconclusive and the candidate has not earned release.

## Follow uncertainty through production

Where the integration exposes confidence, evaluate its relationship to correctness on local cases. A concentrated output distribution can still support a wrong classification. Measure errors among automatically routed cases at different levels of coverage—the fraction handled without escalation—then choose the operating point on validation data.

An offline judge can help review traces, but the judge should also be compared with human references. [LangChain’s Jev evaluation articles](https://www.langchain.com/blog/jev-agent-evals-langsmith) make repeatability an interesting measurement; repeatability alone cannot establish correctness for a new task or a different model.

Consider three illustrative outcomes. A clear invoice question reaches billing and produces an authorized explanation. A mixed request reaches clarification and takes longer, preserving the information needed for the next decision. A wrongly routed request triggers investigation of the label definitions, decision-time context, model, and workflow policy; it becomes a training example only after that diagnosis. These examples describe what to test, rather than results from a deployed Salesforce system.

Review samples of apparently successful automated cases as well as escalations. Otherwise, confident mistakes can disappear from the feedback stream. Human adjudication should establish the new labels; copying the previous model’s decision would reinforce its errors. After tuning against those findings, reserve fresh untouched cases for a new performance claim.

The first implementation should focus on one decision with an observable consequence. Define its contract, represent the surrounding workflow in Agent Graph, configure its controls with AgentScript, and evaluate the complete path. Expansion becomes defensible when the team can explain the remaining errors and show that the new decision step improves the service outcome under the chosen constraints.
