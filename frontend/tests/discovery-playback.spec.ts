import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LessonCatalogue, RunSnapshot } from '../src/lib/api.generated';
import { discoveryPlaybackSteps, discoveryWorkTiming } from '../src/lib/discoveryPlayback';
import { discoveryTree } from '../src/lib/discoveryTree';
import { discoveryRoutePoint, discoveryTreeGeometry, type TreeBox } from '../src/lib/discoveryTreeLayout';
import { DiscoveryDecisionTree } from '../src/components/DiscoveryDecisionTree';
import { executionReplayBeats } from '../src/lib/replay';
import raw from '../src/data/lessons.json' with { type: 'json' };
import { mockLiveDiscovery } from './helpers/liveDiscoveryFixture';
import { discoveryJourneySteps, discoveryServiceBreakdown } from '../src/lib/discoveryJourney';
import { DiscoveryLatencyBreakdown } from '../src/components/DiscoveryLatencyBreakdown';
import { discoveryTimingReference, discoveryTimingAssumptions } from '../src/lib/discoveryTimingAssumptions';
import liveReference from '../../docs/latency-results.json' with { type: 'json' };

const catalogue = raw as unknown as LessonCatalogue;
const beat = (snapshot: RunSnapshot, id: string) => discoveryPlaybackSteps(snapshot).find(step => {
  const event = snapshot.events[step.cursor - 1];
  return event.type === 'node_started' && event.instance_id === id && event.payload.state === 'running';
})!;
const through = (snapshot: RunSnapshot, type: string, id: string) => snapshot.events.slice(0, snapshot.events.findIndex(event => event.type === type && event.instance_id === id) + 1);

test('prepared service holds separate fast code, bounded judgments and slow frontier work without calling fixture sleeps measurements', () => {
  const snapshot = catalogue.discovery.compare;
  expect(discoveryWorkTiming(snapshot, 'intent')).toEqual({ kind: 'bounded', source: 'assumed', ms: 125 });
  expect(discoveryWorkTiming(snapshot, 'plan')).toEqual({ kind: 'frontier', source: 'assumed', ms: 2400 });
  expect(discoveryWorkTiming(snapshot, 'citations')).toEqual({ kind: 'code', source: 'assumed', ms: 1 });
  expect(beat(snapshot, 'citations').duration).toBe(160);
  expect(beat(snapshot, 'intent').duration).toBe(160);
  expect(beat(snapshot, 'plan').duration).toBe(2400);
  expect(beat(snapshot, 'synthesize').duration).toBe(4600);
  expect(beat(catalogue.discovery.find, 'plan').duration).toBe(160);
  expect(discoveryPlaybackSteps(snapshot).map(step => step.cursor)).toEqual(executionReplayBeats(snapshot.events).map(step => step.cursor));
  expect(beat(snapshot, 'worker:task-1').duration).toBe(240);
});

test('System 1 simulation reference matches retained real Jev requests, not fixture sleeps or inference-only claims', () => {
  const measured = liveReference.provider_requests.filter(item => item.provider === 'jev').map(item => item.elapsed_ms).sort((a, b) => a - b);
  const median = (measured[2] + measured[3]) / 2;
  expect(liveReference.mode).toBe('live');
  expect(liveReference.status).toBe('succeeded');
  expect(measured).toHaveLength(discoveryTimingReference.sample_count);
  expect(discoveryTimingReference.checked_on).toBe(liveReference.checked_on);
  expect(discoveryTimingReference.request_elapsed_ms.median).toBe(median);
  expect(discoveryTimingAssumptions.bounded).toBe(Math.round(median));
  const snapshot = structuredClone(catalogue.discovery.compare);
  snapshot.events.find(event => event.type === 'node_completed' && event.instance_id === 'intent')!.payload.detail = JSON.stringify({ provider: 'fixture', elapsed_ms: 9999 });
  expect(discoveryWorkTiming(snapshot, 'intent')).toMatchObject({ source: 'assumed', ms: 125 });
  const html = renderToStaticMarkup(createElement(DiscoveryLatencyBreakdown, { snapshot }));
  expect(html).toContain('Assumed · whole example');
  expect(html).toContain('<dd>625 ms</dd>');
  expect(html).toContain('125 ms avg / request');
  expect(html).toContain('Request times include network time');
  expect(html).not.toContain('1.75 s');
});

