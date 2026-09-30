# Independent critique of version 03

Reviewed `03-building-prod.md`, the version 01 and 02 critiques, the actual version 01 Codex adversarial finding, and the updated pipeline SVG and rendered PNG. This is a specialist statistical and workflow review, distinct from a plugin execution.

Version 03 resolves the earlier consequential issues. The next-route label matches the contract; decision-time inputs exclude later events; the authorization boundary and `available when` distinction are explicit. The pipeline now says inputs stop at decision time and keeps test data outside every fitting path. Calibration and threshold selection use separate development folds. The prose correctly avoids treating a nonsignificant quality difference as evidence of equivalence.

The four changes below are the remaining useful revisions. They should replace or tighten existing passages rather than add a methods appendix to the blog.

## 1. Name the comparison and align the null with its operational target

Lines 64–70 declare an error margin and an operational target, but neither the error denominator nor the latency clock is selected. The null then requires any latency reduction, which can be weaker than the target announced in its first sentence.

Specify a routing error per incoming request and a clearly timed routing comparison, then distinguish those from case-level completion and service latency. For service outcomes, keep every requested task in scope and count cases unresolved at the declared window; do not calculate latency solely from successful completions. Choose the latency summary and minimum useful gain before testing. The release rule should require an upper bound on quality loss below the margin and evidence that the chosen operational gain clears its own target.

One compact clarification is sufficient: the offline router experiment compares next-route accuracy and decision time on the same inputs; end-to-end service claims require comparable workflow trials, with simulation labeled when used. A recorded conversation does not supply a real elapsed outcome for a counterfactual route. Keep “at or above the margin” explicit in the null, and replace “does not reduce handling latency” with “does not achieve the declared latency improvement.”

## 2. Give rare consequential errors an explicit gate

“Taking rare consequential errors into account” at line 70 leaves their role ambiguous. An acceptable aggregate routing error rate could coexist with worse behavior on a small group of consequential requests.

Predeclare a separate acceptance condition for the harmful outcome that matters in this example, using all relevant action opportunities as its denominator rather than only successful executions. Keep coverage and case-level outcomes alongside it. If too few relevant examples exist to bound that risk, report insufficient evidence; observing zero such failures does not establish zero risk.

This can be one sentence in the release paragraph. Do not add invented numerical limits, a catalog of harms, or a statistical derivation.

## 3. Bound clarification and distinguish handoff from resolution

The contract refers to a bounded fallback, but the worked trace can still keep asking for priorities or waiting for confirmation indefinitely. At line 28, a “defined handoff closes the billing task” also risks counting transfer of responsibility as customer resolution.

Give clarification a limit or deadline that leads to a recorded, accepted handoff. Preserve the pending outage task in that handoff. Distinguish terminal statuses such as resolved, handed off, and unresolved at the service window. Automation can stop at a valid handoff without claiming the underlying problem is solved.

A sentence in the trace can demonstrate both termination and task preservation. The evaluation paragraph can then refer to those named outcomes without expanding into a retry handbook.

## 4. Make production feedback informative rather than self-confirming

The final section says a wrong route reveals a taxonomy or training-example gap. That diagnosis is too narrow: stale context, an obsolete policy, or an incorrect transition can produce the same observed failure. It also leaves the source of future labels unspecified.

Sample both automatically handled requests and escalated requests for independent review, so confident errors do not disappear from the next dataset. Review decision-time evidence against the rubric; do not promote the previous model's route or an unexamined case-closure flag into the reference answer. Use the trace to decide whether the model, context, policy, or workflow needs revision, and add adjudicated examples only to a future dataset version.

Replacing the current misroute sentence with two connected sentences would make the improvement cycle concrete without adding another warning section.

## Keep unchanged

The confidence discussion correctly treats distribution concentration as an imperfect routing signal, conditional on an actual integration exposing it. No extra calibration terminology is needed. Keep the constructed examples explicitly illustrative, the original mixed billing/outage case, and the absence of Jev benchmarks or undocumented `koa-action` interfaces.

The pastel figure is readable, the data and artifact arrows are distinguishable, and its accessible description captures the decision-time boundary. No further visual changes are needed for version 04.
