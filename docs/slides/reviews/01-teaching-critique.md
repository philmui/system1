# V1 adversarial teaching critique

Reviewed on 2026-09-28 by an independent curriculum reviewer. Scope: all 30 slide records and presenter notes in `src/deck-v1.json`, the interaction logic in `src/interactions.js`, `working.html`, the source ledger, the final blog, and rendered previews for slides 5, 7, 12, 13, 15, 16, 19, 20, 22, 24, 26, and 28. Layout is still being repaired, so this review separates presentation defects from substantial changes to the lesson.

## Overall assessment

V1 has a coherent thesis, a clear Salesforce responsibility map, and unusually good source discipline. The two-task service example gives the story a useful invariant; the confidence demonstration correctly includes a high-scoring error; the training illustration keeps the test away from fitting. The opening and architecture make reliability, predictability, cost, and speed visible without borrowing Jev benchmarks for `koa-action`.

The remaining weakness is educational: several slides name the right engineering concepts without showing the actual decision, guarded edge, or state change a learner would implement. The complete narrative also promises a full customer service trace but ends with an outage still active. V2 should make the worked example more concrete and make the cost lesson explicitly refer to the decision stage being replaced. Those changes would be more valuable than additional caveats, sources, or introductory slides.

**Recommendation:** retain 30 slides, the pastel system, and the broad story. Make the following six substantial revisions, then apply the smaller QA fixes. No new benchmarks or deployable `koa-action` API are needed.

## Substantial changes for V2

### T1 · High priority — Make the worked trace deliver its promised outcome

**Evidence:** Slide 16 is titled “Follow one complete service trace.” The six events in `interactions.js` end at `['Resolved','Active','The workflow resumes the outage task.']`. The invoice is resolved by an explicitly stated customer confirmation, which is good; the outage remains active. The first event says only “Both requests captured,” and never displays the classifier's answer or the application's state update.

**Why this matters:** The deck repeatedly argues that a case must preserve and complete both obligations. Its only favorable walkthrough stops short of that outcome. A learner also sees owners and status labels but not how a bounded output becomes a controlled transition.

**V2 change:** Either extend the trace with a short outage outcome event, or title it “Follow the billing path without losing the outage.” Prefer the extension if it fits. Make the initial trace event display three explicit values:

- Input: the existing two-task customer utterance.
- Application decision: `route = mixed`.
- Runtime state: invoice pending; outage pending.

For an extended ending, use a constructed authoritative technical result plus a declared completion condition, or an accepted handoff with receiving queue and outstanding work. A handoff must remain visibly unresolved. If both tasks are shown as resolved, say what evidence meets each condition; do not use a green check based solely on generated text.

**Acceptance check:** The last trace state agrees with the slide's title and the whole-case definition. At least one model output → authored transition → state update is visible without reading the presenter notes.

### T2 · High priority — Show guards on edges, not just a sequence of boxes

**Evidence:** Slide 5 draws an unconditional chain from “Verify caller + account access” to “Retrieve authorized invoice facts.” Slide 13 draws two unlabeled arrows from “Clarify priority” to billing and to the clarification-budget path. Slide 12 connects the entire case-state box to each consumer, while the intended selective read is only explained in text.

**Why this matters:** The central thesis is that domain procedure lives in topology: which decision occurs, what must precede it, and what state it can read. Unlabeled arrows can teach “run a check and proceed” even when the check fails, or make a fallback look like parallel work. The deck should demonstrate the control that the prose claims.

**V2 change:** Label the access edge `verified` and add a compact `denied / unavailable → defined fallback` branch. On slide 13 label the alternatives `customer selects billing` and `no choice within budget`; show that the runtime records both pending tasks before the priority branch. On slide 12 connect highlighted state fields to the relevant consumer, or use short per-node input chips rather than three arrows originating from the undifferentiated state box.

**Acceptance check:** A learner can point to the exact edge that blocks invoice access after a failed check and the exact input view available to the explanation node. The topology remains legible at normal presentation size.

### T3 · High priority — Anchor the cost calculator to the specific replaced decision

**Evidence:** Slide 20 shows `G = 1.00 generative-stage unit`, candidate `D + O + pG`, and a large default “73% lower.” The arbitrary nature of `D = .03` and `O = .04` is explained in notes and a small footer. The running service example always includes a generative invoice explanation, so viewers can reasonably wonder how only 20% of cases still use `G`. Slide 19's uncertain cases go to review, which is not necessarily the `G` fallback in the cost formula.

**Why this matters:** The algebra is correct under its stated assumptions, but the stage and denominator are ambiguous. The large percentage can be remembered as a product result even though the deck does not claim one. The user specifically wants compelling cost reasoning; a clear break-even mechanism is stronger than an impressive hypothetical percentage.