test('actual service measurements share a linear scale and retain slow code or faster frontier counterexamples', () => {
  const snapshot = mockLiveDiscovery().snapshot;
  expect(discoveryWorkTiming(snapshot, 'plan')).toMatchObject({ source: 'recorded', ms: 2400 });
  expect(discoveryWorkTiming(snapshot, 'synthesize')).toMatchObject({ source: 'recorded', ms: 4600 });
  snapshot.events.find(event => event.type === 'node_completed' && event.instance_id === 'citations')!.payload.elapsed_ms = 9200;
  expect(beat(snapshot, 'citations').duration).toBe(6000);
  expect(beat(snapshot, 'plan').duration).toBeCloseTo(2400 * 6000 / 9200);
  expect(beat(snapshot, 'synthesize').duration).toBeCloseTo(4600 * 6000 / 9200);
  expect(beat(snapshot, 'citations').duration).toBeGreaterThan(beat(snapshot, 'synthesize').duration);
});

test('zero, missing, invalid and skipped work preserve timing provenance', () => {
  const snapshot = mockLiveDiscovery().snapshot;
  const record = snapshot.events.find(event => event.type === 'node_completed' && event.instance_id === 'plan')!;
  for (const value of [0, null, -1, '2400']) {
    record.payload.detail = JSON.stringify({ provider: 'openai', elapsed_ms: value });
    expect(discoveryWorkTiming(snapshot, 'plan')).toMatchObject({ source: value === 0 ? 'recorded' : 'unavailable', ms: value === 0 ? 0 : null });
    expect(beat(snapshot, 'plan').duration).toBe(value === 0 ? 160 : 1100);
  }
  snapshot.events = snapshot.events.filter(event => !(event.instance_id === 'synthesize' && event.type === 'node_started'));
  expect(discoveryPlaybackSteps(snapshot).filter(step => snapshot.events[step.cursor - 1].instance_id === 'synthesize' && snapshot.events[step.cursor - 1].type === 'node_started')).toHaveLength(0);
});

test('planning retries follow the routing decision present when that attempt started', () => {
  const snapshot = structuredClone(catalogue.discovery.find);
  const base = snapshot.events.at(-1)!;
  const decision = structuredClone(snapshot.events.find(event => event.type === 'decision' && event.instance_id === 'intent')!);
  decision.payload.selected_route = 'plan'; decision.attempt = 2;
  snapshot.events.push(decision, { ...base, type: 'node_started', instance_id: 'plan', attempt: 2, payload: { state: 'running' } }, { ...base, type: 'node_completed', instance_id: 'plan', attempt: 2, payload: { state: 'succeeded', detail: '{"provider":"fixture"}' } });
  expect(discoveryWorkTiming(snapshot, 'plan', 1)).toMatchObject({ kind: 'code', ms: 1 });
  expect(discoveryWorkTiming(snapshot, 'plan', 2)).toMatchObject({ kind: 'frontier', ms: 2400 });
});

for (const name of ['find', 'compare'] as const) test(`${name}: one prefix-derived location follows only recorded handoffs and ignores worker/queue bookkeeping`, () => {
  const snapshot = catalogue.discovery[name];
  for (let cursor = 0; cursor <= snapshot.events.length; cursor++) {
    const prefix = snapshot.events.slice(0, cursor), tree = discoveryTree(prefix), location = tree.location;
    const current = tree.edges.filter(edge => edge.current);
    if ('edge' in location) { expect(current).toHaveLength(1); expect(current[0].id).toBe(location.edge); expect(current[0].visited).toBe(true); }
    else { expect(current).toHaveLength(0); expect(tree.nodes.some(node => node.id === location.node)).toBe(true); }
    const last = prefix.at(-1);
    if (last && (last.instance_id.startsWith('worker:') || last.payload.state === 'queued')) expect(location).toEqual(discoveryTree(prefix.slice(0, -1)).location);
  }
  expect(discoveryTree(through(snapshot, 'node_started', 'plan')).location).toMatchObject({ node: name === 'find' ? 'code-plan' : 'frontier-plan', instance: 'plan' });
  expect(discoveryTree(snapshot.events).location).toMatchObject({ node: name === 'find' ? 'sources' : 'answer', instance: 'done' });
});

