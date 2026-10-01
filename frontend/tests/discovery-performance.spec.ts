import { expect, test } from '@playwright/test';
import type { LessonCatalogue, LiveDiscoveryResponse } from '../src/lib/api.generated';
import raw from '../src/data/lessons.json' with { type: 'json' };
import { discoveryPerformance } from '../src/lib/discoveryPerformance';

const catalogue = raw as unknown as LessonCatalogue;
function response(example: 'find' | 'compare' = 'compare'): LiveDiscoveryResponse {
  return {
    version: 'test', example_id: example, documents: catalogue.discovery.documents, metrics: null,
    snapshot: structuredClone(catalogue.discovery[example]), operational_writes: 0, frontier_calls: example === 'find' ? 0 : 2,
    provenance: { documents: 'synthetic', bounded_judgments: 'prepared', frontier: 'live GPT-5.5 when selected', runtime: 'executed', citation_checks: 'executed exact checks', support_checks: 'prepared signals; not independent verification', timing: 'mixed: measured frontier round trips; fixture bounded durations', storage: 'isolated temporary store', source_preparation: 'prepared classification and indexing outside this discovery run' },
  };
}

test('fixture delays do not become live Judge latency or semantic accuracy', () => {
  const report = discoveryPerformance(response());
  for (const id of ['intent', 'screen', 'compose', 'support']) {
    expect(report.components.find(component => component.id === id)).toMatchObject({ elapsedMs: null, timingLabel: 'Prepared' });
  }
  expect(report.components.find(component => component.id === 'intent')?.quality).toMatchObject({ value: '1 / 1', label: 'Prepared intent agreement' });
  expect(report.quality.value).toBe('Not evaluated');
  expect(report.components.find(component => component.id === 'citations')?.quality.value).toBe('2 / 2');
  expect(report.components.find(component => component.id === 'citations')?.quality.detail).toContain('not factual accuracy');
});

test('live Judge, screening and frontier service times are independently recorded; wall time is not their sum', () => {
  const value = response();
  const metaTimes: Record<string, number> = { intent: 130, plan: 2400, synthesize: 4600 };
  for (const event of value.snapshot.events) {
    event.timestamp = event.type === 'run_completed' ? '2026-09-29T12:00:10Z' : '2026-09-29T12:00:00Z';
    if (event.type === 'node_completed') {
      try {
        const meta = JSON.parse(String(event.payload.detail));
        if (meta.provider === 'fixture') event.payload.detail = JSON.stringify({ ...meta, provider: ['plan', 'synthesize'].includes(event.instance_id) ? 'openai' : 'jev', elapsed_ms: metaTimes[event.instance_id] || 200, returned_model: event.instance_id === 'intent' ? 'jev-measured' : 'measured-model' });
      } catch { /* code operations retain their recorded timings */ }
    }
  }
  const report = discoveryPerformance(value);
  expect(report.elapsed.value).toBe('10.00 s');
  expect(report.components.find(component => component.id === 'intent')).toMatchObject({ elapsedMs: 130, model: 'jev-measured' });
  expect(report.components.find(component => component.id === 'plan')?.elapsedMs).toBe(2400);
  expect(report.components.find(component => component.id === 'compose')?.elapsedMs).toBe(4600);
  const screenCount = value.snapshot.events.filter(event => event.type === 'node_completed' && event.instance_id.endsWith(':screen')).length;
  expect(report.components.find(component => component.id === 'screen')?.elapsedMs).toBe(screenCount * 200);
  expect(report.components.reduce((sum, component) => sum + (component.elapsedMs || 0), 0)).not.toBe(10_000);
  expect(report.quality.value).toBe('Not evaluated');
});

test('no generated claims means citation quality is unevaluated, never perfect', () => {
  const report = discoveryPerformance(response('find'));
  expect(report.components.find(component => component.id === 'compose')).toMatchObject({ elapsedMs: null, timingLabel: 'Not used', quality: { value: 'Not evaluated' } });
  expect(report.components.find(component => component.id === 'citations')?.quality.value).toBe('Not evaluated');
  expect(report.outcome.value).toBe('2 passages');
  expect(report.scope).toContain('0 frontier attempts');
});

test('citation rejection counts claims and missing terminal time stays unavailable', () => {
  const value = response();
  value.snapshot.events = value.snapshot.events.filter(event => event.type !== 'run_completed');
  const citation = value.snapshot.events.find(event => event.type === 'node_completed' && event.instance_id === 'citations')!;
  citation.payload = { ...citation.payload, input_count: 3, output_count: 2, removed_count: 1 };
  const report = discoveryPerformance(value);
  expect(report.elapsed.value).toBe('Not recorded');
  expect(report.components.find(component => component.id === 'citations')?.quality).toMatchObject({ value: '2 / 3', tone: 'caution' });
});

test('duplicate events do not duplicate work; recorded failed work stays visible and missing time stays unavailable', () => {
  const value = response();
  const plan = value.snapshot.events.find(event => event.type === 'node_completed' && event.instance_id === 'plan')!;
  plan.payload.detail = JSON.stringify({ provider: 'openai', elapsed_ms: 2000, returned_model: 'gpt-5.5' });
  value.snapshot.events.push(plan);
  expect(discoveryPerformance(value).components.find(component => component.id === 'plan')?.elapsedMs).toBe(2000);
  value.snapshot.events.push({ ...plan, sequence: 9999, type: 'node_failed', attempt: 2, payload: { state: 'failed', detail: 'timeout', elapsed_ms: 1000 } });
  const row = discoveryPerformance(value).components.find(component => component.id === 'plan');
  expect(row).toMatchObject({ elapsedMs: 3000 });
  expect(row?.detail).toContain('1 failed');
  expect(row?.detail).toContain('not a successful response time');
  delete value.snapshot.events.at(-1)!.payload.elapsed_ms;
  expect(discoveryPerformance(value).components.find(component => component.id === 'plan')).toMatchObject({ elapsedMs: null, timingLabel: 'Incomplete timing' });
});

test('failed live bounded attempts retain their time without an intent accuracy denominator', () => {
  const value = response('find');
  value.provenance.bounded_judgments = 'live';
  const completion = value.snapshot.events.find(event => event.type === 'node_completed' && event.instance_id === 'intent')!;
  value.snapshot.events = value.snapshot.events.filter(event => event.instance_id !== 'intent');
  value.snapshot.events.push({ ...completion, type: 'node_failed', payload: { state: 'failed', elapsed_ms: 1200, detail: 'timeout' } });
  const row = discoveryPerformance(value).components.find(component => component.id === 'intent');
  expect(row).toMatchObject({ elapsedMs: 1200, quality: { value: 'Not evaluated' } });
});
