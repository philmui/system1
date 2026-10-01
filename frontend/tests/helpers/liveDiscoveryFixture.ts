import type { LessonCatalogue, LiveDiscoveryResponse } from '../../src/lib/api.generated';
import type { FrontierModel } from '../../src/lib/frontierModels';
import raw from '../../src/data/lessons.json' with { type: 'json' };

/** Browser mocks only; no external provider is called or benchmarked. */
export function mockLiveDiscovery(task: 'find' | 'compare' = 'compare', model: FrontierModel = 'gpt-5.5'): LiveDiscoveryResponse {
  const catalogue = raw as unknown as LessonCatalogue;
  const snapshot = structuredClone(catalogue.discovery[task]);
  snapshot.run.id = `browser-live-discovery-${task}`;
  snapshot.run.mode = 'live';
  const elapsedMs = task === 'compare' ? 9500 : 650;
  const meta = (value: Record<string, unknown>, instance: string) => {
    const frontier = ['plan', 'synthesize'].includes(instance);
    return value.provider === 'fixture' ? { ...value, provider: frontier ? 'openai' : 'jev',
      request_id: `browser-mock-${instance}`, configured_model: frontier ? model : 'jev-test',
      returned_model: frontier ? model : 'jev-test-returned', elapsed_ms: frontier ? instance === 'plan' ? 2400 : 4600 : 125 } : value;
  };
  for (const [index, event] of snapshot.events.entries()) {
    event.run_id = snapshot.run.id;
    event.timestamp = new Date(Date.UTC(2026, 8, 30, 12) + elapsedMs * index / (snapshot.events.length - 1)).toISOString();
    if (event.payload.signal && typeof event.payload.signal === 'object') event.payload.signal = meta(event.payload.signal as Record<string, unknown>, event.instance_id);
    if (typeof event.payload.detail === 'string') {
      try {
        const value: unknown = JSON.parse(event.payload.detail);
        if (value && typeof value === 'object' && !Array.isArray(value)) event.payload.detail = JSON.stringify(meta(value as Record<string, unknown>, event.instance_id));
      } catch { /* Plain code descriptions are not provider metadata. */ }
    }
  }
  return {
    version: 'browser-mock', example_id: task, snapshot, documents: structuredClone(catalogue.discovery.documents),
    operational_writes: 0, frontier_calls: task === 'compare' ? 2 : 0,
    provenance: { documents: 'synthetic', bounded_judgments: 'live', frontier: `live ${model} when selected`, runtime: 'executed',
      citation_checks: 'executed exact checks', support_checks: 'live Jev signals; fallible semantic check',
      timing: 'measured client request stages and executed local work', storage: 'isolated temporary store', source_preparation: 'prepared classification and indexing outside this discovery run' },
    metrics: { total_elapsed_ms: elapsedMs, timing_scope: 'discovery execution; source preparation excluded',
      intent_agreement: { matching: 1, evaluated: 1, reference_intent: task, observed_intent: task, basis: 'authored lesson intent; not benchmark accuracy' },
      citation_claims_checked: task === 'compare' ? 2 : 0, citation_claims_valid: task === 'compare' ? 2 : 0, citation_claims_removed: 0,
      support_claims_checked: task === 'compare' ? 2 : 0, support_claims_retained: task === 'compare' ? 2 : 0,
      quality_scope: 'answer quality not evaluated; citation validity and support retention are checks' },
  };
}
