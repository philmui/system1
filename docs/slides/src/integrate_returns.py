#!/usr/bin/env python3
"""Insert the user-requested return walkthrough into the version 03 source.

The numbered HTML/PPTX are built and validated separately. Running this script
again refreshes the three inserted slides and their assets without duplicating
them. Original version 03 is archived in versions/v3-before-returns.
"""
from pathlib import Path
import json
import shutil

ROOT = Path(__file__).resolve().parent.parent
source = ROOT / 'src/deck-v3.json'
data = json.loads(source.read_text())

def graphic(name, structure, alt):
    return (f'<div class="{structure}" style="display:block;height:620px">'
            f'<img src="ASSET:{name}.svg" alt="{alt}" '
            'style="display:block;width:1744px;height:620px;object-fit:contain" /></div>')

slides = [
    {
        'id': 'returns-comparison',
        'title': 'One return, two allocations of intelligence',
        'eyebrow': '02 / A worked return',
        'layout': 'S08', 'theme': 'light',
        'body': graphic('returns-slide-comparison', 'duo-compare',
            'The same five return steps in two architectures. The wrapper invokes a frontier model before every step. The disaggregated graph uses trusted services for identity, receipt, policy and return creation, with koa-action or Jev only at the semantic reason node.'),
        'sources': ['L1', 'S3', 'R1'],
        'purpose': 'Make the allocation of inference visible while holding service safeguards constant.',
        'talk': [
            'Begin with the same request: I want to return these headphones. Read the five aligned checkpoints across the two panels: authenticate, match the receipt, route the reason, apply policy and shipping, then confirm and authorize.',
            'The left is the selected wrapper design: a frontier model repeatedly proposes the next step, then consumes the tool result. A well-designed wrapper can still enforce every business safeguard through its services. The purple reason card is model output; the blue operations are trusted services.',
            'On the right, AgentScript configures Agent Graph to execute the known dependencies. Only the semantic question is assigned to a System One model. koa-action and Jev illustrate that role; this does not establish a common schema or native Salesforce adapter.',
            'This view shows the routine path. One bounded call is the count in this schematic, not a benchmark or a promise about every deployment. Ordinary customer messages may use templates. Any additional generated response must be counted in the service cost.',
            'Keep authentication and ownership authoritative. An unverified customer signs in; denial stops protected work. A receipt mismatch goes to verification, not more powerful model reasoning. The return service rechecks access, policy and quantity before creating an authorization.'
        ],
        'transition': 'Expand the exception branch to see when frontier reasoning is actually justified.',
        'status': 'Proposed architecture · routine path shown', 'minutes': 1.2,
    },
    {
        'id': 'returns-fallback',
        'title': 'Frontier reasoning needs an explicit gate',
        'eyebrow': '02 / Escalate the remaining question',
        'layout': 'S17', 'theme': 'dark',
        'body': graphic('returns-slide-fallback', 'system-diagram',
            'After identity and purchase ownership are verified, routine requests go to policy. Unclear or complex requests receive one useful clarification and a policy precheck. Only residual complexity with complete required facts and a passing precheck reaches a frontier model. A human validates its proposal or holds; verified facts return to the same policy before confirmation and commit.'),
        'sources': ['T4', 'S3', 'R2'],
        'purpose': 'Show frontier reasoning as a gated interpretation branch with no shortcut to authorization.',
        'talk': [
            'Identity and purchase ownership are already verified before the part of the graph shown here. The branch labels routine, unclear and complex are proposed application categories, not provider response fields.',
            'Ask one useful clarification and run known mandatory policy checks before any frontier call. Resolved clarification returns directly to policy. A known deadline or item-rule failure declines the standard request. Missing required facts remain pending; inference cannot replace evidence.',
            'Suppose a request mixes a completed repair, an open replacement offer and a conditional return. Verify the repair and replacement records first. If the facts are available but the remaining customer intent still needs substantive interpretation, a scoped frontier proposal can assist an authorized reviewer.',
            'The frontier receives authorized facts and the remaining question. Human validation may establish a routine return, another requested task, or a need to hold. Only verified information re-enters the same policy. No policy-override mechanism exists in this teaching flow.',
            'Invalid or timed-out model outputs take bounded technical recovery and then human handling, not an unbounded reasoning loop. Preserve any other requested task through the return branch. A successful backend write, not a recommendation, is the final authorization.'
        ],
        'transition': 'Now make the business rule concrete: loyalty changes eligibility and shipping independently of the model.',
        'status': 'Illustrative flow · no policy override', 'minutes': 1.5,
    },
    {
        'id': 'returns-policy',
        'title': 'Loyalty changes the window and the fee',
        'eyebrow': '02 / An explicit merchant policy',
        'layout': 'S21', 'theme': 'light',
        'body': graphic('returns-slide-policy', 'tech-spec',
            'Illustrative policy: Standard return requests within 30 days after delivery have five-dollar shipping, while Plus requests within 60 days have shipping waived. Both need all prerequisites and customer confirmation. Standard day 18 and Plus day 45 are eligible with different fees; Standard day 45 declines without frontier escalation.'),
        'sources': ['R2', 'R3'],
        'purpose': 'Separate trusted eligibility and fee rules from semantic interpretation and from transaction success.',
        'talk': [
            'These tiers, deadlines, fees and worked examples are invented for teaching. Both architectures use exactly the same versioned merchant policy and service requirements.',
            'The identity and order services establish the customer, owned receipt, item and available unreturned quantity. Tier comes from a current authorized membership lookup. An unknown tier does not default to Standard. Missing facts and manual review hold the case.',
            'Compare the immutable request-received timestamp to the authoritative delivery deadline in the declared merchant time zone. Clarification time must not turn an on-time request into a late request.',
            'Standard day 18 receives a five-dollar quote; Plus day 45 receives a waived-shipping quote. Standard day 45 is outside the ordinary window, so frontier reasoning has nothing to change about that known policy result.',
            'For an eligible return, obtain confirmation of item, quantity and shipping terms. The backend rechecks current access, policy, tier and quantity; changed terms require renewed confirmation. Use a stable idempotency key and reconcile an unknown write outcome before retrying. '
            'Return authorized means the service issued a return ID and the confirmed shipping label. Inspection and any refund settlement happen later. Semantic judgment chooses a route, while rules and service results establish the business outcome.'
        ],
        'transition': 'With the worked graph in view, locate its runtime and configuration within the broader agent harness.',
        'status': 'Invented policy and cases · no measured results', 'minutes': 1.2,
    },
]

ids = {s['id'] for s in slides}
data['slides'] = [s for s in data['slides'] if s['id'] not in ids]
anchor = next(i for i, s in enumerate(data['slides']) if s['id'] == 'topology')
data['slides'][anchor]['transition'] = 'Apply that idea to a product return with the same business safeguards in both architectures.'
data['slides'][anchor+1:anchor+1] = slides
data['sources'].update({
    'R1': ['Full return comparison', '../diagrams/returns-comparison.svg'],
    'R2': ['Return policy illustration', '../diagrams/returns-policy.svg'],
    'R3': ['Return walkthrough · blog 08', '../blog/08-building-prod.md'],
})
data['sources']['M1'][1] = '../blog/08-building-prod.md'
source.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
for name in ['returns-slide-comparison', 'returns-slide-fallback', 'returns-slide-policy']:
    shutil.copy2(ROOT.parent/'diagrams'/f'{name}.svg', ROOT/'assets'/f'{name}.svg')
print(f'Updated source: {len(data["slides"])} slides; copied three vector teaching views.')
