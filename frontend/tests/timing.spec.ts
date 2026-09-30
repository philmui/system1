import { test, expect } from '@playwright/test';
import type { Event } from '../src/lib/api.generated';
import { duration, timingFromEvents } from '../src/lib/timing';
const event = (
  sequence: number,
  ms: number,
  type: Event['type'],
  instance_id: string,
  payload: Event['payload'],
): Event => ({
  schema_version: 1,
  event_id: String(sequence),
  sequence,
  timestamp: new Date(Date.UTC(2026, 0, 1) + ms).toISOString(),
  run_id: 'test',
  instance_id,
  parent_instance_id: null,
  attempt: 1,
  type,
  payload,
});
test('parallel provider sums remain distinct from wall time', () => {
  const events = [
    event(1, 0, 'run_started', 'run', {}),
    event(2, 0, 'node_started', 'a:jev', { node_name: 'jev', label: 'Jev A', state: 'running' }),
    event(3, 0, 'node_started', 'b:jev', { node_name: 'jev', label: 'Jev B', state: 'running' }),
    event(4, 100, 'node_completed', 'a:jev', {
      node_name: 'jev',
      label: 'Jev A',
      state: 'succeeded',
      elapsed_ms: 105,
      detail: JSON.stringify({ elapsed_ms: 100 }),
    }),
    event(5, 100, 'node_completed', 'b:jev', {
      node_name: 'jev',
      label: 'Jev B',
      state: 'succeeded',
      detail: JSON.stringify({ elapsed_ms: 100 }),
    }),
  ];
  const timing = timingFromEvents(events);
  expect(timing.wall).toBe(100);
  expect(timing.jev.total).toBe(200);
  expect(timing.jev.median).toBe(100);
  expect(timing.jev.calls).toBe(2);
});
test('active wall excludes human review and interrupted recovery gaps', () => {
  const timing = timingFromEvents([
    event(1, 0, 'run_started', 'run', {}),
    event(2, 10, 'review_requested', 'review', {}),
    event(3, 1010, 'review_resumed', 'review', {}),
    event(4, 1020, 'run_completed', 'run', { status: 'interrupted' }),
    event(5, 2020, 'run_started', 'run', { recovered: true }),
    event(6, 2030, 'run_completed', 'run', { status: 'succeeded' }),
  ]);
  expect(timing.wall).toBe(2030);
  expect(timing.active).toBe(30);
  expect(timing.review).toBe(1000);
  expect(timing.suspended).toBe(1000);
});
test('missing and failed-stage measurements are not provider request times', () => {
  const timing = timingFromEvents([
    event(1, 0, 'node_started', 'a:jev', { node_name: 'jev', label: 'Jev', state: 'running' }),
    event(2, 25, 'node_failed', 'a:jev', { node_name: 'jev', label: 'Jev', state: 'failed', elapsed_ms: 25 }),
  ]);
  expect(timing.spans[0].measurement).toBe('stage');
  expect(timing.jev.total).toBeNull();
  expect(duration(timing.jev.total)).toBe('Unavailable');
  expect(duration(0.04)).toBe('<1 ms');
});
test('an unobserved hard-stop leaves active wall time unavailable', () => {
  const timing = timingFromEvents([
    event(1, 0, 'run_started', 'run', {}),
    event(2, 43_200_000, 'run_completed', 'run', { status: 'interrupted', timing_incomplete: true }),
  ]);
  expect(timing.wall).toBe(43_200_000);
  expect(timing.active).toBeNull();
  expect(timing.timingIncomplete).toBeTruthy();
});
test('cancelled pending spans retain known queue wait and truthful terminal status', () => {
  const timing = timingFromEvents([
    event(1, 0, 'node_started', 'intent', {
      node_name: 'intent',
      label: 'Intent',
      state: 'running',
      queue_wait_ms: 12,
    }),
    event(2, 25, 'run_completed', 'run', { status: 'cancelled' }),
  ]);
  expect(timing.spans[0].state).toBe('cancelled');
  expect(timing.spans[0].queue).toBe(12);
  expect(timing.spans[0].observed).toBe(25);
  expect(timing.spans[0].elapsed).toBeNull();
});
