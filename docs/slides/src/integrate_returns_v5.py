#!/usr/bin/env python3
"""Assemble the branching edition; previous numbered editions are immutable."""
from pathlib import Path
import json
import shutil

ROOT = Path(__file__).resolve().parent.parent
data = json.loads((ROOT/'src/deck-core-v5.json').read_text())
data['version'] = 5
data['title'] = 'Disaggregated intelligence · Building reliable Agentforce workflows'
data['interaction_script'] = 'src/interactions-v5.js'
data['theme_css'] = 'src/theme-v5.css'


def graphic(name, alt):
    return (f'<div class="system-diagram" style="display:block;height:620px">'
            f'<img data-component-asset="{name}.svg" src="ASSET:{name}.svg" alt="{alt}" '
            'style="display:block;width:1744px;height:620px;object-fit:contain" /></div>')


by_id = {s['id']:s for s in data['slides']}
# Match the meaning of the model colors in the illustrated workflow.
import re
for sid in ['opening','ownership']:
    body=by_id[sid]['body']
    def model_color(match):
        node=match.group(0)
        if '<strong>koa-action</strong>' in node:node=node.replace('class="node lilac"','class="node mint"',1)
        if '<strong>Frontier model</strong>' in node:node=node.replace('class="node mint"','class="node lilac"',1)
        return node
    body=re.sub(r'<div class="node [\s\S]*?</div>',model_color,body)
    by_id[sid]['body']=body
