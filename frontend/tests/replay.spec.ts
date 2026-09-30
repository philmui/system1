import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Event, ReviewRequest, Run } from '../src/lib/api.generated';
import { reduceEvents } from '../src/lib/events';
import { classificationReplaySteps, documentProgress } from '../src/lib/replay';
import { classificationUsage, exampleKind, routeLabel } from '../src/lib/classification';
import { buildExecutionGraph } from '../src/components/ExecutionGraph';
import { ClassificationDecision } from '../src/components/ClassificationLesson';
import { ReviewPanel } from '../src/components/ReviewPanel';

function log(entries: [Event['type'], string, Record<string, unknown>][]): Event[] {
  return entries.map(([type, instance_id, payload], index) => ({
    schema_version: 1, sequence: index + 1, event_id: `event-${index}`, timestamp: '2026-01-01T00:00:00Z',
    run_id: 'run', type, instance_id, payload, attempt: 1,
    parent_instance_id: /:(extract|jev|interpret|outcome|retrieve|screen)$/.test(instance_id) ? `worker:${instance_id.split(':')[0]}` : null,
  }));
}
const node = (node_name: string, state: string, document_id?: string, outcome?: string) => ({ node_name, label: node_name, state, document_id, outcome });
const edge = (source_instance_id: string, target_instance_id: string) => ({ source_instance_id, target_instance_id, label: 'Recorded route' });
const decision = (route = 'accept', choice = 'invoice') => ({
  selected_route: route, explanation: route === 'accept' ? 'Confidence meets the acceptance threshold.' : 'Confidence is below the threshold.',
  signal: { kind: 'choice', choice, confidence: route === 'accept' ? .97 : .51 },
});

const interleaved = log([
  ['run_started', 'run', {}],
  ['node_started', 'dispatch', node('dispatch', 'running')],
  ['worker_created', 'worker:a', node('worker', 'queued', 'a')],
  ['worker_created', 'worker:b', node('worker', 'queued', 'b')],
  ['node_started', 'a:extract', node('extract', 'running', 'a')],
  ['node_completed', 'a:extract', node('extract', 'succeeded', 'a')],
  ['edge_selected', 'a:extract', edge('a:extract', 'a:jev')],
  ['node_started', 'b:extract', node('extract', 'running', 'b')],
  ['node_started', 'a:jev', node('jev', 'running', 'a')],
  ['decision', 'b:jev', decision('interpret', 'contract')],
  ['node_completed', 'a:jev', node('jev', 'succeeded', 'a')],
  ['decision', 'a:jev', decision()],
  ['edge_selected', 'a:jev', edge('a:jev', 'a:outcome')],
  ['node_completed', 'a:outcome', node('outcome', 'succeeded', 'a', 'accepted')],
  ['node_completed', 'worker:a', node('worker', 'succeeded', 'a', 'accepted')],
  ['node_started', 'b:outcome', node('outcome', 'awaiting_review', 'b', 'awaiting_review')],
  ['node_completed', 'join', node('join', 'succeeded')],
  ['edge_selected', 'join', edge('join', 'review')],
  ['review_requested', 'review', { items: [{ document_id: 'b', proposal: 'contract' }] }],
  ['node_completed', 'worker:b', node('worker', 'succeeded', 'b', 'accepted')],
  ['review_resumed', 'review', { count: 1 }],
  ['edge_selected', 'review', edge('review', 'index')],
  ['node_started', 'index', node('index', 'running')],
  ['edge_selected', 'index', edge('index', 'done')],
  ['run_completed', 'run', { status: 'succeeded', result: { indexed_count: 2, outcomes: { a: { status: 'accepted', category: 'invoice' }, b: { status: 'accepted', category: 'contract' } } } }],
]);

test('document replay keeps recorded order while skipping other workers and bookkeeping', () => {
  const steps = classificationReplaySteps(interleaved, 'a');
  expect(steps.length).toBeLessThan(interleaved.length);
  expect(steps.map(step => step.cursor)).toEqual([...steps.map(step => step.cursor)].sort((a, b) => a - b));
  expect(new Set(steps.map(step => step.cursor)).size).toBe(steps.length);
  expect(steps.every(step => !step.documentId || step.documentId === 'a')).toBe(true);
  expect(steps.filter(step => step.kind === 'decision').map(step => step.badge)).toEqual(['Invoice · 97% confidence']);
  expect(steps.at(-1)?.cursor).toBe(interleaved.length);
  expect(steps.at(-1)?.title).toBe('Ready for discovery');
});

