# Executed verification record

This file records checks completed on September 28, 2026. Offline behavior, real provider responses, frontend build compatibility, and actual deployment are separate observations.

For the September 29 classification redesign, synthetic lessons, cleanup, and shared animation work, see the [current classification verification record](classification-replay-review.md). Its 81 backend tests and 41 frontend unit/layout tests passed; browser verification was blocked by the sandbox. The earlier browser and screenshot results below do not verify that later design.

| Check | Observed outcome |
| --- | --- |
| Python compatibility | Python 3.14.6 dependency resolution, imports, and final `uv sync --locked` succeeded; original 3.14 minimum retained, with `<3.15` added to bound compatibility to the tested minor. |
| Synthetic corpus | 14 files, including intentional zero-byte file; manifest labels and supporting spans validated. Repeating the tutorial import retained exactly 14 documents; FTS5 was available. |
| Held-out evaluation data | Eight distinct classification texts and five discovery reference cases created. |
| Vector diagrams | Five SVGs regenerated; PNG renders visually inspected. Accessible titles/descriptions validated. |
| Documentation checks | All 77 local Markdown links, corpus supporting spans, and SVG exports passed `python scripts/check_docs.py`. Documentation scripts passed Ruff. |
| Required visual source | YouTube watch/oEmbed inaccessible; content and visual comparison unverified. |
| Python behavior checks | 74 tests passed after the adversarial fixes, timing instrumentation, and OpenAPI payload contract additions. Ruff passed. Coverage includes graph/API/storage behavior, mixed PDF pages, cancellation, telemetry privacy/outage, and optional evaluator mapping. |
| Frontend lint/type/build | `npm ci` reported zero vulnerabilities; lint, TypeScript check, and production Vite build passed with Node 22.23.1, React 19.3.0, Vite 8.3.0, React Flow 12.11.6, and TypeScript 6.0.3. A separate frontend-only build succeeded without the parent `.env`, using an explicit external `VITE_API_BASE_URL`. |
| Browser checks and screenshots | 10 Playwright tests passed with simulated providers. Desktop and narrow inspection covered fan-out, expanded graph edges, decision inspection, review, citations, reconnect, replay/scrubbing, timing, and formation artifacts. Nine fixture captures were retained. No page errors or visibility failures occurred; rapid unmounts produced transient React Flow development size warnings. |
| Live-run browser inspection | Reopened the retained live comparison without provider calls. Desktop and narrow timing panels show all six Jev request durations; component selection and replay worked, with unchanged recorded events, no browser errors, and no horizontal overflow. Three live captures are in the screenshot gallery. |
| Artifact secret scan | Checked 146 repository/build artifacts against 3 configured credential values; no matching values found. |
| Live Jev/OpenAI/LangSmith | Synthetic four-document classification, review/resume, and comparison succeeded in 11.464 s. All three completed trace segments read back: 35 spans inspected with no forbidden text fields. Review-resume delivery was confirmed by a later authenticated readback without repeating provider calls. |
| Live timing and formation instrumentation | A later bounded comparison over the four indexed synthetic documents succeeded with 8 provider requests: 6 Jev and 2 OpenAI. It retained 3 claims and 4 citations and recorded 16 measured stage completions. Its completed trace was read back: 24 spans, including 8 provider spans, with no forbidden text fields in inputs/outputs. Jev request times ranged from 106.611 to 257.117 ms, with a 125.259 ms median; these are client-observed requests, not a controlled performance benchmark. |
| Held-out live evaluation | 8/8 categories, 8/8 escalation expectations; all 5 query runs completed. Comparison retained 3 claims with 5/5 exact citations. 34 total provider calls; see evaluation conditions. |
| Fixture evaluation | 6/8 category labels and 7/8 escalation expectations; explicit relevance weaknesses retained. These are simulated checks, not provider-quality measurements. |
| Actual deployment | Not performed. |
