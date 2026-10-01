import { useEffect, useMemo, useRef, useState } from 'react';
import type { MeasuredClassificationStrategy } from './api.generated';
import { classificationJourney } from './classificationJourney';

/** A finite visual walk through a completed response, with a pauseable clock. */
export function useClassificationJourney(strategy: MeasuredClassificationStrategy | undefined, blocked: boolean) {
  const steps = useMemo(() => classificationJourney(strategy), [strategy]);
  const [session, setSession] = useState({ strategy, position: 0, playing: steps.length > 0 && !blocked, cycle: 0 });
  if (session.strategy !== strategy) setSession({ strategy, position: 0, playing: steps.length > 0 && !blocked, cycle: session.cycle + 1 });
  else if (blocked && session.playing) setSession({ ...session, playing: false });
  const changed = session.strategy !== strategy;
  const position = changed ? 0 : session.position;
  const playing = !blocked && (changed ? steps.length > 0 : session.playing) && position < steps.length - 1;
  const [speed, setSpeed] = useState(1);
  const elapsed = useRef({ strategy, position: -1, cycle: -1, value: 0 });
  useEffect(() => {
    if (!playing) return;
    if (elapsed.current.strategy !== strategy || elapsed.current.position !== position || elapsed.current.cycle !== session.cycle) {
      elapsed.current = { strategy, position, cycle: session.cycle, value: 0 };
    }
    const clock = elapsed.current;
    const start = performance.now();
    const timer = setTimeout(() => setSession(prior => ({ ...prior, position: Math.min(steps.length - 1, prior.position + 1) })), Math.max(0, steps[position].duration - clock.value) / speed);
    return () => { clearTimeout(timer); clock.value += (performance.now() - start) * speed; };
  }, [playing, position, speed, steps, strategy, session.cycle]);
  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setSession(prior => ({ ...prior, playing: false })); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    const pause = () => setSession(prior => ({ ...prior, playing: false }));
    window.addEventListener('pause-workflow-playback', pause);
    return () => { document.removeEventListener('visibilitychange', pauseWhenHidden); window.removeEventListener('pause-workflow-playback', pause); };
  }, []);
  const pause = () => setSession(prior => ({ ...prior, playing: false }));
  const seek = (next: number) => {
    elapsed.current = { strategy, position: -1, cycle: -1, value: 0 };
    setSession(prior => ({ ...prior, position: Math.max(0, Math.min(steps.length - 1, next)), playing: false, cycle: prior.cycle + 1 }));
  };
  const toggle = () => {
    if (blocked || !steps.length) return;
    if (position === steps.length - 1) {
      elapsed.current = { strategy, position: -1, cycle: -1, value: 0 };
      setSession(prior => ({ ...prior, position: 0, playing: true, cycle: prior.cycle + 1 }));
    } else setSession(prior => ({ ...prior, playing: !prior.playing }));
  };
  return { steps, current: steps[position], position, playing, speed, setSpeed, cycle: session.cycle, pause, seek, toggle };
}
