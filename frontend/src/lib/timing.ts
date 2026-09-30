import type { Decision, Event, NodePayload } from './api.generated';
export type ComponentKind = 'jev' | 'openai' | 'retrieval' | 'policy' | 'workflow';
export interface TimingSpan {
  id: string;
  instanceId: string;
  parentId?: string;
  label: string;
  component: ComponentKind;
  start: number;
  elapsed: number | null;
  observed: number;
  queue: number | null;
  attempt: number;
  state: string;
  measured: boolean;
  measurement: 'provider' | 'stage' | 'policy' | 'unavailable';
}
export function componentFor(instance: string, payload?: Partial<NodePayload>): ComponentKind {
  if (/(:jev$|:screen$|^intent$|^support:claim-)/.test(instance)) return 'jev';
  if (
    /(:interpret$|^synthesize$)/.test(instance) ||
    (instance === 'plan' && payload?.label !== 'One lexical search')
  )
    return 'openai';
  if (/(:extract$|:retrieve$|^index$)/.test(instance)) return 'retrieval';
  return 'workflow';
}
export function duration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return 'Unavailable';
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${ms.toFixed(ms < 10 ? 1 : 0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
export function timingFromEvents(events: Event[]) {
  const timingIncomplete = events.some(
    (event) => event.type === 'run_completed' && event.payload.timing_incomplete === true,
  );
  const origin = events.length ? new Date(events[0].timestamp).getTime() : 0;
  const end = events.length ? new Date(events.at(-1)!.timestamp).getTime() : origin;
  const pauses: { start: number; end: number; pending: boolean; kind: 'review' | 'suspended' }[] = [];
  let reviewStart: number | null = null;
  let suspendedStart: number | null = null;
  for (const event of events) {
    const at = new Date(event.timestamp).getTime();
    if (event.type === 'review_requested') reviewStart = at;
    if (event.type === 'run_completed' && event.payload.status === 'interrupted') suspendedStart = at;
    if (event.type === 'run_started' && suspendedStart !== null) {
      pauses.push({ start: suspendedStart, end: at, pending: false, kind: 'suspended' });
      suspendedStart = null;
    }
    if (event.type === 'run_completed' && reviewStart !== null) {
      pauses.push({ start: reviewStart, end: at, pending: false, kind: 'review' });
      reviewStart = null;
    }
    if (event.type === 'review_resumed' && reviewStart !== null) {
      pauses.push({ start: reviewStart, end: at, pending: false, kind: 'review' });
      reviewStart = null;
    }
  }
  if (reviewStart !== null) pauses.push({ start: reviewStart, end, pending: true, kind: 'review' });
  if (suspendedStart !== null) pauses.push({ start: suspendedStart, end, pending: true, kind: 'suspended' });
  const activeOffset = (at: number) =>
    Math.max(
      0,
      at -
        origin -
        pauses.reduce((sum, pause) => sum + Math.max(0, Math.min(at, pause.end) - pause.start), 0),
    );
  const starts = new Map<string, Event>();
  const spans = new Map<string, TimingSpan>();
  const attempts: Record<ComponentKind, number> = { jev: 0, openai: 0, retrieval: 0, policy: 0, workflow: 0 };
  for (const event of events) {
    const key = `${event.instance_id}:${event.attempt}`;
    const node = event.payload as unknown as NodePayload;
    const component = componentFor(event.instance_id, node);
    if (event.type === 'node_started' && node.state === 'running') {
      if (!starts.has(key) && !node.node_name.includes('worker')) attempts[component]++;
      if (!starts.has(key)) starts.set(key, event);
    }
    if (['node_completed', 'node_failed'].includes(event.type) && !node.node_name.includes('worker')) {
      const start = starts.get(key);
      const at = new Date(event.timestamp).getTime();
      const startedAt = start ? new Date(start.timestamp).getTime() : at;
      let providerElapsed: number | null = null;
      try {
        const metadata = JSON.parse(node.detail || '{}');
        if (typeof metadata.elapsed_ms === 'number') providerElapsed = metadata.elapsed_ms;
      } catch {
        /* Human-readable lifecycle detail. */
      }
      const elapsed = providerElapsed ?? node.elapsed_ms ?? null;
      spans.set(key, {
        id: key,
        instanceId: event.instance_id,
        parentId: event.parent_instance_id || undefined,
        label: node.label,
        component,
        start: activeOffset(startedAt),
        elapsed,
        observed: Math.max(0, activeOffset(at) - activeOffset(startedAt)),
        queue: node.queue_wait_ms ?? (start?.payload.queue_wait_ms as number | undefined) ?? null,
        attempt: event.attempt,
        state: node.state,
        measured: elapsed !== null,
        measurement: providerElapsed !== null ? 'provider' : elapsed !== null ? 'stage' : 'unavailable',
      });
    }
    if (event.type === 'decision') {
      const decision = event.payload as unknown as Decision;
      if (decision.policy_elapsed_ms !== null && decision.policy_elapsed_ms !== undefined) {
        const id = `policy:${decision.id}`;
        spans.set(id, {
          id,
          instanceId: event.instance_id,
          parentId: event.parent_instance_id || undefined,
          label: `Policy → ${decision.selected_route}`,
          component: 'policy',
          start: Math.max(0, activeOffset(new Date(event.timestamp).getTime()) - decision.policy_elapsed_ms),
          elapsed: decision.policy_elapsed_ms,
          observed: decision.policy_elapsed_ms,
          queue: null,
          attempt: event.attempt,
          state: 'succeeded',
          measured: true,
          measurement: 'policy',
        });
        attempts.policy++;
      }
    }
  }
  for (const [key, start] of starts) {
    if (spans.has(key)) continue;
    const node = start.payload as unknown as NodePayload;
    if (node.node_name.includes('worker')) continue;
    const stop = events.find((event) => event.type === 'run_completed' && event.sequence > start.sequence);
    const stopAt = stop ? new Date(stop.timestamp).getTime() : end;
    spans.set(key, {
      id: key,
      instanceId: start.instance_id,
      parentId: start.parent_instance_id || undefined,
      label: node.label,
      component: componentFor(start.instance_id, node),
      start: activeOffset(new Date(start.timestamp).getTime()),
      elapsed: null,
      observed: Math.max(0, activeOffset(stopAt) - activeOffset(new Date(start.timestamp).getTime())),
      queue: node.queue_wait_ms ?? null,
      attempt: start.attempt,
      state: stop ? String(stop.payload.status) : 'running',
      measured: false,
      measurement: 'unavailable',
    });
  }
  const all = [...spans.values()].sort((a, b) => a.start - b.start);
  const summary = (component: ComponentKind) => {
    const measured = all.filter(
      (span) => span.component === component && span.elapsed !== null && span.measurement === 'provider',
    );
    const values = measured.map((span) => span.elapsed!).sort((a, b) => a - b);
    return {
      calls: attempts[component],
      measured: measured.length,
      total: values.length ? values.reduce((sum, value) => sum + value, 0) : null,
      median: values.length
        ? values.length % 2
          ? values[Math.floor(values.length / 2)]
          : (values[values.length / 2 - 1] + values[values.length / 2]) / 2
        : null,
    };
  };
  return {
    spans: all,
    wall: events.length > 1 ? end - origin : null,
    active: events.length > 1 && !timingIncomplete ? activeOffset(end) : null,
    timingIncomplete,
    review: pauses
      .filter((pause) => pause.kind === 'review')
      .reduce((sum, pause) => sum + pause.end - pause.start, 0),
    suspended: pauses
      .filter((pause) => pause.kind === 'suspended')
      .reduce((sum, pause) => sum + pause.end - pause.start, 0),
    awaitingRecovery: suspendedStart !== null,
    awaitingReview: reviewStart !== null,
    jev: summary('jev'),
    openai: summary('openai'),
  };
}
