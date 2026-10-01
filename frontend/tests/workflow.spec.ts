import { expect, test } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { examplePages, exampleRoute, type Answer, type ExamplePage } from '../src/lib/reviewExample';
import { advanceReviewClock, buildReviewTrace, defaultScenario, nextTraceStep, reviewClockRate, reviewDecisionComparison, traceSnapshot, validateScenario, type Strategy } from '../src/lib/workflowComparison';
import { pointOnRoute, reviewLayout, roundedRoute, type Point } from '../src/lib/reviewLayout';
import { ReviewLane } from '../src/components/ReviewLane';
import { PlaybackSpeed } from '../src/components/PlaybackSpeed';
import { displayName } from '../src/lib/naming';
const strategies: Strategy[] = ['system1', 'frontier'];
const answers: Answer[] = ['yes', 'no', 'uncertain'];

test('three judgments are one request; only exceptions generate text', () => {
  for (const [pageIndex, expected] of [[0, [.4, .0001, 3.85, .006]], [2, [2.9, .0081, 6.35, .014]]] as const) {
    const traces = strategies.map(strategy => buildReviewTrace(examplePages[pageIndex], strategy, defaultScenario));
    const done = traces.map(trace => traceSnapshot(trace, trace.end));
    expect(done[0].machineSeconds).toBeCloseTo(expected[0]); expect(done[0].cost).toBeCloseTo(expected[1]);
    expect(done[1].machineSeconds).toBeCloseTo(expected[2]); expect(done[1].cost).toBeCloseTo(expected[3]);
    expect(done[0].systemCalls).toBe(1); expect(done[1].systemCalls).toBe(0);
    expect(done[0].frontierCalls).toBe(pageIndex === 2 ? 1 : 0); expect(done[1].frontierCalls).toBe(pageIndex === 2 ? 2 : 1);
    expect(done.every(snapshot => snapshot.result === 'produce')).toBe(true);
    // Presentation time is separate from the assumed service time above.
    expect(traces[0].end).toBeGreaterThan(expected[0]); expect(traces[1].end).toBeGreaterThan(expected[2]);
  }
});

test('all 27 answer combinations protect privilege, uncertainty and PII', () => {
  for (const responsive of answers) for (const pii of answers) for (const privileged of answers) {
    const page: ExamplePage = { ...examplePages[2], responsive, pii, privileged };
    const route = exampleRoute(page);
    if (privileged !== 'no') expect(route).toBe('attorney');
    else if (responsive === 'no') expect(route).toBe('aside');
    else if (responsive === 'uncertain' || pii === 'uncertain') expect(route).toBe('attorney');
    else expect(route).toBe(pii === 'yes' ? 'redact' : 'produce');
    for (const strategy of strategies) {
      const trace = buildReviewTrace(page, strategy, defaultScenario);
      if (route !== 'attorney') continue;
      const final = traceSnapshot(trace, trace.end + 100);
      expect(final.result).toBe('attorney'); expect(final.finished).toBe(false);
      const released = buildReviewTrace(page, strategy, defaultScenario, { at: trace.end + 2, outcome: 'release' });
      const release = traceSnapshot(released, released.end);
      expect(release.result).toBe('produce'); expect(release.redacted).toBe(pii !== 'no');
      const withheld = buildReviewTrace(page, strategy, defaultScenario, { at: trace.end + 2, outcome: 'withhold' });
      expect(traceSnapshot(withheld, withheld.end).result).toBe('withheld');
      expect(traceSnapshot(withheld, withheld.end).redacted).toBe(false);
    }
  }
});

