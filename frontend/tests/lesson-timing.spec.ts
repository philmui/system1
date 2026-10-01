import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Event, LessonCatalogue, Run } from '../src/lib/api.generated';
import rawCatalogue from '../src/data/lessons.json' with { type: 'json' };
import { humanWaitDuration, illustrativeDocumentLatency, lessonTiming, lessonTimingSource } from '../src/lib/lessonTiming';
import { defaultBatchScenario } from '../src/lib/batchComparison';
import { LessonLatency } from '../src/components/LessonLatency';
import { LiveWorkflowTiming, RecordedWorkflowTiming } from '../src/components/WorkflowTimingSummary';
import { mockLiveClassification } from './helpers/liveClassificationFixture';

const run = { id: 'run', kind: 'classification', graph_version: 'atlas-classification-v2', status: 'succeeded', mode: 'test-fixture', request: { document_ids: ['a', 'b'], simulated_review: true } } as unknown as Run;
const at = (ms: number) => new Date(Date.UTC(2026, 8, 29, 12) + ms).toISOString();
function event(sequence: number, ms: number, type: Event['type'], instance_id: string, payload: Event['payload'], attempt = 1): Event {
  return { sequence, timestamp: at(ms), type, instance_id, payload, attempt, run_id: 'run', event_id: String(sequence), schema_version: 1, parent_instance_id: null };
}
const start = (sequence: number, ms: number, id: string, attempt = 1) => event(sequence, ms, 'node_started', id, { state: 'running', node_name: id.split(':').at(-1), label: id }, attempt);
const complete = (sequence: number, ms: number, id: string, elapsed: number, attempt = 1) => event(sequence, ms, 'node_completed', id, { state: 'succeeded', node_name: id.split(':').at(-1), label: id, detail: JSON.stringify({ provider: 'fixture', elapsed_ms: elapsed }) }, attempt);
const decision = (sequence: number, ms: number, route: 'accept' | 'interpret') => event(sequence, ms, 'decision', 'a:jev', { id: 'a:category', selected_route: route, signal: { kind: 'choice', choice: 'invoice', confidence: route === 'accept' ? .97 : .58, provider: 'fixture', elapsed_ms: 57 }, policy_elapsed_ms: .04 });

test('playback timing uses labeled assumptions for prepared routes and keeps human wait separate', () => {
  const { snapshot, documents } = rawCatalogue.classification;
  for (const [example, total, frontier, code] of [['clear', '370 ms', 'Skipped', '120 ms'], ['proposed', '3.61 s', '3.20 s', '160 ms']]) {
    const documentId = documents.find(document => document.example_id === example)!.document.id;
    const html = renderToStaticMarkup(createElement(RecordedWorkflowTiming, { run: snapshot.run as Run, events: snapshot.events as Event[], documentId }));
    expect(html).toContain('Illustrative');
    expect(html).toContain('Full document route');
    expect(html).toContain(total);
    expect(html).toContain(frontier);
    expect(html).toContain('250 ms');
    expect(html).toContain('Total workflow time');
    expect(html).toContain('Other steps');
    expect(html).toContain(code);
    expect(html).toContain('workflow-timing-composition');
    expect(html).toContain('<dt>Runtime policy</dt><dd>40 ms</dd>');
    expect(html).toContain('<dt>Publishing</dt><dd>80 ms</dd>');
    if (example === 'proposed') expect(html).toContain('<dt>Proposal validation</dt><dd>40 ms</dd>');
    expect(html).toContain('Assumed service times, no queue.');
    if (example === 'proposed') expect(html).toContain('Add human review before searchable; wait varies.');
    else expect(html).not.toContain('Add human review');
    expect(html).not.toContain('15 min');
  }
});

