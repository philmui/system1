# Frontend workflow redesign and adversarial review

Updated 2026-09-29.

The default Workflow view compares two local legal-review illustrations using the same selected synthetic page and a shared playback clock. AgentGraph is the boundary around the complete workflow. Cards describe units of work and identify code, model calls, or human checkpoints. The numbered paper represents page state. Output states have a different shape, and only completed work highlights a route. Classification includes the model and its validation/routing wrapper, with no separate Route node.

The graph uses teal for System 1 Model, blue for code and the AgentGraph boundary, violet for frontier LLM work, and amber for human review. Outlines and fills preserve those distinctions in dark and light themes. Dark is the default. Focus graph removes the surrounding navigation and header. The bottom dock retains document selection, play/pause, step, reset, the native 0.1–4.0× speed slider, and an exit control. Additional controls, state, page content, and assumptions expand on demand.

The example makes no provider calls. Costs and machine durations are editable teaching assumptions, not prices or benchmark results. Both classifiers return three decisions in one request and use the same prepared answers and routing rules. Human wait and animation-only transfers are excluded from modeled machine time. Request charges accrue on completion. Reliability is explained through explicit contracts, validation, and checkpoints; no accuracy or reliability advantage is presented as measured evidence. Real classification/discovery views continue to use recorded events, timing, provider responses, and backend review submissions.

## Adversarial review

Two independent Codex reviews examined UX/accessibility/layout and comparison semantics/state. The following findings were addressed:

- Replaced changing batch focus with one pinned page in both comparison lanes; state and paths are revealed only as each lane reaches its own events.
- Moved AgentGraph from a standalone routing entity to the whole workflow boundary, used verb labels for work, and placed deterministic validation/routing inside classification.
- Kept redacted content scoped to the selected lane, so the slower lane cannot expose the faster lane's output.
- Routed potential privilege and uncertainty to review. Attorney release cannot bypass a lane's checkpoint or remaining PII redaction.
- Replaced outcome inspector claims with conditional explanations for unvisited outputs.
- Moved branch labels out of moving-paper corridors, widened vertical side corridors, and tested the packet footprint as well as connector centerlines.
- Restored keyboard focus after applying assumptions or recording an attorney verdict. Shared-state strategy controls keep focus when selected.
- Kept the focus-mode dock available on short screens, retained reset/status controls, and separated local illustration status from backend connectivity errors.
- Increased card contrast, corrected the source drawer backdrop, added selected-state semantics to real-run controls, and protected minimum initial graph zoom with pan/zoom available.
- Applied the requested display names in graph labels, legends, inspectors, timing panels, readiness labels, and provider error messages. Provider keys and stored event identities remain compatible with the backend.

The final source review reported no remaining blocking findings in the reviewed changes. This is not a claim of completed browser visual verification.

## Executed checks

- `npm run lint --prefix frontend`: passed.
- `npm run typecheck --prefix frontend`: passed.
- `npm run build --prefix frontend`: passed; workflow and live-run views load as separate chunks.
- `npm run test:unit --prefix frontend`: 27 tests passed. Coverage includes event replay/reconciliation, actual timing boundaries, 27 combinations of responsiveness/PII/privilege answers, human checkpoints, reverse seeking, zero/reversed assumptions, native slider bounds/default, eight live graph layouts, and comparison connectors/packet clearance in both layouts.
- The semantics reviewer additionally checked 3,660 event-boundary snapshots across answer combinations, both strategies, and attorney outcomes.

The browser regression in `frontend/tests/workflow-browser.spec.ts` covers synchronization, document selection, focus, speed, state disclosure, redaction, review, assumptions, theme persistence, and responsive controls. Existing classification/discovery browser selectors were updated for the new input tray and timing tab.

The browser command was attempted but the sandbox rejected binding the isolated fixture backend to `127.0.0.1:8001` with `operation not permitted`. Chromium had also previously been blocked by macOS MachPort permissions. Consequently, final browser screenshots, responsive rendering, and end-to-end browser regression results are **unverified**. Earlier screenshots elsewhere in this repository predate the completed comparison and should not be treated as verification of this design. The reference gist was available; the linked YouTube video could not be retrieved for visual comparison.

Run the browser checks in an environment that permits local services and Chromium:

```sh
npm run test:e2e --prefix frontend
```

The browser configuration uses isolated fixture data and ports 8001/5174; it does not reuse the user's running development services.
