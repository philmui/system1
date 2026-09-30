#!/usr/bin/env python3
"""Build two presentation-sized views of the product-return illustrations.

The original posters remain untouched. Both views fit the tutorial's
1744-pixel-wide content area without shrinking the poster's small labels.

Run from any directory:
    python3 docs/diagrams/build_returns_slide_views.py

Recommended comparison caption:
    The same return workflow allocates inference differently. Trusted services
    retain identity, order, policy, and authorization responsibility in both.

Recommended fallback caption:
    Clarification and policy prechecks precede frontier reasoning. Validated
    facts rejoin the same policy before customer confirmation and commit.

Simplifications for speaker notes:
    These are conceptual allocations, not a supported koa-action API or measured
    benchmark. The comparison shows the routine path; the second view expands
    its exception branch. Authentication failure, receipt mismatch, unknown
    loyalty, and service-write reconciliation follow the full workflow spec.
    A known policy failure declines; missing facts stay pending. Customer
    confirmation applies to the quoted fee, and the backend rechecks current
    permissions, policy, and quantity before an idempotent return write.
"""

from __future__ import annotations

from build_returns import Drawing


WIDTH = 1744
HEIGHT = 620


def compact_service(d, x, y, width, title, icon, *, inference=False):
    """One readable line; evidence and failure details belong in the notes."""
    fill, color = ("pale_lilac", "plum") if inference else ("blue", "blue_ink")
    d.rect(x, y, width, 64, fill, radius=16)
    d.icon(icon, x + 17, y + 14, 36, color)
    d.text(title, x + 68, y + 43, 31, color if inference else "ink", 650,
           box=(x + 65, y + 5, width - 82, 55))


def comparison():
    d = Drawing(
        WIDTH, HEIGHT,
        "One return workflow, two allocations of intelligence",
        "Two aligned five-step workflows contrast a repeated frontier-model "
        "wrapper with disaggregated intelligence. Both authenticate the customer, "
        "match the receipt, route the reason, apply policy and shipping fees, "
        "and confirm and authorize the return. The left invokes the same frontier "
        "model at each decision. On the right, AgentScript configures the Agent "
        "Graph flow; a proposed koa-action or Jev node makes the bounded semantic "
        "decision, while trusted services handle the other operations. The routine "
        "path is shown here; a separate view expands clarification and frontier "
        "fallback. Trusted services verify facts and authorize the return in both "
        "architectures. No performance result or native adapter is asserted.",
    )
    d.rect(0, 0, 850, 562, "white", "line", 24)
    d.rect(894, 0, 850, 562, "white", "line", 24)
    d.text("Frontier at every decision", 24, 39, 34, "plum", 650)
    d.text("The model repeatedly selects the next step.", 24, 86, 28, "muted")
    d.text("Specialized judgment + graph", 918, 39, 34, "green", 650)
    d.text("AgentScript configures · Agent Graph executes", 918, 86, 28, "muted")

    rows = [112, 196, 280, 364, 448]
    labels = [
        ("Authenticate", "shield"),
        ("Match receipt", "receipt"),
        ("Route reason", "branch"),
        ("Policy + shipping fee", "policy"),
        ("Confirm + authorize", "package"),
    ]

    # The left returns every service result to the next frontier-model call.
    for i, (y, (title, icon)) in enumerate(zip(rows, labels)):
        d.path(f"M262 {y + 32} H313", "plum", 3, True)
        if i < len(rows) - 1:
            d.path(f"M346 {y + 64} V{y + 73} H143 V{rows[i + 1] - 5}",
                   "plum", 2.7, True)
        d.rect(24, y, 238, 64, "lilac", radius=24)
        d.text("Frontier LLM", 143, y + 43, 29, "plum", 650, "middle",
               box=(37, y + 5, 212, 55))
        compact_service(d, 320, y, 506, title, icon, inference=(i == 2))

    # The right uses fixed graph edges between authoritative service operations.
    for i in range(len(rows) - 1):
        d.path(f"M1319 {rows[i] + 64} V{rows[i + 1] - 5}", "green", 3, True)
    for i, (y, (title, icon)) in enumerate(zip(rows, labels)):
        if i != 2:
            compact_service(d, 918, y, 802, title, icon)
            continue
        d.rect(918, y, 802, 64, "mint", "green", 24, 1.5)
        d.icon("branch", 935, y + 14, 36, "green")
        d.text(title, 986, y + 43, 31, "green", 650,
               box=(983, y + 5, 290, 55))
        d.text("koa-action or Jev", 1694, y + 42, 28, "green", anchor="end", mono=True,
               box=(1300, y + 5, 398, 55))

    d.text("Every step invokes the same frontier model.", 24, 548, 28, "plum")
    d.text("One bounded call; frontier only for exceptions.", 918, 548, 28, "green")
    d.rect(0, 578, WIDTH, 42, "blue", radius=13)
    d.text("Both: trusted services verify facts and authorize the return.",
           24, 608, 28, "blue_ink", 550)
    d.save("returns-slide-comparison.svg")


