// Synthetic, local illustration of the reference's routing policy. No provider calls.
export type Answer = 'yes' | 'no' | 'uncertain';
export type ReviewRoute = 'produce' | 'aside' | 'redact' | 'attorney';
export interface ExamplePage {
  id: string;
  title: string;
  kind: string;
  responsive: Answer;
  pii: Answer;
  privileged: Answer;
  text: string;
  redacted?: string;
}
export const examplePages: ExamplePage[] = [
  {
    id: 'ARC-000141', title: 'Quarterly revenue', kind: 'Financial report',
    responsive: 'yes', pii: 'no', privileged: 'no',
    text: 'Q3 REVENUE REVIEW\n\nFinance is assessing the timing of revenue booked near the quarter end. A group of shipments left the facility in October but was included in September totals. The team will reconcile the entries before the next reporting cycle.',
  },
  {
    id: 'ARC-000212', title: 'Facilities update', kind: 'Internal notice',
    responsive: 'no', pii: 'no', privileged: 'no',
    text: 'FACILITIES UPDATE\n\nThe east loading area is scheduled for maintenance next week. Please use the west entrance during the work. The staff kitchen will remain open. This notice does not address revenue recognition or the quarterly accounts.',
  },
  {
    id: 'ARC-000377', title: 'Cutoff approvals', kind: 'Approval record',
    responsive: 'yes', pii: 'yes', privileged: 'no',
    text: 'QUARTER-END ADJUSTMENT\n\nThe finance team approved a change to the Q3 cutoff entries.\n\nApprover: Jordan Lee\nEmail: jordan.lee@arcadia.example\nPhone: 555-0134\nEmployee number: 44192\n\nThe adjustment is documented in the supporting revenue workpapers.',
    redacted: 'QUARTER-END ADJUSTMENT\n\nThe finance team approved a change to the Q3 cutoff entries.\n\nApprover: [REDACTED]\nEmail: [REDACTED]\nPhone: [REDACTED]\nEmployee number: [REDACTED]\n\nThe adjustment is documented in the supporting revenue workpapers.',
  },
  {
    id: 'ARC-000401', title: 'Counsel’s advice', kind: 'Attorney communication',
    responsive: 'yes', pii: 'no', privileged: 'yes',
    text: 'CONFIDENTIAL LEGAL ADVICE\n\nTo the finance leadership team:\n\nThis communication contains counsel’s assessment of litigation exposure relating to the revenue cutoff. Please restrict circulation to those seeking legal advice. Counsel should review whether this page may be produced.',
  },
  {
    id: 'ARC-000455', title: 'Partial handwritten note', kind: 'Incomplete OCR',
    responsive: 'uncertain', pii: 'no', privileged: 'uncertain',
    text: 'PARTIAL TRANSCRIPTION\n\n… quarter end? Check with legal before [unreadable] … timing adjustment … not for the presentation … [unreadable].\n\nThe fragment does not provide enough context to make a confident responsiveness or privilege decision.',
  },
  {
    id: 'ARC-000508', title: 'Committee minutes', kind: 'Meeting record',
    responsive: 'yes', pii: 'no', privileged: 'no',
    text: 'AUDIT COMMITTEE — REVENUE TIMING\n\nThe committee requested an analysis comparing the quarterly figures under two possible cutoff dates. Finance will prepare a reconciliation of the affected shipments. The committee deferred its decision pending those figures.',
  },
];

export function exampleRoute(page: ExamplePage): ReviewRoute {
  if (page.privileged !== 'no') return 'attorney';
  if (page.responsive === 'no') return 'aside';
  if (page.responsive === 'uncertain' || page.pii === 'uncertain') return 'attorney';
  return page.pii === 'yes' ? 'redact' : 'produce';
}
