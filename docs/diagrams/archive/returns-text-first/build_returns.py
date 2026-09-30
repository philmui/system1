#!/usr/bin/env python3
"""Build the editable product-return illustrations; no third-party dependencies.

Run from any directory: python3 docs/diagrams/build_returns.py
Font licenses live beside the bundled fonts in ../slides/assets/fonts.
This generator deliberately does not touch the earlier diagram exports.
"""

from __future__ import annotations

import base64
from html import escape
from pathlib import Path


HERE = Path(__file__).resolve().parent
FONTS = HERE.parent / "slides" / "assets" / "fonts"
C = {
    "paper": "#F7F8F3", "white": "#FFFFFF", "ink": "#243E42",
    "muted": "#52676A", "line": "#D5DFD9", "lilac": "#E8E0F3",
    "plum": "#665180", "mint": "#D7EBE1", "green": "#2E6653",
    "blue": "#E2EEF3", "blue_ink": "#355F72", "sand": "#F6EAC8",
    "ochre": "#7A6025", "peach": "#F4DFD3", "rust": "#81533E",
    "pale_lilac": "#F6F2FA", "pale_mint": "#F0F7F2", "gray": "#EFF2ED",
}


class Drawing:
    def __init__(self, width: int, height: int, title: str, description: str):
        self.width, self.height = width, height
        manrope = base64.b64encode((FONTS / "Manrope.woff2").read_bytes()).decode()
        mono = base64.b64encode((FONTS / "IBMPlexMono.woff2").read_bytes()).decode()
        self.parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
            f'<title id="title">{escape(title)}</title><desc id="desc">{escape(description)}</desc>',
            '<defs><style>',
            f'@font-face{{font-family:Manrope;src:url(data:font/woff2;base64,{manrope}) format("woff2");font-weight:200 800;font-style:normal;}}',
            f'@font-face{{font-family:Plex;src:url(data:font/woff2;base64,{mono}) format("woff2");font-weight:400;font-style:normal;}}',
            'text{font-family:Manrope,Arial,sans-serif;font-feature-settings:"ss01" 1;}',
            '</style>',
        ]
        for name in ["ink", "plum", "green", "ochre", "blue_ink", "rust", "muted"]:
            self.parts.append(
                f'<marker id="arrow-{name}" markerWidth="10" markerHeight="10" '
                f'refX="8.5" refY="5" orient="auto" markerUnits="userSpaceOnUse">'
                f'<path d="M1 1 L8.5 5 L1 9" fill="none" stroke="{C[name]}" '
                'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></marker>'
            )
        self.parts += ['</defs>']
        self.rect(0, 0, width, height, "paper", radius=0)

    def rect(self, x, y, w, h, fill="white", stroke=None, radius=20, sw=2):
        a = f' stroke="{C.get(stroke, stroke)}" stroke-width="{sw}"' if stroke else ""
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{C.get(fill, fill)}"{a}/>')

    def circle(self, x, y, r, fill="white", stroke=None, sw=2):
        a = f' stroke="{C.get(stroke, stroke)}" stroke-width="{sw}"' if stroke else ""
        self.parts.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{C.get(fill, fill)}"{a}/>')

    def path(self, path, color="ink", sw=3, arrow=False, dash=False, fill="none"):
        a = f' marker-end="url(#arrow-{color})"' if arrow else ""
        a += ' stroke-dasharray="8 9"' if dash else ""
        self.parts.append(f'<path d="{path}" fill="{C.get(fill, fill)}" stroke="{C[color]}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"{a}/>')

    def text(self, text, x, y, size=30, color="ink", weight=500, anchor="start", mono=False, spacing=0, box=None, rotate=None):
        attrs = f' font-family="Plex,monospace" style="font-family:Plex,monospace"' if mono else ""
        attrs += f' letter-spacing="{spacing}"' if spacing else ""
        attrs += f' data-box="{",".join(map(str, box))}"' if box else ""
        attrs += f' transform="rotate({rotate} {x} {y})"' if rotate else ""
        self.parts.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="{C[color]}"{attrs}>{escape(text)}</text>')

    def lines(self, lines, x, y, size=28, leading=39, **kwargs):
        for i, line in enumerate(lines):
            self.text(line, x, y + i * leading, size, **kwargs)

    def badge(self, text, x, y, w, fill, color, size=23, h=40):
        self.rect(x, y, w, h, fill, radius=h / 2)
        self.text(text, x + w / 2, y + h * .70, size, color, 650, "middle", box=(x+6, y+4, w-12, h-8))

    def icon(self, kind, x, y, size=44, color="blue_ink"):
        self.parts.append(f'<g transform="translate({x} {y}) scale({size / 48})" fill="none" stroke="{C[color]}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">')
        shapes = {
            "shield": '<path d="M24 4 40 10v12c0 10-6 17-16 22C14 39 8 32 8 22V10Z"/><path d="m16 24 6 6 11-13"/>',
            "receipt": '<path d="M11 5h26v39l-6-4-7 4-7-4-6 4Z"/><path d="M18 14h12M18 22h12M18 30h5"/>',
            "branch": '<path d="M10 24h13m0 0V10h14m-14 14v14h14"/><circle cx="8" cy="24" r="4"/><circle cx="40" cy="10" r="4"/><circle cx="40" cy="38" r="4"/>',
            "policy": '<path d="M8 7h32v34H8Z"/><path d="m14 17 3 3 5-6m-8 17 3 3 5-6M28 18h6M28 31h6"/>',
            "package": '<path d="m5 14 19-9 19 9v23l-19 9L5 37Zm0 0 19 10 19-10M24 24v22M14 10l19 10v10"/>',
            "model": '<rect x="11" y="11" width="26" height="26" rx="7"/><path d="M18 3v8M30 3v8M18 37v8M30 37v8M3 18h8M3 30h8M37 18h8M37 30h8"/><path d="m18 27 6-11 6 11m-10-3h8"/>',
            "question": '<path d="M17 16c0-10 17-10 17 0 0 6-10 5-10 13"/><circle cx="24" cy="37" r="1.5"/><circle cx="24" cy="24" r="21"/>',
            "review": '<path d="M8 7h27v14M8 7v35h18M15 15h13M15 23h8"/><circle cx="32" cy="30" r="8"/><path d="m38 36 7 7"/>',
            "check": '<path d="m9 25 10 10L39 13"/>',
            "clock": '<circle cx="24" cy="24" r="19"/><path d="M24 12v13l9 6"/>',
            "stop": '<path d="m15 5-10 10v18l10 10h18l10-10V15L33 5Z"/><path d="m17 17 14 14M31 17 17 31"/>',
            "person": '<circle cx="24" cy="14" r="8"/><path d="M8 43v-7c0-16 32-16 32 0v7"/>',
        }
        self.parts.append(shapes[kind])
        self.parts.append('</g>')

    def service(self, x, y, w, number, title, description, icon, h=130, fill="blue", color="blue_ink"):
        self.rect(x, y, w, h, fill, radius=17)
        self.icon(icon, x + 24, y + 39, 48, color)
        box = (x + 94, y + 15, w - 142, h - 30)
        self.text(title, x + 96, y + 51, 34, weight=650, box=box)
        self.text(description, x + 96, y + 96, 25, color, box=box)
        self.text(number, x + w - 23, y + 28, 19, color, anchor="end", mono=True)

    def save(self, name):
        out = HERE / name
        out.write_text("\n".join(self.parts + ['</svg>', '']), encoding="utf-8")
        print(f"Wrote {out.relative_to(HERE.parent.parent)} ({self.width} × {self.height})")


