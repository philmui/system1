"""Original vector objects for access gates and several kinds of return request.

Each new object uses a 180 × 160 box. Earlier primitives and exports are retained;
this module adds neutral service gates, account recovery and concrete request
types without putting paragraphs inside the illustrations.
"""
from build_returns import C
from returns_illustration_primitives import scene as old_scene


def scene(d, kind, x, y, width=180):
    ink, blue, mint, lilac, sand, peach, white = (C[k] for k in ['ink','blue','mint','lilac','sand','peach','white'])
    green, plum, ochre, rust = (C[k] for k in ['green','plum','ochre','rust'])
    drawings = {
        'auth': f'''
            <rect x="13" y="20" width="137" height="112" rx="13" fill="{white}"/>
            <path d="M26 20h111q13 0 13 13v12H13V33q0-13 13-13" fill="{blue}"/>
            <circle cx="51" cy="75" r="12" fill="{peach}"/>
            <path d="M31 110v-9q0-20 20-20t20 20v9" fill="{blue}"/>
            <path d="M87 64h42M87 80h27M29 120h48" fill="none" stroke-width="4"/>
            <path d="m134 79 33 12v25q0 23-33 38-33-15-33-38V91Z" fill="{blue}"/>
            <circle cx="134" cy="109" r="8" fill="{white}"/>
            <path d="M134 116v16" stroke-width="5"/>
        ''',
        'signin': f'''
            <rect x="34" y="17" width="133" height="118" rx="13" fill="{white}"/>
            <path d="M47 17h107q13 0 13 13v14H34V30q0-13 13-13Z" fill="{blue}"/>
            <circle cx="48" cy="31" r="3" fill="{ink}" stroke="none"/>
            <circle cx="61" cy="31" r="3" fill="{ink}" stroke="none"/>
            <path d="M92 70V60a16 16 0 0 1 32 0v10" fill="none" stroke-width="5"/>
            <rect x="85" y="69" width="46" height="37" rx="7" fill="{sand}"/>
            <circle cx="108" cy="84" r="4" fill="{ochre}" stroke="none"/>
            <path d="M108 86v9" stroke="{ochre}" stroke-width="3"/>
            <path d="M12 113h63m-16-17 17 17-17 17" fill="none" stroke="{green}" stroke-width="7"/>
            <path d="M91 119h42" stroke="{green}" stroke-width="4"/>
        ''',
        'locked': f'''
            <path d="M49 71V47a39 39 0 0 1 78 0v24" fill="none" stroke-width="11"/>
            <rect x="30" y="66" width="118" height="83" rx="16" fill="{peach}"/>
            <circle cx="88" cy="99" r="10" fill="{white}"/>
            <path d="M88 109v18" stroke-width="6"/>
            <circle cx="145" cy="120" r="26" fill="{white}" stroke="{rust}" stroke-width="3"/>
            <path d="m132 108 25 25m0-25-25 25" stroke="{rust}" stroke-width="5"/>
        ''',
        'exchange': f'''
            <path d="M33 33q17-23 45-23h34m-12-9 13 9-13 10" fill="none" stroke="{green}" stroke-width="5"/>
            <path d="m18 65 36-15 35 17-36 16Zm0 0 35 18v49l-35-18Zm35 18 36-16v47l-36 18Z" fill="{lilac}"/>
            <path d="m91 69 36-15 35 17-36 16Zm0 0 35 18v49l-35-18Zm35 18 36-16v47l-36 18Z" fill="{blue}"/>
            <path d="m42 55 33 18v19l-12 5V77L30 61m85-2 32 17v19l-12 5V81l-33-16" fill="{white}"/>
            <path d="M148 134q-17 16-39 16H75m12-10-13 10 13 9" fill="none" stroke="{green}" stroke-width="5"/>
        ''',
        'whole-kit': f'''
            <path d="m15 76 68-22 80 31-68 24Z" fill="{sand}"/>
            <path d="m15 76 80 33v45l-80-32Zm80 33 68-24v44l-68 25Z" fill="{sand}"/>
            <path d="m15 76-9-22 68-22 9 22m80 31 11-24-80-29-11 22" fill="{white}"/>
            <path d="M47 71V47a27 27 0 0 1 54 0v24" fill="none" stroke="{plum}" stroke-width="6"/>
            <rect x="40" y="56" width="14" height="25" rx="6" fill="{lilac}"/>
            <rect x="94" y="56" width="14" height="25" rx="6" fill="{lilac}"/>
            <path d="M114 65q34-17 27 9-5 14-22 8" fill="none" stroke="{green}" stroke-width="4"/>
            <path d="m112 65 8-5 5 8-8 5Z" fill="{mint}"/>
        ''',
        'kit-part': f'''
            <path d="M17 18h104v102H17Z" fill="{blue}" stroke-dasharray="6 6"/>
            <path d="M38 72V53a27 27 0 0 1 54 0v19" fill="none" stroke="{plum}" stroke-width="6"/>
            <rect x="30" y="60" width="16" height="29" rx="6" fill="{lilac}"/>
            <rect x="84" y="60" width="16" height="29" rx="6" fill="{lilac}"/>
            <circle cx="124" cy="111" r="47" fill="{mint}" stroke="{green}" stroke-width="3"/>
            <path d="M104 104c27-36 61 15 23 27-30 9-31-13-11-17" fill="none" stroke="{green}" stroke-width="5"/>
            <path d="m99 101 11 7-7 12-11-7Zm18 8h13v9h-13Z" fill="{white}" stroke="{green}"/>
        ''',
        'inventory': f'''
            <path d="M18 20v130M162 20v130M18 74h144M18 136h144" fill="none" stroke-width="5"/>
            <path d="M32 30h43v43H32Zm62 0h51v43H94Z" fill="{blue}"/>
            <path d="M48 30v13h12V30m52 0v13h13V30" fill="{white}"/>
            <path d="M32 91h55v44H32Zm73 0h40v44h-40Z" fill="{sand}"/>
            <path d="M52 91v15h13V91m53 0v15h13V91" fill="{white}"/>
            <path d="M37 122h32m38 0h24" stroke-width="3"/>
        ''',
        'kit-rules': f'''
            <path d="M26 13h111v137H26Z" fill="{white}"/>
            <path d="M42 33h76M42 47h52" stroke-width="4"/>
            <path d="M44 68h58v49H44Z" fill="{blue}" stroke-dasharray="5 5"/>
            <path d="M54 100V85a13 13 0 0 1 26 0v15" fill="none" stroke="{plum}" stroke-width="4"/>
            <rect x="50" y="93" width="8" height="15" rx="3" fill="{lilac}"/>
            <rect x="76" y="93" width="8" height="15" rx="3" fill="{lilac}"/>
            <circle cx="139" cy="113" r="29" fill="{mint}" stroke="{green}"/>
            <path d="M125 108q26-24 30 3 0 20-26 12" fill="none" stroke="{green}" stroke-width="4"/>
            <path d="M121 108h10v9h-10Zm6 18h10v8h-10Z" fill="{white}"/>
            <path d="M43 131h61" stroke-width="4"/>
        ''',
        'tasks': f'''
            <rect x="36" y="17" width="109" height="127" rx="10" fill="{blue}"/>
            <rect x="23" y="8" width="109" height="127" rx="10" fill="{white}"/>
            <path d="M42 35h15v15H42Zm0 38h15v15H42Zm0 38h15v15H42Z" fill="{mint}"/>
            <path d="M72 41h43M72 79h43M72 117h29" stroke-width="4"/>
            <path d="M143 49h24v50h-16m5-8-9 8 9 8" fill="none" stroke="{green}" stroke-width="4"/>
        ''',
        'commit': f'''
            <path d="M28 12h91l27 27v111H28Z" fill="{white}"/>
            <path d="M119 12v27h27" fill="{blue}"/>
            <path d="M44 52h78M44 68h59M44 84h47" stroke="{C['blue_ink']}" stroke-width="4"/>
            <path d="M44 111v22m6-22v22m7-22v22m10-22v22m7-22v22m6-22v22m10-22v22" stroke-width="3"/>
            <path d="m139 78 32 11v26q0 22-32 39-32-17-32-39V89Z" fill="{mint}" stroke="{green}"/>
            <path d="m122 113 11 11 23-26" fill="none" stroke="{green}" stroke-width="5"/>
        ''',
    }
    if kind not in drawings:
        return old_scene(d,kind,x,y,width)
    d.parts.append(f'<g data-component="{kind}" data-kind="illustration" aria-hidden="true" transform="translate({x} {y}) scale({width/180})" fill="none" stroke="{ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">')
    d.parts.append(drawings[kind])
    d.parts.append('</g>')
