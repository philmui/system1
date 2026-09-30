# Reference research for Document Discovery Studio

Research date: **September 28, 2026**. This record supports the [implementation prompt](02-document-discovery-build-prompt.md). It separates verified source behavior from proposed application choices. It is research for a future build, not evidence that the application or provider integrations have been executed.

All 15 supplied text articles/documentation pages and the rendered sample gist were accessible. The canonical YouTube video's content was not retrievable. Some sources required alternate navigation after initial direct retrieval failures. Research used primary documentation and the source author's sample; no keys were read and no paid provider calls were made.

## 1. Sample application and visual reference

| Reference | Access and lesson | Application decision |
| --- | --- | --- |
| [Sample gist](https://gist.github.com/sydney-runkle/a632ba4ea0b2b72501dfa4b6ab2a7d8a) | Read rendered README, review, corpus, test, demo, comparison, parallel-demo, classifier and tracing files, plus requirements. Raw/API fetches failed. It evaluates page responsiveness, privilege and PII with typed signals. Code routes `score < 1.5 OR confidence < 0.7` to review after withholding `score < 0.5`; prose describes a narrower confidence gate. | Retain the separation of judgments and policy, parallel workers, and review. Replace sample provider/configuration assumptions. Write policy tests. Classification taxonomy, retrieval, discovery and the interface are extensions. |
| [YouTube demo](https://www.youtube.com/watch?v=A4xZBm5eCBo) | Watch, embed and metadata retrieval failed; search did not recover trustworthy video content. No title, transcript, frame, visual detail or timestamp was verified. The `youtubev.com` URL in the brief is misspelled. | The build prompt defines runtime nodes, selected-edge animation, a decision inspector, parallel joins and replay as proposed acceptance criteria. These are not claims about observed scenes. Attempt comparison when the video becomes accessible. |

The sample was inspected, not run. Its defaults include SemIf/Anthropic and memory-based checkpoints; the proposed application uses direct TypeSafe, OpenAI, and persistent local checkpoints. A source-code example does not establish production behavior or an application-wide quality guarantee.

## 2. Requested LangChain resources

| Reference | Verified lesson | Application consequence |
| --- | --- | --- |
| [Building Prod with Jev and LangGraph](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph) | The September 25 article connects narrow judgments to graph state, conditional routing, subgraphs, interrupts and tracing. Its document example concerns review signals. | Use these control mechanisms, but measure this application's latency and quality independently. The article's timing comparison belongs to its own experiment. |
| [Building a Harness with Jev](https://www.langchain.com/blog/building-a-harness-with-jev) | The September 17 article groups independent questions over shared state and reserves generative models for open-ended work. Its integration treats Jev as a classifier rather than a chat model. | Keep semantic judgments separate from generation and deterministic actions. Direct SDK calls inside LangGraph nodes are sufficient; experimental middleware is unnecessary. |
| [Jev in LangSmith Evals](https://www.langchain.com/blog/jev-is-now-available-in-langsmith-evals) | The September 21 article describes a hosted evaluator configured with a TypeSafe provider secret, trace-variable mappings and typed questions that become feedback keys. | Distinguish runtime tracing from hosted evaluation. A local `.env` does not automatically install a provider secret in a LangSmith workspace. Document hosted setup separately if used. |
| [Jev-as-a-Judge for Agent Evals](https://www.langchain.com/blog/jev-agent-evals-langsmith) | The September 20 article uses five weather-agent outputs, repeated judgments and human references to distinguish repeatability from accuracy. | Use human-labeled document/query examples and deterministic citation checks. Optional Jev feedback can supplement these references; evaluating Jev solely with Jev is insufficient. |

## 3. Requested TypeSafe resources

| Reference | Verified lesson | Application consequence |
| --- | --- | --- |
| [Quickstart](https://docs.typesafe.ai/introduction/quickstart) | Python uses `typesafe-sdk`, `TypeSafeClient` or `AsyncTypeSafeClient`, and `system_one(state=..., questions=...)`. Authentication uses `TYPESAFE_API_KEY`. | Use the real SDK interface. Load the root `.env` explicitly before constructing the client. Do not invent a `classify()` endpoint or assume dotenv loading. |
| [Confidence gate routing](https://docs.typesafe.ai/patterns/confidence-routing) | Application code chooses thresholds and the next action. Returned judgments and permission to act on them are separate concepts. | Store provider output and policy outcome separately. Treat starting thresholds as proposed values to evaluate. |
| [Intent routing](https://docs.typesafe.ai/patterns/intent-routing) | Intent and complexity judgments can select lookup, generation or review. Each decision used for routing needs a defined uncertainty policy. | Jev routes supported query types; complex or ambiguous requests can produce a bounded OpenAI retrieval plan. |
| [Advanced TypeSafe](https://docs.typesafe.ai/primitives/advanced) | Structured descriptions and instructions express criteria. Hierarchical choices can traverse a taxonomy through successive decisions. | Start with a small, flat taxonomy. Keep hierarchy as an optional extension, with bounded traversal and explicit context if added. |
| [How to build with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) | Code owns workflow and side effects. Jev handles narrow judgments over relevant state. Independent questions can share a call; dependent questions require another call. | Keep graph control in Python and supply the input each judgment needs. This page was reached through official documentation navigation after direct retrieval failed. |

### Provider semantics checked beyond the introductory pages

| Primary source | Verified contract and design implication |
| --- | --- |
| [Python response types](https://docs.typesafe.ai/sdk/python/api/types/responses) | A Choice answer exposes `choice`, `confidence` and `probabilities`; there is no provider `.value` field. Answers are available through `answers` or typed collections such as `choices`. Preserve returned model, usage and request ID when available. |
| [Choice](https://docs.typesafe.ai/primitives/choice) | The selected option has maximum probability; exact tie-breaking is unspecified. Question IDs do not reach the model. Put passage identity and category meaning into state/instructions, and handle ties in policy. Use explicit `other` and insufficient-evidence criteria. |
| [Confidence](https://docs.typesafe.ai/confidence) | Choice/Score confidence summarizes distribution concentration. It differs from the selected option's probability and does not establish correctness for a particular document. Do not label it “probability correct.” |
| [Score](https://docs.typesafe.ai/primitives/score) | A score is an expected index in an ordered rubric and can be fractional. For four levels, indices span 0–3. Do not assume all scores are normalized to 0–1. |
| [Noul](https://docs.typesafe.ai/primitives/noul) | A Noul returns the probability of yes through the `.noul` field, not `.probability`. It has no separate confidence property. Use probability terminology for passage relevance/support. |
| [Async client](https://docs.typesafe.ai/sdk/python/api/clients/async), [models](https://docs.typesafe.ai/models) | The SDK supports the `TYPESAFE_DEFAULT_MODEL` override; the default alias is `jev-latest`. Record the resolved model and recheck evaluations after changes. Extract documents into text. Budget both the complete request and state plus the largest question against the selected model's limits. |
| [Retry policy](https://docs.typesafe.ai/sdk/python/api/retries), [HTTP API](https://docs.typesafe.ai/api), [exceptions](https://docs.typesafe.ai/sdk/python/api/exceptions) | Retries have configurable budgets and backoff. Authentication, validation, throttling, overload, network errors and timeouts need distinct handling. Account for `529` overload responses if overriding retry statuses. Avoid multiplying SDK and application retries. |
| [SDK usage](https://docs.typesafe.ai/sdk/python/usage) | Debug logging can include request and response bodies. Disable verbose provider debugging for normal document handling and independently filter telemetry payloads. |
| [System One](https://docs.typesafe.ai/concepts/system-one), [passage classification cookbook](https://docs.typesafe.ai/cookbooks/classifying_rag_passages) | The interface returns decisions rather than generated explanations. The cookbook separates useful, conflicting and irrelevant evidence. Show supplied evidence and applied rules; do not invent a model rationale or treat an injection judgment as a guaranteed security boundary. |

No response cache was established by the reviewed SDK documentation. Replay is an application event-log feature. If caching is later added, document its ownership and key it by content, questions, model and relevant schema/rubric versions.

## 4. Requested Vercel resources

| Reference | Verified lesson | Application consequence |
| --- | --- | --- |
| [AI Gateway](https://vercel.com/docs/ai-gateway) | Gateway centralizes provider access, usage and routing and can be used outside Vercel-hosted applications. | It is an optional provider-access layer, not a requirement for deploying a frontend. Keep the direct TypeSafe credential path as the baseline. |
| [What is Jev](https://vercel.com/i/what-is-jev) | Bounded typed judgments support application decisions; application code owns actions. Valid structure does not establish semantic correctness. | Expose uncertainty, retain evidence, and evaluate task quality. |
| [Jev Integration / Vercel Connect](https://vercel.com/connect/jev) | Connect retrieves scoped credentials at runtime through a named Jev connection, illustrated with `getToken('jev/connection-name')`. | Treat Connect as an alternative credential-management approach. It does not replace the user's requested root `.env` setup. |
| [Make Decisions with Jev](https://vercel.com/academy/make-decisions-with-jev) | The accessible course overview introduces React/TypeScript message routing, category definitions, uncertainty and testing varied inputs. | Apply the inspectable form → decision → branch interaction. Only the overview was inspected; course exercises were not completed. Do not repeat its expired promotion as current pricing. |
| [Six ways to integrate Jev](https://vercel.com/i/jev-integrations) | The article separates libraries, provider adapters and gateways. Its Python option uses `langchain-typesafe` with state and question arguments. | Direct `typesafe-sdk` calls inside LangGraph nodes minimize layers here. `TypeSafeClassifier` is a documented alternative, not a mandatory second client. |
| [Seven practical use cases](https://vercel.com/i/jev-use-cases) | Document categorization requires explicit category meaning and readable extracted text; mixed-purpose documents need a policy. | Define category boundaries, retain original text and corrections, and test routing alongside final task results. |

### Deployment facts that affect the design

- A Vite frontend can deploy with Vercel project root `frontend`, `npm ci`, `npm run build`, and output `dist`. SPA routing may need the documented fallback to `index.html`. Keep the API at its external origin. [Vercel Vite guide](https://vercel.com/docs/frameworks/frontend/vite)
- Local Vite configuration can point `envDir` to the repository root. Only the intended public `VITE_` variables should enter the bundle; never inject the entire process environment. Supply `VITE_API_BASE_URL` as a deployment build variable and rebuild when it changes. [Vite shared options](https://vite.dev/config/shared-options.html#envdir), [Vite environment variables](https://vite.dev/guide/env-and-mode)
- A deployment rooted at `frontend` should not depend on reading a parent `.env`. Account explicitly for Vercel's project-root file boundary. [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build)
- Vercel supports Python and streaming. Bounded request lifetimes and persistent application state motivate a separate backend here. Duration limits depend on plan and configuration and should be rechecked before deployment. [Python runtime](https://vercel.com/docs/functions/runtimes/python), [function duration](https://vercel.com/docs/functions/configuring-functions/duration)
- Vercel Functions have a documented 4.5 MB request/response payload limit. Direct browser uploads to the chosen backend avoid imposing that function-proxy limit on this architecture. The backend must still enforce its own limits. [Function limits](https://vercel.com/docs/functions/limitations)
- The TypeSafe-compatible Gateway endpoint uses Gateway credentials and a Gateway-specific model identifier. Its optional fallback can report unavailable distribution/confidence information differently from direct Jev. Verify capabilities before adding it; do not silently interpret an unavailable confidence field as measured uncertainty. [TypeSafe API through Gateway](https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe)

## 5. Additional implementation contracts

| Primary reference | How it constrains the build |
| --- | --- |
| [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api) | `Send` schedules dynamic instances with task-specific state. Reducers merge parallel updates. Avoid unconditional edges that unintentionally execute alongside conditional routing. Application worker identity must remain distinct from node-definition identity. |
| [LangGraph streaming](https://docs.langchain.com/oss/python/langgraph/streaming) | Updates, custom events and subgraph namespaces are available. Supported v2 and newer stream APIs have different envelopes. Choose one installed-version contract, test it, and translate it into stable public events. |
| [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts) | Resume uses a stable thread and validated input. An interrupted node starts again; earlier side effects need idempotency or different placement. If using parallel interrupts, map responses to their interrupt IDs. |
| [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence), [checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers) | Memory checkpoints disappear on restart. Durable checkpoints support resumption but do not replace a full application event log or durable job scheduler. |
| [TypeSafe LangChain integration](https://docs.langchain.com/oss/python/integrations/providers/typesafe) | The adapter takes both `state` and `questions` at invocation. Avoid copying older examples that attach questions to classifier construction. The middleware is experimental. |
| [Trace LangGraph](https://docs.langchain.com/langsmith/trace-with-langgraph), [custom instrumentation](https://docs.langchain.com/langsmith/annotate-code) | Configure tracing through environment values and preserve worker context. Direct SDK calls need explicit instrumentation when automatic tracing does not cover them. |
| [LangSmith input/output filtering](https://docs.langchain.com/langsmith/mask-inputs-outputs) | Filter before upload, including graph-state inputs/outputs and metadata. A small review payload does not remove document text from persisted state or automatically sanitize traces. |
| [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | The Responses API supports schema-constrained results and SDK parsing helpers. Handle refusal, incomplete output and missing parsed content. Validate citations and factual support separately from output structure. |
| [React Flow](https://reactflow.dev/learn), [node updates](https://reactflow.dev/examples/nodes/update-node), [animated edges](https://reactflow.dev/examples/edges/animating-edges), [accessibility](https://reactflow.dev/learn/advanced-use/accessibility) | Custom nodes, runtime node/edge updates, edge animation and accessible interaction support the proposed visualization. The application must supply truthful event/state mappings. These capabilities do not verify similarity to the inaccessible video. |

## 6. Proposed design choices and remaining verification

The product name, Atlas corpus, taxonomy, frontend layout, API/event contract, FTS5 baseline, persistent local backend, initial thresholds, and review policy are choices made for this application. They are not prescriptions or measured results from the sources.

The build prompt deliberately uses two different paths: a clear Jev category can be accepted by policy, while an OpenAI classification remains a human-review proposal. Complex discovery answers are grounded in screened passages and validated citations. This keeps the responsibilities explainable without requiring an unconstrained autonomous agent.

Before claiming a completed application, the implementing agent must still resolve and lock dependencies, test Python compatibility, verify real provider response handling, run meaningful graph/API/browser checks, inspect SVG outputs, execute the tutorial, and build the frontend. Live credentials, account permissions, latency, accuracy and video parity were not validated by this research.
