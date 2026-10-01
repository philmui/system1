import type { Event } from './api.generated';

export interface LiveModelTiming { id: string; label: string; attempt: number; elapsedMs: number | null; model: string; failed: boolean }

/** Real request metadata only. Fixture sleeps and animation holds are excluded. */
export function liveFrontierTimings(events: Event[]): LiveModelTiming[] {
  const timings = new Map<string, LiveModelTiming>();
  for (const event of events) {
    if (!['node_completed', 'node_failed'].includes(event.type)) continue;
    if (!['plan', 'synthesize'].includes(event.instance_id) && !event.instance_id.endsWith(':interpret')) continue;
    let metadata: Record<string, unknown> = {};
    try { metadata = JSON.parse(String(event.payload.detail || '{}')); } catch { /* Failed requests may have no response metadata. */ }
    const actual = metadata?.provider === 'openai';
    if (!actual && event.type !== 'node_failed') continue;
    const id = `${event.instance_id}:${event.attempt}`;
    timings.set(id, {
      id, label: event.instance_id === 'plan' ? 'Plan retrieval' : event.instance_id === 'synthesize' ? 'Compose comparison' : 'Interpret',
      attempt: event.attempt, failed: event.type === 'node_failed',
      elapsedMs: actual && typeof metadata.elapsed_ms === 'number' && Number.isFinite(metadata.elapsed_ms) && metadata.elapsed_ms >= 0 ? metadata.elapsed_ms : null,
      model: actual ? String(metadata.returned_model || metadata.configured_model || 'OpenAI') : 'Frontier model · no response',
    });
  }
  return [...timings.values()];
}
