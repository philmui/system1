# Install and follow a complete run

This tutorial uses the fictional Project Atlas corpus to show what produced a model judgment, which policy selected the next component, what ran in parallel, where review paused execution, and which passages support a result. Begin in fixture mode for a repeatable walkthrough. Live mode uses the same workflows with real Jev and OpenAI calls and can produce different branches.

## 1. Check the tools

The implementation environment used macOS, Python **3.14.6**, `uv` **0.11.23**, Node **22.23.1**, and npm **12.0.2**. The Python requirement is `>=3.14,<3.15`: the original 3.14 minimum is retained, and an upper bound limits installation to the tested minor version. The dependency set resolved and imported on Python 3.14.6, so no version downgrade was needed. The root `pyproject.toml` and `uv.lock` are the sole Python project and lockfile; the frontend has one `package-lock.json`.

Install Python through uv if that version is not present:

```sh
uv python install 3.14.6
uv --version
node --version
npm --version
```

Use the [uv installation guide](https://docs.astral.sh/uv/getting-started/installation/) and [Node download page](https://nodejs.org/en/download) when those tools are absent. The backend uses a POSIX file lock, so use macOS or Linux; on Windows use WSL rather than native Python. macOS was the local verification platform, and the CI workflow targets Linux. Native Windows execution is not supported by this process-lock implementation.

The important Python versions are `typesafe-sdk 0.7.2`, `openai 3.19.2`, `langgraph 1.2.12`, `langgraph-checkpoint-sqlite 3.1.1`, `langsmith 0.14.1`, `fastapi 0.141.1`, `pydantic 2.13.5`, `pydantic-settings 2.15.0`, `pypdf 6.19.0`, and `uvicorn 0.54.0`. The frontend uses React 19.3.0, Vite 8.3.0, React Flow 12.11.6, TypeScript 6.0.3, and Playwright 1.63.0. TypeScript 7 was rejected by the installed lint tooling's peer range, so the compatible TypeScript 6 release is pinned. The lockfiles record the complete resolved sets. The [evaluation record](evaluation.md) separates installation evidence from application checks.

## 2. Install both parts from the repository root

The following commands install the Python package, its development checks, and the frontend's exact locked dependencies:

```sh
uv sync
npm ci --prefix frontend
```

`uv` should create or reuse `.venv` and install `doc-discovery` from this repository. npm should populate `frontend/node_modules`. Keep both commands at the repository root. Do not create a second Python project inside `src/` or a second JavaScript lockfile at the root.

## 3. Preserve and configure the environment

Create the local environment file only if it is absent. This command does not read or print existing values:

```sh
uv run python -c "from pathlib import Path; p=Path('.env'); p.write_text(Path('.env.example').read_text()) if not p.exists() else None"
```

Edit `.env` locally. The backend loads this root file independently of the working directory; deployment environment variables take precedence. `.env` is ignored by Git. Never put a provider key in a `VITE_` variable, a sample document, or a screenshot.

| Variable | Local setting and purpose |
| --- | --- |
| `APP_MODE` | `test-fixture` for simulated responses; `live` for real providers. Default is `live`. |
| `TYPESAFE_API_KEY` | Direct TypeSafe credential needed for live Jev judgments. |
| `TYPESAFE_DEFAULT_MODEL` | Default `jev-1.13.0`; the adapter records configured and returned model IDs. |
| `OPENAI_API_KEY` | OpenAI credential needed for live interpretation, planning, and synthesis. |
| `OPENAI_MODEL` | Default `gpt-4.1-mini`, chosen for a bounded structured-output demo. |
| `LANGSMITH_API_KEY` | Credential for optional trace delivery. |
| `LANGSMITH_TRACING` | `true` to send traces; default `false`. |
| `LANGSMITH_TRACE_SYNTHETIC_TEXT` | Default `false`. Explicit opt-in sends bounded retained fictional-source excerpts to policy trace spans only when every input reference is verified synthetic. |
| `LANGSMITH_PROJECT` | Default `document-discovery-studio`. |
| `LANGSMITH_ENDPOINT` | Optional regional/custom endpoint; default `https://api.smith.langchain.com`. |
| `APP_DATA_DIR` | Default `.runtime`, resolved relative to the repository root. |
| `JEV_CHOICE_THRESHOLD` | Default `0.80`, distribution-derived Choice confidence. |
| `JEV_RELEVANCE_THRESHOLD` | Default `0.70`, Noul passage relevance probability. |
| `JEV_SUPPORT_THRESHOLD` | Default `0.80`, separate Noul claim-support probability. |
| `MAX_CONCURRENCY` | Default `4`, accepted range `1`–`8`. |
| `MAX_UPLOAD_BYTES` | Default `5000000` bytes per file; maximum configurable value `20000000`. |
| `PROVIDER_TIMEOUT_SECONDS` | Default `45` seconds, bounded to `1`–`120`. |
| `CORS_ORIGINS` | Comma-separated exact origins; local defaults include `http://localhost:5173` and `http://127.0.0.1:5173`. |
| `VITE_API_BASE_URL` | Public browser API origin, normally `http://127.0.0.1:8000`. |

Fixture mode is displayed as **Simulated**. It does not validate an account or provider model. Live mode never substitutes fixtures when credentials are missing or a request fails. Selected document excerpts are sent to the configured model providers in live mode. Telemetry is separately sanitized to IDs and operational summaries by default. Enabling `LANGSMITH_TRACE_SYNTHETIC_TEXT` deliberately sends eligible fictional source excerpts to LangSmith; it does not permit private upload text, user queries, or generated claim text.

## 4. Initialize storage and import the samples

These commands check local storage and FTS5, then import the sample files idempotently:

```sh
uv run doc-discovery init
uv run doc-discovery load-samples
```

The importer reads `data/samples/manifest.json`. The visible sample collection contains 13 readable fictional documents and their declared dates. The intentionally empty regression fixture is retained outside the active collection. Importing registers files; classification is a separate run. Running `load-samples` again reuses the sample identities rather than creating another copy.

For completed recordings that teach different routing decisions, run `uv run doc-discovery teaching-runs --cleanup`, then open **Runs**. Three lessons use four readable documents to show direct acceptance, low-confidence interpretation, and a policy guard overriding high confidence. They simulate providers and required human approvals explicitly. The [classification review](classification-replay-review.md) describes their recorded routes and counts.

SQLite must include FTS5. If initialization reports that the extension is unavailable, use the tested Python build or a Python/SQLite build with FTS5 enabled. The application cannot provide its required lexical search without it.

## 5. Start the backend and frontend

Open two terminals at the repository root. For a repeatable offline walkthrough, start the backend with an explicit mode override:

```sh
APP_MODE=test-fixture uv run uvicorn doc_discovery.api:app --reload
```

In the other terminal:

```sh
npm run dev --prefix frontend -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. The frontend talks to the API at `http://127.0.0.1:8000`; it does not need a provider key. Open `http://127.0.0.1:8000/docs` for the generated API reference and `http://127.0.0.1:8000/api/health` for readiness.

For live execution, stop the backend and restart it with the configured credentials:

```sh
APP_MODE=live uv run uvicorn doc_discovery.api:app --reload
```

Use one backend process. Development reload can interrupt active in-process jobs; it does not delete checkpoints or events. The production command in [deployment](deployment.md) omits `--reload`.

## 6. Inspect a classification and resolve review

In Library, load the sample corpus if you did not use the CLI. Select the January invoice and the ambiguous agreement email, then start classification. Two worker instances appear. The fixture invoice takes the System 1 acceptance branch; the ambiguous email takes frontier interpretation and review. To test extraction failure separately, upload an empty file explicitly; it stays outside the indexing path and can be cleared from the collection afterward.

Select the invoice's decision node. Read the input excerpt and category definitions, the `invoice` Choice, its confidence/distribution, and the applied acceptance threshold. The explanation belongs to the recorded policy; it is not a generated Jev rationale. Compare the node/provider interval with the separately measured policy duration and queue wait. The provider duration includes the client/network path; it is not an isolated model-compute measurement. Select the email's proposal to see why it requires human confirmation.

Review all outstanding items together. For the mixed email, read the text and choose a correction to correspondence. If the provider already proposes correspondence, accepting that proposal is equivalent. The simulated adapter can propose contract to make the correction path visible. The review contains an interrupt ID and revision so a stale browser cannot silently submit old decisions. Submit the complete set, then observe the resume, indexing, and final result events. The original Jev judgment remains visible alongside the human action.

To check persistence, pause at review, stop the backend with Control-C, and start it again with the same `APP_DATA_DIR`. Reload the run and submit review there. Awaiting-review checkpoints should survive. Work stopped between checkpoints appears interrupted; use Recover when the interface reports an eligible checkpoint. If versions differ or no compatible checkpoint exists, inspect the explanation and start a new run.

After the first walkthrough, classify the other readable sample documents and resolve remaining proposals so the agreements and reports are searchable. Importing alone does not make an unclassified document evidence.

## 7. Search, compare, and inspect citations

In Discover, enter `Atlas`, choose category `invoice`, and set dates from `2026-01-01` through `2026-03-31`, inclusive. This is a simple find request: inspect the retrieval task and matched passages without expecting a narrative answer. The authored matches are the January and March Atlas invoices. The undated Atlas invoice is excluded by the explicit range, and its exclusion is counted. Clearing the range retains undated documents in the library.

Next ask:

> Compare the termination notice periods in the Atlas service agreements.

Inspect the intent decision, the bounded query plan, and the separately identified retrieval workers. Their evidence joins before synthesis. Inspect the recorded query plan, candidate and retained-evidence counts, unvalidated draft claims, exact-citation validation, and claim-support gate. These artifacts show how the answer was formed without presenting hidden model reasoning. Open a citation to read the exact stored passage and page or section. The reference facts are 30 calendar days for Northstar and 60 for Copperleaf. A report contains a conflicting unverified 45-day spreadsheet assumption; an unsigned email proposes 15 days. These statements should not silently replace the signed terms when retrieved.

Finally ask:

> What is the Atlas submarine insurance policy number?

There is no reference answer in the corpus. The expected outcome is an explicit insufficient-evidence result. A retrieval or provider error should instead be identified as an error or partial result. The small lexical index can miss a relevant passage when the search terms do not match, even when a model could have understood it if supplied.

## 8. Follow a trace, then replay locally

For a live run with `LANGSMITH_TRACING=true` and a working key, open the run's available trace link. Compare the application run ID and worker IDs with provider, retrieval, policy, and review spans. Inspect trace inputs and outputs to confirm that ordinary spans contain sanitized operational data. The app records telemetry delivery separately; no trace link should be invented when upload fails.

Replay is available from the saved run even without LangSmith. Select Replay, pause, single-step, change speed, and scrub the timeline. These controls change the visible cursor, not the backend. Provider call counts and measured elapsed times retain their recorded values. Read the parallel timing lanes and separate processing from human-review waiting; overlapping call durations must not be added as if they were run wall time. The [reading guide](reading-a-run.md) defines every measurement boundary. Refresh the page and reopen the run; it should restore from its snapshot and later events without model calls. Cancel is a separate command for active execution.

If the browser disconnects, reconnect from the last event sequence. The stream accepts `?after=<sequence>` and `Last-Event-ID`, sends heartbeat comments, and closes after a terminal event. A detected sequence gap causes the browser to reload the consistent snapshot.

## 9. Run checks and build the frontend

Run the offline checks before spending provider calls:

```sh
uv run ruff check src tests
uv run pytest
npm run lint --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
```

Run the separately labeled evaluation and the opt-in live smoke check. Stop the development backend before `live-smoke` when using the same data directory; the CLI checks the same process lock. Evaluation creates an isolated temporary database.

```sh
uv run doc-discovery evaluate
uv run doc-discovery live-smoke
```

The live smoke command uses four fictional documents and the comparison query, requires real credentials, and supplies an explicit scripted reviewer for synthetic proposals. This scripted smoke reviewer does not change the application's human-review policy. The command writes `smoke-report.json` under `APP_DATA_DIR`; `evaluate` writes `evaluation-report.json`. Read its actual status for each integration. A skipped or failed provider check is not a simulated success. `evaluate --live` is an additional paid evaluation run; inspect [evaluation](evaluation.md) for its scope before choosing it. To rerun only the complex reference case, use `uv run doc-discovery evaluate --live --case eval-compare`; this writes `evaluation-eval-compare.json` rather than replacing the full report.

For browser behavior, install the Playwright browser with `npx --prefix frontend playwright install chromium`, then use the frontend's `npm test --prefix frontend` command. Stop the development frontend first because the browser test uses port 5173. The test config starts isolated fixture services on backend port 8001 and frontend port 5173; see the current package scripts and [evaluation record](evaluation.md) for the checks actually executed.

A production build writes `frontend/dist`. Test the Vercel environment boundary without relying on a parent `.env`:

```sh
VERCEL=1 VITE_API_BASE_URL=https://backend.example.invalid npm run build --prefix frontend
```

The example origin is a build-only placeholder, not a deployed backend. A successful build establishes frontend compatibility. It does not establish deployment, network reachability, or live provider access.

## 10. Diagnose and stop cleanly

| Observation | Action and expected result |
| --- | --- |
| Missing Jev or OpenAI key | Check readiness and edit the backend environment. Restart to reload settings. Fixture mode requires no provider credentials and stays visibly Simulated. |
| Invalid key or forbidden account | Read the provider failure event; correct account access. Readiness distinguishes configured credentials from a completed remote check. |
| Rate limit, timeout, or provider outage | Inspect the recorded attempt and failure. Retry/recover only when eligible; a failed call is not a low-confidence decision. |
| Unsupported, oversized, or empty file | Use UTF-8 `.txt`/`.md` or a text PDF within the configured limit. Empty, scanned, encrypted, or unreadable content stays unindexed with an extraction explanation. A PDF with an image-only page and no extractable text on that page is conservatively withheld as a whole, with the affected page and OCR requirement identified; ordinary blank pages are permitted. OCR is unavailable. |
| SQLite or FTS5 error | Run `doc-discovery init` and verify write access to the data directory and FTS5 support. Keep the database on local persistent storage. |
| Frontend says disconnected | Verify backend health, port, and `VITE_API_BASE_URL`. A changed build-time frontend value requires a new build. |
| CORS failure | Add the exact browser origin to backend `CORS_ORIGINS` and restart. Scheme, host, and port all matter. |
| SSE reconnects or no updates | Disable proxy buffering, allow long-lived responses, and confirm cursor/heartbeat behavior with the command in [deployment](deployment.md). |
| No LangSmith trace | Check tracing enablement, endpoint, project/account access, and delivery status. The local event record still works. |
| Review submission returns conflict | Reload the run and use its current interrupt ID/revision; submit every outstanding item together. |
| Run interrupted by restart | Recover only if the saved graph/configuration and checkpoint are compatible. Otherwise start a linked/new run as indicated by the API. |

Use Control-C in each development terminal to stop the app. Keep `.env`, source files, sample documents, and lockfiles. To deliberately reset generated demo data, stop the backend and run the guarded command:

```sh
uv run doc-discovery reset --confirm
```

This command only removes the default `.runtime` demo directory, including uploaded files, checkpoints, and run history, and refuses to run while the backend holds its process lock. It never deletes a custom `APP_DATA_DIR`. Use it only for disposable demo data; reload samples afterward with `load-samples`. It does not reset provider accounts or erase LangSmith traces.
