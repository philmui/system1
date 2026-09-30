# Version 08 editorial notes

The draft extends [version 07](../07-building-prod.md) with the [return architecture comparison](../../diagrams/returns-comparison.svg), [loyalty policy illustration](../../diagrams/returns-policy.svg), and [reasoning fallback illustration](../../diagrams/returns-fallback.svg). Its principal change is a continuous return example that carries the argument from motivation through allocation, execution, evaluation, and failure diagnosis. Version 07 remains unchanged; the first version 08 is preserved in [the pre-redesign archive](08-before-illustrated-redesign.md).

## Choices made

- Replaced the invoice/outage case with the return case throughout. Preserving both would require readers to reconstruct two workflows while adding little to the central comparison.
- Replaced the generic architecture figure with the new comparison and placed separate policy and fallback illustrations alongside their explanations. The training and evaluation pipeline becomes Figure 4.
- Added a compact evidence-and-authority table so readers can see what each node receives and which state it may establish. The table separates model judgments from authoritative identity, purchase, policy, and transaction facts.
- Kept backend safeguards fixed across both architectures. The wrapper panel describes one repeated frontier-decision design, without implying that frontier-based systems cannot enforce business rules.
- Explained the policy precheck before frontier reasoning. Known denial, missing facts, and model failure are distinct from residual semantic complexity.
- Used the same hypothetical Standard/Plus policy as the SVGs, including inclusive deadlines, $5/waived shipping, the original request timestamp, customer confirmation, and reconciliation of uncertain writes. The reviewer in the exception lane cannot override policy.
- Retained version 07’s whole-service economic accounting per incoming case, leakage controls, grouped partitions, frozen test artifacts, joint reliability/cost acceptance criteria, and distinction between offline model replay and a controlled service pilot.

## Evidence and claim checks

Fresh primary-source reading covered Salesforce’s AgentScript control-plane and enterprise-agent accounts, Agent Graph, the AgentScript repository, LangChain’s production and evaluation posts, and TypeSafe’s manifesto, intent routing, confidence, and Noul documentation. The retained [source ledger](../../slides/research/source-ledger.md) supplies the broader research history.

The article does not infer a native `koa-action` adapter, common Jev/`koa-action` schema, training interface, calibration field, measured performance, or exactly-once external writes. Faster routine handling and lower operating cost per incoming case remain hypotheses. The numerical merchant policy and case outcomes are labeled illustrative.

The plain-research-writing skill was applied. During the editorial pass, the training caption’s internal reference to a preceding draft was removed; the explanation of an inference-free routine path now names customer-message templates; and cancellation, no reply, and bounded frontier failure were made explicit.

An independent review by the return-workflow agent found the policy, authority separation, evaluation design, and product-claim boundaries sound. It identified two ambiguities, both corrected: missing replacement-status facts now explicitly require verification or hold before complex interpretation, and the economics retain the denominator “per incoming case” rather than “complete-case cost.” The confidence citation now attributes the distribution-concentration definition to TypeSafe and distinguishes our recommendation to validate its empirical relationship with correctness.

## Illustration redesign

The user subsequently requested substantially less text inside the graphics and a more pictorial explanation for beginners. The revised article keeps exact rules in the policy table and prose while giving each picture one role: compare the architectures, explain the loyalty outcomes, or show when difficult interpretation reaches a frontier model. It defines frontier LLM, System One, graph, state, and classification in plain language. The existing methods are retained without adding further experimental machinery.

Inspected all three replacement SVGs and their rendered PNG previews before finalizing the captions. The article explains the comparison’s clockwise checkpoints, the policy’s calendar and shipping-ticket branches, and the fallback’s question bubble, precheck clipboard, stop/pause symbols, and human reviewer. The large frontier chip and small System One switch describe their roles in the workflow, without claiming measured model-size or performance ratios. Detailed business rules remain in prose and the policy table.

## Verification

Checked the required title, four figure numbers, canonical image paths, and the absence of stale invoice/outage or gait/JEPA text. No benchmark multipliers or percentages have been introduced. The SVG captions and prose were checked against [the return workflow specification](../../diagrams/returns-workflow-spec.md), the three replacement SVGs, and their rendered previews. The methods, evaluation, and failure-diagnosis sections are unchanged from the first version 08, apart from the training figure’s new number. References to the earlier drawings’ blue boxes and repeated model capsules have been removed.

Version 07 SHA-256 at handoff: `660d5c9b3c900cf80835c026b4d86fc6f01eea1d776c306f73290e0c174db155`.

This note records the writing and source pass. The separate Codex pictorial review completed with an `approve` verdict and no material findings; its scope and the final desktop/mobile rendering checks are recorded in [verification](../verification.md).
