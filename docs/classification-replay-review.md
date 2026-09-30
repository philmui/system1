# Classification lessons, shared flow motion, and adversarial review

Verified September 29, 2026. This record covers the classification redesign and the later cleanup and shared animation changes. Earlier screenshots and browser results in this repository predate these changes.

The document is the subject of the replay. Example cards above the graph invite the reader to choose a recorded decision. The graph exposes three separate responsibilities: System 1 returns structured category/confidence data, runtime policy applies thresholds and guards, and a frontier model interprets only the selected exceptions. The evidence below the graph uses the replay's event prefix. The example chooser and call comparison explicitly describe the whole recording.

## Readable synthetic examples

The four files in `data/classification-examples` are bound to their fixture signals by synthetic provenance and content hash. Live adapters use the actual document and can return different judgments; they never substitute the teaching fixtures. The threshold and mixed-purpose guard are the real application policy.

| Document | Prepared System 1 judgment | Runtime route | Prepared frontier proposal |
| --- | --- | --- | --- |
| Clear invoice | invoice, 97% | Accept | No call |
| Access policy | policy, 96% | Accept | No call |
| Invoice or progress report | invoice, 58% | Interpret: below 80% threshold | report |
| Unsigned agreement email | contract, 96% | Interpret: mixed-purpose guard | correspondence |

`uv run doc-discovery teaching-runs --cleanup` records three completed lessons with the real graph in an isolated fixture store, then publishes their documents, passages, search entries, runs, and events. Providers and required human approvals are explicitly simulated. Repeating the command returns the same completed run identities.

| Teaching run | Readable inputs / indexed outputs | Bounded calls | Frontier calls |
| --- | --- | --- | --- |
| Clear categories | 2 / 2 | 2 | 0 |
| An uncertain category | 2 / 2 | 2 | 1 |
| A policy guard overrides confidence | 4 / 4 | 4 | 2 |

All three recordings were installed in the local collection. Two failed or partially successful runs and one empty document were cleared from the main lists. Archival preserves their source and event history. Active work, pending review, recoverable inputs, and indexed sources remain protected. New classification admission and cleanup share a SQLite write transaction boundary, including across processes.

## Motion and timing

Classification, discovery, and `/#workflow` share 6 px selected paths, a broad color halo, directional flowing highlights, and a numbered document marker. Completed paths remain solid; available alternatives remain dotted. Each transfer moves the document forward once. Pause freezes the transfer and highlight; reduced-motion keeps a static marker and selected route.

Replay skips bookkeeping and compresses work holds while giving policy decisions more reading time. This is presentation timing. Stored provider measurements and the Workflow comparison's modeled time, cost, call counts, and outcomes retain their original values. The call comparison counts request attempts separately from distinct readable documents and labels the frontier-for-every-input alternative hypothetical.

## Independent Codex adversarial review

The requested read-only review checked educational semantics, controls, event-prefix disclosure, failures, accessibility fallbacks, and data cleanup. Fixes included:

- Persistent route labels after indexing, and explicit runtime authority for high-confidence policy exceptions.
- Separate failure bypasses that cannot become acceptance after a later successful attempt; mixed proposals/issues stay visible in batch mode.
- Handoffs appear before their destination starts, including discovery's first worker step.
- Shared steps use `ALL`, avoiding misleading document `00` markers.
- Unknown proposals require correction or exclusion; the UI does not offer an invalid acceptance.
- Archived sources retain their names and remain inspectable. Explicit sample reload restores readable inputs, and restart respects archive admission.
- Imported fixtures show their own provider mode and scripted-review disclosure, even under a live backend.

The reviewer independently replayed 72 Workflow comparison traces across both strategies, examples, review outcomes, and timing assumptions. Final modeled metrics matched the prior implementation. Independent seed verification confirmed complete event sequences, all four indexed/searchable sources, the 2/0, 2/1, 4/2 call counts, and idempotence. The final review reported no remaining actionable findings.

Design guidance used: [Anthropic frontend design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) and [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md).

## Executed verification and limits

- Backend: **81 tests passed**; Ruff passed.
- Frontend: **41 unit/layout/render tests passed**; TypeScript, ESLint, and production build passed.
- Targeted tests cover policy reasons, provider attempt counts, forward/backward replay, failure retries, discovery handoffs, simulated review, archive/reload/restart behavior, and concurrent archive admission.
- All 32 local links in the six edited guides resolve. The repository-wide documentation checker still reports broken links in unrelated archived slide/blog documents.
- Browser tests were updated for the new controls and presentation timing, but **were not executed successfully**. The sandbox denied binding local test services and Chromium's macOS process initialization. A read-only request to the existing backend was also denied. Responsive rendering, actual motion smoothness, and the already-running server's reload state remain unverified.

Run `npm run test:e2e --prefix frontend` in an environment that permits local services and Chromium. Its fixture services use separate data and ports 8001/5174.
