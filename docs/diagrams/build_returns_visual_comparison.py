#!/usr/bin/env python3
"""Build the pictorial return comparison without changing earlier artwork.

The two exports share the exact same illustrated body. The 1744 x 620 version
fits the tutorial; the 1900 x 900 poster adds a customer and the return request.
Labels are deliberately short. The blog, slide notes, and SVG description carry
the detailed workflow and qualification of this proposed architecture.

    python3 docs/diagrams/build_returns_visual_comparison.py
"""

from __future__ import annotations

from build_returns import C, Drawing
from returns_illustration_primitives import scene


DESCRIPTION = (
    "An illustrated comparison of the same product-return process. The blue "
    "service checkpoints are numbered clockwise: one verifies identity, two "
    "matches the receipt, three applies merchant policy, and four confirms and "
    "creates the authorized return label. On the left these scenes surround a "
    "large frontier-model engine. Paired purple arrows represent repeated "
    "consultations at the checkpoints, not parallel authorization of the return. "
    "The backend services remain authoritative. On the right the same scenes "
    "form a green directed path. After the receipt is matched, a smaller System "
    "One switch, proposed here as koa-action or Jev, classifies the reason before "
    "the policy service runs. A dashed branch marked Complex points to the "
    "separately illustrated exception path. That path clarifies and checks policy "
    "before considering frontier reasoning; its validated facts rejoin the same "
    "policy. The right-hand main route depicts a routine return only. AgentScript "
    "configures the Agent Graph flow; identity, purchase ownership, loyalty, "
    "eligibility, fee quotation, customer confirmation and the final write remain "
    "subject to trusted service checks in both architectures. Missing required "
    "facts cannot be supplied by model inference. No performance benchmark, "
    "actual merchant policy or native koa-action adapter is asserted."
)


def number(d, n, x, y):
    d.parts.append(f'<g data-component="checkpoint-{n}" data-kind="badge">')
    d.circle(x, y, 18, "blue", "blue_ink", 1.5)
    d.text(str(n), x, y + 8, 24, "blue_ink", 750, "middle")
    d.parts.append('</g>')


def checkpoint(d, n, kind, label, x, y, width, label_y):
    scene(d, kind, x, y, width)
    number(d, n, x + 9, y + 13)
    d.text(label, x + width / 2, label_y, 29, "ink", 650, "middle")


def green_path(d, path, *, arrow=True):
    d.parts.append('<g data-component="routine-route" data-kind="connector">')
    # A quiet mint underlay gives the direct route a legible visual identity.
    d.parts.append(
        f'<path d="{path}" fill="none" stroke="{C["mint"]}" '
        'stroke-width="18" stroke-opacity=".52" stroke-linecap="round" '
        'stroke-linejoin="round"/>'
    )
    d.path(path, "green", 4.2, arrow)
    d.parts.append('</g>')


def pictorial_body(d):
    # There are no workflow cards. The objects and their spatial relations carry
    # the explanation; labels identify them with at most two short words.
    d.text("Wrapper intelligence", 24, 40, 36, "plum", 700)
    d.text("Disaggregated intelligence", 918, 40, 36, "green", 700)
    d.path("M872 73 V566", "line", 1.5)
    d.parts.append(
        f'<ellipse cx="413" cy="315" rx="168" ry="152" '
        f'fill="{C["pale_lilac"]}" stroke="none"/>'
    )

    # Repeated consultations. Each service has a distinct outgoing and incoming
    # curve, so the central model is visibly revisited rather than acting once.
    for path in [
        "M302 260 C278 202 264 190 234 188",
        "M236 242 C261 272 267 288 293 300",
        "M526 260 C550 202 560 190 591 188",
        "M590 242 C566 272 560 288 534 300",
        "M528 365 C558 380 582 401 606 425",
        "M620 481 C578 450 558 409 530 399",
        "M298 365 C268 380 250 401 233 425",
        "M232 481 C266 450 275 409 299 399",
    ]:
        d.path(path, "plum", 3.8, True)

    # The four backend scenes have the same numbers and meanings in both panels.
    checkpoint(d, 1, "identity", "Verify identity", 44, 97, 188, 299)
    checkpoint(d, 2, "receipt", "Match receipt", 594, 97, 188, 299)
    checkpoint(d, 3, "policy", "Apply policy", 594, 350, 188, 554)
    checkpoint(d, 4, "parcel", "Create return", 44, 350, 188, 554)
    scene(d, "frontier", 279, 193, 268)
    d.text("Frontier LLM", 413, 476, 32, "plum", 700, "middle")
    d.text("Every step", 413, 519, 28, "plum", 600, "middle")

    # Direct routine route: identity -> receipt -> bounded reason decision ->
    # policy -> confirmed return. The switch is a smaller object than the engine.
    green_path(d, "M1104 198 H1160")
    green_path(d, "M1345 198 H1516")
    green_path(d, "M1643 220 H1692 Q1720 220 1720 248 V325 Q1720 350 1695 350 H1574 V373")
    green_path(d, "M1475 480 H1335")
    checkpoint(d, 1, "identity", "Verify identity", 920, 109, 180, 303)
    checkpoint(d, 2, "receipt", "Match receipt", 1170, 109, 180, 303)
    checkpoint(d, 3, "policy", "Apply policy", 1472, 370, 204, 589)
    checkpoint(d, 4, "parcel", "Create return", 1118, 370, 204, 589)
    scene(d, "system-one", 1498, 109, 164)
    d.text("System One", 1580, 288, 30, "green", 700, "middle")
    d.text("koa-action / Jev", 1580, 329, 27, "green", 500, "middle")
    d.text("Agent Graph", 1410, 447, 27, "green", 600, "middle")

    # The continuation is deliberately only a cue here. The separate fallback
    # illustration contains the full clarification, reasoning and review branch.
    d.path("M1580 120 V91 H1665", "ochre", 3, True, True)
    d.circle(1690, 91, 24, "sand", "ochre", 1.5)
    d.text("?", 1690, 102, 33, "ochre", 650, "middle")
    d.text("Complex?", 1709, 47, 26, "ochre", 650, "end")

    # This applies to both halves, rather than being a fifth execution step.
    d.text("Same safeguards", 872, 609, 28, "blue_ink", 650, "middle")


def comparison_slide():
    d = Drawing(1744, 620, "Repeated frontier calls or a direct graph", DESCRIPTION)
    pictorial_body(d)
    d.save("returns-slide-comparison-v2.svg")


def comparison_poster():
    d = Drawing(1900, 900, "One return, two ways to allocate intelligence", DESCRIPTION)
    scene(d, "customer", 45, 13, 214)
    d.text("One return. Two ways to allocate intelligence.", 290, 90, 54, "ink", 700)
    d.text("“I’d like to return these headphones.”", 290, 151, 34, "muted", 500)
    d.parts.append('<g transform="translate(78 246)">')
    pictorial_body(d)
    d.parts.append('</g>')
    d.save("returns-comparison-v2.svg")


if __name__ == "__main__":
    comparison_slide()
    comparison_poster()
