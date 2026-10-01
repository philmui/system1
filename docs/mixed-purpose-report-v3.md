# Mixed-purpose report: catalogue v3

The current report example demonstrates a runtime policy exception. Its primary
function can confidently be a report while its proposed milestone terms still need
interpretation and review. It does not promise that a live model will be uncertain.

[The new fictional source](../data/education-examples/mixed-purpose-report-v3.md)
contains delivery measurements, test status and cost forecasts, carried in an email
that proposes changing a billing milestone. The recipient must confirm acceptance;
the original milestone remains in force until then. These are ordinary business
terms, without instructions to the classifier.

The existing `mixed_purpose` policy matches email structure, agreement language,
and proposal or confirmation language. That policy is unchanged and applies to
ordinary uploads too. It is a text heuristic, not a legal determination or a test
of whether an agreement is enforceable.

| Evidence | Meaning |
| --- | --- |
| Live System 1 judgment | The actual category, confidence and probabilities returned by the selected bounded provider. Nothing overwrites that signal. |
| Prepared replay | An explicitly simulated report judgment at 0.96, tied to this synthetic file's name and content hash. |
| Runtime route | Interpretation and review because the actual text guard matches; the same result follows for a valid report judgment at confidence 1.0. |
| Prepared interpretation | A report proposal based on the dominant progress-report content; it remains subject to scripted review in the prepared replay. |
| Authored reference | Report, a teaching reference based on the dominant content. Agreement with this one label is not benchmark accuracy. |

Changing only the threshold does not release this guarded document: the text rule
precedes the threshold check. In Experiment, explicitly disabling the guard makes
the fixed 0.96 signal accepted at thresholds up to and including 0.96. A greater
threshold selects interpretation through the uncertainty rule instead. Acceptance
with the guard disabled is counted as a violation of the lesson's default review
policy even though its report category agrees with the authored reference.

The original
[invoice-or-progress worksheet](../data/classification-examples/lesson-invoice-or-progress-report.md)
and its original fixture manifest remain unchanged. It says that it is not a
payment request and has no email/proposed-agreement combination. A confident report
judgment can validly take its direct route. The historical 0.58 invoice judgment
remains a prepared illustration of threshold-based escalation, not a prediction of
what a live model must return.

The former entry recording is preserved in
[the v2 catalogue](../data/education-examples/recordings/disaggregated-lessons-v2.json).
The current bundle is `disaggregated-lessons-v3`, with new versioned document IDs,
content hash and newly executed fixture events. No operational run or original
recording is rewritten. The offline recorder archives a prior catalogue version
before replacing the current bundle and refuses to overwrite a conflicting archive.

Backend tests cover the real provider adapter with a mocked report-at-1.0 response,
the runtime's resulting guard branch, the same policy for a nonsynthetic uploaded
copy, unchanged plain-report behavior, content-hash rejection, threshold precedence,
and archive preservation. Those adapter tests use mocked SDK responses and do not
constitute a new live-provider measurement.