test('seeking backward never reveals a future category or an unchosen interpretation branch', () => {
  const steps = classificationReplaySteps(interleaved, 'a');
  const beforeDecision = steps.filter(step => step.cursor < 12);
  expect(beforeDecision.every(step => !step.badge)).toBe(true);
  expect(beforeDecision.every(step => step.stage !== 'interpret' && step.stage !== 'review')).toBe(true);
  expect(documentProgress(reduceEvents(interleaved.slice(0, 15)), 'a')).toBe('Accepted');
  expect(documentProgress(reduceEvents(interleaved), 'a')).toBe('Indexed');
  expect(documentProgress(reduceEvents([]), 'a')).toBe('Queued');
});

test('shared review does not send an already accepted document through human review', () => {
  const steps = classificationReplaySteps(interleaved, 'a');
  expect(steps.some(step => step.title === 'Waiting for other documents')).toBe(true);
  expect(steps.filter(step => step.kind === 'transfer').some(step => step.source === 'review' || step.target === 'review')).toBe(false);
  expect(steps.some(step => step.stage === 'review')).toBe(false);
  const proposal = classificationReplaySteps(interleaved, 'b');
  expect(proposal.some(step => step.target === 'review')).toBe(true);
  expect(proposal.some(step => step.title === 'Document approved by the reviewer')).toBe(true);
});

test('a transfer is visible before its target node starts, including while paused', () => {
  const execution = reduceEvents(interleaved.slice(0, 7));
  const step = classificationReplaySteps(interleaved, 'a').find(item => item.sequence === 7)!;
  const run = { id: 'run', kind: 'classification', request: { document_ids: ['a', 'b'] } } as unknown as Run;
  const graph = buildExecutionGraph({ run, execution, selected: null, focused: 'worker:a', expanded: false, moving: false, speed: 1, replayStep: step });
  expect(execution.instances['a:jev']).toBeUndefined();
  const transfer = graph.edges.find(item => item.source === 'dispatch' && item.target === 'judge')!;
  expect(transfer.data?.traversed).toBe(true);
  expect(transfer.data?.current).toBe(true);
  expect(transfer.data?.moving).toBe(false);
  expect(transfer.data?.packetLabel).toBe('01');
  expect(transfer.data!.travelDuration! * 1000).toBeLessThan(step.duration);
  expect(graph.nodes.find(item => item.id === 'judge')?.data.active).toBe(true);
  expect(graph.edges.filter(item => item.data?.current)).toHaveLength(1);
});

for (const status of ['extraction_issue', 'excluded']) test(`${status} stays out of indexing even when the rest of the batch succeeds`, () => {
  const events = log([
    ['worker_created', 'worker:a', node('worker', 'queued', 'a')],
    ...(status === 'extraction_issue' ? [
      ['node_failed', 'a:extract', { ...node('extract', 'failed', 'a'), detail: 'No readable text.' }],
      ['node_failed', 'worker:a', node('worker', 'failed', 'a', status)],
    ] : [
      ['review_requested', 'review', { items: [{ document_id: 'a', proposal: 'contract' }] }],
      ['node_completed', 'worker:a', node('worker', 'skipped', 'a', status)],
    ]) as [Event['type'], string, Record<string, unknown>][],
    ['edge_selected', 'review', edge('review', 'index')],
    ['node_started', 'index', node('index', 'running')],
    ['edge_selected', 'index', edge('index', 'done')],
    ['run_completed', 'run', { status: 'partially_succeeded', result: { indexed_count: 1, outcomes: { a: { status, category: 'unknown' } } } }],
  ]);
  const steps = classificationReplaySteps(events, 'a');
  expect(steps.some(step => step.stage === 'index')).toBe(false);
  expect(steps.at(-1)?.title).toBe('Document not indexed');
  expect(steps.at(-1)?.instanceId).toBe(status === 'extraction_issue' ? 'a:extract' : 'review');
  expect(documentProgress(reduceEvents(events), 'a')).toBe(status === 'extraction_issue' ? 'Needs attention' : 'Excluded');
});

test('a cancelled recording never claims that an accepted worker was indexed', () => {
  const events = log([
    ['node_completed', 'worker:a', node('worker', 'succeeded', 'a', 'accepted')],
    ['run_completed', 'run', { status: 'cancelled', result: null }],
  ]);
  const last = classificationReplaySteps(events, 'a').at(-1)!;
  expect(last.kind).toBe('error');
  expect(last.title).toBe('Run cancelled');
  expect(last.instanceId).not.toBe('done');
});

