/** @jsxImportSource react */
import { useId, type CSSProperties } from 'react';

export function PlaybackSpeed({ value, onChange, label = 'Playback speed' }: {
  value: number; onChange: (speed: number) => void; label?: string;
}) {
  const id = useId();
  return <label className="speed-control" htmlFor={id}>
    <span>Speed</span>
    <input id={id} type="range" min="0.1" max="4" step="0.1" value={value}
      aria-label={label} aria-valuetext={`${value.toFixed(1)} times normal speed`}
      style={{ '--range-fill': `${(value - .1) / 3.9 * 100}%` } as CSSProperties}
      onChange={event => onChange(Number(event.target.value))} />
    <output htmlFor={id}>{value.toFixed(1)}×</output>
  </label>;
}
