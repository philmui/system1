import { expect, test } from '@playwright/test';
import type { LessonCatalogue, RunSnapshot } from '../src/lib/api.generated';
import { reduceEvents, type Execution } from '../src/lib/events';
import { buildDiscoveryLessonGraph } from '../src/lib/discoveryLessonGraph';
import { buildExecutionGraph, type ExecutionGraphInput } from '../src/components/ExecutionGraph';
import type { FlowNode, FlowRoute } from '../src/components/FlowCanvas';
import raw from '../src/data/lessons.json' with { type: 'json' };

const catalogue = raw as unknown as LessonCatalogue;
function input(snapshot: RunSnapshot, prefix = snapshot.events.length): ExecutionGraphInput {
  return {
    run: snapshot.run, execution: reduceEvents(snapshot.events.slice(0, prefix)),
    selected: null, focused: '', expanded: false, moving: true, speed: 1,
  };
}
function port(node: FlowNode, handle: string) {
  const { x, y } = node.position, width = node.width!, height = node.height!;
  const offsets: Record<string, [number, number]> = {
    out: [width, height / 2], in: [0, height / 2], 'in-right': [width, height / 2], 'out-left': [0, height / 2],
    bottom: [width / 2, height], top: [width / 2, 0], 'out-top': [width / 2, 0], 'in-bottom': [width / 2, height],
  };
  return { x: x + offsets[handle][0], y: y + offsets[handle][1] };
}
function expectUnobstructed(nodes: FlowNode[], edges: FlowRoute[]) {
  for (const edge of edges) {
    const source = nodes.find(node => node.id === edge.source)!, target = nodes.find(node => node.id === edge.target)!;
    expect(edge.data?.waypoints, edge.id).toBeDefined();
    const points = [port(source, edge.sourceHandle!), ...edge.data!.waypoints!, port(target, edge.targetHandle!)];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      expect(a.x === b.x || a.y === b.y, `${edge.id} diagonal`).toBe(true);
      for (const node of nodes.filter(node => node.type === 'component' && ![edge.source, edge.target].includes(node.id))) {
        const { x, y } = node.position;
        const hit = a.x === b.x
          ? a.x > x - 12 && a.x < x + node.width! + 12 && Math.max(a.y, b.y) > y - 14 && Math.min(a.y, b.y) < y + node.height! + 14
          : a.y > y - 14 && a.y < y + node.height! + 14 && Math.max(a.x, b.x) > x - 12 && Math.min(a.x, b.x) < x + node.width! + 12;
        expect(hit, `${edge.id} crosses ${node.id}`).toBe(false);
      }
    }
  }
}

for (const example of ['find', 'compare'] as const) {
  test(`${example} compact journey preserves every recorded prefix, including motion and unknown future work`, () => {
    const snapshot = catalogue.discovery[example];
    for (let cursor = 0; cursor <= snapshot.events.length; cursor++) {
      const value = input(snapshot, cursor), original = buildExecutionGraph(value), compact = buildDiscoveryLessonGraph(value);
      const components = compact.nodes.filter(node => node.type === 'component');
      expect(components).toHaveLength(9);
      expect(components.every(node => node.width === 224 && node.height === 100)).toBe(true);
      expect(compact.selections).toEqual(original.selections);
      for (const node of components) expect(node.data, `${cursor}: ${node.id}`).toEqual(original.nodes.find(other => other.id === node.id)!.data);
      expect(compact.edges.map(edge => edge.id)).toEqual(original.edges.map(edge => edge.id));
      for (const edge of compact.edges) {
        const originalData = original.edges.find(other => other.id === edge.id)!.data!;
        expect(edge.data, `${cursor}: ${edge.id}`).toMatchObject({
          ...originalData, waypoints: edge.data!.waypoints, labelPosition: edge.data!.labelPosition,
          label: originalData.label === 'Complex request' ? 'Complex' : originalData.label,
        });
      }
      // All provider responses in these recordings are prepared, not measured.
      expect(compact.nodes.every(node => !node.data.metric)).toBe(true);
      expectUnobstructed(compact.nodes, compact.edges);
    }
    const initial = buildDiscoveryLessonGraph(input(snapshot, 0));
    expect(initial.nodes.every(node => node.data.state === 'queued')).toBe(true);
    expect(initial.edges.every(edge => !edge.data?.traversed && !edge.data?.current && !edge.data?.moving)).toBe(true);
    expect(Math.max(...initial.nodes.map(node => node.position.x + node.width!))).toBe(804);
    expect(Math.max(...initial.nodes.map(node => node.position.y + node.height!))).toBe(412);
  });
}

