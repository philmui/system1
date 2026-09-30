# Version 05 / blog 09: independent semantic challenge review

Reviewed September 29, 2026. This is an independent agent review of the authored teaching material. It is not a successful Codex plugin review or a browser-rendering approval.

The review covered blog 09, the 31 revised core slide bodies and notes, the branching specification, the source-attribution check, the access/routing/reasoning/policy SVG generators and descriptions, and the v5 teaching interactions. The five newly integrated component-slide bodies, alt descriptions and notes were then reviewed in `src/deck-v5.json`, bringing the reviewed deck to 36 slides. Final layout and PowerPoint packaging require their separate checks.

## Material questions challenged

| Question | Finding |
| --- | --- |
| Does a model or sign-in screen grant access? | No. Identity comes from an authoritative service result; secure sign-in loops through recheck, rejected access stops protected work, and unavailable results remain pending. The wrapper comparison uses the same safeguards. |
| Are exchanges or parts automatically treated as complex? | No. Remedy, purchased-unit scope, and interpretation status are distinct. A familiar exchange or kit-component return can use its configured handler without frontier reasoning. |
| Can a semantic label create a missing handler? | No. The authored combination registry controls supported routes. A component exchange with no registered handler goes to configured specialist handling. |
| Does “cable return” silently change meaning? | No. The tutorial trace explicitly uses a separately purchased cable. A cable included in the headphone kit has component scope and its own policy. |
| Can task branching lose work or execute alternatives together? | The specification, blog, and notes preserve AND obligations and distinguish OR choices from IF conditions. Unknown stock does not mean out of stock. Only the selected alternative may commit. |
| Does a whole-item shipping policy govern every route? | No. The invented Standard 30-day/$5 and Plus 60-day/waived policy is explicitly limited to whole-item returns. Exchange and component handlers obtain their own terms. |
| Can frontier reasoning bypass a failed check? | No. Missing facts use services or hold; known failed rules follow the applicable handler. The frontier path is for remaining interpretation after clarification and branch-aware prechecks. Human validation returns to the same supported mapping and handler rules. |
| Is a quote, confirmation, or proposed plan reported as a completed transaction? | No. Confirmation precedes service rechecks and an authoritative result. The trace ends with an authorized exchange and an active, unfinished cable return. Shipping and settlement are outside the illustrated endpoint. |
| Are product claims or improvements overstated? | The material identifies `koa-action` capability framing as supplied by the user, distinguishes Jev interfaces and public Koa reasoning, and claims no native adapter, training API, calibrated confidence output, or measured gains. LangGraph is an architectural analogy. |
| Are cost and reliability assessed at compatible boundaries? | The local routing-cost example is clearly synthetic. Whole-case acceptance requires quality and cost gates together, plus consequential-error and latency limits. AND obligations must all be accounted for; inactive OR/IF alternatives are not failures. |
| Does evaluation leak future information or turn repeated calls into independent cases? | Decision inputs stop at the decision-time boundary. Related cases and generated variants remain grouped. Development precedes a locked test, and a controlled service pilot is required for complete-workflow claims. Repeatability and generalization are distinguished. |

No unresolved material semantic defect was identified in the reviewed content. This conclusion does not establish production readiness or empirical superiority.

## Corrections made during review

- The AgentScript teaching sketch now exits immediately when identity is not verified. Its owned-order helper explicitly stops for verification or hold unless ownership is established.
- The exchange authorization event now states that the service rechecks authority, policy, stock, and accepted terms before issuing the exchange ID. Confirmation and authorization remain separate events.
- The browser content verifier now checks all eight trace states and their semantic order, rather than only the later states.
- Page B's original clarification branch showed its unresolved exit without a visible resolved return. Its generator now adds a green `Reassess` loop back to System One and the supported mapping, avoiding a direct path to acceptance. Rendered geometry remains a separate visual check.

## Execution checks available in the restricted environment

[The core state report](05-teaching-state-static.json) records execution of the actual v5 teaching script against elements parsed from the authored core markup. [The integrated state report](05-teaching-state-integrated.json) repeats those checks using the teaching script embedded in the 36-slide working HTML itself. The [focused verifier](../src/verify-teaching-state-v5.cjs) checks eight trace events; four confidence-gate boundaries, including zero accepted cases; three synthetic cost boundaries, including break-even and increased cost; reset; serializable restoration; exercise restoration; unknown-version rejection; and bounded state input.

The integrated verifier also freezes the actual script's state for the static export: gate threshold 0.75, frontier fallback 20%, final trace event, and the revealed repair. It serializes the resulting markup while retaining CSS and SVG content and removing scripts. The report records the original and static artifact hashes and confirms that the original HTML was unchanged. A separate inspection found 36 slide sections, 12 generated example dots, one revealed exercise, and no executable scripts in the static artifact.

The DOM adapter does not render pixels or emulate a complete browser. Its passing result does not establish browser keyboard behavior, presenter-window synchronization, offline export, responsive layout, or print geometry. Those checks remain separate. Existing browser verifiers remain available for an environment that permits Chromium startup.

## Actual Codex plugin attempt

The installed `codex:adversarial-review` companion was invoked with `--wait --scope working-tree` against an isolated Git snapshot. It exited before reviewing the content because the new filesystem sandbox did not permit initialization of its state database:

```text
codex app-server exited unexpectedly (exit 1).
WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)
Error: failed to initialize sqlite state runtime under /Users/pmui/.codex: failed to initialize state runtime at /Users/pmui/.codex
```

The [raw log](05-throughline-codex-review.txt) is preserved. No Codex plugin approval is claimed. The independent review above was completed after the failed attempt, including the subsequent pseudocode correction.
