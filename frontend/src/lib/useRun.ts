import { useCallback, useEffect, useState } from 'react';
import type { Event, ReviewRequest, Run, RunSnapshot } from './api.generated';
import { api, API_BASE, terminal } from './api';
import { appendEvents, reconcileSnapshot } from './events';

export function useRun(id: string | null) {
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [connection, setConnection] = useState('Connecting');
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    setRun(null);
    setEvents([]);
    setError(null);
    if (!id) return;
    let disposed = false;
    let source: EventSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let recorded: Event[] = [];
    let appliedRunCursor = 0;
    const applySnapshot = (snapshot: RunSnapshot) => {
      if (disposed) return false;
      const reconciled = reconcileSnapshot(recorded, appliedRunCursor, snapshot);
      if (!reconciled) return false;
      recorded = reconciled.events;
      appliedRunCursor = reconciled.cursor;
      setEvents(recorded);
      setRun(reconciled.run);
      if (terminal(snapshot.run.status)) {
        source?.close();
        setConnection('Recorded');
      }
      return true;
    };
    const sync = async () => {
      source?.close();
      setConnection('Connecting');
      try {
        const snapshot = await api.snapshot(id);
        if (disposed) return;
        recorded = snapshot.events;
        appliedRunCursor = snapshot.last_event_sequence;
        setRun(snapshot.run);
        setEvents(recorded);
        setError(null);
        if (terminal(snapshot.run.status)) {
          setConnection('Recorded');
          return;
        }
        source = new EventSource(`${API_BASE}/api/runs/${id}/events?after=${snapshot.last_event_sequence}`, {
          withCredentials: true,
        });
        source.onopen = () => !disposed && setConnection('Connected');
        source.addEventListener('execution', (event) => {
          if (disposed) return;
          try {
            const incoming = JSON.parse((event as MessageEvent).data) as Event;
            const merged = appendEvents(recorded, [incoming]);
            if (merged.gap) {
              source?.close();
              retry = setTimeout(sync, 100);
              return;
            }
            recorded = merged.events;
            setEvents(recorded);
            if (['run_completed', 'review_requested', 'review_resumed'].includes(incoming.type)) {
              appliedRunCursor = incoming.sequence;
              setRun((current) =>
                !current
                  ? current
                  : incoming.type === 'run_completed'
                    ? {
                        ...current,
                        status: incoming.payload.status as Run['status'],
                        result: incoming.payload.result as Run['result'],
                      }
                    : incoming.type === 'review_requested'
                      ? {
                          ...current,
                          status: 'awaiting_review',
                          review: incoming.payload as unknown as ReviewRequest,
                        }
                      : { ...current, status: 'running', review: null },
              );
              void api
                .snapshot(id)
                .then((snapshot) => {
                  applySnapshot(snapshot);
                })
                .catch(() => {
                  /* The local event stays visible during a brief HTTP outage. */
                });
            }
          } catch {
            source?.close();
            setError('An execution update could not be read. Restoring the recorded snapshot.');
            retry = setTimeout(sync, 1000);
          }
        });
        source.addEventListener('settled', () => {
          source?.close();
          setConnection('Recorded');
          void api
            .snapshot(id)
            .then((snapshot) => {
              applySnapshot(snapshot);
            })
            .catch(() => {});
        });
        source.onerror = () => {
          source?.close();
          if (!disposed) {
            setConnection('Reconnecting');
            retry = setTimeout(sync, 1500);
          }
        };
      } catch (caught) {
        if (!disposed) {
          setError(caught instanceof Error ? caught.message : 'Could not load this run.');
          setConnection('Disconnected');
          retry = setTimeout(sync, 3000);
        }
      }
    };
    void sync();
    return () => {
      disposed = true;
      source?.close();
      if (retry) clearTimeout(retry);
    };
  }, [id, revision]);
  return { run, events, connection, error, refresh };
}