def comparison():
    d = Drawing(2800, 1920, "Disaggregated intelligence: the same product return, two architectures",
        "Two aligned return workflows keep the same trusted services. On the left, a frontier language model selects each next step: authentication, receipt matching, reason routing, policy and fee, and confirmed return creation. On the right, AgentScript configures an Agent Graph workflow. Services authenticate and match the purchase, a proposed koa-action or Jev decision node classifies routine, unclear, or complex return reasons, and code enforces the policy. Routine handling avoids frontier inference. The side branch clarifies and prechecks policy first; unresolved complexity may use frontier reasoning. A human validates the proposal or holds the case. Only validated facts re-enter policy, and only a successful service write authorizes a return. Authentication failure, receipt mismatch, known policy failure, and missing required facts cannot be bypassed. Illustrative policy: Standard returns within 30 days cost five dollars in shipping; Plus returns within 60 days have shipping waived. Both require eligibility and confirmation. No performance measurement or native model adapter is asserted.")

    d.text("ENTERPRISE AGENTS  /  PRODUCT RETURNS", 88, 55, 24, "muted", 650, spacing=3)
    d.text("The right intelligence for every return.", 84, 166, 90, weight=650)
    d.text("Disaggregated intelligence puts routine control in the graph and reserves frontier reasoning for difficult cases.", 88, 226, 32, "muted")
    d.rect(88, 272, 2624, 92, "white", "line", 18)
    d.icon("package", 117, 293, 47)
    d.text("“I want to return these headphones.”", 188, 330, 36, weight=550)
    d.text("Same request. Same backend safeguards.", 2678, 328, 28, "muted", anchor="end")

    d.rect(88, 407, 1280, 1163, "white", "line", 26)
    d.rect(1432, 407, 1280, 1163, "white", "line", 26)
    d.badge("01", 122, 439, 54, "lilac", "plum", 22, 38)
    d.text("WRAPPER INTELLIGENCE", 192, 467, 24, "plum", 700, spacing=2)
    d.text("Frontier at every decision", 122, 524, 48, weight=650)
    d.text("The model repeatedly chooses the next step.", 122, 575, 27, "muted")
    d.badge("02", 1466, 439, 54, "mint", "green", 22, 38)
    d.text("DISAGGREGATED INTELLIGENCE", 1536, 467, 24, "green", 700, spacing=2)
    d.text("Specialized judgment + graph", 1466, 524, 48, weight=650)
    d.text("AgentScript defines the flow · Agent Graph executes it.", 1466, 575, 27, "muted")

    rows = [626, 802, 978, 1154, 1330]
    # The wrapper calls the same frontier model at each illustrated decision.
    for i, y in enumerate(rows):
        d.path(f"M430 {y+65} H493", "plum", 3, True)
        if i < len(rows) - 1:
            # Service output becomes context for the next frontier decision.
            d.path(f"M538 {y+130} V{y+151} H278 V{rows[i+1]+12}", "plum", 2.5, True)
        d.rect(122, y+13, 308, 104, "lilac", radius=30)
        d.icon("model", 141, y+43, 38, "plum")
        d.text("Frontier LLM", 197, y+59, 28, "plum", 650, box=(190,y+20,230,89))
        d.text("select next step", 197, y+92, 21, "plum", box=(190,y+20,230,89))

    labels = [
        ("01", "Authenticate", "Identity service verifies the session.", "shield"),
        ("02", "Match receipt", "Order service verifies ownership + item.", "receipt"),
        ("03", "Route the reason", "Model output: routine handling or review.", "branch"),
        ("04", "Apply policy + fee", "Verified tier, delivery date + item rules.", "policy"),
        ("05", "Confirm + authorize", "Confirm quote; recheck policy; create once.", "package"),
    ]
    for y, (n, title, desc, icon) in zip(rows, labels):
        d.service(500, y, 834, n, title, desc, icon, fill="pale_lilac" if n == "03" else "blue", color="plum" if n == "03" else "blue_ink")
    d.text("Each result becomes context for another frontier call.", 122, 1523, 27, "plum")

    # Authored graph: trusted services are deliberately the same blue cards.
    for i in range(4):
        d.path(f"M1844 {rows[i]+130} V{rows[i+1]-7}", "green", 3, True)
    for i in [0, 1, 3, 4]:
        n, title, desc, icon = labels[i]
        if i == 4:
            desc = "Confirm quote; recheck policy; create once."
        d.service(1470, rows[i], 748, n, title, desc, icon)

    y = rows[2]
    d.rect(1470, y, 748, 130, "mint", "green", 28, 1.5)
    d.icon("branch", 1494, y+42, 48, "green")
    d.text("Route the reason", 1566, y+43, 33, "green", 650)
    d.text("koa-action or Jev", 1566, y+82, 27, "green", mono=True)
    d.text("Bounded labels: routine / unclear / complex", 1566, y+113, 23, "green")
    d.text("03", 2195, y+28, 19, "green", anchor="end", mono=True)
    d.text("routine", 1870, 1138, 21, "green", 650)

    # The side branch is secondary in visual weight and never bypasses policy.
    d.path("M2221 1043 H2331", "ochre", 2.5, True, True)
    d.text("unclear /", 2273, 995, 24, "ochre", anchor="middle")
    d.text("complex", 2273, 1028, 24, "ochre", anchor="middle")
    d.rect(2338, 978, 338, 130, "sand", radius=20)
    d.text("Clarify + precheck", 2359, 1023, 28, "ochre", 650)
    d.text("One answer + policy checks", 2359, 1060, 22, "ochre")
    d.text("Missing facts → hold", 2359, 1089, 22, "ochre")
    d.path("M2507 1109 V1116", "ochre", 2.5, dash=True)
    d.text("still complex + eligible", 2507, 1149, 24, "ochre", anchor="middle")
    d.path("M2507 1158 V1169", "ochre", 2.5, True)

    # Resolved clarification rejoins the routine policy path without a frontier call.
    d.path("M2350 1108 V1129 H2270 V1219 H2225", "green", 2.3, True)
    d.badge("resolved", 2209, 1106, 130, "white", "green", 24, 44)
    d.path("M2270 1162 V1194", "green", 2.3, True)
    d.rect(2338, 1177, 338, 125, "lilac", radius=28)
    d.icon("model", 2358, 1206, 40, "plum")
    d.text("Frontier LLM", 2414, 1227, 28, "plum", 650)
    d.text("Scoped complex reasoning", 2359, 1270, 23, "plum")
    d.path("M2507 1304 V1310", "ochre", 2.5, dash=True)
    d.text("proposal only", 2507, 1339, 24, "ochre", anchor="middle")
    d.path("M2507 1350 V1359", "ochre", 2.5, True)
    d.rect(2338, 1365, 338, 122, "sand", radius=20)
    d.text("Human review", 2359, 1405, 28, "ochre", 650)
    d.text("Validated → policy", 2359, 1441, 23, "ochre")
    d.text("Unresolved → hold", 2359, 1473, 23, "ochre")
    d.path("M2337 1426 H2270 V1219 H2225", "green", 2.3, True)
    d.path("M2270 1395 V1289", "green", 2.3, True)
    d.circle(2270, 1219, 4.5, "green")
    d.text("Routine path: one bounded model decision.", 1466, 1523, 27, "green")

    # The shared contract explains both panels; it is not another execution path.
    d.rect(88, 1610, 2624, 210, "blue", radius=24)
    d.text("SERVICE-ENFORCED IN BOTH", 120, 1653, 22, "blue_ink", 750, spacing=2)
    d.text("A model proposes. The backend authorizes.", 120, 1702, 38, "ink", 650)
    d.text("Unverified → sign in   ·   Receipt mismatch → verify   ·   Ineligible → decline", 120, 1746, 27, "blue_ink")
    d.text("Denied access stops; unknown facts stay pending. A successful write issues the return ID.", 120, 1787, 25, "blue_ink")
    d.path("M1720 1640 V1790", "blue_ink", 1)
    d.text("ILLUSTRATIVE MERCHANT POLICY", 1760, 1653, 22, "blue_ink", 750, spacing=1.4)
    d.text("Standard", 1760, 1707, 29, "ink", 650)
    d.text("≤30 days · $5 shipping", 2676, 1707, 29, "blue_ink", anchor="end")
    d.text("Plus", 1760, 1758, 29, "ink", 650)
    d.text("≤60 days · shipping waived", 2676, 1758, 29, "blue_ink", anchor="end")
    d.text("Eligible items only. Customer confirms the quoted fee.", 1760, 1793, 22, "blue_ink")

    for x, fill, label in [(88,"lilac","Frontier inference"),(454,"mint","Bounded judgment"),(824,"blue","Trusted service"),(1164,"sand","Clarification / review")]:
        d.rect(x, 1860, 22, 22, fill, radius=6)
        d.text(label, x+35, 1879, 23, "muted")
    d.text("Conceptual design · Measure cost, latency and errors on real traffic.", 2712, 1879, 23, "muted", anchor="end")
    d.save("returns-comparison.svg")


