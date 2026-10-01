import { expect, test } from '@playwright/test';
import type { Event, LessonCatalogue } from '../src/lib/api.generated';
import raw from '../src/data/lessons.json' with { type: 'json' };
import { buildLessonGraph } from '../src/components/LessonFlow';
import { lessonLayout, lessonRoutePoint } from '../src/lib/lessonLayout';
import { classificationReplaySteps } from '../src/lib/replay';
import { classificationDocumentLabel, classificationJourney, classificationPlaybackSteps, relativeMotionTiming } from '../src/lib/classificationJourney';
import { mockLiveClassification } from './helpers/liveClassificationFixture';

const catalogue = raw as unknown as LessonCatalogue;
const snapshot = catalogue.classification.snapshot;
const doc = (example: string) => catalogue.classification.documents.find(item => item.example_id === example)!.document.id;

for (const mode of ['wide', 'compact', 'narrow'] as const) test(`${mode} lesson routes have no reverse stubs, no node collisions, and tangent-aligned arrowheads`, () => {
  const { boxes, routes } = lessonLayout(mode);
  expect(routes).toHaveLength(6);
  for (const route of routes) {
    const points = Array.from({ length: 101 }, (_, i) => lessonRoutePoint(route, i / 100));
    for (const [i, point] of points.entries()) {
      for (const axis of ['x', 'y'] as const) {
        expect(point[axis]).toBeGreaterThanOrEqual(Math.min(route.start[axis], route.end[axis]) - .000001);
        expect(point[axis]).toBeLessThanOrEqual(Math.max(route.start[axis], route.end[axis]) + .000001);
        if (i) expect((point[axis] - points[i - 1][axis]) * Math.sign(route.end[axis] - route.start[axis])).toBeGreaterThanOrEqual(-.000001);
      }
      for (const [id, box] of Object.entries(boxes)) {
        if (id === route.source || id === route.target) continue;
        const inside = point.x > box.x - 12 && point.x < box.x + box.width + 12 && point.y > box.y - 12 && point.y < box.y + box.height + 12;
        expect(inside, `${route.source}→${route.target} enters ${id}`).toBe(false);
      }
    }
    const tangentStart = route.curveControls?.[0] || route.end;
    const tangentEnd = route.curveControls?.[1] || route.start;
    if (route.sourceHandle === 'bottom') expect(tangentStart.x).toBe(route.start.x);
    else expect(tangentStart.y).toBe(route.start.y);
    if (route.targetHandle === 'top' || route.targetHandle === 'in-bottom') expect(tangentEnd.x).toBe(route.end.x);
    else expect(tangentEnd.y).toBe(route.end.y);
    if (!route.curveControls) expect(route.start.x === route.end.x || route.start.y === route.end.y).toBe(true);
  }
  // These are the actual wide and portrait card bounds that fitView sees.
  // Branch bends and labels stay inside them rather than extending an unseen canvas.
  const right = Math.max(...Object.values(boxes).map(box => box.x + box.width));
  const bottom = Math.max(...Object.values(boxes).map(box => box.y + box.height));
  for (const route of routes) {
    expect(route.labelPosition.x - 40).toBeGreaterThanOrEqual(0);
    expect(route.labelPosition.x + 40).toBeLessThanOrEqual(right);
    expect(route.labelPosition.y - 12).toBeGreaterThanOrEqual(0);
    expect(route.labelPosition.y + 12).toBeLessThanOrEqual(bottom);
  }
});

