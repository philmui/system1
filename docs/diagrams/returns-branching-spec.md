# Branching product requests: proposed teaching contract

This is the specification for the fresh branching illustration and its related article and slides. It supersedes the earlier three-label return-routing example **for the new material only**; earlier exports and review records remain preserved. The architecture, labels, and merchant examples are proposed teaching designs. They do not establish a `koa-action` API, a common Jev/Salesforce interface, a native adapter, or measured gains.

The main lesson is that a System One model can interpret a familiar exchange or component-return request and select an appropriate service route. A request can involve several business steps while remaining straightforward to classify. Routing to a different business process does not by itself justify calling a frontier model.

## What the two pictures should teach

**Picture 1: the front desk and its authority gates.** Show authentication and owned-purchase verification once as shared requirements, with compact model-allocation lanes: the wrapper repeatedly consults the frontier model around service results; the disaggregated graph follows authored transitions from those same service outputs. The authentication result visibly branches to verified continuation, secure sign-in followed by recheck, or failed verification that stops protected work. Purchase mismatch goes to verification/hold. This picture establishes the facts that the next picture assumes.

**Picture 2: familiar requests reach the appropriate service.** Begin after verified identity and an owned purchase. System One interprets the requested remedy and affected unit, and authored code maps the supported combinations to **Return item / Exchange / Kit part**. Show three concrete customer requests and recognizable product scenes. These routes lead to different service policies, not directly to acceptance. A short clarification can resolve uncertain meaning without frontier reasoning. A separate reasoning-gate illustration can expand the optional frontier detour; its validated task structure returns to the applicable handler.

Keep the two-page story about the front desk and familiar routes. Do not force every interpretation condition onto those pictures. Use a secure sign-in screen, checked ID, matched receipt, whole product, two swapping products, and a detached cable from a kit. These objects make the differences visible without a paragraph inside every node.

## 1. Authentication is an explicit service branch

The identity service supplies the result. Neither a frontier model nor System One decides whether a customer is authenticated. This follows Salesforce's account of a verification gate that advances only on an explicit function success. The authority distinction is central to the example. [Salesforce enterprise-agent engineering](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/)

| Identity result | Visible route | Meaning |
| --- | --- | --- |
| `verified` | Continue to purchase lookup. | Use the service-established principal and permissions. |
| `missing_or_expired` | Secure sign-in → **recheck identity**. | Completing a screen or saying “I signed in” is not the verification result. Only the recheck's success advances. |
| `rejected_or_failed` | Stop protected work. | Offer the permitted account-support route. A future successful secure authentication may restart the check; there is no direct continuation to the order. |
| `unavailable_or_invalid` | Hold / bounded service recovery. | No protected work proceeds while the result is unknown. An outage is not a customer eligibility denial. |

The most useful main-picture edge labels are **Verified / Sign in / Failed**. The sign-in arrow returns to the identity check, not to the purchase or model node. Put technical recovery detail in notes. A single “No → sign in” edge is inadequate if the same diagram also needs to represent an explicit rejection.

The wrapper side uses these same service outcomes. Its model may propose an action, but the backend refuses protected access without verified authority. Do not depict the wrapper as granting authentication through persuasive language merely to make the comparison easier.

## 2. An owned purchase establishes facts, not intent or entitlement

The order service binds the receipt to the authenticated principal and obtains verified purchased line items, delivery information, available quantities, and relevant kit composition. This stage establishes the owned purchase and candidate items. The affected product or component must then be unambiguously identified before its handler can act.

| Purchase result | Route |
| --- | --- |
| Owned purchase matched | Give the semantic node the relevant authorized item facts and conversation prefix. |
| Identifier missing | Ask for the needed order/receipt identifier, then retry the service check within its handling budget. |
| Receipt or ownership mismatch | Verification / hold; no transaction and no frontier interpretation around the mismatch. |
| Service unavailable or invalid | Hold / bounded service recovery. |
| Owned order known, affected item ambiguous | Ask which purchased item or kit component is meant; preserve the known order match. |