test('a shared human verdict cannot bypass the slower lane checkpoint', () => {
  const pending = strategies.map(strategy => buildReviewTrace(examplePages[3], strategy, defaultScenario));
  const verdictAt = (pending[0].reviewAt! + pending[1].reviewAt!) / 2;
  const traces = strategies.map(strategy => buildReviewTrace(examplePages[3], strategy, defaultScenario, { at: verdictAt, outcome: 'release' }));
  expect(traces[0].reviewAt).toBeLessThan(verdictAt); expect(traces[1].reviewAt).toBeGreaterThan(verdictAt);
  expect(traceSnapshot(traces[0], verdictAt - .01).current.id).toBe('attorney');
  expect(traceSnapshot(traces[1], verdictAt).reachedNodes.has('attorney')).toBe(false);
  expect(traceSnapshot(traces[1], traces[1].reviewAt! - .001).reachedNodes.has('attorney')).toBe(false);
  expect(traceSnapshot(traces[1], traces[1].reviewAt!).reachedNodes.has('attorney')).toBe(true);
  expect(traceSnapshot(traces[1], traces[1].end).result).toBe('produce');
});

test('both models start together and preserve their decision-time ratio at every playback speed', () => {
  const traces = strategies.map(strategy => buildReviewTrace(examplePages[0], strategy, defaultScenario));
  const rate = reviewClockRate(defaultScenario);
  const work = traces.map(trace => trace.work.find(interval => interval.id === 'classify')!);
  expect(work[0].start).toBe(work[1].start);
  for (const speed of [.1, 1, 4]) {
    const systemWork = (work[0].end - work[0].start) / speed;
    const frontierWork = (work[1].end - work[1].start) / speed;
    expect(frontierWork / systemWork).toBeCloseTo(3.8 / .35);
    const now = advanceReviewClock(0, traces[0].end / speed + .001, speed, traces[1].end);
    expect(traceSnapshot(traces[0], now).finished).toBe(true);
    expect(traceSnapshot(traces[1], now).answersVisible).toBe(false);
    expect(traceSnapshot(traces[1], now).activeWork?.id).toBe('classify');
  }
  expect(work[0].end - work[0].start).toBeCloseTo(.35 / rate);
  expect(work[1].end - work[1].start).toBeCloseTo(3.8 / rate);
});

test('pause, speed changes and seeks preserve work, checkpoints and request-start accounting', () => {
  const traces = strategies.map(strategy => buildReviewTrace(examplePages[2], strategy, defaultScenario));
  const paused = advanceReviewClock(.2, 10, 4, traces[1].end, false);
  expect(paused).toBe(.2);
  const normal = advanceReviewClock(paused, .1, 1, traces[1].end);
  const faster = advanceReviewClock(normal, .1, 4, traces[1].end);
  expect(faster - normal).toBeCloseTo(4 * (normal - paused));
  const redaction = traces[0].work.find(interval => interval.id === 'redact')!;
  const duringDelivery = traceSnapshot(traces[0], redaction.end - .01);
  expect(duringDelivery.current.id).toBe('redact');
  expect(duringDelivery.redacted).toBe(false);
  expect(duringDelivery.frontierCalls).toBe(1);
  expect(duringDelivery.cost).toBe(defaultScenario.systemCost);
  expect(traceSnapshot(traces[0], redaction.end).redacted).toBe(true);
  expect(traceSnapshot(traces[0], redaction.end).frontierCalls).toBe(1);
  const rewind = traceSnapshot(traces[0], .1);
  expect(rewind.answersVisible).toBe(false); expect(rewind.cost).toBe(0);
});

test('every handoff stays readable, uses the same timing in both lanes and adds no machine latency', () => {
  for (const page of examplePages) for (const outcome of ['release', 'withhold'] as const) {
    const traces = strategies.map(strategy => buildReviewTrace(page, strategy, defaultScenario, { outcome, at: 15 }));
    const edges = traces.map(trace => trace.steps.filter(step => step.kind === 'edge'));
    expect(edges[0].map(step => step.id)).toEqual(edges[1].map(step => step.id));
    for (const [index, trace] of traces.entries()) for (const [position, edge] of edges[index].entries()) {
      const duration = edge.end - edge.start;
      expect(duration, edge.id).toBeGreaterThanOrEqual(.8 - 1e-9);
      expect(duration).toBeCloseTo(edges[1 - index][position].end - edges[1 - index][position].start);
      const start = traceSnapshot(trace, edge.start), middle = traceSnapshot(trace, (edge.start + edge.end) / 2);
      expect(middle.machineSeconds).toBeCloseTo(start.machineSeconds);
      expect(middle.cost).toBe(start.cost);
      expect(middle.activeWork).toBeUndefined();
      expect(middle.progress).toBeCloseTo(.5);
      expect(middle.finished).toBe(false);
    }
  }
});

