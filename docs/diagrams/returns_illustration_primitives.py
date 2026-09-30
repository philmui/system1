"""Large, original flat-vector scenes for the pictorial return walkthrough.

Each scene has a 180 x 160 design box. These are physical objects and people,
not text-bearing workflow cards. Labels live in the parent composition.
"""
from build_returns import C


def scene(d, kind: str, x: float, y: float, width: float = 180):
    ink, blue, mint, lilac, sand, peach = (C[k] for k in ['ink','blue','mint','lilac','sand','peach'])
    green, plum, ochre = (C[k] for k in ['green','plum','ochre'])
    white = C['white']
    # Colored large objects keep their identity at projector scale and in gray.
    drawings = {
        'customer': f'''
          <ellipse cx="92" cy="151" rx="66" ry="6" fill="{blue}" stroke="none"/>
          <path d="M60 113 56 145H78l7-30m22-2 7 32h20l-16-40" fill="{ink}"/>
          <path d="M53 146h26v7H46c0-4 3-6 7-7m60 0h24l8 7h-32Z" fill="{white}"/>
          <path d="M52 70q6-17 29-18h16q23 2 28 23l-9 46H62Z" fill="{blue}"/>
          <path d="M63 62 46 81l15 20m51-41 22 22-8 22" fill="none" stroke-width="9" stroke="{blue}"/>
          <circle cx="86" cy="33" r="23" fill="{peach}"/>
          <path d="M64 30q-5-24 21-25 28-1 26 27l-10-6-3-12q-13 11-34 10Z" fill="{ink}"/>
          <path d="M83 30v7m15-7v7" stroke-width="2.6"/>
          <path d="M84 44q6 4 11-1" fill="none"/>
          <path d="m55 92 54-18 34 19-54 20Z" fill="{sand}"/>
          <path d="m55 92 34 21v34l-34-20Zm34 21 54-20v35l-54 19Z" fill="{sand}"/>
          <path d="m80 84 36 20v16l-10 4v-16L70 88" fill="{white}"/>
          <circle cx="60" cy="99" r="7" fill="{peach}"/>
          <circle cx="131" cy="103" r="7" fill="{peach}"/>
        ''',
        'identity': f'''
          <path d="M22 26h124a10 10 0 0 1 10 10v91H22Z" fill="{blue}" stroke="none"/>
          <rect x="13" y="20" width="139" height="112" rx="13" fill="{white}"/>
          <path d="M26 20h113q13 0 13 13v12H13V33q0-13 13-13" fill="{blue}"/>
          <circle cx="52" cy="80" r="22" fill="{mint}" stroke="none"/>
          <circle cx="52" cy="72" r="9" fill="{peach}"/>
          <path d="M35 97q0-21 17-21t17 21" fill="{blue}"/>
          <path d="M90 62h40M90 78h27M90 95h35M29 117h55" fill="none" stroke-width="4"/>
          <path d="m134 80 33 12v22q0 24-33 39-33-15-33-39V92Z" fill="{mint}"/>
          <path d="m118 114 11 11 21-25" fill="none" stroke="{green}" stroke-width="5"/>
        ''',
        'receipt': f'''
          <g transform="translate(23 4) rotate(-9 62 71)">
            <path d="M15 9h107v123l-10-6-11 6-11-6-11 6-11-6-11 6-11-6-11 6-10-6-10 6Z" fill="{blue}"/>
            <path d="M32 31h56M32 44h42" stroke-width="4"/>
          </g>
          <path d="M28 24h105v123l-10-6-11 6-11-6-11 6-11-6-11 6-11-6-10 6-9-6-10 6Z" fill="{white}"/>
          <path d="M43 39h46M43 50h64M45 119h24M83 119h32" fill="none" stroke-width="4"/>
          <path d="M57 89V77a25 25 0 0 1 50 0v12" fill="none" stroke="{plum}" stroke-width="6"/>
          <rect x="51" y="78" width="14" height="27" rx="6" fill="{lilac}"/>
          <rect x="99" y="78" width="14" height="27" rx="6" fill="{lilac}"/>
          <circle cx="137" cy="111" r="26" fill="{mint}"/>
          <path d="m123 111 10 10 18-22" fill="none" stroke="{green}" stroke-width="5"/>
        ''',
        'frontier': f'''
          <path d="M41 10v21M66 10v21M92 10v21M118 10v21M143 10v21M41 130v21M66 130v21M92 130v21M118 130v21M143 130v21M7 53h20M7 79h20M7 106h20M154 53h19M154 79h19M154 106h19" stroke="{plum}" stroke-width="5"/>
          <rect x="23" y="25" width="134" height="110" rx="24" fill="{lilac}" stroke="{plum}" stroke-width="3"/>
          <rect x="35" y="37" width="110" height="86" rx="16" fill="{white}" stroke="{plum}"/>
          <path d="m49 63 30-12 29 10 22 30-38 14-26-18-17-24m30-12 13 54m16-44L66 87m64 4L49 63" fill="none" stroke="{plum}" stroke-width="2.3"/>
          <g fill="{lilac}" stroke="{plum}" stroke-width="2.5"><circle cx="49" cy="63" r="7"/><circle cx="79" cy="51" r="7"/><circle cx="108" cy="61" r="7"/><circle cx="130" cy="91" r="7"/><circle cx="92" cy="105" r="7"/><circle cx="66" cy="87" r="7"/></g>
        ''',
        'system-one': f'''
          <path d="M62 17v22M88 17v22M115 17v22M62 121v22M88 121v22M115 121v22M24 58h22M24 96h22M135 58h22M135 96h22" stroke="{green}" stroke-width="5"/>
          <rect x="42" y="34" width="96" height="92" rx="21" fill="{mint}" stroke="{green}" stroke-width="3"/>
          <path d="M64 80h22m0 0V58h27M86 80v22h27" fill="none" stroke="{green}" stroke-width="4"/>
          <circle cx="61" cy="80" r="6" fill="{white}" stroke="{green}"/>
          <circle cx="116" cy="58" r="6" fill="{white}" stroke="{green}"/>
          <circle cx="116" cy="102" r="6" fill="{white}" stroke="{green}"/>
        ''',
        'clarify': f'''
          <path d="M82 13h64q21 0 21 21v30q0 20-21 20h-35L88 102V84h-6q-20 0-20-20V34q0-21 20-21" fill="{sand}"/>
          <path d="M103 36c0-17 28-17 28 0 0 10-17 7-17 20" fill="none" stroke="{ochre}" stroke-width="4"/>
          <circle cx="114" cy="68" r="2.5" fill="{ochre}" stroke="none"/>
          <path d="M15 149v-30q2-35 35-35t37 35v30Z" fill="{blue}"/>
          <circle cx="49" cy="67" r="23" fill="{peach}"/>
          <path d="M27 64q-5-26 24-27 22 2 22 24l-18-10q-9 12-28 13Z" fill="{ink}"/>
          <path d="M46 67v5m12-5v5m-13 8q7 4 13-1" fill="none"/>
          <path d="m83 122 22-13 12 23-24 13Z" fill="{white}"/>
          <path d="M82 140 69 117" fill="none" stroke="{blue}" stroke-width="11"/>
        ''',
        'review': f'''
          <path d="M14 152v-29q1-31 34-31t39 31v29Z" fill="{blue}"/>
          <circle cx="48" cy="69" r="24" fill="{peach}"/>
          <path d="M26 66q-4-27 25-28 23 4 21 29l-15-11q-12 10-31 10Z" fill="{ink}"/>
          <path d="M42 70h10m4 0h10m-20 13q7 3 12-1" fill="none"/>
          <circle cx="45" cy="70" r="7" fill="none"/><circle cx="62" cy="70" r="7" fill="none"/>
          <path d="M87 36h46l20 20v77H87Z" fill="{white}"/>
          <path d="M133 36v20h20M99 71h36M99 83h23M99 96h27" fill="none"/>
          <circle cx="131" cy="103" r="25" fill="{sand}" fill-opacity=".75" stroke="{ochre}" stroke-width="4"/>
          <path d="m148 122 23 25" stroke="{ochre}" stroke-width="10"/>
          <path d="m119 102 8 8 16-19" fill="none" stroke="{green}" stroke-width="4"/>
        ''',
        'policy': f'''
          <rect x="28" y="16" width="114" height="132" rx="13" fill="{blue}"/>
          <rect x="40" y="29" width="91" height="105" rx="6" fill="{white}"/>
          <path d="M65 9h39v22H65Z" fill="{mint}"/>
          <path d="m49 57 7 7 11-14m-18 38 7 7 11-14m-18 38 7 7 11-14M80 58h33M80 88h33M80 118h20" fill="none" stroke="{green}" stroke-width="4"/>
          <circle cx="143" cy="124" r="28" fill="{sand}"/>
          <path d="m143 106 5 11 12 2-9 8 2 12-10-6-11 6 3-12-9-8 12-2Z" fill="{white}" stroke="{ochre}"/>
        ''',
        'parcel': f'''
          <path d="m23 74 75-24 59 28-75 26Z" fill="{sand}"/>
          <path d="m23 74 59 30v48l-59-31Zm59 30 75-26v49l-75 25Z" fill="{sand}"/>
          <path d="m58 63 62 28v27l-15 5V97L43 69" fill="{white}"/>
          <path d="M53 43H27q-10 0-10-10 0-11 10-11h66" fill="none" stroke="{green}" stroke-width="8"/>
          <path d="m44 33 13 10-13 10" fill="none" stroke="{green}" stroke-width="7"/>
          <path d="M115 100h49v53h-49Z" fill="{white}"/>
          <path d="M123 111h31M123 119h17M124 132v11m5-11v11m6-11v11m8-11v11m5-11v11m5-11v11" fill="none" stroke-width="2.2"/>
          <circle cx="146" cy="69" r="22" fill="{mint}"/>
          <path d="m134 69 8 8 15-19" fill="none" stroke="{green}" stroke-width="4"/>
        ''',
        'stop': f'''
          <path d="m62 16-38 38v54l38 38h55l38-38V54l-38-38Z" fill="{peach}" stroke="{C['rust']}" stroke-width="3"/>
          <path d="m63 54 54 54m0-54-54 54" stroke="{C['rust']}" stroke-width="10"/>
        ''',
        'hold': f'''
          <circle cx="90" cy="80" r="60" fill="{sand}" stroke="{ochre}" stroke-width="3"/>
          <rect x="64" y="48" width="18" height="65" rx="4" fill="{ochre}" stroke="none"/>
          <rect x="99" y="48" width="18" height="65" rx="4" fill="{ochre}" stroke="none"/>
        ''',
    }
    if kind not in drawings:
        raise ValueError(f'Unknown illustration scene: {kind}')
    d.parts.append(f'<g data-component="{kind}" data-kind="illustration" aria-hidden="true" transform="translate({x} {y}) scale({width/180})" fill="none" stroke="{ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">')
    d.parts.append(drawings[kind])
    d.parts.append('</g>')
