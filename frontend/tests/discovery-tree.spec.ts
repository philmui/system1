import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Event, LessonCatalogue } from '../src/lib/api.generated';
import { discoveryTree, type DiscoveryTreeId } from '../src/lib/discoveryTree';
import { discoveryFrontierAttempts } from '../src/lib/lessonState';
import { discoveryPerformance } from '../src/lib/discoveryPerformance';
import { DiscoveryDecisionTree } from '../src/components/DiscoveryDecisionTree';
import raw from '../src/data/lessons.json' with { type: 'json' };
import { mockLiveDiscovery } from './helpers/liveDiscoveryFixture';

const catalogue = raw as unknown as LessonCatalogue;
const findEvents = catalogue.discovery.find.events;
const compareEvents = catalogue.discovery.compare.events;
const node = (tree: ReturnType<typeof discoveryTree>, id: DiscoveryTreeId) => tree.nodes.find(item => item.id === id)!;
const visited = (tree: ReturnType<typeof discoveryTree>) => tree.edges.filter(edge => edge.visited).map(edge => edge.id);
const selected = (tree: ReturnType<typeof discoveryTree>) => tree.nodes.filter(item => item.selected).map(item => item.id);
const render = (events: Event[], playing = false) => renderToStaticMarkup(createElement(DiscoveryDecisionTree, {
  tree: discoveryTree(events), playing, speed: 1, onInspect: () => {},
}));
function appended(events: Event[], type: Event['type'], instanceId: string, payload: Event['payload']): Event[] {
  const sequence = (events.at(-1)?.sequence || 0) + 1;
  return [...events, {
    schema_version: 1, event_id: `test-event-${sequence}`, sequence, timestamp: `2026-09-30T12:00:${String(sequence).padStart(2, '0')}Z`,
    run_id: 'isolated-tree-contract', instance_id: instanceId, parent_instance_id: null, attempt: 1, type, payload,
  }];
}
const through = (events: Event[], type: Event['type'], instance: string) => events.slice(0, events.findIndex(event => event.type === type && event.instance_id === instance) + 1);

test('before a recorded decision both plans remain possibilities and no route or outcome is invented', () => {
  const empty = discoveryTree([]);
  expect(empty.nodes).toHaveLength(6);
  expect(selected(empty)).toEqual([]);
  expect(visited(empty)).toEqual([]);
  expect(empty.evidenceCount).toBeUndefined();
  for (const id of ['code-plan', 'frontier-plan', 'sources', 'answer'] as const) expect(node(empty, id).status).toBe('Possible route');
  const beforeDecision = discoveryTree(compareEvents.slice(0, compareEvents.findIndex(event => event.type === 'decision')));
  expect(beforeDecision.decision).toBeUndefined();
  expect(selected(beforeDecision)).toEqual(['judgment']);
  expect(node(beforeDecision, 'frontier-plan').selected).toBe(false);
  expect(beforeDecision.outputEdge).toBeUndefined();
  expect(visited(beforeDecision)).toEqual([]);
  const html = render([]);
  expect((html.match(/<button\b/g) || [])).toHaveLength(6);
  expect(html).toContain('aria-label="Discovery capability flow"');
  expect(html).toContain('System 1 Model → Runtime');
  expect(html).toContain('Select for recorded evidence.');
  expect(html).not.toContain('is-on-path');
  expect(html).not.toContain('is-traversed');
  expect(html).not.toContain('claims returned');
});

