import type { Decision, EdgePayload, Event, NodePayload, ReviewRequest, RunSnapshot } from './api.generated';

export interface Instance {
  id: string;
  parent?: string;
  label: string;
  filename?: string;
  node: string;
  state: string;
  attempt: number;
  detail?: string;
  documentId?: string;
  taskId?: string;
  completed?: number;
  expected?: number;
  elapsedMs?: number;
  queueWaitMs?: number;
}
export interface Execution {
  instances: Record<string, Instance>;
  workers: string[];
  decisions: Record<string, Decision[]>;
  edges: (EdgePayload & { sequence: number; sourceState?: string; decision?: Decision })[];
  review?: ReviewRequest;
  result?: Record<string, unknown>;
  status: string;
}
export function appendEvents(existing: Event[], incoming: Event[]): { events: Event[]; gap: boolean } {
  const bySequence = new Map(existing.map((event) => [event.sequence, event]));
  for (const event of incoming) bySequence.set(event.sequence, event);
  const events = [...bySequence.values()].sort((a, b) => a.sequence - b.sequence);
  return { events, gap: events.some((event, index) => event.sequence !== index + 1) };
}
export function reduceEvents(events: Event[]): Execution {
  const state: Execution = { instances: {}, workers: [], decisions: {}, edges: [], status: 'queued' };
  for (const event of events) {
    const payload = event.payload;
    if (['worker_created', 'node_started', 'node_completed', 'node_failed'].includes(event.type)) {
      const node = payload as unknown as NodePayload;
      state.instances[event.instance_id] = {
        ...state.instances[event.instance_id],
        id: event.instance_id,
        parent: event.parent_instance_id || undefined,
        label: node.label,
        filename: event.type === 'worker_created' && node.document_id ? node.label : state.instances[event.instance_id]?.filename,
        node: node.node_name,
        state:
          event.type === 'node_failed'
            ? 'failed'
            : node.state || (event.type === 'node_completed' ? 'succeeded' : 'running'),
        attempt: event.attempt,
        detail: node.detail || node.outcome || undefined,
        documentId: node.document_id || undefined,
        taskId: node.task_id || undefined,
        completed: node.completed ?? undefined,
        expected: node.expected ?? undefined,
        elapsedMs: node.elapsed_ms ?? undefined,
        queueWaitMs: node.queue_wait_ms ?? undefined,
      };
      if (event.type === 'worker_created' && !state.workers.includes(event.instance_id))
        state.workers.push(event.instance_id);
    }
    if (event.type === 'decision') {
      const decision = payload as unknown as Decision;
      state.decisions[event.instance_id] = [...(state.decisions[event.instance_id] || []), decision];
    }
    if (event.type === 'edge_selected') {
      const edge = payload as unknown as EdgePayload;
      state.edges.push({ ...edge, sequence: event.sequence, sourceState: state.instances[edge.source_instance_id]?.state,
        decision: state.decisions[edge.source_instance_id]?.at(-1) });
    }
    if (event.type === 'review_requested') {
      state.review = payload as unknown as ReviewRequest;
      state.status = 'awaiting_review';
    }
    if (event.type === 'review_resumed') {
      state.review = undefined;
      state.status = 'running';
    }
    if (event.type === 'run_started') state.status = 'running';
    if (event.type === 'run_completed') {
      state.status = String(payload.status);
      state.result = payload.result as Record<string, unknown>;
      if (state.status === 'cancelled' || state.status === 'interrupted' || state.status === 'failed') {
        Object.values(state.instances).forEach((instance) => {
          if (['queued', 'running', 'awaiting_review'].includes(instance.state))
            instance.state =
              state.status === 'failed' && instance.state === 'queued' ? 'skipped' : state.status;
        });
      }
    }
  }
  return state;
}

/** Merge the event tail before publishing terminal snapshot metadata. */
export function reconcileSnapshot(events: Event[], appliedCursor: number, snapshot: RunSnapshot) {
  if (snapshot.last_event_sequence < appliedCursor) return null;
  const merged = appendEvents(events, snapshot.events);
  if (merged.gap) return null;
  return { events: merged.events, run: snapshot.run, cursor: snapshot.last_event_sequence };
}