test('recorded timing uses the selected document wall interval and requires publication', () => {
  const liveRun = { ...run, mode: 'live', request: { document_ids: ['a', 'b'] } } as Run;
  const events = [start(1, 0, 'a:extract'), event(2, 175, 'decision', 'a:jev', { selected_route: 'accept', signal: { provider: 'jev', elapsed_ms: 175 } }),
    event(3, 900, 'node_completed', 'a:publish', { state: 'succeeded', publication: { document_id: 'a', status: 'searchable', committed_at: at(900) } }),
    event(4, 5000, 'node_completed', 'b:publish', { state: 'succeeded', publication: { document_id: 'b', status: 'searchable', committed_at: at(5000) } })];
  const render = (events: Event[]) => renderToStaticMarkup(createElement(RecordedWorkflowTiming, { run: liveRun, events, documentId: 'a' }));
  expect(render(events)).toContain('900 ms');
  expect(render(events)).toContain('175 ms');
  expect(render(events)).not.toContain('5.00 s');
  expect(render(events.slice(0, 2))).toContain('Unavailable');
  expect(render(events.slice(0, 2))).not.toContain('Illustrative');
});

test('live timing retains measured wall time, queue overhead, missing data and failed outcomes', () => {
  const strategy = mockLiveClassification().strategy;
  const render = (value: typeof strategy) => renderToStaticMarkup(createElement(LiveWorkflowTiming, { strategy: value }));
  const html = render(strategy);
  expect(html).toContain('Measured');
  expect(html).toContain('6.32 s');
  expect(html).toContain('175 ms');
  expect(html).toContain('6.07 s');
  expect(html).toContain('74 ms');
  expect(html).not.toContain('6.25 s');
  expect(html).toContain('Total includes queue');
  expect(html).toContain('wait unmeasured');
  const incomplete = render({ ...strategy, components: strategy.components.filter(component => component.id !== 'judge') });
  expect(incomplete).toContain('Unmeasured');
  expect(incomplete).not.toContain('workflow-timing-composition');
  const inconsistent = render({ ...strategy, elapsed_ms: 100 });
  expect(inconsistent).toContain('Unavailable');
  expect(inconsistent).not.toContain('workflow-timing-composition');
  const failed = render({ ...strategy, status: 'failed', output_kind: 'unavailable', elapsed_ms: -1 });
  expect(failed).toContain('Until failure');
  expect(failed).toContain('Unavailable');
  expect(failed).not.toContain('Add human review');
});

test('only the visible prefix can reveal durations, a selected route, or an illustration', () => {
  const events = [start(1, 0, 'a:extract'), start(2, 5, 'a:jev'), complete(3, 62, 'a:jev', 57), decision(4, 63, 'accept')];
  const before = lessonTiming(run, [], 'a');
  expect(before.nodes.judge.display).toBe('Not yet');
  expect(before.illustration).toBeNull();
  expect(before.nodes.interpret.status).toBe('not_started');
  const pending = lessonTiming(run, events.slice(0, 2), 'a');
  expect(pending.nodes.judge.status).toBe('pending');
  expect(pending.nodes.judge.durationMs).toBeNull();
  expect(pending.nodes.judge.attempts).toBe(1);
  expect(pending.illustration).toBeNull();
  const response = lessonTiming(run, events.slice(0, 3), 'a');
  expect(response.nodes.judge.durationMs).toBe(57);
  expect(response.illustration).toBeNull();
  const routed = lessonTiming(run, events, 'a');
  expect(routed.nodes.policy.durationMs).toBe(.04);
  expect(routed.nodes.interpret.status).toBe('not_used');
  expect(routed.nodes.review.status).toBe('not_used');
  expect(routed.nodes.publish.status).toBe('pending');
  expect(routed.illustration?.route).toBe('accept');
  expect(lessonTiming(run, events.slice(0, 2), 'a')).toEqual(pending);
});

test('parallel documents never inflate the selected document timing or become wall latency', () => {
  const events = [start(1, 0, 'a:jev'), start(2, 0, 'b:jev'), complete(3, 100, 'b:jev', 500), complete(4, 100, 'a:jev', 100)];
  const a = lessonTiming(run, events, 'a');
  expect(a.stages.judgment.durationMs).toBe(100);
  expect(a.stages.judgment.attempts).toBe(1);
  expect(lessonTiming(run, events, 'b').stages.judgment.durationMs).toBe(500);
  expect(a.documentToSearchableMs).toBeNull();
  const withUnrelatedCode = lessonTiming(run, [...events, start(5, 100, 'plan'), complete(6, 200, 'plan', 100)], 'a');
  expect(withUnrelatedCode.stages.interpretation.attempts).toBe(0);
});