access = dict(by_id['returns-comparison'])
access.update({
    'id':'returns-access', 'title':'Start with identity and an owned purchase',
    'eyebrow':'Step 01 / One return, two allocations · A', 'layout':'S17',
    'body':graphic('returns-slide-access',
        'A shared front desk branches on authoritative identity results. Verified proceeds to purchase match; no login leads to secure sign-in and back to the same check; denied stops protected work. Missing or mismatched purchase evidence leads to verification and recheck. Only a matched purchase continues to B. A small comparison contrasts repeated frontier consultation with a graph route using a System One judgment. Agent Graph executes; AgentScript authors its control.'),
    'sources':['S2','S3','L1','R1'],
    'purpose':'Separate authoritative access gates from the choice of model allocation.',
    'talk':[
        'Follow the shared front desk before comparing models. The identity service supplies a result. Verified access permits protected purchase lookup; neither model grants authentication.',
        'The no-login branch goes through secure sign-in and returns to the same identity check. The denied branch stops protected work and can offer permitted account support. A service outage also holds or takes bounded recovery; unknown does not mean verified.',
        'The matched purchase binds owned line items to the authenticated customer. Missing identifiers or a mismatch go to purchase verification and recheck. Only a verified purchase reaches page B; item or kit-component binding can still need clarification there.',
        'Both architecture choices retain these safeguards. In the selected wrapper design, frontier inference proposes the next step around each service result. In the disaggregated design, authored transitions carry the known process and call a small decision model only for bounded meaning.',
        'Agent Graph coordinates execution and state. AgentScript configures the control. This is an architectural comparison with LangGraph, not an API compatibility claim or a hosted LangGraph implementation. More predictable transitions create an opportunity for cheaper, faster handling; measurement must establish the gain.'
    ],
    'transition':'With access and purchase established, identify the requested remedy and affected unit.',
    'status':'Proposed design · same service safeguards', 'minutes':1.2,
})
routing = dict(access)
routing.update({
    'id':'returns-routing', 'title':'Give familiar requests a direct service route',
    'eyebrow':'Step 01 / One return, two allocations · B',
    'body':graphic('returns-slide-routing',
        'After a verified purchase, a green System One chip fans out to three illustrated supported requests: whole-kit return, whole-item exchange, or return of a cable included in a kit. Each has distinct service rules, with stock checked for the exchange. Only eligible quotes proceed to confirmation and the service result for each selected task. Unclear meaning receives clarification and reassessment, with unresolved interpretation continuing to gate C. The task list and its conditions are retained.'),
    'sources':['S1','S3','T4','R6'],
    'purpose':'Show that a familiar exchange or kit-part return can use bounded judgment and a configured service route.',
    'talk':[
        'The small chip answers bounded questions: what remedy is requested, which owned item or kit component is affected, and whether the meaning is clear enough. An authored supported-combination mapping chooses a handler. The three pictured mappings are whole-item return, whole-item exchange and kit-component return.',
        'The open headphone kit means the complete purchased product; the highlighted cable means one component of that kit. A spare cable purchased as its own line item is an ordinary whole-item return. In the ongoing two-task case, the purchase service has established that the spare cable was bought separately.',
        'A clear exchange goes to exchange rules and inventory. A clear kit-component return goes to component identity and kit-part rules. Both can be handled without frontier interpretation. Their terms are independent of the whole-item return policy on the later calendar slide.',
        'The graph follows only registered handlers. Component exchange is a different combination; if the merchant has not registered it, configured specialist handling receives the correctly understood request. Neither model invents a policy or supported route.',
        'The eligible-quote junction describes a common finish for each selected task. It does not merge their rules. Confirm the exact action and terms; the service rechecks before issuing the corresponding authorization. Missing facts hold and known ineligibility follows the affected handler.',
        'Clarification can settle an ambiguous item or remedy and return to reassessment. Only meaning that remains unresolved can enter reasoning gate C. Keep AND obligations, OR choices and IF conditions. An exchange for blue if in stock, otherwise return, can be authored logic: unknown stock holds, and only the selected alternative may commit.'
    ],
    'transition':'Expand the exception path and examine what must hold before frontier interpretation is useful.',
    'status':'Illustrated supported combinations · independent handler policies', 'minutes':1.4,
})
s = by_id['returns-fallback']
s.update({
    'title':'Reserve frontier reasoning for unresolved meaning',
    'eyebrow':'Step 01 / The interpretation exception · C',
    'body':graphic('returns-slide-reasoning-gate',
        'A clear request reaches the authored route and its rules. An unclear meaning receives clarification, then branch-aware facts and known checks. Resolved meaning returns directly to route mapping. Missing evidence holds; known ineligibility declines for the affected task. Only unresolved meaning with the relevant facts and checks satisfied reaches frontier reasoning. Its proposal requires human validation or hold and returns to the same allowed mapping. Eligible tasks still need confirmed terms and a service result.'),
    'sources':['T4','S3','R4'],
    'purpose':'Make the frontier model a scoped interpretation resource with explicit preconditions and a guarded return path.',
    'talk':[
        'The verified-access and purchase label is a precondition. Read the green route first: clear meaning reaches the authored mapping and its appropriate handler. An unsupported combination goes to configured specialist handling rather than an invented route.',
        'The detour first asks one useful clarification. If that resolves the meaning, reassess the task and follow its handler without frontier reasoning. More business steps, an exchange, a component request, or a familiar if-condition does not itself make interpretation difficult.',
        'Facts and checks are branch-aware. Obtain missing evidence from authoritative services; hold when it cannot be obtained. Apply known mandatory rules for the affected handler. A whole-item return deadline does not globally reject an exchange or kit-component request.',
        'Only substantive interpretation that remains after clarification, with the relevant facts and known checks satisfied, reaches one scoped frontier attempt. It receives the authorized history and remaining question, then proposes a task structure; it does not replace service facts.',
        'A human validates item references and AND, OR and IF relationships, or holds the case. Validated interpretation re-enters the same supported-combination mapping and the applicable handler. Neither human validation nor model output grants a policy override.',
        'Only an eligible selected task reaches confirmed terms and an authoritative service write. Bound technical recovery, reconcile an unknown write outcome, and retain every unfinished obligation. Measure the cost of this detour, including any added review, in whole-case evaluation.'
    ],
    'transition':'Scope a concrete policy to one handler so that its rules cannot spill into other remedies.',
    'status':'Scoped interpretation · facts and authority remain with services',
})
s = by_id['returns-policy']
s.update({
    'title':'Whole-item returns follow their own policy', 'layout':'S17',
    'body':graphic('returns-slide-whole-item-policy',
        'Whole-item returns only. Invented Standard and Plus calendars show inclusive windows of 30 and 60 days from delivery to original request, with five-dollar or waived shipping when eligible. A Standard request on day 45 is declined. Both eligible routes require customer confirmation and separate service authorization. Exchange and kit-part rules are outside this example.'),
    'sources':['R2','M1'],
    'talk':[
        'The scope label matters: this invented merchant table applies only to whole-item returns. A separate service owns exchange rules; kit-component returns have their own rules and terms. These values are not Salesforce product policy.',
        'A verified owned purchase provides the delivery time, original request time, loyalty tier, item eligibility and available unreturned quantity. Missing or contradictory required facts stay pending. Keep the original request timestamp through retries and handoffs.',
        'Standard permits an eligible request within 30 days inclusive and quotes five-dollar shipping. Plus permits 60 days inclusive and waives shipping. Standard day 18 and Plus day 45 can qualify if the other rules hold; Standard day 45 fails this ordinary return window.',
        'Confirm the specific items, quantity and quote. The backend rechecks authority, policy and accepted terms before recording an idempotent return authorization. Changed terms require renewed confirmation; a label in this drawing means authorization, not completed shipping or settled refund.',
        'A known rule failure does not justify a frontier appeal. A separate eligible task can continue under its own policy while the declined task retains its outcome. This scoped service authority makes the authored route predictable.'
    ],
    'transition':'Now connect the illustrated application to the runtime, authored controls and model contracts beneath it.',
    'status':'Invented whole-item policy · exchanges and kit parts have separate rules',
})
s = by_id['returns-components']
s.update({
    'title':'Reuse the visual vocabulary in another workflow',
    'body':graphic('returns-branching-component-library',
        'Twelve reusable vector illustrations: access check, secure sign-in, whole kit, exchange, kit part, stock, System One, frontier reasoning, human review, customer, service result and hold. Each object and its label can be moved separately in the companion PowerPoint.'),
    'talk':[
        'This optional appendix provides independently movable vector illustrations for another workflow. In PowerPoint, use the Selection Pane to select, copy, resize or rearrange a named object.',
        'The four workflow views and this library retain separate illustrations, labels and routes. Move a node and its label together, then reposition its connectors. The arrows are vector objects; they do not automatically reconnect.',
        'Labels are outlined vector artwork. The source SVG assets keep editable source text; speaker notes remain editable PowerPoint text. Calendars and shipping tickets preserve their printed values as a unit.',
        'Keep the meaning consistent when reusing a component: services establish authority, System One interprets bounded meaning, Agent Graph coordinates transitions and state, AgentScript authors the controls, and a frontier model proposes an interpretation only when the configured exception path calls for it.'
    ],
    'status':'Reusable vector objects · optional appendix',
})
slides = []
for slide in data['slides']:
    slides.extend([access, routing] if slide['id']=='returns-comparison' else [slide])
data['slides'] = slides
data['sources'].update({
    'R1':['Access and allocation · A','../diagrams/returns-comparison-access.svg'],
    'R2':['Whole-item return policy','../diagrams/returns-whole-item-policy.svg'],
    'R4':['Reasoning gate · C','../diagrams/returns-reasoning-gate.svg'],
    'R5':['Reusable vector components','assets/components-v5/README.md'],
    'R6':['Bounded request routes · B','../diagrams/returns-comparison-routing.svg'],
})
(ROOT/'src/deck-v5.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
for name in ['returns-slide-access','returns-slide-routing','returns-slide-reasoning-gate',
             'returns-slide-whole-item-policy','returns-branching-component-library']:
    shutil.copy2(ROOT.parent/'diagrams'/f'{name}.svg',ROOT/'assets'/f'{name}.svg')
snapshot = ROOT/'versions/v5'
snapshot.mkdir(parents=True,exist_ok=True)
shutil.copy2(ROOT/'src/deck-v5.json',snapshot/'deck.json')
print(f'Version 05: {len(slides)} slides; {sum(s["minutes"] for s in slides):.1f} speaking minutes; five movable-vector compositions.')
