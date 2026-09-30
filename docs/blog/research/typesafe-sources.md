# TypeSafe source research for the Salesforce blog

Reviewed on September 28, 2026. These are primary vendor sources, which establish what TypeSafe documents and claims; they do not independently establish measured performance in a Salesforce deployment. All six requested pages were read. The final requested page initially failed direct retrieval but loaded through the official Confidence page's navigation link at the same URL.

## The six requested references

### Composable AI manifesto

[TypeSafe's manifesto](https://typesafe.ai/manifesto) argues for embedding semantic decisions inside conventional software, with inspectable components that can be tested and constrained individually. Its neuro-symbolic framing combines learned interpretation with explicit program logic. Its proposed economic outcomes are aspirations, not supporting evidence for production performance.

Editorial use: acknowledge this intellectual lineage, then explain the Salesforce division of responsibilities. Avoid copying the manifesto's slogan, automotive analogy, or broad claims about economic transformation. The useful engineering question is how an uncertain interpretation becomes a controlled business action.

### Quick start

[The quick start](https://docs.typesafe.ai/introduction/quickstart) supplies an HTTP and Python interface in which a shared `state` is evaluated against a map of typed questions. Its worked support example combines categorical routing, a rubric-based score, and a binary proposition. Choice and Score return distributions and confidence; Noul returns a probability-valued answer. These are Jev interfaces, not documented `koa-action` interfaces.

Editorial use: a Salesforce article can introduce the same categories of decisions using the user's `koa-action` definition. Any new JSON envelope or Python wrapper must be labeled an illustrative application contract, not a Salesforce SDK or production endpoint.

### Confidence-gated routing

[The routing pattern](https://docs.typesafe.ai/patterns/confidence-routing) uses different confidence thresholds for different consequences, with uncertain cases directed to support or confirmation. Its banking example illustrates control-flow choices; its sample numbers are not universally valid operating points.

Editorial use: show a proposed service workflow that validates interpretation before invoking an authorized action. Select gates against labeled validation data and the cost of mistakes. A confident intent prediction cannot establish identity, access rights, policy eligibility, or permission to perform a transaction.

### Intent routing

[The intent-routing pattern](https://docs.typesafe.ai/patterns/intent-routing) directs requests to ordinary code, a specialist language model, or a human. Its example consults a second, separately uncertain complexity estimate when handling complaints. A database lookup can answer an order-status request without an additional language-model call.

Editorial use: describe several possible handlers without suggesting the classifier itself owns the workflow. The Agent Graph description should explain which runtime transitions follow from model outputs and which transitions depend on explicit business rules. Unrecognized, ambiguous, and multiple-intent requests need defined handling.

### Structured instructions and criteria

[Advanced: structure](https://docs.typesafe.ai/primitives/advanced) permits JSON objects and arrays in question instructions and criteria. It describes explicit category boundaries and sequential traversal of a taxonomy. Close alternatives can motivate exploration of more than one branch; large subtrees may require reducing the supplied context.

Editorial use: make decision definitions versioned artifacts with concrete positive and negative examples. Explain hierarchy traversal as a sequence of application choices. Do not imply the Salesforce interface accepts the same types or implements the same tree-search behavior without separate documentation.

### How to build with TypeSafe

[The construction guide](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) recommends narrow questions over relevant context, explicit control flow, and combining individual outputs in application code. It discusses batching independent questions, composing numerical outputs with rules or a downstream learned model, and checking confidence against correctness on local data.

It also claims approximately 100 ms for most queries, calibrated probabilities, stable repeated answers, and independent parallel evaluation. Those are vendor-specific claims. Its greater-than-100-fold intelligence-to-speed-and-cost ratio is explicitly a target. None should become a measured `koa-action` property through a name substitution.

Editorial use: structure the blog around task decomposition and observable decisions, with an original Salesforce service example. Explain that separate questions can still make correlated errors because they share inputs or model weaknesses.

## Additional primary sources used to resolve technical ambiguities

### Confidence and calibration differ

[TypeSafe's Confidence documentation](https://docs.typesafe.ai/confidence) defines Choice and Score confidence as a statistic calculated from how their probability distributions are spread. Concentration can be useful for routing, but does not by itself demonstrate accuracy. Noul has no separate confidence field. The page advises testing thresholds on the application's own data.

[The AI primer](https://docs.typesafe.ai/introduction/machine-learning-primer) describes TypeSafe's reinforcement learning for calibrated decisions, abbreviated RLCD. Its calibration explanation concerns frequencies across groups of predictions and explicitly disclaims an individual-answer guarantee. The page provides no reproducible training corpus, split manifest, or enterprise-domain calibration study.

Writing rule: distinguish a returned score, a vendor's training objective, and calibration measured on the deployment distribution. If discussing `koa-action`, no supplied TypeSafe source establishes that it uses RLCD, has a particular probability interface, or is calibrated in the target domain.

### Noul is a binary proposition, not a severity scale

[The Noul reference](https://docs.typesafe.ai/primitives/noul) defines its output as the probability of a yes answer. A middle value can represent uncertainty about the proposition; it does not establish a middling degree of a property such as urgency. Compound predicates obscure the source of error, so separate judgments can make diagnosis easier. Production thresholds depend on asymmetric error costs.

Editorial use: gloss the term once as a probability-valued yes/no judgment. Use a rubric-based score for intensity. Define the proposed `koa-action` contract explicitly rather than borrowing Jev's exact output schema.

### Choice and Score need defined semantics

[The Choice reference](https://docs.typesafe.ai/primitives/choice) recommends an outside-category answer when a taxonomy may be incomplete. It distinguishes the most likely option from the distribution and its confidence summary. Its current maximum of 255 options and its performance comments describe TypeSafe only.

[The Score reference](https://docs.typesafe.ai/primitives/score) returns the probability-weighted mean of numbered rubric levels. Different distributions can produce the same mean. It explicitly notes that concentration on one level does not guarantee correctness. Its guidance favors independently interpretable level descriptions over unexplained numbers.

Editorial use: avoid presenting an averaged rubric score as a physical measurement or an empirical probability of success. Preserve distributions when diagnostically useful. If multiple dimensions are combined, document the weighting and evaluate the resulting decision separately.

## Proposed Salesforce methodology: original recommendations, not source findings

The following design extends the compositional pattern into a testable proposal. It is not an account of an experiment that has been run, and it does not describe undisclosed Salesforce foundation-model training.

### Define the hypothesis and comparisons

For a bounded service task, compare a reasoning-model baseline against an architecture that adds a `koa-action` decision stage while keeping tools, permissions, and business policies fixed. Predefine whether the question concerns latency, total cost, completed tasks, or an explicit joint criterion. A meaningful claim of faster operation with preserved quality requires both a latency benefit and an independently specified quality requirement; failure to find a statistically significant difference does not establish equivalence.

Use a paired evaluation on the same held-out cases. An explicit quality margin, estimated sample size, and uncertainty interval are stronger than an unqualified “same accuracy.” Keep tool failures, retries, clarifications, human handling, and uncompleted cases in end-to-end accounting. Report automatic coverage alongside error among automatically handled requests, so a system cannot appear better merely by escalating difficult cases.

### Preserve the records and split by the unit of dependence

Freeze a versioned source snapshot before changing questions or generating examples. Preserve message order, timestamps, customer-case relationships, and recorded missingness. Record deterministic transformations; do not promise that redaction or cleaning leaves the dataset's exact distribution unchanged.

Assign related conversations, duplicated cases, and derived variants together. Choose customer or account grouping when that reflects the generalization question; a later-time test serves a different question and needs an explicit temporal boundary. Deduplicate across split boundaries and generate augmented or teacher-labeled training examples only after the split. Future outcomes must not enter a model's earlier decision context.

### Separate fitting, calibration, and final evaluation

Use training data for any permitted task adaptation and for fitting downstream combiners. A separate validation partition supports question revision, threshold selection, and probability calibration. Cross-fitting within development data may be needed when downstream models consume predictions from learned upstream components. Freeze all model, rubric, threshold, and policy versions before running the locked test.

The supplied sources do not disclose how `koa-action` is trained or whether users can fine-tune it. A diagram should therefore identify its training box conditionally: task adaptation where supported, or fitting an application-level decision component. Keep validation and test paths visibly separate from fitting. If the figure instead depicts a proposed model-training process, label it as such.

### Evaluate the parts and the final workflow

Measure each semantic decision against independently adjudicated labels, then inspect the resulting graph traces for required action ordering and termination. A valid JSON object does not establish a correct classification, and a correct classification does not establish an authorized action. Record disagreements between rubric judgments and human labels before using a model as an evaluator.

For semantic endpointing, use the information available at each actual decision time. Measure premature cutoffs and delay after a true end of turn separately. Keep all prefixes of a source conversation in one partition. Full future transcripts must not leak into the context used to decide whether the user had finished speaking.

### Show failures without inventing results

Useful illustrative cases include an ambiguous refund request that triggers clarification, a confidently misclassified request detected by independent evaluation, a policy-ineligible transaction stopped by an explicit check, and a model-service timeout routed to a defined fallback. Label these as constructed examples. Do not fabricate percentage improvements, traces, plots, or completed experiments.

Production observations can feed a later, reviewed training-data version. They should not create an arrow back into the current locked test. After substantial tuning against observed failures, reserve new untouched cases for the next reported result.

## Claims to block in adversarial review

- Transferring Jev latency, cost, training, batching, schema, or calibration claims to `koa-action`.
- Describing confidence concentration as the probability an entire action will succeed.
- Treating a risk-sensitive threshold as sufficient authorization for a business operation.
- Implying independent question execution makes errors statistically independent.
- Reporting preserved dataset geometry, gait findings, JEPA experiments, or numbered notebooks without supplied evidence. Those topics do not belong in this Salesforce service-workflow article.
- Depicting raw transcripts flowing directly into production training without review, versioning, and separated evaluation.
- Presenting illustrative Salesforce code as a verified SDK or assuming Agent Graph is API-compatible with LangGraph.
- Turning a proposed evaluation design into a claim that a production deployment was measured.
