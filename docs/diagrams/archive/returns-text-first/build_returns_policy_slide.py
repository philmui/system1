#!/usr/bin/env python3
"""A slide-sized reading of the policy in returns-policy.svg."""
from build_returns import Drawing

d = Drawing(1744, 620, "Illustrative return windows and shipping by loyalty tier",
    "All cases require verified identity, an owned matched receipt, a returnable item, sufficient unreturned quantity, and complete policy facts. A known failure declines; missing facts or a required manual review hold. Under this invented merchant policy, Standard requests within thirty days after delivery cost five dollars in shipping, and Plus requests within sixty days have shipping waived. The original request time is used. Standard day eighteen is eligible with five-dollar shipping. Plus day forty-five is eligible with waived shipping. Standard day forty-five is outside the window and does not escalate to a frontier model. Eligible cases still need customer confirmation and a successful backend write.")

d.rect(0, 0, 1744, 90, "blue", radius=14)
d.icon("shield", 22, 19, 42)
d.text("Verified identity + owned receipt + returnable item + available quantity", 84, 36, 30, "blue_ink", 650)
d.text("Missing facts or manual review → hold. Known policy failure → decline.", 84, 76, 26, "blue_ink")

d.rect(0, 109, 1744, 242, "white", "line", 18)
d.text("VERIFIED TIER", 26, 147, 22, "muted", 700, spacing=1.4)
d.text("REQUEST RECEIVED AFTER DELIVERY", 403, 147, 22, "muted", 700, spacing=1.4)
d.text("RETURN SHIPPING IF ELIGIBLE", 1110, 147, 22, "muted", 700, spacing=1.4)
d.path("M26 169 H1718", "muted", 1)
d.text("Standard", 28, 225, 38, weight=650)
d.text("Within 30 days, inclusive", 403, 225, 34)
d.text("Customer pays $5", 1110, 225, 38, weight=650)
d.path("M26 255 H1718", "line", 1)
d.text("Plus", 28, 315, 38, "green", 650)
d.text("Within 60 days, inclusive", 403, 315, 34)
d.text("Shipping waived", 1110, 315, 38, "green", 650)

cases = [
    (0, "gray", "Standard · day 18", "$5 shipping", "Eligible → confirm → authorize", "ink"),
    (590, "mint", "Plus · day 45", "Shipping waived", "Eligible → confirm → authorize", "green"),
    (1180, "peach", "Standard · day 45", "Outside the window", "Decline; no frontier escalation", "rust"),
]
for x, fill, title, outcome, detail, color in cases:
    d.rect(x, 386, 564, 164, fill, radius=18)
    d.text(title, x+23, 428, 28, color, 650)
    d.text(outcome, x+23, 482, 36, color, 650)
    d.text(detail, x+23, 525, 26, color)
d.text("The original request time determines the window; only a confirmed, successful service write authorizes the return.", 0, 602, 28, "muted")
d.save("returns-slide-policy.svg")
