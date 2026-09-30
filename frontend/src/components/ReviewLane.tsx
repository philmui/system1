/** @jsxImportSource react */
import { useId } from 'react';
import { Icon } from './Icon';
import type { ExamplePage } from '../lib/reviewExample';
import { pointOnRoute, reviewLayout, roundedRoute, type DiagramNode } from '../lib/reviewLayout';
import { money, traceSnapshot, type ReviewNodeId, type ReviewTrace } from '../lib/workflowComparison';
import { useMediaQuery } from '../lib/useMediaQuery';
import { FlowPaper, FlowTrail } from './FlowMotion';

const nodeCopy: Record<ReviewNodeId, { title: string; kind: string; icon: string; role: string }> = {
  input: { title: 'Read page', kind: 'CODE', icon: 'file', role: 'runtime' },
  agent: { title: 'Classify page', kind: 'MODEL + CODE', icon: 'jev', role: 'jev' },
  redact: { title: 'Redact PII', kind: 'MODEL', icon: 'sparkle', role: 'llm' },
  attorney: { title: 'Review page', kind: 'HUMAN CHECKPOINT', icon: 'human', role: 'human' },
  produce: { title: 'Ready to produce', kind: 'OUTPUT STATE', icon: 'checkCircle', role: 'output' },
  aside: { title: 'Set aside', kind: 'OUTPUT STATE', icon: 'box', role: 'muted' },
  withheld: { title: 'Withheld', kind: 'OUTPUT STATE', icon: 'shield', role: 'human' },
};

function SvgIcon({ name, x, y, size = 19 }: { name: string; x: number; y: number; size?: number }) {
  return <g transform={`translate(${x} ${y})`}><Icon name={name} size={size} /></g>;
}

