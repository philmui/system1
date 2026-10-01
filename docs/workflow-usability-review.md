# Workflow usability and adversarial review

September 30, 2026. This review covers the app’s teaching pages and operational destinations, including the broken document animation and unclear Run action.

## Changes

| Destination | First action and interpretation |
| --- | --- |
| Classify documents | Choose a document, then **Run simulation**. **Live models** exposes **Run document** and the model selector. The primary action stays in one place through pending, successful, and failed requests. |
| Find & compare | Choose Find or Compare, then **Run simulation**. Live mode makes a request only on Run. The replay’s results appear when their recorded step is reached. |
| Review & redact | Prepared comparison opens first. **Run simulation** appears before the graphs; both approaches share a modeled clock and explicit review checkpoints. Live requests are a separate choice. |
| Compare strategies | Choose recorded evidence or an illustrative workload. The workload’s document selector and **Compare workload** precede its completion summary. Assumed quality and timings remain labeled. |
| Experiment | Guidance explains that controls update a policy simulation automatically, using a fixed prepared judgment. Safeguard recordings have an explicit simulation action. |
| Documents, search, Runs | Instructions explain upload and classification, indexed-source search, and recorded replay. Upload’s instruction states that it starts classification. |
| All destinations | **How to use** explains the page choices and measurement terms. Help, evidence inspection, and hiding the tab pause playback. Keyboard focus returns after closing a drawer. A skip link preserves the current route. |

The design follows the existing visual system. The review applied the official [frontend design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) and [web interface guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md).

## Document motion

One numbered document is visible at a component or on its connecting edge. A caption explains its current handoff and selected route. Recorded playback includes the acceptance handoff before publication; it does not skip Accept or move backward during batch accounting.

Live playback describes the completed returned route. Pending requests show waiting status rather than an invented live trace. A finite replay stops at the accepted category or proposal. Human approval and publication remain outside that preview.

Travel duration uses recorded component service work, excluding queues. All components share a linear scale, with a six-second cap on the longest interval and a 650ms reading floor for short work. Thus relative timing is retained above the floor; it is not an exact stopwatch. Missing or fixture timing gets illustrative motion rather than a fabricated measurement. Captions, pause, step, speed, and replay controls make that distinction explicit. Motion is linear along the actual connecting path; pause and speed changes retain its phase. Reduced motion preserves the route and manual stepping.

## Measurement interpretation

Reports and the shared guide distinguish elapsed request time, queue waits, and component service work. Parallel service durations are not added to estimate elapsed time. Units are explained, and missing measurements stay unavailable rather than becoming zero.

Quality fractions retain their evaluated sample size and reference. One reference match does not establish general model accuracy. Confidence is a model signal, separate from observed correctness. Comparisons explain whether both strategies were measured or one is hypothetical; illustrative outcomes and prices remain assumptions.

## Adversarial findings corrected

- The original live route animated lines indefinitely without advancing a document. It now has one marker, a selected branch, and an ending.
- Recorded direct acceptance could skip the Accept node. The added handoff retains the same recorded event prefix.
- A repeated or missing Run control obscured how to start. Primary controls now precede workflows, with explicit simulation and live modes.
- Short Discovery screens could clip the graph and playback controls. Compact sizing and scrollable overflow keep the controls reachable without moving the canvas when a response returns.
- Mobile navigation covered the theme switch. Its width is now bounded.
- Review graphs and long comparison time labels widened the whole phone page. Graph scrolling stays within its frame; narrow controls and time labels fit their container.
- Source drawers lost the opener’s keyboard focus. Modal cleanup now restores it, including Escape dismissal and source/result navigation.
- Pausing could advance motion by another frame. The paused animation retains its captured phase.
- Review’s fixed slider increment could prevent an exact final position for fractional durations. The timeline now accepts the actual completion value.
- Primary accessible button names differed from visible action labels. They now agree.

## Verification