test('a successful retry clears the earlier failure from the current route explanation', () => {
  const events = log([
    ['node_failed', 'a:jev', node('jev', 'failed', 'a')],
    ['node_started', 'a:jev', node('jev', 'running', 'a')],
    ['node_completed', 'a:jev', node('jev', 'succeeded', 'a')],
    ['decision', 'a:jev', decision()],
    ['edge_selected', 'a:jev', edge('a:jev', 'a:outcome')],
  ]);
  const steps = classificationReplaySteps(events, 'a');
  expect(steps[0].title).toBe('Processing failed');
  expect(steps.at(-1)?.title).toBe('Taking the accepted route');
});

test('high confidence is still escalated by the recorded guard, with prefix-only evidence', () => {
  const events = log([
    ['node_completed', 'a:jev', node('jev', 'succeeded', 'a')],
    ['decision', 'a:jev', { ...decision('interpret', 'contract'), threshold: .8, policy_reason: 'mixed_purpose',
      signal: { kind: 'choice', choice: 'contract', confidence: .96 }, explanation: 'A mixed-purpose email requires interpretation.' }],
    ['edge_selected', 'a:jev', edge('a:jev', 'a:interpret')],
  ]);
  const run = { id: 'run', kind: 'classification', mode: 'test-fixture', request: { document_ids: ['a'] }, configuration: { choice_threshold: .8 } } as unknown as Run;
  const before = renderToStaticMarkup(createElement(ClassificationDecision, { run, execution: reduceEvents(events.slice(0, 1)), documentId: 'a', onSource: () => {} }));
  expect(before).not.toContain('96%'); expect(before).not.toContain('overrides confidence');
  const execution = reduceEvents(events);
  const html = renderToStaticMarkup(createElement(ClassificationDecision, { run, execution, documentId: 'a', onSource: () => {} }));
  expect(html).toContain('96% confidence'); expect(html).toContain('guard overrides confidence');
  expect(html).toContain('Request interpretation (simulated)');
  expect(exampleKind(execution, 'a')).toBe('policy');
  const graph = buildExecutionGraph({ run, execution, focused: 'worker:a', selected: null, expanded: false, moving: true, speed: 1, replayStep: classificationReplaySteps(events, 'a').at(-1) });
  expect(graph.edges.find(item => item.source === 'policy' && item.target === 'interpret')?.data?.current).toBe(true);
  expect(graph.edges.find(item => item.source === 'policy' && item.target === 'accept')?.data?.traversed).toBe(false);
  expect(graph.nodes.find(item => item.id === 'accept')?.data.dimmed).toBe(true);
  expect(graph.nodes.find(item => item.id === 'policy')?.data.title).toBe('Runtime policy');
});

test('a recorded failure bypass cannot become an accepted route after later successful work', () => {
  const events = log([
    ['node_failed', 'a:jev', node('jev', 'failed', 'a')],
    ['edge_selected', 'a:jev', edge('a:jev', 'a:outcome')],
    ['node_started', 'a:jev', node('jev', 'running', 'a')],
    ['node_completed', 'a:jev', node('jev', 'succeeded', 'a')],
    ['decision', 'a:jev', decision()],
    ['edge_selected', 'a:jev', edge('a:jev', 'a:outcome')],
  ]);
  const execution = reduceEvents(events);
  expect(execution.edges[0].sourceState).toBe('failed');
  expect(execution.edges[0].decision).toBeUndefined();
  const run = { kind: 'classification', request: { document_ids: ['a'] } } as unknown as Run;
  const graph = buildExecutionGraph({ run, execution, focused: 'worker:a', selected: null, expanded: false, moving: false, speed: 1 });
  expect(graph.edges.find(item => item.source === 'judge' && item.target === 'join')?.data?.label).toBe('Record failed call');
  expect(graph.edges.find(item => item.source === 'policy' && item.target === 'accept')?.data?.traversed).toBe(true);
  const stopped = renderToStaticMarkup(createElement(ClassificationDecision, { run, execution: reduceEvents(events.slice(0, 2)), documentId: 'a', onSource: () => {} }));
  expect(stopped).toContain('Judgment failed'); expect(stopped).not.toContain('Waiting for a recorded judgment');
});