export function ReviewLane({ page, trace, time, narrow, selected, onSelect, maxMachineSeconds, moving = false, speed = 1 }: {
  page: ExamplePage; trace: ReviewTrace; time: number; narrow: boolean;
  selected?: ReviewNodeId; onSelect: (id: ReviewNodeId) => void; maxMachineSeconds: number;
  moving?: boolean; speed?: number;
}) {
  const uid = useId().replaceAll(':', '');
  const snapshot = traceSnapshot(trace, time);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const layout = reviewLayout(narrow);
  const isSystem = trace.strategy === 'system1';
  const modelRole = isSystem ? 'jev' : 'llm';
  const name = isSystem ? 'Disaggregated intelligence' : 'Frontier by default';
  const pageShort = page.id.slice(-3);
  const drawNode = (node: DiagramNode) => {
    const { x, y, width: w, height: h, id } = node;
    const copy = nodeCopy[id];
    const active = snapshot.current.kind === 'node' && snapshot.current.id === id;
    const reached = snapshot.reachedNodes.has(id);
    const terminal = ['produce', 'aside', 'withheld'].includes(id);
    const role = id === 'agent' ? modelRole : copy.role;
    const status = active ? snapshot.current.activity : reached ? 'Visited' : 'Available';
    const answer = (key: 'responsive' | 'pii' | 'privileged') => !snapshot.answersVisible ? '—' : page[key] === 'yes' ? 'Yes' : page[key] === 'no' ? 'No' : '?';
    return <g key={id} data-node={id} data-state={active ? 'active' : reached ? 'visited' : 'available'}
      className={`diagram-node role-${role} ${active ? 'is-active' : ''} ${reached ? 'is-visited' : ''} ${terminal ? 'is-outcome' : ''} ${selected === id ? 'is-selected' : ''}`}
      role="button" tabIndex={0} aria-label={`${copy.title}. ${id === 'agent' ? isSystem ? 'System 1 Model. ' : 'Frontier LLM. ' : ''}${status}. Inspect this step.`}
      onClick={() => onSelect(id)} onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(id); }
      }}>
      <title>{`${copy.title} · ${status}`}</title>
      <rect className="node-card" x={x} y={y} width={w} height={h} rx={terminal ? 20 : 11} />
      <path className="node-accent" d={`M${x + 1} ${y + 14}v${h - 28}`} />
      {id === 'agent' ? <>
        <SvgIcon name="workflow" x={x + 16} y={y + 17} size={18} />
        <text className="svg-work-title" x={x + 42} y={y + 32}>Classify page</text>
        <text className="svg-kind" x={x + w - 15} y={y + 31} textAnchor="end">MODEL</text>
        <rect className="model-core" x={x + 14} y={y + 49} width={w - 28} height={99} rx="7" />
        <SvgIcon name={isSystem ? 'jev' : 'sparkle'} x={x + 26} y={y + 62} size={22} />
        <text className="svg-model-name" x={x + 58} y={y + 79}>{isSystem ? 'System 1 Model' : 'Frontier LLM'}</text>
        {(['responsive', 'pii', 'privileged'] as const).map((key, index) => <g key={key}>
          <text className="svg-answer-label" x={x + 48 + index * 81} y={y + 104} textAnchor="middle">{['Relevant', 'PII', 'Privilege'][index]}</text>
          <text className={`svg-answer ${snapshot.answersVisible ? 'is-known' : ''}`} x={x + 48 + index * 81} y={y + 130} textAnchor="middle">{answer(key)}</text>
        </g>)}
        <text className="svg-code-kind" x={x + 17} y={y + 172}>CODE</text>
        <text className="svg-rule" x={x + 66} y={y + 172}>Validate · apply rules</text>
        <text className="svg-footnote" x={x + 17} y={y + 189}>3 decisions / 1 request</text>
      </> : <>
        <SvgIcon name={copy.icon} x={x + 13} y={y + (h - 24) / 2} size={22} />
        <text className="svg-kind" x={x + 47} y={y + (h <= 66 ? 23 : 26)}>{copy.kind}</text>
        <text className="svg-work-title" x={x + 47} y={y + (h <= 66 ? 43 : 47)}>{id === 'produce' ? 'Produce' : copy.title}</text>
      </>}
      {active && id !== 'agent' && <circle className="node-status-dot" cx={x + w - 11} cy={y + 11} r="3" />}
      {active && <g className="page-at-node" transform={`translate(${x + w - 28} ${y - 17})`} aria-hidden="true">
        <rect x="-18" y="-6" width="47" height="22" rx="5" />
        <SvgIcon name="file" x={-13} y={-2} size={13} />
        <text x="3" y="9">{pageShort}</text>
      </g>}
      {active && Number.isFinite(snapshot.current.end) && id !== 'input' && <rect className="node-progress" x={x + 10} y={y + h - 3} width={(w - 20) * snapshot.progress} height="3" rx="1" />}
    </g>;
  };
  const visibleEdges = layout.edges.filter(edge => edge.id !== 'attorney-redact' || snapshot.visitedEdges.has(edge.id) || snapshot.current.id === edge.id);
  const activeEdge = visibleEdges.find(edge => edge.id === snapshot.current.id);
  const packet = activeEdge ? pointOnRoute(roundedRoute(activeEdge.points).samples, reducedMotion ? .65 : snapshot.progress) : null;
  return <section className={`review-lane strategy-${trace.strategy}`} aria-label={`${name} workflow`}>
    <div className="lane-heading">
      <div className={`lane-identity role-${modelRole}`}>
        <span className="lane-mark"><Icon name={isSystem ? 'jev' : 'sparkle'} size={17} /></span>
        <div><h2>{name}</h2><span><b>AgentGraph</b><i />{isSystem ? 'Bounded decisions · LLM on exception' : 'Frontier for every semantic decision'}</span></div>
      </div>
      <div className="lane-metrics" aria-label={`${name} scenario metrics`}>
        <div><span>Modeled machine time</span><strong data-metric="time">{snapshot.machineSeconds.toFixed(2)}<small>s</small></strong><i className="metric-track"><b className={`role-${modelRole}`} style={{ width: `${Math.min(100, snapshot.machineSeconds / maxMachineSeconds * 100)}%` }} /></i></div>
        <div><span>Modeled cost</span><strong data-metric="cost">{money(snapshot.cost)}</strong><small>{snapshot.systemCalls + snapshot.frontierCalls} completed {snapshot.systemCalls + snapshot.frontierCalls === 1 ? 'call' : 'calls'}</small></div>
      </div>
    </div>
    <div className={`lane-diagram ${narrow ? 'is-vertical' : ''}`} tabIndex={0} role="region" aria-label={`${name} graph. Scroll to explore if needed.`}>
      <svg className="review-lane-svg" viewBox={`-16 -27 ${layout.width + 32} ${layout.height + 35}`} aria-label={`${name}: a page moves through work nodes inside AgentGraph`}>
        <defs>{['jev', 'llm', 'runtime', 'human', 'output', 'muted'].map(role => <marker key={role} id={`${uid}-${role}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1 1l6 3-6 3" className={`arrow-head role-${role}`} /></marker>)}</defs>
        {visibleEdges.map(edge => {
          const role = edge.target === 'agent' ? modelRole : edge.source === 'attorney' ? 'human' : edge.source === 'redact' || edge.target === 'redact' ? 'llm' : nodeCopy[edge.target].role;
          const active = snapshot.current.id === edge.id;
          const visited = snapshot.visitedEdges.has(edge.id);
          const path = roundedRoute(edge.points).path;
          return <g key={edge.id} className={`diagram-route role-${role}`}>
            <path data-edge={edge.id} className={`diagram-edge role-${role} ${active ? 'is-active' : ''} ${visited ? 'is-visited' : ''}`}
              d={path} markerEnd={`url(#${uid}-${role})`} fill="none" />
            {active && <FlowTrail path={path} moving={moving} speed={speed} />}
          </g>;
        })}
        {!narrow && <g className="branch-labels" aria-hidden="true">
          <text x="645" y="74">PII</text><text x="620" y="130">Clear</text><text x="637" y="234">Review</text>
        </g>}
        {layout.nodes.map(drawNode)}
        {packet && <g className={`page-packet role-${modelRole}`} data-packet={page.id} transform={`translate(${packet.x} ${packet.y})`} aria-hidden="true">
          <FlowPaper label={pageShort} />
        </g>}
      </svg>
    </div>
    <div className="lane-status"><span className={snapshot.awaiting ? 'role-human' : snapshot.finished ? 'role-output' : ''}><Icon name={snapshot.awaiting ? 'pause' : snapshot.finished ? 'checkCircle' : 'file'} size={13} /><b>{page.id}</b><span>{snapshot.current.activity}</span></span><small>{snapshot.systemCalls} System 1 · {snapshot.frontierCalls} frontier calls</small></div>
  </section>;
}
