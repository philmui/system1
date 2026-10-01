import type { Event, RunSnapshot } from './api.generated';
import type { DiscoveryTreeId } from './discoveryTree';
import { discoveryWorkTiming, type DiscoveryWorkKind } from './discoveryPlayback';

export type ServiceWork = { ms: number | null; knownMs: number; count: number; source: 'recorded' | 'assumed' | 'mixed' | 'unavailable'; missing: number };
export type DiscoveryPhase = { kind: 'service' | 'checkpoint' | 'transfer'; node: DiscoveryTreeId; edge?: string; key: string; visit: number; timing: ServiceWork; endCursor: number };
export type DiscoveryJourneyStep = { cursor: number; duration: number; capability: DiscoveryPhase };
const emptyWork = (): ServiceWork => ({ ms: 0, knownMs: 0, count: 0, source: 'unavailable', missing: 0 });
const isService = (event: Event) => event.type === 'node_started' && event.payload.state === 'running' && !event.instance_id.startsWith('worker:') && !['join', 'support'].includes(event.instance_id);

/** Provider requests and local operations; queue/worker wrappers are not extra service calls. */
function workRecords(snapshot: RunSnapshot, start = 0, end = snapshot.events.length) {
  const seen = new Set<string>();
  return snapshot.events.slice(start, end).filter(event => {
    const key = `${event.instance_id}:${event.attempt}`;
    if (!isService(event) || seen.has(key)) return false;
    seen.add(key);
    return !snapshot.events.some(record => record.instance_id === event.instance_id && record.attempt === event.attempt && record.type === 'node_completed' && record.payload.state === 'skipped');
  }).map(event => discoveryWorkTiming(snapshot, event.instance_id, event.attempt));
}
function total(records: ReturnType<typeof workRecords>): ServiceWork {
  const known = records.filter(record => record.ms !== null), missing = records.length - known.length;
  const sources = new Set(known.map(record => record.source));
  const knownMs = known.reduce((sum, record) => sum + record.ms!, 0);
  return { ms: missing ? null : knownMs, knownMs, count: records.length, missing,
    source: !known.length ? 'unavailable' : sources.size > 1 ? 'mixed' : known[0].source };
}
export function discoveryServiceBreakdown(snapshot: RunSnapshot) {
  const records = workRecords(snapshot);
  const kinds: DiscoveryWorkKind[] = ['code', 'bounded', 'frontier'];
  const groups = Object.fromEntries(kinds.map(kind => [kind, total(records.filter(record => record.kind === kind))])) as Record<DiscoveryWorkKind, ServiceWork>;
  const all = total(records);
  return { groups, all, comparable: all.ms !== null && all.ms > 0 && all.source !== 'mixed' };
}

/** One visit per capability. Parallel incoming edges and internal checks stay in that visit.
 * Genuine later re-entry creates another numbered visit. Prefixes remain authoritative. */
export function discoveryJourneySteps(snapshot: RunSnapshot): DiscoveryJourneyStep[] {
  const steps: DiscoveryJourneyStep[] = [];
  const visits = new Map<DiscoveryTreeId, number>();
  let route: unknown, output: DiscoveryTreeId | undefined;
  let active: { node: DiscoveryTreeId; start: number; key: string; visit: number } | undefined;
  let expected: DiscoveryTreeId | undefined;
  const group = (id: string): DiscoveryTreeId | undefined => id === 'intent' ? 'judgment'
    : id === 'plan' ? route === 'find' ? 'code-plan' : route === 'plan' ? 'frontier-plan' : undefined
      : /:(retrieve|screen)$/.test(id) || id === 'join' ? 'evidence'
        : /^(synthesize|citations|support(:|$))/.test(id) && output === 'answer' ? 'answer' : id === 'done' ? output : undefined;
  const begin = (node: DiscoveryTreeId, index: number, event: Event) => {
    const visit = (visits.get(node) || 0) + 1;
    visits.set(node, visit); active = { node, start: index, key: `visit-${node}-${event.sequence}`, visit }; expected = undefined;
  };
  const finish = (end: number) => {
    if (!active) return;
    const timing = total(workRecords(snapshot, active.start, end));
    const phase = { node: active.node, key: active.key, visit: active.visit, timing, endCursor: end };
    if (timing.count) steps.push({ cursor: active.start + 1, duration: timing.ms === null ? 1400 : timing.ms, capability: { ...phase, kind: 'service' } });
    steps.push({ cursor: end, duration: 300, capability: { ...phase, kind: 'checkpoint' } });
    active = undefined;
  };
  for (const [index, event] of snapshot.events.entries()) {
    if (event.type === 'decision' && event.instance_id === 'intent') {
      route = event.payload.selected_route;
      // A policy-only re-evaluation is a real return, without an invented model call.
      if (active && active.node !== 'judgment') { finish(index); begin('judgment', index, event); }
    }
    if (event.type === 'edge_selected') {
      const source = group(String(event.payload.source_instance_id));
      if (event.payload.source_instance_id === 'join') output = event.payload.target_instance_id === 'synthesize' ? 'answer' : 'sources';
      if (event.payload.source_instance_id === 'intent' && event.payload.target_instance_id === 'done') output = 'sources';
      const target = group(String(event.payload.target_instance_id));
      if (source && target && source !== target && active?.node === source) {
        finish(index);
        expected = target;
        steps.push({ cursor: index + 1, duration: 700, capability: { kind: 'transfer', node: target, edge: `${source}--${target}`, key: `edge-${event.sequence}`, visit: (visits.get(target) || 0) + 1, timing: emptyWork(), endCursor: index + 1 } });
      }
      continue;
    }
    if (!['node_started', 'node_completed', 'node_failed'].includes(event.type) || event.payload.state === 'queued') continue;
    const node = group(event.instance_id);
    if (!node) continue;
    // Join and wrapper bookkeeping cannot begin a visit before its real work.
    if (!active && (expected === node || !expected && !visits.has(node))) {
      begin(node, index, event);
    } else if (active && active.node !== node && event.type === 'node_started' && isService(event) && !expected) {
      // A recorded retry or unusual exit remains inspectable instead of being erased.
      finish(index);
      begin(node, index, event);
    }
  }
  finish(snapshot.events.length);
  if (!steps.length && snapshot.events.length) steps.push({ cursor: snapshot.events.length, duration: 300, capability: { kind: 'checkpoint', node: 'judgment', key: 'recording-end', visit: 0, timing: emptyWork(), endCursor: snapshot.events.length } });
  const max = Math.max(0, ...steps.filter(step => step.capability.kind === 'service' && step.capability.timing.ms !== null).map(step => step.duration));
  const scale = max > 6000 ? 6000 / max : 1;
  return steps.map((step, index) => ({ ...step,
    duration: step.capability.kind === 'service' ? step.capability.timing.ms === null ? 1400 : Math.max(160, step.duration * scale) : step.duration,
    capability: step.capability.kind === 'transfer' ? { ...step.capability, endCursor: steps[index + 1]?.cursor ?? step.cursor } : step.capability,
  }));
}