test('the highlighted exception path does not mark future approval or publication complete', () => {
  const id = doc('proposed');
  const at = snapshot.events.findIndex(event => event.type === 'decision' && event.instance_id === `${id}:jev`) + 1;
  const graph = buildLessonGraph({ run: snapshot.run, events: snapshot.events.slice(0, at), documentId: id, mode: 'wide' });
  expect(graph.nodes.filter(node => node.data.onPath).map(node => node.id)).toEqual(['judge', 'policy', 'interpret', 'review', 'publish']);
  expect(graph.nodes.find(node => node.id === 'accept')?.data).toMatchObject({ dimmed: true, onPath: false, state: 'skipped' });
  expect(graph.nodes.find(node => node.id === 'review')?.data).toMatchObject({ state: 'queued', title: 'Approve' });
  expect(graph.nodes.find(node => node.id === 'publish')?.data).toMatchObject({ state: 'queued', title: 'Publish' });
  expect(graph.edges.filter(edge => edge.data?.traversed).map(edge => edge.id)).toEqual(['judge--policy', 'policy--interpret']);
  const before = buildLessonGraph({ run: snapshot.run, events: snapshot.events.slice(0, at - 1), documentId: id, mode: 'wide' });
  expect(before.nodes.find(node => node.id === 'interpret')?.data.onPath).toBe(false);
  expect(before.nodes.find(node => node.id === 'review')?.data.metric).toBeUndefined();
});

test('a direct decision colors only its route and no batch bookkeeping repeats publication motion', () => {
  const id = doc('clear');
  const steps = classificationPlaybackSteps(snapshot, id);
  const decision = steps.find(step => step.stage === 'route')!;
  const graph = buildLessonGraph({ run: snapshot.run, events: snapshot.events.slice(0, decision.cursor), documentId: id, current: decision, mode: 'narrow' });
  expect(graph.nodes.filter(node => node.data.onPath).map(node => node.id)).toEqual(['judge', 'policy', 'accept', 'publish']);
  expect(graph.edges.filter(edge => edge.data?.current).map(edge => edge.id)).toEqual(['judge--policy']);
  const proposedId = doc('proposed');
  const proposedSteps = classificationReplaySteps(snapshot.events, proposedId);
  const bookkeeping = proposedSteps.find(step => step.target === 'index')!;
  const bookkeepingGraph = buildLessonGraph({ run: snapshot.run, events: snapshot.events.slice(0, bookkeeping.cursor), documentId: proposedId, current: bookkeeping, mode: 'wide' });
  expect(bookkeepingGraph.edges.some(edge => edge.data?.current)).toBe(false);
  const publication = proposedSteps.find(step => step.target === `${proposedId}:publish`)!;
  const publicationGraph = buildLessonGraph({ run: snapshot.run, events: snapshot.events.slice(0, publication.cursor), documentId: proposedId, current: publication, mode: 'wide' });
  expect(publicationGraph.edges.filter(edge => edge.data?.current).map(edge => edge.id)).toEqual(['review--publish']);
});

test('exclusion removes publication highlight and does not turn the final node active', () => {
  const id = doc('proposed');
  const decisionIndex = snapshot.events.findIndex(event => event.type === 'decision' && event.instance_id === `${id}:jev`);
  const events: Event[] = [...snapshot.events.slice(0, decisionIndex + 1), { ...snapshot.events[0], sequence: 999, type: 'node_completed', instance_id: `worker:${id}`, payload: { state: 'skipped', outcome: 'excluded' } }];
  const graph = buildLessonGraph({ run: snapshot.run, events, documentId: id, mode: 'compact' });
  expect(graph.nodes.find(node => node.id === 'review')?.data.title).toBe('Excluded');
  expect(graph.nodes.find(node => node.id === 'publish')?.data).toMatchObject({ onPath: false, dimmed: true, state: 'skipped', active: false });
});

test('the prepared human checkpoint never exposes script milliseconds as human performance', () => {
  const id = doc('proposed');
  const graph = buildLessonGraph({ run: snapshot.run, events: snapshot.events, documentId: id, mode: 'wide' });
  const review = graph.nodes.find(node => node.id === 'review')!;
  expect(review.data.state).toBe('succeeded');
  expect(review.data.detail).toBe('Simulated checkpoint');
  expect(review.data.metric).toBeUndefined();
  expect(graph.nodes.find(node => node.id === 'judge')?.data.metric).toBeUndefined();
  expect(graph.nodes.find(node => node.id === 'interpret')?.data.metric).toBeUndefined();
  expect(graph.nodes.find(node => node.id === 'publish')?.data).toMatchObject({ state: 'succeeded', title: 'Searchable', onPath: true });
  expect(graph.nodes.some(node => node.data.state === 'outside_preview')).toBe(false);
  expect(graph.edges.find(edge => edge.id === 'review--publish')?.data).toMatchObject({ traversed: true, label: 'Approved' });
});

