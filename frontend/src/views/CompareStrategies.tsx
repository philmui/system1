/** @jsxImportSource react */
import { useEffect, useId, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { FlowPaper, FlowTrail } from '../components/FlowMotion';
import { WorkflowGlassFrame } from '../components/WorkflowGlass';
import { MeasurementGuide } from '../components/MeasurementGuide';
import { useMediaQuery } from '../lib/useMediaQuery';
import { humanWaitDuration } from '../lib/lessonTiming';
import { pointOnRoute, roundedRoute, type Point } from '../lib/reviewLayout';
import type { Event, Run } from '../lib/api.generated';
import {
  batchAssumptionFields, batchDocumentSnapshot, batchMoney, batchSeconds, batchSnapshot,
  buildBatchTrace, createBatchPlaybackClock, defaultBatchScenario, nextBatchTime, recordedBatchEvidence,
  relativeBatchDifference, validateBatchScenario,
  type BatchCapability, type BatchDocumentTrace, type BatchScenario, type BatchTrace, type PublicationPolicy,
} from '../lib/batchComparison';

export interface RecordedBatchComparison { run: Run; events: Event[]; documentNames?: Record<string, string> }
export interface CompareStrategiesProps {
  embedded?: boolean;
  recorded?: RecordedBatchComparison;
  initialSource?: 'illustrative' | 'recorded';
  source?: 'illustrative' | 'recorded';
  onSourceChange?: (source: 'illustrative' | 'recorded') => void;
  publication?: PublicationPolicy;
  selectedDocumentId?: string;
  onSelectDocument?: (id: string) => void;
  onExplore?: (documentId?: string) => void;
}

const stageTitles: Record<BatchCapability, string> = {
  bounded: 'System 1 judgment', frontier_classify: 'Frontier classification', frontier_interpret: 'Frontier interpretation',
  policy: 'Applying runtime policy', validate: 'Validating the proposal', review: 'Awaiting human review', publish: 'Publishing the accepted document',
};
type GraphNode = 'judge' | 'policy' | 'interpret' | 'review' | 'publish';
const nodeForStage: Record<BatchCapability, GraphNode> = {
  bounded: 'judge', frontier_classify: 'judge', frontier_interpret: 'interpret', policy: 'policy', validate: 'interpret', review: 'review', publish: 'publish',
};
interface LaneNode { id: GraphNode; x: number; y: number; width: number; height: number }
interface LaneEdge { id: string; source: GraphNode; target: GraphNode; points: Point[] }

/** Same geometry drives the lines, directional flow, and numbered document. */
export function batchLaneLayout(narrow: boolean, disaggregated: boolean) {
  const node = (id: GraphNode, x: number, y: number, width = 175, height = 80): LaneNode => ({ id, x, y, width, height });
  const edge = (source: GraphNode, target: GraphNode, points: [number, number][]): LaneEdge => ({ id: `${source}-${target}`, source, target, points: points.map(([x, y]) => ({ x, y })) });
  return narrow ? {
    width: 344, height: 630,
    nodes: [node('judge', 84, 12, 176, 78), node('policy', 84, 138, 176, 78), ...(disaggregated ? [node('interpret', 168, 276, 168, 78)] : []), node('review', 168, 402, 168, 78), node('publish', 84, 528, 176, 78)],
    edges: [edge('judge', 'policy', [[172, 90], [172, 138]]), edge('policy', 'publish', [[84, 177], [24, 177], [24, 567], [84, 567]]),
      ...(disaggregated ? [edge('policy', 'interpret', [[220, 216], [220, 246], [252, 246], [252, 276]]), edge('interpret', 'review', [[252, 354], [252, 402]])]
        : [edge('policy', 'review', [[220, 216], [220, 300], [252, 300], [252, 402]])]),
      edge('review', 'publish', [[252, 480], [252, 504], [172, 504], [172, 528]])],
  } : {
    width: 1110, height: 310,
    nodes: [node('judge', 12, 56), node('policy', 244, 56, 180), ...(disaggregated ? [node('interpret', 474, 202, 185)] : []), node('review', 706, 202), node('publish', 916, 56)],
    edges: [edge('judge', 'policy', [[187, 96], [244, 96]]), edge('policy', 'publish', [[424, 96], [916, 96]]),
      ...(disaggregated ? [edge('policy', 'interpret', [[334, 136], [334, 242], [474, 242]]), edge('interpret', 'review', [[659, 242], [706, 242]])]
        : [edge('policy', 'review', [[334, 136], [334, 242], [706, 242]])]),
      edge('review', 'publish', [[881, 242], [902, 242], [902, 112], [916, 112]])],
  };
}

/** Compact landscape lane lets both strategies remain visible on a wide screen. */
export function compactBatchLaneLayout(disaggregated: boolean) {
  const node = (id: GraphNode, x: number, y: number): LaneNode => ({ id, x, y, width: 175, height: 80 });
  const edge = (source: GraphNode, target: GraphNode, points: [number, number][]): LaneEdge => ({ id: `${source}-${target}`, source, target, points: points.map(([x, y]) => ({ x, y })) });
  return { width: 635, height: 310,
    nodes: [node('judge', 10, 32), node('policy', 230, 32), ...(disaggregated ? [node('interpret', 230, 212)] : []), node('review', 450, 212), node('publish', 450, 32)],
    edges: [edge('judge', 'policy', [[185, 72], [230, 72]]), edge('policy', 'publish', [[405, 72], [450, 72]]),
      ...(disaggregated ? [edge('policy', 'interpret', [[317.5, 112], [317.5, 212]]), edge('interpret', 'review', [[405, 252], [450, 252]])]
        : [edge('policy', 'review', [[317.5, 112], [317.5, 252], [450, 252]])]),
      edge('review', 'publish', [[537.5, 212], [537.5, 112]])],
  };
}

function LaneDiagram({ trace, document, time, playing, speed }: { trace: BatchTrace; document: BatchDocumentTrace; time: number; playing: boolean; speed: number }) {
  const narrow = useMediaQuery('(max-width: 760px)');
  const compact = useMediaQuery('(min-width: 1151px)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const uid = useId().replaceAll(':', '');
  const isSystem = trace.strategy === 'disaggregated';
  const layout = compact ? compactBatchLaneLayout(isSystem) : batchLaneLayout(narrow, isSystem);
  const snapshot = batchDocumentSnapshot(document, time);
  const currentNode = snapshot.current ? nodeForStage[snapshot.current.capability] : snapshot.state === 'searchable' ? 'publish' : undefined;
  const visited = new Set(snapshot.completed.map(step => nodeForStage[step.capability]));
  const pathNodes: GraphNode[] = ['judge', 'policy', ...(document.kind === 'exception' ? [...(isSystem ? ['interpret' as const] : []), 'review' as const] : []), 'publish'];
  const selectedEdges = pathNodes.slice(1).map((node, index) => `${pathNodes[index]}-${node}`);
  const currentEdge = layout.edges.find(edge => edge.target === currentNode && selectedEdges.includes(edge.id));
  const firstStepAtNode = document.steps.find(step => nodeForStage[step.capability] === currentNode);
  // An incoming transfer belongs to the first visit, never a retry at the same
  // component. Human waiting starts with the document already at its checkpoint.
  const activePath = currentEdge && snapshot.current?.id === firstStepAtNode?.id && snapshot.current?.capability !== 'review'
    ? roundedRoute(currentEdge.points) : undefined;
  const transferring = !!activePath && snapshot.progress < .4;
  const riverMoving = playing && !!snapshot.current && snapshot.current.capability !== 'review' && snapshot.state !== 'searchable';
  const packet = activePath ? pointOnRoute(activePath.samples, reducedMotion ? 1 : Math.min(1, snapshot.progress * 2.5)) : undefined;
  const copies: Record<GraphNode, { title: string; role: string; icon: string; detail: string }> = {
    judge: { title: isSystem ? 'System 1' : 'Frontier model', role: isSystem ? 'jev' : 'llm', icon: isSystem ? 'jev' : 'sparkle', detail: isSystem ? 'Bounded judgment' : 'Classify every document' },
    policy: { title: 'Runtime policy', role: 'runtime', icon: 'workflow', detail: 'Validate · choose route' },
    interpret: { title: 'Interpret', role: 'llm', icon: 'sparkle', detail: 'Propose a category' },
    review: { title: 'Human review', role: 'human', icon: 'human', detail: 'Assumed review delay' },
    publish: { title: 'Publish', role: 'jev', icon: 'checkCircle', detail: 'Commit searchable result' },
  };
  const currentLocation = layout.nodes.find(node => node.id === currentNode);
  const marker = packet || (currentLocation ? { x: currentLocation.x + currentLocation.width - 20, y: currentLocation.y - 12 } : undefined);
  return <svg className="batch-lane-graph" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`Following virtual document ${document.ordinal}. ${isSystem ? 'System 1 then runtime policy' : 'Frontier classification then runtime policy'}. ${document.kind === 'exception' ? isSystem ? 'Interpretation and review are required before publication.' : 'Review is required before publication.' : 'The accepted category can proceed to publication.'} ${snapshot.state}.`}>
    <defs>{['jev', 'llm', 'runtime', 'human'].map(role => <marker key={role} id={`${uid}-${role}`} viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M1 1l6 3-6 3" fill="none" stroke={`var(--${role})`} strokeWidth="1.5" /></marker>)}</defs>
    {layout.edges.map(edge => {
      const role = copies[edge.target].role;
      const path = roundedRoute(edge.points).path;
      const isActive = currentEdge?.id === edge.id && transferring;
      const isVisited = selectedEdges.includes(edge.id) && (visited.has(edge.target) || currentEdge?.id === edge.id && !!snapshot.current && !transferring);
      return <g key={edge.id} className={`batch-route role-${role}`} style={{ '--role-color': `var(--${role})` } as CSSProperties}>
        <path d={path} className={`diagram-edge ${isActive ? 'is-active' : isVisited ? 'is-visited' : ''}`} fill="none" stroke={`var(--${role})`} markerEnd={`url(#${uid}-${role})`} />
        {(isActive || isVisited) && <FlowTrail path={path} moving={riverMoving} speed={speed} active={isActive} />}
      </g>;
    })}
    <g className="batch-route-labels" aria-hidden="true">
      <text x={compact ? 410 : narrow ? 38 : 625} y={compact ? 20 : narrow ? 292 : 80}>Accepted</text>
      <text x={compact ? 330 : narrow ? 244 : 362} y={compact ? 168 : narrow ? 238 : 177}>{isSystem ? 'Interpret' : 'Review'}</text>
    </g>
    {layout.nodes.map(node => {
      const copy = copies[node.id];
      const active = currentNode === node.id;
      const stage = snapshot.current;
      return <g key={node.id} className={`batch-capability workflow-glass-node role-${copy.role} ${active ? 'is-current' : ''} ${visited.has(node.id) ? 'is-visited' : ''}`} style={{ '--role-color': `var(--${copy.role})` } as CSSProperties}>
        <WorkflowGlassFrame x={node.x} y={node.y} width={node.width} height={node.height} />
        <g transform={`translate(${node.x + 13} ${node.y + 15})`}><Icon name={copy.icon} size={18} /></g>
        <text className="batch-node-title" x={node.x + 40} y={node.y + 30}>{copy.title}</text>
        <text className="batch-node-detail" x={node.x + 13} y={node.y + 55}>{copy.detail}</text>
        {active && stage && <rect className="batch-node-progress" x={node.x + 10} y={node.y + node.height - 5} width={Math.max(1, (node.width - 20) * snapshot.progress)} height="3" rx="1" />}
      </g>;
    })}
    {marker && <g transform={`translate(${marker.x} ${marker.y}) scale(.65)`} className={`role-${currentNode ? copies[currentNode].role : 'jev'}`} style={{ '--role-color': currentNode ? `var(--${copies[currentNode].role})` : 'var(--jev)' } as CSSProperties} aria-hidden="true"><FlowPaper label={String(document.ordinal).padStart(2, '0')} /></g>}
  </svg>;
}

function documentActivity(document: BatchDocumentTrace, time: number, publication: PublicationPolicy): string {
  const snapshot = batchDocumentSnapshot(document, time);
  if (snapshot.state === 'searchable') return 'Searchable — publication completed';
  if (snapshot.state === 'ready') return publication === 'batch' ? 'Category accepted — waiting for the batch before publication' : 'Approved — queued for publication';
  if (snapshot.current) return `${stageTitles[snapshot.current.capability]}${snapshot.current.attempt && snapshot.current.attempt > 1 ? ` · attempt ${snapshot.current.attempt}` : ''}`;
  if (snapshot.state === 'review') return 'Waiting for an available reviewer';
  return snapshot.next ? `Queued for ${stageTitles[snapshot.next.capability].toLowerCase()}` : 'Waiting for arrival';
}

function BatchLane({ trace, selectedId, time, playing, speed }: { trace: BatchTrace; selectedId?: string; time: number; playing: boolean; speed: number }) {
  const snapshot = batchSnapshot(trace, time);
  const document = trace.documents.find(item => item.id === selectedId) || trace.documents[0];
  const isSystem = trace.strategy === 'disaggregated';
  return <section className={`batch-lane ${isSystem ? 'batch-lane-system' : 'batch-lane-frontier'}`} aria-label={isSystem ? 'Disaggregated intelligence strategy' : 'Frontier for every classification strategy'}>
    <header className="batch-lane-heading">
      <div className={`batch-lane-title role-${isSystem ? 'jev' : 'llm'}`}><Icon name={isSystem ? 'jev' : 'sparkle'} size={22} /><div><h2>{isSystem ? 'Disaggregated intelligence' : 'Frontier for every classification'}</h2><span>{isSystem ? 'Bounded judgment · frontier on exception' : 'One frontier classification task per document'}</span></div></div>
      <dl className="batch-primary-metrics">
        <div><dt>Frontier calls</dt><dd>{snapshot.frontierCalls}</dd></div>
        <div><dt>Searchable</dt><dd>{snapshot.counts.searchable}<small> / {trace.documents.length}</small></dd></div>
        <div><dt>First searchable</dt><dd>{batchSeconds(snapshot.firstSearchableAt)}</dd></div>
      </dl>
    </header>
    <div className="batch-state-strip" aria-label="Document states at the current modeled time">
      {([['queued', 'Queued'], ['processing', 'Processing'], ['review', 'Awaiting review'], ['ready', 'Awaiting publication'], ['searchable', 'Searchable']] as const).map(([state, label]) => <span key={state} data-state={state}><i /><b>{snapshot.counts[state]}</b> {label}</span>)}
    </div>
    {document ? <LaneDiagram trace={trace} document={document} time={time} playing={playing} speed={speed} /> : <p className="batch-empty">No documents in this workload. Change the assumptions to add documents.</p>}
    <footer className="batch-lane-footer">
      <span><Icon name={document && batchDocumentSnapshot(document, time).state === 'searchable' ? 'checkCircle' : 'file'} size={16} /><b>{document ? `#${String(document.ordinal).padStart(3, '0')}` : '—'}</b>{document ? documentActivity(document, time, trace.scenario.publication) : 'No work scheduled'}</span>
      <span>{snapshot.boundedCalls} bounded · {snapshot.frontierCalls} frontier attempts started</span>
    </footer>
  </section>;
}

const scenarioDraft = (scenario: BatchScenario) => Object.fromEntries(batchAssumptionFields.map(field => [field.key, scenario[field.key] === null ? '' : String(scenario[field.key])]));

function Assumptions({ scenario, onChange }: { scenario: BatchScenario; onChange: (scenario: BatchScenario) => void }) {
  const [draft, setDraft] = useState(() => scenarioDraft(scenario));
  const [publication, setPublication] = useState(scenario.publication);
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const values = Object.fromEntries(batchAssumptionFields.map(field => [field.key, draft[field.key].trim() === '' ? field.nullable ? null : NaN : Number(draft[field.key])]));
    const next = { ...scenario, ...values, publication } as BatchScenario;
    const invalid = validateBatchScenario(next);
    if (invalid) { setError(invalid); return; }
    setError(''); onChange(next);
  };
  return <details className="batch-details batch-assumptions">
    <summary><Icon name="sliders" size={17} /> Change assumptions <span>Capacity, timing, retries, and cost</span></summary>
    <div className="batch-details-body">
      <p>Virtual documents, fixed service times, and assumed human review delays. Both strategies use the same final categories, review cases, arrival order, and capacities. This isolates work allocation; quality is not evaluated.</p>
      <form onSubmit={submit}>
        <div className="batch-assumption-fields">{batchAssumptionFields.map(field => <label key={field.key}><span>{field.label}</span><input type="number" min={field.min} max={field.max} step="any" inputMode="decimal" value={draft[field.key]} onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))} aria-describedby={`batch-field-${field.key}`} /><small id={`batch-field-${field.key}`}>{field.unit}</small></label>)}
          <label><span>Publication rule · both strategies</span><select value={publication} onChange={event => setPublication(event.target.value as PublicationPolicy)}><option value="batch">Wait for the entire batch</option><option value="independent">Publish each approved document</option></select><small>Illustrative policy; does not change actual runs.</small></label>
        </div>
        {error && <p className="batch-error" role="alert">{error}</p>}
        <div className="batch-form-actions"><button type="submit" className="primary">Apply and restart</button><button type="button" onClick={() => { const reset = { ...defaultBatchScenario, publication: scenario.publication }; setDraft(scenarioDraft(reset)); setPublication(reset.publication); setError(''); onChange(reset); }}>Reset assumptions</button></div>
      </form>
      <p className="batch-small">Each strategy has its own equally sized frontier pool. Retries repeat service and cost, then succeed; failed attempts do not authorize publication. Human monetary cost, storage, network transit, and shared generation are excluded. Code costs include policy, proposal validation, and publication. Prices are editable teaching assumptions, not provider rates.</p>
    </div>
  </details>;
}