test('grouped answer steps identify frontier drafting, code checks and System 1 checks separately', () => {
  const snapshot = catalogue.discovery.compare;
  for (const [id, label, assumed] of [['synthesize', 'Draft answer · Frontier', 'Assumed 4.6 s'], ['citations', 'Check citations · Code', 'Assumed 1 ms'], ['support:claim-1', 'Check support · System 1', 'Assumed 125 ms']] as const) {
    const events = through(snapshot, 'node_started', id);
    const html = renderToStaticMarkup(createElement(DiscoveryDecisionTree, { tree: discoveryTree(events), snapshot, cursor: events.length, playing: false, speed: 1, onInspect: () => {} }));
    expect(html).toContain(label); expect(html).toContain(assumed);
  }
  const live = mockLiveDiscovery().snapshot;
  const events = through(live, 'node_started', 'synthesize');
  const html = renderToStaticMarkup(createElement(DiscoveryDecisionTree, { tree: discoveryTree(events), snapshot: live, cursor: events.length, playing: false, speed: 1, onInspect: () => {} }));
  expect(html).not.toContain('Recorded 4.6 s'); // Measurement is shown once completion is in the prefix.
  expect(html).not.toContain('Assumed');
});

for (const [vertical, width] of [[false, 1080], [false, 744], [true, 368], [true, 294]] as const) test(`${vertical ? 'vertical' : 'horizontal'} ${width}px connected rails keep the full marker clear of service text and unrelated cards`, () => {
  const box = (left: number, top: number, width = 160, height = 78): TreeBox => ({ left, top, width, height });
  const branchWidth = (width - 80 - 32) / 2;
  const slot = (width - 56 - 114) / 4, cardWidth = Math.min(176, slot);
  const left = (column: number) => 28 + column * (slot + 38) + (slot - cardWidth) / 2;
  const cards = vertical ? { judgment: box((width - 192) / 2, 12, 192), 'code-plan': box(40, 174, branchWidth, 100), 'frontier-plan': box(72 + branchWidth, 174, branchWidth, 100), evidence: box((width - 192) / 2, 348, 192), sources: box(40, 500, branchWidth, 100), answer: box(72 + branchWidth, 500, branchWidth, 100) }
    : { judgment: box(left(0), 130, cardWidth), 'code-plan': box(left(1), 58, cardWidth), 'frontier-plan': box(left(1), 214, cardWidth), evidence: box(left(2), 130, cardWidth), sources: box(left(3), 58, cardWidth), answer: box(left(3), 214, cardWidth) };
  const { routes, tracks } = discoveryTreeGeometry(cards, width, vertical);
  for (const route of routes) {
    const source = cards[route.source], target = cards[route.target];
    expect(route.points[0]).toEqual(vertical ? { x: source.left + 17, y: source.top + source.height } : { x: source.left + source.width, y: source.top + source.height - 21 });
    expect(route.points.at(-1)).toEqual(vertical ? { x: target.left + 17, y: target.top } : { x: target.left, y: target.top + target.height - 21 });
    expect(tracks[route.source]).toContain(vertical ? `V ${source.top + source.height}` : `H ${source.left + source.width}`);
    for (let i = 0; i <= 200; i++) {
      const point = discoveryRoutePoint(route, i / 200);
      for (const [id, card] of Object.entries(cards)) {
        // The attached band belongs to its endpoint services; all other cards
        // remain clear. Include the paper's full ±17×21px halo in this check.
        const endpoint = id === route.source || id === route.target;
        const left = card.left + (endpoint && vertical ? 39 : 0);
        const bottom = card.top + card.height - (endpoint && !vertical ? 42 : endpoint ? 9 : 0);
        const overlaps = point.x + 17 > left && point.x - 17 < card.left + card.width && point.y + 21 > card.top && point.y - 21 < bottom;
        expect(overlaps, `${route.id} marker collides with ${id} at ${i}`).toBe(false);
      }
    }
  }
});