test('cancellation during review cannot imply approval or publication', () => {
  const id = doc('proposed');
  const reviewIndex = snapshot.events.findIndex(event => event.type === 'review_requested');
  const events: Event[] = [...snapshot.events.slice(0, reviewIndex + 1), { ...snapshot.events[0], sequence: 999, type: 'run_completed', payload: { status: 'cancelled', result: null } }];
  const graph = buildLessonGraph({ run: snapshot.run, events, documentId: id, mode: 'wide' });
  expect(graph.nodes.find(node => node.id === 'review')?.data.state).toBe('cancelled');
  expect(graph.nodes.find(node => node.id === 'publish')?.data.state).not.toBe('succeeded');
  expect(graph.edges.find(edge => edge.id === 'review--publish')?.data?.traversed).toBe(false);
});

test('a recorded operational review still displays its real pause and pending publication', () => {
  const id = doc('proposed');
  const reviewIndex = snapshot.events.findIndex(event => event.type === 'review_requested');
  const graph = buildLessonGraph({ run: snapshot.run, events: snapshot.events.slice(0, reviewIndex + 1), documentId: id, mode: 'wide' });
  expect(graph.nodes.find(node => node.id === 'review')?.data.state).toBe('awaiting_review');
  expect(graph.nodes.find(node => node.id === 'review')?.ariaLabel).toContain('Paused');
  expect(graph.nodes.find(node => node.id === 'publish')?.data.state).toBe('queued');
  expect(graph.nodes.some(node => node.data.state === 'outside_preview')).toBe(false);
});

for (const example of ['clear', 'ambiguous', 'proposed'] as const) test(`${example} keeps exactly one document marker through every recorded lesson step`, () => {
  const id = doc(example);
  const steps = classificationPlaybackSteps(snapshot, id);
  const transfers: string[] = [];
  for (const current of steps) {
    const graph = buildLessonGraph({ run: snapshot.run, events: snapshot.events.slice(0, current.cursor), documentId: id, current, mode: 'wide' });
    const atNode = graph.nodes.filter(node => node.data.documentLabel);
    const inTransit = graph.edges.filter(edge => edge.data?.current && edge.data.packetKey);
    expect(atNode.length + inTransit.length, current.title).toBe(1);
    expect(graph.nodes.filter(node => node.data.active).length).toBe(atNode.length);
    if (inTransit.length) transfers.push(inTransit[0].id);
    if (atNode.length) expect(atNode[0].ariaLabel).toContain(atNode[0].data.documentLabel!);
  }
  expect(transfers.filter(id => id === 'judge--policy')).toHaveLength(1);
  expect(transfers.filter(id => id === `policy--${example === 'clear' ? 'accept' : 'interpret'}`)).toHaveLength(1);
});

test('document identity remains readable even when it is absent from the run request', () => {
  expect(classificationDocumentLabel([], 'missing')).toBe('01');
  expect(classificationDocumentLabel(undefined, 'missing')).toBe('01');
});

for (const example of ['clear', 'ambiguous', 'proposed'] as const) test(`${example} measured journey ends at the returned output and preserves all measurements`, () => {
  const strategy = mockLiveClassification(example).strategy;
  const original = structuredClone(strategy);
  const steps = classificationJourney(strategy);
  expect(steps).toHaveLength(5);
  expect(steps.at(-1)?.node).toBe(example === 'clear' ? 'accept' : 'interpret');
  expect(steps.some(step => step.node === 'review' || step.node === 'publish')).toBe(false);
  for (const step of steps) {
    const graph = buildLessonGraph({ run: snapshot.run, events: snapshot.events, documentId: doc(example), mode: 'wide', measurement: strategy, journey: { step, cycle: 0 } });
    expect(graph.nodes.filter(node => node.data.documentLabel).length + graph.edges.filter(edge => edge.data?.packetKey).length).toBe(1);
    expect(graph.nodes.filter(node => node.data.active).map(node => node.id)).toEqual(step.node ? [step.node] : []);
    expect(graph.nodes.filter(node => node.data.state === 'outside_preview').map(node => node.id)).toEqual(example === 'clear' ? ['publish'] : ['review', 'publish']);
  }
  expect(strategy).toEqual(original);
});

