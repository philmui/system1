import { expect, test } from '@playwright/test';
import type { Run } from '../src/lib/api.generated';
import type { Execution } from '../src/lib/events';
import { buildExecutionGraph } from '../src/components/ExecutionGraph';
import type { FlowNode } from '../src/components/FlowCanvas';

function port(node: FlowNode, handle: string) {
  const { x, y } = node.position; const w = node.width!, h = node.height!;
  const offsets: Record<string, [number, number]> = {
    out: [w, h / 2], in: [0, h / 2], 'out-high': [w, h / 4], 'out-low': [w, h * .75],
    'in-high': [0, h / 4], 'in-low': [0, h * .75], 'in-right': [w, h / 2],
    'out-left': [0, h / 2], 'out-left-low': [0, h * .75],
    bottom: [w / 2, h], 'in-bottom': [w / 2, h], top: [w / 2, 0], 'out-top': [w / 2, 0],
  };
  return { x: x + offsets[handle][0], y: y + offsets[handle][1] };
}

function graphBounds(nodes: FlowNode[]) {
  // Include annotation style dimensions, as the canvas fit calculation does.
  const left = Math.min(...nodes.map(node => node.position.x));
  const right = Math.max(...nodes.map(node => node.position.x + (node.width ?? Number(node.style?.width))));
  const top = Math.min(...nodes.map(node => node.position.y));
  const bottom = Math.max(...nodes.map(node => node.position.y + (node.height ?? Number(node.style?.height))));
  return { left, right, top, bottom, width: right - left };
}

for (const expanded of [false, true]) test(`Discovery ${expanded ? 'focused worker' : 'grouped'} portrait bounds include every node and caption`, () => {
  const run = { kind: 'discovery', request: {} } as Run;
  const execution: Execution = {
    instances: {
      'worker:task-1': { id: 'worker:task-1', node: 'retrieval_worker', label: 'Search access policies', taskId: 'task-1', state: 'running', attempt: 1 },
      'task-1:retrieve': { id: 'task-1:retrieve', parent: 'worker:task-1', node: 'retrieve', label: 'Retrieve', state: 'succeeded', attempt: 1 },
      'task-1:screen': { id: 'task-1:screen', parent: 'worker:task-1', node: 'screen', label: 'Screen', state: 'running', attempt: 1 },
    }, workers: ['worker:task-1'], decisions: {}, edges: [], status: 'running',
  };
  const input = { run, execution, expanded, focused: expanded ? 'worker:task-1' : '', selected: null, moving: false, speed: 1 };
  const desktop = buildExecutionGraph({ ...input, narrow: false });
  const portrait = buildExecutionGraph({ ...input, narrow: true });
  expect(desktop.nodes.filter(node => node.type === 'annotation').map(node => node.id)).toEqual(['request-caption', 'evidence-caption', 'answer-caption']);
  expect(graphBounds(desktop.nodes).right).toBeGreaterThan(1000);
  const componentBounds = graphBounds(portrait.nodes.filter(node => node.type === 'component'));
  const allBounds = graphBounds(portrait.nodes);
  expect(allBounds.left).toBeGreaterThanOrEqual(componentBounds.left);
  expect(allBounds.right).toBeLessThanOrEqual(componentBounds.right);
  expect(allBounds.width).toBeLessThan(500);
  expect(allBounds.bottom - allBounds.top).toBeGreaterThan(allBounds.width);
  expect(portrait.nodes.filter(node => node.type === 'component').map(node => node.id)).toEqual(desktop.nodes.filter(node => node.type === 'component').map(node => node.id));
});
for (const kind of ['classification', 'discovery'] as const) for (const narrow of [false, true]) for (const expanded of [false, true]) {
  test(`${kind} ${narrow ? 'vertical' : 'horizontal'} ${expanded ? 'expanded' : 'grouped'} live graph keeps connections outside unrelated work`, () => {
    const run = { kind, request: { document_ids: ['document'] } } as unknown as Run;
    const execution: Execution = { instances: {}, workers: ['worker:document'], decisions: {}, edges: [], status: 'running' };
    const { nodes, edges } = buildExecutionGraph({ run, execution, narrow, expanded, focused: expanded ? 'worker:document' : '', selected: null, moving: false, speed: 1 });
    expect(nodes.filter(node => node.type === 'component').length).toBeGreaterThan(5);
    expect(edges.length).toBeGreaterThan(5);
    for (const edge of edges) {
      expect(edge.data?.traversed).toBe(false);
      expect(edge.data?.moving).toBe(false);
      const source = nodes.find(node => node.id === edge.source)!, target = nodes.find(node => node.id === edge.target)!;
      expect(source).toBeDefined(); expect(target).toBeDefined();
      expect(edge.data?.waypoints, `${edge.id} needs an explicit collision-checkable route`).toBeDefined();
      const points = [port(source, edge.sourceHandle!), ...edge.data!.waypoints!, port(target, edge.targetHandle!)];
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        expect(a.x === b.x || a.y === b.y, `${edge.id} has a diagonal segment`).toBe(true);
        for (const node of nodes.filter(node => node.type === 'component' && ![edge.source, edge.target].includes(node.id))) {
          const { x, y } = node.position;
          const hit = a.x === b.x
            ? a.x > x - 12 && a.x < x + node.width! + 12 && Math.max(a.y, b.y) > y - 14 && Math.min(a.y, b.y) < y + node.height! + 14
            : a.y > y - 14 && a.y < y + node.height! + 14 && Math.max(a.x, b.x) > x - 12 && Math.min(a.x, b.x) < x + node.width! + 12;
          expect(hit, `${edge.id} crosses ${node.id}`).toBe(false);
        }
      }
    }
  });
}
