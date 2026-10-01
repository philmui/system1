# Discovery decision tree and classification measurement boundary

## User-visible behavior

**Find & compare** now starts with six capability cards arranged as a branching tree. The initial judgment and policy select code planning or frontier planning. Those branches rejoin for retrieval, bounded screening, and evidence rules. The second recorded choice returns sources or allows frontier composition followed by citation and support checks. A confident unsupported intent has its own direct scope-response exit.

The captions name responsibilities: System 1 judges, runtime rules route, code searches and validates, and frontier models plan or draft when selected. The selected path stays solid and colored; possible alternatives remain visible and are labeled “Not selected” after the relevant decision. Current transfers use the shared directional motion treatment. Paused and reduced-motion states retain the same route and evidence.

Selecting a card pauses playback and opens its recorded evidence and component measurements. **All steps** retains the technical diagram without resetting the cursor or making another provider request. Timing, results, and sources remain in drawers so returned reports do not push the flow down. Card rows can grow with wrapped text; constrained screens scroll within the stage instead of overlapping cards or shrinking text. This describes the implementation, not a successful rendered inspection.

The tree is a presentation of the supplied event prefix. It does not infer a route from the example name: an uncertain Find can use frontier planning and still return sources. Composition is governed by the recorded output edge, not the original query label. Failed retrieval, absent evidence, evidence withdrawn before synthesis, rejected claims, and unavailable historical values retain their actual meaning. No backend workflow, provider selection, or publication rule changed in this slice.

In **Classify documents**, the live measurement ends at an accepted category or a frontier proposal. **Publish** now reads **Outside preview**, uses a neutral information state, and explains that it makes content searchable. A required approval is also outside this measurement, rather than depicted as a paused review session that was never created. The quiet continuation to publication reads **If approved** where appropriate. Operational recordings still show their actual publication and review events.

The classification summary separates automated classification elapsed, System 1 and frontier service work, actual request counts, and whether frontier interpretation was used, bypassed, or not reached. Accepted categories and proposals explicitly finish the measurement. Time to searchable remains unavailable. The paired live comparison shows both recorded elapsed values on one scale, the percentage relative to the frontier-first strategy, and actual frontier attempts. Missing durations do not become zero; extra interpretation and unfavorable differences remain visible. This is a same-document strategy comparison, not a claim that a direct route and an exception route perform equivalent work.

## Independent adversarial review

An independent Codex reviewer inspected execution semantics, first-time comprehension, replay, metric attribution, focus, and responsive source rules. Findings and corrections:

| Finding | Correction |
| --- | --- |
| Publish and approval looked unfinished despite being excluded from the live preview. | Explicit “Outside preview” state, information icon, quiet conditional continuations, and completion at the measured category/proposal. |
| Invalid elapsed values could corrupt the absolute comparison even when the ratio was guarded. | The delta and ratio both require finite, nonnegative recorded durations. |
| A grouped card could say Complete before policy, citations, support, or result assembly finished. | Grouped status follows its remaining stages and only exposes results after their recorded event. |
| The unused planning branch could display the selected planner's timing. | Unselected branches have no component measurements; their inspector explicitly states the absence of recorded work. |
| Initial policy timing could include later relevance/support gates. | The intent receipt uses only its recorded policy evaluation interval. |
| Unsupported requests left composition looking undecided. | The answer branch explicitly becomes Not selected. |
| Opening All steps from a drawer removed the original focus target. | Focus moves to the persistent view toggle after closing inspection. |
| Missing result arrays became fabricated zero counts. | Missing or malformed arrays display count unavailable; actual empty arrays retain zero. |
| Four fixed-height rows could compress wrapped text beyond card boundaries. | Content-sized rows, wrapping headings/statuses, and local stage overflow replace squeezed rows. |
| Sequential role labels could imply System 1 returns the answer. | Explicit caption: “Frontier drafts · Code + System 1 check”; the default detail names runtime control of output. |

The reviewer independently executed 51 focused classification/presentation checks and 30 Discovery checks during the review. These overlap the final frontend suite; they are not additional tests to add to that total. All passed. Rendered appearance and human comprehension were not independently observed.

## Verification

- `npm run test:unit --prefix frontend` — **193 passed**.
- `npm run typecheck --prefix frontend` — passed.
- `npm run lint --prefix frontend` — passed.
- `npm run build --prefix frontend` — passed.
- `git diff --check` — passed.
- Documentation validation — 778 local Markdown links, 14 sample files/spans, and five accessible SVG exports passed.

After the final caption correction, 50 affected frontend checks and the production build passed again.

New regression coverage includes prefix-only branch selection, intermediate policy/validation states, revised Find intent, unsupported requests, partial/failed work, withdrawn evidence, unavailable output counts, backward seeking, preview publication boundaries, and same-scale latency accounting. Browser cases cover All steps cursor/focus preservation without extra requests, runtime evidence inspection, and card containment at 800×540 in both themes; those cases collect successfully but have not executed here.

The most recent targeted browser startup in this same environment failed while binding the isolated backend to `127.0.0.1:8001` with `[Errno 1] operation not permitted`. The identical restriction was not bypassed or repeatedly retried for this follow-up. Current screenshots, actual animation, text fit, keyboard interaction, 200% zoom, and reduced-motion rendering remain unverified. No live provider call or human usability study was performed for these presentation changes.

## Main files

- [discoveryTree.ts](../frontend/src/lib/discoveryTree.ts), [DiscoveryDecisionTree.tsx](../frontend/src/components/DiscoveryDecisionTree.tsx): recorded tree projection and interactive cards/connectors.
- [DiscoveryJourney.tsx](../frontend/src/components/DiscoveryJourney.tsx), [discovery-lesson.css](../frontend/src/discovery-lesson.css): default tree, progressive evidence, full-step continuity, and sizing.
- [LessonFlow.tsx](../frontend/src/components/LessonFlow.tsx), [FlowCanvas.tsx](../frontend/src/components/FlowCanvas.tsx): live preview boundary without changing operational replay.
- [LiveClassificationJourney.tsx](../frontend/src/components/LiveClassificationJourney.tsx), [ClassificationMeasurement.tsx](../frontend/src/components/ClassificationMeasurement.tsx), [classificationPerformance.ts](../frontend/src/lib/classificationPerformance.ts): measured scope, service work, and same-document comparison.
- [discovery-tree.spec.ts](../frontend/tests/discovery-tree.spec.ts), [discovery-layout-browser.spec.ts](../frontend/tests/discovery-layout-browser.spec.ts): tree semantics and retained browser checks.

The preceding [layout review](discovery-layout-review.md) documents the initial graph-first workbench and its separate verification record.