test('request retries retain incomplete totals while one attempt is pending or unmeasured', () => {
  const events = [start(1, 0, 'a:jev'), event(2, 10, 'node_failed', 'a:jev', { state: 'failed' }), start(3, 20, 'a:jev', 2), complete(4, 110, 'a:jev', 90, 2)];
  const pending = lessonTiming(run, events.slice(0, 3), 'a').nodes.judge;
  expect(pending.status).toBe('pending');
  expect(pending.attempts).toBe(2);
  const done = lessonTiming(run, events, 'a').nodes.judge;
  expect(done.status).toBe('unavailable');
  expect(done.durationMs).toBeNull();
  expect(done.knownWorkMs).toBe(90);
  expect(done.measuredAttempts).toBe(1);
  expect(done.failedAttempts).toBe(1);
  expect(done.detail).toContain('no live API call');
  expect(done.primaryDurationMs).toBeNull();
  const timedFailure = [...events];
  timedFailure[1] = { ...timedFailure[1], payload: { state: 'failed', elapsed_ms: 10 } };
  const mixed = lessonTiming(run, timedFailure, 'a').nodes.judge;
  expect(mixed.durationMs).toBe(100);
  expect(mixed.source).toBe('mixed');
  expect(lessonTimingSource(mixed, true, false)).toContain('Fixture execution delay');
});

test('fixture model execution delays remain diagnostics and never become primary provider latency', () => {
  const events = [start(1, 0, 'a:jev'), complete(2, 57, 'a:jev', 57), decision(3, 58, 'interpret'), start(4, 60, 'a:interpret'), complete(5, 131, 'a:interpret', 71)];
  const timing = lessonTiming(run, events, 'a');
  for (const stage of [timing.nodes.judge, timing.nodes.interpret]) {
    expect(stage.display).toBe('Simulated response');
    expect(stage.primaryDurationMs).toBeNull();
    expect(stage.modelProvenance).toBe('simulated');
    expect(stage.source).toBe('fixture');
    expect(lessonTimingSource(stage, true, false)).toBe('Fixture execution delay; no live model call');
  }
  expect(timing.nodes.interpret.durationMs).toBe(71);
  const html = renderToStaticMarkup(createElement(LessonLatency, { run, events, documentId: 'a' }));
  const primary = html.split('<details')[0];
  expect(primary).not.toContain('71 ms');
  expect(primary).not.toContain('57 ms');
  expect(primary).toContain('Simulated response');
  expect(primary).toContain('Exception route · uses both capabilities');
  expect(primary).not.toContain('3.61 s');
  expect(primary).not.toContain('2.92 s');
  expect(html).toContain('Fixture execution delay · 71 ms. Not live model latency.');
});

test('explicit live provider measurements survive synthetic run mode and retain per-stage provenance', () => {
  const liveCompletion = event(5, 2480, 'node_completed', 'a:interpret', { state: 'succeeded', detail: JSON.stringify({ provider: 'openai', configured_model: 'gpt-5.5', elapsed_ms: 2345 }) });
  const events = [decision(1, 57, 'interpret'), start(2, 100, 'a:interpret'), liveCompletion];
  const mixedRun = lessonTiming(run, events, 'a');
  expect(mixedRun.nodes.judge.modelProvenance).toBe('simulated');
  expect(mixedRun.nodes.interpret).toMatchObject({ modelProvenance: 'live', display: '2.35 s', primaryDurationMs: 2345, source: 'provider' });
  expect(mixedRun.provenance).toBe('Mixed response sources · inspect each step');
  expect(lessonTimingSource(mixedRun.nodes.interpret, true, true)).toBe('Measured live provider request');
  const jev = event(1, 125, 'decision', 'a:jev', { selected_route: 'accept', signal: { provider: 'jev', elapsed_ms: 125 } });
  const liveJudge = lessonTiming(run, [jev], 'a');
  expect(liveJudge.nodes.judge).toMatchObject({ modelProvenance: 'live', primaryDurationMs: 125, display: '125 ms' });
});

