# Salesforce source notes

Research date: 2026-09-28. These notes distinguish documented capabilities from proposed blog architecture. No local `AGENTS.md` was found in the workspace or its ancestor directories. The repository's existing application uses Jev and LangGraph; its measurements are not evidence for `koa-action` or Agent Graph.

## 1. Agent Graph and guided determinism

Source: [Agentforce's Agent Graph: Toward Guided Determinism with Hybrid Reasoning](https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/).

The engineering interview describes a business process as tasks connected by explicit transitions. It distinguishes topology design—nodes, contracts, handoffs, recovery—from each node's model, tools, instructions, and lifecycle behavior. Runtime state records workflow position and conversational context, helping a process resume after a diversion. The article describes handoff, which transfers conversational context, and delegation, which returns specialist results to an orchestrator. Agent Script is presented as an authoring layer over graph metadata. Forward-looking passages discuss future optimization and language development; they should not be quoted as current release guarantees.

Editorial use: explain where a classification result enters a controlled workflow and why execution state matters. Avoid importing the article's absolute language about never losing context or universal reliability into an untested example. Agent Graph can be compared conceptually with a managed graph runtime; this source does not establish LangGraph compatibility or identify it as hosted LangGraph.

## 2. Autonomous and reliable enterprise agents

Source: [Building Enterprise AI Agents That Are Both Autonomous and Reliable](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/).

The article separates orchestration, state, and external actions, using identity verification before a refund as its example. Graph transitions can require explicit validation results, while language generation and interpretation remain probabilistic. It describes specialized subagents, handoff and delegation, and smaller fine-tuned models for routing. The reported approximately 50 ms routing observations apply to that account's described models and workload; they are not a `koa-action` benchmark. Its evaluation discussion includes synthetic conversations, model-based judges, operational metrics, and traces.

Editorial use: give each decision an explicit owner. A language classifier may identify a refund request; a trusted service establishes whether the caller is authorized to act on that account. The graph carries these distinct results through the workflow. Persistent state and structural gates do not remove implementation errors, external failures, or the need to enforce policy in the underlying action.

## 3. Agent Script as a control plane

Source: [Agent Script: The Control Plane for Agentic Decisions](https://www.salesforce.com/blog/agent-script-control-plane/), April 30, 2026.

Agent Script is an indentation-sensitive, declarative language that compiles to a specification for a Salesforce-managed runtime. Its typed state, deterministic procedures, action bindings, and model reasoning appear in one reviewable artifact. `available when` determines which actions are presented to the model; conditions and rendered instructions are reevaluated during the reasoning loop. `with` binds an argument; `...` leaves an argument for model extraction. Actions can target existing Apex or Flow implementations. The article also identifies platform permissions as a separate restriction on access.

The open-source release includes language tooling rather than the executing Salesforce runtime. Describing the local playground as an independent production runtime would be misleading. A gated action can still require model selection, and the model can answer instead of acting. Therefore, filtering available actions does not guarantee eventual completion. The article's sample email lookup is an illustration; finding an email record alone is not sufficient authentication for an actual transaction.

## 4. Everything Agents guided-determinism tutorial

Source: [Guided determinism](https://everythingagents.org/topics/guided-determinism), especially lessons [3](https://everythingagents.org/topics/guided-determinism/03-the-mental-model), [4](https://everythingagents.org/topics/guided-determinism/04-anatomy-of-a-turn), [8](https://everythingagents.org/topics/guided-determinism/08-bug-permission-filter), [9](https://everythingagents.org/topics/guided-determinism/09-bug-planner-lies), [10](https://everythingagents.org/topics/guided-determinism/10-defense-in-depth), and [12](https://everythingagents.org/topics/guided-determinism/12-research).

The tutorial organizes control around subagent boundaries, instructions, action availability, and deterministic state updates. Its concrete debugging stories concern missing tool permissions and a purported mismatch between backend outputs and planner-held values. These are useful prompts for examining actual execution traces, but the tutorial is not the formal runtime contract. Lesson 12 places the architecture in the neuro-symbolic tradition: explicit state and constraints surround neural interpretation.

Access record: the index and several lessons failed in `web.open`; direct HTTPS retrieval succeeded. Lessons 10 and 12 were also accessible through search results. Claims about planner-mediated `@outputs` require careful treatment: the public language specification describes action outputs and callback scope without establishing that universal behavior. Do not resolve the discrepancy by asserting either implementation detail as verified. Test the target runtime and keep authorization in the backend.

## 5. Public Agent Script repository and specification

Sources: [repository](https://github.com/salesforce/agentscript), [formal specification](https://github.com/salesforce/agentscript/blob/main/SPEC.md). Inspected remote HEAD: `2a387cb29bcf573dbe7e209b15a15af0469d0567`.

The repository supports parsing and linting multiple dialects, Agentforce compilation, and editor tooling. It explicitly excludes the managed runtime. The specification defines `run` for invoking actions, `set` for state assignment, and `transition to` for routing. `available when` is restricted to reasoning-action bindings. Action outputs are scoped to their callback, and the specification leaves action-failure handling to the runtime. The README and examples contain both `topic` and `subagent` terminology; dialect and version matter.

Editorial use: show a small, labeled design fragment only if useful, or prefer language-neutral pseudocode for an undocumented `koa-action` adapter. Do not invent action target URIs, authentication methods, SDK classes, confidence fields, model versions, retries, or checkpoint APIs. A parse result alone is not evidence that a complete Agentforce deployment works. Any executable sample would need pinned tooling, the correct dialect, complete action definitions, and validation against a configured Salesforce runtime.

## Original architectural assessment for the article

The strongest educational example is a service intake workflow. A customer describes an order problem; `koa-action` produces a bounded classification or score; code checks its shape and applies the reviewed routing policy; Agent Graph dispatches to an allowed path; the specialized agent gathers context; an authorized backend action executes only after checking its own preconditions. AgentScript holds the authored state transitions and capability gates. An ambiguous classification should select an explicit clarification or escalation path rather than silently becoming an authorized transaction.

This is a proposed composition. The user's brief supplies `koa-action` as a System One model for classification, `noul`, scoring, and semantic endpointing. The researched Salesforce sources do not establish its public API, what `noul` expands to, confidence calibration, training interface, measured latency, availability, or specific native Agent Graph integration. Keep that uncertainty explicit, and do not borrow another vendor's API or benchmark as a substitute.

The three concepts should remain distinct:

| Component | Role in the proposed design | What it does not establish by itself |
| --- | --- | --- |
| `koa-action` | Supplies a bounded, probabilistic decision signal. | Identity, access rights, business truth, or calibrated certainty. |
| Agent Graph | Carries state and enforces authored execution paths. | Correctness of the model signal or of an external transaction implementation. |
| AgentScript | Declares state, procedures, action availability, and reasoning configuration. | A standalone runtime or verified support for an invented integration API. |

For a training-pipeline illustration, label all training stages as a proposed supervised specialization workflow, conditional on supported training access. Group related conversations before splitting so adjacent turns, duplicate cases, and generated variants cannot cross partitions. Keep an immutable test set away from prompt, threshold, and training iteration. Validation selects a model and routing threshold; the held-out test estimates performance of that frozen choice. Deployment feedback can seed the next training cohort after review, but cannot retroactively modify the current test result. This is a methodology recommendation, not a claim about an existing Salesforce data pipeline.

Security assessment: gate state must have known provenance. A successful classifier result never substitutes for a verified principal or entitlement. Model-visible outputs and conversationally extracted IDs should not authorize external actions. A nonce is useful only when the server validates its authenticity, scope, expiry, and allowed use; mere presence of a UUID-shaped string proves nothing. Backends should recheck authorization and use transaction safeguards appropriate to the action.

The article can use “guided determinism” to mean that authored constraints restrict where uncertain reasoning can affect execution. It should not promise deterministic prose, perfect routing, guaranteed completion, exactly-once side effects, or infallibility. Likewise, “neuro-symbolic” needs only a plain explanation: neural models interpret language while explicit software rules govern consequential steps.
