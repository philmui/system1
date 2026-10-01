# Component latency and reference checks: implementation and review

Reviewed September 29, 2026. This record covers the numerical reports added to Explore, the live classification comparison, and the Review & redact preview. It separates executed automated checks from source inspection and checks that remain unexecuted.

The later [workflow presentation and live measurement review](workflow-glass-review.md) supersedes the entry controls described here: main classification runs live System 1 on prepared documents through one **Run workflow** action, with three frontier choices. Historical interpretation-only receipts retain their original scope.

## What the reports measure

The shared [performance report](../frontend/src/components/PerformanceReport.tsx) shows elapsed time, reference agreement, and the current output state, followed by component rows. Each row exposes its source and quality criteria through Evidence. A successful request, matching reference, or valid schema does not imply approval or publication.

| Experience | Elapsed-time boundary | Reference check | What remains unavailable |
| --- | --- | --- | --- |
| One live interpretation | Server preview to the returned proposal; actual frontier API round trip shown separately. | Returned category against one authored document category. The prepared System 1 category has its own explicitly prepared check. | Live System 1 performance, human approval, publication, full workflow time, and production accuracy. |
| Two live classification strategies | Each strategy from a shared trial start to an accepted category or unapproved proposal; the complete trial has its own measured wall time. | Initial judgment and final preview output each checked against the same authored category. They are not two independent samples. | Human turnaround, publication, final published accuracy, and a general latency or accuracy benchmark. |
| Find & Compare | Returned Discovery run start to terminal event, separately from intent, policy, planning, retrieval, screening, composition, citation validation, and support service work. Source preparation is excluded. | Intent against one authored task label; draft claims passing exact citation checks are counted separately. | Independent retrieval, plan, relevance, support, and final-answer accuracy. Citation integrity does not establish those qualities. |
| One Review & redact action | Handler entry to response construction, with source checks, provider round trip, code validation, and reference evaluation separately timed. | Classification: three authored yes/no/uncertain labels. Redaction: complete removal of authored source-span occurrences. | End-to-end legal review, attorney approval, release quality, unlisted PII detection, and production accuracy. |

Provider round trips include network and response parsing. Queue wait is disclosed separately and excluded from provider service bars. Strategy elapsed includes queue wait and runtime work. Parallel strategy durations are never added to invent trial wall time. Review classification and redaction buttons start separate actions; their durations are not added to imply a completed review workflow.

Prepared System 1 signals have no live latency bar. Their fixture execution delays are not displayed as provider performance. Scripted approval is not a measured human response. The existing strategy illustration retains explicitly assumed timing; it remains distinct from actions that make actual provider requests.

In Explore, **Compare latency & quality → Measure both strategies** explicitly starts the paired classification trial. **Prepared journey** identifies the separate recording; switching back never replaces its decisions with the measured trial. Find & Compare's **Run … · measure all steps** actions request live Jev judgments as well as any frontier work selected by policy. The prepared examples remain available without keys or paid requests. These actions require provider keys from the server environment or `.env`; the browser receives no credentials.

Accuracy is not formed by averaging unrelated checks or multiplying confidence scores. Classification shows the final preview's agreement with its authored category alongside the initial judgment's agreement. Discovery leaves final answer accuracy unevaluated without an independent evaluation set. Review shows authored label agreement or target-span coverage; human approval and final release are separate, unmeasured outcomes.

## Review & redact contracts

[The live review endpoint](../src/doc_discovery/review_lessons.py) accepts a fixed fictional page ID, its exact content hash, and either `classify` or `redact`. It uses the production OpenAI adapter and returns the actual response. Missing configuration, timeout, schema failure, or invalid redaction produces an error; no prepared answer is substituted. The shared admission boundary enforces allowed origins and limits simultaneous lesson calls. Opening a page does not start a paid request.

The [versioned review corpus](../data/education-examples/review-pages-v1.json) retains six readable fictional pages. Reference version `review-references-v1` adds four explicit PII targets to the Cutoff approvals page: the person’s full name, email address, phone number, and employee identifier. These are authored teaching references, not a held-out production evaluation.

Classification compares the actual three returned answers with the authored labels, including `uncertain`. The report shows `n / 3` and makes mismatches inspectable. Redaction counts every authored source occurrence separately. Deleting only part of a name earns no complete-removal credit. Extra removal outside the target spans is counted separately and remains a caution even when all authored targets were removed.

Exact rewrite validation requires unique, nonempty, nonoverlapping source spans and reconstructs the expected draft from original source ranges. Every other character must remain unchanged. This establishes replacement integrity only; it does not certify PII completeness or legal sufficiency. Every successful preview remains `requires_review: true`, `published: false`, and `operational_writes: 0`.

The response’s optional metrics preserve compatibility with earlier previews. Missing action elapsed, code timing, or reference results stay unavailable. The [review report adapter](../frontend/src/lib/reviewPerformance.ts) does not infer those values from current fixture labels or model confidence.

## Independent review findings and corrections

