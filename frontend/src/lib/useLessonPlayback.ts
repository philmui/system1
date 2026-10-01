import { useEffect, useMemo, useRef, useState } from 'react';
import type { RunSnapshot } from './api.generated';
import { discoveryPlaybackSteps } from './discoveryPlayback';
import { classificationPlaybackSteps } from './classificationJourney';
import { discoveryJourneySteps, type DiscoveryPhase } from './discoveryJourney';

/** Presentation time advances only across prefixes of a retained execution. */
export function useLessonPlayback(snapshot: RunSnapshot, documentId: string, autoPlay = false, sessionKey = '', presentation: 'events' | 'capabilities' = 'events') {
  const steps = useMemo<{ cursor: number; duration: number; stage?: string; capability?: DiscoveryPhase }[]>(() => snapshot.run.kind === 'classification'
    ? classificationPlaybackSteps(snapshot, documentId)
    : presentation === 'capabilities' ? discoveryJourneySteps(snapshot) : discoveryPlaybackSteps(snapshot), [snapshot, documentId, presentation]);
  const firstDecision = steps.findIndex(step => 'stage' in step && step.stage === 'route');
  const initialPosition = autoPlay ? Math.max(0, firstDecision) : 0;
  const [session, setSession] = useState({ snapshot, sessionKey, documentId, position: initialPosition, playing: autoPlay, cycle: 0 });
  const changed = session.snapshot !== snapshot || session.sessionKey !== sessionKey || session.documentId !== documentId;
  // Reset before committing a new recording, without unmounting an open source
  // drawer. In particular, never apply an old cursor to a newly returned run.
  if (changed) setSession({ snapshot, sessionKey, documentId, position: initialPosition, playing: autoPlay, cycle: session.cycle + 1 });
  const position = changed ? initialPosition : session.position;
  const playing = changed ? autoPlay : session.playing;
  const setPlaying = (value: boolean | ((prior: boolean) => boolean)) => setSession(prior => ({ ...prior, playing: typeof value === 'function' ? value(prior.playing) : value }));
  const [speed, setSpeed] = useState(1);
  useEffect(() => { const pause = () => setSession(prior => ({ ...prior, playing: false })); window.addEventListener('pause-workflow-playback', pause); return () => window.removeEventListener('pause-workflow-playback', pause); }, []);
  const elapsed = useRef({ snapshot, sessionKey, documentId, position: -1, value: 0 });
  const cursor = position ? steps[position - 1]?.cursor ?? snapshot.events.length : 0;
  useEffect(() => {
    if (!playing || position >= steps.length) return;
    if (elapsed.current.position !== position || elapsed.current.snapshot !== snapshot || elapsed.current.sessionKey !== sessionKey || elapsed.current.documentId !== documentId) elapsed.current = { snapshot, sessionKey, documentId, position, value: 0 };
    const clock = elapsed.current;
    const hold = position ? steps[position - 1].duration : 180;
    const start = performance.now();
    const timer = setTimeout(() => setSession(prior => ({ ...prior, position: Math.min(steps.length, prior.position + 1) })), Math.max(0, hold - elapsed.current.value) / speed);
    return () => { clearTimeout(timer); clock.value += (performance.now() - start) * speed; };
  }, [playing, position, speed, steps, snapshot, sessionKey, documentId]);
  const seek = (next: number) => { elapsed.current = { snapshot, sessionKey, documentId, position: -1, value: 0 }; setSession(prior => ({ ...prior, position: Math.max(0, Math.min(steps.length, next)), playing: false, cycle: prior.cycle + 1 })); };
  const toggle = () => {
    if (position >= steps.length) { elapsed.current = { snapshot, sessionKey, documentId, position: -1, value: 0 }; setSession(prior => ({ ...prior, position: 0, playing: true, cycle: prior.cycle + 1 })); }
    else setPlaying(value => !value);
  };
  return { cursor, position, cycle: session.cycle, count: steps.length, steps, playing: playing && position < steps.length, speed, setSpeed, seek, toggle, pause: () => setPlaying(false),
    current: position ? steps[position - 1] : undefined };
}
