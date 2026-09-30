# Document Discovery Studio

A document workflow that makes timing and answer formation visible. Follow System 1 Model’s bounded judgments, see parallel retrieval work, and watch evidence, draft claims, citation checks, and support checks build a result. Select any request to inspect its input, signal, applied rule, and observed duration. AgentGraph controls execution, OpenAI handles complex interpretation and synthesis, and LangSmith records correlated traces. Replay preserves the recorded decisions and measurements without calling a model again.

![Live timing and answer formation, with six individually measured System 1 Model requests and parallel retrieval lanes.](docs/screenshots/latency-live-desktop.png)

This live synthetic comparison recorded six System 1 Model requests with a **125 ms median**. It is one observation, with client/network time included; the [reading guide](docs/reading-a-run.md) explains the measurement boundaries. The [Library](docs/screenshots/library-desktop.png) and [classification workspace](docs/screenshots/run-desktop.png) show document import, three runtime workers, and a saved review pause. The [architecture diagram](docs/diagrams/architecture.svg) explains the component boundaries.

The interactive Project Atlas sample set contains 13 readable documents, including an ambiguous agreement email, conflicting notice periods, an undated invoice, and instruction-like document text. An empty file remains in the repository for failure regression tests. Four additional classification teaching documents demonstrate direct acceptance, uncertainty, and a policy guard overriding high confidence. **Simulated** fixture mode supports a repeatable offline walkthrough. **Live** mode uses real provider adapters and reports integration failures explicitly.

## Start locally

Use Python 3.14.6, uv, and Node 22.23.1. From the repository root:

```sh
uv sync
npm ci --prefix frontend
uv run python -c "from pathlib import Path; p=Path('.env'); p.write_text(Path('.env.example').read_text()) if not p.exists() else None"
uv run doc-discovery init
uv run doc-discovery load-samples
APP_MODE=test-fixture uv run uvicorn doc_discovery.api:app --reload
```

In a second terminal:

```sh
npm run dev --prefix frontend -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. For live runs, configure `TYPESAFE_API_KEY` and `OPENAI_API_KEY` in the existing root `.env`, optionally configure LangSmith, and restart the backend with `APP_MODE=live`. Provider secrets remain on the backend. The generated API reference is at `http://127.0.0.1:8000/docs`.

The default **Workflow** view is a local legal-review illustration. Two AgentGraph workflows follow the same selected page: System 1 Model handles bounded decisions in one, while a frontier LLM handles every semantic decision in the other. The blue boundary is the runtime; verb-labeled cards are work nodes; the moving page is shared state; arrows show which work runs next. Routing and validation sit inside the classification wrapper. Redaction uses a prepared copy and attorney decisions stay in this example; neither lane calls a provider.

Use **Focus graph** to maximize the canvas and **Escape** to return. The chevron in the bottom dock expands the timeline and details. The continuous speed slider runs from **0.1× to 4×**, starts at **1.0×**, and changes playback only. Dark is the default; the top theme toggle remembers your choice. Select a work node to inspect its state or choose another page from the dock. **Assumptions** explains and edits the modeled timings and per-request costs; these are not benchmarks, provider prices or reliability measurements.

To populate **Runs** with three completed classification lessons, run:

```sh
uv run doc-discovery teaching-runs --cleanup
```

This executes the real classification graph with simulated providers and explicitly simulated human review in an isolated store, then publishes the completed recordings and their searchable synthetic sources. It can run beside the backend, makes no live provider calls, and is safe to repeat. The optional `--cleanup` clears unsuccessful documents and failed/partial runs from the main lists while retaining their sources and history. Active, pending-review, and recoverable inputs are protected.

Open each lesson in **Runs** and choose a **Clear category**, **Uncertain judgment**, or **Policy exception** card above the graph. The replay separates **System 1 judgment → Runtime policy → Accept / Interpret**. **Full workflow** expands review, indexing, and results. Selected routes use thick forward-flowing highlights and numbered papers across classification, discovery, and the Workflow illustration. Visual node waits are compressed; recorded timing and modeled costs keep their original meaning. See the [classification review and verification record](docs/classification-replay-review.md).

For new classification and discovery, open **Library** and select the January Atlas invoice and ambiguous agreement email. Inspect their separate workers and decisions, complete review, then classify the remaining readable samples. Search `Atlas` with invoice/date filters, compare agreement notice periods, and ask about the absent submarine insurance policy number. The [tutorial](docs/tutorial.md) explains the expected evidence. Live run graphs have the same focus and playback controls; their timing panels use recorded measurements.

## Guides and checks

Read the [guide index](docs/README.md), [architecture](docs/architecture.md), [decision policies](docs/decisions-and-workflows.md), [reading timing and answer formation](docs/reading-a-run.md), [HTTP API](docs/api.md), [Vercel deployment guide](docs/deployment.md), [evaluation](docs/evaluation.md), and [source record](docs/references.md). Editable vector sources and SVGs are in [docs/diagrams](docs/diagrams/README.md). The original brief remains in `notes/`.

```sh
uv run ruff check src tests
uv run pytest
npm run lint --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run test:unit --prefix frontend
uv run doc-discovery evaluate
```

`uv run doc-discovery live-smoke` is a separate, opt-in check using the synthetic corpus and real provider accounts. Stop the backend first if it uses the same data directory. [Executed verification](docs/verification.md) distinguishes offline checks, browser inspection, live responses, frontend build compatibility, and deployment.

`npm run test:e2e --prefix frontend` runs browser regressions against isolated fixture services on ports 8001 and 5174. The [frontend review record](docs/frontend-workflow-review.md) describes the visualization checks and the browser limitation in the current sandbox.

This is a local single-user demonstration with one backend process and persistent SQLite storage. FTS5 provides lexical retrieval; there is no embedding search. Scanned PDFs need OCR outside the app. In-process jobs can be interrupted by a restart, while review checkpoints and local replay persist. Put an authenticating access boundary in front of a hosted backend before accepting private uploads. Video comparison remains unverified because the required YouTube content could not be retrieved.
