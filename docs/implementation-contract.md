# Shared implementation contract

The Python models in `src/doc_discovery/schemas.py` are authoritative. All IDs are strings; timestamps are UTC ISO strings. Execution mode is `live` or `test-fixture` (display the latter as **Simulated**). Provider failures never fall back to fixtures.

## Ownership

Coordinator: schemas, settings, storage, ingestion, events, API, CLI, manifests and integration tests. Workflow engineer: providers, policies, telemetry, workflows, workflow tests. Interface engineer: all frontend files and JavaScript lockfile, generated types script, browser tests. Documentation engineer: corpus, docs, diagrams, evaluation cases. Propose shared-contract changes by message before editing.

## HTTP

- `GET /api/health`: `{status, mode, fts5, integrations: {jev, openai, langsmith}, configuration}`; integrations are readiness strings, never secret values.
- `GET /api/documents?category=invoice&date_from=2026-01-01&date_to=2026-12-31`: DocumentList. `POST /api/documents` multipart `files` → `{documents: Document[]}`. Optional `document_date` applies to uploads and is user-confirmed.
- `POST /api/samples` → `{documents: Document[]}`; idempotently loads fictional corpus, does not classify.
- `GET /api/documents/{id}` → `{document, passages}`; `PATCH /api/documents/{id}` MetadataUpdate.
- `GET /api/passages/{id}` → Passage.
- `POST /api/runs/classification` ClassificationRequest; `POST /api/runs/discovery` DiscoveryRequest. Both accept `Idempotency-Key` and promptly return Run.
- `GET /api/runs` → `{runs: Run[]}`; `GET /api/runs/{id}` → RunSnapshot with events through the same cursor.
- `GET /api/runs/{id}/history?after=0` → `{events: Event[]}`.
- `GET /api/runs/{id}/events?after=0` → SSE; `id` is sequence, `event: execution`, `data` is Event. Heartbeats are comments. Last-Event-ID supported. Terminal streams close.
- `POST /api/runs/{id}/review` ReviewSubmission → Run (409 stale/incomplete; all items together).
- `POST /api/runs/{id}/cancel` → Run. `POST /api/runs/{id}/recover` → Run. Interrupted compatible checkpoint continues; otherwise 409 with explanation.

## Workflow service boundary

Coordinator instantiates `WorkflowEngine(settings, storage, events, checkpointer)` from `workflows/engine.py`. Its `async execute(run_id, resume: dict | None = None, recover: bool = False)` runs one job, sets statuses and result, emits events. `async close()` closes providers/telemetry. Coordinator owns tasks, per-run command locks, cancellation and restart bookkeeping. Engine reads `storage.get_run(run_id)`.

Storage synchronous methods: `get_document(id) -> Document`, `passages(document_id) -> list[Passage]`, `get_passage(id) -> Passage`, `read_text(id) -> str`, `update_document(id, **fields) -> Document`, `index_document(id)` idempotent, `search(phrase, filters: SearchFilters, limit=8) -> list[Passage]`, `get_run(id) -> Run`, `update_run(id, **fields) -> Run`, `documents(filters=None) -> DocumentList`. Run request holds document_ids or query/filters. App storage operations are small local SQLite transactions; do not await inside transactions.

`await events.emit(run_id, type, instance_id, payload, parent_instance_id=None, attempt=1, key=None) -> Event`. Default logical key hashes run/type/instance/attempt/payload; explicit keys where needed. Event payloads validated by schema. Use NodePayload on worker/node events, EdgePayload on edges, Decision on decisions, ReviewRequest on review requests. run_completed payload contains `{status, result}`. On engine completion storage contains final result. Review interrupt payload uses LangGraph actual interrupt ID set after graph pauses. Node IDs should use `dispatch`, `{document_id}:extract`, `{document_id}:jev`, `{document_id}:interpret`, `{document_id}:outcome`, `join`, `review`, `index`, `done`; worker parent is `worker:{document_id}`. Discovery uses `intent`, `plan`, `worker:{task_id}`, `{task_id}:retrieve`, `{task_id}:screen`, `join`, `synthesize`, `support`, `done`.

Classification result: `{outcomes: {document_id: {document_id, status, category, error?}}, indexed_count}`. Discovery result: `{intent, plan, passages: Passage[], claims: Claim[], missing_evidence: string[], message, partial: boolean, provenance?: object}`. Keep full decisions in events. Graphs use persistent AsyncSqliteSaver supplied by coordinator. Persist only IDs and bounded results in state when possible. Disable automatic graph tracing of raw state; explicitly trace sanitized spans.
