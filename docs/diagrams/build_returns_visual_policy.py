#!/usr/bin/env python3
"""Draw a pictorial, low-text explanation of the illustrative return policy.

Creates a 1744 × 620 slide-body asset and a 1900 × 900 titled poster.
Both use native SVG geometry, editable text, and embedded local Manrope fonts.
Run from any directory. The earlier returns-policy files are never modified.
"""
from __future__ import annotations

from pathlib import Path

from build_returns import C, Drawing
from returns_illustration_primitives import scene

HERE = Path(__file__).resolve().parent


def ellipse(d: Drawing, cx, cy, rx, ry, fill="line", opacity=.5):
    d.parts.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{C[fill]}" opacity="{opacity}"/>')


def line(d: Drawing, points, color="green", width=4, arrow=False, dash=False):
    d.path(points, color, width, arrow, dash)


def calendar(d: Drawing, x, y, tier, days, fill, ink):
    """An actual bound calendar page, with the tier printed on its header."""
    d.parts.append(f'<g data-component="calendar-{tier.lower()}-{days}" data-kind="illustration">')
    w, h = 236, 224
    ellipse(d, x+w/2+3, y+h+13, 104, 13, opacity=.42)
    d.rect(x+7, y+8, w, h, "line", radius=19)
    d.rect(x, y, w, h, "white", ink, radius=19, sw=2.5)
    d.parts.append(f'<path d="M{x+19} {y}H{x+w-19}Q{x+w} {y} {x+w} {y+19}V{y+58}H{x}V{y+19}Q{x} {y} {x+19} {y}Z" fill="{C[fill]}"/>')
    for dx in [51, 185]:
        line(d, f'M{x+dx} {y-11} V{y+16}', ink, 7)
    d.text(tier, x+w/2, y+42, 32, ink, 700, "middle")
    d.text("Within", x+w/2, y+96, 29, "muted", 550, "middle")
    d.text(str(days), x+w/2, y+169, 86, ink, 750, "middle")
    d.text("days", x+w/2, y+207, 30, "muted", 550, "middle")
    d.parts.append('</g>')


def shipping_label(d: Drawing, x, y, *, waived=False):
    """A perforated parcel label, with a large fee and a small barcode."""
    d.parts.append(f'<g data-component="shipping-{"waived" if waived else "five-dollars"}" data-kind="illustration">')
    w, h = 218, 170
    fill, ink = ("mint", "green") if waived else ("sand", "ochre")
    ellipse(d, x+w/2+2, y+h+10, 98, 11, opacity=.36)
    d.rect(x+5, y+6, w, h, "line", radius=12)
    d.rect(x, y, w, h, fill, ink, radius=12, sw=2)
    # Side perforations and a dashed tear strip make this a physical label.
    for side in [x, x+w]:
        d.circle(side, y+49, 8, "paper")
    line(d, f'M{x+9} {y+49} H{x+w-9}', ink, 1.3, dash=True)
    d.text("Shipping", x+w/2, y+35, 29, ink, 650, "middle")
    if waived:
        d.text("Waived", x+w/2, y+105, 45, ink, 750, "middle")
    else:
        d.text("$5", x+w/2, y+114, 78, ink, 750, "middle")
    bx = x+53
    for width in [3, 6, 2, 4, 2, 7, 3, 2, 5, 2, 3, 6, 2, 4, 3, 2, 5]:
        d.rect(bx, y+135, width, 20, ink, radius=0)
        bx += width + 3
    d.parts.append('</g>')


def late_example(d: Drawing):
    """A small, visually crossed late date; no extra policy paragraphs."""
    d.parts.append('<g data-component="standard-day-45-declined" data-kind="illustration">')
    x, y, w, h = 47, 471, 94, 103
    d.rect(x+4, y+5, w, h, "line", radius=11)
    d.rect(x, y, w, h, "white", "rust", radius=11, sw=2)
    d.rect(x, y, w, 25, "peach", radius=10)
    line(d, f'M{x+20} {y-6} V{y+10} M{x+74} {y-6} V{y+10}', "rust", 4)
    d.text("45", x+w/2, y+79, 51, "ink", 700, "middle")
    line(d, f'M{x+7} {y+h-4} L{x+w-6} {y+27}', "rust", 4)
    d.text("Standard", 162, 508, 30, "rust", 650)
    d.text("Too late → stop", 162, 550, 29, "rust", 650)
    d.parts.append('</g>')