test('the direct result path bypasses composition and validation; Compare visits those recorded steps', () => {
  const find = buildDiscoveryLessonGraph(input(catalogue.discovery.find));
  const compare = buildDiscoveryLessonGraph(input(catalogue.discovery.compare));
  expect(find.edges.find(edge => edge.id === 'join--done')?.data).toMatchObject({ label: 'Direct', traversed: true });
  expect(find.edges.find(edge => edge.id === 'join--synthesize')?.data).toMatchObject({ label: 'Complex', traversed: false });
  for (const id of ['synthesize', 'citations', 'support']) expect(find.nodes.find(node => node.id === id)?.data.state).toBe('skipped');
  expect(compare.edges.find(edge => edge.id === 'join--done')?.data?.traversed).toBe(false);
  expect(compare.edges.find(edge => edge.id === 'join--synthesize')?.data?.traversed).toBe(true);
  for (const id of ['synthesize', 'citations', 'support']) expect(compare.nodes.find(node => node.id === id)?.data.state).toBe('succeeded');
});

test('measured provider latency appears only after its completed event, while failed and prepared time stay unmeasured', () => {
  const snapshot = structuredClone(catalogue.discovery.compare);
  const index = snapshot.events.findIndex(event => event.instance_id === 'synthesize' && event.type === 'node_completed');
  const completion = snapshot.events[index];
  completion.payload.detail = JSON.stringify({ provider: 'openai', elapsed_ms: 1720, returned_model: 'actual-recorded-model' });
  const metric = (prefix: number) => buildDiscoveryLessonGraph(input(snapshot, prefix)).nodes.find(node => node.id === 'synthesize')!.data.metric;
  expect(metric(index)).toBeUndefined();
  expect(metric(index + 1)).toBe(buildExecutionGraph(input(snapshot, index + 1)).nodes.find(node => node.id === 'synthesize')!.data.metric);
  expect(metric(index + 1)).toBeTruthy();
  completion.type = 'node_failed';
  expect(metric(index + 1)).toBeUndefined();
});

test('focused retrieval workers retain their identity, inspection mapping, packet and collision-free layout', () => {
  const value = input(catalogue.discovery.compare);
  value.focused = value.execution.workers[0]; value.expanded = true;
  const edge = value.execution.edges.find(item => item.source_instance_id.endsWith(':retrieve'))!;
  const eventIndex = catalogue.discovery.compare.events.findIndex(event => event.sequence === edge.sequence);
  value.execution = reduceEvents(catalogue.discovery.compare.events.slice(0, eventIndex + 1));
  value.selected = edge.source_instance_id;
  const original = buildExecutionGraph(value), compact = buildDiscoveryLessonGraph(value);
  const selected = compact.nodes.find(node => node.id === edge.source_instance_id)!;
  expect(selected.position).toEqual({ x: 580, y: 0 });
  expect(selected.data.selected).toBe(true);
  expect(compact.selections).toEqual(original.selections);
  expect(compact.edges.find(item => item.data?.current)?.data?.packetKey).toBeTruthy();
  expectUnobstructed(compact.nodes, compact.edges);
});

test('recorded unsupported, empty-task and retrieval-issue exits keep visible labels and avoid unrelated nodes', () => {
  const value = input(catalogue.discovery.compare);
  value.execution.status = 'running';
  value.execution.edges = [
    { source_instance_id: 'intent', target_instance_id: 'done', label: 'Outside scope', sequence: 10 },
    { source_instance_id: 'plan', target_instance_id: 'join', label: 'No tasks', sequence: 11 },
    { source_instance_id: 'retrieve', target_instance_id: 'join', label: 'Retrieval issue', sequence: 12 },
  ];
  const compact = buildDiscoveryLessonGraph(value);
  for (const label of ['Outside scope', 'No tasks', 'Retrieval issue']) expect(compact.edges.find(edge => edge.data?.label === label)?.data?.traversed).toBe(true);
  expectUnobstructed(compact.nodes, compact.edges);
});