for (const name of ['find', 'compare'] as const) test(`${name}: replay crosses each capability once, combining parallel work and internal checks into one continuous visit`, () => {
  const snapshot = catalogue.discovery[name], steps = discoveryJourneySteps(snapshot);
  const services = steps.filter(step => step.capability.kind === 'service');
  expect(steps).toHaveLength(11);
  expect(services.map(step => step.capability.node)).toEqual(name === 'find' ? ['judgment', 'code-plan', 'evidence', 'sources'] : ['judgment', 'frontier-plan', 'evidence', 'answer']);
  expect(services.map(step => step.duration)).toEqual(name === 'find' ? [160, 160, 160, 160] : [160, 2400, 252, 4852]);
  expect(services.every(step => step.capability.visit === 1)).toBe(true);
  expect(steps.filter(step => step.capability.kind === 'transfer').map(step => step.capability.edge)).toEqual(name === 'find' ? ['judgment--code-plan', 'code-plan--evidence', 'evidence--sources'] : ['judgment--frontier-plan', 'frontier-plan--evidence', 'evidence--answer']);
  expect(steps.map(step => step.cursor)).toEqual([...steps.map(step => step.cursor)].sort((a, b) => a - b));
  for (const [index, step] of steps.entries()) {
    if (step.capability.kind === 'service') {
      expect(snapshot.events[step.cursor - 1].type).toBe('node_started');
      const next = steps[index + 1];
      expect(next.capability.kind).toBe('checkpoint');
      expect(next.capability.key).toBe(step.capability.key);
      expect(next.cursor).toBe(step.capability.endCursor);
      expect(next.capability.timing).toEqual(step.capability.timing);
    }
    if (step.capability.kind === 'transfer') {
      expect(snapshot.events[step.cursor - 1].type).toBe('edge_selected');
      expect(step.capability.endCursor).toBe(steps[index + 1].cursor);
    }
  }
  expect(discoveryTree(snapshot.events.slice(0, services.at(-1)!.cursor)).execution.result).toBeUndefined();
  expect(steps.at(-1)!.cursor).toBe(snapshot.events.length);
  expect(discoveryTree(snapshot.events.slice(0, steps.at(-1)!.cursor)).execution.result).toBeTruthy();
});

test('service breakdown counts requests and local operations once, excluding parallel worker and aggregate wrappers', () => {
  const snapshot = structuredClone(catalogue.discovery.compare);
  const expected = discoveryServiceBreakdown(snapshot);
  expect(expected.groups.code).toMatchObject({ count: 4, ms: 4, source: 'assumed' });
  expect(expected.groups.bounded).toMatchObject({ count: 5, ms: 625, source: 'assumed' });
  expect(expected.groups.frontier).toMatchObject({ count: 2, ms: 7000, source: 'assumed' });
  expect(expected.all.ms).toBe(7629);
  expect(expected.comparable).toBe(true);
  snapshot.events.splice(14, 0, structuredClone(snapshot.events[13]));
  expect(discoveryServiceBreakdown(snapshot)).toEqual(expected);
  expect(discoveryJourneySteps(snapshot).filter(step => step.capability.kind === 'service')).toHaveLength(4);
  const find = discoveryServiceBreakdown(catalogue.discovery.find);
  expect(find.groups.frontier).toMatchObject({ count: 0, ms: 0 });
  expect(find.all.ms).toBe(253);
  const mixed = structuredClone(catalogue.discovery.compare);
  mixed.events.find(event => event.instance_id === 'intent' && event.type === 'node_completed')!.payload.detail = JSON.stringify({ provider: 'jev', elapsed_ms: 200 });
  const html = renderToStaticMarkup(createElement(DiscoveryLatencyBreakdown, { snapshot: mixed }));
  expect(html).toContain('Mixed timing');
  expect(html).toContain('Total service work</dt><dd>7.70 s</dd>');
  expect(html).toContain('5 steps (mixed)');
  expect(html).toContain('2 simulated steps');
  expect(html).not.toContain('style="width:');
});

