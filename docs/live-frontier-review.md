# Live frontier timing and workflow review

September 29, 2026. Extends the [Explore flow review](explore-flow-review.md). The [live request contract](live-lesson-requests.md) describes the API boundaries.

## Root causes and changes

The prepared OpenAI adapter sleeps for 70 ms before returning a fixture proposal. The former 71 ms Interpret badge measured that local fixture interval, not a GPT response. Prepared System 1 delays had the same problem. Both now remain diagnostic information. Primary graph metrics require explicit real-provider metadata and a complete measured request interval.

The former **3.61 s versus 2.92 s** comparison was an assumed, single-document exception case. Its disaggregated path included bounded judgment plus frontier interpretation; its baseline used frontier classification. It could legitimately be slower, but placing those numbers prominently in a document lesson implied a representative speed comparison. Default Explore now explains the selected route and links to the batch comparison. Assumed single-document calculations remain in details, with their distinct task costs and human wait disclosed. Values are not altered to guarantee a favorable result. Routine documents avoid frontier requests; benefit across a workload depends on its mix, provider times, capacity, and safeguards.

The app now provides explicit real GPT-5.5 actions:

- **Classify documents:** Run GPT-5.5 is the primary action for the ambiguous report and unsigned agreement. The graph pauses at the recorded runtime decision, then displays the actual Interpret result and request duration. The source and System 1 signal remain prepared. Approval and publication cannot be borrowed from the replay. Prepared replay is a separate action.
- **Find & compare:** Run Find executes retrieval without a frontier call on the clear route. Run Compare uses the existing Discovery workflow with real planning and composition when evidence permits. Each completed frontier attempt has its own measured duration; retries are counted. Exact citation validation executes. Bounded relevance and semantic support signals remain prepared and are labeled beside the result.
- **Review & redact:** The Explore scene defaults to real GPT-5.5 classification and redaction actions on the fictional page corpus. Returned drafts, structured judgments, and request timing are separate from the prepared two-lane comparison. The Compare destination opens that illustration directly. A redaction draft requires inspection and is never automatically released.

Opening a page, changing an example, refreshing, or playing a prepared recording makes no model call. Every paid lesson request requires an explicit Run action. Leaving a request ignores its late result; it does not claim to cancel provider work already accepted. A still-running detached request disables its local duplicate action until it settles.

Human approval is not assigned a millisecond response time. A scripted review is labeled as a simulated checkpoint. A live preview exposes the approval requirement and creates no operational review task or searchable document.

## Model and measurement

The standard frontier default and the local `OPENAI_MODEL` setting are `gpt-5.5`. Dedicated live lesson commands explicitly select that model. Historical recordings and evaluations retain their original model identities. Current compatibility settings were checked against the [official GPT-5.5 model documentation](https://developers.openai.com/api/docs/models/gpt-5.5): Responses, structured outputs, and low reasoning effort are supported.

Completed latency is the server-observed SDK request round trip, including network delay and parsing. The pending timer is browser waiting time. Neither is animation duration, pure model compute time, a measured System 1 speed advantage, or a performance benchmark. Actual returned model and request metadata remain inspectable. Failures never receive a fixture answer or a made-up duration.

## Adversarial findings addressed

| Finding | Correction |
| --- | --- |
| Fixture sleeps presented alongside real provider measurements | Require per-attempt live-provider metadata; suppress simulated and incomplete graph aggregates. |
| Scripted approval timing looked like human response time | Remove script milliseconds from primary human badges; preserve diagnostic evidence only. |
| Live preview inherited completed publication from replay | Pause before interpretation, hide recorded counters/playback in live mode, and explicitly reset approval/publication graph states. |
| Live graph changed visually but retained stale accessible labels | Rebuild accessible labels after applying live state. |
| Leaving a pending request re-enabled an ignored Run click | Expose in-flight state and disable duplicate submission until the accepted call settles. |
| Live Why panel described scripted approval | Display the executed policy receipt and the preview's actual approval/publication boundary. |
| Discovery Find pending path implied composition | Use task-specific pending labels; clear Find has zero frontier requests. |
| Newly generated Discovery answer could imply independent semantic verification | Keep the prepared support-check limitation prominent beside the live result. |
| Compare/review opened the live single-page pane | Select the illustration from destination context and remount on destination changes. |
| Global simulated badge contradicted real provider activity | Label source provenance as Synthetic examples; state provider provenance within each execution. |

## Executed verification

- Full backend suite: **148 passed**; Ruff passed.
- Full frontend unit suite: **114 passed**; TypeScript, ESLint, and production build passed.
- Independent review: **48 focused frontend tests**, **33 live lesson/provider tests**, and **23 live Review/boundary tests** passed; independent typecheck passed.
- Schema and OpenAPI artifacts regenerated from the Python contracts.
- Browser regression discovery found four new cases covering explicit request triggering, measured response display, pending/late response isolation, failure without fallback, and Review destination behavior. Listing tests does not execute them.

Independent review reported no remaining material source-level finding. Tests use mocked SDK responses and deliberately labeled test timings; those values are not app performance measurements.

## Unverified checks

A real request through the production GPT-5.5 adapter for the unsigned synthetic agreement was attempted. It failed with `openai network connection failed`. No actual GPT-5.5 response or latency was obtained in this environment. The adapter is wired for the local app to measure its successful request; live account access is unverified here.

Browser startup remains blocked because binding `127.0.0.1:8001` returns `Operation not permitted`. The current iteration therefore has no newly executed screenshot, mounted interaction, animation, responsive-layout, keyboard, or 200% zoom verification. Source geometry, contrast calculations, static markup, and unit tests are not substitutes for those checks. No human usability study was conducted.
