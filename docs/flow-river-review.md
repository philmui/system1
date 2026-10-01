# Flowing paths across the workflow views

The workflow views now share a directional dashed treatment inspired by the supplied reference. Rounded highlights move along the role-colored selected path, with a small halo. The current handoff is brighter than the trail of reached steps; possible and unselected branches remain quiet. Arrowheads have fixed user-space dimensions so thicker paths do not enlarge them.

This treatment covers the classification lesson and recorded Runs, Discovery's decision tree and **All steps** view, the Review & Redact comparison, and the illustrative batch comparison. Completed live classification measurements offer **Animate recorded route** as a separate view control. That control makes no provider calls, changes no measurement, stops on inspection or a new response, and is disabled with an explanation when reduced motion is enabled. It does not animate pending requests or the excluded approval/publication steps.

## Motion and execution boundaries

- A river indicates direction along the already selected path. It never creates a document transfer or a new request.
- A numbered document still moves only on its recorded transfer. The old fallback that could loop extra document markers was removed. Batch retries and validation at the same component do not replay an arrival.
- Pausing freezes dash phase; changing speed updates the same Web Animation rather than recreating it. A completed or waiting comparison lane freezes independently of the other lane.
- Human checkpoints, queued batch work, and publication barriers do not show flowing work. Resumption follows the existing workflow state.
- Reduced motion cancels the Web Animation and retains a static route, arrowheads, and identical evidence. It is handled in JavaScript as well as shared styles.
- Work clocks, provider requests, timing metrics, policy choices, and publication rules were not changed. Directional dash speed is visual playback, not a service-latency measurement.

The implementation is shared in [FlowMotion.tsx](../frontend/src/components/FlowMotion.tsx) and [flow-motion.css](../frontend/src/flow-motion.css). [FlowCanvas.tsx](../frontend/src/components/FlowCanvas.tsx) keeps decorative flow separate from its document-marker controls. [DiscoveryDecisionTree.tsx](../frontend/src/components/DiscoveryDecisionTree.tsx), [ReviewLane.tsx](../frontend/src/components/ReviewLane.tsx), and [CompareStrategies.tsx](../frontend/src/views/CompareStrategies.tsx) use the same component.

## Adversarial review and verification

An independent Codex source review checked coverage, selected-route provenance, marker duplication, phase preservation, reduced motion, and per-lane stopping. The review led to separate river and packet controls, removal of the legacy looping marker, fixed arrowhead sizing, explicit per-lane wait/completion guards, and the opt-in animation control for completed live classification. The reviewer independently ran **67 focused tests**, all passing; those overlap the full suite.

A final review found that the new classification animation could continue behind source or manually opened decision inspection. Both inspection entry points now clear that local animation; closing inspection does not restart it. The reviewer confirmed the correction in a fresh source read.

Executed checks:

- Full frontend unit/SSR suite: **196 passed**.
- Typecheck, lint, and production build: passed.
- Scoped whitespace check for frontend and documentation: passed.

New source/SSR checks exercise reached versus future routes, one current transfer, pauses, human checkpoints, and a faster lane remaining static while another continues. Browser regressions in [flow-motion-browser.spec.ts](../frontend/tests/flow-motion-browser.spec.ts) inspect actual animation phase, speed updates, reduced motion, branch exclusion, and lane completion using isolated fixtures.

**Rendered animation remains unverified in this environment.** The preceding browser startup attempt could not bind the isolated backend to `127.0.0.1:8001` (`EPERM`). That restriction was not bypassed or repeatedly retried. Browser cases were collected without starting services. No new screenshots, visual smoothness measurement, live provider calls, or human usability feedback are claimed.
