# Sources and implementation choices

This record was checked on **September 28, 2026**. The [preparation research](../notes/03-reference-research.md) read all 15 supplied text pages and the rendered gist before implementation. The build rechecked the gist, four LangChain articles, four directly accessible TypeSafe pages, six Vercel pages, and deployment guidance. The direct request for “How to build with System One” failed during the build; the preparation record had reached it through official navigation. Source access is distinct from executing the described integration.

The application taxonomy, fictional Atlas corpus, FTS5 baseline, policy thresholds, review rules, event contract, and browser layout are design choices made for this application. The source articles' benchmark results do not measure this application. Implementation evidence and remaining limits are recorded in [evaluation](evaluation.md).

## Supplied sample and visual reference

| Source | Access and lesson | Implementation choice |
| --- | --- | --- |
| [Sydney Runkle's document review gist](https://gist.github.com/sydney-runkle/a632ba4ea0b2b72501dfa4b6ab2a7d8a) | Rendered source accessible. Page judgments, explicit routing, parallel execution, interrupts, and tracing informed the design. No explicit license or LICENSE file was found in the accessible gist. | Independently authored code; attribution retained here. The sample's prose and confidence gate differ. This app tests its own policy in one module and uses a new corpus and taxonomy. |
| [Canonical YouTube demo](https://www.youtube.com/watch?v=A4xZBm5eCBo) | Watch and oEmbed retrieval failed during implementation. No frames, transcript, timestamps, or scene details were verified. | Runtime workers, selected edges, inspectors, joins, and replay follow the independently specified requirements. Visual comparison with the video remains unverified. |
| [Misspelled original video URL](https://www.youtubev.com/watch?v=A4xZBm5eCBo) | `youtubev.com` is the brief's typo, not the canonical source. | The canonical `youtube.com` URL above was attempted. |

The sample routes responsiveness below `0.5` away first, then routes values below `1.5` **or** low confidence to review. Its prose describes a narrower confidence role. This app does not inherit those legal-review thresholds, sample provider defaults, or memory checkpoints. It uses direct TypeSafe, OpenAI, persistent SQLite checkpoints, document categorization, lexical discovery, and explicit browser events.

## Supplied LangChain articles

| Source | Access and relevant lesson | Applied choice |
| --- | --- | --- |
| [Building Prod with Jev and LangGraph](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph) | Rechecked; September 25 article describes narrow decisions inside graph control and review. | Keep judgments, routing, and execution separate; measure this workload independently. |
| [Building a Harness with Jev](https://www.langchain.com/blog/building-a-harness-with-jev) | Rechecked; independent questions can share context while generation remains separate. | Batch independent relevance questions and reserve OpenAI for interpretation/planning/synthesis. |
| [Jev in LangSmith Evals](https://www.langchain.com/blog/jev-is-now-available-in-langsmith-evals) | Rechecked; hosted evaluator needs a provider secret and trace-variable mappings. | Optional hosted evaluation is separate from local trace enablement. |
| [Jev-as-a-Judge for Agent Evals](https://www.langchain.com/blog/jev-agent-evals-langsmith) | Rechecked; repeatability and agreement with human references answer different questions. | Keep authored labels separate from judge outputs; report small counts and exact conditions. |

## Supplied TypeSafe pages

| Source | Access and relevant lesson | Applied choice |
| --- | --- | --- |
| [Quickstart](https://docs.typesafe.ai/introduction/quickstart) | Rechecked; `typesafe-sdk`, `AsyncTypeSafeClient`, `system_one(state=..., questions=...)`, direct API key. | Real SDK adapter; explicit root environment loading. |
| [Confidence gate routing](https://docs.typesafe.ai/patterns/confidence-routing) | Rechecked; application policy chooses how to act on a signal. | Store the signal separately from the selected branch. |
| [Intent routing](https://docs.typesafe.ai/patterns/intent-routing) | Rechecked; defined intents route to bounded components. | `find`, `summarize`, `compare`, and `unsupported`, with uncertainty routing. |
| [Advanced TypeSafe](https://docs.typesafe.ai/primitives/advanced) | Rechecked; structure and descriptions carry question meaning. | Flat, explicit taxonomy first; no unbounded hierarchy traversal. |
| [How to build with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) | Preparation read through official navigation; build direct fetch failed. Code owns work; dependent decisions need later calls. | Send explicit context and batch only independent judgments. |

## Supplied Vercel pages

| Source | Access and relevant lesson | Applied choice |
| --- | --- | --- |
| [AI Gateway](https://vercel.com/docs/ai-gateway) | Rechecked; common provider access, routing, and usage visibility. | Optional future provider boundary; direct TypeSafe remains the baseline. |
| [What is Jev](https://vercel.com/i/what-is-jev) | Rechecked; bounded typed judgments feed application decisions. | Typed output is validated, then policy selects actions. |
| [Jev Integration / Vercel Connect](https://vercel.com/connect/jev) | Rechecked; scoped runtime credentials through a named connection. | Optional credential-management alternative, not a replacement for `.env`. |
| [Make Decisions with Jev](https://vercel.com/academy/make-decisions-with-jev) | Rechecked accessible course overview; exercises were not completed. | Inspectable category selection, uncertainty, and varied inputs. No promotional pricing copied. |
| [Six integration approaches](https://vercel.com/i/jev-integrations) | Rechecked; libraries, adapters, and gateways have distinct roles. | Direct SDK calls inside LangGraph avoid a second classifier abstraction. |
| [Seven practical use cases](https://vercel.com/i/jev-use-cases) | Rechecked; document classification needs readable text and category definitions. | Explicit extraction failures, mixed-purpose review, and retained corrections. |

## Provider contracts and limits

These primary pages were read in the preparation record and checked against the installed SDK by the implementation. The resolved Python versions appear in [tutorial](tutorial.md) and `uv.lock`. Model aliases can change independently of SDK releases; the app records configured and returned identifiers.

| Source | Consequential contract | Applied choice |
| --- | --- | --- |
| [Python response types](https://docs.typesafe.ai/sdk/python/api/types/responses) | Choice uses `.choice`, `.confidence`, `.probabilities`; provider metadata can be available. | Typed provider-specific parsing and range validation. |
| [Choice](https://docs.typesafe.ai/primitives/choice) | Maximum-probability option; keys alone do not supply model context. | Explicit identity/definitions; exact top ties trigger escalation. |
| [Confidence](https://docs.typesafe.ai/confidence) | Distribution concentration differs from correctness. | Inspector uses confidence terminology without calibration claims. |
| [Score](https://docs.typesafe.ai/primitives/score) | Expected rubric index can be fractional. | No normalization assumption; unused in baseline routing. |
| [Noul](https://docs.typesafe.ai/primitives/noul) | `.noul` is a binary probability and has no confidence attribute. | Separate relevance and support signals/thresholds. |
| [Async client](https://docs.typesafe.ai/sdk/python/api/clients/async) | Async calls and model override semantics. | Server-side async adapter with configured model recorded. |
| [Models](https://docs.typesafe.ai/models) | Total and state-plus-largest-question request budgets differ. | Bound context and question batches; record omitted context. |
| [Retry policy](https://docs.typesafe.ai/sdk/python/api/retries) | Retry budgets and backoff are configurable. | Coordinate visible application attempts with SDK retries. |
| [HTTP API](https://docs.typesafe.ai/api), [exceptions](https://docs.typesafe.ai/sdk/python/api/exceptions) | Authentication, throttling, overload, timeout, network, and validation errors are distinct. | Visible provider failures; no fixture fallback. |
| [SDK usage](https://docs.typesafe.ai/sdk/python/usage) | Debug logging can include request bodies. | No verbose document-body provider logging in normal use. |
| [System One](https://docs.typesafe.ai/concepts/system-one) | Typed judgments do not supply a narrative explanation for every decision. | Explain the recorded rule and input; do not invent hidden reasoning. |
| [Passage classification cookbook](https://docs.typesafe.ai/cookbooks/classifying_rag_passages) | Relevance, conflict, and useful evidence are distinct judgments. | Screen candidates and preserve conflict information. |
| [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | Responses typed parsing needs refusal/incomplete-output handling. | Bounded Pydantic plans/proposals/answers and independent citation checks. |
| [GPT-5.5 model](https://developers.openai.com/api/docs/models/gpt-5.5) | Official model page lists Responses, structured outputs, and low reasoning effort support. | Current frontier default and explicit live lesson target. Historical model evidence remains unchanged. |

## Execution, tracing, and interface contracts

| Source | Relevant contract and implementation consequence |
| --- | --- |
| [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api) | Dynamic `Send` instances and reducers support keyed fan-out and aggregation. |
| [LangGraph streaming](https://docs.langchain.com/oss/python/langgraph/streaming) | Installed stream envelopes are translated into versioned public events, with explicit start/decision/edge instrumentation. |
| [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts) | Resume the same thread with `Command`; pre-interrupt code can run again. Keep repeated work idempotent. |
| [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence), [checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers) | Persistent checkpoints support review resumption and differ from event logs and durable queues. |
| [TypeSafe LangChain integration](https://docs.langchain.com/oss/python/integrations/providers/typesafe) | An alternative adapter takes state and questions; it is not needed alongside the direct SDK. |
| [Trace LangGraph](https://docs.langchain.com/langsmith/trace-with-langgraph), [custom instrumentation](https://docs.langchain.com/langsmith/annotate-code) | Preserve parent/child run context and instrument direct provider calls. |
| [Mask inputs and outputs](https://docs.langchain.com/langsmith/mask-inputs-outputs) | Filter graph/provider data before trace upload. Small interrupt payloads alone do not sanitize graph state. |
| [React Flow learning guide](https://reactflow.dev/learn) | Custom nodes and edges render the application event model. |
| [Node updates](https://reactflow.dev/examples/nodes/update-node), [animated edges](https://reactflow.dev/examples/edges/animating-edges) | Runtime updates and selected-edge animation are frontend representations of backend execution. |
| [React Flow accessibility](https://reactflow.dev/learn/advanced-use/accessibility) | Keyboard access complements the canvas; the app also supplies linear event access and reduced motion. |

## Deployment and installation sources

| Source | Access and implementation consequence |
| --- | --- |
| [Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite) | Rechecked; Vite deployment settings and SPA fallback. Root `frontend`, install `npm ci`, build `npm run build`, output `dist`. |
| [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build) | Rechecked; page updated August 28, 2026. Project root cannot depend on parent files. |
| [Vite shared options](https://vite.dev/config/shared-options.html#envdir), [environment variables](https://vite.dev/guide/env-and-mode) | Rechecked during build; local `envDir` is explicit and only intended `VITE_` values enter the frontend. |
| [Vercel Python runtime](https://vercel.com/docs/functions/runtimes/python), [streaming](https://vercel.com/docs/functions/streaming-functions) | Python/streaming support does not remove this app's persistent storage and job-lifecycle requirements. |
| [Function duration](https://vercel.com/docs/functions/configuring-functions/duration), [function limits](https://vercel.com/docs/functions/limitations) | Recheck plan limits before a proxy design; direct uploads avoid an unnecessary function proxy. |
| [TypeSafe API through Gateway](https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe) | Optional Gateway credentials/model names and confidence capabilities require separate verification before adoption. |
| [uv installation](https://docs.astral.sh/uv/getting-started/installation/), [Node downloads](https://nodejs.org/en/download) | Rechecked primary installation references; tested local tool versions are recorded in the tutorial. |

No substantial sample code, video transcript, benchmark table, or promotional claim is copied into this project. The original brief and preparation notes remain unchanged in `notes/`.
