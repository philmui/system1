# Read the work, the time, and the answer

A run is an ordered record of work that actually happened. The graph shows which component ran and which branch followed. The **Work, evidence, and elapsed time** panel shows when that work overlapped and which intermediate outputs survived validation. Read these views together: a fast provider response can still lead to human review, and a fluent draft can still lose claims at an evidence gate.

Use **Simulated** mode to learn the controls, then inspect a live run for provider measurements. Fixture adapters include artificial delays to make execution visible. Those delays do not measure Jev or OpenAI performance.

## Follow one classification decision

The default **Explore** page provides prepared lessons without creating operational runs. Its compact receipt separates the original judgment, applied rule, and selected capability; source evidence and longer explanations appear under **Why?**. The published category appears only after publication. Navigation preserves the selected lesson across Explore, Compare, and Experiment; Documents and Runs remain workspace utilities.

**Find & compare** starts with a capability tree: intent judgment and runtime policy choose code or frontier planning, then evidence rules select source results or composition with validation. Select a card for recorded rules and measurements; **All steps** shows the technical graph at the same replay position. The whole-run summary stays fixed while card evidence and results follow the replay cursor.

**Run classification** measures actual model requests and policy evaluation on the prepared document. That preview finishes at an accepted category or a proposal; **Outside preview** on approval and Publish is an intentional boundary, not failed work. Its elapsed time excludes review and publication, so it cannot establish time to searchable. **Compare latency & quality** can measure two fresh strategies on the same source and shows both elapsed values, request counts, and the relative latency percentage.

New `atlas-classification-v2` runs publish each accepted document independently. A publication event establishes searchability before the remaining batch finishes; pending frontier proposals still require review. Historical `atlas-v1` replays retain their original batch barrier. [The publication contract](independent-publication.md) explains recovery, exclusion, and preservation of previously approved sources during reclassification.

Start with a completed teaching run created by `uv run doc-discovery teaching-runs`. The three runs introduce clear categories, low confidence, and a policy guard that overrides high confidence. Their four synthetic documents are all readable and successfully indexed. The latter two runs explicitly simulate human review. Choose a labeled example above the graph to replay its decision, or expand **All documents** to follow another input.

The graph separates the **System 1 Model**, which returns a category and confidence, from **Runtime policy**, which applies the recorded threshold and guards. A clear invoice takes **Accept category** with no frontier request. A progress report mentioning future billing scores 58% for invoice and takes **Interpret**. An unsigned agreement email scores 96% for contract but also takes **Interpret** because the mixed-purpose guard fires. These signals are prepared fixtures; live model responses can differ. The runtime uses the real policy in both modes.

**Read document** reads the extraction status and passages created during import; it does not repeat PDF extraction. An explicitly uploaded empty or unreadable input still exits before asking a provider, and its failure remains inspectable in history. The default examples omit those inputs. The classification formation buttons follow **Documents → Worker outcomes → Review decisions → Indexed documents**.

Select the invoice decision. Its input excerpt is what the provider saw, its category definitions are the rubric, and the returned Choice is the signal. The acceptance rule is a separate Python computation. Compare the provider request duration with the policy duration: the former includes the client request and response path, while the latter measures the deterministic rule. Neither number is a hidden reasoning transcript.

For the mixed email, the selected branch leads to an OpenAI proposal and then a parent review pause. The worker's recorded duration stops at its terminal proposal outcome. A person taking ten minutes to review it must not turn that worker into a ten-minute provider call. The pause and resumed processing belong to separate intervals. On resumption, the original signal, proposal, human action, and indexing result remain connected.

## Interpret each measurement

