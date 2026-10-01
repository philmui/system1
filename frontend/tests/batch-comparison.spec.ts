import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  batchDocumentSnapshot, batchSnapshot, buildBatchTrace, createBatchPlaybackClock, defaultBatchScenario, nextBatchTime,
  recordedBatchEvidence, relativeBatchDifference, validateBatchScenario, virtualBatchDocuments,
  type BatchResource, type BatchScenario,
} from '../src/lib/batchComparison';
import { batchLaneLayout, compactBatchLaneLayout, CompareStrategies } from '../src/views/CompareStrategies';
import { pointOnRoute, roundedRoute } from '../src/lib/reviewLayout';
import type { Event, Run } from '../src/lib/api.generated';

const makeScenario = (changes: Partial<BatchScenario> = {}): BatchScenario => ({ ...defaultBatchScenario, ...changes });
const final = (strategy: 'disaggregated' | 'frontier', changes: Partial<BatchScenario> = {}) => {
  const trace = buildBatchTrace(strategy, makeScenario(changes));
  return { trace, snapshot: batchSnapshot(trace, trace.end) };
};

test('same 100 documents and safeguards produce 120 versus 100 calls, with 80 frontier calls avoided', () => {
  const system = final('disaggregated'), frontier = final('frontier');
  expect(system.snapshot.boundedCalls).toBe(100);
  expect(system.snapshot.frontierCalls).toBe(20);
  expect(system.snapshot.totalCalls).toBe(120);
  expect(frontier.snapshot.boundedCalls).toBe(0);
  expect(frontier.snapshot.frontierCalls).toBe(100);
  expect(frontier.snapshot.totalCalls).toBe(100);
  expect(frontier.snapshot.frontierCalls - system.snapshot.frontierCalls).toBe(80);
  expect(system.snapshot.counts.searchable).toBe(100);
  expect(frontier.snapshot.counts.searchable).toBe(100);
  expect(system.trace.documents.map(document => [document.id, document.kind, document.arrivalAt])).toEqual(frontier.trace.documents.map(document => [document.id, document.kind, document.arrivalAt]));
  expect(system.trace.steps.filter(step => step.capability === 'review').map(step => step.documentId).sort()).toEqual(frontier.trace.steps.filter(step => step.capability === 'review').map(step => step.documentId).sort());
  expect(system.snapshot.cost).toBeCloseTo(100 * .0001 + 20 * .007 + 220 * .00001);
  expect(frontier.snapshot.cost).toBeCloseTo(100 * .006 + 200 * .00001);
  expect(system.snapshot.machineSeconds).toBeCloseTo(101.8);
  expect(system.trace.end).toBeGreaterThan(15 * 60);
});

test('human review uses an explicit turnaround assumption shared equally by both strategies', () => {
  expect(defaultBatchScenario.reviewSeconds).toBe(15 * 60);
  for (const reviewSeconds of [15 * 60, 60 * 60, 24 * 60 * 60]) {
    const scenario = makeScenario({ documents: 2, exceptions: 1, publication: 'independent', reviewSeconds });
    expect(validateBatchScenario(scenario)).toBeNull();
    for (const strategy of ['disaggregated', 'frontier'] as const) {
      const trace = buildBatchTrace(strategy, scenario);
      const routine = trace.documents.find(document => document.kind === 'routine')!;
      const exception = trace.documents.find(document => document.kind === 'exception')!;
      expect(routine.publishedAt).toBeLessThan(3);
      const review = exception.steps.find(step => step.resource === 'human')!;
      expect(review.end - review.start).toBeCloseTo(reviewSeconds);
      expect(exception.publishedAt).toBeGreaterThan(reviewSeconds);
    }
  }
});

