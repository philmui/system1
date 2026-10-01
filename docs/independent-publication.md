# Independent document publication

New classification runs use `atlas-classification-v2`. A document accepted by the runtime can become searchable inside its worker, before unrelated workers finish or the batch enters human review. The join accounts for all inputs; it does not gate already committed search results.

Interpretation still creates a proposal. The complete, revision-checked human submission is recorded before any proposed document is published. A correction publishes the selected supported category. An exclusion withdraws the document from search. An indexing failure remains a failed document outcome even when its classification decision was accepted.

## Durable evidence and replay

`Storage.publish_document` resolves authority from a recorded accepted decision or the exact recorded review submission. In one SQLite write transaction it checks the run and document, writes accepted metadata, replaces the FTS rows, records a publication identity, and appends a `node_completed` event for `<document_id>:publish`. A failed event write rolls back the index and metadata too. SSE notification happens after the commit; notification loss cannot lose its event.

The event's optional `publication` payload records its identity, document/content version, authorizing decision or review identity, category, `searchable` or `withdrawn` status, and commit time. Replay derives availability from this event's sequence, not from the document's later mutable state. Older events without publication evidence do not acquire early searchability.

Publication is unique per run, document, and content version. Recovery after a commit reuses the durable identity and event instead of adding another search-index entry or publication count. Final aggregation reconciles those worker commits and publishes newly approved review items. An awaiting-review run's `indexed_count` counts publications made by that run.

## Reclassification and cancellation

Document source versions are immutable. A previously approved version remains searchable, with its approved category and provenance, while a new classification or review is pending. A new approved decision atomically replaces its classification metadata; explicit human exclusion withdraws it. A cancelled or failed reclassification leaves its previous approved version available. Accordingly, zero publications in a reclassification run does not imply that its source has never been searchable.

The publication transaction rejects inactive runs, archived inputs, changed content versions, and superseded document assignments. A later explicit classification command prevents an older interrupted checkpoint from overwriting it. Cancellation prevents new commits after cancellation takes effect; already committed accepted documents remain searchable.

## Compatibility and teaching records

Saved `atlas-v1` classification checkpoints and reviews continue through the original graph and batch-wide publication barrier. Configuration and policy compatibility checks still apply. New graph versions are assigned only when creating new runs; historical recordings are not rewritten.

The `classification-teaching-v2` pack has new identities and copies publication records alongside its completed runs and events. Older teaching packs remain inspectable. Repeated seeding of the same version is idempotent and does not start providers in the operational backend.

## Verification

`tests/test_independent_publication.py` queries the real Discovery API while another classification worker is held, verifies that pending proposals remain absent, and tests review-pending counts. It also covers transaction rollback after FTS insertion, interruption after commit but before worker checkpoint, legacy review resume, cancellation and archive checks, indexing failure, correction/exclusion of a previously approved source, and superseded recovery. Teaching-pack tests check copied publication records and preservation of historical runs.