test('the comparison names classification assumptions and never applies their ratio to redaction or custom scenarios', () => {
  expect(reviewDecisionComparison(defaultScenario)).toBe('Frontier takes 10.9× as long');
  expect(reviewDecisionComparison({ ...defaultScenario, systemSeconds: 3.8 })).toBe('Equal assumed decision time');
  const traces = strategies.map(strategy => buildReviewTrace(examplePages[2], strategy, defaultScenario));
  const redactions = traces.map(trace => trace.work.find(interval => interval.id === 'redact')!);
  expect(redactions[0].end - redactions[0].start).toBeCloseTo(redactions[1].end - redactions[1].start);
  const totals = traces.map(trace => traceSnapshot(trace, trace.end).machineSeconds);
  expect(totals[1] / totals[0]).toBeCloseTo(6.35 / 2.9);
  expect(totals[1] / totals[0]).toBeLessThan(3);
});

test('requests count when work starts while costs and results wait for completion', () => {
  for (const strategy of strategies) {
    const trace = buildReviewTrace(examplePages[2], strategy, defaultScenario);
    const ready = traceSnapshot(trace, 0);
    expect(ready.systemCalls + ready.frontierCalls).toBe(0);
    const classification = trace.work.find(interval => interval.id === 'classify')!;
    expect(traceSnapshot(trace, classification.start - .001).systemCalls + traceSnapshot(trace, classification.start - .001).frontierCalls).toBe(0);
    const pending = traceSnapshot(trace, classification.start);
    expect(pending.systemCalls + pending.frontierCalls).toBe(1);
    expect(pending.cost).toBe(0);
    expect(pending.answersVisible).toBe(false);
    const redact = trace.work.find(interval => interval.id === 'redact')!;
    const started = traceSnapshot(trace, redact.start);
    expect(started.systemCalls + started.frontierCalls).toBe(2);
    expect(started.redacted).toBe(false);
    expect(started.finished).toBe(false);
    expect(started.cost).toBe(strategy === 'system1' ? defaultScenario.systemCost : defaultScenario.frontierCost);
    expect(traceSnapshot(trace, 0).systemCalls + traceSnapshot(trace, 0).frontierCalls).toBe(0);
  }
});

test('long and reversed scenarios preserve the service ratio without manufacturing an advantage', () => {
  const scenario = { ...defaultScenario, systemSeconds: 30, frontierSeconds: .1, redactSeconds: 30 };
  const traces = strategies.map(strategy => buildReviewTrace(examplePages[2], strategy, scenario));
  const rate = reviewClockRate(scenario);
  expect(rate).toBeGreaterThan(1);
  expect(traceSnapshot(traces[0], traces[0].end).machineSeconds).toBeCloseTo(60.05);
  expect(traceSnapshot(traces[1], traces[1].end).machineSeconds).toBeCloseTo(30.15);
  const now = advanceReviewClock(0, traces[1].end + .001, 1, traces[0].end);
  expect(traceSnapshot(traces[1], now).finished).toBe(true);
  expect(traceSnapshot(traces[0], now).finished).toBe(false);
  const work = traces.map(trace => trace.work.find(interval => interval.id === 'classify')!);
  expect((work[0].end - work[0].start) / (work[1].end - work[1].start)).toBeCloseTo(300);
  expect(reviewDecisionComparison(scenario)).toBe('System 1 takes 300.0× as long');
});

