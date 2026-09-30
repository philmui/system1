/** @jsxImportSource react */
/** Shared motion language for recorded graphs and the local workflow comparison. */
export function FlowTrail({ path, moving, speed = 1 }: { path: string; moving: boolean; speed?: number }) {
  return <g className="flow-trail" aria-hidden="true">
    <path className="route-highlight" d={path} fill="none" />
    <path className="route-forward-flow" d={path} fill="none"
      style={{ animationDuration: `${.8 / speed}s`, animationPlayState: moving ? 'running' : 'paused' }} />
  </g>;
}

export function FlowPaper({ label }: { label: string }) {
  return <g className="flow-paper">
    <rect className="packet-halo" x="-24" y="-29" width="48" height="58" rx="12" />
    <path className="packet-paper" d="M-14-21H5L15-11V18Q15 21 12 21H-12Q-15 21-15 18V-18Q-15-21-14-21Z" />
    <path className="packet-fold" d="M5-21v10h10 M-8-5H6" />
    <text x="0" y="12" textAnchor="middle">{label}</text>
  </g>;
}