test('additional recorded handoffs are preserved even when they are outside the default successful route', () => {
  const value = input(catalogue.discovery.compare);
  const ids = ['intent', 'plan', 'retrieve', 'screen', 'join', 'synthesize', 'citations', 'support', 'done'];
  let sequence = 0;
  const edges: Execution['edges'] = ids.flatMap(source => ids.filter(target => source !== target).map(target => ({
    source_instance_id: source, target_instance_id: target, label: '', sequence: ++sequence,
  })));
  value.execution.edges = edges;
  const compact = buildDiscoveryLessonGraph(value);
  expect(compact.nodes.filter(node => node.type === 'component')).toHaveLength(9);
  expect(compact.nodes.filter(node => node.type === 'component').every(node => node.width === 224)).toBe(true);
  expect(compact.edges).toHaveLength(edges.length);
  expect(compact.edges.every(edge => edge.data?.traversed)).toBe(true);
  expectUnobstructed(compact.nodes, compact.edges);
});

test('narrow screens keep the existing readable vertical journey without rearrangement', () => {
  for (const example of ['find', 'compare'] as const) {
    const value = { ...input(catalogue.discovery[example]), narrow: true };
    expect(buildDiscoveryLessonGraph(value)).toEqual(buildExecutionGraph(value));
  }
});

test('enlarged labels occupy clear corridors and recorded outer routes are included in the fitted frame', () => {
  const value = input(catalogue.discovery.compare);
  value.execution.edges.push(
    { source_instance_id: 'intent', target_instance_id: 'done', label: 'Outside scope', sequence: 1000 },
    { source_instance_id: 'plan', target_instance_id: 'join', label: 'No tasks', sequence: 1001 },
    { source_instance_id: 'retrieve', target_instance_id: 'join', label: 'Retrieval issue', sequence: 1002 },
  );
  const graph = buildDiscoveryLessonGraph(value), components = graph.nodes.filter(node => node.type === 'component');
  const labels = graph.edges.filter(edge => edge.data?.label).map(edge => {
    const { x, y } = edge.data!.labelPosition!;
    // Conservative 17 px glyph width plus padding; this checks geometric room,
    // not a claim that browser fonts or visual appearance were inspected.
    const width = edge.data!.label!.length * 17 + 10;
    return { id: edge.id, left: x - width / 2, top: y - 12, right: x + width / 2, bottom: y + 12 };
  });
  const overlap = (a: { left: number; top: number; right: number; bottom: number }, b: typeof a) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  for (const label of labels) {
    for (const node of components) expect(overlap(label, {
      left: node.position.x, top: node.position.y, right: node.position.x + node.width!, bottom: node.position.y + node.height!,
    }), `${label.id} label overlaps ${node.id}`).toBe(false);
    for (const other of labels.filter(other => label.id !== other.id)) expect(overlap(label, other), `${label.id} label overlaps ${other.id}`).toBe(false);
  }
  const fit = {
    left: Math.min(...graph.nodes.map(node => node.position.x)), top: Math.min(...graph.nodes.map(node => node.position.y)),
    right: Math.max(...graph.nodes.map(node => node.position.x + node.width!)), bottom: Math.max(...graph.nodes.map(node => node.position.y + node.height!)),
  };
  for (const label of labels) {
    expect(label.left).toBeGreaterThanOrEqual(fit.left); expect(label.top).toBeGreaterThanOrEqual(fit.top);
    expect(label.right).toBeLessThanOrEqual(fit.right); expect(label.bottom).toBeLessThanOrEqual(fit.bottom);
  }
  for (const edge of graph.edges) for (const point of edge.data!.waypoints!) {
    expect(point.x - 12).toBeGreaterThanOrEqual(fit.left); expect(point.y - 12).toBeGreaterThanOrEqual(fit.top);
    expect(point.x + 12).toBeLessThanOrEqual(fit.right); expect(point.y + 12).toBeLessThanOrEqual(fit.bottom);
  }
  const anchors = graph.nodes.filter(node => node.type === 'annotation');
  expect(anchors).toHaveLength(1);
  expect(anchors[0]).toMatchObject({ data: { title: '' }, selectable: false, focusable: false, draggable: false,
    style: { opacity: 0, pointerEvents: 'none' }, domAttributes: { 'aria-hidden': true } });
  expect(buildDiscoveryLessonGraph(input(catalogue.discovery.compare)).nodes.every(node => node.type === 'component')).toBe(true);
});