**V2 change:** Define `G` as **the general-model routing call being replaced**. Explain that invoice explanation and other unchanged downstream work are outside this small model; the full pilot includes them. Define `p` as the fraction requiring that routing fallback, not the fraction escalated to humans or the fraction of cases using any generative model. Place “Hypothetical routing-stage arithmetic” directly above the result. Show the failure case explicitly, with a quick control or annotated endpoint: at `p = 1`, cost is `1.07`, or 7% higher; break-even is `p = .93` for the chosen toy inputs. A no-savings/default scenario followed by a favorable slider movement would make the mechanism more memorable than opening on 73% lower.

Do not add another financial formula. The existing one is enough. Put whole-case measurement in one visible line: “Pilot totals include calls, tools, retries, people, and unfinished obligations.” Build/maintenance amortization can remain in the notes/handout.

**Acceptance check:** A screenshot of this slide alone cannot reasonably be read as measured `koa-action` savings. Its `p` has a concrete route meaning, and the calculator visibly demonstrates overhead defeating specialization.

### T4 · Medium priority — Turn the contract and AgentScript lesson into a small worked artifact

**Evidence:** Slide 7 lists category names but no example of a boundary. Its visible fallback groups “unusable or ambiguous result” into “clarify … then handoff,” while notes correctly distinguish malformed/timeouts from semantic ambiguity. Slide 15 lists `run`, `available when`, and `with` as isolated concepts but does not demonstrate how these govern the running service case.

**Why this matters:** The audience can repeat the vocabulary yet still be unable to author the first contract. This is the main gap between a good architecture talk and a step-by-step tutorial. It is fixable without inventing a public `koa-action` interface.

**V2 change:** Add a very small route example table to slide 7 or its next reveal:

| Evidence available now | Application label |
| --- | --- |
| “Why was I charged twice?” | billing |
| “Charged twice, and service is down.” | mixed |
| “Something is wrong with my account.” | unclear |

Replace the combined fallback with two explicitly different policies: `unclear → bounded clarification`; `timeout / malformed output → integration fallback`. The exact retry policy need not be prescribed.

On slide 15, replace some explanation text with a compact **design pseudocode** block tied to the same account access step. It should show: required access procedure, failure transition, available explanatory action only after facts exist, and bound trusted account input. Alternatively, use a short verified AgentScript fragment with its dialect/source and omitted action bindings clearly identified. Do not present it as runnable or add a fabricated `koa-action` target.

**Acceptance check:** A participant can draft one bounded classification contract and explain why action availability does not force required work. The slide includes a usable design artifact but makes no new API assertion.

### T5 · Medium priority — Make the gate demonstrate counts and consequences

**Evidence:** At the default threshold `.75`, slide 19 displays 58% coverage, 29% automatic error, and 5 cases to review. These are correct rounded values for 7 accepted cases, 2 errors, and 12 examples. Raising the threshold to `.90` leaves 3 accepted and 1 error; `.99` leaves only the deliberately wrong high-scoring example. The implementation correctly uses an undefined error value if no cases are accepted.

**Why this matters:** This is the strongest teaching interaction in V1, but rounded percentages hide tiny denominators and can look like real empirical quality measurements. The constructed sample intentionally has high error; its purpose should be the relationship between the signal and the gate, not an impression of model quality.

**V2 change:** Show counts beside the rates: `7 / 12 automated`, `2 / 7 wrong`, `5 to review`. Change the subtitle to “Twelve constructed examples chosen to expose a high-scoring mistake.” Include one visible operational consequence: “Review is a queue, with its own capacity and delay.” Keep the notes that this is an uncalibrated synthetic signal. Do not fit a curve, claim monotonic improvement, or infer a deployable threshold from these examples.

**Acceptance check:** On a screenshot, the reader can recover both denominators and identify the numbers as teaching data. The zero-accepted state remains defined clearly.

### T6 · Medium priority — Give the evaluation section one comprehensible decision record

**Evidence:** Slides 23–27 are scientifically careful. Slide 26 compresses “upper uncertainty bound on failure-rate increase,” “lower uncertainty bound on saving per incoming case,” fixed cohorts, and unfinished cases into four cards. It allocates one minute to a concept that many engineers will not already know. The entire deck's current `minutes` values sum to 30.6 minutes, with nearly every conceptual slide set to one minute.

**Why this matters:** Learners may perceive the last quarter as a collection of caveats and statistical terminology rather than the proof required for the architectural claim. The pipeline is good, but the acceptance decision needs one concrete visual explanation.

