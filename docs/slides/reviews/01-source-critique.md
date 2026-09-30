# V1 independent adversarial source and factual review

Reviewed September 28, 2026 against [`source-ledger.md`](../research/source-ledger.md), the [final blog](../../blog/07-building-prod.md), the actual [`deck-v1.json`](../src/deck-v1.json), and [`interactions.js`](../src/interactions.js). Inspected rendered slides 13, 16, 20, and 24. Rechecked the current [AgentScript formal specification](https://github.com/salesforce/agentscript/blob/main/SPEC.md), [Noul reference](https://docs.typesafe.ai/primitives/noul), and [Score reference](https://docs.typesafe.ai/primitives/score) for the language and output-semantics claims.

**Verdict:** The proposed Salesforce composition is responsibly distinguished from documented interfaces, and the primitive/authority boundary is sound. Four focused changes would improve V2. No deck or interaction source was changed during this review.

## Required revisions

### 1. Correct the break-even label — medium

Slide 20 displays `Break-even: D + O < (1 − p)G`. That strict inequality identifies positive savings. Break-even is the equality `D + O = (1 − p)G`.

**V2 change:** Label the inequality “Lower cost when”, or display the equality under “Break-even”. The implemented arithmetic is correct: at `p = 0.93`, total candidate cost is 1.00 normalized units; `p = 1` produces 1.07 units, a 7% increase. Keep the illustrative label beside the result and the explicit service/human-cost exclusion.

### 2. Scope the trace title to its actual endpoint — medium

Slide 16 promises a “complete service trace”, while the final `traceEvents` entry leaves the outage **Active**. The implementation honestly retains the work; the title overstates what the trace demonstrates. In addition, the favorable fifth event combines explanation and customer confirmation in one transition. The notes distinguish the events, but a learner advancing the interaction never observes the intermediate “explained, still open” state.

**V2 change:** Retitle to “Follow the billing path while retaining the outage” or a similarly accurate scope. Prefer a separate confirmation event before the invoice becomes Resolved. If the title retains “complete”, extend the case through an independently justified outage outcome; do not simply relabel the unresolved task.

### 3. Cite the original method where the method is original — medium

Slides 23–27 propose a sound split, calibration, locked-test, joint-acceptance, and randomized-pilot protocol. Their current source footers point only to TypeSafe's construction guide, the small LangChain judge experiment, or Salesforce's enterprise architecture article. These references motivate the design but do not establish the whole protocol displayed on those slides. The proposed-status label reduces the risk but does not make the provenance precise.

**V2 change:** Add the final local blog or a companion methodology document as a first-class source and cite it on these slides. Keep the external links where they support narrower background claims, such as repeated judgments versus case diversity. The same local link can support the original cost derivation and constructed service trace. Expose the complete source ledger from the references/companion page.

### 4. Keep the training diagram legible in the deck — medium

The standalone SVG is correct and legible at its native size. The current slide 24 renders it around 900 px wide in a 1280 px screenshot, reducing its body labels to about 14 px. This is materially smaller than the rest of the teaching content and makes the split/artifact distinction difficult to read at presentation distance.

**V2 change:** Preserve the full standalone illustration, but teach it using two enlarged views: independent source partitions; then frozen artifacts, locked evaluation, randomized pilot, and release. Use HTML labels over SVG geometry so the deck can retain its typography and meet its vector-label convention. Link the full standalone vector in the companion material.

## Findings that should remain intact

- **Salesforce roles:** Agent Graph is described as the managed runtime, AgentScript as authored control, and `koa-action` as a bounded decision component. No hosted-LangGraph identity or invented native adapter is asserted.
- **AgentScript constructs:** `run`, `with`, and `available when` are real constructs. The deck correctly distinguishes required procedure execution from the actions offered to model reasoning. The current formal specification restricts `available when` to reasoning action bindings; the deck does not put it in the wrong procedural context.
- **Authority:** Interpretation never becomes account authority. Mandatory workflow checks and backend authorization remain separate, and the deck avoids treating an email-found lookup as sufficient authentication.
- **TypeSafe semantics:** The deck labels Noul's probability-valued yes/no meaning as TypeSafe semantics. Scoring uses an anchored rubric. It does not invent `koa-action` fields, ranges, calibration, or batching.
- **Uncertainty interaction:** The twelve values are explicitly synthetic and uncalibrated. The high-scoring wrong case makes confidence concentration distinct from correctness. Zero accepted cases correctly produces an undefined automatic error rate rather than a claim of zero error.
- **Economics interaction:** The candidate formula and common bar scale are consistent. The slider can expose negative savings, and no reported Jev benchmark is transferred to Salesforce. Whole-case costs and unresolved obligations are covered in notes.
- **State and completion:** Mixed intent is explicit, handoff is distinguished from resolution, and the implementation retains the outage. The problem is the trace title, not a hidden dropped task.
- **Training:** Source records stop at decision time. Separate sample branches feed training, validation, and test; dashed arrows carry artifacts. Adaptation is optional. Calibration and gate selection are separated, and feedback enters only a later dataset. The split does not imply one sample set sequentially moves through all three partitions.
- **Reliability claims:** Output-shape control, permitted transitions, and semantic correctness are distinguished. The deck does not claim guaranteed reliability, deterministic prose, exactly-once writes, or universal cost savings.

## Requested-resource coverage

The all-sixteen requirement is met in the research ledger: five Salesforce resources, five LangChain resources including the newly supplied layer comparison, and six TypeSafe resources. All sixteen canonical URLs were freshly retrieved for this slide task; two initial direct-open failures were resolved by following official navigation links at the same URLs. Prior substantive notes and fresh verification provenance are recorded. The deck's compact sources slide need not show all sixteen URLs, provided the full ledger is readily reachable.

## V2 acceptance checks for this review

1. At `p = 0.93`, the calculator displays break-even and no nearby strict inequality is mislabeled as equality.
2. The service-trace title matches its scope, and invoice resolution requires its declared outcome condition.
3. Original protocol slides identify the local method as their source.
4. A learner can read the partition and release-gate labels without zooming the slide.