The Playwright suite runs against an isolated backend in test-fixture mode, with provider keys blank. Live UI scenarios intercept requests with controlled responses. Tests cover direct and exception routes, immutable measurements during replay, relative motion speed, pause/resume/seek, source and evidence inspection, model selection, pending and detached requests, failures, reduced motion, and operational classification/review/search/reconnect/replay.

Cross-page browser checks visit all destinations at 320, 390, and 1440px, exercise both themes, verify primary simulation controls are in view, check page overflow, and exercise help and focus restoration. Discovery also checks 1024×768, partial results, unchanged canvas bounds, and citation navigation. Review checks graph focus on portrait and short landscape screens.

Rendered screenshots were inspected for classification, Discovery, Review, and strategy comparison on desktop and phone. This is a code and browser review, not a human usability study or a model benchmark. No paid provider calls were made.

Final verification: **252 tests passed** (207 unit tests and 45 browser tests) with `npm run test:e2e`. The production build, including TypeScript, and ESLint passed. `git diff --check -- frontend` passed.

## Follow-up: smaller Find & compare stages and visible document flow

September 30, 2026, after the earlier verification above. This follow-up responds to the oversized Discovery boxes and obscured animated connections.

- The desktop decision tree now uses four bounded columns: intent judgment, the two planning choices, shared evidence work, and the two output choices. Cards are at most 176px wide; phone shared stages are at most 192px. Branch labels identify the decisions. Full responsibility descriptions and recorded evidence remain in accessible names and stage drawers.
- A single marker **01** follows the request, then its search plan, evidence bundle, and result. It travels only along the selected arrow. At a stage it holds still while a separate service progress line advances. Internal events no longer make the marker jump backward. Queue and worker bookkeeping preserve its meaningful location and handoff identity.
- Only the current handoff animates. Completed paths retain a static history; unused possibilities remain dashed. The optional technical view likewise animates only the current recorded handoff.
- Processing holds use one linear scale for recorded service work, with a six-second longest-hold cap and a 160ms visibility floor. Transfers are a separate 700ms illustration. Prepared timing assumptions are explicitly labeled: code 80ms, bounded System 1 work 350ms, frontier planning 2.4s, frontier drafting 4.6s. Fixture sleeps are never relabeled as measured model latency. Missing service timing uses a neutral hold. Parallel steps are presented in sequence; replay duration is not elapsed request time.
- Current-step captions distinguish frontier drafting, code citation checks, and System 1 support checks even though those responsibilities share one compact stage. Numeric live timing becomes visible after the corresponding completion; whole-run measurements remain independent of replay position and speed.

### Adversarial review and fixes

Geometry sampling initially found the paper could bend back over its source card. Short exit and entry segments now place the bend in the space between cards. Narrow-screen sampling also found the scope shortcut could enter a neighboring card; its outer corridor now uses the actual adjacent column gaps. The complete paper halo clears the modeled desktop and phone cards, including the unsupported shortcut. Explicit live responses in fixture mode could also receive an assumed-timing caption; retained provider provenance now governs that label. A changing retry decision also repainted earlier code handoffs as frontier handoffs; route history now uses the decision recorded at each handoff. Processing progress and handoff movement have separate clocks, avoiding internal-event resets and misleadingly slow code transfers. Pausing and changing speed retain each animation's phase. A completed finite animation cannot restart just because playback resumes.

### Verification scope

The current **223 unit tests passed**. They include timing provenance, reversed service-speed examples, retries, every prefix of the Find and Compare recordings, grouped-stage responsibility labels, and geometric marker clearance. The production build, TypeScript checks, and ESLint passed. Browser regressions were extended for one marker, pause/speed/inspection/reduced motion, frozen route history, and card/path proportions at 320, 390, 1024, and 1440px.

**The new browser and screenshot checks could not run in this restricted session.** The isolated backend could not bind localhost (`operation not permitted`), the earlier preview was unavailable, and Chromium launch failed at macOS Mach-port registration (`Permission denied`). The earlier 252-test browser verification does not verify this follow-up. Actual CSS layout, painting, and browser animation behavior therefore remain to be checked in an environment that permits the existing Playwright suite. No paid model requests were made. The review here is a self-review with automated adversarial cases, not an independent agent review or a human usability study.

