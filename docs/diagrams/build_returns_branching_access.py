#!/usr/bin/env python3
"""Draw the shared access gates before semantic product-request routing.

This is the first of a two-picture teaching sequence. Both exports contain the
same 1744 x 620 illustrated body; the poster adds its own title and context.
Existing comparison diagrams are deliberately preserved. Run from any directory:

    python3 docs/diagrams/build_returns_branching_access.py

The named scene, label and connector groups are reusable vector components.
The accompanying specification and presentation notes explain bounded retries,
unavailable services and other operational detail omitted from the drawing.
"""

from __future__ import annotations

from html import escape

from build_returns import C, Drawing
from returns_branching_primitives import scene


DESCRIPTION = (
    "Picture A: the same trusted front desk serves both agent architectures. "
    "Read the large gate flow from the customer at left. A neutral identity "
    "service checks the current session and permissions. Only its Verified "
    "result advances to the purchase service. No login leads down to secure "
    "sign-in and then back to the identity check; completing sign-in never "
    "skips that recheck. A Denied result exits left to Stop protected work. "
    "The purchase service matches the receipt and purchased items to the "
    "verified principal. Missing or mismatched purchase evidence leads down "
    "to Verify purchase, then back to the purchase service. Verification "
    "remains pending until authoritative ownership is established. An "
    "unavailable or invalid service result holds protected work; recovery is "
    "bounded and does not become a frontier-model appeal. Only Matched "
    "continues at badge B, Choose request route, in the next picture. "
    "The separate right-hand miniatures compare allocation of intelligence, "
    "not additional access decisions: wrapper intelligence repeatedly calls "
    "a frontier model around the same safeguarded services, while Agent "
    "Graph follows authored service transitions and uses System One for "
    "semantic decisions. AgentScript configures the graph; koa-action or Jev "
    "are proposed System One choices. Neither kind of model grants access, "
    "repairs receipt ownership, waives policy or commits a transaction. The "
    "same safeguards apply in both architectures. Page B illustrates familiar "
    "return, exchange and kit-part requests and their applicable handlers. "
    "This is a proposed teaching architecture, not a provider API, merchant "
    "implementation or measured performance comparison."
)


def component(d, name, kind):
    d.parts.append(
        f'<g data-component="{escape(name, quote=True)}" '
        f'data-kind="{escape(kind, quote=True)}">'
    )


def end_component(d):
    d.parts.append('</g>')


def label(d, name, text, x, y, size=29, color="ink", weight=650, anchor="middle"):
    component(d, name, "label")
    d.text(text, x, y, size, color, weight, anchor)
    end_component(d)


def route(d, name, path, color="blue_ink", width=3.8, *, ribbon=False):
    component(d, name, "connector")
    if ribbon:
        d.parts.append(
            f'<path d="{path}" fill="none" stroke="{C["mint"]}" '
            'stroke-width="17" stroke-opacity=".6" stroke-linecap="round" '
            'stroke-linejoin="round"/>'
        )
    d.path(path, color, width, True)
    end_component(d)


