/** @jsxImportSource react */
import { useEffect, useId, useRef, useState } from 'react';
import type { RunSnapshot } from '../lib/api.generated';
import { type discoveryTree, type DiscoveryTreeId } from '../lib/discoveryTree';
import { discoveryTreeGeometry, type TreeBox } from '../lib/discoveryTreeLayout';
import { discoveryHasLiveResponses, discoveryWorkTiming } from '../lib/discoveryPlayback';
import { FlowToken, FlowWork } from './FlowMotion';
import type { DiscoveryPhase } from '../lib/discoveryJourney';
import { discoveryAssumedPaceLabel } from '../lib/discoveryTimingAssumptions';
import { Icon } from './Icon';

type Tree = ReturnType<typeof discoveryTree>;
const labels: Record<DiscoveryTreeId, string> = { judgment: 'Judge intent', 'code-plan': 'Plan search', 'frontier-plan': 'Plan search', evidence: 'Retrieve & screen', sources: 'Return passages', answer: 'Compose & check' };
const roles: Record<DiscoveryTreeId, string> = { judgment: 'System 1 + rules', 'code-plan': 'Code', 'frontier-plan': 'Frontier', evidence: 'Code + System 1', sources: 'Code', answer: 'Frontier + checks' };
const choices: Partial<Record<DiscoveryTreeId, string>> = { 'code-plan': 'Clear Find', 'frontier-plan': 'Complex / uncertain', sources: 'Return evidence or gap', answer: 'Answer needed + evidence' };

