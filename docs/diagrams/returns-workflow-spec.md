# Product returns: authority and routing specification

This specification supports the original comparison illustration. It is an illustrative merchant workflow, not Salesforce product documentation or a measured implementation. `koa-action` and Jev name alternative examples of a System One decision model; no common API or native Salesforce adapter is asserted. The workflow makes no model-training claim.

The comparison holds business requirements and authoritative services constant. In the wrapper example, a frontier model interprets the request and proposes each next step. In the disaggregated example, authored graph transitions handle known dependencies, a specialized model interprets bounded semantic questions, and a frontier model is reserved for sufficiently complex residual interpretation. Both designs must authenticate customers, bind orders to the authenticated principal, enforce policy in services, and verify the outcome of a write.

## Recommended story and visual sequence

Use one recurring request: **“I want to return these headphones.”** The dominant path is:

1. **Authenticate.** A trusted identity service establishes the caller and account permissions.
2. **Match receipt.** An order service verifies that the receipt identifies this caller's order, item, and available return quantity.
3. **Interpret the request.** A bounded semantic judgment distinguishes a routine return from an unclear or complex request.
4. **Apply policy and fee.** Code evaluates trusted order facts and verified loyalty status against a versioned policy, then quotes the actual shipping fee or waiver. The model cannot supply its own loyalty entitlement.
5. **Confirm and authorize.** Obtain customer confirmation of the item, quantity, and shipping terms. An authorized service then rechecks prerequisites and uses an idempotency key to create the return authorization and label. Reconcile an uncertain result before retrying.

The accepted state is **“Return authorized + shipping label.”** Record the actual fee and service-issued return ID. Refund settlement and warehouse inspection occur later and are outside this illustration. A quote, model response, attempted write, or queued review is not a successfully authorized return.

The secondary semantic path is **“Clarify + precheck → facts present; still complex → frontier proposal → human validates or holds → same policy.”** This side lane collects at most one useful customer answer and checks known policy constraints through trusted services. Known ineligibility exits at the precheck; missing required facts go to verification or hold. The frontier model interprets the remaining difficult narrative and prepares a proposal. A human validates the resulting interpretation and any facts within that person's authority; uncertain cases remain on hold. The proposal cannot repair failed identity checks, establish order ownership, change the loyalty tier, approve an exception, or bypass the policy service. This teaching flow includes no policy-exception mechanism. The side-lane precheck does not require a sixth checkpoint on the five-step main path.

**Escalation guard:** the graph must check known mandatory policy constraints before calling the frontier model, even when the main illustration places its policy box after semantic routing. Reuse the same cheap policy procedure as a precheck. A known out-of-window or nonreturnable-item result terminates the ordinary path without expensive reasoning. Unknown required facts go to verification or hold. A frontier call is permitted only for remaining semantic complexity after known eligibility constraints pass. The final policy step and commit still recheck the current facts and policy version.

## Illustrative merchant policy

These tiers, deadlines, and fees are invented for teaching. Label them **“Illustrative merchant policy”** wherever displayed.

| Verified loyalty tier | Ordinary return window | Return shipping |
| --- | --- | --- |
| Standard | Request received no later than 30 days after delivery | Customer pays $5 |
| Plus | Request received no later than 60 days after delivery | Waived |

Both tiers require a matched purchase, a returnable item, and sufficient unreturned quantity. No defect waiver or other fee exception is part of this core example. Describing an item as damaged does not change these illustrative fee rules.

Use the merchant's authoritative delivery timestamp and a declared time zone. Compare the immutable request-received timestamp with the deadline, so time spent in clarification does not make an on-time request late. A current membership lookup establishes the tier. Do not infer it from purchase history, writing style, or a customer's membership claim. The service rechecks the tier and resulting quote before commit; changed terms require renewed customer confirmation.

## Exhaustive local routing contracts

These are proposed application labels, not provider response schemas. Each table covers its declared input type. An invalid response follows the failure route, never a success default.

### Mandatory identity and receipt gates

