import { useEffect, useRef, useState } from 'react';

export type LiveLessonState<T> =
  | { status: 'idle' }
  | { status: 'pending'; startedAt: number }
  | { status: 'complete'; response: T }
  | { status: 'failed'; message: string };

/** Calls only start from a deliberate action. Leaving ignores late results. */
export function useLiveLesson<T>() {
  const [state, setState] = useState<LiveLessonState<T>>({ status: 'idle' });
  const [inFlight, setInFlight] = useState(false);
  const ticket = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { ticket.current++; mounted.current = false; }; }, []);
  const start = async (call: () => Promise<T>) => {
    if (busy.current) return;
    busy.current = true;
    setInFlight(true);
    const own = ++ticket.current;
    setState({ status: 'pending', startedAt: performance.now() });
    try {
      const response = await call();
      if (own === ticket.current) setState({ status: 'complete', response });
    } catch (error) {
      if (own === ticket.current) setState({ status: 'failed', message: error instanceof Error ? error.message : 'The live request failed.' });
    } finally { busy.current = false; if (mounted.current) setInFlight(false); }
  };
  // Hiding an in-flight request does not cancel work already accepted by the API.
  const leave = () => { ticket.current++; setState({ status: 'idle' }); };
  return { state, inFlight, start, leave };
}