/** Compact capabilities leave the routing corridors and one moving item visible. */
export function DiscoveryDecisionTree({ tree, playing, speed, onInspect, snapshot, cursor = 0, cycle = 0, beatDuration = 700, phase, completedNodes = [], completedEdges = [] }: {
  tree: Tree; playing: boolean; speed: number; onInspect: (id: DiscoveryTreeId) => void;
  snapshot?: RunSnapshot; cursor?: number; cycle?: number; beatDuration?: number; phase?: DiscoveryPhase; completedNodes?: DiscoveryTreeId[]; completedEdges?: string[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const arrowId = useId();
  const scopeRoute = tree.edges.some(edge => edge.id === 'judgment--sources');
  const [geometry, setGeometry] = useState<{ paths: Record<string, string>; tracks: Record<string, string> }>({ paths: {}, tracks: {} });
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const update = () => {
      const bounds = container.getBoundingClientRect();
      const vertical = window.matchMedia('(max-width: 760px)').matches;
      const cards: Partial<Record<DiscoveryTreeId, TreeBox>> = {};
      container.querySelectorAll<HTMLElement>('[data-tree-id]').forEach(element => {
        const card = element.getBoundingClientRect();
        cards[element.dataset.treeId as DiscoveryTreeId] = { left: card.left - bounds.left, top: card.top - bounds.top, width: card.width, height: card.height };
      });
      const { paths, tracks } = discoveryTreeGeometry(cards, bounds.width, vertical);
      setGeometry({ paths, tracks });
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    container.querySelectorAll('[data-tree-id]').forEach(node => observer.observe(node));
    update();
    return () => observer.disconnect();
  }, [scopeRoute]);
  const location = phase ? phase.kind === 'transfer' ? { edge: phase.edge!, source: phase.edge!.split('--')[0] as DiscoveryTreeId, target: phase.node, sequence: 0 } : { node: phase.node, instance: '', attempt: 1, sequence: 0 } : tree.location;
  const at = tree.nodes.find(node => node.id === ('node' in location ? location.node : location.target))!;
  const markerPath = 'edge' in location ? geometry.paths[location.edge] : geometry.tracks[location.node];
  const prefixWork = snapshot && 'node' in location ? discoveryWorkTiming({ ...snapshot, events: snapshot.events.slice(0, cursor) }, location.instance, location.attempt) : undefined;
  const retainedWork = snapshot && 'node' in location ? discoveryWorkTiming(snapshot, location.instance, location.attempt) : undefined;
  const hasLiveResponses = snapshot ? discoveryHasLiveResponses(snapshot) : false;
  const work = retainedWork?.source === 'assumed' ? retainedWork : prefixWork?.source === 'assumed' && hasLiveResponses ? undefined : prefixWork;
  const preparedPace = snapshot?.run.mode === 'test-fixture' && !hasLiveResponses;
  const timingLabel = work?.source === 'assumed' ? `Assumed ${work.ms! < 1000 ? `${work.ms} ms` : `${(work.ms! / 1000).toFixed(1)} s`}`
    : work?.source === 'recorded' ? `Recorded ${work.ms! > 0 && work.ms! < 1 ? '<1 ms' : work.ms! < 1000 ? `${Math.round(work.ms!)} ms` : `${(work.ms! / 1000).toFixed(1)} s`}` : retainedWork?.source === 'recorded' ? 'Recorded pace · elapsed shown on completion' : 'Timing unavailable · neutral replay hold';
  const result = tree.execution.result;
  const noun = result ? 'Result' : tree.evidenceCount !== undefined ? 'Evidence bundle' : tree.execution.instances.plan?.state === 'succeeded' ? 'Request + search plan' : 'Request';
  const serviceLabel = 'node' in location ? location.instance === 'intent' ? 'Judge intent · System 1'
    : location.instance === 'plan' ? `Plan search · ${location.node === 'code-plan' ? 'Code' : 'Frontier'}`
      : location.instance.endsWith(':retrieve') ? 'Retrieve passages · Code'
        : location.instance.endsWith(':screen') ? 'Screen relevance · System 1'
          : location.instance === 'join' ? 'Apply evidence rules · Code'
            : location.instance === 'synthesize' ? 'Draft answer · Frontier'
              : location.instance === 'citations' ? 'Check citations · Code'
                : location.instance === 'support' ? 'Apply support rules · Code' : location.instance.startsWith('support:') ? 'Check support · System 1' : 'Return result · Code' : '';
  const ready = cursor === 0;
  const event = snapshot?.events[cursor - 1];
  const handoff = 'edge' in location || !phase && event?.type === 'edge_selected';
  const policy = !phase && event?.type === 'decision';
  const working = phase ? phase.kind === 'service' : 'node' in location && event?.instance_id === location.instance && event?.type === 'node_started' && event.payload.state === 'running';
  return <div className="discovery-flow-view">
    <div ref={root} className={`discovery-decision-tree ${scopeRoute ? 'has-scope-route' : ''}`} role="region" aria-label="Discovery capability flow">
      <svg className="discovery-tree-lines" aria-hidden="true">
        <defs>{['idle', 'visited'].map(state => <marker key={state} id={`${arrowId}-${state}`} className={`tree-arrow-${state}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 1l6 3-6 3" /></marker>)}</defs>
        {tree.edges.map(edge => <g key={edge.id} data-tree-edge={edge.id} className={`tree-link ${completedEdges.includes(edge.id) || !phase && edge.visited ? 'is-traversed' : ''} ${'edge' in location && location.edge === edge.id ? 'is-current' : ''}`}>
          <path d={geometry.paths[edge.id]} markerEnd={`url(#${arrowId}-${completedEdges.includes(edge.id) || !phase && edge.visited ? 'visited' : 'idle'})`} />
        </g>)}
        {tree.nodes.map(node => <path key={node.id} className={`tree-stage-track ${completedNodes.includes(node.id) || !phase && node.status === 'Complete' ? 'is-traversed' : ''} ${'node' in location && location.node === node.id ? 'is-current' : ''}`} d={geometry.tracks[node.id]} />)}
        {(working || 'edge' in location) && markerPath && <FlowWork key={`${snapshot?.run.id}:${phase?.key || location.sequence}:${cycle}`} path={markerPath} moving={playing && !at.failed} speed={speed} duration={beatDuration} className={'edge' in location ? 'tree-transfer-progress' : 'tree-stage-progress'} />}
        {markerPath && <FlowToken key={`${snapshot?.run.id}:${phase?.key || ('edge' in location ? location.sequence : location.node)}:${cycle}`} path={markerPath}
          stationary={phase ? phase.kind === 'checkpoint' : 'node' in location && !working} position={ready ? '0%' : phase?.kind === 'checkpoint' ? '100%' : '50%'} moving={playing && !at.failed} speed={speed} duration={beatDuration} />}
      </svg>
      {tree.nodes.map(node => <button key={node.id} data-tree-id={node.id} className={`discovery-tree-card workflow-glass-node role-${node.role} ${node.selected ? 'is-on-path' : 'is-alternative'} ${'node' in location && location.node === node.id ? 'is-current-location' : ''} ${node.active ? 'is-active' : ''} ${node.failed ? 'has-failed-work' : ''}`}
        onClick={() => onInspect(node.id)} aria-label={`${node.title}. ${node.roles}. ${node.status}. ${node.detail} Select for recorded evidence.`}>
        <span className="tree-card-body">{choices[node.id] && <span className="tree-card-choice">{node.id === 'sources' && tree.decision?.selected_route === 'unsupported' ? 'Out of scope' : choices[node.id]}</span>}<span className="tree-card-heading"><Icon name={node.role === 'jev' ? 'jev' : node.role === 'llm' ? 'sparkle' : 'workflow'} size={14} /><strong>{node.id === 'sources' && tree.decision?.selected_route === 'unsupported' ? 'Return scope note' : labels[node.id]}</strong></span>
        <span className="tree-card-roles">{roles[node.id]}</span>
        <span className="tree-card-detail">{node.status}{node.id === 'evidence' && tree.evidenceCount !== undefined ? ` · ${tree.evidenceCount} kept` : ''}{node.selected && ['answer', 'sources'].includes(node.id) && result?.partial ? ' · partial result' : ''}</span></span><span className="tree-card-rail" aria-hidden="true" />
      </button>)}
    </div>
    <div className="discovery-flow-caption" aria-label="Current workflow step">
      <div><strong>{noun} 01 · {phase ? phase.kind === 'transfer' ? `Moving to ${labels[phase.node].toLowerCase()}` : `${labels[phase.node]} · ${roles[phase.node]}` : 'edge' in location ? `Moving to ${labels[location.target].toLowerCase()}` : handoff ? `Next: ${serviceLabel}` : policy ? 'Apply routing rules · Code' : serviceLabel}{phase && phase.visit > 1 ? ` · visit ${phase.visit}` : ''}</strong>
        <span>{ready ? 'Ready · use Run above; select stages for details' : handoff ? 'Handoff · one forward transfer' : phase ? !phase.timing.count ? `${at.status} · service timing unavailable` : `${phase.kind === 'service' ? 'Processing' : at.status} · ${phase.timing.source === 'assumed' ? 'Assumed' : phase.timing.source === 'recorded' ? 'Recorded' : phase.timing.source === 'mixed' ? 'Mixed' : 'Unavailable'} service work${phase.timing.ms === null ? ' · neutral replay pace' : ` ${phase.timing.ms < 1 && phase.timing.ms > 0 ? '<1 ms' : phase.timing.ms < 1000 ? `${Math.round(phase.timing.ms)} ms` : `${(phase.timing.ms / 1000).toFixed(2)} s`}`}` : policy ? 'Recorded signal → configured route' : `${at.status} · ${timingLabel}`}</span></div>
      <p className="discovery-route-reason">{tree.receipt}</p>
      <small>{preparedPace ? discoveryAssumedPaceLabel : 'Service pace follows recordings where available; assumptions are labeled.'} Each rail shows one service visit. Short steps are stretched; service work includes parallel requests. Playback ≠ elapsed time.</small>
    </div>
  </div>;
}
