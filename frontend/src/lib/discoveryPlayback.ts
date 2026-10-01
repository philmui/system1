import type { Event, RunSnapshot } from './api.generated';
import { executionReplayBeats } from './replay';
import { discoveryTimingAssumptions } from './discoveryTimingAssumptions';

export type DiscoveryWorkKind = 'code' | 'bounded' | 'frontier';
export type DiscoveryWorkTiming = { kind: DiscoveryWorkKind; ms: number | null; source: 'recorded' | 'assumed' | 'unavailable' };

const finiteMs = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const metadata = (event?: Event): Record<string, unknown> => {
  try { const value: unknown = JSON.parse(String(event?.payload.detail || '{}')); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; } catch { return {}; }
};
export function discoveryHasLiveResponses(snapshot: RunSnapshot) {
  return snapshot.events.some(event => {
    const provider = metadata(event).provider;
    const signal = event.payload.signal as Record<string, unknown> | undefined;
    return provider === 'jev' || provider === 'openai' || signal?.provider === 'jev' || signal?.provider === 'openai';
  });
}

export function discoveryWorkKind(instance: string, events: Event[]): DiscoveryWorkKind {
  if (instance === 'intent' || instance.endsWith(':screen') || instance.startsWith('support:claim-')) return 'bounded';
  if (instance === 'synthesize') return 'frontier';
  if (instance === 'plan') {
    const route = events.filter(event => event.type === 'decision' && event.instance_id === 'intent').at(-1)?.payload.selected_route;
    return route === 'find' ? 'code' : 'frontier';
  }
  return 'code';
}

/** These are teaching assumptions, never fixture sleeps or measured model times. */
export function discoveryWorkTiming(snapshot: RunSnapshot, instance: string, attempt = 1): DiscoveryWorkTiming {
  const start = snapshot.events.findIndex(event => event.instance_id === instance && event.attempt === attempt && event.type === 'node_started' && event.payload.state === 'running');
  const kind = discoveryWorkKind(instance, start < 0 ? snapshot.events : snapshot.events.slice(0, start + 1));
  const record = snapshot.events.filter(event => event.instance_id === instance && event.attempt === attempt && ['node_completed', 'node_failed'].includes(event.type)).at(-1);
  const signal = snapshot.events.filter(event => event.instance_id === instance && event.attempt === attempt && event.type === 'decision').at(-1)?.payload.signal;
  const meta = Object.keys(metadata(record)).length ? metadata(record) : signal && typeof signal === 'object' ? signal as Record<string, unknown> : {};
  const liveProvider = meta.provider === 'jev' || meta.provider === 'openai';
  const prepared = meta.provider === 'fixture' || snapshot.run.mode === 'test-fixture' && !liveProvider;
  if (prepared) return { kind, source: 'assumed', ms: kind === 'code' ? discoveryTimingAssumptions.code : kind === 'bounded' ? discoveryTimingAssumptions.bounded : instance === 'synthesize' ? discoveryTimingAssumptions.frontierDraft : discoveryTimingAssumptions.frontierPlan };
  const ms = liveProvider ? finiteMs(meta.elapsed_ms) : kind === 'code' || record?.type === 'node_failed' && meta.provider !== 'fixture' ? finiteMs(record?.payload.elapsed_ms) : null;
  return { kind, ms, source: ms === null ? 'unavailable' : 'recorded' };
}

/** One common linear clock for service work; small steps have a 160ms reading floor.
 * Handoffs are separate visible transfers. Queues and parallel work are not summed. */
export function discoveryPlaybackSteps(snapshot: RunSnapshot) {
  const service = (event: Event) => event.type === 'node_started' && event.payload.state === 'running' && !event.instance_id.startsWith('worker:') && !['join', 'support'].includes(event.instance_id);
  const starts = snapshot.events.filter(service);
  const timings = starts.map(event => discoveryWorkTiming(snapshot, event.instance_id, event.attempt));
  const maximum = Math.max(0, ...timings.flatMap(timing => timing.ms === null ? [] : [timing.ms]));
  const scale = maximum > 6000 ? 6000 / maximum : 1;
  return executionReplayBeats(snapshot.events).map(step => {
    const event = snapshot.events[step.cursor - 1];
    if (service(event)) {
      const timing = discoveryWorkTiming(snapshot, event.instance_id, event.attempt);
      return { ...step, duration: timing.ms === null ? 1100 : Math.max(160, timing.ms * scale) };
    }
    return { ...step, duration: event.type === 'edge_selected' ? 700 : event.type === 'decision' ? 650 : step.duration };
  });
}
