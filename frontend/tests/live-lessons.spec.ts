import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChoiceSignal, Event, LessonCatalogue, LiveInterpretResponse } from '../src/lib/api.generated';
import raw from '../src/data/lessons.json' with { type: 'json' };
import { buildLessonGraph } from '../src/components/LessonFlow';
import { LiveInterpret } from '../src/components/LiveInterpret';
import { liveFrontierTimings } from '../src/lib/liveModelTiming';
import { buildExecutionGraph } from '../src/components/ExecutionGraph';
import { reduceEvents } from '../src/lib/events';
import { frontierModels } from '../src/lib/frontierModels';

const catalogue = raw as unknown as LessonCatalogue;
const snapshot = catalogue.classification.snapshot;
const subject = catalogue.classification.documents.find(item => item.example_id === 'proposed')!;
const decision = snapshot.events.find(event => event.type === 'decision' && event.instance_id === `${subject.document.id}:jev`)!.payload;
const response: LiveInterpretResponse = {
  version: 'live-interpret-v1',
  example_id: 'proposed', document_id: subject.document.id, content_version: subject.document.content_version,
  proposal: { kind: 'proposal', category: 'correspondence', explanation: 'Mock response for testing.', provider: 'openai', request_id: 'mock-live', configured_model: 'gpt-5.5', returned_model: 'gpt-5.5-2026-04-23', elapsed_ms: 6071, usage: null, rubric_version: 'test' },
  policy: { source: 'executed', decision_id: String(decision.id), policy_version: catalogue.policy_version,
    example_id: 'proposed', content_version: subject.document.content_version, signal: decision.signal as ChoiceSignal,
    threshold: 0.8, guard_enabled: true, guard_matched: true, selected_route: 'interpret', reason: 'mixed_purpose',
    explanation: String(decision.explanation), requires_review: true, source_excerpt: subject.source_excerpt,
    reference_category: subject.reference_category, reference_mismatch: false, policy_violation: false },
  published: false, requires_review: true,
  operational_writes: 0, provider_calls: 1, provider_source: 'live', signal_source: 'prepared', timing: 'measured provider round trip', metrics: null,
};

test('real interpretation timing cannot borrow the recording’s approval, publication, or accessible labels', () => {
  const graph = buildLessonGraph({ run: snapshot.run, events: snapshot.events, documentId: subject.document.id, mode: 'narrow', live: { status: 'complete', response } });
  const interpret = graph.nodes.find(node => node.id === 'interpret')!;
  expect(interpret.data).toMatchObject({ subtitle: 'GPT-5.5 · live', metric: '6.07 s', state: 'succeeded', active: true });
  expect(interpret.ariaLabel).toContain('GPT-5.5 · live');
  expect(interpret.ariaLabel).toContain('6.07 s');
  const review = graph.nodes.find(node => node.id === 'review')!;
  expect(review.data).toMatchObject({ state: 'outside_preview', detail: 'Approval required to publish', active: false, onPath: false });
  expect(review.ariaLabel).toContain('Outside preview');
  expect(review.ariaLabel).not.toContain('Simulated checkpoint');
  expect(graph.nodes.find(node => node.id === 'publish')?.data).toMatchObject({ title: 'Publish', state: 'outside_preview', detail: 'Makes content searchable', metric: undefined, active: false, onPath: false });
  expect(graph.edges.find(edge => edge.id === 'interpret--review')?.data).toMatchObject({ traversed: false, current: false, moving: false, label: 'Later' });
  expect(graph.edges.find(edge => edge.id === 'review--publish')?.data?.traversed).toBe(false);
  expect(graph.nodes.find(node => node.id === 'judge')?.data.metric).toBeUndefined();
});

test('legacy live interpretation also uses its recorded frontier identity for every supported model', () => {
  for (const option of frontierModels) {
    const returned = { ...response, proposal: { ...response.proposal, configured_model: option.value, returned_model: null } };
    const graph = buildLessonGraph({ run: snapshot.run, events: snapshot.events, documentId: subject.document.id, mode: 'wide', live: { status: 'complete', response: returned } });
    expect(graph.nodes.find(node => node.id === 'interpret')?.data.subtitle).toBe(`${option.label} · live`);
  }
});

