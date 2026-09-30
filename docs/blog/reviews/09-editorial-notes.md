# Version 09 editorial notes

[Version 09](../09-building-prod.md) develops the explicit authentication and semantic-branching contract in [the new specification](../../diagrams/returns-branching-spec.md). It preserves version 08 and its existing illustrations. The new article uses separate asset names so its new story cannot silently change the pictures displayed by the earlier article.

## Editorial changes

- The opening now uses whole-product returns, exchanges, and kit-component requests as familiar work. Interpretation difficulty is independent of request type; a clear exchange or component request can follow a configured service route.
- The authentication explanation distinguishes verified, missing/expired, rejected/failed, and unavailable/invalid outcomes. Secure sign-in returns to an identity-service recheck. Both compared architectures retain the same authority requirements.
- The semantic contract distinguishes requested action, purchased-unit scope, and interpretation status. Its task records and category descriptions are conceptual application choices, without claiming `koa-action` SDK fields or Jev interface compatibility.
- The graph maps supported action/scope combinations to configured handlers. A component exchange is one meaningful combination; support must be configured or the request goes to specialist handling. The drawing's three examples do not become an exhaustive flat classifier.
- AND preserves multiple obligations, OR preserves an unresolved choice, and IF preserves the actual customer condition. Unknown stock is not false stock; a different policy denial cannot broaden an availability-only condition.
- The existing Standard/Plus deadlines and shipping charges now explicitly apply only to whole-item returns. Exchange and component handlers obtain their own rules, quantities, inventory, and terms. No new numeric policy is supplied for them.
- The reasoning detour checks the known requirements of the affected routes. Missing service evidence or an absent supported route is handled by services, verification, or configured specialists. Frontier interpretation remains bounded and returns through human validation to the applicable policy.
- Completion follows the confirmed action and its service-issued outcome. An exchange is no longer described as if every successful branch were a refund return. The economic denominator remains each incoming case, including all its requested tasks and unfinished work.

## Methodology retained and adapted

The source snapshots, decision-time evidence boundaries, grouped partitions, frozen configuration, locked test, and controlled service pilot remain. The labeling target now covers action, scope, interpretation status, and task relationships. Offline evaluation checks omitted obligations, wrong combinations, and lost conditions under the same authorized inputs and actions. The whole-workflow comparison retains the joint reliability/cost null hypothesis, independently defined consequential-error cohorts, latency limits, and uncertainty calculations that respect related cases and assignment groups.

No experiments, performance results, model adaptations, SDK integration, or merchant deployment are claimed. The expanded routing examples explain the mechanism to be evaluated.

## Evidence and current review status

Version 08's primary-source basis and [claim ledger](../../slides/research/source-ledger.md) remain applicable. Fresh reading for this revision covered TypeSafe's [structured criteria](https://docs.typesafe.ai/primitives/advanced), [construction guide](https://docs.typesafe.ai/concepts/how-to-build-with-system-one), and [intent-routing example](https://docs.typesafe.ai/patterns/intent-routing). The construction guide loaded through its link from the Confidence page after a direct open failed. The article explicitly distinguishes TypeSafe's specialist-LLM return/exchange example from the direct service mapping proposed here.

The plain-research-writing skill was applied. The current draft is 3,556 words. It references access, semantic routing, whole-item policy, reasoning gate, and training as Figures 1–5. The four new illustration paths are separate from version 08's canonical assets. The captions were checked against the four completed SVGs’ visible labels and accessible descriptions: access and its recheck branches; familiar routes and eligible quotes; scoped whole-item policy; and the residual-meaning gate. This is a semantic source check, with rendered layout checks reported separately.

The [independent semantic review](../../slides/reviews/05-semantic-adversarial-review.md) checked version 09 against the branching specification and found the authority, action/scope mapping, branch-specific policies, AND/OR/IF semantics and unsupported-combination handling consistent. The installed Codex adversarial command was also attempted, but its app server failed before review because it could not initialize SQLite state in the restricted Codex directory. The [raw attempt log](../../slides/reviews/05-throughline-codex-review.txt) records this environment failure. This revision therefore has independent semantic review, not a completed Codex-plugin verdict. Rendered-artifact checks are reported separately from semantic review. The final local diagram audit and 36-slide layout checks passed, along with component reconstruction and final PowerPoint package validation; current browser and native Office rendering were unavailable.

Preserved version 08 SHA-256: `042deb51b870350e530de2812db4f388453f070ebce17cb7e137af3b424086b5`.

## Throughline and cross-format consistency

The opening assigns authoritative facts and exact rules to services, bounded interpretation to System One, coordination to Agent Graph and authored controls to AgentScript. This allocation recurs in the context, escalation, economics and conclusion sections. The article attributes the unbundling argument to Jaya Gupta through LangChain’s article; it does not repeat an unsupported three-year population claim or turn that claim into Salesforce product history.

The 35-slide core for version 05 now uses the same headphone exchange and separately purchased cable-return case throughout. Its eight-event trace verifies identity and purchase before interpretation, obtains exchange policy and stock, waits for customer confirmation, records service authorization and then activates the unfinished cable return. The integration adds a second illustration page while preserving earlier published versions.
