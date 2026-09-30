# Editorial critique of version 01

Reviewed `01-building-prod.md` for the Salesforce blog audience, using the plain-research-writing guidance and the supplied LangChain sources. This is an independent editorial critique, not the requested `codex:adversarial-review` tool execution.

## Assessment

Version 01 has a sound architecture and useful restraint. It distinguishes the three Salesforce components, attributes the source inspiration, avoids imported benchmarks, and explains why a confident classification cannot authorize a credit. The strongest passage connects different failures to the different system components responsible for them.

The main weakness is instructional: after a concrete opening, the article becomes a series of sensible recommendations. The reader never follows that customer's request through an actual decision, an explicit branch, and an authorized outcome. Version 02 should use one worked service case to carry the architecture and reserve methodological detail for what determines whether that design succeeds.

## Priority 1: carry one request through a causal trace

The opening includes billing and an outage, but the next section offers mutually exclusive categories and later suggests splitting the request. Specify the unit of decision. Is the classifier identifying all requested intents, or choosing the next handling path? Those contracts differ.

For example, define a proposed next-route decision with `billing`, `technical`, `account_access`, `mixed`, and `unclear` outcomes. A mixed result preserves both requests in state and invokes a configured priority question or decomposition step. Then show a subsequent billing-only decision, an authoritative account lookup, the permitted explanation, and the retained technical task. Label the records as illustrative application data, not a documented `koa-action` response.

This gives Agent Graph a visible purpose: state and transitions preserve obligations across the conversation. It gives AgentScript a visible purpose: the configured branch constrains the next action. It also makes the limits of a classifier understandable without another cautionary paragraph.

## Priority 2: make the proposed contract inspectable

Add one compact table or pseudocode block showing input evidence, allowed outcome, and failure behavior. The contract should say what happens with a timeout, invalid output, or ambiguous input. A classification call that fails should lead to clarification or review instead of accidentally selecting a default business action.

Replace “probability-like” with a more useful distinction. Explain a noul as a binary semantic assessment whose value represents the proposition's estimated truth under the chosen contract; separately state that `koa-action` field names and calibration behavior are unspecified in the public material. A probability attached to “cancellation requested” is different from a confidence measure attached to a whole distribution. Avoid implying that any threshold transfers between providers or tasks.

Do not show invented Salesforce SDK syntax. A small, explicitly proposed application contract is enough for this article.

## Priority 3: formulate a decision the experiment can settle


“Will not yet be assumed to improve” is a useful posture but is not a statistical null. Define success operationally: a predeclared maximum increase in harmful routing errors, alongside a meaningful reduction in handling latency or total cost. The quality test is a noninferiority comparison; the operational improvement is a separate comparison. Explain this in ordinary prose rather than introducing an unnecessary formula.

The candidate and baseline should receive the same held-out cases and authoritative facts. Freeze the decision contracts and runtime policy for the component comparison. Measure the complete workflow separately, including escalation and failures. Clarify which threshold selections occur on development data; selecting a favorable threshold after looking at test errors invalidates the intended comparison.

A confidence interval must use independent cases or customer groups as its sampling unit. Repeating model calls measures repeatability conditional on those examples, not new task diversity. This distinction can fit in one sentence and is a more useful methodological lesson than importing any Jev result.

## Priority 4: refine the pipeline's promise

The partitioning advice is strong. Add cross-partition duplicate checks and a temporal holdout when deployment must handle future language or policy changes. Keep related conversations and derived paraphrases together. Preserve raw examples, turn order, group identifiers, and partition membership; describe transformations separately.

Do not promise that training preserves the “exact shape” of a dataset: the term has no defined meaning here, and no implementation was supplied. A training illustration should depict a proposed application development process with a clear optional adaptation step, validation-based threshold selection, and an untouched test set. Monitoring feedback should return to a future development batch, never silently enter the locked test benchmark.

## Priority 5: improve narrative density

The repeated caveats are justified but could be consolidated into one concise disclosure near the beginning, with local qualifications only where the reader could otherwise infer a documented interface or measured result. Use the worked trace to replace part of the abstract advice. Retain the failure-diagnosis paragraph because it explains what decomposition buys the engineering team.

The prose is already fluent. Avoid adding extra slogans, a forced em-dash, or more section-ending injunctions. The final paragraph can answer what evidence would justify expanding beyond the first decision, using the evaluation criteria introduced earlier.

## Intentional exclusions

- Do not transplant the source's litigation workflow, numerical speed claims, or TypeSafe integration details; an original service case better supports the Salesforce architecture.
- Do not force gait symmetry, health conditions, notebooks, or JEPA into this article. No relevant data or study was supplied, and those instructions conflict with the stated blog topic. Preserve their intent through careful experimental design and honest treatment of failures.
- Do not expand the blog into a complete authorization, retry, or deployment handbook. One action-boundary example can establish the principle; implementation detail belongs in a separate technical follow-up.
- Do not claim completed training, deployment, or evaluation. The current evidence supports an architectural proposal and validation protocol.