function Totals({ traces }: { traces: BatchTrace[] }) {
  const values = traces.map(trace => batchSnapshot(trace, trace.end));
  const avoided = values[1].frontierCalls - values[0].frontierCalls;
  const saving = values[0].cost === null || values[1].cost === null ? null : values[1].cost - values[0].cost;
  const proportion = relativeBatchDifference(values[1].frontierCalls, values[0].frontierCalls);
  return <details className="batch-details">
    <summary><Icon name="layers" size={17} /> Workload totals <span>Complete scenario · independent of playback</span></summary>
    <div className="batch-details-body">
      <div className="batch-table-scroll"><table className="batch-table"><thead><tr><th scope="col">Modeled measure</th><th scope="col">Disaggregated</th><th scope="col">Frontier for every classification</th></tr></thead><tbody>
        {([
          ['Bounded attempts', ...values.map(value => value.boundedCalls)],
          ['Frontier attempts', ...values.map(value => value.frontierCalls)],
          ['Total model attempts', ...values.map(value => value.totalCalls)],
          ['Documents reviewed', ...traces.map(trace => trace.scenario.exceptions)],
          ['Searchable documents', ...values.map(value => value.counts.searchable)],
          ['First searchable result', ...traces.map(trace => trace.firstSearchableAt === null ? 'Unavailable' : batchSeconds(trace.firstSearchableAt))],
          ['Batch completion (includes review)', ...traces.map(trace => batchSeconds(trace.end))],
          ['Machine work consumed (not wall time)', ...values.map(value => batchSeconds(value.machineSeconds))],
          ['Assumed review wait consumed (not wall time)', ...values.map(value => batchSeconds(value.reviewWorkSeconds))],
          ['Estimated cost · USD, included operations', ...values.map(value => batchMoney(value.cost))],
          ['Quality / accuracy', 'Not evaluated', 'Not evaluated'],
        ] as (string | number)[][]).map(([title, system, frontier]) => <tr key={title}><th scope="row">{title}</th><td>{system}</td><td>{frontier}</td></tr>)}
      </tbody></table></div>
      <p>{avoided >= 0 ? `${avoided} frontier calls avoided` : `${Math.abs(avoided)} additional frontier calls`}{proportion === null ? ' · percentage unavailable with a zero baseline.' : ` · ${(Math.abs(proportion) * 100).toFixed(0)}% ${proportion >= 0 ? 'fewer' : 'more'} than baseline.`} Estimated saving: {saving === null ? 'unavailable because a cost is unknown' : `${saving < 0 ? '−' : ''}${batchMoney(Math.abs(saving))}`}. Fewer frontier calls are not the same as an equal percentage reduction in cost.</p>
      <p className="batch-small">Request attempts count when started, including retries. The one-call baseline assumes a classification contract with the same taxonomy and publication safeguards; it is not the existing Interpret adapter. Time uses one deterministic scheduler with the same monotonic playback mapping in both lanes. Fixed timing assumptions do not estimate real latency distributions.</p>
    </div>
  </details>;
}

