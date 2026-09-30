# Slide skill integration

Reviewed both named SKILL.md files, the Swiss layout lock and registered layouts, presenter contract, Swiss template runtime, frontend fixed-stage CSS and HTML architecture, and validator behavior on 2026-09-28.

## Decisions

The deck uses guizang's Swiss S01–S22 layout grammar and presenter runtime, adapted to frontend-slides' fixed 1920×1080 stage. The user's pastel palette takes precedence over guizang's preset-only colors. A technical tutorial warrants more slides with a single instructional step on each; explanatory depth lives in notes rather than small type.

Both skill paths resolve through `git rev-parse --show-toplevel` to the enclosing `/Users/pmui/dev/brilliant/system1` repository. Neither is an independent upstream checkout and the enclosing repository reports no remotes. Running the skill's fetch/pull snippet would target the wrong repository. No skill files are changed and no upstream pull is attempted.

## Exact adaptation

1. Preserve the Swiss layout identity, stable `data-slide-id`, `SPEAKER_NOTES`, timing, current/next previews, annotations, audience recovery, and overview. Use registered Sxx layouts for slide composition.
2. Include all of `viewport-base.css`. Wrap `#deck` as `.deck-stage` inside `.deck-viewport`; author slide geometry at 1920×1080. Replace the template's `translateX(-idx*100vw)` navigation with `.active` / `.visible`, `aria-hidden`, and inert inactive slides. Scale the entire stage once per viewport change. Convert slide-internal vw/vh to design pixels, preserving responsive presenter and external toolbar CSS.
3. Keep presenter UI outside the stage. Preserve reload-free preview postMessage updates, session-scoped BroadcastChannel and storage transport, heartbeats, recovery, and end-of-show handling. Fit audience annotation canvas to the letterboxed stage bounds, so its normalized points match the presenter preview.
4. Replace dynamic CDN icons with local geometry or text controls. Remove CDN Motion loading; use local CSS/WAAPI reveal effects with reduced-motion and B static mode. Embed the selected font in final files. No fonts, libraries, accounts, or server are required at presentation time.
5. Create overview thumbnails at 1920×1080 and scale them to each slot. Use semantic buttons, keyboard dismissal and focus restoration. Suppress wheel/swipe navigation while using dialogs, notes, overview or editing.
6. Keep SVG diagram geometry separate from HTML slide labels, as required by Swiss layout rules. Standalone downloadable SVG illustrations may include accessible vector text; those are artifacts, not Swiss slide markup. Provide SVG titles/descriptions and a readable HTML explanation.
7. Add plain-text inline editing keyed by stable `data-edit-id`, safe local autosave, and a download-copy action. Never overwrite a version on disk. Trap focus in dialogs; expose full labels and visible focus states. Keep controls usable outside the scaled canvas on phones.

## Validation boundaries

The original Swiss validator assumes a viewport-fluid strip, and the presenter validator hardcodes Chinese labels for the start/reset/resume timer. English localization therefore causes known static false positives. Preserve the underlying controls and test their English behavior directly; do not claim that the unmodified language-specific check passed.

Verify slide bounds and overlaps at 1920×1080 and 1280×720, then verify uniform 16:9 scaling at a portrait phone viewport. Check every slide after animations settle. Test no-network loading, keyboard and touch navigation, overview, local edits/export, print, presenter iframe ratios, audience advance/close/reopen, timers, annotations, screen modes, and reduced motion. Test both local-file and local-HTTP access because browser file-origin behavior differs. Treat software audience acknowledgements as software synchronization only.

The user explicitly requested three preserved versions and adversarial iteration. Save each version independently and retain critique/change logs. Do not substitute visual style previews for those three deliverables.

## Shell implementation smoke check

`src/shell.html` contains the adapted actual Swiss runtime. A two-slide temporary fixture passed Chromium local-file tests for slide visibility, navigation, overview, inline editing, presenter popup synchronization, audience navigation, 16:9 preview fitting, audience closure detection, and return to deck mode. All four inline scripts pass `node --check`; no JavaScript page errors were recorded. This verifies the reusable shell, not the completed tutorial content. The parent build supplies embedded fonts and final diagram/layout validation.
