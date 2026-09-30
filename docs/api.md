# HTTP API and event examples

Start the backend with the [tutorial](tutorial.md). The generated HTTP route contract is available at `http://127.0.0.1:8000/docs`, `/redoc`, and `/openapi.json`, with a checked-in [OpenAPI export](api.openapi.json). The [complete public model schema](../frontend/src/lib/api.schema.json) also includes every validated event payload type, including those sent through SSE. Regenerate it with `npm run generate:types --prefix frontend`. The public schemas come from `src/doc_discovery/schemas.py`; the browser does not consume arbitrary LangGraph state.

## Commands and source records

| Method and route | Purpose and response |
| --- | --- |
| `GET /api/health` | Readiness, execution mode, FTS5, public configuration, and recent run error. `configured` means key presence, not a successful provider request. |
| `POST /api/documents` | Multipart `files` and optional user-confirmed `document_date`; returns `{documents: [...]}`. |
| `POST /api/samples` | Idempotently load the 13 readable Atlas samples; does not classify. Explicit reload restores cleared readable samples. |
| `POST /api/samples/classification` | Idempotently load four readable teaching documents for direct acceptance, uncertainty, and a policy guard; does not classify. |
| `GET /api/documents` | List active documents; optional `category`, `date_from`, `date_to`, `include_archived`; returns documents and `excluded_unknown_dates`. |
| `POST /api/documents/cleanup` | Clear unsuccessful/unreadable inputs from the collection, retaining their source history; returns `archived_document_ids`. Protects active, pending review, recoverable, and indexed inputs. |
| `GET /api/documents/{document_id}` | Document metadata plus its retained passages. |
| `PATCH /api/documents/{document_id}` | Set nullable `document_date`; mark supplied date as user-confirmed. |
| `GET /api/passages/{passage_id}` | Exact passage with retained version, offsets, and page/section. |
| `POST /api/runs/classification` | Start classification with `document_ids`; returns `202` Run promptly. |
| `POST /api/runs/discovery` | Start query with structured filters; returns `202` Run promptly. |
| `GET /api/runs` | Return `{runs: [...]}`. |
| `POST /api/runs/cleanup` | Clear failed and partially successful runs from the list; returns `archived_run_ids`. Retained snapshots/history remain inspectable. |
| `GET /api/runs/{run_id}` | Consistent `{run, events, last_event_sequence}` snapshot. |
| `GET /api/runs/{run_id}/history?after=0` | Ordered persisted events after the cursor. |
| `GET /api/runs/{run_id}/events?after=0` | SSE execution events, heartbeat comments, and a settled event before closing. |
| `POST /api/runs/{run_id}/review` | Complete review set, interrupt ID, revision; returns `202` Run on accepted resume. |
| `POST /api/runs/{run_id}/cancel` | Best-effort cancellation; returns current Run. |
| `POST /api/runs/{run_id}/recover` | Resume an eligible compatible interrupted checkpoint; otherwise `409` explanation. |
| `POST /api/runs/{run_id}/restart` | Start a linked new run from a terminal/interrupted run; uses current configuration. |

Run states are `queued`, `running`, `awaiting_review`, `interrupted`, `succeeded`, `partially_succeeded`, `failed`, and `cancelled`. A provider failure does not become an empty successful result.

## A runnable local request sequence

Check readiness and load the sample records:

```sh
curl -sS http://127.0.0.1:8000/api/health
curl -sS -X POST http://127.0.0.1:8000/api/samples
```

Upload one fictional invoice with its confirmed issue date:

```sh
curl -sS http://127.0.0.1:8000/api/documents \
  -F 'files=@data/samples/atlas-invoice-january.md' \
  -F 'document_date=2026-01-15'
```

For a complete classification command without manually copying IDs, this Python client loads the corpus, selects two walkthrough items, and prints only the start response's ID and status:

