# Independent critique of version 02

Reviewed `02-building-prod.md` against the previous editorial critique. The draft now follows the mixed request through a coherent branch, gives an inspectable proposed contract, separates confidence from proposition probability, and introduces a meaningful comparison. The proposed interfaces are labeled appropriately; repeating objections about missing SDK evidence would not improve version 03.

Four remaining changes would improve the article without turning it into an implementation handbook.

## 1. Train and evaluate the information available at the decision

The dataset paragraph says to label “requested intent,” while the worked example defines the target as the next handling route. Align these. Reviewers should label the route justified by the evidence available at that particular decision, including `mixed` and `unclear` when appropriate.

More importantly, a stored service conversation can contain future clarification, the final resolution, and an agent's later notes. Including those in an intake example leaks the answer even when the train/test split is perfect. Add one clear sentence: construct each example from a timestamped snapshot of what the routing step could access at that moment, and exclude later turns and outcomes from its input. Those later records may support reference labeling, with that distinction documented.

This closes a consequential causal gap and makes the training protocol specific to agent workflows.

## 2. Give task completion an explicit meaning

The trace is much stronger, but “once billing is resolved” currently hides another semantic decision. A generated explanation does not by itself establish that the billing request is complete. Define an appropriate completion condition for this illustrative workflow, such as a recorded customer confirmation or a completed service action under the task's configured rules.

Keep the outage pending until that condition is met, or until the customer explicitly changes priorities. Also assess whether both requests were handled. This prevents an apparently fast workflow from receiving credit for explaining the invoice and silently losing the outage—the concrete failure that motivated the opening.

One sentence in the worked trace and one evaluation criterion are sufficient.

## 3. Make preservation and leakage controls visible in the pipeline

The conversation-level partition is good. Add deduplication or near-duplicate grouping before partition assignment, and ensure derived phrasings inherit their original example's partition. Preserve turn order, source identifiers, and the partition manifest so the team can reconstruct a decision snapshot without claiming unchanged tensor dimensions or an undocumented model training recipe.

For a service workflow expected to operate through changing policies and vocabulary, reserve later cases as a temporal evaluation slice. State that thresholds and prompts are frozen before opening that slice. Monitoring feedback belongs in the next development cycle; it should not silently modify a benchmark already being used to compare releases.

These controls can sit in the figure caption or its immediately preceding paragraph, avoiding a long procedural list.

## 4. State what evidence clears the release decision

The revised null is directionally sound. Its quality boundary should include equality: a candidate at or beyond the maximum acceptable degradation has not cleared a strict noninferiority requirement. More readable blog prose would say that the uncertainty bound for increased harmful errors must remain below the declared margin, while a separate bound establishes the required operational gain.

Choose the quality measures before testing. Overall routing accuracy can hide a rare but consequential error, and accuracy among automatically routed cases can look better simply because the workflow escalates almost everything. Report harmful routing errors together with coverage and completion of all requested tasks. Keep the paired comparison on the same independent case groups, as version 02 already proposes.

The article does not need equations, power calculations, invented numerical margins, or results that do not exist. It needs a clear decision rule so readers can distinguish evidence of sufficient quality from an inconclusive test.

## Deliberately retain

Retain the concise disclosure, the AgentScript action-availability distinction, and the authorization boundary. Retain the original Salesforce service example and omit imported Jev benchmarks. Avoid adding gait, JEPA, or imagined notebooks; rigorous decision-time evaluation honors the methodological intent without departing from the requested blog topic.