test('clear Find uses code planning, shared evidence work, and sources without a frontier call', () => {
  const tree = discoveryTree(findEvents);
  expect(selected(tree)).toEqual(['judgment', 'code-plan', 'evidence', 'sources']);
  expect(visited(tree)).toEqual(['judgment--code-plan', 'code-plan--evidence', 'evidence--sources']);
  expect(tree.evidenceCount).toBe(2);
  expect(node(tree, 'frontier-plan').status).toBe('Not selected');
  expect(node(tree, 'answer').status).toBe('Not selected');
  expect(node(tree, 'sources').detail).toContain('2 passages');
  expect(tree.receipt).toContain('without frontier composition');
  expect(discoveryFrontierAttempts(findEvents)).toBe(0);
  const html = render(findEvents);
  expect(html).toMatch(/data-tree-id="code-plan"[^>]*class="[^"]*is-on-path/);
  expect(html).toMatch(/data-tree-id="frontier-plan"[^>]*class="[^"]*is-alternative/);
  expect(html).toContain('Code → System 1 Model → Runtime');
  expect(html).not.toMatch(/\d+(?:\.\d+)?\s(?:ms|s)\b/);
});

test('Compare records frontier planning and a separate composition decision after accepted evidence', () => {
  const tree = discoveryTree(compareEvents);
  expect(selected(tree)).toEqual(['judgment', 'frontier-plan', 'evidence', 'answer']);
  expect(visited(tree)).toEqual(['judgment--frontier-plan', 'frontier-plan--evidence', 'evidence--answer']);
  expect(node(tree, 'code-plan').status).toBe('Not selected');
  expect(node(tree, 'sources').status).toBe('Not selected');
  expect(node(tree, 'answer').detail).toContain('2 claims returned');
  expect(node(tree, 'answer').roles).toBe('Frontier drafts · Code + System 1 check');
  expect(tree.receipt).toContain('has accepted evidence');
  expect(discoveryFrontierAttempts(compareEvents)).toBe(2);
});

test('grouped capabilities keep unfinished policy and output checks visible and never borrow an alternative’s evidence', () => {
  const beforePolicy = discoveryTree(through(compareEvents, 'node_completed', 'intent'));
  expect(node(beforePolicy, 'judgment').status).toBe('Applying policy');
  expect(beforePolicy.decision).toBeUndefined();
  const afterPolicy = discoveryTree(through(compareEvents, 'decision', 'intent'));
  expect(node(afterPolicy, 'judgment').status).toBe('Rule applied');
  // Intent timing cannot include later evidence/support policy evaluations.
  expect(node(discoveryTree(compareEvents), 'judgment').componentIds).toEqual(['intent']);
  expect(node(discoveryTree(findEvents), 'frontier-plan').componentIds).toEqual([]);
  expect(node(discoveryTree(compareEvents), 'code-plan').componentIds).toEqual([]);
  expect(node(discoveryTree(findEvents), 'code-plan').componentIds).toEqual(['plan']);
  expect(node(discoveryTree(compareEvents), 'frontier-plan').componentIds).toEqual(['plan']);
  for (const [instance, status] of [['synthesize', 'Citation checks next'], ['citations', 'Support checks next'], ['support', 'Preparing results']] as const) {
    const events = through(compareEvents, 'node_completed', instance);
    expect(events.length, `a recorded ${instance} completion exists`).toBeGreaterThan(0);
    const answer = node(discoveryTree(events), 'answer');
    expect(answer.status).toBe(status);
    expect(answer.detail).not.toContain('claims returned');
    expect(render(events)).not.toContain('Result ready');
  }
  expect(node(discoveryTree(compareEvents), 'answer').status).toBe('Result ready');
});

test('an uncertain Find can use frontier planning and still return sources according to its later recorded output gate', () => {
  const events = structuredClone(findEvents);
  const decision = events.find(event => event.type === 'decision' && event.instance_id === 'intent')!;
  decision.payload.selected_route = 'plan';
  decision.payload.explanation = 'The find intent is uncertain; interpretation is required.';
  decision.payload.signal = { ...(decision.payload.signal as object), confidence: .52 };
  for (const event of events.filter(event => event.instance_id === 'plan' && event.type.startsWith('node_'))) event.payload.label = 'Frontier query plan';
  const tree = discoveryTree(events);
  expect(tree.decision?.signal).toMatchObject({ choice: 'find', confidence: .52 });
  expect(node(tree, 'judgment').detail).toBe('find → frontier planning');
  expect(selected(tree)).toEqual(['judgment', 'frontier-plan', 'evidence', 'sources']);
  expect(visited(tree)).toEqual(['judgment--frontier-plan', 'frontier-plan--evidence', 'evidence--sources']);
  expect(node(tree, 'answer').selected).toBe(false);
  expect(tree.receipt).toContain('without frontier composition');
  expect(discoveryFrontierAttempts(events)).toBe(1);
});

