# Pictorial returns: adversarial logic review

Reviewed September 29, 2026: `returns-comparison-v2.svg`, `returns-policy-v2.svg`, `returns-fallback-v2.svg`, their rendered 1900 × 900 compositions, and the current `docs/blog/08-building-prod.md`. This review addresses semantic clarity, arrows, authority, and caption consistency. It does not add implementation requirements to the illustrations.

The redesign explains the process with recognizable objects: a checked identity card, headphones on a receipt, bound calendars, shipping tickets, a customer holding a parcel, and a return label. Compared with the earlier text-heavy layouts, the visual structure is now doing the main explanatory work. The short article cues make the reading order clear without requiring each drawing to repeat the complete workflow specification.

## Findings — resolved

### 1. Name both nonroutine inputs on the fallback detour

The first outgoing detour in `returns-fallback-v2.svg` is labeled only **“unclear.”** The classifier contract in the article has `routine`, `unclear`, and `complex`; the overview points to this continuation with **“Complex?”** As drawn, a reader can reasonably wonder whether a request already classified as complex skips the clarification and precheck, or where it enters.

**Minimal correction:** change the edge label to **“unclear / complex,”** using two short lines if needed. This adds one word and aligns the drawing with the article. No new node or explanatory paragraph is needed.

**Resolved and verified:** the live fallback SVG now labels the detour with two lines, “unclear /” and “complex.” A separate pause exit also makes unresolved human review visible.

### 2. Publish the pictorial assets behind the article's canonical links

At initial inspection, the article's `../diagrams/returns-comparison.svg` and `../diagrams/returns-policy.svg` still contained the earlier text-first artwork, and `../diagrams/returns-fallback.svg` did not exist. The new captions accurately describe the `-v2.svg` files, so rendering the article at that point would display mismatched images and a broken third image.

**Required integration step:** publish the revised SVGs to those canonical names, or update all three article links to the `-v2.svg` names. Preserve the older exports in the existing archive. This is a publication/integration issue, not a defect in the new artwork.

**Resolved and verified:** all three canonical SVGs now exist and are byte-for-byte identical to their pictorial `-v2.svg` counterparts. The article therefore resolves to the artwork described by its new captions.

## Material checks that passed

| Area | Assessment |
| --- | --- |
| Shared authority | The overview uses the same four numbered service checkpoints in both panels. The article explicitly assigns authority to services and says the check marks represent verified service results. The wrapper is not portrayed as authenticating people through language alone. |
| Model allocation | Repeated consultation arrows around the large frontier chip contrast clearly with the directed graph and its smaller bounded-decision chip. The article explains that a chip symbolizes a model rather than an application service. |
| Reading order | Clockwise checkpoints 1–4 in the overview match the article's instructions. The right-hand arrows run identity → receipt → System One → policy → authorized return. The model decision is distinct from the four numbered service checkpoints. |
| Policy facts and fees | Standard within 30 days leads to $5 shipping. Plus within 60 days leads to waived shipping. The calendars and tickets agree with the article and the final policy specification. |
| Eligibility scope | Both calendar-to-ticket arrows say “Eligible.” The poster caption limits the shown shipping terms to eligible returns; the article supplies returnability and available-quantity prerequisites. A fee is not presented as acceptance by itself. |
| Known late case | The crossed Standard day-45 calendar is a concrete failure example. Its “Too late → stop” caption agrees with the ordinary 30-day window. It is not connected to frontier reasoning. |
| Consent and service result | The fee paths converge on a confirming customer, then a separate service shield, then the authorized parcel. The article explains the recheck and actual service-issued result, distinguishing the quote from completed authorization. |
| Missing evidence versus known failure | The precheck has separate stop/Decline and pause/Hold exits. The article identifies them as known ineligibility and missing/unverified facts, respectively. Neither exit leads to the frontier chip. |
| Remaining complexity | The frontier sits after the precheck's passing edge and is captioned “Still complex?” The article explicitly sends missing repair/replacement-status facts to verification or hold before reasoning. |
| Resolved clarification | The green route from the clarification scene rejoins the lower ordinary path. It does not pass through the frontier chip. |
| Human review | The frontier-to-review edge is labeled “proposal.” Only “validated” information returns to the same policy clipboard. The article states that unresolved review remains pending and reviewers cannot override policy. |
| No bypass of the final transaction | Both routine and validated-review routes reach the same policy, then confirmation, then the labeled parcel. No frontier or human-review arrow jumps directly to the authorized state. |
| Claim boundaries | Article and SVG descriptions preserve the proposed-design status, hypothetical merchant policy, and absence of measured gains or a claimed native `koa-action` integration. |

## Caption and text-density assessment

The policy reading cue correctly names the sequence from verified purchase to loyalty calendar, shipping quote, customer confirmation, separate service approval, and return label. The overview caption correctly describes the numbered service checkpoints rather than claiming that every model call is itself a service checkpoint. The fallback caption correctly describes an interpretation detour that rejoins the same policy.

Pending-state detail, retry handling, complete source attribution, and the distinction between return authorization and eventual refund settlement belong in the adjacent prose or speaker notes. Repeating those details inside these pictures would undermine the user's request for less text without resolving an additional material ambiguity.

Both findings have been resolved and verified. No further semantic expansion is needed for this pictorial set.