## Follow-up: connected services, continuous visits, and top playback controls

September 30, 2026, responding to the supplied 9:31 PM screenshot. This replaces the stationary under-card marker and per-event progress resets described in the preceding follow-up.

- Playback, previous/next, progress, speed, sources, and results now precede the visualization. A service-work breakdown sits to their right on desktop and below them on phones. It shows code operations, System 1 requests, and frontier requests, with durations, counts, and a proportional bar when the totals are complete and comparable. Prepared provider steps are explicitly simulated; mixed and missing timings retain their provenance.
- Services attach directly to the route. The desktop card has a bottom rail; phone cards have a left rail. Arrowed connectors share their exact endpoints with these rails. The SVG paints above the reserved rail bands, keeping the document and the full highlighted route visible through services. Code outputs use the same color as code in the legend.
- The default replay groups internal checks and parallel tasks into one continuous capability visit. Both prepared Find and Compare have four visits and three transfers. One marker crosses each service rail during processing, pauses at its completed endpoint, then crosses the connecting arrow once. Service progress and transfer progress are finite sweeps; completed rails and connectors remain solid, with no recurring flashing layers.
- A true later return receives a visit number. A policy-only reroute can reuse its signal without inventing another model request. Multiple provider attempts within one capability remain included in the request count and timing budget. Parallel incoming edges, duplicate start records, queues, and worker bookkeeping do not create extra visits or requests.
- Visit durations follow aggregate service work on a common linear scale, with a six-second maximum and 160ms floor. Unknown work keeps a neutral 1.4-second interval even when other visits are compressed. Transfers use a separate 700ms interval. The whole-recording breakdown stays fixed while seeking; results, decisions, and inspection remain constrained to the current event prefix. Service totals include overlapping parallel requests and are explicitly distinguished from elapsed time and accuracy.
- A visible routing explanation states why code planning, frontier planning, composition, or a source/gap response was selected. The normal Find example shows frontier work as unused. No hypothetical all-frontier baseline, savings percentage, or accuracy score is manufactured.

### Adversarial cases and corrections

The former per-event animation reset during retrieval workers, citation checks, and support checks, implying repeated visits to the same box. Capability grouping removes those resets. Geometry checks found that a phone connector approaching from the right could bring the document across the next service's text; straight entry and exit sections now keep its full halo clear. Completed-route checks cover every service rail as well as every connector. Missing timing cannot become zero or an artificially fast scaled interval; skipped composition cannot become a frontier request. Mixed recordings retain simulated-step labels for the prepared provider groups. Re-evaluating a policy preserves the earlier branch and exposes the new visit without inventing model work.

### Current verification

**231 unit tests passed**, including the new grouping, counts, provenance, retry, skipped-work, prefix, connected-geometry, toolbar-order, and complete-route cases. The production build with TypeScript, ESLint, and frontend whitespace checks passed. Browser regressions now check controls above the canvas, latency to their right, immutable totals, finite marker/progress motion, static completed rails, pause and speed continuity, reduced motion, and card/text clearance at four viewport widths.

The browser attempt `npm run test:e2e -- discovery-layout-browser.spec.ts flow-motion-browser.spec.ts` **could not start**: the isolated backend's localhost bind was denied (`[Errno 1] operation not permitted`). No browser assertions or new screenshots were produced for this redesign. Actual rendered layout and animation still need the existing suite in a browser-permitted environment. This was a self-review with automated adversarial cases, with no paid provider requests.

## Follow-up: validate the System 1 timing reference

September 30, 2026, after the supplied 10:14 PM screenshot. The former 350ms-per-request System 1 simulation assumption was not checked against the retained live measurements before that change. Its displayed 1.75 seconds was five assumed requests, not observed Jev latency.

