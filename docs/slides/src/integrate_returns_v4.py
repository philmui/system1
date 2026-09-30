#!/usr/bin/env python3
"""Create version 04 from preserved version 03, with pictorial return workflows.

The HTML and PowerPoint builders consume this source separately. Diagram nodes
carry component metadata for independent, reusable vector objects in PowerPoint.
"""
from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent.parent
source = ROOT/'src/deck-v3.json'
data = json.loads(source.read_text())
data['version'] = 4


def graphic(name, structure, alt):
    return (f'<div class="{structure}" style="display:block;height:620px">'
            f'<img data-component-asset="{name}.svg" src="ASSET:{name}.svg" alt="{alt}" '
            'style="display:block;width:1744px;height:620px;object-fit:contain" /></div>')


by_id = {s['id']:s for s in data['slides']}
s = by_id['returns-comparison']
s['body'] = graphic('returns-slide-comparison', 'duo-compare',
    'Four numbered service checkpoints surround a large frontier chip at left: identity, receipt, policy and return creation. Each consults the frontier model. At right, the same illustrated checkpoints follow a direct Agent Graph route, with a small koa-action or Jev semantic switch after the matched receipt. A dotted complex-case cue leads to the next slide. The same backend safeguards govern both architectures.')
s['talk'] = [
    'Start with the customer and the parcel: I want to return these headphones. The four numbered scenes are an identity card, a matched receipt, a policy clipboard and an authorized return label. The final scene includes customer confirmation and the backend write, expanded on the policy slide.',
    'Read the left-hand numbers clockwise. Purple arrows revisit the large frontier chip as each service result becomes context for another proposed next step. This is the selected wrapper architecture; its trusted services can still enforce all the same safeguards.',
    'Follow the right-hand green path from identity to receipt, through the smaller System One chip, down to policy and left to the return label. AgentScript configures Agent Graph to execute known dependencies. The unnumbered semantic switch interprets the return reason; it does not grant identity, ownership or eligibility.',
    'koa-action and Jev illustrate the bounded-decision role, without implying a shared schema or native Salesforce adapter. This routine path shows fewer frontier decisions; it is not a measured price, latency or reliability claim. Count any later generated message in whole-case cost.',
    'The small dotted complex-case cue continues on the next slide. Failed authentication goes to sign-in or denial; a receipt mismatch goes to verification. Neither calls for a more powerful model to replace evidence.'
]
s['status'] = 'Proposed architecture · same service safeguards'

s = by_id['returns-fallback']
s['body'] = graphic('returns-slide-fallback', 'system-diagram',
    'After verified identity and receipt, a small green System One chip routes routine requests along the lower green road to policy. Unclear or complex requests move along a dotted detour to a person asking one useful question, then a policy precheck. Stop and pause symbols mean decline or hold. Only residual complexity after a passing precheck reaches the frontier chip. Human review either holds or validates a proposal, returning to the same policy. Resolved clarification also returns directly to policy. Eligible cases require confirmation and backend authorization.')
s['sources'] = ['T4','S3','R4']
s['talk'][0] = 'The checked ID in the corner is a precondition: identity and purchase ownership are already verified. Read the green lower road first; routine cases go directly to policy. The small chip is a bounded semantic decision, not a transaction authority.'
s['talk'][1] = 'Follow the dotted detour only for an unclear or complex request. The person asks one useful clarification, and the clipboard checks known policy and required evidence. The cross declines known ineligibility; the pause holds missing evidence. The green resolved branch avoids frontier reasoning.'
s['talk'][3] = 'The purple chip receives authorized facts and the remaining question, then produces a proposal for human review. The reviewer can validate or hold. A green return arrow carries only validated information back to the same policy. The customer and parcel at the lower right show confirmation followed by service authorization; neither model nor reviewer can override policy.'

s = by_id['returns-policy']
s['body'] = graphic('returns-slide-policy', 'tech-spec',
    'A checked ID and matched receipt reach two loyalty calendars. Standard requests within 30 days have a five-dollar shipping label; Plus requests within 60 days have a waived-shipping label. Eligible paths merge at customer confirmation and a separate service-approval shield before an authorized return parcel. A crossed Standard day-45 calendar shows a decline. This is an invented merchant policy.')
s['talk'][0] = 'Read the physical objects from left to right. The checked identity card and receipt establish a verified purchase. The calendars are the two invented loyalty windows; the perforated shipping tickets show the resulting fee. These are teaching rules, not Salesforce product policy.'
s['talk'][3] = 'The Standard calendar allows requests within 30 days and shows a five-dollar shipping ticket. The Plus calendar allows 60 days and shows waived shipping. For example, Standard day 18 and Plus day 45 qualify, subject to all other checks. The crossed Standard day-45 calendar stops without frontier reasoning.'

data['slides'] = [s for s in data['slides'] if s['id'] != 'returns-components']
data['slides'].append({
    'id':'returns-components', 'title':'Reuse the pieces to build another workflow',
    'eyebrow':'Appendix / A reusable visual vocabulary', 'layout':'S17', 'theme':'light',
    'body':graphic('returns-component-library','system-diagram',
        'Twelve reusable vector components: customer, identity, receipt, policy, return label, System One chip, frontier chip, clarification, human review, decline, hold and a directed route. Each object is separately movable in the companion PowerPoint.'),
    'sources':['R5'], 'purpose':'Provide a reusable visual vocabulary for another enterprise workflow.',
    'talk':[
        'This optional appendix is a component library. Each illustration in the PowerPoint is a separate named vector object that can be copied, resized and rearranged.',
        'The three return slides also keep their objects and routes separate. Open the Selection Pane to select an illustration, label or arrow without moving the frame.',
        'Move a node with its label, then reposition its connectors. These are vector arrow objects, not connectors that automatically reroute. Labels are outlined vector objects; speaker notes remain editable text.',
        'Calendars and shipping tickets on the policy slide are reusable units with their printed values kept together. The companion SVG assets retain editable source text for revising the rule.',
        'Keep the meaning of an object consistent: chips interpret, service checks establish facts, the person confirms, and the authorized parcel appears only after a successful service write.'
    ],
    'transition':'Use this vocabulary to sketch another workflow with the same separation of interpretation and authority.',
    'status':'Reusable vector components · optional appendix', 'minutes':0.5,
})
data['sources'].update({
    'R4':['Reasoning detour illustration','../diagrams/returns-fallback.svg'],
    'R5':['Reusable return components','assets/components/README.md'],
})
(ROOT/'src/deck-v4.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
for name in ['returns-slide-comparison','returns-slide-fallback','returns-slide-policy','returns-component-library']:
    shutil.copy2(ROOT.parent/'diagrams'/f'{name}.svg',ROOT/'assets'/f'{name}.svg')
snapshot=ROOT/'versions/v4'
snapshot.mkdir(parents=True,exist_ok=True)
shutil.copy2(ROOT/'src/deck-v4.json',snapshot/'deck.json')
shutil.copy2(ROOT/'src/theme.css',snapshot/'theme.css')
print(f'Version 04: {len(data["slides"])} slides; four compositions with reusable vector components.')