| Gate | Result | Next state |
| --- | --- | --- |
| Identity | `verified` | Proceed to receipt lookup with the authenticated principal. |
| Identity | `not_verified` | Offer secure authentication and await completion. No protected lookup or frontier escalation. |
| Identity | `denied` | Stop the protected return flow; provide the authorized support route. |
| Identity | `unavailable` or `invalid` | Bounded retry, then pending service recovery or authorized support. |
| Receipt | `matched` | Continue with trusted order, item, quantity, and delivery facts. |
| Receipt | `needs_input` | Ask for the missing identifier once; then pending verification if unresolved. |
| Receipt | `mismatch` | Stop automatic return handling; authorized verification handles disputes. |
| Receipt | `unavailable` or `invalid` | Bounded retry, then pending service recovery or authorized support. |

An uploaded receipt may help locate a purchase. It does not establish ownership or return eligibility. Neither gate sends a failure to a frontier model to reason around it. Secure authentication, receipt-identifier collection, and semantic clarification are different activities with separate bounded handling; the illustration's “clarify once” specifically limits semantic clarification.

### Bounded semantic route

The visible diagram can combine `unclear` and `complex` into one side branch. Keep them distinct in the application contract because missing information and difficult interpretation need different handling.

| Result | Next state |
| --- | --- |
| `routine` | Run the policy procedure. |
| `unclear` or `complex`, with clarification unused | Ask one targeted question, preserve the answer, and assess the request once more. |
| `routine` after clarification | Run the same policy procedure. |
| `unclear` after clarification because required customer facts or intent remain missing | Hold or queue human handling; do not guess and do not use frontier reasoning as a substitute for missing evidence. |
| `complex` after clarification, with known mandatory constraints passed | Permit one scoped frontier interpretation attempt. |
| `complex` after clarification, with a known policy failure | Follow the policy failure; no frontier call. |
| `complex` after clarification, with required facts unverified | Hold or seek authorized verification; no frontier call yet. |
| `invalid` or `timeout` | Bounded technical retry, then human handling. Model failure does not prove that the customer's case needs sophisticated reasoning. |

A routine request clearly seeks this standard return flow. An unclear request lacks an answer needed to identify the customer's request. A complex request remains a substantive interpretation problem despite having the required verified facts. Compound requests retain every requested task; the workflow must not erase a replacement inquiry merely because it routes the return first.

### Frontier result and human review

| Result | Next state |
| --- | --- |
| Frontier returns an interpretable proposal | Human validates the meaning and any claimed facts within authorized sources; proposal itself grants no permission. |
| Frontier times out, returns an invalid result, or remains uncertain | Human handling or hold; no repeated unbounded reasoning loop. |
| Human establishes a routine return request with verified facts | Return to the same versioned policy step. |
| Human establishes that no return is requested | Route or hand off the actual request; do not create a return. |
| Human cannot establish the request or required facts | Record hold/pending review and the outstanding question. |

The frontier sees only authorized case context and the remaining question. Its generated text cannot overwrite trusted identity, order, tier, policy, or transaction fields. If a person confirms a new fact, persist it through the appropriate authorized service or reviewed record with provenance. The core flow does not authorize that person to override the merchant policy.

### Policy and shipping

Apply the following table after identity and receipt gates. Use **first matching row**, making rows mutually exclusive in execution. The policy result is recorded with its version.

| Priority | Condition | Result |
| --- | --- | --- |
| 1 | Any required policy fact is unavailable, contradictory, invalid, or unverified | `pending_verification`; no authorization or fee commitment. |
| 2 | Item is not returnable, requested quantity exceeds the unreturned quantity, or request is after the tier's deadline | `ineligible`; explain the trusted reason. |
| 3 | The policy service requires a manual fact assessment | `pending_review`; preserve the request timestamp and outstanding question. |
| 4 | Eligible and tier is Plus | `eligible`, shipping `waived`. |
| 5 | Eligible and tier is Standard | `eligible`, shipping `$5`. |

Tier is restricted to Standard or Plus; any other value reaches row 1. A known denial is never a frontier escalation trigger. The graph may use this procedure before the semantic fallback and must run it before any quote or commit. A pending review is not a third loyalty tier or an exception approval.

### Customer confirmation and action result

| Result | Next state |
| --- | --- |
| Customer accepts an eligible quote | Invoke the return service with trusted identifiers, the accepted terms, policy version, and an idempotency key. |
| Customer rejects or cancels | Record cancellation; no return is created. |
| Customer has not responded | Await confirmation within the declared expiry window. |
| Commit succeeds | Record actual return ID, item/quantity, fee or waiver, and label; show authorized outcome. |
| Commit definitively fails | Record failure and recover according to the service error. |
| Commit outcome is unknown | Reconcile with the same idempotency key before retrying. Do not issue a second label blindly. |