test('unknown, mixed and incomplete response provenance never produce a primary model-latency number', () => {
  const liveRun = { ...run, mode: 'live' } as Run;
  const unknown = lessonTiming(liveRun, [event(1, 71, 'node_completed', 'a:interpret', { state: 'succeeded', detail: '{"elapsed_ms":71}' })], 'a').nodes.interpret;
  expect(unknown).toMatchObject({ modelProvenance: 'unknown', source: 'unknown_provider', primaryDurationMs: null, display: 'Unmeasured' });
  const stageOnly = lessonTiming(liveRun, [event(1, 71, 'node_completed', 'a:interpret', { state: 'succeeded', elapsed_ms: 71, detail: '{"provider":"openai"}' })], 'a').nodes.interpret;
  expect(stageOnly).toMatchObject({ modelProvenance: 'live', primaryDurationMs: null, display: 'Unmeasured' });
  const attempts = [complete(1, 71, 'a:interpret', 71), event(2, 2071, 'node_completed', 'a:interpret', { state: 'succeeded', detail: '{"provider":"openai","elapsed_ms":2000}' }, 2)];
  const mixed = lessonTiming(liveRun, attempts, 'a').nodes.interpret;
  expect(mixed).toMatchObject({ durationMs: 2071, modelProvenance: 'mixed', primaryDurationMs: null, display: 'Unmeasured' });
  const pending = lessonTiming(liveRun, [...attempts, start(3, 2080, 'a:interpret', 3)], 'a').nodes.interpret;
  expect(pending).toMatchObject({ status: 'pending', primaryDurationMs: null, display: 'Pending' });
  const conflicting = lessonTiming(liveRun, [attempts[1], event(3, 2100, 'decision', 'a:interpret', { signal: { provider: 'fixture', elapsed_ms: 71 } }, 2)], 'a').nodes.interpret;
  expect(conflicting).toMatchObject({ modelProvenance: 'mixed', primaryDurationMs: null, display: 'Unmeasured' });
});

test('an interrupted attempt stays unknown and is never presented as a completed provider duration', () => {
  const events = [start(1, 0, 'a:jev'), event(2, 40, 'run_completed', 'run', { status: 'interrupted', timing_incomplete: true })];
  const timing = lessonTiming(run, events, 'a');
  expect(timing.nodes.judge.status).toBe('stopped');
  expect(timing.nodes.judge.durationMs).toBeNull();
  expect(timing.nodes.judge.failedAttempts).toBe(1);
  expect(timing.nodes.judge.display).toBe('Stopped');
});

test('human wait is pending until matching review resume and excludes reviews of other documents', () => {
  const events = [decision(1, 0, 'interpret'), start(2, 1, 'a:interpret'), complete(3, 71, 'a:interpret', 70), event(4, 80, 'review_requested', 'review', { interrupt_id: 'approval', revision: 2, items: [{ document_id: 'a' }] }), event(5, 30_080, 'review_resumed', 'review', { interrupt_id: 'approval', revision: 2 })];
  const pending = lessonTiming(run, events.slice(0, 4), 'a').nodes.review;
  expect(pending.status).toBe('pending');
  expect(pending.durationMs).toBeNull();
  expect(pending.display).toBe('Awaiting simulated approval');
  expect(lessonTiming(run, events.slice(0, 4), 'b').nodes.review.attempts).toBe(0);
  const wrongRevision = { ...events[4], payload: { interrupt_id: 'approval', revision: 1 } };
  expect(lessonTiming(run, [...events.slice(0, 4), wrongRevision], 'a').nodes.review.status).toBe('pending');
  const done = lessonTiming(run, events, 'a');
  expect(done.nodes.review.durationMs).toBe(30_000);
  expect(done.nodes.review.source).toBe('script_interval');
  expect(done.nodes.review.display).toBe('Simulated review complete');
  expect(done.nodes.judge.durationMs).toBe(57);
  expect(done.nodes.interpret.durationMs).toBe(70);
  expect(lessonTimingSource(done.nodes.review, true, true)).toBe('Script execution interval; human response not measured');
  const live = lessonTiming({ ...run, request: { ...run.request, simulated_review: false } }, events, 'a');
  expect(live.nodes.review.source).toBe('review_wait');
  expect(live.nodes.review.display).toBe('30.00 s');
  expect(lessonTimingSource(live.nodes.review, false, false)).toBe('Recorded human review wait');
});

