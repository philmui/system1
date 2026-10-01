import { expect, test } from '@playwright/test';
import type { Event, LessonCatalogue } from '../src/lib/api.generated';
import raw from '../src/data/lessons.json' with { type: 'json' };
import { parseLocation, learningHref } from '../src/lib/navigation';
import { discoveryFrontierAttempts, lessonState } from '../src/lib/lessonState';
import { classificationDecision } from '../src/lib/classification';

const catalogue = raw as unknown as LessonCatalogue;
test('Find uses code planning while Compare includes actual frontier planning and composition', () => {
  expect(discoveryFrontierAttempts(catalogue.discovery.find.events)).toBe(0);
  expect(discoveryFrontierAttempts(catalogue.discovery.compare.events)).toBe(2);
  expect(discoveryFrontierAttempts([])).toBe(0);
});
test('education routes retain scene, document, recording and comparison source; old routes remain valid', () => {
  expect(parseLocation('')).toMatchObject({ view: 'explore', scene: 'classify', example: 'clear' });
  expect(parseLocation('#workflow')).toMatchObject({ view: 'explore', scene: 'review' });
  expect(parseLocation('#documents').view).toBe('library');
  expect(parseLocation('#library').view).toBe('library');
  expect(parseLocation('#runs/retained-id').runId).toBe('retained-id');
  const context = parseLocation('#explore/classify?example=ambiguous&run=retained-id&document=doc&source=recorded');
  expect(parseLocation(learningHref('compare', context))).toEqual({ ...context, view: 'compare' });
  expect(parseLocation(learningHref('experiment', context))).toEqual({ ...context, view: 'experiment' });
});

test('prepared examples use executed signals and expose no later judgment or publication in an earlier prefix', () => {
  const { events } = catalogue.classification.snapshot;
  const ids = catalogue.classification.documents.map(item => item.document.id);
  const doc = catalogue.classification.documents.find(item => item.example_id === 'proposed')!;
  const index = events.findIndex(event => event.type === 'decision' && event.instance_id === `${doc.document.id}:jev`);
  const before = lessonState(events.slice(0, index), ids);
  expect(classificationDecision(before.execution, doc.document.id)).toBeUndefined();
  expect(before.published.has(doc.document.id)).toBe(false);
  const at = lessonState(events.slice(0, index + 1), ids);
  expect(classificationDecision(at.execution, doc.document.id)).toMatchObject({ selected_route: 'interpret', policy_reason: 'mixed_purpose', signal: { confidence: .96 } });
  expect(at.status(doc.document.id)).toBe('Interpretation selected');
  const final = lessonState(events, ids);
  expect(final.usage.boundedCalls).toBe(5);
  expect(final.usage.frontierCalls).toBe(2);
  expect(final.published.size).toBe(5);
});

test('the versioned mixed-purpose report records a guarded high-confidence report judgment before its proposal', () => {
  const subject = catalogue.classification.documents.find(item => item.example_id === 'ambiguous')!;
  const { events } = catalogue.classification.snapshot;
  expect(catalogue.version).toBe('disaggregated-lessons-v3');
  expect(subject).toMatchObject({ title: 'Mixed-purpose report', cue: 'Report + proposed terms', reference_category: 'report', expected_reason: 'mixed_purpose' });
  expect(subject.document.filename).toBe('mixed-purpose-report-v3.md');
  expect(subject.source_excerpt).toContain('proposed milestone agreement');
  expect(subject.text).toContain('Delivery status');
  const index = events.findIndex(event => event.type === 'decision' && event.instance_id === `${subject.document.id}:jev`);
  const at = lessonState(events.slice(0, index + 1), [subject.document.id]);
  const decision = classificationDecision(at.execution, subject.document.id);
  expect(decision).toMatchObject({ selected_route: 'interpret', policy_reason: 'mixed_purpose', threshold: .8,
    signal: { provider: 'fixture', choice: 'report', confidence: .96 } });
  expect(at.execution.decisions[`${subject.document.id}:interpret`]).toBeUndefined();
  expect(at.published.has(subject.document.id)).toBe(false);
  const completed = lessonState(events, [subject.document.id]);
  expect(completed.execution.decisions[`${subject.document.id}:interpret`]?.at(-1)?.signal).toMatchObject({ provider: 'fixture', kind: 'proposal', category: 'report' });
  expect(completed.publishedCategories.get(subject.document.id)).toBe('report');
});

test('an accepted category and an unrelated completed index are insufficient evidence of publication', () => {
  const make = (type: Event['type'], instance_id: string, payload: Record<string, unknown>, sequence: number): Event => ({ type, instance_id, payload, sequence, event_id: `${sequence}`, timestamp: '2026-09-29T00:00:00Z', run_id: 'run', schema_version: 1, parent_instance_id: null, attempt: 1 });
  const events = [make('decision', 'doc:jev', { selected_route: 'accept', signal: { kind: 'choice', choice: 'invoice', confidence: .97 } }, 1), make('node_completed', 'index', { state: 'succeeded', node_name: 'index', label: 'Index', output_count: 1 }, 2)];
  expect(lessonState(events, ['doc']).status('doc')).toBe('Category accepted');
  events.push(make('node_completed', 'doc:publish', { publication: { document_id: 'doc', status: 'searchable' } }, 3));
  expect(lessonState(events, ['doc']).status('doc')).toBe('Searchable');
  expect(lessonState(events.slice(0, 2), ['doc']).published.size).toBe(0);
  events.push(make('node_completed', 'doc:publish', { publication: { document_id: 'doc', status: 'withdrawn' } }, 4));
  expect(lessonState(events, ['doc']).published.size).toBe(0);
});
