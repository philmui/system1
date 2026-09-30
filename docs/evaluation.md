# Evaluation and verification

The application distinguishes three kinds of evidence: deterministic checks of implementation behavior, an authored synthetic evaluation set, and opt-in live integration runs. A passing fixture workflow verifies routing and persistence under controlled responses. It does not measure Jev or OpenAI quality. Live results depend on credentials, selected models, provider availability, and the retrieved context.

## Data and reference labels

`data/samples/manifest.json` describes 14 fictional Atlas documents used for the walkthrough: four invoices, two service agreements, two policies, two reports, two correspondence items, one poem, and one empty document. The mixed agreement email is labeled correspondence with review expected. The empty document has an extraction issue and remains unknown. The authored labels and exact supporting spans are references, not outputs of the fixture provider.

`data/evaluation/classification.json` contains eight independently authored held-out texts: one per named category, one outside-taxonomy item, one insufficient-evidence fragment, and one mixed-purpose email. These texts differ from both the Atlas walkthrough corpus and routing unit-test fixtures. `data/evaluation/discovery.json` contains five separately labeled query cases over the demo collection: an inclusive single-day filter, overlapping/conflicting termination passages, a missing fact, a query whose relevant email contains instruction-like text, and an explicit complex comparison.

The evaluation set is small and synthetic. The author labels are deliberate reference judgments rather than independently adjudicated ground truth. No tuning split was used and no threshold was tuned on these eight cases. If thresholds are adjusted later, create separate tuning examples and retain these references as a fixed held-out comparison.

## What to measure

| Measure | Unit and interpretation |
| --- | --- |
| Category accuracy | Correct category labels / labeled readable documents; report unknown/extraction cases separately. |
| Ambiguous-case escalation | Expected ambiguous items sent for interpretation/review / labeled ambiguous items. Also report unnecessary escalation on clear items. |
| Retrieval relevance | Distinct returned source filenames matched to authored relevant filenames, together with misses and irrelevant returned documents. This document-level summary does not measure passage-level precision. Lexical candidate limits remain part of the condition. |
| Citation validity | Returned citation IDs and exact quoted spans resolving to supplied retained source versions / returned citations. |
| Answer support | Claim-level agreement with authored facts, including distinction between signed terms, proposals, and conflicting summaries. |
| Calls and latency | Actual provider call count and observed elapsed time for the recorded run. Missing usage stays unavailable. |

The policy defaults are Choice confidence `0.80`, relevance Noul `0.70`, and support Noul `0.80`. Boundary tests exercise below, equal, and above thresholds and are separate from quality evaluation. These three numbers are not interchangeable, and this project does not claim that any is calibrated to a desired error rate.

## Running the checks

From the repository root:

```sh
uv run ruff check src tests
uv run pytest
npm run lint --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
uv run doc-discovery evaluate
```

The unit and integration checks should make no paid network calls. They exercise provider parsing, explicit routing, dynamic workers and keyed joins, review/resume, metadata filters, evidence/citation gates, event ordering, reconnect/replay behavior, extraction errors, and configuration. Consult the tests for the exact coverage rather than interpreting this list as model-quality evidence.

The frontend browser command is `npm test --prefix frontend`. It uses isolated fixture services and exercises the live event UI. The [saved screenshots](screenshots/README.md) show the inspected views; they do not establish parity with the inaccessible video.

Live checks are explicit:

```sh
uv run doc-discovery live-smoke
uv run doc-discovery evaluate --live
```

The smoke check uses a bounded synthetic workload. Stop the development backend first when using the same `APP_DATA_DIR`; the CLI enforces the backend's process lease. Evaluation uses an isolated temporary database. A successful remote response verifies that integration for that request and model. It does not prove accuracy on all document types, reliable rate limits, or durable delivery for future traces. A failure should retain its actual category and leave the remaining app usable. Live mode never changes to fixture results automatically.

## Observed results on September 28, 2026

The retained [machine-readable results](evaluation-results.json) combine eight classification cases with five query cases. The explicit comparison case was added and executed separately after the first four query cases; the original four results were retained. This was one observation per case, with no threshold tuning. Live models were `jev-1.13.0` and `gpt-4.1-mini-2025-04-14`.

| Classification check | Live providers | Simulated fixture adapter |
| --- | --- | --- |
| Category matched authored label | 8 / 8 | 6 / 8 |
| Escalation matched authored expectation | 8 / 8 | 7 / 8 |

The live insufficient-evidence fragment and mixed-purpose email escalated as expected. The eight live classification cases used 10 provider calls and 4.747 seconds of summed observed run time, with individual cases ranging from 120 to 2,154 milliseconds. These small, invented texts do not establish broad accuracy or a latency guarantee. The fixture adapter's label and relevance weaknesses are retained in the record; its role is repeatable workflow development.

Discovery used the readable Atlas documents indexed with the authored reference labels, excluding the ambiguous email and empty file. This isolates retrieval and answer behavior from classification errors. Counts below are distinct source documents, not individual passage judgments.

