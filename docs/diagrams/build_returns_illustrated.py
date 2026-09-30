#!/usr/bin/env python3
"""Rebuild the pictorial return figures and publish their canonical SVG names.

Text-first figures remain in archive/returns-text-first. The -v2 files preserve
the explicit design iteration; canonical names keep article links stable.
"""
from pathlib import Path
import shutil
from build_returns_visual_comparison import comparison_slide, comparison_poster
from build_returns_visual_policy import build as policy
from build_returns_visual_fallback import build as fallback
from build_returns import Drawing
from returns_illustration_primitives import scene

HERE = Path(__file__).resolve().parent


def library():
    desc = ('Reusable original vector illustrations for the return workflow: a customer, '
            'verified identity, matched receipt, policy, authorized parcel, frontier model, '
            'System One model, clarification, human review, a declined case and a held case. '
            'The PowerPoint edition contains separate movable vector objects with descriptive names.')
    d = Drawing(1744, 620, 'A reusable vocabulary for return workflows', desc)
    items = [
        ('customer', 'Customer'), ('identity', 'Identity'), ('receipt', 'Receipt'),
        ('policy', 'Policy'), ('parcel', 'Return label'), ('system-one', 'System One'),
        ('frontier', 'Frontier LLM'), ('clarify', 'Clarify'), ('review', 'Human review'),
        ('stop', 'Decline'), ('hold', 'Hold'),
    ]
    for i, (kind, label) in enumerate(items):
        x, y = 24 + (i % 6) * 286, 34 + (i // 6) * 292
        scene(d, kind, x+34, y, 194)
        d.text(label, x+131, y+225, 30, 'ink', 650, 'middle')
    # An ordinary directed route is useful without implying a new decision.
    d.parts.append('<g data-component="directed-route" data-kind="connector">')
    d.path('M1492 418 H1650', 'green', 5, True)
    d.parts.append('</g>')
    d.text('Route', 1585, 551, 30, 'ink', 650, 'middle')
    d.save('returns-component-library.svg')


if __name__ == '__main__':
    comparison_slide()
    comparison_poster()
    policy()
    fallback()
    library()
    for kind in ['comparison', 'policy', 'fallback']:
        for prefix in ['returns-', 'returns-slide-']:
            shutil.copyfile(HERE/f'{prefix}{kind}-v2.svg', HERE/f'{prefix}{kind}.svg')
    print('Published three pictorial posters, three slide views and a reusable library.')
