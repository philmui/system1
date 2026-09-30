import { expect, test } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { examplePages, exampleRoute, type Answer, type ExamplePage } from '../src/lib/reviewExample';
import { buildReviewTrace, defaultScenario, nextTraceStep, traceSnapshot, validateScenario, type Strategy } from '../src/lib/workflowComparison';
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
    // Visual holds are compressed; modeled work and costs still use the full assumptions.
    expect(traces.every(trace => trace.steps.filter(step => step.kind === 'node' && Number.isFinite(step.end) && step.id !== 'attorney').every(step => step.end - step.start <= .950001))).toBe(true);
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
  expect(traceSnapshot(traces[1], traces[1].reviewAt!).current.id).toBe('attorney');
  expect(traceSnapshot(traces[1], traces[1].reviewAt! + .29).current.id).toBe('attorney');
  expect(traceSnapshot(traces[1], traces[1].end).result).toBe('produce');
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

test('native speed slider exposes .1–4 bounds, fractional steps and 1x default', () => {
  const html = renderToStaticMarkup(createElement(PlaybackSpeed, { value: 1, onChange: () => {} }));
  expect(html).toContain('type="range"'); expect(html).toContain('min="0.1"'); expect(html).toContain('max="4"');
  expect(html).toContain('step="0.1"'); expect(html).toContain('value="1"'); expect(html).toContain('1.0×');
  expect(displayName('Jev classification / LangGraph checkpoint')).toBe('System 1 Model classification / AgentGraph checkpoint');
});