def access_body(d):
    # Gate titles sit above their objects, leaving the recovery ports unobscured.
    label(d, "same-safeguards-first-line", "Same", 92, 31, 25, "blue_ink", 600)
    label(d, "same-safeguards-second-line", "safeguards", 92, 68, 25, "blue_ink", 600)
    label(d, "identity-heading", "Check identity", 337, 43, 33, "blue_ink", 700)
    label(d, "purchase-heading", "Match purchase", 751, 43, 33, "blue_ink", 700)

    # A single shared service flow. Main-route arrows are deliberately distinct
    # from the coloured recovery loops and from the comparison on the right.
    route(d, "customer-to-identity", "M177 158 H236")
    route(d, "identity-verified", "M444 158 H642", "green", 4.2, ribbon=True)
    route(d, "purchase-matched", "M862 158 H975", "green", 4.2, ribbon=True)
    label(d, "verified-label", "Verified", 541, 126, 28, "green")
    label(d, "matched-label", "Matched", 918, 126, 28, "green")

    # Failed verification terminates protected work. Secure sign-in is a
    # different branch and always returns to the neutral identity service.
    route(d, "identity-denied-stop", "M253 215 H199 V427 H166", "rust", 3.6)
    route(d, "identity-needs-signin", "M337 242 V378", "ochre", 3.6)
    route(d, "signin-recheck-identity", "M443 465 H526 V219 H443", "blue_ink", 3.3)
    label(d, "denied-label", "Denied", 177, 332, 28, "rust", anchor="end")
    label(d, "no-login-label", "No login", 356, 323, 28, "ochre", anchor="start")
    label(d, "identity-recheck-label", "Recheck", 544, 372, 27, "blue_ink", anchor="start")

    # Missing or mismatched evidence stays in the ownership gate, never in an
    # LLM exception lane. Corrected evidence must pass the service again.
    route(d, "purchase-needs-verification", "M752 245 V381", "ochre", 3.6)
    route(d, "verification-recheck-purchase", "M854 477 H972 V224 H861", "blue_ink", 3.3)
    label(d, "purchase-missing-label", "Missing /", 772, 310, 27, "ochre", anchor="start")
    label(d, "purchase-mismatch-label", "mismatch", 772, 350, 27, "ochre", anchor="start")
    label(d, "purchase-recheck-label", "Recheck", 991, 396, 27, "blue_ink", anchor="start")

    scene(d, "customer", 14, 83, 157)
    scene(d, "auth", 243, 70, 189)
    scene(d, "receipt", 655, 70, 192)
    scene(d, "locked", 17, 391, 145)
    scene(d, "signin", 250, 385, 185)
    scene(d, "review", 664, 389, 187)
    label(d, "customer-label", "Customer", 92, 266, 29)
    label(d, "stop-label", "Stop", 89, 591, 30, "rust")
    label(d, "signin-label", "Sign in", 342, 591, 30)
    label(d, "purchase-verification-label", "Verify purchase", 758, 591, 30)

    # Only successful gate results reach the next picture. This continuation is
    # a navigation badge, never an authorization or an already accepted return.
    component(d, "continue-to-picture-b", "badge")
    d.circle(1008, 158, 29, "mint", "green", 1.8)
    d.text("B", 1008, 169, 32, "green", 750, "middle")
    end_component(d)
    label(d, "continue-request-label", "Choose request", 1008, 52, 26, "green")
    label(d, "continue-route-label", "route", 1008, 89, 26, "green")

    # The sidebar is a compact architectural comparison, visually fenced away
    # from the gate outcomes. Its model chips cannot be mistaken for authorities.
    component(d, "comparison-divider", "decoration")
    d.path("M1136 17 V607", "line", 1.6)
    d.path("M1160 315 H1725", "line", 1.4)
    end_component(d)
    label(d, "wrapper-heading", "Wrapper intelligence", 1158, 44, 33, "plum", 700, "start")
    for i, x in enumerate((1153, 1351, 1549), start=1):
        scene(d, "frontier", x, 94, 151)
        if i < 3:
            route(d, f"wrapper-call-{i}", f"M{x + 158} 165 H{x + 190}", "plum", 3.5)
    label(d, "wrapper-caption", "Frontier every step", 1443, 280, 30, "plum")

    label(d, "disaggregated-heading", "Disaggregated", 1158, 352, 34, "green", 700, "start")
    label(d, "system-one-label", "System One", 1433, 393, 27, "green", 600)
    for kind, x in (("auth", 1163), ("system-one", 1358), ("policy", 1553)):
        scene(d, kind, x, 393, 150)
    route(d, "graph-service-to-system-one", "M1321 463 H1351", "green", 3.8, ribbon=True)
    route(d, "graph-system-one-to-service", "M1516 463 H1546", "green", 3.8, ribbon=True)
    label(d, "graph-caption", "Agent Graph executes", 1443, 567, 28, "green")
    label(d, "script-caption", "AgentScript authors", 1443, 611, 26, "green", 600)


def make_slide():
    d = Drawing(1744, 620, "A. Shared access gates before choosing a request route", DESCRIPTION)
    access_body(d)
    d.save("returns-slide-access.svg")


def make_poster():
    d = Drawing(1900, 900, "A. Start with the same trusted front desk", DESCRIPTION)
    component(d, "poster-page-a", "badge")
    d.circle(111, 93, 35, "blue", "blue_ink", 1.5)
    d.text("A", 111, 106, 39, "blue_ink", 750, "middle")
    end_component(d)
    label(d, "poster-title", "Start with the same trusted front desk.", 174, 110, 57, "ink", 750, "start")
    label(d, "poster-context", "“I’d like to return, exchange, or return part of this kit.”", 79, 189, 34, "muted", 500, "start")
    d.parts.append('<g transform="translate(78 246)">')
    access_body(d)
    d.parts.append('</g>')
    d.save("returns-comparison-access.svg")


if __name__ == "__main__":
    make_slide()
    make_poster()
