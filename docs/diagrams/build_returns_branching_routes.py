#!/usr/bin/env python3
"""Page B: bounded request judgments become distinct guarded service routes."""
from build_returns import C, Drawing
from returns_branching_primitives import scene


DESCRIPTION = (
    'Page B of a two-page comparison. Continue only after verified identity and a matched purchase on page A. '
    'The System One model, illustrated as koa-action or Jev, supplies bounded judgments about requested remedy, '
    'scope and interpretation status. Agent Graph dispatches the supported combination using AgentScript-authored '
    'control. Three clear examples are shown: return the whole kit, exchange the whole item for blue, or return '
    'only the cable included in a kit. Each route has its own service checks: whole-item return policy; exchange '
    'policy and replacement inventory; or component identity and kit-part policy. Only an eligible quote reaches '
    'customer confirmation and an authoritative service result. Missing required facts go to verification or hold; '
    'known ineligibility is handled by the applicable service. An unclear meaning first receives a bounded '
    'clarification and, only if unresolved, continues to reasoning gate C. Known exchanges or component requests '
    'do not themselves require a frontier model. An AND request keeps all its tasks; OR and IF alternatives retain '
    'their selection conditions, and only a selected applicable action may commit. Unsupported combinations go '
    'to configured specialist handling. These are proposed application routes, not vendor response fields or a '
    'native model adapter. The full-return loyalty policy is not assumed to govern exchanges or kit components.'
)


def edge(d,path,color='green',width=4,arrow=True,dash=False):
    d.parts.append('<g data-component="request-route" data-kind="connector">')
    d.path(path,color,width,arrow,dash)
    d.parts.append('</g>')


def portal(d,letter,x,y,color='blue_ink',fill='blue'):
    d.parts.append(f'<g data-component="continuation-{letter}" data-kind="badge">')
    d.circle(x,y,22,fill,color,2)
    d.text(letter,x,y+9,29,color,700,'middle')
    d.parts.append('</g>')


def art(d):
    portal(d,'B',32,32)
    d.text('Verified purchase',69,42,27,'blue_ink',600)
    d.text('System One',187,111,33,'green',700,'middle')
    d.text('koa-action / Jev',187,150,27,'green',550,'middle')
    scene(d,'system-one',78,168,217)

    # Three supported remedy/scope examples. The graph controls the fan-out.
    edge(d,'M269 264 H351 V98 H430')
    edge(d,'M351 264 V273 H430')
    edge(d,'M351 273 V448 H430')
    d.circle(351,264,5,'green')
    for y in [190,365]:
        d.path(f'M432 {y} H1155','line',1)

    rows=[
        (22,'whole-kit','Whole-item return','“Return the kit”','policy','Return rules'),
        (197,'exchange','Exchange','“Swap for blue”','inventory','Rules + stock'),
        (372,'kit-part','Kit-part return','“Only the cable”','kit-rules','Kit-part rules'),
    ]
    for y,kind,title,quote,service,label in rows:
        scene(d,kind,440,y,147)
        d.text(title,612,y+51,30,'ink',700)
        d.text(quote,612,y+92,26,'muted',500)
        edge(d,f'M898 {y+76} H950','blue_ink',3.5)
        scene(d,service,961,y-2,139)
        d.text(label,1030,y+151,26,'blue_ink',600,'middle')
        edge(d,f'M1104 {y+76} H1210','green',3.5)
    edge(d,'M1210 98 V448','green',3.5,False)
    d.circle(1210,273,5,'green')
    d.text('Eligible quotes',1208,63,26,'green',650,'middle')
    edge(d,'M1210 273 H1320')

    # This common pattern is instantiated per selected task, not a policy merge.
    d.text('For each selected task',1480,191,27,'blue_ink',600,'middle')
    scene(d,'customer',1321,210,146)
    d.parts.append('<g data-component="confirm-terms" data-kind="badge">')
    d.circle(1455,254,23,'mint','green',2)
    d.path('M1444 254 L1452 262 L1467 244','green',4)
    d.parts.append('</g>')
    d.text('Confirm terms',1398,389,29,'ink',650,'middle')
    edge(d,'M1482 283 H1554','blue_ink')
    scene(d,'commit',1550,213,151)
    d.text('Service result',1630,389,29,'blue_ink',650,'middle')

    # Uncertainty about meaning takes a different path from a familiar request.
    edge(d,'M185 341 V505 H290','ochre',3.5,True,True)
    d.text('Unclear?',268,410,28,'ochre',600,'middle')
    scene(d,'clarify',295,452,118)
    d.text('Clarify',354,598,30,'ochre',650,'middle')
    edge(d,'M421 507 H474 V544 H512','ochre',3,True,True)
    portal(d,'C',539,544,'ochre','sand')
    d.text('If unresolved',664,597,25,'ochre',550,'middle')
    d.text('Reasoning gate',578,555,28,'ochre',650)
    edge(d,'M315 552 V565 H42 V264 H95','green',3)
    d.text('Reassess',150,597,25,'green',600,'middle')
    d.text('Keep every task and its conditions.',1197,588,29,'green',600,'middle')


def build():
    d=Drawing(1744,620,'System One judgments become distinct guarded routes',DESCRIPTION)
    art(d)
    d.save('returns-slide-routing.svg')
    poster=Drawing(1900,900,'Different requests, a deliberate route for each',DESCRIPTION)
    poster.text('DISAGGREGATED INTELLIGENCE  /  2 OF 2',78,52,24,'muted',650,spacing=2)
    poster.text('Different requests. A deliberate route for each.',76,126,58,'ink',700)
    poster.text('System One identifies the task; Agent Graph follows the flow configured in AgentScript.',78,172,29,'muted')
    poster.parts.append('<g transform="translate(78 201)">')
    art(poster)
    poster.parts.append('</g>')
    poster.text('Structured judgments choose a route. Services apply its rules and record the outcome.',78,857,28,'muted')
    poster.save('returns-comparison-routing.svg')


if __name__=='__main__':
    build()