def policy():
    d = Drawing(2400, 2140, "How the return policy and reasoning fallback work",
        "The worked example uses an invented two-tier merchant policy. A verified session and an owned, matched receipt are prerequisites. A bounded System One model routes the return reason; routine cases go to policy. An unclear or complex case first collects at most one useful clarification and runs a cheap policy precheck. Known policy failures decline. Missing facts or model failures wait for verification or human handling, not more reasoning. Only substantive residual complexity with known eligibility may invoke a frontier model. Its recommendation goes to human review. Validated facts return to the same policy; unresolved cases remain pending. Policy requires a returnable item, sufficient unreturned quantity, complete facts and no manual hold. Standard: received within thirty days after delivery, five-dollar shipping. Plus: received within sixty days, shipping waived. The customer confirms the quote; the backend rechecks authorization, current policy and quantity before creating the return once. Only a service-issued return ID is success. An unknown write outcome is reconciled before retrying. The illustrated outcomes are Standard day eighteen accepted with paid shipping, Plus day forty-five accepted with shipping waived, and Standard day forty-five declined. These are invented examples, not observed performance results.")
    d.text("WORKED EXAMPLE  /  ILLUSTRATIVE MERCHANT POLICY", 88, 68, 23, "muted", 650, spacing=2.5)
    d.text("The policy decides the return and the fee.", 84, 159, 76, weight=650)
    d.text("Inside the disaggregated flow, with service safeguards shared by both architectures.", 88, 216, 31, "muted")

    # Shared gate chain, with explicit failure destinations immediately below.
    d.service(88, 265, 685, "01", "Authenticate", "Verified session + account permissions", "shield", 130)
    d.path("M780 330 H851", "ink", 3, True)
    d.service(858, 265, 685, "02", "Match receipt", "Owned order + item + available quantity", "receipt", 130)
    d.path("M1551 330 H1621", "ink", 3, True)
    d.rect(1628, 265, 684, 130, "mint", "green", 28, 1.5)
    d.icon("branch", 1652, 304, 48, "green")
    d.text("Route the reason", 1723, 315, 34, "green", 650)
    d.text("koa-action or Jev · bounded labels", 1723, 359, 25, "green")
    d.text("03", 2289, 293, 19, "green", anchor="end", mono=True)
    d.text("Unverified → secure sign-in; denied → stop.", 88, 437, 25, "rust")
    d.text("Missing / mismatch → verification, no return.", 858, 437, 25, "rust")
    d.text("Routine → policy. Unclear / complex → lane below.", 1628, 437, 24, "green")

    # The side-lane detail is displayed as a horizontal sequence for close reading.
    d.rect(88, 479, 2224, 387, "white", "line", 24)
    d.text("THE EXCEPTION LANE", 119, 527, 22, "ochre", 750, spacing=2)
    d.text("Clarification and cheap checks come before frontier reasoning.", 119, 572, 34, weight=650)
    d.rect(119, 603, 591, 145, "sand", radius=18)
    d.text("Clarify + policy precheck", 143, 647, 31, "ochre", 650)
    d.lines(["Ask one useful question; verify known facts.", "Resolved → policy. Ineligible → decline."], 143, 690, 24, 32, color="ochre")
    d.path("M720 674 H869", "ochre", 3, True, True)
    d.text("still complex", 795, 637, 21, "ochre", anchor="middle")
    d.text("+ eligible", 795, 665, 21, "ochre", anchor="middle")
    d.rect(878, 603, 560, 145, "lilac", radius=28)
    d.icon("model", 903, 646, 46, "plum")
    d.text("Frontier reasoning", 971, 651, 33, "plum", 650)
    d.text("Authorized facts + remaining question", 971, 695, 24, "plum")
    d.path("M1448 674 H1620", "ochre", 3, True, True)
    d.text("proposal", 1537, 650, 21, "ochre", anchor="middle")
    d.rect(1628, 603, 651, 145, "sand", radius=18)
    d.icon("review", 1651, 647, 45, "ochre")
    d.text("Human validates the facts", 1715, 647, 31, "ochre", 650)
    d.lines(["Validated → same policy. Unresolved → hold.", "The model cannot authorize an exception."], 1715, 690, 23, 32, color="ochre")
    d.text("Missing facts → pending verification. A timeout or invalid model output → bounded retry, then human handling.", 119, 797, 25, "muted")
    d.text("No reasoning branch can bypass authentication, purchase ownership or the merchant’s policy.", 119, 836, 25, "muted")

    d.text("04", 88, 941, 25, "blue_ink", mono=True)
    d.text("Apply policy to trusted facts", 146, 945, 45, weight=650)
    d.text("Tier comes from the membership service; delivery and request timestamps come from trusted records.", 88, 991, 28, "muted")

    # Prerequisites are distinct from the tier table; the fee is scoped to eligible returns.
    d.rect(88, 1022, 2224, 99, "blue", radius=18)
    d.icon("policy", 113, 1047, 46)
    d.text("Returnable item", 187, 1061, 29, "blue_ink", 650)
    d.text("Sufficient unreturned quantity", 660, 1061, 29, "blue_ink", 650)
    d.text("Complete facts; no manual hold", 1440, 1061, 29, "blue_ink", 650)
    d.text("All prerequisites must pass. A missing fact stays pending; a known failure declines the standard request.", 187, 1100, 26, "blue_ink")

    # The central table is the quantitative content of the figure.
    d.rect(88, 1153, 2224, 285, "white", "line", 20)
    d.text("VERIFIED TIER", 121, 1200, 21, "muted", 750, spacing=1.5)
    d.text("REQUEST RECEIVED AFTER DELIVERY", 610, 1200, 21, "muted", 750, spacing=1.5)
    d.text("RETURN SHIPPING, IF ELIGIBLE", 1470, 1200, 21, "muted", 750, spacing=1.5)
    d.path("M120 1224 H2280", "muted", 1)
    d.rect(113, 1241, 408, 69, "gray", radius=15)
    d.text("Standard", 144, 1288, 36, weight=650)
    d.text("Within 30 days, inclusive", 610, 1288, 33)
    d.text("$5 paid by customer", 1470, 1288, 36, weight=650)
    d.path("M120 1325 H2280", "line", 1)
    d.rect(113, 1345, 408, 69, "mint", radius=15)
    d.text("Plus", 144, 1392, 36, "green", 650)
    d.text("Within 60 days, inclusive", 610, 1392, 33)
    d.text("Waived", 1470, 1392, 36, "green", 650)
    d.text("Preserve the original request time through clarification. An unknown tier never defaults to Standard.", 88, 1480, 25, "muted")

    # Three concrete, matched examples. No invented benchmark presentation.
    cases = [
        (88, "gray", "A", "Standard · day 18", "$5 shipping", "Eligible → confirm → authorize", "ink"),
        (842, "mint", "B", "Plus · day 45", "Shipping waived", "Eligible → confirm → authorize", "green"),
        (1596, "peach", "C", "Standard · day 45", "Outside return window", "Decline · no frontier escalation", "rust"),
    ]
    for x, fill, letter, heading, outcome, note, color in cases:
        d.rect(x, 1523, 716, 176, fill, radius=20)
        d.badge(letter, x+23, 1547, 36, "white", color, 19, 33)
        d.text(heading, x+77, 1572, 28, color, 650)
        d.text(outcome, x+25, 1627, 36, color, 650)
        d.text(note, x+25, 1670, 25, color)
    d.text("Worked cases assume verified identity, an owned receipt and all other prerequisites satisfied.", 88, 1740, 25, "muted")

    d.rect(88, 1782, 2224, 255, "blue", radius=24)
    d.text("05", 118, 1832, 24, "blue_ink", mono=True)
    d.text("Confirm the quote. Recheck. Create once.", 176, 1838, 43, weight=650)
    d.text("The customer accepts the quoted fee before the return service revalidates access, policy and available quantity.", 119, 1890, 27, "blue_ink")
    d.badge("SUCCESS", 119, 1923, 132, "mint", "green", 20, 36)
    d.text("Service-issued return ID + the confirmed shipping label", 274, 1951, 29, "blue_ink", 650)
    d.text("No reply → wait. Cancel → stop. Unknown write outcome → reconcile before retrying. Changed quote → reconfirm.", 119, 2001, 25, "blue_ink")
    d.text("Return authorization is the endpoint shown here; inspection and any refund settlement happen later.", 88, 2090, 25, "muted")
    d.text("Original teaching example · No actual customer data", 2312, 2122, 20, "muted", anchor="end")
    d.save("returns-policy.svg")


if __name__ == "__main__":
    comparison()
    policy()