The retained successful live recording in [latency-results.json](latency-results.json) contains six `jev-1.13.0` requests: 106.611–257.117ms, median 125.259ms. The original smoke report matches those figures. The adapter measures from immediately before its SDK request until the response returns, so the interval includes transport and SDK response handling. Server inference time is not available. These requests come from one synthetic workflow and do not establish a general benchmark. TypeSafe separately [publishes a 70–500ms end-to-end range](https://typesafe.ai/blog/introducing-system-one-models-and-jev).

The prepared simulation now uses a rounded **125ms per System 1 request**, making its five-request total **625ms**. Its source remains **assumed**: using a previous recording's median does not make the current simulation a live measurement. A shared reference artifact records model, date, sample count, range, scope, and source. A regression compares that artifact and its rounded pacing budget against the retained public request records.

The breakdown now explicitly says **Total service work** and shows both the total and the average per request or local operation. Its note states that request timings include network time and that overlapping calls cannot be summed into elapsed workflow time. The How it works drawer explains the reference and its limitations. Code's illustrative budget is now 1ms per operation; retained live local operations ranged from 0.566–2.472ms, while the old 80ms assumption overstated these small operations. Frontier assumptions remain explicitly illustrative. Returned live timings retain their original values and provenance. The 160ms animation floor remains a readability adjustment and does not change displayed measurements.

A fresh direct Jev check was attempted with the existing adapter, configured credentials, a short timeout, retries disabled, and synthetic-only input. It failed on the first intent request with a connection error; there were **zero successful new requests**. [system1-latency-check.json](system1-latency-check.json) records the failed attempt without credentials or input text. This app has a Jev adapter and no Koa adapter; no Koa performance claim is made.

**232 unit tests passed**, including the reference/provenance check and corrected totals. TypeScript, production build, ESLint, and frontend whitespace checks passed. Browser verification remains unavailable under this session's previously documented localhost/browser restrictions.

## Follow-up: prominent Find & compare service-work total and composition

September 30, 2026, responding to the supplied Classify documents timing-panel screenshot.

The Discovery timing panel now follows the same visual hierarchy: timing provenance, a clock label and prominent total, a proportional horizontal bar, then the colored component contributions. The bar sits above the Code, System 1, and Frontier values. Plus signs make their additive relationship visible; operation/request counts and per-request averages remain available. The panel stays beside playback on desktop and below playback on phones.

The prepared Compare example shows **7.63 seconds** of service work: **4ms Code + 625ms System 1 + 7.00s Frontier**. Find shows **253ms**, including **3ms Code + 250ms System 1**, with Frontier explicitly **Not used**. Segment widths follow the actual contribution ratios without a minimum width that would exaggerate code's share. The legend keeps even tiny contributions readable.

### Adversarial review

- This is a composition of total service work. Parallel requests can overlap, so it retains **Total service work** and the explanatory note; it does not claim chronological elapsed workflow time.
- Missing timing produces **Not measured** for the total. Mixed timing retains its labeled numeric sum. Both leave the bar neutral instead of drawing a misleading complete comparison. Recorded zero remains **0ms**, with no division by zero. Empty or pending recordings display a dash.
- The total row reserves its height, and the average rows reserve two lines. These prevent ordinary pending/returned transitions from shifting the canvas when measurements replace placeholder text. Actual browser geometry remains unverified in this restricted session.
- Whole-run values remain independent of the replay cursor. Existing controls, routing, timing assumptions, and live-request behavior are preserved.

### Verification

The focused Discovery tests **passed all 30 cases**. The full unit run passed **243 of 244 tests**; its sole failure was the existing local-proxy test because the sandbox denied binding localhost (`listen EPERM`). TypeScript, the production build, and ESLint passed. Browser regressions now check the total, bar placement, faithful segment widths, and pending placeholders at desktop and tablet sizes.

The targeted browser command `npm run test:e2e -- discovery-layout-browser.spec.ts` could not start because the isolated backend was denied binding `127.0.0.1:8001`. No new browser assertions or screenshots were produced. This review used source inspection and automated adversarial cases; no provider requests were made for this change.
