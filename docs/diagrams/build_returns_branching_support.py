#!/usr/bin/env python3
"""Add scoped policy and reusable objects for the branching return tutorial.

The earlier illustrations remain unchanged. These named SVG components use
the same native-vector vocabulary as the access and request-routing pictures.
Run from any directory with Python 3; no third-party modules are required.
"""
from __future__ import annotations

from build_returns import Drawing
from build_returns_visual_policy import policy_art
from returns_branching_primitives import scene


POLICY_DESCRIPTION = (
    "Illustrative merchant policy for whole-item returns only. An authenticated "
    "customer and an owned, matched purchase reach the applicable whole-item "
    "return policy. A returnable item and unreturned quantity are also required. "
    "Standard requests within thirty days of delivery have five-dollar return "
    "shipping; Plus requests within sixty days have shipping waived. These "
    "invented windows include their last day and use the original request time. "
    "Shipping terms apply only after eligibility is established. A Standard "
    "request on day forty-five is declined. Each eligible quote requires the "
    "customer's confirmation, an authoritative recheck and an idempotent service "
    "write. The service result authorizes the return; it does not mean the parcel "
    "has been shipped or a refund has settled. Missing facts remain pending. "
    "This example does not define exchange policy, stock availability, price "
    "differences, or partial-kit return rules. Each of those requires its own "
    "configured handler and authoritative checks. Model or human interpretation "
    "cannot waive these conditions."
)


def label(d, name, text, x, y, size=30, color="ink", weight=650, anchor="middle"):
    d.parts.append(f'<g data-component="{name}" data-kind="label">')
    d.text(text, x, y, size, color, weight, anchor)
    d.parts.append('</g>')


def scope_tag(d):
    """Use the policy diagram's empty upper-left area without shrinking it."""
    d.parts.append('<g data-component="whole-item-policy-scope" data-kind="badge">')
    d.rect(22, 49, 368, 61, "blue", "blue_ink", 16, 1.5)
    d.parts.append('</g>')
    label(d, "whole-item-policy-scope-label", "Whole-item returns only", 206, 89,
          26, "blue_ink", 700)
    label(d, "invented-policy-label", "Invented policy", 206, 149,
          25, "muted", 500)


def policy_body(d, x=0, y=0):
    d.parts.append(f'<g transform="translate({x} {y})">')
    policy_art(d)
    scope_tag(d)
    d.parts.append('</g>')


def build_policy():
    slide = Drawing(1744, 620, "Whole-item returns: an invented loyalty policy", POLICY_DESCRIPTION)
    policy_body(slide)
    slide.save("returns-slide-whole-item-policy.svg")

    poster = Drawing(1900, 900, "Whole-item returns: two loyalty outcomes", POLICY_DESCRIPTION)
    label(poster, "policy-kicker", "WHOLE-ITEM RETURNS  /  AN ILLUSTRATIVE POLICY", 78, 56,
          24, "muted", 650, "start")
    label(poster, "policy-title", "Whole-item returns. Two loyalty outcomes.", 76, 139,
          65, "ink", 700, "start")
    policy_body(poster, 78, 179)
    label(poster, "policy-footer", "Days since delivery · Eligible items only · Exchanges and kit parts have separate rules",
          78, 852, 27, "muted", 500, "start")
    poster.save("returns-whole-item-policy.svg")


def build_library():
    description = (
        "A reusable vocabulary for the branching return tutorial. Twelve original "
        "vector objects depict the identity gate, secure sign-in, a whole purchased "
        "kit, an exchange, a component within a kit, inventory, a System One model, "
        "a frontier model, a human reviewer, a customer, an authoritative service "
        "result and a held case. Labels are independent named vector components. "
        "The neutral identity gate does not imply successful authentication. "
        "The kit-part object shows a component from the original kit, not a "
        "separately purchased cable. The service result records an authorized "
        "request, not completed shipping or settlement. In the PowerPoint edition, "
        "these objects can be selected, copied, moved and resized individually."
    )
    d = Drawing(1744, 620, "Reusable objects for a branching return workflow", description)
    items = [
        ("auth", "Identity gate"),
        ("signin", "Sign in"),
        ("whole-kit", "Whole kit"),
        ("exchange", "Exchange"),
        ("kit-part", "Kit part"),
        ("inventory", "Inventory"),
        ("system-one", "System One"),
        ("frontier", "Frontier LLM"),
        ("review", "Human review"),
        ("customer", "Customer"),
        ("commit", "Service result"),
        ("hold", "Hold"),
    ]
    for i, (kind, caption) in enumerate(items):
        x, y = 24 + (i % 6) * 286, 29 + (i // 6) * 292
        scene(d, kind, x + 34, y, 194)
        label(d, f"library-label-{kind}", caption, x + 131, y + 229, 30)
    d.save("returns-branching-component-library.svg")


if __name__ == "__main__":
    build_policy()
    build_library()
