# Document Discovery Studio guides

Start with the [education-first redesign](education-redesign-review.md) for Explore, Compare, Experiment, and their verification boundaries. [Independent publication](independent-publication.md) describes the new classification behavior and historical compatibility.

The [component performance reports](performance-reports-review.md) explain measured service and overall elapsed time, live strategy comparisons, authored-reference checks, and the limits of calling those checks accuracy. [Live lesson commands](live-lesson-requests.md) document the actual provider calls and their isolation.

The [Find & compare layout review](discovery-layout-review.md) describes the compact workflow stage, on-demand timing and result drawers, and current verification limits.

The [Discovery tree and classification preview review](decision-tree-preview-review.md) describes the simpler capability tree, recorded routing evidence, explicit publication boundary, and measured latency comparison.

The [shared river-path review](flow-river-review.md) describes directional dashes across the workflow views, independent wait/completion behavior, and pause, speed, and reduced-motion handling.

Start with the [tutorial](tutorial.md) to install the app, classify the fictional Atlas documents, resolve a review, and follow a query to its evidence. The [root README](../README.md) gives the shorter startup path.

To understand timing, parallel work, and intermediate outputs, read [how to read a run](reading-a-run.md). It explains why a draft is not yet a supported answer and why request durations cannot be added to obtain parallel wall time.

For the implementation, read [architecture](architecture.md), then [decisions and workflows](decisions-and-workflows.md). They explain which component makes each judgment, which rule selects the next step, how parallel workers join, and why an answer needs source citations. The [HTTP guide](api.md) gives route names and request examples. The running backend publishes its typed API at `/docs` and its machine-readable schema at `/openapi.json`. The [shared implementation contract](implementation-contract.md) describes the browser boundary.

Use [deployment](deployment.md) when building the frontend for Vercel and connecting it to a protected, persistent backend. Read [evaluation](evaluation.md) before interpreting test success or provider measurements as evidence of model quality. The [reference record](references.md) separates verified integration contracts, design choices, and unavailable source material.

The [adversarial review](adversarial-review.md) records reproduced failure cases and their fixes. The [verification record](verification.md) separates executed checks, live provider observations, and remaining limits.

| Diagram | What to follow |
| --- | --- |
| [Architecture](diagrams/architecture.svg) | Commands, model calls, stored state, streamed events, and telemetry. |
| [Classification](diagrams/classification.svg) | One document from extraction through policy, proposal, and review. |
| [Discovery](diagrams/discovery.svg) | Query intent, parallel retrieval, evidence screening, and claim support. |
| [Fan-out and join](diagrams/fan-out-join.svg) | Three runtime instances of one worker definition and a complete keyed join. |
| [API, SSE, and review](diagrams/api-sse-review.svg) | Prompt command responses, persisted events, review resumption, and reconnection. |

The diagrams use editable JSON layouts beside standalone SVG exports. Regenerate them from the repository root with `uv run python docs/diagrams/render.py`. Every SVG has an accessible title and description. These illustrations explain the implemented control flow; the live canvas is built from recorded execution events.

The [interface captures](screenshots/README.md) show the inspected desktop and narrow layouts, including review, replay, highlighted citations, and timing lanes. The gallery distinguishes the simulated walkthrough from the separately recorded live timing check.
