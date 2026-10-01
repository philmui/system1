# Find & compare: keep the workflow in view

The subsequent [decision-tree review](decision-tree-preview-review.md) replaces the default nine-step canvas with six capability cards and two visible runtime choices. The technical diagram described below remains available through **All steps**. This page retains the earlier layout change's verification record.

## Change and scope

The Explore Discovery lesson previously inserted its full execution report above the graph after **Run Compare** or **Run Find** returned. That report, followed by another lesson header, displaced the animation and playback controls. Pending and failed requests also replaced the lesson with differently sized content.

The revised lesson uses a compact run toolbar, a reserved summary strip, a persistent canvas area, and playback controls. Desktop layout sizes the stage to the available viewport. Nine capabilities use a compact three-row diagram with the same recorded transitions, request timings, and shared motion. Narrow screens retain a readable vertical diagram and may scroll; the layout does not force all nine steps into a tiny mobile canvas.

The default summary shows overall elapsed time, frontier attempts, and the appropriate unevaluated answer/retrieval accuracy label. **Timing & checks** opens the complete component report in a modal drawer. A selected graph component opens evidence at the current replay step. **View results** opens cited output only after the replay reaches its recorded result. Sources remain available while a request is pending.

Full-run numbers are explicitly labeled **Whole returned run**. They remain unchanged when seeking backward, while graph state, component evidence, and available results follow the event prefix. A live request still returns a completed recording; the interface labels waiting and illustrated replay separately. This change does not add streaming execution or change measured latency, provider selection, backend policy, stored documents, or publication behavior.

## Independent adversarial review

An independent Codex reviewer inspected the new implementation for comprehension, timing/provenance, replay fidelity, asynchronous state, focus, and layout geometry. The following findings were corrected:

| Finding | Correction |
| --- | --- |
| Inherited child styles kept node descriptions small despite a larger parent font. | Explicit description font sizes and concise capability role labels fit the compact card budget. |
| Enlarged arrow labels could overlap cards; outside-scope routes could fall outside node-only fitting bounds. | Labels occupy clear row corridors; an invisible, noninteractive bounds anchor includes outer paths and label extents in fitting. Geometry tests cover labels and paths. |
| “Requests” could imply all model calls even though the counter counted frontier attempts. | Replay counter explicitly names frontier requests. |
| Find used the label “Answer accuracy” despite retrieving passages without composition. | Find uses “Retrieval accuracy”; unavailable evaluation remains “Not evaluated.” |
| Returning a live response could unmount an open source drawer. | Recording-aware playback resets without remounting inspection. Source selection uses stable lesson identity across different operational document IDs. |
| Citation-to-source navigation could leave focus on removed content. | Drawer navigation focuses its heading and resets its scroll position; native dialog behavior preserves modal keyboard operation and opener restoration. |
| Returning to the prepared example could leave an empty Timing drawer open. | That explicit action closes inspection before changing execution mode. |

The review was a source and numerical-geometry review. Browser interactions and visual appearance were not executed successfully in this environment.

The reviewer independently reran **20 Discovery SSR, geometry, and performance tests**, all passing, and reported no remaining material source-level finding after the corrections. These focused tests overlap the full-suite total below.

## Executed checks

- `npm run typecheck --prefix frontend` — passed.
- `npm run lint --prefix frontend` — passed.
- `npm run test:unit --prefix frontend` — **177 passed**, including five new Discovery component SSR cases and nine compact-graph cases.
- `npm run build --prefix frontend` — passed.

The new tests check every prepared Find/Compare replay prefix against the existing execution graph, recorded failure routes, path/label geometry, unavailable measurements, and exclusion of future claims and inline reports from the initial returned-run frame. SSR and geometry checks do not demonstrate pixel layout or browser interaction.

The targeted Playwright attempt could not start the isolated backend: binding `127.0.0.1:8001` failed with `[Errno 1] operation not permitted` (server exit 3). No browser test or new screenshot executed. Regression cases are retained in [discovery-layout-browser.spec.ts](../frontend/tests/discovery-layout-browser.spec.ts) for 1440×900 and 1024×768 desktop bounds, mobile/two-theme states, stable pending/error/completed geometry, keyboard drawers, source inspection during response arrival, and prefix-only results. Actual animation, responsive rendering, reduced motion, and focus restoration remain browser-unverified. No live model request or human usability study was performed for this layout change.

## Main implementation

- [DiscoveryLesson.tsx](../frontend/src/views/DiscoveryLesson.tsx): persistent run action and model control.
- [DiscoveryJourney.tsx](../frontend/src/components/DiscoveryJourney.tsx): compact summary, replay, progressive evidence and results.
- [discoveryLessonGraph.ts](../frontend/src/lib/discoveryLessonGraph.ts): presentation-only graph arrangement and bounds.
- [discovery-lesson.css](../frontend/src/discovery-lesson.css): scoped desktop and narrow layouts.
- [useLessonPlayback.ts](../frontend/src/lib/useLessonPlayback.ts), [LessonDrawer.tsx](../frontend/src/components/LessonDrawer.tsx): recording reset and inspection focus continuity.
