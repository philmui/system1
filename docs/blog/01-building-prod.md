# Building Prod with `koa-action`, Agent Graph and AgentScript

A customer asks an agent to explain an invoice, then adds that the service has stopped working. The agent has to distinguish two requests, retain the account context, and choose the next step. Some of that work requires interpreting language. Checking the account’s permissions and deciding whether a credit is allowed require explicit business rules. A fluent answer alone does not complete the job.

This is a useful place to bring a fast decision model into an enterprise workflow. `koa-action`, our System One model, supplies bounded judgments such as classification, noul, scoring, and semantic endpointing. Agent Graph supplies the Agentforce runtime that coordinates the work. AgentScript configures how that runtime combines model judgments with programmed control.

[LangChain’s *Building Prod with Jev and LangGraph*](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph) explores the same broad architectural opportunity: use specialized judgments inside a graph whose execution remains explicit. The Salesforce design developed here applies that idea to customer service. It is a proposed integration; the public references do not document a `koa-action` interface or training recipe, and we make no measured performance claim for this combination.

## Give each decision a useful boundary

A System One model handles a constrained judgment rather than producing an open-ended response. For service intake, classification could select among billing, technical support, account access, and a clarification route. A noul supplies a probability-like assessment of a binary question, such as whether the message contains a request to cancel. Scoring evaluates an input against a defined rubric. Semantic endpointing estimates whether an utterance is complete enough to process, which matters when a customer pauses in the middle of a voice request.

These operations need distinct contracts. A category, a binary assessment, and an urgency score carry different meanings; the application should validate each result before deciding what to do with it. TypeSafe’s [primitive-oriented approach](https://typesafe.ai/manifesto) helps motivate this decomposition, but its SDK fields and model guarantees should not be assumed for `koa-action`.

For every decision, specify the information it can read, the allowed outputs, and the route for an unusable answer. Include ambiguity in the design. A mixed billing and technical request may need to be separated into two tasks before either specialist begins.

## Keep the workflow in Agent Graph

A graph represents work as nodes connected by allowed transitions. State records the information those nodes need: the current request, verified account context, completed steps, and unresolved questions. In the proposed service flow, intake leads to a semantic decision, then to a bounded handling path. A specialist language model can explain an unusual invoice; a deterministic service can retrieve an account balance.

Salesforce describes Agent Graph as the foundation for [hybrid reasoning and guided determinism](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/). The useful comparison with LangGraph is architectural: both place model calls within a larger workflow. Agent Graph is Salesforce’s managed Agentforce runtime; this comparison does not imply that it hosts LangGraph or accepts LangGraph code.

The state also helps with conversation changes. If a customer interrupts a billing discussion to ask about an outage, the application should retain the unfinished billing task and make the next transition explicit. Whether it answers immediately or queues a second task is a business decision represented in the workflow.

## Express control with AgentScript

AgentScript provides a configuration language for the Agent Graph runtime. Its combination of programmed logic and language-model reasoning is often called neuro-symbolic: the model interprets ambiguous input, while explicit variables, conditions, and action contracts govern execution. Guided determinism describes the resulting control over which paths are available.

The public [Agent Script control-plane explanation](https://www.salesforce.com/blog/agent-script-control-plane/) shows how action availability and bound inputs constrain model-driven behavior. For a proposed credit workflow, account identity should come from a trusted lookup, and an action that issues money should enforce permissions and eligibility within the service performing the write. A confident billing classification does not satisfy those conditions.

This separation makes failures easier to locate. A mistaken category points to the decision task or its context. An action exposed before verification points to workflow configuration. A duplicate credit after a retry points to the action’s execution contract. Each problem needs a different correction.

## Build the training and evaluation pipeline around the decision

Start with the question the model will answer. Assemble a versioned collection of representative service conversations, preserving the original records and their relationships. Have reviewers label the requested intent and record disagreements rather than silently forcing every example into a category.

Split the collection into training, validation, and testing groups before generating alternate phrasings. Keep all turns of a conversation and related versions of a case in one partition. Fit preprocessing and any supported task adaptation on training data. Use validation data to choose decision thresholds and configure escalation. Reserve the test data for evaluating the frozen candidate.

This is a proposed task-development protocol, not a description of `koa-action` pretraining. The goal is to prevent familiar cases from appearing on both sides of the evaluation while keeping enough information to investigate mistakes. If the deployed model cannot be adapted, the same partitions can support configuration and evaluation without a training step.

The initial hypothesis should be modest: introducing a specialized decision step will not yet be assumed to improve the service workflow. Compare it with a general-purpose model making the same bounded judgments, keeping the surrounding graph and input context fixed. Measure decision errors alongside total handling time and cost. Report failures as well as completed cases, since a shorter route that abandons difficult requests offers a misleading improvement.

## Follow uncertainty through production

A model’s returned confidence needs evaluation on the cases where the application will use it. A concentrated output distribution can still support a wrong classification. Measure errors among automatically routed cases at different levels of coverage—the fraction handled without escalation—then choose the operating point on validation data.

An offline judge can help review traces, but the judge should also be compared with human references. [LangChain’s Jev evaluation articles](https://www.langchain.com/blog/jev-agent-evals-langsmith) make repeatability an interesting measurement; repeatability alone cannot establish correctness for a new task or a different model.

Consider three illustrative outcomes. A clear invoice question reaches billing and produces an authorized explanation. A mixed request reaches clarification and takes longer, preserving the information needed for the next decision. A wrongly routed request exposes a gap in the taxonomy or training examples and becomes a candidate for the next development cycle. These examples describe what to test, rather than results from a deployed Salesforce system.

The first implementation should focus on one decision with an observable consequence. Define its contract, represent the surrounding workflow in Agent Graph, configure its controls with AgentScript, and evaluate the complete path. Expansion becomes defensible when the team can explain the remaining errors and show that the new decision step improves the service outcome under the chosen constraints.