test('mixed frontier outcomes keep both the successful proposal and the failed call visible', () => {
  const events = log([
    ['node_failed', 'a:interpret', node('interpret', 'failed', 'a')],
    ['edge_selected', 'a:interpret', edge('a:interpret', 'a:outcome')],
    ['node_completed', 'b:interpret', node('interpret', 'succeeded', 'b')],
    ['edge_selected', 'b:interpret', edge('b:interpret', 'b:outcome')],
  ]);
  const run = { kind: 'classification', request: { document_ids: ['a', 'b'] } } as unknown as Run;
  const graph = buildExecutionGraph({ run, execution: reduceEvents(events), focused: '', selected: null, expanded: false, moving: false, speed: 1 });
  expect(graph.nodes.find(item => item.id === 'interpret')?.data.state).toBe('partially_succeeded');
  expect(graph.edges.find(item => item.source === 'interpret' && item.target === 'join')?.data?.label).toBe('Proposals & issues');
});

test('the frontier comparison counts attempts separately from distinct readable documents', () => {
  const events = log([
    ['node_completed', 'a:extract', node('extract', 'succeeded', 'a')],
    ['node_completed', 'b:extract', node('extract', 'succeeded', 'b')],
    ['node_failed', 'c:extract', node('extract', 'failed', 'c')],
    ['node_started', 'a:jev', node('jev', 'running', 'a')],
    ['node_started', 'b:jev', node('jev', 'running', 'b')],
    ['node_failed', 'b:jev', node('jev', 'failed', 'b')],
    ['node_started', 'b:jev', node('jev', 'running', 'b')],
    ['decision', 'a:jev', decision()],
    ['decision', 'b:jev', decision('interpret')],
    ['node_started', 'b:interpret', node('interpret', 'running', 'b')],
    ['node_failed', 'b:interpret', node('interpret', 'failed', 'b')],
    ['node_started', 'b:interpret', node('interpret', 'running', 'b')],
    ['node_completed', 'worker:b', node('worker', 'succeeded', 'b')],
    ['run_completed', 'run', { status: 'succeeded', result: { indexed_count: 2, outcomes: { a: { status: 'accepted' }, b: { status: 'accepted' } } } }],
  ]);
  expect(classificationUsage(events)).toEqual({ readable: 2, boundedCalls: 3, frontierCalls: 2, frontierDocuments: 1 });
  const execution = reduceEvents(events);
  expect(documentProgress(execution, 'b')).toBe('Indexed');
  expect(routeLabel(execution, 'a')).toBe('System 1 only');
  expect(routeLabel(execution, 'b')).toBe('Frontier called');
  expect(routeLabel(execution, 'c')).toBe('No model calls');
});

test('discovery handoffs are visible before destinations start and shared planning never becomes document 00', () => {
  const events = log([
    ['run_started', 'run', {}],
    ['edge_selected', 'intent', edge('intent', 'plan')],
    ['worker_created', 'worker:t1', { ...node('retrieval_worker', 'queued'), task_id: 't1' }],
    ['edge_selected', 'plan', edge('plan', 't1:retrieve')],
    ['node_completed', 't1:retrieve', node('retrieve', 'succeeded')],
    ['edge_selected', 't1:retrieve', edge('t1:retrieve', 't1:screen')],
  ]);
  const run = { id: 'discovery', kind: 'discovery', request: { query: 'Find invoices' } } as unknown as Run;
  for (const expanded of [false, true]) {
    for (const [cursor, from, targetSuffix, packet] of [[2, 'intent', 'plan', 'ALL'], [4, 'plan', 'retrieve', '01'], [6, 'retrieve', 'screen', '01']] as const) {
      const execution = reduceEvents(events.slice(0, cursor));
      const graph = buildExecutionGraph({ run, execution, focused: 'worker:t1', selected: null, expanded, moving: false, speed: 1 });
      const active = graph.edges.find(item => item.source.endsWith(from) && item.target.endsWith(targetSuffix));
      expect(active?.data?.traversed).toBe(true);
      expect(active?.data?.current).toBe(true);
      expect(active?.data?.packetLabel).toBe(packet);
      expect(active?.data?.moving).toBe(false);
    }
  }
});

test('scripted review is labeled as simulated and unknown proposals cannot be accepted', () => {
  const steps = classificationReplaySteps(interleaved, 'b', true);
  expect(steps.some(step => step.title === 'Document approved in simulated review')).toBe(true);
  expect(steps.some(step => step.detail.includes('A person approved'))).toBe(false);
  const html = renderToStaticMarkup(createElement(ReviewPanel, { review: { interrupt_id: 'test', revision: 1,
    items: [{ document_id: 'a', filename: 'fragment.txt', proposal: 'unknown', explanation: 'Insufficient evidence' }] } as ReviewRequest,
    submitting: false, onSource: () => {}, onSubmit: () => {} }));
  expect(html).not.toContain('value="accept"');
  expect(html).toContain('Exclude from search'); expect(html).toContain('Change to Invoice');
});
