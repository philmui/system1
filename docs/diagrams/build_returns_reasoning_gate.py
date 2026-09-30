#!/usr/bin/env python3
"""Expand the optional interpretation route without turning it into authority."""
from build_returns import Drawing
from returns_branching_primitives import scene
from build_returns_branching_routes import edge, portal


DESCRIPTION = (
    'Reasoning gate C expands the interpretation detour shown on page B. Identity and owned purchase '
    'are already service-verified. A clear request goes to the authored supported-combination mapping '
    'and its applicable handler. Unclear meaning receives a bounded useful clarification. Resolved '
    'meaning returns to that same mapping without frontier reasoning. Before any frontier attempt, '
    'authorized services establish required facts and check known mandatory rules for the affected '
    'route. The precheck is branch-aware: a whole-item return deadline is not an exchange or kit-part '
    'rule. Known ineligibility follows the applicable denial; missing evidence holds. Only remaining '
    'interpretation difficulty with the relevant facts and checks satisfied can reach a scoped '
    'frontier attempt. Its proposed task structure, including AND, OR and IF relationships, goes to '
    'human validation or hold. A validated proposal re-enters the same supported-combination mapping '
    'and its applicable service rules; an unsupported combination goes to configured specialist '
    'handling. Only selected, eligible tasks proceed to confirmed terms and an authoritative service '
    'write. A clear exchange, kit-component return, multiple task request or familiar condition does '
    'not itself need a frontier model. Models and human reviewers cannot supply missing authority, '
    'invent policy, override failed checks or treat an unknown stock result as false. This is a '
    'proposed teaching workflow, without a claimed native adapter or measured performance gain.'
)


def art(d):
    portal(d, 'C', 30, 31, 'ochre', 'sand')
    d.text('Verified access + purchase', 65, 42, 27, 'blue_ink', 600)

    # All interpreted requests meet the same authored mapping and route rules.
    edge(d, 'M132 397 V496 H974', 'green', 4.5)
    d.text('Clear meaning', 470, 479, 29, 'green', 650, 'middle')
    edge(d, 'M218 316 H270 V193 H309', 'ochre', 3.5, True, True)
    d.text('Unclear?', 246, 161, 27, 'ochre', 600, 'middle')
    edge(d, 'M495 192 H575', 'ochre', 3.5, True, True)
    edge(d, 'M744 192 H851', 'ochre', 3.5, True, True)
    d.text('Ready', 800, 169, 25, 'green', 650, 'middle')
    edge(d, 'M1081 186 H1247', 'plum', 3.5, True, True)
    d.text('Proposal', 1165, 163, 26, 'plum', 550, 'middle')

    edge(d, 'M334 267 V425 H958 V496', 'green', 3.5, False)
    d.circle(958, 496, 5, 'green')
    d.text('Resolved', 840, 405, 27, 'green', 650, 'middle')
    edge(d, 'M1260 274 H1222 V353 H1065 V408', 'green', 3.5)
    d.text('Validated', 1135, 336, 27, 'green', 650, 'middle')
    edge(d, 'M1460 218 H1538', 'ochre', 3)
    edge(d, 'M661 263 V325 H599 V345', 'rust', 2.5)
    edge(d, 'M661 325 H720 V345', 'ochre', 2.5)

    scene(d, 'system-one', 38, 244, 194)
    d.text('System One', 136, 232, 29, 'green', 650, 'middle')
    scene(d, 'clarify', 310, 98, 194)
    d.text('Clarify', 407, 303, 32, 'ochre', 650, 'middle')
    scene(d, 'policy', 572, 103, 181)
    d.text('Facts + checks', 661, 84, 30, 'blue_ink', 650, 'middle')
    scene(d, 'frontier', 852, 78, 239)
    d.text('Meaning unresolved?', 971, 51, 27, 'plum', 650, 'middle')
    d.text('Frontier LLM', 971, 318, 32, 'plum', 650, 'middle')
    scene(d, 'review', 1244, 91, 215)
    d.text('Human review', 1350, 319, 32, 'ochre', 650, 'middle')
    scene(d, 'hold', 1540, 190, 64)
    d.text('Hold', 1572, 285, 27, 'ochre', 650, 'middle')
    scene(d, 'stop', 570, 343, 57)
    scene(d, 'hold', 691, 343, 57)
    d.text('Decline', 599, 412, 25, 'rust', 650, 'middle')
    d.text('Hold', 719, 412, 25, 'ochre', 650, 'middle')

    scene(d, 'tasks', 980, 408, 174)
    d.text('Route + rules', 1066, 596, 31, 'blue_ink', 650, 'middle')
    edge(d, 'M1157 495 H1265', 'blue_ink', 3.5)
    d.text('Eligible', 1212, 463, 24, 'green', 600, 'middle')
    scene(d, 'customer', 1268, 417, 157)
    d.parts.append('<g data-component="confirmed-terms" data-kind="badge">')
    d.circle(1403, 465, 22, 'mint', 'green', 2)
    d.path('M1392 465 L1400 473 L1414 454', 'green', 4)
    d.parts.append('</g>')
    d.text('Confirm terms', 1350, 596, 30, 'ink', 650, 'middle')
    edge(d, 'M1428 495 H1510', 'blue_ink', 3.5)
    scene(d, 'commit', 1502, 400, 190)
    d.text('Service result', 1597, 596, 30, 'green', 650, 'middle')


def build():
    slide = Drawing(1744, 620, 'Reserve frontier reasoning for unresolved meaning', DESCRIPTION)
    art(slide)
    slide.save('returns-slide-reasoning-gate.svg')
    poster = Drawing(1900, 900, 'Reserve frontier reasoning for unresolved meaning', DESCRIPTION)
    poster.text('DISAGGREGATED INTELLIGENCE  /  THE EXCEPTION PATH', 78, 53, 24, 'muted', 650, spacing=2)
    poster.text('Reserve frontier reasoning for unresolved meaning.', 76, 132, 60, 'ink', 700)
    poster.parts.append('<g transform="translate(78 190)">')
    art(poster)
    poster.parts.append('</g>')
    poster.text('Validated interpretations return to the allowed route and its rules; required facts still come from services.', 78, 856, 27, 'muted')
    poster.save('returns-reasoning-gate.svg')


if __name__ == '__main__':
    build()