| Measurement | What it includes | What it does not establish |
| --- | --- | --- |
| Node elapsed time | A monotonic interval from the first running event to the first terminal outcome for that runtime instance and attempt; local instrumentation overhead is included. | Pure CPU time, provider server compute, or an isolated model benchmark. |
| Provider request duration | Client-observed wall time for the provider operation, including networking and provider-side waiting/processing. | Separate model-compute or network durations. The provider does not report that breakdown here. |
| Queue wait | Time waiting to acquire the application's shared provider-concurrency slot, measured before the provider node starts. | Time spent executing the provider call. |
| Policy duration | The measured Python category, intent, relevance, or support routing function. | Model inference or the complete downstream branch. |
| Import extraction duration | Measured text extraction and passage-anchor creation before classification; available in source details. | Browser upload transport or storage writes. This interval precedes the run. |
| Recorded wall time | Time covered by the recorded backend run events, including recorded pauses. | Browser-to-result time or upload/extraction time before the run began. |
| Active wall time | Recorded backend processing phases, excluding human-review pauses and known interrupted downtime. | The sum of worker durations or isolated model compute. An unknown process-stop boundary makes this value unavailable. |
| Human-review pause | The recorded wait between the review request and its resumption. | Provider latency or worker compute. |
| Provider call count | Actual recorded call attempts, including visible retries. | Decision count: one Jev call can answer several independent questions. |

Application timing begins with backend execution records. It does not include the person's time choosing files, the browser upload, or all earlier ingestion work. Where a start or measurement was not recorded, the interface shows it as unavailable rather than inventing zero. Older saved events may lack the added timing fields.

An orderly interruption records when processing stopped, so recovery can exclude the known suspended interval. After a hard crash, the restarted backend can discover unfinished work but cannot determine its exact stop time. It marks the terminal event `timing_incomplete: true`; active wall time then remains unavailable. The recorded event window and individually measured component durations are still usable within their stated boundaries.

The **Jev · System One** and **OpenAI request time** cards group their recorded request measurements. Use the execution lanes to see whether those calls overlapped, and open the details table for node elapsed time, queue wait, and attempt. Select a lane to inspect its graph step. Import extraction is reported separately in the source view because it happened before the classification run.

The **System One · request by request** buttons show up to eight recorded Jev requests, with readable durations even when their lane bars are short. Select one to inspect its judgment; the complete table lists all attempts. Bars use recorded stage start and finish events, which include orchestration overhead around provider calls; the request measurement has its own boundary. Very short bars have a minimum clickable width, so use the displayed values for precise durations. Unfilled intervals can include unmeasured checkpointing, event persistence, scheduling, and trace delivery.

Parallel rows can overlap because workers really ran concurrently. Do not add overlapping request durations and call that the run's elapsed time. The sum describes accumulated request work; elapsed wall time also depends on overlap, queueing, local work, review, and the slowest required branch at each join. A claim that Jev is faster than another provider would require a controlled comparison on the same task and conditions. This application's separate category and synthesis calls do not provide that comparison.

Retries have separate attempts. A timeout followed by success should show the failed attempt and its retry, not one silently shortened call. The same source document can have several node intervals because reading, judgment, interpretation, and publication are different work.

A [live instrumentation check](latency-results.json) on September 28, 2026 ran the comparison over four indexed synthetic documents. It recorded six Jev requests and two OpenAI requests, 16 measured stage completions, and a final result with three claims and four citations. The six Jev request durations ranged from 106.611 to 257.117 ms, with a 125.259 ms median and 891.989 ms accumulated request time. Those values describe this small run and its network conditions. Intent selection, evidence screening, claim support, planning, and synthesis are different tasks, so their durations do not establish a like-for-like provider speed comparison. This later check is separate from the held-out evaluation reported in [evaluation](evaluation.md).

## Follow a comparison from plan to published claims

Ask “Compare the termination notice periods in the Atlas service agreements.” Inspect the recorded plan before the workers finish. A simple find needs one search task; the complex comparison can use up to three. The plan records the searched corpus and filters. The current baseline caps that corpus at 300 indexed documents and 20,000 UTF-8 bytes of scope metadata, and records omitted documents. A smaller plan is a bounded search choice, not proof that every relevant source was found.