test('scripted milliseconds appear only as diagnostics, never as human response time', () => {
  const events = [decision(1, 0, 'interpret'), event(2, 80, 'review_requested', 'review', { interrupt_id: 'approval', revision: 1, items: [{ document_id: 'a' }] }), event(3, 82, 'review_resumed', 'review', { interrupt_id: 'approval', revision: 1, decisions: [{ document_id: 'a', action: 'accept' }] })];
  const timing = lessonTiming(run, events, 'a');
  expect(timing.nodes.review).toMatchObject({ status: 'recorded', durationMs: 2, display: 'Simulated approval', detail: 'No human response measured' });
  const html = renderToStaticMarkup(createElement(LessonLatency, { run, events, documentId: 'a' }));
  const primary = html.split('<details')[0];
  expect(primary).toContain('Simulated approval');
  expect(primary).toContain('No human response measured');
  expect(primary).not.toContain('2.0 ms');
  expect(primary).not.toContain('Human wait · assumed in both strategies');
  expect(html).toContain('Human wait · assumed in both strategies');
  expect(html).toContain('<option value="900" selected="">15 min</option>');
  expect(html).toContain('<option value="3600">1 hour</option>');
  expect(html).toContain('<option value="86400">1 day</option>');
  expect(html).toContain('Script execution timing: 2.0 ms. Diagnostic only.');
  const excluded = [...events.slice(0, 2), { ...events[2], payload: { ...events[2].payload, decisions: [{ document_id: 'b', action: 'accept' }, { document_id: 'a', action: 'exclude' }] } }];
  expect(lessonTiming(run, excluded, 'a').nodes.review.display).toBe('Simulated exclusion');
  expect(lessonTiming(run, excluded.slice(0, 2), 'a').nodes.review.display).toBe('Awaiting simulated approval');
  const withoutDisposition = [...events.slice(0, 2), { ...events[2], payload: { interrupt_id: 'approval', revision: 1 } }];
  expect(lessonTiming(run, withoutDisposition, 'a').nodes.review.display).toBe('Simulated review complete');
});

test('publication uses explicit stage timing or a labeled observed commit interval, never an unrelated index', () => {
  const events = [start(1, 0, 'a:extract'), decision(2, 60, 'accept'), start(3, 100, 'a:publish'), event(4, 108, 'node_completed', 'a:publish', { state: 'succeeded', publication: { document_id: 'a', status: 'searchable', committed_at: at(104) } })];
  const before = lessonTiming(run, events.slice(0, 3), 'a');
  expect(before.nodes.publish.status).toBe('pending');
  expect(before.documentToSearchableMs).toBeNull();
  const committed = lessonTiming(run, events, 'a');
  expect(committed.nodes.publish.durationMs).toBe(4);
  expect(committed.nodes.publish.source).toBe('event_interval');
  expect(committed.documentToSearchableMs).toBe(104);
  expect(lessonTimingSource(committed.nodes.publish, true, true)).toContain('start-to-commit');
  const explicit = [...events];
  explicit[3] = { ...events[3], payload: { ...events[3].payload, elapsed_ms: 3 } };
  expect(lessonTiming(run, explicit, 'a').nodes.publish).toMatchObject({ durationMs: 3, source: 'stage' });
  const legacy = [start(1, 0, 'a:extract'), decision(2, 60, 'accept'), event(3, 200, 'node_completed', 'index', { elapsed_ms: 90, state: 'succeeded' }), event(4, 210, 'run_completed', 'run', { status: 'succeeded' })];
  const legacyTiming = lessonTiming({ ...run, graph_version: 'atlas-classification-v1' }, legacy, 'a');
  expect(legacyTiming.nodes.publish.durationMs).toBeNull();
  expect(legacyTiming.nodes.publish.display).toBe('Unavailable');
  expect(legacyTiming.documentToSearchableMs).toBeNull();
});

