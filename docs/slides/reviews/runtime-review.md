# Runtime adversarial review

Reviewed the 31-slide v2 candidate and rebuilt v3 candidate with Chromium on 2026-09-28. All reported runtime defects are addressed in the shared source; preserved numbered drafts were not changed. The final numbered artifact should rerun the commands below.

## Findings and fixes

| Severity | Finding | Resolution |
|---|---|---|
| High | Persisted automatic-advance settings could independently advance audience and preview windows. | Automatic advance now requires presenter mode. Ordinary deck, audience, and preview windows remain stationary; dialogs, overview, freeze, and synchronization loss pause presenter advance. |
| High | Teaching widgets had separate state in each window; the presenter preview was disabled. | The current preview is interactive. Explicit `snapshot()` / `apply()` methods synchronize the gate, cost scenario, eight-event trace, and exercise reveal. Freeze preserves the audience state; resume and reopen restore the authoritative snapshot. |
| Medium | A note saved within 300 ms of navigation could be written against the next slide. | The pending save captures the slide ID and text immediately and flushes on navigation, presenter exit, and pagehide. |
| Medium | Space on a focused button advanced the deck instead of activating its control. | Native Enter/Space behavior is preserved for buttons, links, and related controls. |
| Medium | Thirty navigation dots overlapped the shortcut toolbar at 1280×720. | Compact Previous / position+overview / Next controls occupy the left edge; phone controls use two rows. Both sizes have no overlap. |
| Medium | The exercise diagram extended into the reveal button's hit area. | Reported to the content owner and verified after `.bad-path .diagram` was constrained to its container. |
| Medium | Exiting and immediately reopening presenter mode could reuse an audience window scheduled to close. | Presenter exit closes its owned audience window directly as well as sending the normal end-of-show message. |
| Medium | Presenter re-entry retained an old complete teaching-state snapshot, which could erase a repair revealed in ordinary deck mode. | Every entry and slide change rehydrates retained previews. A monotonic revision and applied-state acknowledgment keep the current preview inert until ready; only messages from that frame with the acknowledged revision and current slide are accepted. Old snapshots cannot roll back unrelated state. |
| Medium | Plain-text persistence joined authored line breaks in the opening title and subtitle. | Edits serialize through `innerText` and restore with newline-aware rendering, preserving line boundaries through reload and downloaded copies. |
| Medium | The next-preview iframe could receive source-link focus and cancel Tab or Escape. | The next iframe and its deck are inert, excluded from tab order and the accessibility tree. Passive preview key handlers preserve Tab, Shift+Tab, and Escape. |
| Low | Dialog focus and low-power toolbar contrast were inconsistent. | Dialog focus moves to its close control and returns to the opener. Toolbar text remains dark against a light surface in both motion modes. |

The gate now exposes numerator/denominator counts and an explicit empty-set label. Cost buttons select 20%, 93%, and 100% fallback; the latter two visibly demonstrate break-even and additional routing-stage cost. The trace separates an explanation, confirmation, and an accepted but unresolved technical-support handoff.

## Browser evidence

All checks returned `passed: true` with no JavaScript page errors. Tests cover offline local-file loading, source and exported-copy loading, exact 16:9 scaling at 1280×720 and 390×844, desktop/mobile navigation bounds, presenter popup blocking and recovery, audience close/reopen, stable notes after reload, timers and rehearsal history, synchronized circle annotations, and automatic-advance pause/resume. Current/next preview ratios remained within 0.001 of 16:9.

Teaching interactions were operated inside the current preview. Audience values followed the threshold, cost presets, all eight trace events, and repair reveal. Freeze held the old audience page and values; resume and reopen restored the complete current state. The exported copy retained edited text and initialized exactly one active slide and three navigation controls.

The regression matrix ran through **both `file://` and local HTTP**. Persisted automatic advance did not move any passive window. Notes survived navigation and exit before the debounce elapsed, adjacent notes remained distinct, native Space activated the exercise without advancing the slide, and a modal paused presenter advance.

The second-review regression deliberately held preview hydration after presenter re-entry, injected both an old revision and an unacknowledged current revision, then resumed delivery. Both attempted rollbacks were rejected, and a valid slider edit subsequently synchronized while preserving the exercise reveal. Opening-title and subtitle line breaks survived both reload and downloaded-copy loading. Tab left the interactive preview for the presenter notes controls; the next preview could not receive focus. These probes passed for both file and HTTP loading.

Latest v3 candidate results: [interactions](v3-runtime-interactions.json), [presenter controls](v3-runtime-controls.json), [file and HTTP regressions](v3-runtime-regressions.json), [second-review regressions](v3-runtime-review2.json). The earlier v2 evidence remains in the original result files.

## Reproduce against a final deck

Run from the repository root, replacing `DECK.html` with the final HTML path. The scripts use the repository's installed Playwright and create temporary test copies; they do not edit the input deck.

```sh
node docs/slides/src/validate-runtime.cjs DECK.html docs/slides/reviews/final-runtime-interactions.json
node docs/slides/src/validate-presenter-controls.cjs DECK.html docs/slides/reviews/final-runtime-controls.json
node docs/slides/src/validate-runtime-regressions.cjs DECK.html docs/slides/reviews/final-runtime-regressions.json
node docs/slides/src/validate-runtime-review2.cjs DECK.html docs/slides/reviews/final-runtime-review2.json
```

This is a Chromium runtime review. It does not replace the separate content, source, layout, and statistical-claim reviews.
