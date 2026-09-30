/** @jsxImportSource react */
import type { CSSProperties } from 'react';
const paths: Record<string, string> = {
  workflow: 'M3 6h6v6H3z M15 3h6v6h-6z M15 15h6v6h-6z M9 9h3V6h3 M12 9v9h3',
  sun: 'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  moon: 'M20.7 13.1A9 9 0 0 1 10.9 3.3 9 9 0 1 0 20.7 13.1z',
  jev: 'M12 2l9 5v10l-9 5-9-5V7z M14 6l-6 7h5l-3 5 7-8h-5z',
  human: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3',
  filter: 'M4 7h16 M7 12h10 M10 17h4',
  checkCircle: 'M8 12l3 3 5-6 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  alert: 'M12 8v5 M12 16v.1 M10 3h4l8 17H2z',
  box: 'M3 7l9-4 9 4v13H3z M3 7l9 4 9-4 M12 11v9',
  layers: 'M12 3l10 5-10 5L2 8z M2 12l10 5 10-5 M2 16l10 5 10-5',
  sliders: 'M4 6h5 M13 6h7 M4 18h9 M17 18h3 M9 3v6h4V3z M13 15v6h4v-6z',
  fit: 'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5 M9 9h6v6H9z',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  expand: 'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5 M3 3l6 6 M21 3l-6 6 M3 21l6-6 M21 21l-6-6',
  collapse: 'M3 8h5V3 M21 8h-5V3 M3 16h5v5 M21 16h-5v5',
  chevronDown: 'M5 9l7 7 7-7',
  info: 'M12 11v6 M12 7v.1 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  library: 'M4 5h16v15H4z M8 5V3h8v2 M8 10h8 M8 14h6',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  runs: 'M5 4v16 M5 6h9v5h5 M5 18h9v-5h5 M17 9l2 2-2 2',
  upload: 'M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  file: 'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
  check: 'M5 12l4 4L19 6',
  close: 'M6 6l12 12 M18 6L6 18',
  play: 'M8 4l12 8-12 8z',
  pause: 'M8 4v16 M16 4v16',
  step: 'M5 5l10 7-10 7z M19 5v14',
  stepBack: 'M19 5L9 12l10 7z M5 5v14',
  refresh: 'M20 6v5h-5 M4 18v-5h5 M19 10a7 7 0 0 0-12-5L4 8 M5 14a7 7 0 0 0 12 5l3-3',
  sparkle: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  link: 'M10 7l3-3a5 5 0 0 1 7 7l-3 3 M14 17l-3 3a5 5 0 0 1-7-7l3-3 M8 16l8-8',
  clock: 'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  chevron: 'M9 5l7 7-7 7',
  shield: 'M12 2l8 4v7c0 4-8 9-8 9s-8-5-8-9V6z M8 12l3 3 5-6',
};
export function Icon({ name, size = 18, style }: { name: string; size?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] || paths.file} />
    </svg>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value}`}>
      <span className="status-dot" />
      {value.replaceAll('_', ' ')}
    </span>
  );
}
