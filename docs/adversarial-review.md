# Adversarial review and fixes

The implementation was reviewed by separate Codex agents with ownership split across the backend, interface, and documentation. Reviews tried to contradict the application's claims: resume under a changed policy, fill the execution queue, change document eligibility during retrieval, overflow provider context through audit metadata, hide unreadable PDF pages, and scrub a graph through its recorded history. Reproduced defects were fixed and checked again. This is an engineering review of this demonstration, not a claim that every possible defect has been eliminated.

## Execution, evidence, and ingestion

| Reproduced problem | Resulting behavior | Regression evidence |
| --- | --- | --- |
| A saved review could resume after changing execution mode or thresholds. | Resume checks the recorded graph, policy, mode, and configuration before changing state. Incompatible requests return 409 and preserve the review. | `tests/test_adversarial_api.py` |
| Review and recovery commands bypassed the 16-job queue bound; an idempotent retry could fail merely because the queue was full. | New executions share queue admission checks. A valid retry returns its original run before queue admission. | `tests/test_adversarial_api.py` |
| Operational scans only considered the most recent 100 runs. | Restart and document-conflict checks scan all runs. The recent-runs display remains bounded. | `tests/test_storage.py` |
| A wrapped cancellation could become a workflow failure or allow later indexing. | Cancellation is checked at provider, transition, and publication boundaries. A cancellation after review acceptance prevents downstream index writes. | `tests/test_workflows.py`, `tests/test_adversarial_api.py` |
| A document indexed after planning could enter a supposedly recorded corpus scope. | A bounded, recorded document-ID set is applied in SQL before candidate ranking and limiting. | `tests/test_adversarial_events.py` |
| A document withdrawn or changed during screening could still reach a result. | Acceptance, category, and date eligibility are checked after screening, before synthesis, and immediately before publication. Affected evidence and claims are withheld with a partial/error explanation. | `tests/test_adversarial_events.py`, `tests/test_adversarial_api.py` |
| Long filenames lost their extension during truncation, allowing a later upload to fail after earlier batch writes. | Every filename, type, and size is validated before ingestion. Valid names are retained as display metadata; generated IDs name stored files. | `tests/test_adversarial_api.py` |
| A PDF with a readable cover and an image-only second page was classified from the cover alone. | An image-bearing page without extractable text withholds the entire document and identifies the page requiring OCR. Ordinary blank pages remain allowed. | `tests/test_adversarial_api.py` |
| A passage beginning at a document heading could be labeled with a later heading. | The section label describes the passage's starting anchor. Exact retained offsets and source versions remain unchanged. | `tests/test_storage.py` |
| A long document's omitted-range audit could overflow a provider request even though the selected excerpts fit. | Providers receive the bounded selected context, completeness indicator, and omitted-range count. The complete omission audit remains in the local decision record. | `tests/test_adversarial_providers.py` |
| An unsuccessful smoke check exited successfully. | The report is retained and the command exits nonzero if classification or discovery did not succeed. | `tests/test_adversarial_providers.py` |
| A CLI walkthrough could use the backend's data directory concurrently. | Both execution entry points acquire the same exclusive local lease. A second owner receives an actionable error. | `tests/test_storage.py` |

The API also rejects attempts to forge source versions or synthetic identity through metadata updates. Provider tests cover invalid signals, missing credentials, refusal, incomplete output, timeouts, and retry bounds. Citation tests reject nonexistent IDs and quotations before semantic support checks. Telemetry tests verify payload filtering and ensure delivery failures do not change routing.

## Interface and measurement review

Browser inspection exposed a graph rendering defect after replay scrubbing: nodes could remain hidden while their recorded state was complete. The graph now supplies stable node geometry and handle positions, and browser checks assert both node and edge visibility after replay. Review completion updates worker status, source citations select the associated execution step, and stale network responses cannot overwrite newer filter or run state. A second reviewer found a resume race in which a terminal snapshot closed SSE before its final events had been applied. Snapshot reconciliation now merges the complete recorded event tail before closing the stream, with a dedicated regression check.

The educational timing view uses recorded measurements rather than playback speed. Provider request elapsed time includes client-observed network time; it is not isolated model computation. Parallel provider totals can exceed active wall time. Human review and known interrupted intervals are separated from active execution, and absent measurements remain unavailable. A hard crash with an unknown stop boundary makes active wall time unavailable instead of counting downtime as processing. Failed-attempt queue waits remain recorded, while missing provider measurements are excluded from request totals.

The result-formation view distinguishes retrieved candidates, retained evidence, unvalidated draft claims, exact citation checks, semantic support, and final output. Review found and corrected a misleading fallback that counted passages as final claims when every generated claim was withheld. A cited-claim count is also labeled separately from the number of individual citations. Tests check that intermediate artifacts and durations survive replay unchanged.

See [the verification record](verification.md) for final executed check counts and [the evaluation](evaluation.md) for the separately measured live model results. The browser uses clearly labeled simulated providers in CI. Live checks use only fictional Project Atlas documents.

## Limits retained deliberately

SQLite, FTS5 lexical retrieval, one backend process, and an in-process job queue are explicit demonstration limits. Checkpoints recover eligible interrupted graph work; they do not promise exactly-once provider calls. PDF extraction has no OCR and cannot establish that every visually meaningful mark was extracted. Jev relevance and support checks are fallible judgments, not independent ground truth. No public deployment or visual comparison with the inaccessible reference video is claimed.
