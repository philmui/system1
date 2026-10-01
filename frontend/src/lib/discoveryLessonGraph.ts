import { buildExecutionGraph, type ExecutionGraphInput } from '../components/ExecutionGraph';
import type { FlowNode, FlowRoute, RouteData } from '../components/FlowCanvas';

type Point = { x: number; y: number };
type Step = 'intent' | 'plan' | 'retrieve' | 'screen' | 'join' | 'synthesize' | 'citations' | 'support' | 'done';
type RouteLayout = Pick<FlowRoute, 'sourceHandle' | 'targetHandle'> & Pick<RouteData, 'waypoints' | 'labelPosition'>;

const width = 224, height = 100;
const positions: Record<Step, Point> = {
  intent: { x: 0, y: 0 }, plan: { x: 290, y: 0 }, retrieve: { x: 580, y: 0 },
  synthesize: { x: 0, y: 156 }, join: { x: 290, y: 156 }, screen: { x: 580, y: 156 },
  citations: { x: 0, y: 312 }, support: { x: 290, y: 312 }, done: { x: 580, y: 312 },
};

function stepFor(id: string): Step | undefined {
  if (id.endsWith(':retrieve')) return 'retrieve';
  if (id.endsWith(':screen')) return 'screen';
  return Object.hasOwn(positions, id) ? id as Step : undefined;
}

function same(a: Point, b: Point) { return a.x === b.x && a.y === b.y; }
function clean(points: Point[]) {
  return points.filter((point, index) => !index || !same(point, points[index - 1]));
}
function port(node: FlowNode, handle: string): Point {
  const { x, y } = node.position;
  if (handle === 'out' || handle === 'in-right') return { x: x + width, y: y + height / 2 };
  if (handle === 'out-left' || handle === 'in') return { x, y: y + height / 2 };
  if (handle === 'bottom' || handle === 'in-bottom') return { x: x + width / 2, y: y + height };
  return { x: x + width / 2, y };
}
function outside(node: FlowNode, handle: string): Point {
  const point = port(node, handle);
  if (handle === 'out' || handle === 'in-right') return { ...point, x: point.x + 28 };
  if (handle === 'out-left' || handle === 'in') return { ...point, x: point.x - 28 };
  return { ...point, y: point.y + (handle === 'bottom' || handle === 'in-bottom' ? 28 : -28) };
}

/** Keep an unexpected recorded handoff instead of dropping it or drawing through work. */
function additionalRoute(source: FlowNode, target: FlowNode, nodes: FlowNode[]): RouteLayout {
  let best: { points: Point[]; sourceHandle: string; targetHandle: string; score: number } | undefined;
  for (const sourceHandle of ['out', 'bottom', 'out-left', 'out-top']) {
    for (const targetHandle of ['in', 'top', 'in-right', 'in-bottom']) {
      const a = outside(source, sourceHandle), b = outside(target, targetHandle);
      const candidates = [
        [a, { x: b.x, y: a.y }, b], [a, { x: a.x, y: b.y }, b],
        ...[-32, 257, 547, 836].map(x => [a, { x, y: a.y }, { x, y: b.y }, b]),
        ...[-32, 128, 284, 444].map(y => [a, { x: a.x, y }, { x: b.x, y }, b]),
      ];
      for (const candidate of candidates) {
        const points = clean([port(source, sourceHandle), ...candidate, port(target, targetHandle)]);
        const blocked = points.slice(1).some((b, index) => {
          const a = points[index];
          return nodes.some(node => {
            if ((index === 0 && node.id === source.id) || (index === points.length - 2 && node.id === target.id)) return false;
            const { x, y } = node.position;
            return a.x === b.x
              ? a.x > x - 12 && a.x < x + width + 12 && Math.max(a.y, b.y) > y - 14 && Math.min(a.y, b.y) < y + height + 14
              : a.y > y - 14 && a.y < y + height + 14 && Math.max(a.x, b.x) > x - 12 && Math.min(a.x, b.x) < x + width + 12;
          });
        });
        if (blocked) continue;
        const distance = points.slice(1).reduce((total, point, index) => total + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);
        const score = distance + points.length * 8;
        if (!best || score < best.score) best = { points, sourceHandle, targetHandle, score };
      }
    }
  }
  // All pairs in this fixed, spaced grid have an unobstructed corridor. Falling
  // back to the original graph is safer than hiding a new, unsupported layout.
  if (!best) throw new Error('No unobstructed Discovery lesson handoff');
  const segments = best.points.slice(1).map((point, index) => ({
    start: best!.points[index], end: point,
    length: Math.abs(point.x - best!.points[index].x) + Math.abs(point.y - best!.points[index].y),
  }));
  const longest = segments.reduce((a, b) => a.length >= b.length ? a : b);
  return {
    sourceHandle: best.sourceHandle, targetHandle: best.targetHandle, waypoints: best.points.slice(1, -1),
    labelPosition: { x: (longest.start.x + longest.end.x) / 2, y: (longest.start.y + longest.end.y) / 2 - 14 },
  };
}