test('shared piecewise playback preserves visible machine work and compresses only review-only gaps', () => {
  const traces = [buildBatchTrace('disaggregated', makeScenario()), buildBatchTrace('frontier', makeScenario())];
  const finalMetrics = traces.map(trace => batchSnapshot(trace, trace.end));
  const clock = createBatchPlaybackClock(traces);
  expect(clock.duration).toBeCloseTo(18);
  expect(clock.presentationToWork(1 / 60)).toBeLessThan(defaultBatchScenario.boundedSeconds);
  expect(clock.segments.filter(segment => segment.machineActive).reduce((sum, segment) => sum + segment.presentationEnd - segment.presentationStart, 0)).toBeCloseTo(14);
  expect(clock.segments.filter(segment => !segment.machineActive).reduce((sum, segment) => sum + segment.presentationEnd - segment.presentationStart, 0)).toBeCloseTo(4);
  for (const trace of traces) for (const step of trace.steps.filter(step => step.resource !== 'human' && step.end > step.start)) {
    const midpoint = (step.start + step.end) / 2;
    const segment = clock.segments.find(value => midpoint >= value.workStart && midpoint < value.workEnd)!;
    expect(segment.machineActive).toBe(true);
  }
  for (const segment of clock.segments) {
    expect(segment.presentationEnd).toBeGreaterThan(segment.presentationStart);
    for (const fraction of [0, .25, .5, .75, 1]) {
      const time = segment.workStart + (segment.workEnd - segment.workStart) * fraction;
      expect(clock.presentationToWork(clock.workToPresentation(time))).toBeCloseTo(time, 6);
    }
  }
  // Speed changes advance the common presentation clock, not either lane's
  // service times. Pausing/seeking simply selects a point on the same mapping.
  let time = 0;
  for (const [elapsed, speed] of [[1, 1], [0, 4], [2, .5], [3, 2]] as const) time = clock.presentationToWork(clock.workToPresentation(time) + elapsed * speed);
  expect(clock.workToPresentation(time)).toBeCloseTo(8);
  expect(clock.presentationToWork(clock.duration)).toBe(clock.workDuration);
  expect(traces.map(trace => batchSnapshot(trace, trace.end))).toEqual(finalMetrics);
});

test('the shared machine interval is a union, never a sum or a per-strategy clock', () => {
  const base = buildBatchTrace('frontier', makeScenario({ documents: 0, exceptions: 0 }));
  const step = (start: number, end: number, id: string) => ({ id, documentId: id, capability: 'frontier_classify' as const, resource: 'frontier' as const, readyAt: start, start, end, cost: null });
  const traces = [{ ...base, end: 40, steps: [step(0, 10, 'a'), step(30, 40, 'b')] }, { ...base, end: 40, steps: [step(5, 20, 'c')] }];
  const clock = createBatchPlaybackClock(traces, { machineSeconds: 12, waitingSeconds: 2 });
  expect(clock.segments.map(segment => [segment.workStart, segment.workEnd, segment.machineActive])).toEqual([[0, 20, true], [20, 30, false], [30, 40, true]]);
  expect(clock.duration).toBe(14);
  expect(clock.workToPresentation(10)).toBe(4);
  expect(clock.workToPresentation(20)).toBe(8);
  expect(clock.workToPresentation(25)).toBe(9);
  expect(clock.workToPresentation(30)).toBe(10);
  expect(clock.presentationToWork(12)).toBe(35);
});

test('shared clock handles all-machine, all-review, short and empty traces without zero-slope intervals', () => {
  const machine = createBatchPlaybackClock([buildBatchTrace('frontier', makeScenario({ exceptions: 0 }))]);
  expect(machine.segments.every(segment => segment.machineActive)).toBe(true);
  expect(machine.duration).toBeCloseTo(14);
  const review = createBatchPlaybackClock([buildBatchTrace('disaggregated', makeScenario({ documents: 1, exceptions: 1, boundedSeconds: 0, frontierInterpretSeconds: 0, codeSeconds: 0, publishSeconds: 0 }))]);
  expect(review.segments).toHaveLength(1);
  expect(review.segments[0].machineActive).toBe(false);
  expect(review.duration).toBeCloseTo(4);
  expect(review.presentationToWork(2)).toBe(450);
  const short = createBatchPlaybackClock([buildBatchTrace('disaggregated', makeScenario({ documents: 1, exceptions: 0 }))]);
  expect(short.duration).toBeCloseTo(.37);
  expect(short.presentationToWork(.1)).toBeCloseTo(.1);
  const empty = createBatchPlaybackClock([]);
  expect(empty.duration).toBe(0);
  expect(empty.segments).toHaveLength(0);
  expect(empty.workToPresentation(10)).toBe(0);
  expect(empty.presentationToWork(10)).toBe(0);
  expect(machine.workToPresentation(-1)).toBe(0);
  expect(machine.presentationToWork(Infinity)).toBe(machine.workDuration);
  expect(machine.presentationToWork(NaN)).toBe(0);
  expect(() => createBatchPlaybackClock([], { machineSeconds: 0 })).toThrow(/positive finite/);
  expect(() => createBatchPlaybackClock([], { waitingSeconds: Infinity })).toThrow(/positive finite/);
});