test('unknown accepted counts stay unknown; zero accepted evidence after a failed task remains visibly partial work', () => {
  const beforeJoin = compareEvents.slice(0, compareEvents.findIndex(event => event.type === 'node_completed' && event.instance_id === 'join'));
  expect(discoveryTree(beforeJoin).evidenceCount).toBeUndefined();
  expect(node(discoveryTree(beforeJoin), 'evidence').detail).not.toContain('0 accepted');
  let failed = through(compareEvents, 'node_completed', 'plan');
  failed = appended(failed, 'node_failed', 'task-failed:retrieve', { node_name: 'retrieve', label: 'Retrieve passages', state: 'failed', detail: 'Search unavailable' });
  failed = appended(failed, 'node_completed', 'join', { node_name: 'join', label: 'Join outcomes', state: 'succeeded', output_count: 0 });
  failed = appended(failed, 'edge_selected', 'join', { source_instance_id: 'join', target_instance_id: 'done', label: 'No accepted evidence' });
  const tree = discoveryTree(failed);
  expect(tree.evidenceCount).toBe(0);
  expect(node(tree, 'evidence')).toMatchObject({ status: 'Partial work', failed: true });
  expect(node(tree, 'evidence').detail).toContain('task failure recorded');
  expect(node(tree, 'sources').selected).toBe(true);
  expect(node(tree, 'answer').selected).toBe(false);
  expect(tree.receipt).toContain('returns a gap');
  const html = render(failed);
  expect(html).toMatch(/data-tree-id="evidence"[^>]*has-failed-work/);
  expect(html).toContain('Partial work');
  expect(html).not.toContain('0 claims returned');
});

test('historical or malformed result arrays keep their counts unavailable while actual empty arrays remain zero', () => {
  for (const [recording, id, key, unavailable, zero] of [
    [findEvents, 'sources', 'passages', 'Passage count unavailable', '0 passages'],
    [compareEvents, 'answer', 'claims', 'Claim count unavailable', '0 claims returned'],
  ] as const) {
    for (const value of [undefined, null, { count: 2 }, '2']) {
      const events = structuredClone(recording);
      const terminal = events.find(event => event.type === 'run_completed')!;
      terminal.payload.result = { ...(terminal.payload.result as object), [key]: value, partial: true };
      const card = node(discoveryTree(events), id);
      expect(card.selected).toBe(true);
      expect(card.detail).toContain(unavailable);
      expect(card.detail).toContain('partial result');
      expect(card.detail).not.toContain(zero);
      const html = render(events);
      expect(html).toContain(unavailable);
      expect(html).not.toContain(zero);
    }
    const events = structuredClone(recording);
    const terminal = events.find(event => event.type === 'run_completed')!;
    terminal.payload.result = { ...(terminal.payload.result as object), [key]: [] };
    expect(node(discoveryTree(events), id).detail).toContain(zero);
    expect(render(events)).not.toContain(unavailable);
  }
});