for (const name of ['find', 'compare'] as const) test(`${name}: total service-work bar accounts for every capability without inventing elapsed latency`, () => {
  const snapshot = catalogue.discovery[name];
  const breakdown = discoveryServiceBreakdown(snapshot);
  const html = renderToStaticMarkup(createElement(DiscoveryLatencyBreakdown, { snapshot }));
  expect(html).toContain(`Total service work</dt><dd>${name === 'find' ? '253 ms' : '7.63 s'}</dd>`);
  const widths = [...html.matchAll(/<span class="role-(?:runtime|jev|llm)" style="width:([\d.]+)%"/g)].map(match => Number(match[1]));
  expect(widths).toHaveLength(3);
  expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100, 8);
  for (const [index, key] of (['code', 'bounded', 'frontier'] as const).entries()) {
    expect(widths[index]).toBeCloseTo(breakdown.groups[key].ms! / breakdown.all.ms! * 100, 8);
  }
  if (name === 'find') {
    expect(widths[2]).toBe(0);
    expect(html).toContain('Frontier</dt><dd>Not used</dd>');
  }
  expect(html).toContain('Parallel calls can overlap');
  expect(html).not.toContain('Total workflow time');
});

test('the service-work total preserves unknown, zero and empty recordings without a fabricated composition', () => {
  const snapshot = mockLiveDiscovery().snapshot;
  const plan = snapshot.events.find(event => event.instance_id === 'plan' && event.type === 'node_completed')!;
  plan.payload.detail = JSON.stringify({ provider: 'openai', elapsed_ms: null });
  const missing = renderToStaticMarkup(createElement(DiscoveryLatencyBreakdown, { snapshot }));
  expect(missing).toContain('Total service work</dt><dd>Not measured</dd>');
  expect(missing).toContain('Incomplete timing');
  expect(missing).not.toContain('style="width:');
  for (const event of snapshot.events) {
    if (event.type === 'node_completed') {
      event.payload.elapsed_ms = 0;
      event.payload.detail = JSON.stringify({ provider: 'jev', elapsed_ms: 0 });
    }
  }
  const zero = renderToStaticMarkup(createElement(DiscoveryLatencyBreakdown, { snapshot }));
  expect(zero).toContain('Total service work</dt><dd>0 ms</dd>');
  expect(zero).not.toContain('style="width:');
  expect(zero).not.toContain('NaN');
  snapshot.events = [];
  const empty = renderToStaticMarkup(createElement(DiscoveryLatencyBreakdown, { snapshot }));
  expect(empty).toContain('Total service work</dt><dd>—</dd>');
  expect(empty).toContain('Timing unavailable');
  expect(empty).not.toContain('style="width:');
});

test('aggregated replay preserves zero and unknown measurements and scales all service visits together', () => {
  const snapshot = mockLiveDiscovery().snapshot;
  const plan = snapshot.events.find(event => event.instance_id === 'plan' && event.type === 'node_completed')!;
  plan.payload.detail = JSON.stringify({ provider: 'openai', elapsed_ms: 0 });
  expect(discoveryJourneySteps(snapshot).find(step => step.capability.node === 'frontier-plan' && step.capability.kind === 'service')).toMatchObject({ duration: 160, capability: { timing: { ms: 0, source: 'recorded' } } });
  plan.payload.detail = JSON.stringify({ provider: 'openai', elapsed_ms: null });
  expect(discoveryJourneySteps(snapshot).find(step => step.capability.node === 'frontier-plan' && step.capability.kind === 'service')).toMatchObject({ duration: 1400, capability: { timing: { ms: null, missing: 1 } } });
  expect(discoveryServiceBreakdown(snapshot)).toMatchObject({ all: { ms: null }, comparable: false });
  const missing = renderToStaticMarkup(createElement(DiscoveryLatencyBreakdown, { snapshot }));
  expect(missing).toContain('Not measured');
  expect(missing).not.toContain('style="width:');
  plan.payload.detail = JSON.stringify({ provider: 'openai', elapsed_ms: 2400 });
  snapshot.events.find(event => event.instance_id === 'citations' && event.type === 'node_completed')!.payload.elapsed_ms = 9200;
  const steps = discoveryJourneySteps(snapshot), answer = steps.find(step => step.capability.node === 'answer' && step.capability.kind === 'service')!;
  expect(answer.duration).toBe(6000);
  expect(steps.find(step => step.capability.node === 'frontier-plan' && step.capability.kind === 'service')!.duration).toBeCloseTo(2400 * 6000 / answer.capability.timing.ms!);
  plan.payload.detail = JSON.stringify({ provider: 'openai', elapsed_ms: null });
  expect(discoveryJourneySteps(snapshot).find(step => step.capability.node === 'frontier-plan' && step.capability.kind === 'service')!.duration).toBe(1400);
});