function RecordedComparison({ recorded, selectedDocumentId, onSelectDocument, onExplore }: { recorded: RecordedBatchComparison; selectedDocumentId?: string; onSelectDocument?: (id: string) => void; onExplore?: (documentId?: string) => void }) {
  const evidence = useMemo(() => recordedBatchEvidence(recorded.events), [recorded.events]);
  const [localSelected, setLocalSelected] = useState('');
  const selected = evidence.documents.find(document => document.id === selectedDocumentId) || evidence.documents.find(document => document.id === localSelected) || evidence.documents[0];
  const difference = evidence.readable - evidence.frontierCalls;
  return <div className="batch-recorded">
    <div className="batch-recording-context"><span className="batch-provenance"><Icon name="runs" size={14} /> Whole recording</span><span>{recorded.run.mode === 'test-fixture' ? 'Simulated provider responses · executed runtime policy' : 'Recorded provider responses · executed runtime policy'}</span><span>{evidence.complete ? 'Recording complete' : 'Recording still in progress'}</span></div>
    <div className="batch-summary"><div><span>Against a hypothetical one-call baseline</span><strong>{difference >= 0 ? difference : Math.abs(difference)} <small>{difference >= 0 ? 'fewer frontier attempts' : 'additional frontier attempts'}</small></strong></div><p>{evidence.readable} readable documents · {evidence.frontierDocuments} sent to interpretation. {evidence.complete ? 'Alternative strategy has not been executed.' : 'Counts are provisional while this run continues.'}</p></div>
    <div className="batch-recorded-cards">
      <section><div className="batch-lane-title role-jev"><Icon name="jev" /><h2>This recorded batch</h2></div><dl><div><dt>Bounded attempts started</dt><dd>{evidence.boundedCalls}</dd></div><div><dt>Frontier attempts started</dt><dd>{evidence.frontierCalls}</dd></div><div><dt>Recorded searchable results</dt><dd>{evidence.searchable ?? 'Unavailable'}</dd></div><div><dt>First committed searchable result</dt><dd>{evidence.firstSearchableSeconds === null ? 'Unavailable' : batchSeconds(evidence.firstSearchableSeconds)}</dd></div></dl></section>
      <section><div className="batch-lane-title role-llm"><Icon name="sparkle" /><h2>Hypothetical baseline</h2></div><dl><div><dt>Bounded attempts</dt><dd>0</dd></div><div><dt>One frontier attempt / readable document</dt><dd>{evidence.readable}</dd></div><div><dt>Searchable results</dt><dd>Not executed</dd></div><div><dt>Time to searchable result</dt><dd>Not measured</dd></div></dl></section>
    </div>
    {selected && <section className="batch-recorded-document"><label><Icon name="file" size={17} /><span>Follow a recorded document</span><select value={selected.id} onChange={event => { setLocalSelected(event.target.value); onSelectDocument?.(event.target.value); }}>{evidence.documents.map(document => <option key={document.id} value={document.id}>{recorded.documentNames?.[document.id] || document.title}</option>)}</select></label><p><strong>{selected.route === 'accept' ? 'Category accepted' : selected.route === 'interpret' ? 'Interpretation selected' : 'No routing decision recorded'}</strong> · {selected.frontierCalls} frontier {selected.frontierCalls === 1 ? 'attempt' : 'attempts'}{selected.reason ? ` · ${selected.reason.replaceAll('_', ' ')}` : ''}</p>{onExplore && <button type="button" onClick={() => onExplore(selected.id)}><Icon name="play" size={16} /> Follow this decision</button>}</section>}
    <details className="batch-details"><summary><Icon name="info" size={17} /> Evidence and comparison limits</summary><div className="batch-details-body"><p>The baseline assumes one frontier classification request for each readable document, with equivalent taxonomy and publication safeguards. Its cost, latency, output quality, retries, and actual review behavior have not been measured. This is a call-allocation illustration, not an executed benchmark.</p><div className="batch-table-scroll"><table className="batch-table"><tbody><tr><th scope="row">Recorded event range</th><td>{evidence.eventRange}</td></tr><tr><th scope="row">Total recorded model attempts</th><td>{evidence.boundedCalls + evidence.frontierCalls}</td></tr><tr><th scope="row">Cost comparison</th><td>Unavailable — no comparable usage and price accounting</td></tr><tr><th scope="row">Quality effect</th><td>Not evaluated on a held-out reference set</td></tr><tr><th scope="row">Publication timing</th><td>Per-document commit records only; older batch counts cannot establish first-publication time.</td></tr><tr><th scope="row">Scope</th><td>Classification and interpretation attempts; shared retrieval or generation is excluded.</td></tr></tbody></table></div></div></details>
  </div>;
}