def policy_art(d: Drawing, x=0, y=0):
    d.parts.append(f'<g transform="translate({x} {y})">')

    # Route beneath the objects. Both paths must pass the same final consent gate.
    line(d, "M328 294 H383 V154 H452", "blue_ink", 4, True)
    line(d, "M383 294 V454 H452", "blue_ink", 4, True)
    d.circle(383, 294, 6, "blue_ink")
    for cy in [154, 454]:
        line(d, f"M711 {cy} H812", "green", 4, True)
    line(d, "M1050 154 H1128 V294 H1192", "green", 4, True)
    line(d, "M1050 454 H1128 V294", "green", 4)
    d.circle(1128, 294, 6, "green")
    line(d, "M1361 294 H1433", "blue_ink", 4, True)

    # The input is pictured as an authenticated shopper beside a matched purchase.
    scene(d, "identity", 15, 199, 165)
    scene(d, "receipt", 140, 188, 210)
    d.text("Verified purchase", 183, 416, 32, "blue_ink", 650, "middle")

    calendar(d, 464, 44, "Standard", 30, "lilac", "plum")
    calendar(d, 464, 344, "Plus", 60, "mint", "green")
    d.text("Eligible", 761, 124, 28, "green", 650, "middle")
    d.text("Eligible", 761, 424, 28, "green", 650, "middle")
    shipping_label(d, 824, 69)
    shipping_label(d, 824, 369, waived=True)

    # A real person gives the confirmation; a separate service badge marks authority.
    scene(d, "customer", 1200, 205, 168)
    d.parts.append('<g data-component="customer-confirmation" data-kind="badge">')
    d.circle(1331, 250, 28, "mint", "green", 2)
    line(d, "M1318 250 L1327 259 L1344 240", "green", 4)
    d.parts.append('</g>')
    d.text("Confirm", 1279, 416, 34, "ink", 650, "middle")

    scene(d, "parcel", 1485, 199, 223)
    # The parcel passes a service approval gate. Its check is not the customer's check.
    d.parts.append('<g data-component="service-approval" data-kind="illustration" transform="translate(1428 257)">')
    d.parts.append(f'<path d="M29 0 55 9V34C55 53 44 66 29 76C14 66 3 53 3 34V9Z" fill="{C["blue"]}" stroke="{C["blue_ink"]}" stroke-width="2.5"/>')
    line(d, "M16 34 L26 44 L43 24", "blue_ink", 4)
    d.parts.append('</g>')
    d.text("Service approves", 1564, 416, 31, "blue_ink", 650, "middle")
    d.text("Return authorized", 1564, 462, 32, "green", 750, "middle")

    late_example(d)
    d.parts.append('</g>')


def build():
    description = (
        "Pictorial example of an invented merchant policy. A service-verified customer and matched purchase "
        "reach two loyalty calendars: Standard returns within thirty days have five-dollar shipping; "
        "Plus returns within sixty days have shipping waived. Fees apply only to eligible returns. "
        "Both paths converge on customer confirmation and then a separate service approval before a parcel "
        "is marked return authorized. A crossed Standard day-forty-five calendar shows that late requests stop. "
        "Days are measured from delivery to the original request time. Required facts that remain missing "
        "stay pending; human review and reasoning cannot override this illustrative policy."
    )
    slide = Drawing(1744, 620, "One return, two loyalty outcomes", description)
    policy_art(slide)
    slide.save("returns-slide-policy-v2.svg")

    poster = Drawing(1900, 900, "One return, two loyalty outcomes", description)
    poster.text("PRODUCT RETURNS  /  AN ILLUSTRATIVE POLICY", 78, 56, 24, "muted", 650, spacing=2)
    poster.text("One return. Two loyalty outcomes.", 76, 139, 70, "ink", 700)
    policy_art(poster, 78, 179)
    poster.text("Invented policy · Days since delivery · Shipping shown only for eligible returns", 78, 844, 28, "muted", 500)
    poster.save("returns-policy-v2.svg")


if __name__ == "__main__":
    build()