test('a recorded later return has a numbered visit; changing the plan preserves the first branch history', () => {
  const snapshot = structuredClone(catalogue.discovery.find);
  const intentStart = snapshot.events.find(event => event.type === 'node_started' && event.instance_id === 'intent')!;
  const decision = snapshot.events.find(event => event.type === 'decision' && event.instance_id === 'intent')!;
  const edge = snapshot.events.find(event => event.type === 'edge_selected' && event.instance_id === 'intent')!;
  const planStart = snapshot.events.find(event => event.type === 'node_started' && event.instance_id === 'plan')!;
  const planEnd = snapshot.events.find(event => event.type === 'node_completed' && event.instance_id === 'plan')!;
  const retry = [intentStart, { ...decision, payload: { ...decision.payload, selected_route: 'plan' } }, edge, planStart, planEnd].map((event, i) => ({ ...structuredClone(event), attempt: 2, sequence: snapshot.events.length + i + 1, event_id: `retry-${i}` }));
  snapshot.events.push(...retry);
  const services = discoveryJourneySteps(snapshot).filter(step => step.capability.kind === 'service');
  expect(services.map(step => [step.capability.node, step.capability.visit])).toEqual([['judgment', 1], ['code-plan', 1], ['evidence', 1], ['sources', 1], ['judgment', 2], ['frontier-plan', 1]]);
  expect(services.at(-1)!.capability.timing).toMatchObject({ ms: 2400, source: 'assumed' });
  expect(discoveryJourneySteps(snapshot).filter(step => step.capability.kind === 'transfer').map(step => step.capability.edge)).toContain('judgment--code-plan');
  // A policy reroute can reuse a signal without another intent request.
  snapshot.events = snapshot.events.filter(event => !(event.instance_id === 'intent' && event.attempt === 2 && event.type === 'node_started'));
  const policyOnly = discoveryJourneySteps(snapshot);
  expect(policyOnly.find(step => step.capability.node === 'judgment' && step.capability.visit === 2)).toMatchObject({ capability: { kind: 'checkpoint', timing: { count: 0 } } });
  expect(policyOnly.filter(step => step.capability.kind === 'transfer').map(step => step.capability.edge)).toContain('judgment--frontier-plan');
  expect(discoveryServiceBreakdown(snapshot).groups.bounded.count).toBe(2);
});

test('out-of-scope and skipped composition records do not invent frontier processing', () => {
  const snapshot = structuredClone(catalogue.discovery.find);
  snapshot.events = snapshot.events.filter(event => ['intent', 'done', 'run'].includes(event.instance_id));
  snapshot.events.find(event => event.type === 'decision')!.payload.selected_route = 'unsupported';
  snapshot.events.find(event => event.type === 'edge_selected')!.payload.target_instance_id = 'done';
  const steps = discoveryJourneySteps(snapshot);
  expect(steps).toHaveLength(5);
  expect(steps.filter(step => step.capability.kind === 'service').map(step => step.capability.node)).toEqual(['judgment', 'sources']);
  expect(steps.find(step => step.capability.kind === 'transfer')!.capability.edge).toBe('judgment--sources');
  expect(discoveryServiceBreakdown(snapshot).groups.frontier.count).toBe(0);
  const compare = structuredClone(catalogue.discovery.compare);
  const compose = compare.events.find(event => event.instance_id === 'synthesize' && event.type === 'node_completed')!;
  compose.payload.state = 'skipped';
  expect(discoveryServiceBreakdown(compare).groups.frontier).toMatchObject({ count: 1, ms: 2400 });
  expect(discoveryJourneySteps(compare).find(step => step.capability.kind === 'service' && step.capability.node === 'answer')!.capability.timing.ms).toBe(252);
});