```sh
uv run python - <<'PY'
import httpx

base = 'http://127.0.0.1:8000'
with httpx.Client(base_url=base) as client:
    response = client.post('/api/samples')
    response.raise_for_status()
    names = {'atlas-invoice-january.md', 'atlas-ambiguous-agreement-email.md'}
    ids = [d['id'] for d in response.json()['documents'] if d['filename'] in names]
    response = client.post('/api/runs/classification', json={'document_ids': ids},
                           headers={'Idempotency-Key': 'tutorial-readable-documents-v2'})
    response.raise_for_status()
    run = response.json()
    print({'run_id': run['id'], 'status': run['status'], 'mode': run['mode']})
PY
```

Repeating the same idempotency key and body returns the same run. Reusing that key with a different body returns a conflict. Choose a new key only when you intend new execution. Classification requests reject duplicate IDs, more than 30 documents, and documents already assigned to active classification/review work.

The simple search request has exact metadata filters:

```sh
curl -sS http://127.0.0.1:8000/api/runs/discovery \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: tutorial-atlas-invoices-v1' \
  -d '{"query":"Atlas","filters":{"categories":["invoice"],"date_from":"2026-01-01","date_to":"2026-03-31"}}'
```

A comparison body is:

```json
{
  "query": "Compare the termination notice periods in the Atlas service agreements.",
  "filters": {}
}
```

All start responses are full Run objects. A new one has its real `id` and `thread_id`, kind, `queued` status, explicit mode, versions, timestamps, request, and public configuration. Its `result` and `review` are initially null, and its event cursor initially starts at zero. The generated schema supplies every field; no fabricated run ID is a working example.

## Review, snapshot, and SSE shapes

Read a run's snapshot before submitting review. `run.review` supplies the actual `interrupt_id`, `revision`, and items. Submit one action for every outstanding document, using those returned identities. For example, a correction item has this shape:

```json
{
  "document_id": "<document ID from review.items>",
  "action": "correct",
  "category": "correspondence"
}
```

Wrap the complete list in `{"interrupt_id": "<returned ID>", "revision": 1, "decisions": [...]}`, replacing the revision with the returned value. This is a shape illustration; the angle-bracket strings are not valid recorded identities. `accept` uses the proposal, `correct` requires a non-unknown category, and `exclude` keeps the document unindexed. Stale/incomplete submissions return `409`; invalid action/category combinations return `422`.

An SSE execution message has these wire fields:

```text
id: 12
event: execution
data: {"schema_version":1,"event_id":"...","sequence":12,"timestamp":"...","run_id":"...","instance_id":"...","parent_instance_id":null,"attempt":1,"type":"node_started","payload":{"node_name":"join","label":"Join outcomes","state":"running"}}
```

This is an illustrative event, not a saved measurement. Actual events have stable IDs and complete validated payloads. Use `after` or `Last-Event-ID` to resume; if both are provided, the greater cursor wins. Heartbeats begin with `:`. After a terminal result or review pause, `event: settled` closes the connection. Resume review and reconnect from the last known sequence. The browser suppresses duplicate sequence numbers and reloads a consistent snapshot if it detects a gap.

The event types are `run_started`, `worker_created`, `node_started`, `node_completed`, `node_failed`, `decision`, `edge_selected`, `review_requested`, `review_resumed`, and `run_completed`. Edge payloads identify their `source_instance_id` and `target_instance_id`; the frontend does not infer traversal from a timer. Attempts expose application retries. Replay reads these events without starting a job or invoking a provider.

Optional node payload fields include monotonic `elapsed_ms`, provider `queue_wait_ms`, `query_plan`, unvalidated `draft_claims`, passage IDs, and input/output/removed counts. Decisions include `policy_elapsed_ms` for the deterministic route computation. Documents separately retain `extraction_elapsed_ms` for import-time extraction and anchor creation. These fields are persisted measurements and intermediate outputs; missing fields in older records remain unavailable. See the generated schema for the exact types and [reading a run](reading-a-run.md) for their interpretation.

A `run_completed` payload can set `timing_incomplete: true` when startup finds work left active by a prior process. The actual stop boundary is unknown, so clients must leave active wall time unavailable rather than count the entire downtime as execution.