test('all-exception and retry scenarios reveal additional frontier work without clamping it away', () => {
  const system = final('disaggregated', { documents: 7, exceptions: 7, boundedRetries: 1, interpretationRetries: 2 });
  const frontier = final('frontier', { documents: 7, exceptions: 7, boundedRetries: 1, interpretationRetries: 2 });
  expect(system.snapshot.boundedCalls).toBe(14);
  expect(system.snapshot.frontierCalls).toBe(21);
  expect(system.snapshot.frontierDocuments).toBe(7);
  expect(frontier.snapshot.frontierCalls - system.snapshot.frontierCalls).toBe(-14);
  expect(relativeBatchDifference(frontier.snapshot.frontierCalls, system.snapshot.frontierCalls)).toBe(-2);
  for (const document of system.trace.documents) {
    const attempts = document.steps.filter(step => step.capability === 'frontier_interpret');
    expect(attempts.map(step => step.attempt)).toEqual([1, 2, 3]);
    expect(document.reviewReadyAt).toBeGreaterThanOrEqual(attempts[2].end);
    expect(document.publishedAt).toBeGreaterThanOrEqual(document.authorizedAt);
  }
});

test('empty, all-direct, zero-price and unknown-price workloads have explicit finite semantics', () => {
  for (const strategy of ['disaggregated', 'frontier'] as const) {
    const empty = final(strategy, { documents: 0, exceptions: 0 });
    expect(empty.trace.end).toBe(0);
    expect(empty.trace.firstSearchableAt).toBeNull();
    expect(empty.snapshot.cost).toBe(0);
    expect(empty.snapshot.totalCalls).toBe(0);
    expect(empty.snapshot.counts.searchable).toBe(0);
    const free = final(strategy, { exceptions: 0, boundedCost: 0, frontierClassifyCost: 0, frontierInterpretCost: 0, codeCost: 0 });
    expect(free.snapshot.cost).toBe(0);
    expect(free.snapshot.counts.searchable).toBe(100);
    expect(free.trace.steps.filter(step => step.capability === 'review')).toHaveLength(0);
  }
  expect(final('disaggregated', { boundedCost: null }).snapshot.cost).toBeNull();
  expect(final('disaggregated', { frontierInterpretCost: null, exceptions: 0 }).snapshot.cost).not.toBeNull();
  expect(relativeBatchDifference(0, 0)).toBeNull();
  expect(relativeBatchDifference(0, 4)).toBeNull();
});

test('scheduler honors resource capacity, dependencies and deterministic arrival order', () => {
  const scenario = makeScenario({ documents: 30, exceptions: 13, arrivalInterval: .11, frontierCapacity: 2, boundedCapacity: 3, reviewCapacity: 1, codeCapacity: 2, boundedRetries: 1, interpretationRetries: 1 });
  for (const strategy of ['disaggregated', 'frontier'] as const) {
    const trace = buildBatchTrace(strategy, scenario);
    expect(buildBatchTrace(strategy, scenario)).toEqual(trace);
    const capacities: Record<BatchResource, number> = { bounded: 3, frontier: 2, human: 1, code: 2 };
    for (const resource of ['bounded', 'frontier', 'human', 'code'] as const) {
      const steps = trace.steps.filter(step => step.resource === resource);
      for (const time of steps.flatMap(step => [step.start + .0000001, step.end + .0000001])) {
        expect(steps.filter(step => step.start <= time && step.end > time).length, `${strategy} ${resource} at ${time}`).toBeLessThanOrEqual(capacities[resource]);
      }
    }
    for (const document of trace.documents) {
      let end = document.arrivalAt;
      for (const step of document.steps) {
        expect(step.start).toBeGreaterThanOrEqual(end);
        expect(step.end).toBeGreaterThanOrEqual(step.start);
        end = step.end;
      }
    }
  }
  const slow = final('frontier', { documents: 12, exceptions: 0, frontierCapacity: 1 });
  const fast = final('frontier', { documents: 12, exceptions: 0, frontierCapacity: 4 });
  expect(fast.trace.end).toBeLessThan(slow.trace.end);
  expect(fast.snapshot.machineSeconds).toBeCloseTo(slow.snapshot.machineSeconds);
  expect(fast.snapshot.cost).toBeCloseTo(slow.snapshot.cost!);
});

