import { test, expect } from '@playwright/test';
import type { Event, RunSnapshot } from '../src/lib/api.generated';
import { appendEvents, reduceEvents, reconcileSnapshot } from '../src/lib/events';
const event = (
  sequence: number,
  type: Event['type'],
  payload: Event['payload'],
  instance = 'worker:1',
): Event => ({
  schema_version: 1,
  event_id: `event-${sequence}`,
  sequence,
  timestamp: '2026-01-01T00:00:00Z',
  run_id: 'run-1',
  instance_id: instance,
  parent_instance_id: null,
  attempt: 1,
  type,
  payload,
});
test('events deduplicate, detect gaps, and replay exactly the selected branch', () => {
  const events = [
    event(1, 'worker_created', { node_name: 'worker', label: 'Invoice', state: 'queued' }),
    event(2, 'node_started', { node_name: 'worker', label: 'Invoice', state: 'running' }),
    event(3, 'edge_selected', {
      source_instance_id: 'worker:1',
      target_instance_id: 'join',
      label: 'Accepted',
    }),
    event(4, 'node_completed', { node_name: 'worker', label: 'Invoice', state: 'succeeded' }),
  ];
  expect(appendEvents(events, [events[1]]).events).toHaveLength(4);
  expect(appendEvents([events[0]], [events[3]]).gap).toBeTruthy();
  expect(reduceEvents(events.slice(0, 2)).edges).toHaveLength(0);
  expect(reduceEvents(events).edges[0].label).toBe('Accepted');
  expect(reduceEvents(events).workers).toHaveLength(1);
  expect(reduceEvents(events).instances['worker:1'].state).toBe('succeeded');
});
test('cancelled event preserves finished work and cancels unfinished instances', () => {
  const state = reduceEvents([
    event(1, 'node_started', { node_name: 'worker', label: 'Work', state: 'running' }),
    event(2, 'run_completed', { status: 'cancelled', result: null }, 'run'),
  ]);
  expect(state.status).toBe('cancelled');
  expect(state.instances['worker:1'].state).toBe('cancelled');
});

test('terminal snapshot reconciles an SSE tail before closing playback', () => {
  const prior = [event(1, 'run_started', {}), event(2, 'review_resumed', {})];
  const tail = [
    ...prior,
    event(3, 'node_completed', { node_name: 'index', label: 'Index', state: 'succeeded' }, 'index'),
    event(4, 'run_completed', { status: 'succeeded', result: { indexed_count: 1 } }, 'run'),
  ];
  const snapshot = {
    run: { status: 'succeeded' },
    events: tail,
    last_event_sequence: 4,
  } as unknown as RunSnapshot;
  const next = reconcileSnapshot(prior, 2, snapshot)!;
  expect(next.events).toHaveLength(4);
  expect(reduceEvents(next.events).result).toEqual({ indexed_count: 1 });
  expect(reconcileSnapshot(next.events, 4, { ...snapshot, last_event_sequence: 2 })).toBeNull();
});
test('terminal failure stops visible running and queued work', () => {
  const state = reduceEvents([
    event(1, 'node_started', { node_name: 'worker', label: 'Active', state: 'running' }, 'active'),
    event(2, 'worker_created', { node_name: 'worker', label: 'Queued', state: 'queued' }, 'queued'),
    event(3, 'run_completed', { status: 'failed', result: null }, 'run'),
  ]);
  expect(state.instances.active.state).toBe('failed');
  expect(state.instances.queued.state).toBe('skipped');
});
