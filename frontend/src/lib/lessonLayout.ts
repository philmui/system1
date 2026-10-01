/** Deliberate ports and bounded curves; no automatic endpoint doglegs. */
export type LessonNodeId = 'judge' | 'policy' | 'accept' | 'interpret' | 'review' | 'publish';
export type LessonLayoutMode = 'wide' | 'compact' | 'narrow';
export interface LessonPoint { x: number; y: number }
export interface LessonBox extends LessonPoint { width: number; height: number }
export interface LessonConnection {
  source: LessonNodeId; target: LessonNodeId;
  sourceHandle: string; targetHandle: string;
  start: LessonPoint; end: LessonPoint;
  curveControls?: [LessonPoint, LessonPoint];
  labelPosition: LessonPoint;
}

export function lessonLayout(mode: LessonLayoutMode) {
  const wide = mode === 'wide', phone = mode === 'narrow';
  const width = phone ? 160 : 240, height = phone ? 188 : 166;
  const column = phone ? 248 : 384, row = phone ? 292 : 306;
  const positions: Record<LessonNodeId, [number, number]> = wide
    ? { judge: [0, 0], policy: [356, 0], accept: [712, 0], publish: [1068, 0], interpret: [356, 306], review: [712, 306] }
    : { judge: [0, 0], policy: [column, 0], accept: [0, row], interpret: [column, row], publish: [0, row * 2], review: [column, row * 2] };
  const boxes = Object.fromEntries(Object.entries(positions).map(([id, [x, y]]) => [id, { x, y, width, height }])) as Record<LessonNodeId, LessonBox>;
  const port = (id: LessonNodeId, handle: string): LessonPoint => {
    const box = boxes[id];
    if (handle === 'bottom' || handle === 'in-bottom') return { x: box.x + width / 2, y: box.y + height };
    if (handle === 'top' || handle === 'out-top') return { x: box.x + width / 2, y: box.y };
    if (handle === 'out' || handle === 'in-right') return { x: box.x + width, y: box.y + height / 2 };
    return { x: box.x, y: box.y + height / 2 };
  };
  const connect = (source: LessonNodeId, target: LessonNodeId, sourceHandle = 'out', targetHandle = 'in'): LessonConnection => {
    const start = port(source, sourceHandle), end = port(target, targetHandle);
    return { source, target, sourceHandle, targetHandle, start, end,
      labelPosition: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - (start.y === end.y ? 28 : 0) } };
  };
  const routes = wide ? [
    connect('judge', 'policy'), connect('policy', 'accept'), connect('policy', 'interpret', 'bottom', 'top'),
    connect('interpret', 'review'), connect('accept', 'publish'), connect('review', 'publish', 'out', 'in-bottom'),
  ] : [
    connect('judge', 'policy'), connect('policy', 'accept', 'bottom', 'top'), connect('policy', 'interpret', 'bottom', 'top'),
    connect('interpret', 'review', 'bottom', 'top'), connect('accept', 'publish', 'bottom', 'top'), connect('review', 'publish', 'out-left', 'in-right'),
  ];
  for (const route of routes) {
    const { start, end } = route;
    if (start.x !== end.x && start.y !== end.y) {
      // The sole bend stays inside the endpoint rectangle. Endpoint tangents
      // match their card ports, so no stub turns back on itself.
      route.curveControls = wide
        ? [{ x: end.x, y: start.y }, { x: end.x, y: start.y }]
        : [{ x: start.x, y: (start.y + end.y) / 2 }, { x: end.x, y: (start.y + end.y) / 2 }];
      route.labelPosition = wide ? { x: end.x + 4, y: start.y - 96 }
        : { x: width / 2 + 15, y: (start.y + end.y) / 2 };
    }
    if (wide && start.x === end.x) route.labelPosition.x += 91;
  }
  return { boxes, routes };
}

/** Samples the exact cubic used by FlowCanvas, for clearance/continuity checks. */
export function lessonRoutePoint(route: LessonConnection, t: number): LessonPoint {
  const { start, end, curveControls } = route;
  if (!curveControls) return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
  const [a, b] = curveControls, u = 1 - t;
  return { x: u ** 3 * start.x + 3 * u ** 2 * t * a.x + 3 * u * t ** 2 * b.x + t ** 3 * end.x,
    y: u ** 3 * start.y + 3 * u ** 2 * t * a.y + 3 * u * t ** 2 * b.y + t ** 3 * end.y };
}