test('independent publication makes a routine result available while a review is pending', () => {
  for (const strategy of ['disaggregated', 'frontier'] as const) {
    const independent = final(strategy, { documents: 4, exceptions: 2, publication: 'independent', reviewSeconds: 30 });
    const direct = independent.trace.documents.find(document => document.kind === 'routine')!;
    const exception = independent.trace.documents.find(document => document.kind === 'exception')!;
    expect(direct.publishedAt).toBeLessThan(exception.authorizedAt);
    expect(batchDocumentSnapshot(direct, direct.publishedAt).state).toBe('searchable');
    expect(batchDocumentSnapshot(exception, exception.reviewReadyAt! + .1).state).toBe('review');
    const beforeReview = batchSnapshot(independent.trace, exception.reviewReadyAt! + .1);
    expect(beforeReview.counts.searchable).toBeGreaterThan(0);
    expect(beforeReview.counts.review).toBeGreaterThan(0);
    const batch = final(strategy, { documents: 4, exceptions: 2, publication: 'batch', reviewSeconds: 30 });
    expect(batch.trace.firstSearchableAt).toBeGreaterThanOrEqual(Math.max(...batch.trace.documents.map(document => document.authorizedAt)));
  }
});

test('backward seeking hides publication and request counts while completed metrics remain independent of playback', () => {
  const trace = buildBatchTrace('disaggregated', makeScenario({ documents: 12, exceptions: 4, publication: 'independent' }));
  const end = batchSnapshot(trace, trace.end);
  const before = batchSnapshot(trace, trace.firstSearchableAt! - .000001);
  expect(before.counts.searchable).toBe(0);
  expect(before.firstSearchableAt).toBeNull();
  expect(before.completionAt).toBeNull();
  expect(before.frontierCalls).toBeLessThanOrEqual(end.frontierCalls);
  expect(batchSnapshot(trace, trace.end)).toEqual(end);
  for (let time = 0; time <= trace.end; time += .37) {
    const snapshot = batchSnapshot(trace, time);
    expect(Object.values(snapshot.counts).reduce((sum, value) => sum + value, 0)).toBe(12);
    expect(snapshot.boundedCalls).toBe(trace.steps.filter(step => step.resource === 'bounded' && step.start <= time).length);
  }
  const traces = [trace, buildBatchTrace('frontier', trace.scenario)];
  let time = 0;
  let iterations = 0;
  const duration = Math.max(...traces.map(value => value.end));
  while (time < duration && iterations++ < 500) {
    const next = nextBatchTime(traces, time);
    expect(next).toBeGreaterThan(time);
    time = next;
  }
  expect(time).toBe(duration);
});

test('invalid assumptions are rejected and zero-duration tasks still terminate', () => {
  expect(validateBatchScenario(makeScenario({ exceptions: 101 }))).toMatch(/cannot exceed/);
  expect(validateBatchScenario(makeScenario({ boundedCapacity: 0 }))).toMatch(/capacity/);
  expect(validateBatchScenario(makeScenario({ documents: 10.5 }))).toMatch(/whole/);
  expect(validateBatchScenario(makeScenario({ boundedSeconds: NaN }))).toMatch(/judgment/);
  expect(() => buildBatchTrace('frontier', makeScenario({ exceptions: -1 }))).toThrow();
  const zero = final('disaggregated', { documents: 4, exceptions: 4, boundedSeconds: 0, frontierInterpretSeconds: 0, codeSeconds: 0, publishSeconds: 0, reviewSeconds: 0 });
  expect(zero.trace.end).toBe(0);
  expect(zero.snapshot.counts.searchable).toBe(4);
  expect(zero.snapshot.totalCalls).toBe(8);
  expect(virtualBatchDocuments(makeScenario({ documents: 30, exceptions: 7 })).filter(document => document.kind === 'exception')).toHaveLength(7);
});

const event = (sequence: number, instance_id: string, type: Event['type'], payload: Event['payload'], second = sequence): Event => ({
  sequence, instance_id, type, payload, event_id: `event-${sequence}`, run_id: 'recording', attempt: 1, schema_version: 1,
  parent_instance_id: null, timestamp: new Date(Date.UTC(2026, 8, 29, 12, 0, second)).toISOString(),
});
const recordedEvents = [
  event(1, 'run', 'run_started', { mode: 'test-fixture' }, 0),
  event(2, 'worker:doc', 'worker_created', { document_id: 'doc', label: 'A clear invoice' }),
  event(3, 'doc:extract', 'node_completed', { state: 'succeeded' }),
  event(4, 'doc:jev', 'node_started', { state: 'running' }),
  event(5, 'doc:jev', 'decision', { selected_route: 'accept', policy_reason: 'accepted' }),
  event(6, 'doc:publish', 'node_completed', { state: 'succeeded', publication: { id: 'publication', document_id: 'doc', status: 'searchable', committed_at: '2026-09-29T12:00:05.500Z' } }),
];

