// Shared fictional sources. Prepared routing below makes no provider calls.
import corpus from '../../../data/education-examples/review-pages-v1.json' with { type: 'json' };
export type Answer = 'yes' | 'no' | 'uncertain';
export type ReviewRoute = 'produce' | 'aside' | 'redact' | 'attorney';
export interface ExamplePage {
  id: string;
  content_version: string;
  title: string;
  kind: string;
  responsive: Answer;
  pii: Answer;
  privileged: Answer;
  text: string;
  redacted?: string;
}
export const examplePages = corpus.pages as ExamplePage[];

export function exampleRoute(page: ExamplePage): ReviewRoute {
  if (page.privileged !== 'no') return 'attorney';
  if (page.responsive === 'no') return 'aside';
  if (page.responsive === 'uncertain' || page.pii === 'uncertain') return 'attorney';
  return page.pii === 'yes' ? 'redact' : 'produce';
}