test('completed replay paints every visited connector and service rail without recurring flow layers', () => {
  const snapshot = catalogue.discovery.compare, steps = discoveryJourneySteps(snapshot);
  const completedNodes = steps.filter(step => step.capability.kind === 'checkpoint').map(step => step.capability.node);
  const completedEdges = steps.filter(step => step.capability.kind === 'transfer').map(step => step.capability.edge!);
  const html = renderToStaticMarkup(createElement(DiscoveryDecisionTree, { tree: discoveryTree(snapshot.events), snapshot, cursor: snapshot.events.length, phase: steps.at(-1)!.capability, completedNodes, completedEdges, playing: false, speed: 1, onInspect: () => {} }));
  expect(html.match(/tree-link is-traversed/g)).toHaveLength(3);
  expect(html.match(/tree-stage-track is-traversed/g)).toHaveLength(4);
  expect(html).not.toContain('flow-trail');
  expect(html).not.toContain('tree-stage-progress');
  expect(html).not.toContain('tree-transfer-progress');
  expect(html).toContain('Result 01');
  const service = steps.find(step => step.capability.node === 'answer' && step.capability.kind === 'service')!;
  const start = renderToStaticMarkup(createElement(DiscoveryDecisionTree, { tree: discoveryTree(snapshot.events.slice(0, service.cursor)), snapshot, cursor: service.cursor, phase: service.capability, playing: true, speed: 1, onInspect: () => {} }));
  expect(start).toContain('Compose &amp; check · Frontier + checks');
  expect(start).toContain('Assumed service work 4.85 s');
  expect(start).not.toContain('Result 01');
  expect(start).not.toContain('flow-trail');
});

test('a changed retry decision preserves earlier code handoffs instead of repainting them as frontier work', () => {
  const snapshot = structuredClone(catalogue.discovery.find);
  let events = through(snapshot, 'node_started', 'plan');
  const original = snapshot.events.find(event => event.type === 'decision' && event.instance_id === 'intent')!;
  const retry = { ...original, event_id: 'retry-route', sequence: events.at(-1)!.sequence + 1, attempt: 2, payload: { ...original.payload, selected_route: 'plan' } };
  events = [...events, retry];
  let tree = discoveryTree(events);
  expect(tree.edges.filter(edge => edge.visited).map(edge => edge.id)).toEqual(['judgment--code-plan']);
  expect(tree.location).toMatchObject({ node: 'judgment' });
  const edge = { ...retry, event_id: 'retry-handoff', sequence: retry.sequence + 1, type: 'edge_selected' as const, payload: { source_instance_id: 'intent', target_instance_id: 'plan' } };
  tree = discoveryTree([...events, edge]);
  expect(tree.edges.filter(item => item.visited).map(item => item.id)).toEqual(['judgment--code-plan', 'judgment--frontier-plan']);
  expect(tree.location).toMatchObject({ edge: 'judgment--frontier-plan' });
});


test('explicit live response timing takes precedence over fixture mode and is not labeled as an assumed model response', () => {
  const snapshot = mockLiveDiscovery().snapshot;
  snapshot.run.mode = 'test-fixture';
  expect(discoveryWorkTiming(snapshot, 'plan')).toMatchObject({ source: 'recorded', ms: 2400 });
  const events = through(snapshot, 'node_started', 'plan');
  const html = renderToStaticMarkup(createElement(DiscoveryDecisionTree, { tree: discoveryTree(events), snapshot, cursor: events.length, playing: false, speed: 1, onInspect: () => {} }));
  expect(html).not.toContain('Assumed pace:');
  expect(html).not.toContain('Recorded 2.4 s');
  expect(html).toContain('Recorded pace · elapsed shown on completion');
});
