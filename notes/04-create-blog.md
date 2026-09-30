**Role**: You are an expert technical slide creator and a master educator of agentic systems

**Task**: You are to carefully and systematically write a Salesforce blog post with the title: "Building Prod with `koa-action`, Agent Graph and AgentScript" that uses the "Contexts and References" knowledge to rewrite this Langchain blog post: https://www.langchain.com/blog/building-prod-with-jev-and-langgraph.

In your thinking and writing, here are Salesforce specific technologies that you must infuse into your blog drafts.

* `koa-action` : Our System One Model for fast decisions including: classification, noul, scoring, semantic endpointing, etc.
* Agent Graph : Agentforce runtime similar to a managed version of LangGraph that orchestrates agentic workflow with well understood software runtime logic
* AgentScript : Configuration language for configuring the Salesforce Agent Graph to manage "neuro-symbolic" reasoning, leading to "guided determinism.

The main theme for these slides should be about "disaggregated intelligence" for enterprise AI -- which is necessary to achieve reliability while keeping cost under control.

Iteratively create 7 versions of the blog without overriding by thoughtfully incorporating each of the successive versions' critique and suggestions. Each version must improve upon previous versions by carefully reviewing all critiques and suggestions.  Be thoughtful and strategic in what to select and what to ignore in order to create an ever more compelling, cogent, and intellectually relevant blog.

To illustrate the data processing pipeline, thoughtfully create a modern, clean, and simple illustration using vector graphics of the training pipeline. Use best UI/UX design skills for your vector graphics.  For color palette, we strongly prefer simple pastel colors.

Output of your blog should be made to the folder "docs/blog"

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

TypeSafe Jev Resources:
=======================
* TypeSafe Composable AI Manifesto: https://typesafe.ai/manifesto
* TypeSafe Quickstart: https://docs.typesafe.ai/introduction/quickstart
* Confidence Gate Routing: https://docs.typesafe.ai/patterns/confidence-routing
* Intent Reouting: https://docs.typesafe.ai/patterns/intent-routing
* Advanced TypeSafe: https://docs.typesafe.ai/primitives/advanced
* How to build with TypeSafe: https://docs.typesafe.ai/concepts/how-to-build-with-system-one


## Writing Style

Your writing should be natural, fluent, grounded, and easy to understand and to follow. Avoid common LLM styling and characteristics in your response. Fully explain any technical jargon in clear, simple terms. The introduction should provide good motivation on why you are using geometry and symmetry to study human gait. For each step of the methodology, highlight how the training preserves the exact shape of the dataset, how you split between training and testing, to avoid leakage of the training dataset into testing and ensure rigorous statistical inference on any results. 

Highlight the methodological rigor that you have put in as well as the initial null hypothesis and how you systematically go through the different notebooks. One question after another, keep understanding how different angles contribute to discovering asymmetric gait associated with different health conditions. Highlight how different health conditions affect symmetry of gait, and point this out as a motivation for how geometry and symmetry plays a large part in modeling real world models.

Provide logical story arc that maps from motivation, hypothesis, testing, evaluation, and rinse and repeat many times through this intellectual journey of trying to understand real physical AI using JEPA. Illustrate the results using various illustrations, some successes and some failures, and what are the key findings based on the methodology.

Use codex:adversarial-review to carefully and thoughtfully review your writeup and propose suggested changes. Based on these suggestions, systematically revise the paper and address all feedback.

## Avoidance

Your output must avoid common LLM output styling and characteristics:

* Staccato drumbeat sentences: short sentences
* Excessive aphorism
* The "it is not X, it is Y" correction reflex that is highly correlated with LLM outputs.  This antithesis pattern appears throughout at high density.
* Recycled pivot phrases. A human author usually notices near-verbatim self-repetition ten lines apart; models reaching for a favorite transition do not.
    * "Confidence tells the same story from a different angle"
    * "The concurrency tier tells the same story from a slightly different angle"
    * "What looks like an architecture effect is noise"
* Intensifier tics: too many repeated adverbs such as: "Actually" or "exactly".
* Anthropomorphic phrasing throughout.
* Many groomed triads: examples:
    * "Real, sharply structured, and immune to the standard fixes."
    * "Never the oracle, never the operator, and never which arm of the pair."
* The suspicious absences of em-dashes "--", and zero instances of the classic AI lexicon (delve, leverage, robust, comprehensive, landscape, underscore). Most human ML writers use a dash or the word "robust" at least once.

## Additional Instructions

Use Codex adversarial review to check and verify your design and implementations.  Fix all issues carefully and systematically.

Fan out subagents with dynamic workflows