test('human waiting changes wall time without adding machine work or automatic approval', () => {
  for (const strategy of strategies) {
    const pending = buildReviewTrace(examplePages[3], strategy, defaultScenario);
    const verdictAt = 12;
    const released = buildReviewTrace(examplePages[3], strategy, defaultScenario, { at: verdictAt, outcome: 'withhold' });
    const before = traceSnapshot(released, verdictAt - .01);
    expect(before.awaiting).toBe(true);
    expect(before.finished).toBe(false);
    expect(before.machineSeconds).toBeCloseTo(traceSnapshot(pending, pending.end).machineSeconds);
    expect(released.end).toBeGreaterThan(verdictAt);
    expect(traceSnapshot(released, verdictAt).result).toBeNull();
    expect(traceSnapshot(released, released.end).result).toBe('withheld');
  }
});

test('backward seek hides future answers, redaction, routes and charges', () => {
  for (const strategy of strategies) {
    const trace = buildReviewTrace(examplePages[2], strategy, defaultScenario);
    expect(traceSnapshot(trace, trace.end).redacted).toBe(true);
    const before = traceSnapshot(trace, trace.decisionAt - .001);
    expect(before.answersVisible).toBe(false); expect(before.cost).toBe(0); expect(before.redacted).toBe(false);
    expect([...before.visitedEdges]).toEqual(['input-agent']);
    const after = traceSnapshot(trace, trace.decisionAt);
    expect(after.answersVisible).toBe(true); expect(after.systemCalls + after.frontierCalls).toBe(1);
    const reset = traceSnapshot(trace, 0);
    expect(reset.answersVisible).toBe(false); expect(reset.visitedEdges.size).toBe(0); expect(reset.cost).toBe(0); expect(reset.result).toBeNull();
  }
});

test('step advances across both lanes without floating point stalls', () => {
  for (const page of examplePages) {
    const traces = strategies.map(strategy => buildReviewTrace(page, strategy, defaultScenario));
    const end = Math.max(...traces.map(trace => trace.end)); let time = 0; let count = 0;
    while (time < end && count < 40) { const next = nextTraceStep(traces, time); expect(next).toBeGreaterThan(time); time = next; count++; }
    expect(time).toBe(end); expect(count).toBeLessThan(40);
  }
});

test('invalid assumptions are rejected and reversed or free scenarios stay finite', () => {
  expect(validateScenario(defaultScenario)).toBe(true);
  expect(validateScenario({ ...defaultScenario, systemSeconds: NaN })).toBe(false);
  expect(validateScenario({ ...defaultScenario, frontierSeconds: -1 })).toBe(false);
  const scenario = { ...defaultScenario, systemSeconds: 8, frontierSeconds: .1, systemCost: 0, frontierCost: 0, redactCost: 0 };
  expect(validateScenario(scenario)).toBe(true);
  const results = strategies.map(strategy => { const trace = buildReviewTrace(examplePages[0], strategy, scenario); return traceSnapshot(trace, trace.end); });
  expect(results[0].machineSeconds).toBeGreaterThan(results[1].machineSeconds);
  expect(results.every(value => value.cost === 0 && Number.isFinite(value.machineSeconds))).toBe(true);
});