| Finding | Evidence and impact | Correction and verification |
| --- | --- | --- |
| **P1: overlapping removal spans could receive false full-target credit.** | An independent reviewer reproduced `Jordan` plus `dan Lee` producing a partially retained name while unioned source positions appeared to cover the complete name. | Reject overlapping original source occurrences before draft acceptance. Reconstruct replacements from disjoint ranges. Tests cover this exact overlap, partial names, repeated occurrences, complete removal, and extra removal. |
| **P2: classification’s pending paid-action button relied only on an external disabled prop.** | Source inspection and an SSR test with `status: pending` and `disabled: false` reproduced an enabled button. The request hook prevented duplicate calls, but the control communicated the wrong state. | Disable the button whenever either condition applies. The live interpretation retry also honors an outstanding request. SSR checks cover pending, failed/retry, and detached-request states. |
| **Usability: full reference evidence crowded the primary Review summary.** | Source inspection found every target and expected/observed value concatenated into the summary card. | Keep the summary to the count, scope, and extra-removal count. Preserve full criteria, mismatches, and reference version in component Evidence. |
| **Usability: returning from a real trial could make the old graph look like the measured execution.** | The live Jev result can differ from the recording's prepared signal. | Label the local view **Prepared journey**, or **Live interpretation** when that distinct preview is active. Keep each result's scope visible. |
| **Usability: pending Find appeared to promise a direct route before live intent returned.** | Actual live intent can select frontier planning. | Pending UI shows **Judge intent → Runtime selects next work**. Only returned events draw the actual selected route. |

The classification report review also checked unfavorable results: a slower System 1 strategy remains visibly slower; negative frontier-call savings remain negative; a failed strategy retains its failed attempt duration and prevents a complete-trial advantage claim. No winning strategy is assumed.

## Executed verification

The commands below were executed after these changes:

```bash
.venv/bin/pytest -q tests/test_live_review.py tests/test_live_review_boundary.py tests/test_classification_measurements.py
npm run test:unit --prefix frontend -- performance-report.spec.ts live-lessons.spec.ts live-review.spec.ts
npm run typecheck --prefix frontend
npm run lint --prefix frontend
```

- **43 backend tests passed.** These use mocked provider SDK responses while exercising the real adapters and API boundaries. They verify fixed-source binding, shared-start and queue accounting, actual-response propagation, invalid responses, failed attempts, no fallback, safe errors, review requirements, and no operational writes.
- **24 frontend unit/SSR tests passed.** Eleven new cases in [performance-report.spec.ts](../frontend/tests/performance-report.spec.ts) cover invalid or missing reference denominators, queue/service/overall separation, genuine measured Judge bars, prepared Judge suppression, historical missing metrics, inspectable mismatches, failed and slower trials, negative call savings, shared bar scaling, and disabled paid actions. The companion suites verify the live overlays and review reports.
- **TypeScript and ESLint passed.** API response fixtures now include complete policy evidence rather than relying on an incomplete cast.

The component tests render current React markup and inspect numerical values, evidence, semantics, and disabled states. They do not establish that the rendered layout fits every viewport, that keyboard focus behaves correctly in a browser, or that the animation feels smooth.

## Remaining verification limits

No successful real provider request was executed for this review. The test timings are synthetic inputs or elapsed time around mocked SDK calls; they are verification evidence, not Jev or GPT-5.5 performance measurements. A configured local environment must run the explicit paid actions to obtain actual samples. One sample still cannot establish general latency, cost, or accuracy gains.

Browser-based responsive inspection, interactive keyboard checks, 200% zoom, reduced motion, and current screenshots remain unverified in this restricted environment. Earlier service/Chromium restrictions have not been bypassed. No unfamiliar human participated in a comprehension study. The prior interface’s screenshots or reviews do not count as visual approval of these numerical reports.

Full integration results and any later executed browser or live-provider checks should be appended here with their actual scope and provenance.

## Final integration check

The final full suites passed **180 backend tests** and **134 frontend unit/SSR tests**. Ruff, frontend typecheck, lint, schema generation (62 public models), production build, and `git diff --check` passed. Documentation checks validated 743 local Markdown links, 14 sample files and spans, and five accessible SVG exports. The six Discovery metric tests include a live Judge timeout: failed live requests retain recorded attempt time, explicitly distinguished from a successful provider response; missing timing remains unavailable.

Independent Codex adversarial review of these actual changes found no remaining material source-level issues after the corrections above. The reviewer separately ran backend API/adapter suites, frontend numerical/markup tests, and the final six-case Discovery timing suite. Source and markup inspection do not substitute for a rendered interaction review.

The current browser attempt used the isolated Playwright services and the new `performance-browser.spec.ts` plus updated live lesson checks. It stopped before executing browser tests: `error while attempting to bind on address ('127.0.0.1', 8001): [errno 1] operation not permitted`. No restriction was bypassed. Desktop and 390 px screenshots, keyboard interaction, reduced-motion behavior, light/dark inspection, and 200% zoom remain unverified for this implementation. No actual Jev or GPT-5.5 latency or benchmark accuracy was measured in this restricted environment.