function layoutRoute(source: FlowNode, target: FlowNode, nodes: FlowNode[]): RouteLayout {
  const from = stepFor(source.id), to = stepFor(target.id);
  const a = source.position, b = target.position;
  if (from === 'join' && to === 'done') return {
    sourceHandle: 'bottom', targetHandle: 'top',
    waypoints: [{ x: a.x + width / 2, y: 284 }, { x: b.x + width / 2, y: 284 }],
    labelPosition: { x: 547, y: 273 },
  };
  if (from === 'intent' && to === 'done') return {
    sourceHandle: 'out-top', targetHandle: 'in-right',
    waypoints: [{ x: 112, y: -32 }, { x: 836, y: -32 }, { x: 836, y: 362 }],
    labelPosition: { x: 547, y: -44 },
  };
  if (from === 'retrieve' && to === 'join') return {
    sourceHandle: 'bottom', targetHandle: 'top',
    waypoints: [{ x: 692, y: 128 }, { x: 402, y: 128 }],
    labelPosition: { x: 626, y: 128 },
  };
  if (from === 'plan' && to === 'join') return {
    sourceHandle: 'bottom', targetHandle: 'top', waypoints: [],
    labelPosition: { x: 402, y: 128 },
  };
  if (a.y === b.y && Math.abs(a.x - b.x) === 290) return {
    sourceHandle: a.x < b.x ? 'out' : 'out-left', targetHandle: a.x < b.x ? 'in' : 'in-right', waypoints: [],
    // The 66 px connector gap cannot contain an enlarged "Supported" label.
    // Put branch labels in the clear row corridor, above both endpoint cards.
    labelPosition: { x: (Math.min(a.x, b.x) + width + Math.max(a.x, b.x)) / 2, y: a.y - 14 },
  };
  if (a.x === b.x && b.y - a.y === 156) return {
    sourceHandle: 'bottom', targetHandle: 'top', waypoints: [],
    labelPosition: { x: a.x + width / 2 + 44, y: (a.y + height + b.y) / 2 },
  };
  return additionalRoute(source, target, nodes);
}

/** React Flow fits nodes, not edge labels or outer failure routes. */
function includeRouteBounds(nodes: FlowNode[], edges: FlowRoute[]): FlowNode[] {
  const left = Math.min(...nodes.map(node => node.position.x));
  const top = Math.min(...nodes.map(node => node.position.y));
  const right = Math.max(...nodes.map(node => node.position.x + node.width!));
  const bottom = Math.max(...nodes.map(node => node.position.y + node.height!));
  let minX = left, minY = top, maxX = right, maxY = bottom;
  const include = (point: Point, halfWidth: number, halfHeight: number) => {
    minX = Math.min(minX, point.x - halfWidth); maxX = Math.max(maxX, point.x + halfWidth);
    minY = Math.min(minY, point.y - halfHeight); maxY = Math.max(maxY, point.y + halfHeight);
  };
  for (const edge of edges) {
    const source = nodes.find(node => node.id === edge.source)!;
    const target = nodes.find(node => node.id === edge.target)!;
    const points = [port(source, edge.sourceHandle!), ...edge.data!.waypoints!, port(target, edge.targetHandle!)];
    points.forEach(point => include(point, 12, 12));
    if (edge.data?.label && edge.data.labelPosition) {
      // A conservative em per character accommodates the 17 px desktop labels,
      // their padding and font substitution without using browser measurement.
      include(edge.data.labelPosition, (edge.data.label.length * 17 + 10) / 2 + 8, 20);
    }
  }
  if (minX === left && minY === top && maxX === right && maxY === bottom) return nodes;
  const boundsWidth = maxX - minX, boundsHeight = maxY - minY;
  return [...nodes, {
    id: '__discovery-lesson-route-bounds', type: 'annotation', position: { x: minX, y: minY },
    data: { title: '', role: 'muted' }, width: boundsWidth, height: boundsHeight,
    initialWidth: boundsWidth, initialHeight: boundsHeight, measured: { width: boundsWidth, height: boundsHeight },
    style: { width: boundsWidth, height: boundsHeight, opacity: 0, pointerEvents: 'none' },
    selectable: false, focusable: false, draggable: false, domAttributes: { 'aria-hidden': true },
  }];
}

/** Layout only: the execution builder owns states, role selection, calls and motion. */
export function buildDiscoveryLessonGraph(input: ExecutionGraphInput): ReturnType<typeof buildExecutionGraph> {
  const graph = buildExecutionGraph(input);
  if (input.narrow || input.run.kind !== 'discovery') return graph;
  const components = graph.nodes.filter(node => node.type === 'component');
  if (components.some(node => !stepFor(node.id))) return graph;
  const nodes = components.map(node => ({
    ...node, position: { ...positions[stepFor(node.id)!] }, width, height,
    initialWidth: width, initialHeight: height, measured: { width, height },
    style: { ...node.style, width, height },
  }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  try {
    const edges = graph.edges.map(edge => {
      const layout = layoutRoute(byId.get(edge.source)!, byId.get(edge.target)!, nodes);
      return {
        ...edge, sourceHandle: layout.sourceHandle, targetHandle: layout.targetHandle,
        data: {
          ...edge.data!, waypoints: layout.waypoints, labelPosition: layout.labelPosition, curveControls: undefined,
          label: edge.data?.label === 'Complex request' ? 'Complex' : edge.data?.label,
        },
      };
    });
    return { ...graph, nodes: includeRouteBounds(nodes, edges), edges };
  } catch {
    return graph;
  }
}
