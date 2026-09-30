# Version 08: adversarial content review

Reviewed September 29, 2026 against [version 07](../07-building-prod.md), the [return-workflow specification](../../diagrams/returns-workflow-spec.md), both return illustrations, and the existing [source and claim ledger](../../slides/research/source-ledger.md). This was a read-only review of the article; its author made the revisions recorded below.

**Final assessment:** the reviewed version has no remaining material content issue within this review's scope. It consistently presents a proposed architecture and invented merchant policy, keeps service authority separate from semantic interpretation, and retains the statistical and economic safeguards developed in version 07. The return example and the evidence-per-step table make the architectural argument more concrete.

Final reviewed article SHA-256:

`16e79c8ce206df45c1716f36b984d516bf22f193a74b0f760f7f9782cc331e92`

## Findings and verified revisions

### 1. Establish required status facts before expensive interpretation

The original complex example described an unresolved replacement offer and a return conditional on whether that replacement could proceed. Its transition into frontier reasoning did not explicitly distinguish missing replacement-status evidence from a difficult interpretation of facts already available. That distinction matters because the preceding paragraph directs missing required facts to verification or hold.

**Revision verified:** the example now sends missing repair or replacement status to verification or hold first. Frontier interpretation is permitted only after required status facts are established, ordinary eligibility checks pass, and one clarification leaves a substantive interpretation problem. Human validation still returns to the same policy or holds the case. This resolves the ambiguity without adding a new workflow mechanism.

### 2. Preserve the all-incoming-case cost denominator

The economic discussion correctly defined operating cost per incoming case, then used “lower complete-case cost.” That phrase could be mistaken for an analysis restricted to completed cases, excluding the unresolved obligations counted elsewhere.

**Revision verified:** the text now says “lower operating cost per incoming case.” Retries, follow-up work, human handling, and work extending beyond the observation window remain accounted for under the stated boundaries.

### 3. Separate a source's confidence definition from the evaluation inference

The author identified an attribution improvement during review: TypeSafe's documented definition concerns distribution concentration, while requiring empirical validation against correctness is the article's methodological conclusion.

**Revision verified:** the sentence now attributes the concentration definition directly to TypeSafe and states the local-correctness validation requirement separately. It does not transfer a Jev-specific confidence schema to `koa-action`.

## Consistency checks

| Area | Assessment |
| --- | --- |
| Five-step teaching sequence | Authentication → receipt/ownership → semantic route → policy and fee → confirmation and authorization agrees with the diagram specification. |
| Merchant policy | Standard: within 30 days, $5 shipping. Plus: within 60 days, waived shipping. Both require returnability and available quantity. No discretionary waiver or policy override is added. |
| Customer examples | Standard day 18, Plus day 45, and Standard day 45 have the correct outcomes. Examples are explicitly hypothetical and distinguish a quote from completed authorization. |
| Time and tier evidence | Tier comes from an authorized service. Delivery and original request times come from trusted records; clarification does not reset the request timestamp. Unknown tier stays pending. |
| Authentication and purchase authority | Services establish caller access and order ownership. Neither receipt mismatch nor authentication failure escalates to persuasive model reasoning. |
| Context visibility | The evidence table identifies what each step sees and what result it may establish. Frontier proposals remain separate from trusted facts. Decision-time boundaries carry through to evaluation. |
| Semantic versus policy work | `routine`, `unclear`, and `complex` are application labels. Deadline calculation, loyalty entitlement, fee calculation, and writes remain service/code responsibilities. |
| Clarification and fallback | One useful clarification precedes reassessment. Resolved cases return to policy without frontier inference. Known policy failures exit; missing facts hold; only residual semantic complexity permits the bounded frontier attempt. |
| Invalid model output | Invalid routing responses and timeouts have a bounded retry followed by human handling. Frontier failure goes to human handling or hold, rather than an unlimited loop. |
| Human review | Reviewers validate facts and interpretation, then return to the same policy. The article grants them no policy-override authority. |
| Customer confirmation and commit | Item, quantity, and shipping terms require confirmation. Changed terms require renewed confirmation. Only an actual service result with a return ID and confirmed label reaches authorization. Unknown writes are reconciled before retry. |
| Multiple customer obligations | The replacement inquiry is preserved or explicitly handed off; routing a return cannot silently erase it. A pending task still counts in the workflow outcome. |
| Fair baseline | The wrapper has the same authoritative services and backend safeguards. The article does not claim that every frontier-centered design lacks control or that the model authenticates the customer. |
| Product boundaries | The composition, labels, and merchant policy are proposed. No native adapter, SDK, tuning interface, common Jev/`koa-action` schema, or measured integration advantage is invented. |
| Routine-path economics | Template-based customer messaging makes the no-frontier routine path coherent. Any generated copy is explicitly additional work in the accounting. |
| Evaluation design | The fixed-workflow model substitution is distinguished from the whole-architecture pilot. Grouped splitting, decision-time inputs, untouched testing, declared margins, all-incoming-case accounting, and unfinished cases remain explicit. |

## Editorial assessment relative to version 07

Version 08 replaces the abstract allocation table's main narrative burden with a complete return trace. The paired architectures make the repeated-frontier-call mechanism visible, while the companion policy illustration grounds loyalty-dependent eligibility and shipping in inspectable rules. The evidence-per-step table explains why graph topology affects context boundaries, rather than treating topology as a slogan.

The article also preserves version 07's restraint: lower cost and latency are hypotheses to test, smaller models are not inherently correct, and a well-authored graph can still encode a wrong rule. The final evaluation sections continue to distinguish operational savings from a lower model bill and repeatability from accuracy.

No additional policy exceptions, authentication mechanisms, training claims, or speculative implementation warnings are needed for this article. The remaining implementation details belong to a real application contract, not to the illustration's teaching scope.
