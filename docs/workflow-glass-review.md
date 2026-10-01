# Workflow presentation and live measurement review

Work started September 29 and continued September 30, 2026. This record supersedes the earlier classification entry controls described in the [performance report review](performance-reports-review.md). It distinguishes source and automated verification from browser and provider checks that this environment cannot execute.

## Main classification experience

The prepared examples now supply document content, not prepared model responses. **Run workflow** calls the actual System 1 Model, evaluates the authoritative runtime policy, and invokes the selected frontier model only when interpretation is required. The main classification screen has no separate model execution buttons or simulated-response replay. Historical runs and isolated safeguard recordings retain their recorded behavior and provenance.

Before execution, the graph shows a ready workflow with no judgment, selected route, provider duration, or publication. Pending time is explicitly browser waiting time. Completed component request times and overall preview elapsed time come from the response; failed attempts retain their measured intervals. A missing key or failed admission does not invent a provider attempt. The measured projection never reads fixture events to fill a gap.

The live result shows overall elapsed and request counts above the graph, component times on nodes, and **Step timing & provenance** below. Clicking a component opens and focuses its evidence. The preview stops at an accepted category or unapproved proposal; human approval, indexing, and time to searchable are outside this measurement. It does not create an operational run or publish a document.

The single-route API shares its evaluator with the paired strategy API. Both keys are checked before work because an actual bounded response can require escalation, including for an example whose prepared cue suggests a direct route. Source content hashes, policy precedence, request admission, cancellation, and no-write behavior remain enforced.

## Frontier selection

Classification, its paired comparison, Discovery, and live Review actions offer **GPT-4.1**, **GPT-5.5**, and **GPT-5.6-sol**. GPT-5.5 remains the default. The browser stores only the model preference; each request passes an allowlisted identifier to a provider built from copied settings. Selection makes no provider call and changes no backend configuration.