**V2 change:** Keep the rigorous criteria, but show two small interval-versus-limit drawings for quality and cost, labeled “decision rule, no measured data.” Add a visible example verdict such as “Cost passes; quality remains uncertain → continue the pilot.” Give this slide and slide 27 approximately 2–3 minutes together or more; use notes/handout for the union-null language, cohort construction, and detailed inference protocol. Tie the failed-case definition visibly to the recurring ledger: “Invoice resolved + outage still pending = incomplete case at the deadline.”

Allocate the remaining 40-minute budget deliberately: about 7 minutes for the architecture and definitions, 14 for the worked workflow and exercise, 8 for gates/economics/latency, 8 for development/evaluation, and 3 for questions/close. These are guideposts, not a reason to add slides. The trace and two sliders should receive actual time to operate.

**Acceptance check:** The audience can state the joint rollout rule in ordinary language and recognize a failed acceptance decision. The detailed protocol remains available, but the presenter is not forced to read four dense cards in one minute.

## Plain content and presentation QA

These are worthwhile corrections, but they should not be treated as the main evidence that V2 is a new teaching version.

1. **Slide 22 exercise button:** In the inspected preview, the “Reveal the repair” button overlaps the bottom of the first graph node. Move it below the diagram with enough separation for the hidden-answer reveal. The exercise itself is good; retain it.
2. **Slide 10 endpoint wording:** “Future audio supplies labels only” is too compressed. Prefer “Future audio may establish the reference label; it cannot enter this input.” The current notes already contain the right distinction.
3. **Slide 13 outage text:** “Outage pending — Resume…” describes a state and an action in one box. Label the edge `resume outage` and make the resulting state `active`, or keep a separate ledger to distinguish pending state from the next operation.
4. **Slide 4 generative role:** “Unfamiliar explanations” is narrower and less clear than “Open-ended reasoning + grounded explanation.” The running invoice explanation is not necessarily unfamiliar.
5. **Slide 26 consequence cohort wording:** “Fixed cohorts” is accurate but opaque. The notes can retain that term; visible text can say “Use the same independently defined cases in both systems.”
6. **Slide 30 follow-up usability:** The source list is well organized. Add a local link to the full blog/research handout in the deck or README so learners can retrieve the evidence and implementation boundaries after the presentation.
7. **Chrome and footer readability:** In previews, footer source/status text is appropriately subordinate, but some essential limitations currently live only there. Move cost-example status and trace completion facts into the content area; do not enlarge every footer.
8. **Slide 24 pipeline:** Retain the current split-before-augmentation and future-dataset feedback path. Do not collapse the lanes or remove the optional-adaptation note to create more whitespace. The density is defensible for this one overview figure; allow time to walk it left to right.

## Claims and design choices to keep

- Keep Jev interface and calibration semantics explicitly attributed to TypeSafe; the current Noul slide handles this well.
- Keep the runtime/harness distinction but spend no more than a minute there. It supports the tutorial rather than serving as a second technology survey.
- Keep `mixed` and `unclear` as first-class application labels, and keep the two-task ledger across the service examples.
- Keep the distinction among semantic correctness, constrained output shape, and controlled transitions. These give “predictability” a meaningful technical interpretation.
- Keep the source and product-status notes, but do not turn the talk into repeated disclaimers. Teach the concrete allocation mechanisms in the visual center.
- Keep the small-data high-confidence failure; replacing it with an ideal monotonic confidence curve would weaken the lesson.
- Keep the training diagram as proposed task development. No internal `koa-action` training, calibration, fine-tuning access, or measured economics should be implied.
- Keep the final “one decision that changes the path” recommendation. It is practical and follows from both economic and evaluation constraints.

## Suggested disposition log for V2

| ID | Recommendation | Recommended disposition |
| --- | --- | --- |
| T1 | Honest complete trace plus visible decision/state transform | Accept; core narrative repair. |
| T2 | Guarded edges and selective context graphics | Accept; core topology teaching improvement. |
| T3 | Cost stage, denominator, local hypothetical label, explicit failure point | Accept; essential to the economics claim. |
| T4 | Concrete label examples and a small authored-control artifact | Accept in compact form; preserve 30-slide scope and API boundaries. |
| T5 | Counts beside gate percentages and queue consequence | Accept; low implementation cost, high clarity. |
| T6 | Visual acceptance decision and deliberate timing | Accept; keep full statistical detail in notes/handout. |
| QA1–QA8 | Readability and wording corrections | Accept where applicable after current layout fixes. |

V3 can then focus on evidence that the revised lesson works as delivered: all reveal states, local source links, presenter view, static/print state, keyboard use, and screenshots of the economics failure and gate zero-coverage states. Those checks should verify the final teaching behavior rather than generate a third nominal copy of the deck.