test('response metadata does not duplicate an attempt and invalid elapsed values are rejected', () => {
  const events = [start(1, 0, 'a:jev'), complete(2, 57, 'a:jev', 57), decision(3, 58, 'accept')];
  const deduplicated = lessonTiming(run, [...events, ...events], 'a');
  expect(deduplicated.nodes.judge.attempts).toBe(1);
  expect(deduplicated.nodes.judge.durationMs).toBe(57);
  expect(deduplicated.nodes.policy.attempts).toBe(1);
  const invalid = lessonTiming(run, [start(1, 0, 'a:jev'), event(2, 20, 'node_completed', 'a:jev', { state: 'succeeded', elapsed_ms: -20, detail: '{"elapsed_ms":-5}' })], 'a');
  expect(invalid.nodes.judge.durationMs).toBeNull();
  const zero = lessonTiming(run, [start(1, 0, 'a:jev'), complete(2, 0, 'a:jev', 0)], 'a');
  expect(zero.nodes.judge.durationMs).toBe(0);
  expect(zero.nodes.judge.status).toBe('recorded');
  const orphan = lessonTiming(run, [decision(1, 57, 'accept')], 'a');
  expect(orphan.nodes.judge).toMatchObject({ attempts: 1, startedAttempts: 0, durationMs: 57, status: 'recorded' });
  const untimedResponse = lessonTiming(run, [event(1, 60, 'decision', 'a:jev', { selected_route: 'accept', signal: { kind: 'choice', choice: 'invoice' } })], 'a');
  expect(untimedResponse.nodes.judge).toMatchObject({ attempts: 1, durationMs: null, status: 'unavailable' });
});

test('a failed publication has an observed node interval, never a commit interval or searchable result', () => {
  const events = [start(1, 0, 'a:extract'), decision(2, 60, 'accept'), start(3, 100, 'a:publish'), event(4, 108, 'node_failed', 'a:publish', { state: 'failed' })];
  const timing = lessonTiming(run, events, 'a');
  expect(timing.nodes.publish.durationMs).toBe(8);
  expect(timing.nodes.publish.failedAttempts).toBe(1);
  expect(timing.nodes.publish.source).toBe('node_interval');
  expect(lessonTimingSource(timing.nodes.publish, true, true)).toBe('Recorded node event interval; no commit time');
  expect(timing.documentToSearchableMs).toBeNull();
  expect(timing.publicationStatus).toBeUndefined();
});

test('illustrative one-document defaults show the exception overhead under equal review assumptions', () => {
  expect(illustrativeDocumentLatency(undefined)).toBeNull();
  const direct = illustrativeDocumentLatency('accept')!;
  expect(direct.system1.timeToSearchableMs).toBeCloseTo(370);
  expect(direct.frontier.timeToSearchableMs).toBeCloseTo(2920);
  expect(direct.frontierCallsAvoided).toBe(1);
  expect(direct.system1.reviewWaitMs).toBe(0);
  expect(direct.system1.automatedMs).toBeCloseTo(direct.system1.timeToSearchableMs);
  expect(direct.system1.policyMs).toBeCloseTo(40);
  expect(direct.system1.validationMs).toBe(0);
  expect(direct.system1.publicationMs).toBeCloseTo(80);
  const exception = illustrativeDocumentLatency('interpret')!;
  expect(exception.system1.automatedMs).toBeCloseTo(3610);
  expect(exception.system1.policyMs).toBeCloseTo(40);
  expect(exception.system1.validationMs).toBeCloseTo(40);
  expect(exception.system1.publicationMs).toBeCloseTo(80);
  expect(exception.system1.policyMs + exception.system1.validationMs + exception.system1.publicationMs).toBeCloseTo(exception.system1.codeMs);
  expect(exception.system1.boundedMs + exception.system1.frontierMs + exception.system1.codeMs).toBeCloseTo(exception.system1.automatedMs);
  expect(exception.frontier.automatedMs).toBeCloseTo(2920);
  expect(exception.system1.timeToSearchableMs).toBeCloseTo(903610);
  expect(exception.frontier.timeToSearchableMs).toBeCloseTo(902920);
  expect(exception.differenceMs).toBeLessThan(0);
  expect(exception.system1.modelAttempts).toBe(2);
  expect(exception.frontier.modelAttempts).toBe(1);
  expect(exception.system1.reviewWaitMs).toBeCloseTo(exception.frontier.reviewWaitMs);
  expect(exception.system1.reviewWaitMs).toBeCloseTo(900000);
  expect(exception.frontierCallsAvoided).toBe(0);
});

