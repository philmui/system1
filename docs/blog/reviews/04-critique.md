# Editorial critique of version 04

Reviewed `04-building-prod.md` against the retained version 01–02 critiques and the Codex adversarial finding on decision-time leakage. Version 04 addresses the substantive concerns: the contract and workflow are concrete, task resolution differs from handoff, decision inputs exclude future information, and component replay is separated from a service pilot. It also avoids borrowed performance evidence and unsupported API claims.

The next revision should improve focus rather than add methodological requirements. The article's second half currently reads more like a validation protocol than a technical blog. Four edits can restore the customer-service argument while retaining the controls that make it credible.

## 1. Introduce one question that the whole article answers

State the practical hypothesis immediately after introducing the three technologies: can a specialized intake decision shorten the time to completed service while preserving all customer requests within the accepted error limit? The graph example explains how the design could work; the dataset and evaluation sections explain how the team would test it.

Keep next-route selection as the single primary experiment. Scoring, noul, and semantic endpointing establish the broader role of `koa-action`, but they should not appear to create three additional studies. Briefly tie them to adjacent moments in this same service journey, then make clear that this article evaluates routing. The endpointing example is useful for explaining future-information leakage; its separate metric prescriptions are optional here.

The formal release criterion already expresses one joint requirement: acceptable quality and a worthwhile latency gain. Preserve that criterion, and let the ending return to the opening's unresolved invoice and outage instead of a generic recommendation to start small.

## 2. Compress repeated explanations, preserving the actual controls

Reduce the training and evaluation prose by roughly one quarter. Coverage, confidence calibration, and repeatability are explained in multiple locations. Explain each once, where the reader needs it. For example, keep confidence validation and the coverage/error tradeoff in the evaluation section, leaving production discussion to monitoring and diagnosed changes.

The essentials to retain are decision-time snapshots, grouping of related examples before partitioning, recorded transformations, a frozen test, development-only calibration and gate selection, and uncertainty estimated over independent cases. The illustration and caption can carry the overall sequence; the prose should explain the two easiest mistakes to miss: future turns leaking into an earlier decision and repeated calls being mistaken for independent cases.

Retain the distinction between offline replay and live workflow measurement. A short paragraph for each will be more effective than interleaving experimental controls, outcome definitions, and every reporting choice. Detailed sample-size and confidence-procedure requirements can be expressed in one sentence rather than expanded into a statistical tutorial.

## 3. Replace the generic outcomes with one diagnostic failure

The current three illustrative outcomes restate earlier points. Use a concrete failure that shows why these components are separated. For example: the model returns `mixed`; the invoice explanation is sent; a completion transition closes the whole case and drops the pending outage. The customer's next message exposes the omission.

Walk through the trace: the decision was appropriate, but the configured completion condition was too broad. Correct the transition and replay the case to check that the outage remains pending. Because the model already supplied the needed routing result, the first corrective action belongs in the workflow configuration. Label the vignette as hypothetical.

This develops a useful causal story from failure to diagnosis to verification. It also supports the existing caution that production errors should become training examples only after review, without repeating that caution abstractly.

## 4. Make the successful trace easier to read

The service-flow paragraph now carries account access, model explanation, resolution criteria, queue acceptance, reprioritization, and incomplete-task reporting at once. Preserve the main sequence: mixed result, customer chooses billing, verified lookup, explanation, recorded completion, return to outage. Move the handoff distinction to the evaluation paragraph where it determines whether the service outcome counts as complete.

Retain one compact explanation of AgentScript's three consequential controls: model action availability, mandatory programmed steps, and authorization in the service that performs the transaction. Avoid surrounding these with repeated declarations about what an available action or model confidence cannot guarantee. The concrete credit example already provides the necessary evidence.

## What to preserve or omit deliberately

Preserve the proposed-integration disclosure, direct source links, trusted account-state boundary, and optional adaptation path in the pipeline. Preserve both favorable and failed illustrative behavior. Omit added benchmarks, invented results, a larger taxonomy, and a full deployment handbook. The revision should be more compelling because the reader can follow the question and its test, without increasing the strength of the claims.
