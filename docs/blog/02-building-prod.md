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
| Unusable result | A timeout or invalid response takes a bounded fallback; it never selects a business action by default. |

These are application design choices, not `koa-action` response fields. The other capabilities address different questions. A rubric-based score can estimate urgency. Semantic endpointing assesses whether a spoken turn is complete enough to process. For noul, the proposed use is a binary semantic assessment—for example, whether cancellation was requested. TypeSafe uses [Noul](https://docs.typesafe.ai/primitives/noul) for a probability-valued yes/no judgment; its exact semantics and schema are not a verified contract for `koa-action`.

If an integration supplies numerical decision signals, preserve what each means. A proposition probability, an urgency score, and a confidence summary are different quantities. Their decision thresholds need separate validation.

## Follow the request through Agent Graph

A graph connects units of work through allowed transitions. State holds the information those steps share. In this example, state includes the customer’s two requests, the active task, and the trusted account context available to the current session.

Suppose the model returns the proposed `mixed` route. The workflow asks which problem should come first; the customer chooses the invoice. The billing task becomes active, and the outage remains pending. After the system establishes the caller’s access to the selected account, an authorized lookup supplies the invoice facts. A specialist language model can then explain an unfamiliar charge. Once billing is resolved, the workflow returns to the pending outage task.

The distinction between a model result and a transition matters. `mixed` is an interpretation. Preserving two tasks and asking a priority question are configured behavior. The account lookup supplies facts within an already authorized scope; merely finding an account does not authenticate its caller.

Salesforce’s [Agent Graph description](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/) explains how explicit state and graph structure support hybrid reasoning. The useful LangGraph comparison is architectural. Agent Graph is a Salesforce-managed Agentforce runtime, not a claim of LangGraph API compatibility.

## Give AgentScript an explicit control job

AgentScript expresses how the Agent Graph workflow combines learned interpretation with programmed rules. This is the neuro-symbolic aspect: neural models process language, while explicit state and conditions govern the permitted process. Guided determinism concerns those authored constraints; model judgments and generated explanations can still be wrong.

In our proposed service flow, AgentScript would specify the mixed-request branch, retain the pending task, and establish the preconditions for the billing path. The [public control-plane article](https://www.salesforce.com/blog/agent-script-control-plane/) describes `available when`, which filters actions offered during model reasoning. An available action may still go unselected. A mandatory precheck belongs in deterministic procedure logic before the relevant business action, and the transaction service must enforce authorization itself.

If the customer later requests a credit, the service performing that write must check the caller, account, and current eligibility. Account identifiers used for consequential actions should be bound from trusted application state rather than accepted from model extraction. A high-scoring “credit requested” judgment cannot supply any of these permissions.

The [open Agent Script repository](https://github.com/salesforce/agentscript) contains language tooling; execution remains in Salesforce’s managed runtime. This makes the authoring boundary concrete without requiring an invented SDK example.

## Build the training and evaluation pipeline around the decision

Start with the question the model will answer. Assemble a versioned collection of representative service conversations, preserving the original records and their relationships. Have reviewers label the requested intent and record disagreements rather than silently forcing every example into a category.

Split the collection into training, validation, and testing groups before generating alternate phrasings. Keep all turns of a conversation and related versions of a case in one partition. Fit preprocessing and any supported task adaptation on training data. Use validation data to choose decision thresholds and configure escalation. Reserve the test data for evaluating the frozen candidate.

This is a proposed task-development protocol, not a description of `koa-action` pretraining. The goal is to prevent familiar cases from appearing on both sides of the evaluation while keeping enough information to investigate mistakes. If the deployed model cannot be adapted, the same partitions can support configuration and evaluation without a training step.

Before testing, define how much quality loss the application can tolerate and what operational improvement would justify the change. The null hypothesis is that the candidate exceeds that quality margin or does not improve the chosen operational measure. Demonstrating a benefit requires evidence against both parts; a nonsignificant accuracy difference does not establish equivalent quality.

Compare `koa-action` with a general-purpose model answering the same bounded question on the same held-out cases, with the graph and context fixed. Select each model’s gates on validation data under the same quality requirements. Report total handling time and cost, including escalation, failed calls, and unresolved cases. Estimate uncertainty using independent case groups; repeated calls on one conversation do not create additional independent examples.

## Follow uncertainty through production

Where the integration exposes confidence, evaluate its relationship to correctness on local cases. A concentrated output distribution can still support a wrong classification. Measure errors among automatically routed cases at different levels of coverage—the fraction handled without escalation—then choose the operating point on validation data.

An offline judge can help review traces, but the judge should also be compared with human references. [LangChain’s Jev evaluation articles](https://www.langchain.com/blog/jev-agent-evals-langsmith) make repeatability an interesting measurement; repeatability alone cannot establish correctness for a new task or a different model.

Consider three illustrative outcomes. A clear invoice question reaches billing and produces an authorized explanation. A mixed request reaches clarification and takes longer, preserving the information needed for the next decision. A wrongly routed request exposes a gap in the taxonomy or training examples and becomes a candidate for the next development cycle. These examples describe what to test, rather than results from a deployed Salesforce system.

The first implementation should focus on one decision with an observable consequence. Define its contract, represent the surrounding workflow in Agent Graph, configure its controls with AgentScript, and evaluate the complete path. Expansion becomes defensible when the team can explain the remaining errors and show that the new decision step improves the service outcome under the chosen constraints.
