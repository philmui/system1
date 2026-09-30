**Role**: You are an expert technical slide creator and a master educator of agentic systems

**Task**: You are to use "guizang-ppt-skill" and "frontend-slides" skills to create a well-structured, well-designed, step-by-step tutorial slides with stunning visualization and illustrations about "diaggregated intelligence" using System One Models such as Salesforce's `koa-action`, as well as graph-based agentic harness (Agentforce Agent Graph) that can be configured with AgentScript.  Your slides should borrow ideas from:

* docs/blog/07-building-prod.md
* https://www.langchain.com/blog/building-prod-with-jev-and-langgraph
* https://typesafe.ai/manifesto
* TypeSafe Quickstart: https://docs.typesafe.ai/introduction/quickstart
* Confidence Gate Routing: https://docs.typesafe.ai/patterns/confidence-routing
* Intent Reouting: https://docs.typesafe.ai/patterns/intent-routing
* Advanced TypeSafe: https://docs.typesafe.ai/primitives/advanced
* How to build with TypeSafe: https://docs.typesafe.ai/concepts/how-to-build-with-system-one

In your thinking and writing, here are Salesforce specific technologies that you must infuse into your blog drafts.

* `koa-action` : Salesforce's System One Model for fast decisions including: classification, noul, scoring, semantic endpointing, etc.
* Agent Graph : Agentforce runtime similar to a managed version of LangGraph that orchestrates agentic workflow with well understood software runtime logic
* AgentScript : Configuration language for configuring the Salesforce Agent Graph to manage "neuro-symbolic" reasoning, leading to "guided determinism.

The main theme for these slides should be about "disaggregated intelligence" for enterprise AI -- which is necessary to achieve reliability while keeping cost under control.  Leveraging more specialized System One Models such as `koa-action` or `Jev` is about all of the following:

* reliability
* predictability
* significantly lower cost
* significantly faster inference

Instead of packing domain knowledge into prompts for a large LLM, you encode it in the topology of the graph: which decisions get made, in what order, and what state each one sees. 

Iteratively create 3 versions of the highly illustrated slides without overriding by thoughtfully incorporating each of the successive versions' critique and suggestions. Each version must improve upon previous versions by carefully reviewing all critiques and suggestions.  Be thoughtful and strategic in what to select and what to ignore in order to create an ever more compelling, provocative, and intellectually relevant set of slides.

To illustrate ideas and concepts, thoughtfully create a modern, clean, and simple illustration using vector graphics of the training pipeline. Use best UI/UX design skills for your vector graphics.  For color palette, we strongly prefer simple pastel colors.

Output should be made to the folder "docs/slides"

## Contexts and References

First, you must systematically and deeply digest, process, research, and understand the following online resources:

AgentGraph Resources:
=====================
* AgentGraph and Guided Determinism:
https://engineering.salesforce.com/agentforces-agent-graph-toward-guided-determinism-with-hybrid-reasoning/
* Building Enterprise AI Agents: https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/
* AgentScript to create Agentic Decision Control Plane:
https://www.salesforce.com/blog/agent-script-control-plane/
* Guided determinism using AgentScript: https://everythingagents.org/topics/guided-determinism
* AgentScript github repo: https://github.com/salesforce/agentscript

Langchain Resources:
====================
* Building Prod with Jev and LangGraph: https://www.langchain.com/blog/building-prod-with-jev-and-langgraph
* Building a Harness with Jev: https://www.langchain.com/blog/building-a-harness-with-jev
* Jev in LangSmith Evals: https://www.langchain.com/blog/jev-is-now-available-in-langsmith-evals
* Jev-as-a-Judge for Agent Evals: https://www.langchain.com/blog/jev-agent-evals-langsmith

* Deep Agents vs LangChain vs LangGraph: https://www.langchain.com/blog/deep-agents-vs-langchain-vs-langgraph

TypeSafe Jev Resources:
=======================
* TypeSafe Composable AI Manifesto: https://typesafe.ai/manifesto
* TypeSafe Quickstart: https://docs.typesafe.ai/introduction/quickstart
* Confidence Gate Routing: https://docs.typesafe.ai/patterns/confidence-routing
* Intent Reouting: https://docs.typesafe.ai/patterns/intent-routing
* Advanced TypeSafe: https://docs.typesafe.ai/primitives/advanced
* How to build with TypeSafe: https://docs.typesafe.ai/concepts/how-to-build-with-system-one

## Additional Instructions

Use Codex adversarial review to check and verify your design and implementations.  Fix all issues carefully and systematically.

Fan out subagents with dynamic workflows