Before writing, the service rechecks caller access, order/item, quantity, current policy, and the accepted fee. If the current outcome differs from the quote, present revised terms and obtain confirmation again. An accepted free label must never silently become a paid label.

## State that must survive every branch

Retain authenticated principal and verified order identifiers, item and quantity, authoritative delivery time, immutable request-received time, verified tier, policy version/result, all requested tasks, clarification status, pending questions, shipping quote, customer confirmation, commit status, and the service-issued return ID. Trusted facts retain provenance. A frontier proposal occupies a separate field from verified facts. The graph distinguishes `pending`, `ineligible`, `cancelled`, `authorized`, and `commit_unknown`; none may default to success.

## Six worked cases

These are examples, not measurements.

| Case | Verified facts / request | Route and result |
| --- | --- | --- |
| A — ordinary Standard | Authenticated; matching receipt; Standard; returnable item; request on day 18 | Bounded interpretation → policy → **eligible, $5 shipping** → customer accepts → service-issued authorization. No frontier call. |
| B — ordinary Plus | Authenticated; matching receipt; Plus; same returnable item; request on day 45 | Bounded interpretation → policy → **eligible, shipping waived** → customer accepts → commit. No frontier call. |
| C — outside the window | Authenticated; matching receipt; Standard; request on day 45 | **Ineligible under ordinary policy.** No frontier call, even if the customer's narrative is complex. |
| D — identity gate | Claimed Plus customer; no verified authentication | **Await secure authentication.** No protected lookup, frontier reasoning, or return authorization. |
| E — receipt gate | Authenticated; uploaded receipt belongs to a different order owner | **Stop automatic handling; authorized verification.** Confidence or fluent explanation cannot establish ownership. |
| F — residual complexity | Authenticated; matching receipt; Standard; day 20; known policy checks pass; after one clarification the narrative still mixes a completed repair, an unresolved replacement offer, and a conditional return request | Frontier proposes an interpretation of the remaining obligations → human validates or holds. Only a confirmed ordinary return rejoins policy, yielding **$5 shipping** and requiring customer confirmation. Other tasks remain recorded or are explicitly handed off. Acceptance is not implied in advance. |

## Independent challenges for the illustration

- The left panel must not imply that a frontier model authenticates customers or owns policy. Both sides depend on the same authoritative services; the comparison concerns allocation of interpretation and route selection.
- The right panel must not assign exact receipt matching, deadline arithmetic, loyalty entitlement, fee calculation, or transaction authority to a System One model.
- The frontier path must rejoin the same policy gates. A shortcut from “frontier” or “human review” to “accepted” would teach the wrong authority boundary.
- The pre-escalation policy guard is necessary when a displayed policy box comes later in the main path. Otherwise known failures could still take an expensive detour.
- Unknown differs from false. An unavailable membership lookup cannot silently demote Plus to Standard. Human review and service outages must retain an explicit pending state.
- Fewer frontier calls create an opportunity for lower cost and latency. More nodes, retries, and human queues can erase the gain. No numerical gain or inherent accuracy advantage follows from this illustration.
- Label branch edges in text. Color alone cannot explain Standard/Plus outcomes, pass/fail states, or the difference between a recommendation and service authority.

## Evidence basis

This design follows the claim boundaries in [the slide source ledger](../slides/research/source-ledger.md) and the authority separation in [the final blog](../blog/07-building-prod.md). Salesforce's [enterprise-agent account](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/) grounds mandatory identity checks and controlled actions. The [AgentScript control-plane article](https://www.salesforce.com/blog/agent-script-control-plane/) grounds authored state and action constraints. TypeSafe's [intent-routing pattern](https://docs.typesafe.ai/patterns/intent-routing) and [confidence-routing pattern](https://docs.typesafe.ai/patterns/confidence-routing) support focused semantic routes with fallback. [Building Prod with Jev and LangGraph](https://www.langchain.com/blog/building-prod-with-jev-and-langgraph) supplies the model-specialization analogy. No benchmark from those examples is transferred to this proposed return flow.
