# LangChain source research

Read on 2026-09-28. All four requested pages were reachable, and their substantive text was read. No `AGENTS.md` was present in this repository or its ancestor directories when checked. These notes support an original Salesforce article; they do not establish Salesforce product capabilities.

## 1. Building Prod with Jev and LangGraph

Source: [LangChain, September 25, 2026](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph).

The article separates semantic judgment from workflow execution. Jev supplies structured decisions; LangGraph organizes work around nodes, shared state, and conditional edges. Graph structure determines which context a decision receives and which subsequent operations are permitted. The runtime discussion covers persisted execution, human interruption, and traces.

Its demonstration reviews discovery documents. Semantic checks determine relevance, personal-information handling, and possible privilege; the workflow routes documents to disposition, generative redaction, or attorney review. A later browser example selects from available UI actions and falls back to a generative model when a confidence gate is unmet. The central editorial argument is specialization: use a bounded model where the choice set is constrained and reserve expensive generation or review for the remaining branches.

The article reports vendor benchmarks and demonstration-specific speedups. Those measurements belong to their particular models and workloads. They supply no evidence for `koa-action` performance, correctness, or compatibility. LangGraph guarantees likewise require separate evidence before being attributed to Agent Graph.

## 2. Building a Harness with Jev

Source: [LangChain, September 17, 2026](https://www.langchain.com/blog/building-a-harness-with-jev).

This article locates a decision model inside an agent loop. The input combines state with typed questions; the output can select among options, score an ordered rubric, or estimate the probability of a yes/no proposition. It introduces `noul` as the last of those, explains multi-question requests, and demonstrates the LangChain `TypeSafeClassifier` integration.

Two applications make the architecture concrete. A model-selection middleware chooses an execution model using task criteria. A tool-risk middleware classifies proposed operations before execution. The discussion positions decision models alongside generative models and attributes reinforcement learning for calibrated decisions to Jev.

For Salesforce drafting, the relevant analogy is a bounded classification point in a larger workflow. The TypeSafe Python package, middleware APIs, training method, response schemas, parallel execution behavior, and latency claims cannot be renamed as `koa-action` features. A risk prediction also requires ordinary authorization and business-policy enforcement; a model score alone does not establish that an operation is allowed.

## 3. Jev is now available in LangSmith Evals

Source: [LangChain, September 21, 2026](https://www.langchain.com/blog/jev-is-now-available-in-langsmith-evals).

The announcement describes Jev as a LangSmith evaluation provider. An evaluator maps a run or thread into state, defines a question for each assessment criterion, and records answers as feedback keys that support filtering and monitoring. State carries the evidence; questions carry the rubric. Example assessments concern information leakage, intent, and frustration.

The article positions semantic decision models between exact programmatic checks and generative judges. It argues that lower evaluation cost can make wider trace coverage practical, while retaining a role for generative judges when written explanations or broader judgment are required. It summarizes the separate judge experiment below and explicitly limits that evidence to one agent. Its provider setup also includes a data-retention qualification specific to TypeSafe at publication.

This is primarily an assessment workflow. A score computed after an agent has acted cannot retrospectively prevent that action. Salesforce drafts should distinguish online monitoring, offline evaluation, and an inline gate that must complete before execution. Neither LangSmith integration nor TypeSafe retention behavior establishes anything about Salesforce interfaces or retention.

## 4. Jev-as-a-Judge for Agent Evals

Source: [LangChain, September 20, 2026](https://www.langchain.com/blog/jev-agent-evals-langsmith).

The experiment fixes five weather-agent outputs and presents those same captured examples to each judge. One human reviewer supplies reference labels. Each model evaluates every example 100 times; pass/fail agreement measures reference agreement, while within-example score variation measures repeatability. Reported Jev results are favorable on both measures, cost, and latency.

The authors distinguish consistent judgment from correct judgment, state that the comparison does not identify a causal training mechanism, and acknowledge the need to test other tasks. Reproducibility limitations include provider-default sampling settings for the generative judges and an unavailable Jev service version.

For the proposed Salesforce experiment, five independent traces repeated 100 times remain five examples of task diversity. Repeated judgments can estimate variability conditional on those traces; they do not establish broad deployment accuracy. Treat the human reference as an adjudicated measurement with its own uncertainty. Do not transfer reported accuracy, variance ratios, latency, cost, or the claimed training explanation to `koa-action`.

## Linked implementation inspected

The production article links a [document-review demonstration](https://gist.github.com/sydney-runkle/a632ba4ea0b2b72501dfa4b6ab2a7d8a). Its README and implementation describe six synthetic pages, one shared graph with interchangeable classifiers, an in-memory checkpoint, and scripted attorney responses. The notes expose two instructive failures: comparing a continuous expected score to an exact level produced incorrect branches, and a broad confidence gate sent five of six pages to review. Confidence definitions differed across providers. These are demonstration findings, not general calibration guarantees. The gist's performance table and article's headline comparison are not identical; avoid presenting them as one controlled benchmark.

## Editorial translation: recommendations, not documented Salesforce features

Use the user's supplied role definitions for `koa-action`, Agent Graph, and AgentScript, then ground any additional Salesforce behavior in Salesforce sources. A service case is a natural original example: identify intent and ambiguity from the conversation, read entitlement and ownership from authoritative records, then execute the permitted route. This separates semantic uncertainty from facts that can be checked directly.

| Responsibility | Salesforce framing to develop | Boundary to preserve |
| --- | --- | --- |
| Semantic decision | `koa-action` assesses a bounded question such as intent, urgency, or whether a conversational turn is complete. | Define the question and available evidence; do not assume an undocumented API or calibration guarantee. |
| Workflow execution | Agent Graph coordinates decisions, context, and actions. | Verify each runtime claim in Salesforce documentation; a conceptual comparison with LangGraph does not imply shared internals. |
| Decision control | AgentScript expresses the configured sequence, conditions, and scope for model involvement. | Show genuine syntax only when verified; label architecture sketches and application-defined contracts clearly. |
| Operational evaluation | A separate rubric checks recorded behavior and produces diagnostic feedback. | Keep evaluations distinct from execution permissions and deployment evidence. |

For the training-pipeline illustration, show a proposed process rather than inventing an internal training recipe: governed examples → deduplication and grouping → frozen train/development/test partitions → fitting on training data → threshold selection on development data → locked evaluation → monitored release. Preserve source records, timestamps, group membership, and partition manifests. Any augmentation, sampling, or representation changes should be explicit and restricted to their permitted partition; claiming that training preserves an identical dataset shape would be misleading without an actual implementation and definition of “shape.”

Suggested experiment: compare a generative decision baseline and the proposed `koa-action` route on the same held-out cases, with the same action permissions and escalation policy. Predeclare an acceptable error margin and operational targets; test routing quality, coverage, end-to-end latency, and total cost, including fallbacks and review. Estimate uncertainty at the independent case or customer-group level. Keep the test set untouched during prompt, model, and threshold selection. Since no such Salesforce results were supplied, write this as a validation plan, never as an experiment already completed.
