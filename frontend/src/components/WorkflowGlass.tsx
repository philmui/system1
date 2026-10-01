/** @jsxImportSource react */
import { useId } from 'react';

/** The SVG counterpart of the shared frosted service card. No layout or hit area changes. */
export function WorkflowGlassFrame({ x, y, width, height, radius = 12 }: {
  x: number; y: number; width: number; height: number; radius?: number;
}) {
  const fillId = `workflow-glass-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <g className="workflow-glass-frame" aria-hidden="true" pointerEvents="none">
    <defs>
      <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--tile-fill-top)" />
        <stop offset="1" stopColor="var(--tile-fill-bottom)" />
      </linearGradient>
    </defs>
    <rect className="node-card workflow-glass-base" x={x} y={y} width={width} height={height} rx={radius} fill={`url(#${fillId})`} pointerEvents="all" />
    <rect className="workflow-glass-focus-ring" x={x - 4} y={y - 4} width={width + 8} height={height + 8} rx={radius + 4} />
    <rect className="workflow-glass-rim" x={x + 1.5} y={y + 1.5} width={width - 3} height={height - 3} rx={Math.max(1, radius - 1.5)} />
    <path className="workflow-glass-glint" d={`M${x + 3} ${y + radius}Q${x + 3} ${y + 3} ${x + radius} ${y + 3}H${x + width - radius}Q${x + width - 3} ${y + 3} ${x + width - 3} ${y + radius}`} />
    <path className="workflow-glass-accent" d={`M${x + 2} ${y + Math.max(radius, 14)}V${y + height - Math.max(radius, 14)}`} />
  </g>;
}
