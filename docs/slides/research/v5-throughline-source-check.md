# Source check for the disaggregated-intelligence throughline

Checked September 29, 2026. This note separates published attribution, documented product roles, and the tutorial's proposed design.

## Historical framing and attribution

**Sydney Runkle and Hunter Lovell**, in **Building Prod with Jev and LangGraph**, published **September 25, 2026**, name **Jaya Gupta** and attribute the unbundling argument to her. Their closing section advocates “cheap by default, frontier on exception.” The preceding three-year characterization of predominantly frontier-model agent designs is an author generalization: the article supplies no survey, sampling frame, or measured population share. Its reported application timings do not establish that historical claim. The linked original Gupta post could not be read directly, so the verified attribution is LangChain's, rather than an independently examined original statement. [LangChain article](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph)

Use the argument with attribution, or explain the architectural choice without the historical claim. Do not turn that industry framing into a three-year development timeline for Salesforce Agent Graph or AgentScript.

## Salesforce roles that the sources support

| Component | Supported role | Boundary for this tutorial |
|---|---|---|
| **Agent Graph** | Salesforce describes a graph runtime with authored topology, node configuration, persistent state, and coordination through handoff or delegation. Its metadata can be configured through Agent Script. | A comparison with LangGraph explains a similar orchestration role; it does not establish API compatibility or a hosted LangGraph implementation. [Salesforce Engineering](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/) |
| **AgentScript** | The April 30, 2026 control-plane article describes a declarative language that compiles to a specification executed by a Salesforce-managed runtime. Procedures, bound inputs, and conditional action availability give the author distinct controls. | An available action is a permitted choice. Availability alone does not prove that a mandatory action executes. The open tooling and managed runtime are separate. [Salesforce control-plane article](https://www.salesforce.com/blog/agent-script-control-plane/) |
| **System One / `koa-action`** | The user supplies `koa-action`'s positioning as a specialized model for classification, noul, scoring, and semantic endpointing. Public Salesforce writing independently supports assigning targeted jobs to specialized models. | The reviewed sources do not establish a named `koa-action` API, native AgentScript integration, benchmark, or calibrated confidence output. Use an explicitly proposed application adapter and decision contract. |

The September 16, 2026 Salesforce article by **Jayesh Govindarajan and Silvio Savarese** describes an **18-month** move toward smaller task-specific models and names HyperClassifier, TextEval, and Moirai. It separately positions **Koa** for multistep enterprise reasoning. This supports the specialization theme, but neither establishes the requested three-year Graph/AgentScript history nor licenses equating public Koa with `koa-action`. Do not transfer Koa's architecture or performance claims to the tutorial's System One component. [Salesforce's reasoning-model article](https://www.salesforce.com/news/stories/why-we-post-trained-our-own-reasoning-model/)

## Recommended teaching claim

Start with services and code for authoritative facts and exact policy. Use an economical model for bounded semantic decisions where evaluation shows it is adequate. The authored graph coordinates the resulting tasks, preserves their state, and invokes additional interpretation only under defined conditions. AgentScript configures the control around those decisions. Frontier reasoning is an exception path for remaining interpretation, while missing facts, failed checks, and unsupported handlers follow their own routes.

This is the tutorial's design recommendation, not a documented native integration. Lower cost and faster inference remain empirical goals constrained by acceptable task quality and end-to-end latency. TypeSafe documents confidence as a summary of the answer distribution and recommends testing thresholds on local data; interpreting a signal as a calibrated probability of correctness requires separate evidence. [TypeSafe confidence documentation](https://docs.typesafe.ai/confidence)