export function CompareStrategies({ recorded, initialSource, source: controlledSource, onSourceChange, publication = 'batch', selectedDocumentId, onSelectDocument, onExplore, embedded = false }: CompareStrategiesProps) {
  const [localSource, setLocalSource] = useState(initialSource || (recorded ? 'recorded' : 'illustrative'));
  const source = controlledSource || localSource;
  const [scenario, setScenario] = useState<BatchScenario>(() => ({ ...defaultBatchScenario, publication }));
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { const pause = () => setPlaying(false); window.addEventListener('pause-workflow-playback', pause); return () => window.removeEventListener('pause-workflow-playback', pause); }, []);
  const [speed, setSpeed] = useState(1);
  const [localSelected, setLocalSelected] = useState('virtual:001');
  const traces = useMemo(() => [buildBatchTrace('disaggregated', scenario), buildBatchTrace('frontier', scenario)], [scenario]);
  const duration = Math.max(...traces.map(trace => trace.end));
  const playbackClock = useMemo(() => createBatchPlaybackClock(traces), [traces]);
  const isPlaying = playing && time < duration && source === 'illustrative';
  const selected = traces[0].documents.find(document => document.id === selectedDocumentId) || traces[0].documents.find(document => document.id === localSelected) || traces[0].documents[0];
  const final = traces.map(trace => batchSnapshot(trace, trace.end));
  const avoided = final[1].frontierCalls - final[0].frontierCalls;
  const routine = traces[0].documents.find(document => document.kind === 'routine');
  const exception = traces[0].documents.find(document => document.kind === 'exception');

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    let previous = performance.now();
    const advance = (now: number) => {
      const elapsed = Math.min(.1, Math.max(0, (now - previous) / 1000)); previous = now;
      setTime(current => playbackClock.presentationToWork(playbackClock.workToPresentation(current) + elapsed * speed));
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, speed, playbackClock]);

  const changeSource = (next: 'illustrative' | 'recorded') => { setPlaying(false); setLocalSource(next); onSourceChange?.(next); };
  const select = (id?: string) => { if (!id) return; setLocalSelected(id); onSelectDocument?.(id); setTime(0); setPlaying(false); };
  const play = () => { if (time >= duration) { setTime(0); setPlaying(true); } else setPlaying(value => !value); };
  return <div className="batch-comparison">
    <header className="batch-page-heading">{!embedded && <div><h1>Compare strategies</h1><p>Same documents. Different allocation of work.</p></div>}<div className="batch-source-picker" role="group" aria-label="Comparison source"><button type="button" aria-pressed={source === 'recorded'} disabled={!recorded} onClick={() => changeSource('recorded')}>This recorded batch</button><button type="button" aria-pressed={source === 'illustrative'} onClick={() => changeSource('illustrative')}>Illustrative workload</button></div></header>
    <p className="page-task-guide">{source === 'recorded' ? 'These are retained results. Choose Illustrative workload to simulate both approaches, or Follow this decision to inspect a document.' : 'Choose a routine document or review case, then Compare workload to run both approaches. Read elapsed time, request counts, and outcomes on the same simulated clock.'}</p>
    <MeasurementGuide />
    {source === 'recorded' ? recorded ? <RecordedComparison recorded={recorded} selectedDocumentId={selectedDocumentId} onSelectDocument={onSelectDocument} onExplore={onExplore} /> : <div className="batch-empty"><p>No classification recording is selected.</p><button type="button" onClick={() => changeSource('illustrative')}>Explore an illustrative workload</button></div> : <>
      <div className="batch-recording-context"><span className="batch-provenance"><Icon name="layers" size={14} /> Virtual workload · no provider calls</span><span>{scenario.documents} documents · {scenario.documents - scenario.exceptions} routine · {scenario.exceptions} review cases</span><span>Timing and prices are assumptions</span></div>

      <div className="batch-follow-controls"><span><Icon name="file" size={17} /> Follow the same virtual document in both lanes</span><div role="group" aria-label="Virtual document type"><button type="button" aria-pressed={selected?.kind === 'routine'} disabled={!routine} onClick={() => select(routine?.id)}>Routine document</button><button type="button" aria-pressed={selected?.kind === 'exception'} disabled={!exception} onClick={() => select(exception?.id)}>Review case</button></div></div>
      <p className="batch-comparison-condition">Prepared final categories and review outcomes are held equal. Quality is not evaluated.</p>
      <div className="batch-playback" aria-label="Shared comparison playback">
        <button type="button" className="primary batch-play" onClick={play} disabled={!duration} aria-label={isPlaying ? 'Pause comparison' : time >= duration ? 'Replay comparison' : 'Compare workload'}><Icon name={isPlaying ? 'pause' : 'play'} size={18} /><span>{isPlaying ? 'Pause' : time >= duration ? 'Replay' : 'Compare workload'}</span></button>
        <button type="button" className="batch-icon-button" aria-label="Step both strategies forward" disabled={time >= duration} onClick={() => { setPlaying(false); setTime(nextBatchTime(traces, time)); }}><Icon name="step" size={18} /></button>
        <label className="batch-timeline"><span>Shared modeled time</span><input type="range" min={0} max={Math.max(.01, duration)} step="any" value={time} disabled={!duration} aria-label="Shared modeled work time" aria-valuetext={`${humanWaitDuration(time * 1000)} of ${humanWaitDuration(duration * 1000)} modeled time`} onChange={event => { setPlaying(false); setTime(Number(event.target.value)); }} /><output>{humanWaitDuration(time * 1000)} / {humanWaitDuration(duration * 1000)}</output></label>
        <label className="batch-speed"><span>Playback</span><select value={speed} onChange={event => setSpeed(Number(event.target.value))} aria-label="Comparison playback speed">{[.5, 1, 2, 4].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
        <button type="button" className="batch-finish" onClick={() => { setPlaying(false); setTime(duration); }}>See outcomes <Icon name="arrow" size={15} /></button>
      </div>
      <p className="batch-clock-note">Both lanes share one modeled clock. Playback condenses long waits and machine activity on one shared timeline; timing values remain unchanged. {scenario.publication === 'batch' ? 'Publication waits for all reviews in both strategies.' : 'Each approved document can publish independently in both strategies.'}</p>
      <section className="batch-summary" aria-label="Complete workload illustration"><div><span>At completion · illustrative classification workload</span><strong>{Math.abs(avoided)} <small>{avoided >= 0 ? 'frontier calls avoided' : 'additional frontier calls'}</small></strong></div><div className="batch-summary-pair"><span><b>{final[0].totalCalls}</b> total model attempts <small>Disaggregated</small></span><Icon name="arrow" size={17} /><span><b>{final[1].totalCalls}</b> total model attempts <small>Frontier for every document</small></span></div></section>
      <div className="batch-lanes">{traces.map(trace => <BatchLane key={trace.strategy} trace={trace} selectedId={selected?.id} time={time} playing={isPlaying} speed={speed} />)}</div>
      <div className="batch-secondary"><Totals traces={traces} /><Assumptions scenario={scenario} onChange={next => { setScenario(next); setTime(0); setPlaying(false); }} /></div>
    </>}
  </div>;
}