The distinction matters for “return part of my order.” A complete item chosen from a multi-item order is different from one component removed from a purchased kit. If a cable could refer either to a separately purchased cable or to the cable included with headphones, obtain the item binding rather than guessing a fee or policy.

## 3. Keep three semantic questions distinct

These are conceptual application fields, not a claimed provider schema. They can be implemented as evaluated bounded questions where the selected model interface supports them.

| Question | Proposed answer contract | Why it is separate |
| --- | --- | --- |
| What remedy does this obligation request? | `return_for_refund`, `exchange`, `other`, or `unclear` | An exchange should not become a refund return just because both involve sending a product back. |
| What purchased unit does it concern? | `complete_product`, `kit_component`, or `unclear`, with a reference to a verified candidate | “Only the cable from the headphone kit” invokes a component policy; returning the entire cable SKU bought separately does not. |
| Can the request and its relationships be interpreted under the authored definitions? | `clear`, `clarify`, or `residual_complex` | Interpretation difficulty is independent of the product or remedy category. Exchange and component requests are not automatically difficult. |

TypeSafe documents narrow questions, structured criteria, and explicit code composition. Its advanced guide describes choosing among defined categories and traversing a taxonomy in application code. Those examples support this design approach; they do not establish identical `koa-action` response types or batching behavior. [TypeSafe construction guide](https://docs.typesafe.ai/concepts/how-to-build-with-system-one), [structured decision definitions](https://docs.typesafe.ai/primitives/advanced)

The picture may simplify the clear outputs to three familiar routes:

| Clear task | Handler | Illustrative customer wording |
| --- | --- | --- |
| Return a complete purchased product | Whole-item return service | “Return these headphones.” |
| Exchange a complete purchased product | Exchange service | “Swap these black headphones for white ones.” |
| Act on a component of a purchased kit | Component-specific service | “Return only the cable included in the headphone kit.” |

**An authored registry controls supported combinations.** The three mappings illustrated here are `(return_for_refund, complete_product)`, `(exchange, complete_product)`, and `(return_for_refund, kit_component)`. A complete product may itself be the entire purchased headphone kit. An exchange of only a kit component is a fourth combination; it is not automatically authorized or supported merely because the model can identify it. Under this example it goes to configured specialist handling unless the merchant has explicitly registered a component-exchange handler and its policy. The model cannot invent that handler, policy, or entitlement. It remains one component-exchange request, not two independent tasks. `other` also follows the configured support route, and unresolved unit or remedy goes to clarification.

This mapping avoids overlapping flat labels. It also avoids the misleading rule “exchange or parts = frontier.” System One interprets the request; authored graph logic chooses the corresponding allowed handler.

## 4. Preserve mixed requests and simple conditions

Maintain a task list with the referenced item, requested remedy, status, and explicit **AND, OR, or IF** relationships. The model's proposed interpretation does not itself execute all listed tasks. Authored logic validates the structure against supported routes and uses service facts to evaluate any conditions.

- **AND — requested obligations:** “Return the headphones and exchange the separately purchased speaker.” Retain both tasks. Each gets its own policy result and confirmation. Completion of one does not erase the other; sharing a message does not establish that writes can safely run in parallel.
- **OR — a choice remains:** “I could return these or exchange them; what are my options?” Obtain the relevant service offers, then resolve the choice with the customer. Do not execute both or silently choose a remedy that has not been accepted.
- **IF / OTHERWISE — an authored alternative:** “Exchange these for white if available; otherwise return them.” Obtain authoritative availability and the exchange policy result, then follow the customer's exact conditional preference in code. Both operations must not commit. A known false condition activates the stated alternative; an unavailable or unknown stock result does not count as false and remains pending. Here the stated condition is stock availability: a different exchange-policy denial does not automatically authorize the return alternative when white remains in stock. Explain that denial and resolve the customer's preference rather than broadening the condition. The alternative return needs its own eligibility and terms. This clear condition does not inherently require frontier reasoning.
- **Component scope:** “Return the cable from the kit.” Keep the kit reference and component reference together. Do not invent a standalone cable purchase or apply the whole-headphone return price.
- **Difficult remaining interpretation:** A long case history contains competing repair, exchange, and conditional-return instructions whose current relationship remains unclear after one targeted clarification, despite the relevant status records being available. This may justify a bounded frontier proposal for human review.

A task's justified policy denial can be a correct outcome while another task proceeds. A denied return must not silently cancel a separate eligible exchange. Conversely, a viable alternative must not be fabricated when the customer requested only the denied action.

## 5. Each handler owns its policy and quote

The familiar semantic routes lead to service checks. They are not successful transactions by themselves.

| Handler | Authoritative checks / result | What must not be inferred |
| --- | --- | --- |
| Whole-item return | The invented full-return policy below, plus item eligibility and available unreturned quantity. Produces eligibility and a shipping quote or a reason to decline/hold. | A model's `return` label does not prove ownership, eligibility, or a waiver. |
| Exchange | Its own exchange rules, requested replacement, availability, allowed quantities, and applicable charges/terms. Produces a specific offered exchange, denial, or hold. | Do not assume the whole-item return deadline or $5/waived shipping applies. Do not treat a stock failure as a reason for more model intelligence. |
| Kit component | Its own component rules, kit composition, affected component, registered remedy, quantities, and charges/terms. The illustrated supported request is component return. It produces an allowed component action, denial, or hold. | Do not assume a kit can be split, prorate a refund, promise an available replacement, inherit the whole-item fee, or invent a component-exchange route. |

The only numeric merchant rules established for this teaching example remain:

| **Whole-item return only** | Request received after delivery | Return shipping if eligible |
| --- | --- | --- |
| Standard | Within 30 days, inclusive | Customer pays $5 |
| Plus | Within 60 days, inclusive | Waived |

These invented rules are not exchange or component-return policy. Update the policy picture's title/caption and any associated slide notes to say **whole-item return** explicitly. Exchange and component services return their own terms; the illustration should not invent their numeric deadlines or prices merely to fill a branch.

Retain the original request-received timestamp. Missing tier, contradictory quantities, unavailable terms, or a required manual assessment remains pending. A Standard whole-item return on day 45 is ineligible under the illustrated ordinary return policy. That result says nothing by itself about a separately requested exchange whose rules have not yet been evaluated.

## 6. A bounded interpretation detour

The detour serves the question that remains, not the mere presence of an exchange, component, mixed request, or condition.

| Condition | Route |
| --- | --- |
| Clear supported remedy, unit, and task relationship | Route to the appropriate service(s) in authored logic. No frontier required. |
| Clear meaning, but no registered handler/policy for that combination | Configured specialist handling or an explicit unsupported result. The absence of a route is not a language-interpretation problem. |
| A customer answer could resolve the ambiguity | Ask one useful clarification and reassess. A resolved result returns to its appropriate handler. |
| Required identity, purchase, item, stock, or policy facts are missing | Fetch or verify through authorized services, or hold. More model reasoning is not a replacement for the fact. |
| A known mandatory rule fails for an identified task | Follow that handler's denial or hold. No frontier appeal around the rule. Other separately requested tasks retain their own statuses. |
| All relevant required facts and known mandatory checks are satisfied, yet substantive interpretation remains after clarification | Permit one scoped frontier attempt on authorized history and the remaining question. |
| Frontier produces a proposal | Human validates the task structure, AND/OR/IF relationships, and references to authoritative facts. Check the same supported-combination registry, then return the validated task structure to its applicable handler and policy, or use configured specialist handling for an unsupported combination. |
| Interpretation remains unresolved, or a model result is invalid/times out after bounded technical recovery | Human handling or hold. No default to acceptance and no unbounded reasoning loop. |

**Precheck is branch-aware.** Do not apply the whole-item return window as a global barrier for an exchange or component request. Check invariants common to all work and the known requirements of each affected route. If the affected unit or intended remedy is still uncertain, preserve that uncertainty; a guessed return policy must not produce a final denial of every possible service request.

The frontier model cannot change the identity result, repair ownership, invent inventory, substitute its own policy, or execute a reviewer's proposal. Its output remains separate from trusted facts. Human validation does not grant policy-override authority in this example. A validated exchange returns to exchange rules; a validated component action returns to component rules. “Back to the same policy” must mean the same policy for the applicable handler, not a shared $5/waived return table.

TypeSafe's intent-routing example selects among code, specialist language-model handlers, and human handling. Its sample assigns return/exchange to a specialist language model; the direct service mapping here is our proposed design. Uncertainty and an intent label are separate signals, and any numerical routing gate needs local evaluation. No example confidence threshold is imported as a universal rule. [Intent routing](https://docs.typesafe.ai/patterns/intent-routing), [confidence semantics](https://docs.typesafe.ai/confidence)

## 7. Confirmation and a real service outcome finish the branch

After a handler produces an eligible offer, confirm the actual action, affected item/component and quantity, replacement if any, and all quoted shipping/price terms. A return quote is not permission to exchange; an exchange confirmation is not permission to refund instead.

The service rechecks the relevant authority, rules, availability, and accepted terms before committing. Changed terms need renewed confirmation. Missing confirmation waits; cancellation stops the affected action. Reconcile an unknown write outcome using the request identity rather than treating it as success.

Show a service-issued result that matches the action: a return authorization and label for a full return, the authorized exchange result for an exchange, or the specified component-action result. If a diagram merges these branches, **“Confirmed service outcome”** is safer than labeling every result “Return authorized.” A pending review, proposed plan, lookup, or quote is not that final result.

AgentScript provides a way to author state and action conditions in a Salesforce-managed runtime. Its documented input binding and availability conditions support constraining what a model may be offered, while mandatory steps still need authored control and backend enforcement. This specification is an architectural teaching example, not executable AgentScript. [Salesforce AgentScript control-plane account](https://www.salesforce.com/blog/agent-script-control-plane/)

## Worked examples to carry across the pictures and prose

| Request / starting condition | Expected route | Frontier? |
| --- | --- | --- |
| “Return these headphones”; no authenticated session | Secure sign-in → identity recheck → continue only if verified. | No |
| “I already verified myself”; identity service rejects authentication | Stop protected work; permitted account support. | No |
| Authenticated; receipt ownership does not match | Verification / hold. | No |
| Standard, day 18; owned complete headphones; ordinary return | System One identifies complete-product return → return policy → $5 quote → confirmation → service authorization. | No |
| Plus, day 45; owned complete headphones; ordinary return | Whole-item return policy → waived-shipping quote → confirmation → service authorization. | No |
| “Swap these black headphones for white ones” | Complete-product exchange → exchange policy and inventory → its own offer or denial/hold. | No |
| “Return only the cable that came inside the headphone kit” | Kit-component scope → component rules and supported remedy → its own terms or denial/hold. | No |
| “Return the cable I bought separately, keep the headphones” | Complete cable SKU selected from a multi-item order → ordinary whole-item return rules, assuming its eligibility. | No |
| “Return the headphones and exchange the speaker” | Preserve two separate obligations and their results. | No, if the references and relationship are clear |
| “Return them or exchange them; what can I choose?” | Retrieve the authorized offers and resolve the OR choice; do not execute both. | No, if the alternatives are clear |
| “Exchange for white if available; otherwise return” | Query exchange service; follow the explicitly authored alternative; apply the selected handler's rules and obtain its confirmation. | No, if the condition is clear |
| “Exchange only the cable included in the kit,” with no registered component-exchange route | Preserve the accurately understood request and send it to configured specialist handling. Do not fabricate support or reuse whole-item exchange rules. | No, merely because the combination is unsupported |
| A verified case still has conflicting repair/exchange/conditional-return instructions after a useful clarification | Scoped interpretation → human validation or hold → applicable handler. | Possibly; no acceptance is implied |

## Precise review recommendations

1. The sign-in branch must visibly return to a service recheck; failed authentication must not share a continuation arrow with verified identity.
2. The three familiar semantic branches must be visible at projector scale. Do not hide exchange and component requests inside a generic “complex” cloud pointing to the frontier.
3. Label a component as part of a kit. A picture of a detached cable alone does not distinguish a kit part from a separate purchased item.
4. Keep AND, OR, and IF relationships distinct in prose/notes. AND preserves all obligations, OR retains a choice to resolve, and IF evaluates a known condition. Unknown is not false; mutually exclusive alternatives should not both commit.
5. No visible full-return fee or loyalty window should span the exchange/component branches. Apply those numbers only to the explicitly labeled whole-item return example.
6. The detour returns to the relevant handler's checks. A frontier or human-review arrow must not point directly to an accepted parcel or bypass a rejected identity/ownership result.
7. A stock lookup, known policy denial, or missing receipt is a service problem, not evidence that frontier reasoning is necessary.
8. Update article tables, slide notes, accessible descriptions, alt text, and legend language alongside the graphics. Legacy `routine/unclear/complex` wording must no longer be the entire semantic contract; it is now the interpretation-status axis alongside remedy and scope.
9. Preserve the original performance boundaries: familiar-routing examples show a mechanism for avoiding expensive calls, not measured cost or accuracy results.
10. Existence of a route and its policy is an authored configuration fact. Correctly recognizing an unsupported combination routes to a configured specialist; it does not authorize a model to invent a new action or rule.

## Research note

Primary sources were read afresh on September 29, 2026: Salesforce's enterprise-agent and AgentScript accounts, TypeSafe intent routing, structured criteria, confidence, and construction guidance. The construction-guide direct open initially failed; following its link from the Confidence page loaded the canonical source successfully. The cited pages support architectural roles and decision patterns. All retail policies, task labels, branch contracts, and worked cases in this document are original illustrative choices.

| Primary URL | What it directly supports | What remains our proposed design |
| --- | --- | --- |
| [Salesforce: enterprise agents](https://engineering.salesforce.com/building-enterprise-ai-agents-that-are-both-autonomous-and-reliable/) | Graph transitions guarded by explicit verification success; specialized routing; separation of orchestration, state, and side effects. | The particular login states, item taxonomy, retail handlers, and fee examples. No named `koa-action` measurement is established by its reported routing observations. |
| [Salesforce: AgentScript control plane](https://www.salesforce.com/blog/agent-script-control-plane/) | Typed state, procedures, bound action inputs, and availability conditions in a language targeting a managed Salesforce runtime. | This exact graph, its backend authority contracts, and any `koa-action` integration. Availability alone does not establish that a required action executes. |
| [TypeSafe: intent routing](https://docs.typesafe.ai/patterns/intent-routing) | A classifier can select different handlers, including code, specialist language models, or people. | Direct exchange and component-service routes. The page's own return/exchange sample uses a specialist language model. |
| [TypeSafe: construction guide](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) | Keeping flow and effects in code, using narrowly defined questions and relevant state, and evaluating uncertainty-based routing. | The three illustrated action/scope combinations and the retailer's supported-route registry. Its interface and runtime claims are Jev-specific. |
| [TypeSafe: structured criteria](https://docs.typesafe.ai/primitives/advanced) | Structured category definitions and programmatic traversal of a taxonomy. | This proposed task list and its AND/OR/IF representation; no matching `koa-action` schema is documented here. |
| [TypeSafe: confidence](https://docs.typesafe.ai/confidence) | Choice/Score confidence summarizes the response distribution, with application-specific decision thresholds. | A particular accuracy guarantee or a universal escalation threshold. A confident answer does not establish transaction authority. |
