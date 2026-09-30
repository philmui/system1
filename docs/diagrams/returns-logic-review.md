# Adversarial workflow review

Reviewed the actual `returns-comparison.svg` and `returns-policy.svg`, their rendered PNGs, and `build_returns.py` against `returns-workflow-spec.md`. Review date: September 29, 2026. This review concerns the illustrated workflow and its teaching claims; it does not claim to test a production return service.

## Verdict

The architecture and core policy are consistent. Both illustrations keep authority in trusted services, distinguish semantic classification from exact policy calculation, and prevent the frontier branch from bypassing authentication, order ownership, or policy. The fallback rejoins the same policy step through human validation, while unresolved facts remain pending. The 30-day/$5 Standard and 60-day/waived Plus examples agree throughout.

Two caption corrections would improve factual precision before delivery. Neither requires changing the workflow geometry.

## Findings

### R1 — Clarify which architecture the companion depicts

**Location:** `returns-policy.svg` subtitle; `build_returns.py` line 233 at review time.

The subtitle says “A closer look at the safeguards shared by both architectures,” but the depicted top row includes a `koa-action or Jev` routing node, and its fallback contains the disaggregated sequence. The wrapper panel instead uses frontier calls. Shared backend safeguards are correctly held constant, but the companion's framing can imply that both architectures share the specialized routing model as well.

**Suggested correction:** “The disaggregated flow, with service safeguards shared by both architectures.” This preserves the fair comparison while identifying the model allocation actually drawn.

**Priority:** medium editorial correction; material to the central comparison.

### R2 — Distinguish missing authentication from denial in the overview

**Location:** `returns-comparison.svg` shared-safeguards footer; `build_returns.py` line 211 at review time.

“Auth fails → sign in” combines an unverified session with an explicit denial. The companion correctly says “Unverified → secure sign-in; denied → stop.” The overview should use the same distinction, since it is likely to circulate independently.

**Suggested correction:** replace “Auth fails → sign in” with “Unverified → sign in.” If space permits, add “Denied → stop”; the companion already supplies that terminal branch. Avoid implying that an authorization denial is simply another login prompt.

**Priority:** low, but a concrete authority-label correction.

## Checks that passed

| Question | Evidence in the artwork | Result |
| --- | --- | --- |
| Do both architectures retain the same authority? | Both use blue identity, order, policy, and authorization services; the common footer says the backend authorizes. | Pass |
| Is the wrapper comparison fair? | Frontier bubbles select the next step; services still verify the session and ownership and enforce the fee. No model is shown manufacturing authentication. | Pass, subject to companion subtitle correction |
| Are learned and exact decisions separated? | The green System One node emits routine/unclear/complex labels. Tier, dates, item rules, and fee appear in the policy service. | Pass |
| Can a known policy failure trigger frontier reasoning? | Precheck precedes the frontier; the edge requires eligibility. The companion says “Ineligible → decline,” and Standard day 45 explicitly has no frontier escalation. | Pass |
| Do resolved clarifications avoid the expensive model? | The overview has a labeled “resolved” edge directly from clarification back to policy. | Pass |
| Is missing evidence distinct from a denial? | “Missing facts → hold/pending verification,” unknown-tier protection, and separate ineligibility captions are visible. | Pass |
| Does the model or reviewer bypass policy? | “Proposal only” leads to human review; validated facts return to the same policy box. The companion bars reasoning from bypassing policy. | Pass |
| Are pending reviews accidentally counted as accepted? | Human review explicitly validates or holds. Success requires a service-issued return ID and confirmed label. | Pass |
| Are loyalty deadlines and shipping outcomes consistent? | Standard within 30 days/$5; Plus within 60 days/waived; day-18 Standard and day-45 Plus examples fit those rules. | Pass |
| Is the relevant time preserved? | The companion says to preserve the original request time through clarification and uses trusted delivery/request timestamps. | Pass |
| Is consent required before committing the action? | Customer accepts the quote before service revalidation; changed quotes require renewed confirmation. | Pass |
| Are repeated/uncertain writes represented honestly? | Unknown write outcome is reconciled before retrying; success is defined by the return service's actual result. | Pass |
| Does the illustration overclaim results or integration support? | Policy is marked illustrative; no measured savings or model accuracy is asserted; the artwork is described as conceptual. | Pass |

I visually inspected both PNGs and inspected SVG text bounds for the companion's semantic-route and human-review captions. Those tested captions fit inside their intended drawing area; no missing branch text was found. Dense edge labels should remain at the delivered SVG's native scale when used in teaching material.

No additional security mechanisms, model-training claims, policy exceptions, or speculative failure branches are needed for this illustration. The requested comparison is already understandable without expanding its scope.