test('human-wait assumptions change only the wait, equally in both strategies, without changing defaults or recorded work', () => {
  const before = lessonTiming(run, [decision(1, 57, 'interpret')], 'a');
  const defaults = { ...defaultBatchScenario };
  for (const seconds of [900, 3600, 86400]) {
    const illustration = illustrativeDocumentLatency('interpret', { reviewSeconds: seconds })!;
    for (const strategy of [illustration.system1, illustration.frontier]) {
      expect(strategy.reviewWaitMs).toBeCloseTo(seconds * 1000);
      expect(strategy.timeToSearchableMs - strategy.reviewWaitMs).toBeCloseTo(strategy.automatedMs);
    }
    expect(illustration.system1.automatedMs).toBeCloseTo(3610);
    expect(illustration.frontier.automatedMs).toBeCloseTo(2920);
    expect(illustration.differenceMs).toBeCloseTo(-690);
  }
  expect(defaultBatchScenario).toEqual(defaults);
  expect(lessonTiming(run, [decision(1, 57, 'interpret')], 'a')).toEqual(before);
  expect(illustrativeDocumentLatency(undefined, { reviewSeconds: 86400 })).toBeNull();
  expect(illustrativeDocumentLatency('accept', { reviewSeconds: 86400 })!.system1.reviewWaitMs).toBe(0);
  expect(humanWaitDuration(900000)).toBe('15 min');
  expect(humanWaitDuration(3600000)).toBe('1 hour');
  expect(humanWaitDuration(86400000)).toBe('1 day');
  expect(humanWaitDuration(903610)).toBe('15 min 3.61 s');
});

test('rendered strip labels fixture timings and keeps unknown partial totals out of its primary numbers', () => {
  const events = [start(1, 0, 'a:jev'), event(2, 5, 'node_failed', 'a:jev', {}), start(3, 10, 'a:jev', 2), complete(4, 100, 'a:jev', 90, 2)];
  const html = renderToStaticMarkup(createElement(LessonLatency, { run, events, documentId: 'a' }));
  expect(html).toContain('Prepared replay · no live model calls');
  expect(html).toContain('data-state="unavailable"');
  expect(html).toContain('<dd>Simulated attempts</dd>');
  expect(html).toContain('total incomplete');
  expect(html).toContain('The runtime decides which work is needed');
  expect(html).not.toContain('370 ms');
  expect(html).not.toContain('Human wait · assumed in both strategies');
  expect(html).toContain('href="#compare/classify?source=illustrative"');
  const after = renderToStaticMarkup(createElement(LessonLatency, { run, events: [decision(1, 100, 'interpret')], documentId: 'a' }));
  expect(after).toContain('Exception route · uses both capabilities');
  expect(after).toContain('Automated work');
  expect(after.split('<details')[0]).not.toContain('3.61 s');
  expect(after).toContain('3.61 s');
  expect(after).toContain('2.92 s');
  expect(after).toContain('Human wait · assumed in both strategies');
  expect(after).toContain('15 min 3.61 s');
  expect(after).toContain('15 min 2.92 s');
  expect(after).not.toMatch(/faster|speedup|accuracy improvement/);
});

test('the shipped recording supplies measured responses and commit intervals for each example', () => {
  const catalogue = rawCatalogue as unknown as LessonCatalogue;
  const { snapshot, documents } = catalogue.classification;
  for (const document of documents) {
    const timing = lessonTiming(snapshot.run, snapshot.events, document.document.id);
    expect(timing.fixture).toBe(true);
    expect(timing.nodes.judge.status).toBe('recorded');
    expect(timing.nodes.judge.durationMs).toBeGreaterThan(0);
    expect(timing.nodes.policy.status).toBe('recorded');
    expect(timing.nodes.publish.status).toBe('recorded');
    expect(timing.documentToSearchableMs).toBeGreaterThanOrEqual(0);
    if (timing.route === 'accept') {
      expect(timing.nodes.interpret.status).toBe('not_used');
      expect(timing.nodes.review.status).toBe('not_used');
    } else {
      expect(timing.nodes.interpret.status).toBe('recorded');
      expect(timing.nodes.review.status).toBe('recorded');
      expect(timing.nodes.review.display).toBe('Simulated approval');
    }
  }
});