function pointInBox(point: Point, box: { x: number; y: number; width: number; height: number }, dx = 0, dy = 0) {
  return point.x > box.x - dx && point.x < box.x + box.width + dx && point.y > box.y - dy && point.y < box.y + box.height + dy;
}
for (const narrow of [false, true]) test(`${narrow ? 'vertical' : 'horizontal'} routes and moving papers clear unrelated nodes`, () => {
  const layout = reviewLayout(narrow);
  for (const route of layout.edges) {
    const rounded = roundedRoute(route.points);
    expect(pointOnRoute(rounded.samples, 0)).toEqual(route.points[0]);
    expect(pointOnRoute(rounded.samples, 1).x).toBeCloseTo(route.points.at(-1)!.x);
    expect(pointOnRoute(rounded.samples, 1).y).toBeCloseTo(route.points.at(-1)!.y);
    for (let sample = 0; sample <= 150; sample++) {
      const packet = pointOnRoute(rounded.samples, sample / 150);
      for (const node of layout.nodes.filter(node => node.id !== route.source && node.id !== route.target)) {
        expect(pointInBox(packet, node, 17, 20), `${route.id} paper covers ${node.id}`).toBe(false);
      }
      if (!narrow) for (const label of [{ x: 634, y: 62, width: 22, height: 14 }, { x: 605, y: 118, width: 30, height: 15 }, { x: 615, y: 222, width: 44, height: 15 }]) {
        expect(pointInBox(packet, label, 16, 18), `${route.id} paper covers a branch label`).toBe(false);
      }
    }
    for (const other of layout.edges.filter(other => other.id !== route.id)) {
      for (let i = 1; i < route.points.length; i++) for (let j = 1; j < other.points.length; j++) {
        let a = route.points[i - 1], b = route.points[i], c = other.points[j - 1], d = other.points[j];
        if (a.x !== b.x && c.x === d.x) [a, b, c, d] = [c, d, a, b];
        if (a.x !== b.x || c.y !== d.y) continue;
        const crossing = a.x > Math.min(c.x, d.x) && a.x < Math.max(c.x, d.x) && c.y > Math.min(a.y, b.y) && c.y < Math.max(a.y, b.y);
        expect(crossing, `${route.id} crosses ${other.id}`).toBe(false);
      }
    }
  }
});

test('rendered graph names work nodes and has no separate Route box or future highlights', () => {
  for (const strategy of strategies) {
    const trace = buildReviewTrace(examplePages[2], strategy, defaultScenario);
    const html = renderToStaticMarkup(createElement(ReviewLane, { page: examplePages[2], trace, time: 0, narrow: false, maxMachineSeconds: 10, onSelect: () => {} }));
    expect(html).toContain('AgentGraph'); expect(html).not.toMatch(/LangGraph|Jev/); expect(html).not.toContain('data-node="route"');
    expect(html).not.toContain('class="svg-answer is-known"'); expect(html).not.toContain('diagram-edge role-llm is-active');
    expect(html).toContain('data-node="input" data-state="active"'); expect(html).toContain('data-node="produce" data-state="available"'); expect(html).toContain(examplePages[2].id);
  }
});

