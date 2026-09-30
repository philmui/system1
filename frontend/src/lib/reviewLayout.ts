import type { ReviewEdgeId, ReviewNodeId } from './workflowComparison';

export interface Point { x: number; y: number }
export interface DiagramNode { id: ReviewNodeId; x: number; y: number; width: number; height: number }
export interface DiagramEdge { id: ReviewEdgeId; source: ReviewNodeId; target: ReviewNodeId; points: Point[] }
const node = (id: ReviewNodeId, x: number, y: number, width: number, height: number): DiagramNode => ({ id, x, y, width, height });
const edge = (id: ReviewEdgeId, points: [number, number][]): DiagramEdge => {
  const [source, target] = id.split('-') as [ReviewNodeId, ReviewNodeId];
  return { id, source, target, points: points.map(([x, y]) => ({ x, y })) };
};

/** Dedicated corridors keep all branches separate, including the human-to-redaction return. */
export function reviewLayout(narrow: boolean) {
  if (narrow) return {
    width: 448, height: 838,
    nodes: [
      node('input', 121, 12, 194, 72), node('agent', 87, 134, 262, 202),
      node('aside', 28, 405, 154, 66), node('redact', 252, 405, 168, 76),
      node('attorney', 252, 555, 168, 76), node('produce', 28, 710, 154, 76),
      node('withheld', 252, 710, 168, 76),
    ],
    edges: [
      edge('input-agent', [[218, 84], [218, 134]]),
      edge('agent-aside', [[105, 336], [105, 405]]),
      edge('agent-redact', [[324, 336], [324, 405]]),
      edge('agent-produce', [[87, 235], [4, 235], [4, 748], [28, 748]]),
      edge('agent-attorney', [[349, 235], [444, 235], [444, 593], [420, 593]]),
      edge('redact-produce', [[286, 481], [286, 511], [208, 511], [208, 729], [182, 729]]),
      edge('attorney-produce', [[252, 612], [230, 612], [230, 767], [182, 767]]),
      edge('attorney-withheld', [[336, 631], [336, 710]]),
      // Drawn only after a human releases a page that still needs PII redaction.
      edge('attorney-redact', [[336, 555], [336, 481]]),
    ],
  };
  return {
    width: 1204, height: 342,
    nodes: [
      node('input', 16, 120, 132, 72), node('agent', 212, 54, 262, 202),
      node('aside', 572, 0, 154, 60), node('redact', 700, 62, 182, 72),
      node('attorney', 700, 226, 182, 72), node('produce', 1002, 120, 166, 72),
      node('withheld', 1002, 232, 166, 66),
    ],
    edges: [
      edge('input-agent', [[148, 156], [212, 156]]),
      edge('agent-aside', [[474, 92], [524, 92], [524, 30], [572, 30]]),
      edge('agent-redact', [[474, 124], [552, 124], [552, 98], [700, 98]]),
      edge('agent-produce', [[474, 156], [1002, 156]]),
      edge('agent-attorney', [[474, 198], [576, 198], [576, 262], [700, 262]]),
      edge('redact-produce', [[882, 98], [934, 98], [934, 138], [1002, 138]]),
      edge('attorney-produce', [[882, 244], [954, 244], [954, 174], [1002, 174]]),
      edge('attorney-withheld', [[882, 276], [1002, 276]]),
      edge('attorney-redact', [[791, 298], [791, 326], [1192, 326], [1192, 30], [791, 30], [791, 62]]),
    ],
  };
}

/** One geometry definition drives drawing, packet placement and collision checks. */
export function roundedRoute(points: Point[], radius = 10) {
  let path = `M ${points[0].x} ${points[0].y}`;
  const samples: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const beforeLength = Math.hypot(b.x - a.x, b.y - a.y), afterLength = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(radius, beforeLength / 2, afterLength / 2);
    const before = { x: b.x - (b.x - a.x) / beforeLength * r, y: b.y - (b.y - a.y) / beforeLength * r };
    const after = { x: b.x + (c.x - b.x) / afterLength * r, y: b.y + (c.y - b.y) / afterLength * r };
    path += ` L ${before.x} ${before.y} Q ${b.x} ${b.y} ${after.x} ${after.y}`;
    samples.push(before);
    for (let step = 1; step <= 10; step++) {
      const t = step / 10, u = 1 - t;
      samples.push({ x: u * u * before.x + 2 * u * t * b.x + t * t * after.x, y: u * u * before.y + 2 * u * t * b.y + t * t * after.y });
    }
  }
  const end = points.at(-1)!;
  samples.push(end);
  return { path: `${path} L ${end.x} ${end.y}`, samples };
}

export function pointOnRoute(points: Point[], progress: number): Point {
  const distances = points.slice(1).map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y));
  let remaining = distances.reduce((sum, value) => sum + value, 0) * Math.max(0, Math.min(1, progress));
  for (let i = 0; i < distances.length; i++) {
    if (remaining <= distances[i]) {
      const fraction = distances[i] ? remaining / distances[i] : 0;
      return { x: points[i].x + (points[i + 1].x - points[i].x) * fraction, y: points[i].y + (points[i + 1].y - points[i].y) * fraction };
    }
    remaining -= distances[i];
  }
  return points.at(-1)!;
}