Select the formation buttons in execution order; each selects its graph step and inspector. **Recorded query plan** opens the saved plan, and **Unvalidated draft** opens the proposed claims. A draft citation can open its retained source before the claim has passed validation.

1. **Search plan.** The local find plan or OpenAI plan supplies task IDs, search phrases, and purposes. It is a visible intermediate output, not hidden model reasoning.
2. **Candidate hits.** Each worker records passage IDs and counts from lexical FTS5 retrieval. A match is still only a candidate.
3. **Screened passages → Merged evidence.** Jev's relevance judgments keep or remove passages. The join shows its input, retained, and removed counts, deduplicates passage IDs, and records which tasks supplied them. Frozen corpus IDs constrain the search; document eligibility, category, and dates are rechecked before synthesis and publication so concurrent edits cannot silently contribute an unresolved source.
4. **Draft claims.** The OpenAI synthesis output is explicitly unvalidated. It shows proposed claim text and citations before they become the published answer. A draft can contain errors.
5. **Cited claims.** A separate graph stage checks that each cited ID belongs to the supplied evidence and that each quotation is an exact span in that passage. Its retained/removed counts refer to claims, so a three-claim answer with five citations shows three retained claims. These counts explain structural rejection.
6. **Supported claims.** Jev separately judges each remaining claim against its cited passages. This is a fallible semantic check with its own probability threshold. The stage records which claims remain; a failed provider call is distinguished from a low support judgment.
7. **Final result.** Only claims surviving both gates appear as the supported answer. Missing evidence and conflicts remain visible. A find request instead returns source passages without generating a draft answer.

The signed Atlas agreements state 30 calendar days for Northstar and 60 for Copperleaf. The conflicting 45-day internal spreadsheet statement is evidence of a disagreement, not a replacement signed term. The proposed 15-day email extension has no recorded acceptance. Open each citation and inspect its highlighted source before interpreting those distinctions.

If retrieval finds no accepted evidence, the graph has no basis for synthesis. If citation or support checks remove every claim, the result is insufficient evidence. These outcomes explain what the available sources permit; they do not invent a fact to fill a missing branch.

## Replay the same record

Classification opens in **Follow document** mode. Choose an example card to replay its decision, or select a document from **All documents** or the picker and press **Replay**. A numbered paper moves along its recorded route, the current node is highlighted, and the explanation above the graph names the action or decision. The timeline advances through readable steps such as reading, choosing a category, returning an outcome, and indexing. Use the backward and forward buttons to inspect adjacent steps, or **Inspect step** to pause and open the recorded details. Selecting another document from the picker during replay starts its journey from the beginning.

**Batch overview** shows activity across all documents in recorded order. Following one document skips unrelated workers’ intermediate steps, but the graph still reflects the full batch at each point. An accepted document can wait for other documents’ reviews; that does not mean it took the human-review branch itself. Failed and excluded documents remain outside the indexing path. The input strip preserves each document’s recorded route, while the narrative and evidence below use only the current event prefix. The footer counts returned outcomes.

Playback uses flowing rounded dashes along reached routes, a brighter current handoff, and one moving paper per document transfer. Work steps stay brief, with a longer hold at a policy decision. Pause freezes the river and document; speed changes preserve their progress. Reduced motion retains static paths and the same evidence. Waiting and completed comparison lanes stop independently. A completed live classification preview offers **Animate recorded route**, clearly labeled as visual playback without new requests. Dash speed does not represent provider latency; use the timing report for measured intervals. Review & Redact preserves relative modeled work time on its shared clock.

Replay changes the visible event cursor. Pause, single-step, and scrub to see the plan, evidence counts, draft, and gates appear at their recorded points. Playback speed can compress the visual wait, but recorded elapsed, queue, request, and policy measurements remain unchanged. Replay never calls a provider.

Pausing playback leaves the backend running. Human review is the supported execution pause, and Cancel is a separate command. A recorded answer remains reproducible after reload because its event sequence and passage versions are retained. The live canvas and the linear event list are two ways to inspect that same sequence.