test('failure, incomplete evidence and a later failed attempt cannot create a successful journey', () => {
  const strategy = mockLiveClassification('ambiguous').strategy;
  expect(classificationJourney()).toEqual([]);
  expect(classificationJourney({ ...strategy, status: 'failed' })).toEqual([]);
  expect(classificationJourney({ ...strategy, judgment: null })).toEqual([]);
  expect(classificationJourney({ ...strategy, policy: null })).toEqual([]);
  expect(classificationJourney({ ...strategy, interpretation: null })).toEqual([]);
  expect(classificationJourney({ ...strategy, output_kind: 'unavailable' })).toEqual([]);
  expect(classificationJourney({ ...strategy, output_category: null })).toEqual([]);
  expect(classificationJourney({ ...strategy, components: [...strategy.components, { ...strategy.components.at(-1)!, status: 'failed' }] })).toEqual([]);
});

test('a single latency scale preserves proportions, with bounded reading time and no invented unknown measurement', () => {
  const timing = relativeMotionTiming([1000, 6000, 12000]);
  expect(timing(12000)).toBe(6000);
  expect(timing(6000)).toBe(3000);
  expect(timing(1000)).toBe(650);
  expect(timing(0)).toBe(650);
  expect(timing(null)).toBe(1100);
  expect(timing(NaN)).toBe(1100);
  expect(timing(Infinity)).toBe(1100);
  expect(timing(-1)).toBe(1100);
  const uncompressed = relativeMotionTiming([900, 2700]);
  expect(uncompressed(2700) / uncompressed(900)).toBe(3);
});

test('motion uses recorded service work, excludes queues and preserves the same scale for both model components', () => {
  const strategy = mockLiveClassification('ambiguous').strategy;
  strategy.components[0].provider!.elapsed_ms = 1500;
  strategy.components[0].queue_elapsed_ms = 50_000;
  strategy.components[0].elapsed_ms = 51_500;
  strategy.components[2].provider!.elapsed_ms = 4500;
  const steps = classificationJourney(strategy);
  expect(steps[1].duration).toBe(1500);
  expect(steps[3].duration).toBe(4500);
  expect(steps[3].duration / steps[1].duration).toBe(3);
  strategy.components[0].provider!.provider = 'fixture';
  const prepared = classificationJourney(strategy);
  expect(prepared[1].duration).toBe(1100);
  expect(prepared[1].detail).toContain('timing unavailable');
  expect(prepared[1].detail).not.toContain('1500');
});

test('recorded playback retains event prefixes and uses live latencies instead of fixture sleep intervals', () => {
  const id = doc('proposed');
  const prepared = classificationPlaybackSteps(snapshot, id);
  const raw = classificationReplaySteps(snapshot.events, id, !!snapshot.run.request.simulated_review);
  expect(prepared.map(step => step.cursor)).toEqual(raw.map(step => step.cursor));
  expect(prepared.find(step => step.target === `${id}:interpret`)?.duration).toBe(1100);
  const events = structuredClone(snapshot.events);
  for (const event of events) {
    if (event.type === 'decision' && event.instance_id === `${id}:interpret`) Object.assign((event.payload.signal as object), { provider: 'openai', elapsed_ms: 5000 });
    if (event.type === 'node_completed' && event.instance_id === `${id}:interpret`) event.payload.detail = JSON.stringify({ provider: 'openai', elapsed_ms: 5000 });
  }
  const timed = classificationPlaybackSteps({ ...snapshot, events }, id);
  expect(timed.find(step => step.target === `${id}:interpret`)?.duration).toBe(5000);
  expect(timed.map(step => step.cursor)).toEqual(prepared.map(step => step.cursor));
});