| Live query case | Relevant returned / total returned | Authored relevant documents | Calls | Observed run time |
| --- | --- | --- | --- | --- |
| Inclusive single-day invoice filter | 1 / 1 | 1 | 3 | 1.83 s |
| Overlapping termination passages | 4 / 4 | 4 | 5 | 2.73 s |
| Absent insurance fact | 0 returned | 0 | 2 | 0.27 s |
| Preview date with instruction-like text | 2 / 2 | 2 | 5 | 1.99 s |
| Explicit agreement comparison | 4 / 4 | 4 | 9 | 7.39 s |

The live comparison retained three claims: Northstar requires 30 calendar days, Copperleaf requires 60 calendar days, and the internal 45-day spreadsheet value conflicts with the signed Northstar term. All five citation identifiers and exact quotations resolved to supplied passages. Three separate Jev support checks passed. A manual reading against the authored references found those three claims consistent with the cited synthetic evidence; Jev's support judgment is additional fallible feedback, not independent ground truth.

All five query runs completed, and the absent-fact case returned insufficient evidence. The classification and query evaluation together used 34 live provider calls. Latency is measured wall time for these local runs; no cost estimate is reported. The fixture preview-date query returned seven source documents, only two of which were labeled relevant, illustrating why a simulated relevance rule cannot stand in for a live quality evaluation.

A separate live smoke walkthrough classified four synthetic documents, observed and resumed review, and compared the two agreements. Classification and discovery succeeded in 11.464 seconds. Its two final claims cited the 30-day and 60-day agreement passages. All three completed LangSmith trace segments were read back: 11 spans for initial classification, 2 for review resumption, and 22 for discovery. Across those 35 spans, no forbidden document, query, prompt, or content fields appeared in inputs/outputs. The resume segment needed a later authenticated readback to confirm eventual delivery; provider calls were not repeated. A decision-event count is not a provider-call count because one Jev request can answer several independent questions.

## Verification record

The final implementation report is recorded in [verification](verification.md), including exact command outcomes, browser evidence, live status, and remaining unverified behavior. That record is populated from executed checks rather than expected outputs.

The dependency set resolved and imported on Python 3.14.6, retaining the original 3.14 minimum and adding `<3.15` to stay within the tested Python minor version. The five SVG diagrams were regenerated with the standard-library renderer, rendered to PNG, and inspected for text and connector problems. The canonical video could not be inspected, so visual comparison remains unverified. Vercel build compatibility and an actual deployment are separate entries.

## Optional Jev evaluation in LangSmith

A runtime trace and a hosted evaluator are different integrations. In LangSmith, create the TypeSafe provider secret for the workspace, select Jev as the evaluator, and map the evaluation input to the relevant trace fields. A local `.env` key does not automatically create that hosted secret. The [hosted evaluator article](https://www.langchain.com/blog/jev-is-now-available-in-langsmith-evals) describes the provider secret and variable mapping.

For a claim-support evaluator, provide the claim text plus only its cited passages, identify each passage explicitly, and ask a `Noul` question: “Is every factual assertion in this claim supported by the supplied passages, without resolving a contradiction through unstated assumptions?” Map the returned `.noul` to a feedback key such as `claim_support_probability`; store the rubric version and configured/returned model. If a separate binary pass field is needed, derive it explicitly with the configured support threshold. Do not label a Noul value confidence.

The implemented Python callback is `doc_discovery.telemetry.jev_trace_evaluator(run, example=None)`. It follows LangSmith's asynchronous evaluator shape and returns `key`, nullable `score`, and `comment`. It resolves the application run ID from trace inputs or metadata, opens the original local `APP_DATA_DIR`, retrieves retained claims and their passages, and makes at most eight live Jev support calls. Its feedback key is `jev_claim_support_probability`; the score is the mean returned Noul value, with the rubric and fallibility noted in the comment. It skips with `score=None` when the local evidence is unavailable or the run was simulated. Set `APP_MODE=live` and point `APP_DATA_DIR` at the original run storage before registering this callback. The callback is tested with mocked mapping and skip cases; no hosted callback experiment is claimed. The separate synthetic-text trace opt-in is tested for eligibility and private-text exclusion but was not enabled during the recorded live smoke. Selected evidence goes to Jev for evaluation, while the callback keeps trace payloads sanitized.

For category evaluation, use a `Choice` over the documented taxonomy with the source text and label definitions. Compare the returned category and escalation decision with the held-out references. Review disagreements manually; do not let a second Jev judgment replace the authored reference automatically. The [judge evaluation article](https://www.langchain.com/blog/jev-agent-evals-langsmith) explains why repeated agreement and correctness are different questions.

Evaluate intermediate behavior too: whether the correct sources were retrieved, whether unsupported claims were removed, whether failures remained failures, and whether review resumed the same run. Hosted evaluation setup and any broad quality or cost comparison remain optional; no hosted experiment is claimed without a retained result.
