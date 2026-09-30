#!/usr/bin/env python3
"""Draw the reasoning detour as a visual journey, with details in the article."""
from build_returns import Drawing, C
from returns_illustration_primitives import scene


def art(d, x=0, y=0):
    d.parts.append(f'<g transform="translate({x} {y})">')
    # The verified-purchase cue is a precondition, not another decision.
    scene(d, 'identity', 12, 6, 61)
    d.text('Identity + receipt verified', 85, 43, 28, 'blue_ink', 650)

    # The main green road continues to the same policy and confirmed transaction.
    d.path('M135 398 V496 H983', 'green', 5, True)
    d.text('routine', 475, 479, 30, 'green', 650, 'middle')
    # A detour is only an interpretation route, never a bypass around policy.
    d.path('M218 316 H270 V193 H309', 'ochre', 4, True, True)
    d.text('unclear /', 246, 143, 27, 'ochre', 550, 'middle')
    d.text('complex', 246, 175, 27, 'ochre', 550, 'middle')
    d.path('M495 192 H575', 'ochre', 4, True, True)
    d.path('M744 192 H851', 'ochre', 4, True, True)
    d.text('pass', 800, 169, 27, 'green', 650, 'middle')
    d.path('M1081 186 H1247', 'plum', 4, True, True)
    d.text('proposal', 1165, 163, 27, 'plum', 550, 'middle')

    # A resolved question goes to policy. Verified review has a separate entry.
    d.path('M334 267 V425 H965 V496', 'green', 4)
    d.circle(965, 496, 5, 'green')
    d.text('resolved', 839, 405, 28, 'green', 650, 'middle')
    d.path('M1260 274 H1222 V353 H1080 V401', 'green', 4, True)
    d.text('validated', 1135, 336, 28, 'green', 650, 'middle')
    d.path('M1460 218 H1538', 'ochre', 3, True)

    # The precheck distinguishes a known failure from missing evidence.
    d.path('M661 263 V325 H599 V345', 'rust', 2.5, True)
    d.path('M661 325 H720 V345', 'ochre', 2.5, True)

    scene(d, 'system-one', 38, 244, 194)
    d.text('koa-action / Jev', 136, 232, 29, 'green', 650, 'middle')
    scene(d, 'clarify', 310, 98, 194)
    d.text('Clarify', 407, 303, 32, 'ochre', 650, 'middle')
    scene(d, 'policy', 572, 103, 181)
    d.text('Precheck', 661, 84, 32, 'blue_ink', 650, 'middle')
    scene(d, 'frontier', 852, 78, 239)
    d.text('Still complex?', 971, 61, 28, 'plum', 650, 'middle')
    d.text('Frontier LLM', 971, 318, 32, 'plum', 650, 'middle')
    scene(d, 'review', 1244, 91, 215)
    d.text('Human review', 1350, 319, 32, 'ochre', 650, 'middle')
    scene(d, 'hold', 1540, 190, 64)
    d.text('Hold', 1572, 285, 27, 'ochre', 650, 'middle')

    # Small illustrated exits leave the main composition quiet and readable.
    scene(d, 'stop', 570, 343, 57)
    scene(d, 'hold', 691, 343, 57)
    d.text('Decline', 599, 412, 26, 'rust', 650, 'middle')
    d.text('Hold', 719, 412, 26, 'ochre', 650, 'middle')

    scene(d, 'policy', 994, 402, 174)
    d.text('Same policy', 1081, 596, 32, 'blue_ink', 650, 'middle')
    d.path('M1168 495 H1265', 'blue_ink', 4, True)
    scene(d, 'customer', 1268, 417, 157)
    d.parts.append('<g data-component="customer-confirmation" data-kind="badge">')
    d.circle(1403, 465, 22, 'mint', 'green', 2)
    d.path('M1392 465 L1400 473 L1414 454', 'green', 4)
    d.parts.append('</g>')
    d.text('Confirm', 1350, 596, 32, 'ink', 650, 'middle')
    d.path('M1428 495 H1510', 'blue_ink', 4, True)
    scene(d, 'parcel', 1497, 387, 204)
    d.text('Return authorized', 1596, 596, 30, 'green', 650, 'middle')
    d.parts.append('</g>')


def build():
    description = (
        'Illustrated optional reasoning route after verified identity and purchase ownership. '
        'A small green koa-action or Jev chip routes routine requests directly to the merchant policy. '
        'An unclear or complex request moves to a person asking one useful question, then a trusted '
        'policy and evidence precheck. A stop symbol means known ineligibility declines; a pause '
        'symbol means missing facts hold. Only a passing precheck with residual complexity reaches '
        'the large violet frontier chip. It produces a proposal for a human reviewer. Validated '
        'facts return to the same policy; unresolved review holds. Resolved clarification also '
        'rejoins that policy without a frontier call. Eligible outcomes require customer confirmation '
        'and backend revalidation before a parcel receives a service-issued return authorization. '
        'No route grants a model or reviewer policy-override authority. This is a proposed teaching workflow.'
    )
    slide = Drawing(1744, 620, 'Frontier reasoning is a gated detour', description)
    art(slide)
    slide.save('returns-slide-fallback-v2.svg')
    poster = Drawing(1900, 900, 'Save the frontier for the hard question', description)
    poster.text('PRODUCT RETURNS  /  THE REASONING DETOUR', 78, 56, 24, 'muted', 650, spacing=2)
    poster.text('Save the frontier for the hard question.', 76, 139, 70, 'ink', 700)
    art(poster, 78, 179)
    poster.text('Reasoning proposes an interpretation. The same policy and service checks still govern the return.', 78, 854, 28, 'muted')
    poster.save('returns-fallback-v2.svg')


if __name__ == '__main__':
    build()
