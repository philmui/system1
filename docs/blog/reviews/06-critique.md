# Version 06: release claims and final compression

Reviewed `06-building-prod.md` against the retained critiques and the user's revised theme. Disaggregated intelligence now organizes the article. The component table, conditional savings argument, controlled-pilot requirement, and dropped-outage diagnosis support that theme. The draft appropriately separates a proposed architecture from documented interfaces and measured results. Confidence, human fallback cost, and optional adaptation are handled without importing TypeSafe guarantees.

Three bounded corrections remain before version 07.

## 1. Align the cost label with the accounting boundary

“Mean total cost per attempted case” is not yet fully defined. The listed expenditures cover operating work, while annotation, adaptation, integration, and ongoing maintenance are absent. Costs are also counted only through the service window, although unresolved cases can carry later review or remediation obligations.

Choose one coherent claim. For a pilot, report **mean observed operating cost per incoming case over the declared window**, disclose fixed development and maintenance investment separately, and retain unresolved obligations in the report. A total-cost claim additionally needs an explicit allocation of those fixed costs over a stated volume and horizon, plus a consistent treatment of follow-up work. Either choice preserves the economic argument; silently mixing the two does not.

Count each incoming case once. Retries, repeated conversations about the same case, and escalation add to its cost; they do not create cheap extra units in the denominator. Use consistent labor rates and accounting boundaries across arms. The existing resolution and coverage measures should remain beside cost.

## 2. State the release bounds precisely and preserve a causal pilot

The joint comparison is appropriate, but “bounds supporting both criteria” is less precise than the earlier critique's rule. Use one direct sentence: the upper uncertainty bound on the increase in case-failure rate must stay below the declared margin, and the lower bound on cost saving must exceed the minimum worthwhile gain. Equality at either boundary has not cleared that rule. The null should include loss at or above its margin **or** saving at or below its target.

“Assign comparable traffic” also leaves selection bias possible. Specify randomized assignment at a case or account-group unit that keeps treatment consistent, with comparable offered workload and the same observation horizon. Keep analysis clustered at that unit. Offline paired snapshots remain a separate component experiment; they cannot supply the human-work or customer-outcome estimates required for the complete economic claim.

## 3. Keep the consequential-error comparison independent of routing

Cases “reaching the relevant action opportunity” may differ because the candidate changes their routes. Predefine the relevant evaluation cohort from independently reviewed case evidence, rather than from whether a particular arm actually reached its transaction branch. Report harmful events across all incoming cases as well as within that cohort. Otherwise, a conditional error rate can change with the selection of cases being evaluated.

No new numerical safety target is needed; preserve the declared separate gate and the rule that insufficient evidence cannot clear it.

## Two worthwhile compression edits

1. The allocation table, architecture figure, and paragraph immediately afterward repeat the same division of work. Keep the table and figure; shorten that paragraph to introduce scoring, endpointing, and noul in the service example, retaining the single necessary Noul-interface qualification.
2. The training caption and following paragraphs repeat snapshot preservation and freezing. Let the caption carry the sequence. Keep prose for decision-time leakage, grouping and provenance, optional adaptation, and separate development-only calibration/threshold selection. Remove repeated descriptions of what each partition does.

## Remaining claim boundary

No substantial unresolved product claim requires a new section or more caveats. The remaining issue is precision: a bounded pilot can support its declared operating-cost comparison, while a broader total-cost claim requires the additional accounting described above. The article should continue to claim neither measured savings nor completed training. No further architecture or vector changes are necessary.
