# Explore flow and timing review

September 29, 2026. Follow-up to the [education-first redesign](education-redesign-review.md).

The later [live frontier timing review](live-frontier-review.md) supersedes this page's initial timing presentation and verification counts. It adds real GPT-5.5 execution, removes fixture provider delays from primary metrics, and moves assumed single-document totals into details.

## Changes

The classification journey now uses aligned card ports and explicit straight segments. Its genuine branch uses a bounded cubic curve with tangents aligned to the cards; the automatic routing offsets that caused short backward bends are absent. Wide screens use a direct upper lane and an interpretation/review lower lane. Tablet and phone layouts use two columns, with dedicated dimensions and readable captions.

Cards on the selected route receive a stronger role-colored fill. Current activity receives an additional border treatment. Visible status text distinguishes a chosen route from completed work, approval, and searchability. Cancellation during review cannot imply approval; an excluded document cannot acquire a publication highlight. Larger captions, untruncated details, and quiet but legible alternatives replace the earlier small graph text.

The following-document panel adds step timings derived exclusively from the current recording prefix. System 1, runtime policy, frontier interpretation, and publication show recorded durations when available. Missing measurements remain unavailable, and retry totals remain incomplete until every included attempt has a duration. Provider work, event intervals, and review waits retain their separate evidence labels.

## Human approval is a checkpoint, not a millisecond operation

The prepared agreement's former “Human review · scripted 2.0 ms” value measured the interval between scripted events. It did not measure a person's response. The primary view now says **Simulated approval**, **Simulated exclusion**, or **Simulated review complete**, according to the recorded disposition. Its supporting label says that no human response was measured. The graph calls this a simulated checkpoint and omits script timing from the card. The raw interval remains available only as explicitly labeled diagnostic information.

The separate one-document illustration compares **automated work**, excluding human waiting. A selector supplies an explicitly assumed wait of 15 minutes, one hour, or one day, applied equally to both strategies. These values are teaching assumptions, not response-time estimates. Total time to searchable, including that wait, is available in the details. A routine document can avoid frontier work; an exception incurs additional judgment and interpretation. The illustration does not claim measured model-performance or accuracy gains.

Compare uses the same 15-minute default review assumption. Its animation uses a single invertible mapping of modeled time to presentation time, built from the union of both lanes' machine activity. This preserves the visible machine sequence while compressing long waits. Seeking remains in modeled time, speed changes affect presentation only, and the traces determine final counts and timing metrics.

## Adversarial review and verification

Independent Codex review inspected the actual changes and executed affected checks. Findings corrected during review:

- A failed publication interval could be labeled as time to a commit that never happened. It now identifies a node-event interval without a commit time.
- A scripted exclusion could be described as approval. The label now follows the selected document's review decision, with neutral wording when historical disposition is unavailable.
- Raising the review assumption to 15 minutes caused uniform playback compression to skip visible machine activity. The shared piecewise clock fixes this without changing either strategy's modeled work.
- Batch accounting and cancelled review states were checked separately from per-document publication and authorization.

Verification evidence:

| Check | Result |
| --- | --- |
| Full frontend unit suite | **101 passed**. |
| Independent affected tests | **41 passed**, covering graph, timing, and comparison; earlier geometry/publication checks also passed. |
| TypeScript | Passed. |
| Route geometry | Wide, tablet, and phone paths are monotone, port-aligned, and clear of unrelated nodes; labels remain within diagram bounds. |
| Recording fidelity | Prefix-only timings; no future approval or publication; retries, failures, and missing data tested. |
| Human-wait semantics | Script durations excluded from primary human timing; approval and exclusion distinguished; equal editable waits tested. |
| Comparison clock | Shared mapping, inverse round trips, pause/speed behavior, unchanged metrics, and empty/all-machine/all-wait cases tested. |
| Text contrast | Independent calculation from theme tokens and card mixtures: minimum inspected ratios 7.45:1 dark and 4.86:1 light. This is source-based evidence. |

The frontend production build and lint checks are reported in the task handoff. Backend execution and teaching recordings were not changed by this follow-up.

## Environment limits

The isolated Playwright browser attempt again stopped before tests could run: binding `127.0.0.1:8001` failed with **Operation not permitted**, exit code 3. The supplied local app URL was not reachable from this execution environment. No restriction was bypassed.

New browser regressions cover the proposed agreement at 1440, 1024, and 390 pixels in both themes, selected card states, projected font size, and page overflow. They remain unexecuted here. Actual font wrapping, rendered layouts, motion, pause behavior, keyboard interaction, touch targets, and 200% zoom therefore remain unverified. Earlier screenshots do not verify this iteration.
