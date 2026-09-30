# V2 focused adversarial source and factual review

Reviewed September 28, 2026. Scope: the actual 31-slide [`deck-v2.json`](../src/deck-v2.json), current [`interactions.js`](../src/interactions.js), [source ledger](../research/source-ledger.md), and [final blog](../../blog/07-building-prod.md). The pending acceptance-visual replacement was excluded from this review. No deck or interaction source was modified.

**Verdict:** The four V1 findings are materially addressed. The new control guards, scoped input views, pseudocode, cost examples, and training views preserve the documented/proposed boundary. Two small but substantive refinements remain for V3: distinguish route labels from later-outcome targets in the training view, and expose the full research ledger as an actual link.

## V1 disposition

| V1 finding | V2 evidence | Disposition |
| --- | --- | --- |
| Strict saving inequality mislabeled as break-even | Slide 20 now displays the correct equality `D + O = (1 − p)G`; the 93% preset produces 1.00 units and “Break-even”. | Addressed. |
| “Complete service trace” ended with unresolved work | Slide 16 is now “A billing path preserves the outage task”. Event 5 awaits confirmation; event 6 resolves billing; event 8 leaves the outage handed off and explicitly unresolved. | Addressed. |
| Original method attributed only to vendor background sources | Slides 23–28 now cite `M1`, the local final article, for the proposed methodology; the split slide retains the narrower repeatability source. | Addressed. |
| Full pipeline unreadable at presentation scale | The full image was replaced with two enlarged diagrams using HTML labels over SVG geometry. The full standalone illustration remains linked from references. | Addressed structurally; final layout/render verification belongs to the presentation check. |

## V3 refinements

### 1. Make the target-label distinction explicit — medium

Slide 23 correctly says that next-route labels use evidence available at the decision, while later outcomes can support **separate outcome labels**. Slide 24's footer and second note broaden this to “Later outcomes may supply labels” and “Later observations may establish the label.” Because the surrounding experiment is next-route classification, a learner could read this as permission to label an earlier route using hindsight.

The source principle is target-specific. A reference for whether a spoken turn ended can use later audio without giving that audio to the evaluated prefix. A next-route label should reflect the information the routing decision could use; a later confirmed outcome is a different target.

**Precise V3 change:** Set the slide 24 footer to “Route labels use decision-time evidence; later outcomes belong to separate targets.” Revise its note to say that later evidence may establish outcome or endpoint labels, while route-label reviewers use the decision-time snapshot. Keep the current input boundary and grouped-split diagram unchanged.

### 2. Make the all-sixteen ledger reachable — low

The references slide's notes mention the complete source ledger, but its body and source footer do not link to `research/source-ledger.md`. Links to the tutorial article and full pipeline have been added, so the ledger can use the same mechanism.

**Precise V3 change:** Add a readable “Complete source ledger” link to `research/source-ledger.md`, either in the references slide or its clearly linked companion index. The all-sixteen research requirement itself is already met; this change makes the evidence discoverable after the talk.

### Optional trace-copy consistency — low

Slide 16's initial HTML includes “Classifier result: mixed”, but initialization replaces that with `traceEvents[0]`, which only says both requests were captured. Similarly, the final step heading says a queue accepts the handoff, while its event text says a human accepts it.

For a tighter teaching trace, use “Route = mixed; both requests are recorded” at event 1 and name a constructed receiving queue at event 8, for example “The service recovery queue accepts the outage handoff; the outage remains unresolved.” These are improvements to illustration continuity, not hidden claim or state-correctness defects.

## Checks of the new material

**Graph controls and context.** Slide 5 now labels the verified path and the denied/unavailable recovery branch. Slide 12 shows separate node input views rather than a shared unrestricted state arrow. Both are explicitly proposed designs and do not promise that data minimization or authorization is automatic in an undeclared integration.

**AgentScript.** Slide 15 correctly labels the left code as language-neutral pseudocode. The right side's `run`, `available when`, and `with` concepts are real language constructs. The sketch separates a required check, a failure route, an offered reasoning action, and inputs from trusted state. It does not claim to be valid deployable AgentScript or invent a `koa-action` endpoint. Availability still does not force selection, and services independently enforce access.

**Service state.** Invoice resolution requires a separate customer confirmation in this example. The outage remains pending through billing, becomes active, and then becomes handed off. The event text explicitly says the outage remains unresolved. Neither handoff nor an emitted explanation silently counts as complete service.

**Cost scope.** The model is now explicitly a routing-stage illustration. Its expensive baseline call is distinguished from the later explanation call; invented units and excluded service costs are visible. The added presets expose positive savings, equality, and overhead-driven loss. No Jev or Salesforce benchmark is implied.

**Training.** Separate sample branches feed train, development, and test. The second slide uses a separate data input and artifact input for locked evaluation; release arrows represent qualification rather than sample reuse. Optional adaptation, separate calibration/gate selection, persistent pilot assignment, and future-only feedback remain explicit. The target-label wording above is the only substantive clarification identified.

## Direct interaction verification

Loaded the actual V2 interaction bodies and current script in Chromium, then exercised the public state application and the cost-preset buttons. Results matched the intended synthetic construction:

| Check | Observed result |
| --- | --- |
| Threshold 0.50 | 12/12 automated; 4/12 wrong; 0 reviewed. |
| Threshold 0.75 | 7/12 automated; 2/7 wrong; 5 reviewed. |
| Threshold 0.99 | 1/12 automated; that case is wrong; 11 reviewed. |
| Threshold 1.00 | No automatic cases; automatic error shown as undefined; 12 reviewed. |
| Cost preset 20% | 0.27 normalized units; 73% lower. |
| Cost preset 93% | 1.00 normalized units; break-even. |
| Cost preset 100% | 1.07 normalized units; 7% higher. |
| Trace event 5 | Invoice awaiting confirmation; outage pending. |
| Trace event 6 | Invoice resolved after confirmation; outage pending. |
| Trace event 8 | Invoice resolved; outage handed off and explicitly unresolved. |

These checks validate the teaching arithmetic and state transitions only. They are not model evaluations, product benchmarks, or evidence of a deployed Salesforce integration.