test('unsupported intent only highlights the recorded direct scope-response edge and never implies a search', () => {
  let events = structuredClone(through(findEvents, 'decision', 'intent'));
  const decision = events.at(-1)!;
  decision.payload.selected_route = 'unsupported';
  decision.payload.signal = { ...(decision.payload.signal as object), choice: 'unsupported' };
  expect(visited(discoveryTree(events))).toEqual([]);
  events = appended(events, 'edge_selected', 'intent', { source_instance_id: 'intent', target_instance_id: 'done', label: 'Outside scope' });
  const tree = discoveryTree(events);
  expect(selected(tree)).toEqual(['judgment', 'sources']);
  expect(visited(tree)).toEqual(['judgment--sources']);
  expect(tree.edges.find(edge => edge.id === 'judgment--sources')?.current).toBe(true);
  expect(node(tree, 'sources').title).toBe('Return a scope response');
  expect(node(tree, 'sources').detail).toContain('no search');
  expect(node(tree, 'evidence').status).toBe('Not used');
  expect(node(tree, 'answer').status).toBe('Not selected');
  expect(discoveryFrontierAttempts(events)).toBe(0);
});

test('withdrawn evidence leaves composition selected but not called, with no fabricated latency or completed claims', () => {
  let events = through(compareEvents, 'edge_selected', 'join');
  events = appended(events, 'node_completed', 'synthesize', { node_name: 'synthesize', label: 'Compose', state: 'skipped', detail: 'Sources left the accepted collection before synthesis.' });
  const tree = discoveryTree(events);
  expect(node(tree, 'answer')).toMatchObject({ selected: true, active: false, status: 'Composition skipped' });
  expect(node(tree, 'answer').detail).toContain('evidence became unavailable');
  expect(discoveryFrontierAttempts(events)).toBe(1);
  const response = mockLiveDiscovery();
  response.snapshot.events = events;
  response.snapshot.run.result = null;
  response.frontier_calls = 1;
  response.metrics = null;
  const compose = discoveryPerformance(response).components.find(item => item.id === 'compose')!;
  expect(compose.elapsedMs).toBeNull();
  expect(compose.timingLabel).toBe('Not used');
  expect(compose.detail).toContain('0 completed or failed request attempts');
  expect(render(events)).not.toContain('claims returned');
});

test('failed validation or support remains a failed selected answer path, not a successful result', () => {
  let events = through(compareEvents, 'node_completed', 'synthesize');
  events = appended(events, 'node_failed', 'support:claim-1', { node_name: 'support', label: 'Check support', state: 'failed', detail: 'Provider timeout' });
  const tree = discoveryTree(events);
  expect(node(tree, 'answer')).toMatchObject({ selected: true, failed: true, status: 'Failed work' });
  expect(node(tree, 'sources').selected).toBe(false);
  expect(render(events)).toMatch(/data-tree-id="answer"[^>]*has-failed-work/);
  expect(render(events)).not.toContain('claims returned');
});

test('rewinding removes future branch choices, accepted counts, provider attempts, and result claims', () => {
  const checkpoints = [compareEvents.length, compareEvents.findIndex(event => event.instance_id === 'synthesize' && event.type === 'node_started'),
    compareEvents.findIndex(event => event.instance_id === 'join' && event.type === 'node_completed'),
    compareEvents.findIndex(event => event.instance_id === 'plan' && event.type === 'node_started'), 0];
  const counts: number[] = [];
  for (const prefix of checkpoints) {
    const events = compareEvents.slice(0, prefix), tree = discoveryTree(events);
    counts.push(discoveryFrontierAttempts(events));
    const hasJoin = events.some(event => event.instance_id === 'join' && event.type === 'node_completed');
    const hasOutput = events.some(event => event.instance_id === 'join' && event.type === 'edge_selected');
    const hasResult = events.some(event => event.type === 'run_completed');
    expect(tree.evidenceCount !== undefined).toBe(hasJoin);
    expect(node(tree, 'answer').selected).toBe(hasOutput);
    expect(node(tree, 'answer').detail.includes('claims returned')).toBe(hasResult);
    for (const edge of tree.edges.filter(edge => edge.current)) expect(edge.visited).toBe(true);
  }
  expect(counts).toEqual([2, 1, 1, 0, 0]);
  expect(selected(discoveryTree([]))).toEqual([]);
});
