**Role**: You are an expert Codex prompt and instruction creator for creating beautiful agentic applications that uses System 1 models such as Jev with intuitive visualization of how decisions and workflows are done

**Task**: You are to create a clear, systematic, specific instructions to Codex that create an application to illustrate how a document classification and discovery application can work using System One Models such as Jev.  Your instruction must be written into a well structured Markdown file in the "notes" directory.

In constructing your application, carefully digest and understand this sample application repo: https://gist.github.com/sydney-runkle/a632ba4ea0b2b72501dfa4b6ab2a7d8a

Your application must show clearly how decisions are made, how workflow controls flow from one component to another.  Use this video demo for inspiration: https://www.youtubev.com/watch?v=A4xZBm5eCBo


## Non-negotiables

Here are the non-negotiable must haves for this application:

* The visualization should have the dynamic visualization capability illustrated in this YouTube video: https://www.youtube.com/watch?v=A4xZBm5eCBo
* The application must use the System One model Jev from TypeSafe.ai with the TYPESAFE_API_KEY in the ".env" file
* The application must use LangGraph for orchestrating decisions and workflows, LangSmith for telemetry, OpenAI models for complex queries
* The application must be well designed, parsimoniously constructed, well documented using best software engineering practices.
* The application must assume and use keys and secrets from the ".env" file
* This application must be written in this topevel directory using "pyproject.toml" to manage any python dependencies. 
* Frontend application must be Vercel compatible (so that we can upload it to Vercel later)
* Frontend application must be designed with your best UI/UX skills for modern, intuitive, highly navigatable web application.
* You must use clean and easy to understand directory organization for this application.

## Contexts and References

First, you must systematically and deeply digest, process, research, and understand the following online resources:

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

Vercel Resources:
=================
* Vercel AI Gateway: https://vercel.com/docs/ai-gateway
* What is Jev from Vercel: https://vercel.com/i/what-is-jev
* Jev Integration - Vercel Connect: https://vercel.com/connect/jev
* Make Decisions with Jev: https://vercel.com/academy/make-decisions-with-jev
* 6 ways to integrate Jev into your application: https://vercel.com/i/jev-integrations
* 7 practical Jev use cases for AI applications: https://vercel.com/i/jev-use-cases

## Documents

You must clearly and systematically document your design in the "docs" folder using well structured, grounded, well-explained, and well-illustrated with modern, clean, useful and pleasing vector graphics that illustrate all key ideas, concepts, workflows, and sequences.  Your writing must be clear, plain, grounded, well contextualized, well connected, step-by-step tutorial style in explaining and connecting ideas, sentences, paragraphs. You must try to use as many simple and specific examples as possible.

You must also write a detailed step-by-step tutorial on how to install, setup, and use this application.

Use Codex adversarial review to check and verify your design and implementations.  Fix all issues carefully and systematically.

Fan out subagents with dynamic workflows

---

An important goal of this application is visualization for educating how System One models work, and how decisions influence workflows.  Show clear latency numbers across all components, highlighting  System One decisions' latencies.  Ultrathink on how best to illustrate component level and overall system level latencies, as well as how results are forged, formed and outputed to the user across all stages using best UI/UX design skills to enable intuitive understanding well.