def fallback():
    d = Drawing(
        WIDTH, HEIGHT,
        "The exception branch returns to the same policy",
        "The customer's identity and purchase ownership have already been verified. "
        "A proposed koa-action or Jev decision routes the return reason. Routine "
        "cases go directly to the merchant policy. Unclear or complex cases receive "
        "a clarification and policy precheck. Resolved clarification rejoins the "
        "same policy without a frontier call. Only still-complex cases with complete "
        "required facts and a passing eligibility precheck use frontier reasoning. "
        "The frontier model proposes an interpretation; a human validates the "
        "facts or holds the case. Only validated facts rejoin policy. Eligible "
        "outcomes proceed to customer confirmation, backend revalidation and "
        "return creation. A known policy failure declines; missing facts and "
        "unresolved review remain pending. No reasoning branch bypasses backend "
        "authorization. The workflow is an illustrative design.",
    )

    # This is a precondition strip, not another executable model or service node.
    d.rect(0, 0, WIDTH, 62, "blue", radius=16)
    d.icon("shield", 20, 12, 37)
    d.text("Already verified: identity + owned purchase", 73, 42, 31, "blue_ink", 650)
    d.text("All earlier gates still apply", 1719, 41, 28, "blue_ink", anchor="end")

    # Connections are drawn first, then cards. Each rejoin has its own policy port.
    d.path("M296 244 H463", "ochre", 3, True, True)
    d.lines(["unclear /", "complex"], 383, 176, 26, 37,
            color="ochre", anchor="middle")
    d.path("M808 244 H1023", "ochre", 3, True, True)
    d.lines(["still complex", "+ facts complete", "+ policy eligible"], 919, 152, 26, 37,
            color="ochre", anchor="middle")
    d.path("M1300 244 H1437", "ochre", 3, True, True)
    d.lines(["proposal", "only"], 1372, 189, 26, 37,
            color="ochre", anchor="middle")

    # Routine, resolved clarification and validated review rejoin distinct ports.
    d.path("M156 308 V489 H701", "green", 3, True)
    d.text("routine", 345, 473, 28, "green", 650, "middle")
    d.path("M639 324 V386 H842 V429", "green", 3, True)
    d.text("resolved", 729, 370, 27, "green", 650, "middle")
    d.path("M1586 308 V364 H1100 V429", "green", 3, True)
    d.text("validated facts", 1330, 349, 27, "green", 650, "middle")

    d.rect(16, 168, 280, 140, "mint", "green", 25, 1.5)
    d.text("Route reason", 38, 211, 32, "green", 650,
           box=(34, 172, 244, 58))
    d.text("koa-action or Jev", 38, 260, 26, "green",
           box=(34, 230, 244, 58))

    d.rect(470, 152, 338, 172, "sand", radius=22)
    d.lines(["Clarify +", "policy precheck"], 492, 196, 31, 43,
            color="ochre", weight=650)
    d.text("One useful question", 492, 290, 27, "ochre")

    d.rect(1030, 168, 270, 140, "lilac", radius=25)
    d.text("Frontier LLM", 1052, 211, 31, "plum", 650)
    d.text("Scoped reasoning", 1052, 260, 26, "plum")

    d.rect(1444, 168, 284, 140, "sand", radius=22)
    d.text("Human review", 1466, 211, 31, "ochre", 650)
    d.text("Validate or hold", 1466, 260, 27, "ochre")

    # The model and human branches cannot connect directly to the commit step.
    d.rect(708, 436, 482, 106, "blue", radius=18)
    d.icon("policy", 727, 451, 36)
    d.text("Same policy + fee", 778, 477, 32, "ink", 650)
    d.text("Verified facts + loyalty tier", 732, 518, 27, "blue_ink")
    d.path("M1190 489 H1335", "blue_ink", 3, True)
    d.text("eligible", 1264, 472, 27, "blue_ink", 650, "middle")
    d.rect(1342, 436, 386, 106, "blue", radius=18)
    d.text("Confirm + create", 1364, 477, 31, "ink", 650)
    d.text("Recheck; commit once", 1364, 518, 27, "blue_ink")

    d.rect(0, 575, WIDTH, 45, "peach", radius=13)
    d.text("Known policy failure → decline. Missing facts or unresolved review → hold.",
           20, 607, 27, "rust", 550)
    d.save("returns-slide-fallback.svg")


if __name__ == "__main__":
    comparison()
    fallback()
