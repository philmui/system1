import { discoveryTreeLinks, type DiscoveryTreeId } from './discoveryTree';

export type TreeBox = { left: number; top: number; width: number; height: number };
type Point = { x: number; y: number };
export type TreeRoute = { id: string; source: DiscoveryTreeId; target: DiscoveryTreeId; points: Point[]; cubic: boolean; path: string };

/** Exact DOM-relative paths. Normal handoffs occupy the gaps, scope exits use an outer corridor. */
export function discoveryTreeGeometry(cards: Partial<Record<DiscoveryTreeId, TreeBox>>, _width: number, vertical: boolean) {
  const paths: Record<string, string> = {}, tracks: Record<string, string> = {}, routes: TreeRoute[] = [];
  for (const [id, card] of Object.entries(cards)) {
    if (card) tracks[id] = vertical ? `M ${card.left + 17} ${card.top} V ${card.top + card.height}` : `M ${card.left} ${card.top + card.height - 21} H ${card.left + card.width}`;
  }
  for (const [source, target] of discoveryTreeLinks) {
    const a = cards[source], b = cards[target];
    if (!a || !b) continue;
    const start = { x: vertical ? a.left + 17 : a.left + a.width, y: vertical ? a.top + a.height : a.top + a.height - 21 };
    const end = { x: vertical ? b.left + 17 : b.left, y: vertical ? b.top : b.top + b.height - 21 };
    const scope = source === 'judgment' && target === 'sources';
    const middle = vertical ? (start.y + end.y) / 2 : (start.x + end.x) / 2;
    const inset = Math.min(24, (b.left - a.left - a.width) / 2);
    const exit = { x: a.left + a.width + inset, y: start.y }, entry = { x: b.left - inset, y: end.y };
    const verticalInset = Math.min(24, (end.y - start.y) / 2);
    const verticalExit = { x: start.x, y: start.y + verticalInset }, verticalEntry = { x: end.x, y: end.y - verticalInset };
    const corridor = (exit.x + entry.x) / 2;
    const sourceGap = Math.min(...Object.values(cards).flatMap(card => card && card.left >= a.left + a.width ? [card.left - a.left - a.width] : []));
    const targetGap = Math.min(...Object.values(cards).flatMap(card => card && card.left + card.width <= b.left ? [b.left - card.left - card.width] : []));
    const scopeExit = a.left + a.width + Math.min(24, sourceGap / 2), scopeEntry = b.left - Math.min(24, targetGap / 2);
    const points = scope ? vertical
      ? [start, { x: 17, y: start.y }, { x: 17, y: end.y - 24 }, { x: end.x, y: end.y - 24 }, end]
      : [start, { x: scopeExit, y: start.y }, { x: scopeExit, y: 8 }, { x: scopeEntry, y: 8 }, { x: scopeEntry, y: end.y }, end]
      : vertical ? [start, verticalExit, { x: start.x, y: middle }, { x: end.x, y: middle }, verticalEntry, end]
        : [start, exit, { x: corridor, y: start.y }, { x: corridor, y: end.y }, entry, end];
    const path = scope ? `M ${points.map(point => `${point.x} ${point.y}`).join(' L ')}`
      : vertical ? `M ${start.x} ${start.y} V ${verticalExit.y} C ${start.x} ${middle}, ${end.x} ${middle}, ${end.x} ${verticalEntry.y} V ${end.y}`
        : `M ${start.x} ${start.y} H ${exit.x} C ${corridor} ${start.y}, ${corridor} ${end.y}, ${entry.x} ${end.y} H ${end.x}`;
    const id = `${source}--${target}`;
    paths[id] = path; routes.push({ id, source, target, points, cubic: !scope, path });
  }
  return { paths, tracks, routes };
}

export function discoveryRoutePoint(route: TreeRoute, t: number): Point {
  if (route.cubic) {
    if (route.points.length === 6 && (t < .2 || t > .8)) {
      const [s, e] = t < .2 ? route.points.slice(0, 2) : route.points.slice(4);
      const fraction = t < .2 ? t / .2 : (t - .8) / .2;
      return { x: s.x + (e.x - s.x) * fraction, y: s.y + (e.y - s.y) * fraction };
    }
    if (route.points.length === 6) t = (t - .2) / .6;
    const [s, a, b, e] = route.points.length === 6 ? route.points.slice(1, 5) : route.points, u = 1 - t;
    return { x: u ** 3 * s.x + 3 * u ** 2 * t * a.x + 3 * u * t ** 2 * b.x + t ** 3 * e.x,
      y: u ** 3 * s.y + 3 * u ** 2 * t * a.y + 3 * u * t ** 2 * b.y + t ** 3 * e.y };
  }
  const lengths = route.points.slice(1).map((point, i) => Math.hypot(point.x - route.points[i].x, point.y - route.points[i].y));
  let distance = lengths.reduce((sum, value) => sum + value, 0) * t;
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const portion = lengths[i] ? distance / lengths[i] : 0, a = route.points[i], b = route.points[i + 1];
      return { x: a.x + (b.x - a.x) * portion, y: a.y + (b.y - a.y) * portion };
    }
    distance -= lengths[i];
  }
  return route.points.at(-1)!;
}