Changing a selection clears the previous live result, and selectors are disabled while that view has accepted work outstanding. Response metadata labels completed measurements; changing a preference cannot rename a prior response. Missing access and provider errors are surfaced without switching models or substituting fixtures. API support was checked against the official [GPT-4.1](https://developers.openai.com/api/docs/models/gpt-4.1), [GPT-5.5](https://developers.openai.com/api/docs/models/gpt-5.5), and [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol) pages. Account access was not verified here.

## Shared glass treatment and legibility

All HTML workflow cards use the shared [glass stylesheet](../frontend/src/workflow-glass.css). Review and comparison SVG cards use the equivalent [SVG frame](../frontend/src/components/WorkflowGlass.tsx). Both themes use pale role-specific fills, dark text, a restrained highlight and rim, and a clear accent on the selected route. Unused alternatives stay readable with neutral fills and dashed boundaries. Reading panels and documents retain ordinary surfaces.

The material has no continuous shimmer. Reduced transparency and increased contrast use opaque fills; forced colors use system colors. The original shared flow animation and reduced-motion behavior remain separate from the surface treatment. Independent source calculations found primary text contrast of at least 8.20:1 in dark theme and 11.50:1 in light theme, muted text at least 5.27:1 and 7.39:1, and light card boundaries at least 3.15:1 against their fills. These are token/compositing calculations, not measured screenshot pixels.

Descriptive UI text uses **System 1 Model**. Actual provider enums, qualified resource identifiers, model IDs, raw source content, and inspectable API evidence preserve their real values.

The paired classification report shows `System 1 route elapsed / frontier route elapsed × 100` alongside absolute elapsed differences. Values over 100% remain visible; incomplete or zero-denominator comparisons have no percentage. This is total preview elapsed, including queue and selected interpretation, not a Judge-only latency ratio or a percentage saving.

## Review comparison layout

The prepared Review comparison no longer reserves a second full viewport inside the learning shell. Lane headings, status rows, outer gaps, and the desktop graph height are more compact. The graphs keep their typography and geometry. Mobile lanes remain vertically scrollable, and the focus view removes surrounding lesson headings while preserving controls.

## Relative animation timing

The earlier Review traces independently compressed model waits and added identical fixed presentation delays. That made a 0.40-second and a 3.85-second modeled route finish at similar visual times. Traces now keep semantic judgment, code, and redaction work intervals at their exact scenario durations. Visual handoffs occupy portions of those intervals and add no extra time.

Both lanes advance on one modeled clock with a common linear playback scale. At default assumptions and 1× playback, the 0.40-second route reaches its result after 0.80 screen seconds and the 3.85-second route after 7.70 screen seconds: the same 9.625-to-1 ratio. Changing playback speed or selecting a lane does not alter metrics or the ratio. Longer scenario assumptions change one common scale, never a scale per model or lane. Captions distinguish modeled seconds, presentation scale, and handoffs illustrated within work time.

Request counts advance when their work starts, including during the visible provider wait. Assumed costs, decisions, and redacted text become available when their semantic work completes. Human waiting contributes no machine work, and a shared approval cannot bypass either lane's own review checkpoint. Independent review and 16 focused workflow tests cover these rules; browser animation remains unverified here.

## Why the original “Ambiguous report” bypassed interpretation

The original document explicitly said it was not a payment request and that a separate invoice would follow. The prepared teaching signal was invoice at 0.58, but the live model could reasonably classify that content as report with high confidence. The runtime correctly accepted the live judgment because the text guard did not match. Calling that document an uncertain live example promised a behavior that its content and policy did not guarantee.

Catalogue v3 replaces the main lesson's example with **Mixed-purpose report**: a substantive delivery report sent by email with a separately headed proposed milestone agreement and pending acceptance. That text naturally matches the existing email/proposed-terms heuristic. The runtime requires interpretation and review even when the live model confidently chooses report. Neither the live signal nor the policy is modified to manufacture the branch. This is a policy exception, not proof that the model was uncertain or wrong.

The original plain report, its 0.58 fixture, and the full v2 catalogue remain preserved. The new source has its own content hash, document identity, and versioned recording. Its authored reference is report, its prepared signal is explicitly a fixture, and actual live responses remain independent. See the [v3 source and policy verification](mixed-purpose-report-v3.md).

The live graph and receipt explicitly label percentages as **confidence**. They use the actual winning policy reason; a matched guard cannot conceal earlier unknown-category or tied-signal rules. Tests exercise report at both 0.96 and 1.00, the same content as an ordinary uploaded document, threshold boundaries, guard-disabled policy violations, unchanged plain-report acceptance, and source-hash rejection.

## Adversarial findings addressed

| Finding | Correction |
| --- | --- |
| Decorative SVG glass disabled the otherwise clickable card interior. | The base rectangle explicitly receives pointer events; decorative overlays do not. |
| Scene-specific CSS overrode shared glass fills and selected outlines. | Removed conflicting material rules and retained layout rules. |
| Role-specific ink could override forced-color text. | Forced colors override the underlying ink variables, including the nested model core. |
| Separate System 1 and frontier buttons obscured who selects the capability. | One **Run workflow** action executes the real route; the runtime selects interpretation. |
| The default prepared replay continued to show no live System 1 latency. | Main classification now starts ready for live execution on prepared document content; it never imports prepared decisions or timing. |
| A live result could differ from the example cue and appear incorrect. | Cues are expected routes; the view explicitly allows live results to differ and displays actual policy evidence. |
| Overall elapsed was below a tall graph. | Added overall elapsed and request counts above the graph. |
| Clicking a node opened evidence below the viewport without feedback. | Explicit inspection focuses and scrolls the evidence summary into view without animated scrolling. |
| Pending and missing-key footers claimed an actual judgment existed. | Provenance now distinguishes ready, pending, unavailable, and returned live attempts. |
| The new Review model selector displaced source and actions in the two-column grid. | Selector spans the full grid width; source and actions retain their columns. |
| Independent wait compression and fixed handoff delays concealed the latency ratio. | Both lanes use exact modeled work intervals and one common linear presentation scale; handoffs add no extra time. |
| The “Ambiguous report” cue depended on a scripted 0.58 signal while its real content supported a confident report category. | New versioned mixed-purpose source naturally matches the unchanged proposed-terms guard. Original source and recordings remain preserved. |
| A matched guard could conceal an earlier unknown/tied policy reason in the live receipt. | Graph and receipt use the actual winning reason; confidence is explicitly named. |
| Review request counts remained zero during a visible active model call. | Counts now advance at request start; cost and output completion boundaries remain separate. |

## Verification boundaries

Final integration passed **237 backend tests** and **163 frontend unit/SSR tests**, plus Ruff, TypeScript, ESLint, schema export, production build, and `git diff --check`. Documentation validation checked 751 local Markdown links, 14 sample files and supporting spans, and five SVG exports before this final cross-link update. The current browser suites contain 18 applicable education/live/performance cases, but listing them is not execution.

The independent Codex review covered the actual implementation and reran focused backend and frontend suites. Its final affected checks passed 61 backend policy/education/classification tests and 33 frontend measured-graph/workflow tests. Earlier in the same review, it separately passed 63 model-selection/classification API tests. Findings and stale assertions were corrected; there is no remaining material source-level finding. These overlapping focused suites are not added to the full-suite totals.

Focused tests exercise real API adapters using mocked SDK responses, all selected model identifiers, authoritative policy routing, request counts, component timing, stale-response isolation, no fixture leakage, and no publication. Frontend tests include server-rendered components and numerical graph projections. They are not visual browser verification or actual model performance samples.

The isolated browser suite could not start its backend: binding `127.0.0.1:8001` failed with `EPERM` (`operation not permitted`). No restriction was bypassed. Current rendered screenshots, animation inspection, keyboard interactions, narrow layouts, both themes, 200% zoom, and reduced-motion behavior remain unverified in a browser. No human comprehension study occurred. Real provider access also remains unverified in this environment; live API measurements must come from successful explicitly executed requests in the configured app.