test('pending and failed real interpretation never show a completed latency or publish a fixture proposal', () => {
  for (const live of [{ status: 'pending' as const, startedAt: 0 }, { status: 'failed' as const, message: 'Network unavailable' }]) {
    const graph = buildLessonGraph({ run: snapshot.run, events: snapshot.events, documentId: subject.document.id, mode: 'wide', live });
    expect(graph.nodes.find(node => node.id === 'interpret')?.data.metric).toBeUndefined();
    expect(graph.nodes.find(node => node.id === 'interpret')?.data.detail).not.toContain('Proposal:');
    expect(graph.nodes.find(node => node.id === 'publish')?.data.state).toBe('outside_preview');
    expect(graph.nodes.find(node => node.id === 'review')?.data).toMatchObject({ state: 'outside_preview', active: false, onPath: false });
    expect(graph.edges.find(edge => edge.id === 'interpret--review')?.data?.traversed).toBe(false);
  }
});

test('live result labels its real request sample, approval requirement, and no operational publication', () => {
  const html = renderToStaticMarkup(createElement(LiveInterpret, { state: { status: 'complete', response }, inFlight: false, onRun() {}, onLeave() {} }));
  expect(html).toContain('6.07 s');
  expect(html).toContain('gpt-5.5-2026-04-23');
  expect(html).toContain('not a latency benchmark');
  expect(html).toContain('Needs approval');
  expect(html).toContain('No human has reviewed this proposal');
  expect(html).toContain('creates no review task');
  expect(html).not.toContain('71 ms');
  const detached = renderToStaticMarkup(createElement(LiveInterpret, { state: { status: 'idle' }, inFlight: true, onRun() {}, onLeave() {} }));
  expect(detached).toContain('disabled=""');
  expect(detached).toContain('Finishing prior request');
});

test('Discovery graph suppresses all fixture provider milliseconds but retains real frontier request timing', () => {
  const source = catalogue.discovery.compare;
  const options = { run: source.run, selected: null, focused: '', expanded: false, moving: false, speed: 1 };
  const fixtureGraph = buildExecutionGraph({ ...options, execution: reduceEvents(source.events) });
  expect(fixtureGraph.nodes.filter(node => ['llm', 'jev'].includes(node.data.role)).every(node => node.data.metric === undefined)).toBe(true);
  const events = source.events.map(event => event.type === 'node_completed' && event.instance_id === 'synthesize'
    ? { ...event, payload: { ...event.payload, detail: JSON.stringify({ provider: 'openai', returned_model: 'gpt-5.5', elapsed_ms: 7234 }) } } : event);
  const realGraph = buildExecutionGraph({ ...options, execution: reduceEvents(events) });
  expect(realGraph.nodes.some(node => node.data.metric === '7.23 s')).toBe(true);
});

test('live request timing summary deduplicates attempts and never uses a fixture delay', () => {
  const event = catalogue.discovery.compare.events.find(item => item.instance_id === 'synthesize' && item.type === 'node_completed')!;
  const fixture = { ...event, instance_id: 'plan', payload: { ...event.payload, detail: JSON.stringify({ provider: 'fixture', elapsed_ms: 71 }) } };
  const live = { ...event, payload: { ...event.payload, detail: JSON.stringify({ provider: 'openai', elapsed_ms: 8123, returned_model: 'gpt-5.5' }) } };
  const failed = { ...event, type: 'node_failed', attempt: 2, payload: { detail: 'Safe timeout' } } as Event;
  expect(liveFrontierTimings([fixture, live, live, failed])).toEqual([
    { id: `synthesize:${event.attempt}`, label: 'Compose comparison', attempt: event.attempt, elapsedMs: 8123, model: 'gpt-5.5', failed: false },
    { id: 'synthesize:2', label: 'Compose comparison', attempt: 2, elapsedMs: null, model: 'Frontier model · no response', failed: true },
  ]);
});