test('recorded comparison uses publication commits and event prefixes, not current library state', () => {
  const before = recordedBatchEvidence(recordedEvents.slice(0, 5));
  expect(before.boundedCalls).toBe(1);
  expect(before.frontierCalls).toBe(0);
  expect(before.searchable).toBeNull();
  expect(before.firstSearchableSeconds).toBeNull();
  const after = recordedBatchEvidence(recordedEvents);
  expect(after.searchable).toBe(1);
  expect(after.firstSearchableSeconds).toBe(5.5);
  expect(after.documents[0].searchable).toBe(true);
  expect(after.complete).toBe(false);
  const old = recordedBatchEvidence([...recordedEvents.slice(0, 5), event(6, 'index', 'node_completed', { state: 'succeeded', output_count: 1 })]);
  expect(old.searchable).toBe(1);
  expect(old.firstSearchableSeconds).toBeNull();
  const withdrawn = recordedBatchEvidence([...recordedEvents, ...recordedEvents.slice(0, 4), event(7, 'doc:publish', 'node_completed', { publication: { document_id: 'doc', status: 'withdrawn', committed_at: '2026-09-29T12:00:07Z' } })]);
  expect(withdrawn.boundedCalls).toBe(1);
  expect(withdrawn.searchable).toBe(0);
  expect(withdrawn.firstSearchableSeconds).toBe(5.5);
});

test('comparison UI states provenance, equal-outcome assumption, and request totals before exposing optional detail', () => {
  const html = renderToStaticMarkup(createElement(CompareStrategies, { initialSource: 'illustrative' }));
  expect(html).toContain('Compare strategies');
  expect(html).toContain('Virtual workload · no provider calls');
  expect(html).toContain('80');
  expect(html).toContain('frontier calls avoided');
  expect(html).toContain('120');
  expect(html).toContain('Prepared final categories and review outcomes are held equal');
  expect(html).toContain('Shared modeled work time');
  expect(html).not.toContain('80% cheaper');
  expect(html).toContain('aria-label="Compare workload"');
  expect(html).toContain('role="img" aria-label="Following virtual document 1');
  expect(html).not.toContain('class="flow-trail');
  expect(html).not.toContain('data-flow-state="flowing"');
  expect(html).toContain('markerUnits="userSpaceOnUse"');
});

test('recorded mode keeps an unexecuted alternative clearly hypothetical', () => {
  const run = { id: 'recording', mode: 'test-fixture' } as Run;
  const html = renderToStaticMarkup(createElement(CompareStrategies, { recorded: { run, events: recordedEvents } }));
  expect(html).toContain('Whole recording');
  expect(html).toContain('Hypothetical baseline');
  expect(html).toContain('Not executed');
  expect(html).toContain('Not measured');
  expect(html).toContain('Unavailable — no comparable usage');
  expect(html).toContain('Counts are provisional');
  expect(html).toContain('A clear invoice');
});

for (const variant of ['horizontal', 'vertical', 'compact'] as const) for (const disaggregated of [false, true]) test(`${variant} ${disaggregated ? 'disaggregated' : 'frontier'} graph fits its viewport and routes avoid unrelated work nodes`, () => {
  const layout = variant === 'compact' ? compactBatchLaneLayout(disaggregated) : batchLaneLayout(variant === 'vertical', disaggregated);
  for (const node of layout.nodes) {
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeGreaterThanOrEqual(0);
    expect(node.x + node.width).toBeLessThanOrEqual(layout.width);
    expect(node.y + node.height).toBeLessThanOrEqual(layout.height);
  }
  for (const edge of layout.edges) {
    const source = layout.nodes.find(node => node.id === edge.source)!;
    const target = layout.nodes.find(node => node.id === edge.target)!;
    for (const [point, node] of [[edge.points[0], source], [edge.points.at(-1)!, target]] as const) {
      expect(point.x >= node.x && point.x <= node.x + node.width && point.y >= node.y && point.y <= node.y + node.height).toBe(true);
      expect(point.x === node.x || point.x === node.x + node.width || point.y === node.y || point.y === node.y + node.height).toBe(true);
    }
    const route = roundedRoute(edge.points);
    for (let i = 0; i <= 100; i++) {
      const point = pointOnRoute(route.samples, i / 100);
      for (const node of layout.nodes.filter(node => node.id !== edge.source && node.id !== edge.target)) {
        expect(point.x > node.x - 10 && point.x < node.x + node.width + 10 && point.y > node.y - 15 && point.y < node.y + node.height + 15, `${edge.id} crosses ${node.id}`).toBe(false);
      }
    }
  }
});