test('review rivers follow only traversed routes, keep one current transfer, and freeze on pause without moving the document', () => {
  const page = examplePages[2];
  const trace = buildReviewTrace(page, 'system1', defaultScenario);
  const transfer = trace.steps.find(step => step.id === 'agent-redact')!;
  const time = (transfer.start + transfer.end) / 2;
  const snapshot = traceSnapshot(trace, time);
  const render = (moving: boolean, speed = 1) => renderToStaticMarkup(createElement(ReviewLane, {
    page, trace, time, narrow: false, maxMachineSeconds: 10, moving, speed, onSelect: () => {},
  }));
  const playing = render(true), paused = render(false), faster = render(true, 2);
  const expectedTrails = snapshot.visitedEdges.size + 1;
  expect((playing.match(/class="flow-trail /g) || [])).toHaveLength(expectedTrails);
  expect((playing.match(/is-active-transfer/g) || [])).toHaveLength(1);
  expect((playing.match(/is-route-history/g) || [])).toHaveLength(snapshot.visitedEdges.size);
  expect((playing.match(/data-flow-state="flowing"/g) || [])).toHaveLength(expectedTrails);
  expect((paused.match(/data-flow-state="paused"/g) || [])).toHaveLength(expectedTrails);
  expect(paused).not.toContain('data-flow-state="flowing"');
  for (const html of [playing, paused, faster]) {
    expect((html.match(/class="flow-paper"/g) || [])).toHaveLength(1);
    expect(html).toContain('markerUnits="userSpaceOnUse"');
  }
  const packetTransform = (html: string) => html.match(/data-packet="[^"]+" transform="([^"]+)"/)?.[1];
  expect(packetTransform(paused)).toBe(packetTransform(playing));
  expect(packetTransform(faster)).toBe(packetTransform(playing));
});

test('a completed review lane stays static while the other strategy continues', () => {
  const page = examplePages[0];
  const fast = buildReviewTrace(page, 'system1', defaultScenario);
  const slow = buildReviewTrace(page, 'frontier', defaultScenario);
  const time = fast.end;
  expect(traceSnapshot(fast, time).finished).toBe(true);
  expect(traceSnapshot(slow, time).finished).toBe(false);
  const html = renderToStaticMarkup(createElement(ReviewLane, {
    page, trace: fast, time, narrow: false, maxMachineSeconds: slow.end, moving: true, speed: 1, onSelect: () => {},
  }));
  expect((html.match(/class="flow-trail /g) || [])).toHaveLength(traceSnapshot(fast, time).visitedEdges.size);
  expect(html).toContain('data-flow-state="paused"');
  expect(html).not.toContain('data-flow-state="flowing"');
  expect(html).not.toContain('is-active-transfer');
  expect(html).not.toContain('class="flow-paper"');
});

test('human review freezes its arrived route until a recorded verdict selects a later branch', () => {
  const page = examplePages.find(item => exampleRoute(item) === 'attorney')!;
  const trace = buildReviewTrace(page, 'system1', defaultScenario);
  const render = (value = trace, time = trace.reviewAt!) => renderToStaticMarkup(createElement(ReviewLane, {
    page, trace: value, time, narrow: true, maxMachineSeconds: 10, moving: true, speed: 1, onSelect: () => {},
  }));
  const waiting = render();
  expect(traceSnapshot(trace, trace.reviewAt!).awaiting).toBe(true);
  expect((waiting.match(/class="flow-trail /g) || [])).toHaveLength(2);
  expect(waiting).toContain('data-flow-state="paused"');
  expect(waiting).not.toContain('data-flow-state="flowing"');
  expect(waiting).not.toContain('is-active-transfer');
  expect(waiting).not.toContain('class="flow-paper"');
  const withheld = buildReviewTrace(page, 'system1', defaultScenario, { outcome: 'withhold', at: trace.reviewAt! + 60 });
  const done = render(withheld, withheld.end);
  expect((done.match(/class="flow-trail /g) || [])).toHaveLength(3);
  expect(done).not.toContain('data-flow-state="flowing"');
  expect(done).toContain('Withheld by attorney');
});

test('native speed slider exposes .1–4 bounds, fractional steps and 1x default', () => {
  const html = renderToStaticMarkup(createElement(PlaybackSpeed, { value: 1, onChange: () => {} }));
  expect(html).toContain('type="range"'); expect(html).toContain('min="0.1"'); expect(html).toContain('max="4"');
  expect(html).toContain('step="0.1"'); expect(html).toContain('value="1"'); expect(html).toContain('1.0×');
  expect(displayName('Jev classification / LangGraph checkpoint')).toBe('System 1 Model classification / AgentGraph checkpoint');
});

test('visible provider descriptions use the capability name while technical identifiers stay exact', () => {
  expect(displayName('Live Jev + GPT-5.5; live jev signals. JEV returns a choice.'))
    .toBe('Live System 1 Model + GPT-5.5; live System 1 Model signals. System 1 Model returns a choice.');
  expect(displayName('Jev.')).toBe('System 1 Model.');
  for (const identifier of ['jev-1.13.0', 'doc:jev', 'jev_choice_threshold', 'providers/jev', 'jev.example']) expect(displayName(identifier)).toBe(identifier);
});
