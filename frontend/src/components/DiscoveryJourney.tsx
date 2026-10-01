/** @jsxImportSource react */
import { useMemo, useRef, useState } from 'react';
import type { LiveDiscoveryResponse, RunSnapshot } from '../lib/api.generated';
import type { LessonDocument } from '../lib/lessons';
import type { LiveLessonState } from '../lib/useLiveLesson';
import { useLessonPlayback } from '../lib/useLessonPlayback';
import { useMediaQuery } from '../lib/useMediaQuery';
import { discoveryFrontierAttempts, lessonState } from '../lib/lessonState';
import { discoveryPerformance } from '../lib/discoveryPerformance';
import { buildDiscoveryLessonGraph } from '../lib/discoveryLessonGraph';
import { discoveryTree, type DiscoveryTreeId } from '../lib/discoveryTree';
import { displayName } from '../lib/naming';
import { duration } from '../lib/timing';
import { measuredMs } from '../lib/performanceReport';
import { FlowCanvas } from './FlowCanvas';
import { Icon } from './Icon';
import { LessonDrawer } from './LessonDrawer';
import { PerformanceReport } from './PerformanceReport';
import { LiveElapsed } from './LiveInterpret';
import { Results } from './Results';
import { DiscoveryDecisionTree } from './DiscoveryDecisionTree';
import { DiscoveryLatencyBreakdown } from './DiscoveryLatencyBreakdown';
import { discoveryTimingAssumptions, discoveryTimingReference } from '../lib/discoveryTimingAssumptions';

type Panel = 'timing' | 'sources' | 'results' | 'component' | 'tree' | 'about' | null;

/** Results expand beside the journey, never insert content above it. */
export function DiscoveryJourney({ snapshot, documents, liveState, autoPlay, onPrepared, simulation = false, requestTitle }: {
  snapshot: RunSnapshot; documents: LessonDocument[]; liveState: LiveLessonState<LiveDiscoveryResponse>;
  autoPlay?: boolean; onPrepared: () => void; simulation?: boolean; requestTitle?: string;
}) {
  const unavailable = liveState.status === 'pending' || liveState.status === 'failed';
  const returned = liveState.status === 'complete' ? liveState.response : undefined;
  const [panel, setPanel] = useState<Panel>(null);
  const playback = useLessonPlayback(snapshot, '', !unavailable && !panel && autoPlay, liveState.status, 'capabilities');
  const phase = playback.current?.capability;
  const completedNodes = playback.steps.slice(0, Math.max(0, playback.position - 1)).flatMap(step => step.capability?.kind === 'checkpoint' ? [step.capability.node] : []);
  if (phase?.kind === 'checkpoint') completedNodes.push(phase.node);
  const completedEdges = playback.steps.slice(0, Math.max(0, playback.position - 1)).flatMap(step => step.capability?.kind === 'transfer' ? [step.capability.edge!] : []);
  const [componentId, setComponentId] = useState('intent');
  const [treeId, setTreeId] = useState<DiscoveryTreeId>('judgment');
  const [detailed, setDetailed] = useState(false);
  const detailToggle = useRef<HTMLButtonElement>(null);
  const [sourceExample, setSourceExample] = useState(documents[0]?.example_id);
  const [sourceFromResult, setSourceFromResult] = useState(false);
  const narrow = useMediaQuery('(max-width: 760px)');
  const visible = useMemo(() => unavailable ? [] : snapshot.events.slice(0, playback.cursor), [snapshot, playback.cursor, unavailable]);
  const { execution } = useMemo(() => lessonState(visible, []), [visible]);
  const tree = useMemo(() => discoveryTree(visible), [visible]);
  const treeNode = tree.nodes.find(item => item.id === treeId)!;
  const graph = useMemo(() => buildDiscoveryLessonGraph({ run: snapshot.run, execution, selected: null, focused: '', expanded: false, moving: true, speed: 1, narrow }), [snapshot.run, execution, narrow]);
  const nodes = useMemo(() => graph.nodes.map(node => ({ ...node, data: { ...node.data,
    subtitle: ({ jev: 'System 1 Model', llm: 'Frontier model', runtime: 'Code', output: 'Output' } as Record<string, string>)[node.data.role] || node.data.subtitle,
  } })), [graph.nodes]);
  // Playback controls do not recreate the nodes or restart a moving marker.
  const edges = useMemo(() => graph.edges.map(edge => {
    const last = visible.at(-1);
    const current = !!edge.data?.current && last?.type === 'edge_selected' && edge.data.packetKey === `${snapshot.run.id}-${last.sequence}`;
    return { ...edge, data: edge.data ? { ...edge.data, current, flowing: playback.playing && current, moving: playback.playing && current,
      packetKey: current ? edge.data.packetKey : undefined, packetLabel: '01', travelDuration: .7, speed: playback.speed } : undefined };
  }), [graph.edges, visible, snapshot.run.id, playback.playing, playback.speed]);
  const report = useMemo(() => returned ? discoveryPerformance(returned) : undefined, [returned]);
  const prefixReport = useMemo(() => returned ? discoveryPerformance({ ...returned, metrics: null, snapshot: { ...snapshot, events: visible, run: { ...snapshot.run, result: execution.result || null } } }) : undefined, [returned, snapshot, visible, execution.result]);
  const node = graph.nodes.find(item => item.id === componentId);
  const component = prefixReport?.components.find(item => item.id === (componentId === 'synthesize' ? 'compose' : componentId));
  const instance = execution.instances[graph.selections[componentId]];
  const source = documents.find(item => item.example_id === sourceExample) || documents[0];
  const complete = playback.position >= playback.count;
  const open = (next: Panel) => { playback.pause(); setPanel(next); };
  const openSource = (id?: string, passageId?: string) => {
    setSourceExample(documents.find(item => item.document.id === id || item.passages.some(passage => passage.id === passageId))?.example_id || documents[0]?.example_id);
    setSourceFromResult(true); open('sources');
  };
  const outcome = execution.result;
  const status = liveState.status === 'pending' ? 'Executing live request' : liveState.status === 'failed' ? 'Live request unavailable'
    : returned ? `Returned run · ${snapshot.run.status.replaceAll('_', ' ')}` : 'Prepared example · simulated models';
  return <>
    {simulation && <header className="discovery-run-toolbar"><div className="discovery-request"><span className="eyebrow">Following one request</span><h2>{requestTitle || String(snapshot.run.request.query)}</h2></div><div className="discovery-run-actions"><button className="primary" onClick={playback.toggle}><Icon name={playback.playing ? 'pause' : 'play'} size={18} />{playback.playing ? 'Pause simulation' : complete ? 'Replay simulation' : playback.position ? 'Continue simulation' : 'Run simulation'}</button></div></header>}
    <div className="discovery-run-summary" aria-label={returned ? 'Whole returned run' : 'Execution summary'}>
      <div className="discovery-summary-scope"><strong>{returned ? 'Whole returned run' : liveState.status === 'idle' ? 'Prepared example' : 'Live request'}</strong>
        <span>{returned ? 'Independent of replay position' : liveState.status === 'pending' ? 'Waiting for recorded steps' : liveState.status === 'failed' ? 'No response substituted' : simulation ? 'Prepared responses; no live timing' : 'Run to measure real models'}</span></div>
      {report ? <dl className="discovery-summary-metrics"><div><dt>Overall elapsed</dt><dd>{report.elapsed.value}</dd></div><div><dt>Frontier attempts</dt><dd>{returned!.frontier_calls}</dd></div><div><dt>{returned!.example_id === 'find' ? 'Retrieval accuracy' : 'Answer accuracy'}</dt><dd>{report.quality.value}</dd></div></dl>
        : <div className="discovery-summary-preview">{liveState.status === 'pending' ? <><span>Browser wait</span><LiveElapsed startedAt={liveState.startedAt} /></> : <span>{liveState.status === 'failed' ? 'Retry with Run, or open the prepared example.' : 'System 1 judges. Runtime rules select code or frontier work.'}</span>}</div>}
      <button className="secondary discovery-details-button" disabled={unavailable} onClick={() => open(report ? 'timing' : 'about')}><Icon name={report ? 'clock' : 'info'} size={16} />{report ? 'Timing & checks' : 'How it works'}</button>
    </div>
    <div className="discovery-replay-context">
      <span role="status">{status}{!unavailable && <> · <b>{returned ? 'Recorded replay' : 'Illustrated replay'}</b></>}</span>
      <div>{!unavailable && <span className="discovery-prefix-count">At this step: {discoveryFrontierAttempts(visible)} frontier requests</span>}
        <button ref={detailToggle} className="quiet" disabled={unavailable} aria-pressed={detailed} onClick={() => { playback.pause(); setDetailed(value => !value); }}><Icon name={detailed ? 'workflow' : 'layers'} size={14} />{detailed ? 'Decision tree' : 'All steps'}</button></div>
    </div>
    <div className="discovery-visual-toolbar">
      <div className="discovery-playback lesson-playback" role="group" aria-label="Workflow playback controls">
        <div className="discovery-playback-buttons">
          <button className="icon-button" disabled={unavailable} onClick={playback.toggle} aria-label={playback.playing ? 'Pause lesson' : 'Play lesson'} title={playback.playing ? 'Pause replay' : complete ? 'Replay recorded flow' : 'Play recorded flow'}><Icon name={playback.playing ? 'pause' : 'play'} size={18} /></button>
          <button className="icon-button" aria-label="Previous step" disabled={unavailable || !playback.position} onClick={() => playback.seek(playback.position - 1)}><Icon name="stepBack" /></button>
          <button className="icon-button" aria-label="Next step" disabled={unavailable || complete} onClick={() => playback.seek(playback.position + 1)}><Icon name="step" /></button>
          <label className="lesson-speed"><span className="sr-only">Playback speed</span><select aria-label="Playback speed" disabled={unavailable} value={playback.speed} onChange={event => playback.setSpeed(Number(event.target.value))}>{[.5, 1, 1.5, 2].map(speed => <option value={speed} key={speed}>{speed}×</option>)}</select></label>
          <button className="quiet" onClick={() => { setSourceFromResult(false); open('sources'); }}><Icon name="file" size={16} />View sources</button>
          <button className={`secondary ${outcome ? 'has-results' : ''}`} disabled={!outcome} onClick={() => open('results')}><Icon name="checkCircle" size={16} />View results</button>
        </div>
        <input type="range" aria-label="Lesson progress" disabled={unavailable} min={0} max={playback.count} value={unavailable ? 0 : playback.position} onChange={event => playback.seek(Number(event.target.value))} />
      </div>
      <DiscoveryLatencyBreakdown snapshot={snapshot} unavailable={unavailable} />
    </div>
    <div className={`lesson-flow discovery-journey-canvas ${narrow ? 'is-narrow' : ''} ${detailed ? 'is-detailed' : 'is-tree'}`}>
      {unavailable ? <div className="discovery-awaiting">
        {liveState.status === 'pending' ? <><div className="live-workflow-pending"><span>Judge intent</span><Icon name="arrow" /><span>Runtime selects next work</span></div><p>Executing with live models. The recorded route appears when the request returns.</p><small>This is waiting time, not an animated live trace.</small></>
          : <><Icon name="alert" size={28} /><h3>Could not complete the request</h3><p role="alert">{liveState.status === 'failed' && displayName(liveState.message)}</p><button className="secondary" onClick={onPrepared}>Return to prepared example</button></>}
      </div> : detailed ? <FlowCanvas nodes={nodes} edges={edges} onSelect={id => { setComponentId(id); open('component'); }} layoutKey={`discovery-lesson-${narrow}`} minFitZoom={narrow ? .65 : .3} fitPadding={narrow ? .08 : .06} label="Discovery capability flow" />
        : <DiscoveryDecisionTree tree={tree} snapshot={snapshot} phase={phase} completedNodes={completedNodes} completedEdges={completedEdges} cursor={playback.cursor} cycle={playback.cycle} beatDuration={playback.current?.duration} playing={playback.playing} speed={playback.speed} onInspect={id => { setTreeId(id); open('tree'); }} />}
    </div>
    {panel && <LessonDrawer title={panel === 'timing' ? 'Timing & checks' : panel === 'sources' ? 'Source documents' : panel === 'results' ? 'Results at this replay step' : panel === 'tree' ? treeNode.title : panel === 'component' ? node?.data.title || 'Component details' : 'How this workflow works'} onClose={() => setPanel(null)}>
      {panel === 'timing' && report && <><p>Whole returned run. These measurements stay fixed when you pause, change speed, or rewind the illustrated replay.</p><PerformanceReport report={report} /><button className="secondary" onClick={() => { setPanel(null); onPrepared(); }}>Return to prepared example</button></>}
      {panel === 'sources' && <>{sourceFromResult && <button className="text-button" onClick={() => setPanel('results')}>Back to results</button>}<label className="field">Source<select value={source?.example_id} onChange={event => setSourceExample(event.target.value)}>{documents.map(item => <option value={item.example_id} key={item.example_id}>{item.title}</option>)}</select></label><pre className="lesson-source">{source?.text}</pre><p className="micro">{source?.document.synthetic ? 'Synthetic source' : 'Retained source'} · {source?.document.filename}</p></>}
      {panel === 'results' && <Results run={snapshot.run} result={outcome} documents={documents.map(item => item.document)} onSource={openSource} />}
      {panel === 'tree' && <><p>At this replay step · grouped capabilities, separate responsibilities.</p><p><strong>{treeNode.status}</strong> · {treeNode.roles}. {treeNode.detail}</p>
        {treeId.includes('plan') && !treeNode.selected && <p>This branch is not selected by the current routing decision. Its latency is not borrowed from the selected planning capability. Inspect all steps for any earlier attempts.</p>}
        {(treeId === 'judgment' || treeId === 'code-plan' || treeId === 'frontier-plan') && <><h3>System 1 returns a signal; runtime rules select the route.</h3>{tree.decision ? <dl className="lesson-facts"><dt>Bounded intent</dt><dd>{tree.decision.signal.kind === 'choice' ? `${tree.decision.signal.choice} · ${Math.round(tree.decision.signal.confidence * 100)}% confidence` : 'Inspect recorded signal'}</dd><dt>Recorded threshold</dt><dd>{typeof tree.decision.threshold === 'number' ? `${Math.round(tree.decision.threshold * 100)}%` : 'Unavailable'}</dd><dt>Runtime rule</dt><dd>{displayName(tree.decision.explanation)}</dd><dt>Policy version</dt><dd>{tree.decision.policy_version || 'Unavailable'}</dd></dl> : <p>No routing decision is visible yet.</p>}<p>Clear, untied Find signals use code planning. Complex or uncertain signals use frontier planning; confident unsupported requests stop before search. The same signal and policy select the same route. Model outputs can vary.</p></>}
        {(treeId === 'evidence' || treeId === 'sources' || treeId === 'answer') && <><h3>The runtime controls whether an answer is composed.</h3><p>{tree.outputEdge ? displayName(tree.outputEdge.label || 'Inspect the recorded route') : 'This gate has not selected an output at the current replay step.'}</p><p>Composition requires accepted evidence and a plan that requests an answer. Otherwise the workflow returns sources or an evidence gap. Frontier planning can revise the intent; the recorded output route governs this choice.</p><p>Code checks citation IDs and exact quotes. System 1 screens support for each valid claim. Claims can be withheld; these checks do not prove factual accuracy.</p></>}
        {prefixReport?.components.filter(item => treeNode.componentIds.includes(item.id)).map(item => <section className="tree-component-evidence" key={item.id}><h3>{item.name}</h3><strong>{item.elapsedMs === null ? item.timingLabel || 'Not measured' : duration(item.elapsedMs)}</strong>{item.model && <p>{item.model}</p>}<p>{item.detail}</p><p>{item.quality.label}: {item.quality.value}. {item.quality.detail}</p></section>)}
        {treeId === 'judgment' && tree.decision && <p>Initial runtime policy evaluation: {duration(measuredMs(tree.decision.policy_elapsed_ms))}. This is separate from later relevance and support rules.</p>}
        {!returned && <p>Prepared model responses have no measured live API latency. Run this workflow to measure its actual selected capabilities.</p>}
        <button className="secondary" onClick={() => { setPanel(null); setDetailed(true); requestAnimationFrame(() => detailToggle.current?.focus()); }}>Inspect all steps</button>
        <details><summary>Recorded evidence for this choice</summary><pre className="lesson-source">{JSON.stringify(treeId === 'judgment' || treeId.includes('plan') ? tree.decision || {} : { outputRoute: tree.outputEdge, acceptedPassages: tree.evidenceCount, visibleInstances: execution.instances }, null, 2)}</pre></details>
      </>}
      {panel === 'component' && <><p>At this replay step · {playback.cursor} of {snapshot.events.length} recorded events.</p><dl className="lesson-facts"><dt>Capability</dt><dd>{node?.data.subtitle || ({ jev: 'System 1 Model', llm: 'Frontier model', runtime: 'Runtime & code', output: 'Results' } as Record<string, string>)[node?.data.role || '']}</dd><dt>State</dt><dd>{node?.data.state === 'queued' ? 'Not started at this step' : node?.data.state?.replaceAll('_', ' ')}</dd><dt>Purpose</dt><dd>{node?.data.detail}</dd></dl>
        {component && <PerformanceReport compact report={{ title: 'Component evidence at this step', scope: 'Visible recorded attempts only', elapsed: { label: 'Service work', value: component.elapsedMs === null ? component.timingLabel || 'Not measured' : duration(component.elapsedMs), detail: component.detail }, quality: component.quality, outcome: { label: 'State', value: node?.data.state || 'Unavailable', detail: 'No later events are included.' }, components: [component] }} />}
        <details><summary>Recorded input, decisions & events</summary><pre className="lesson-source">{JSON.stringify({ instance, decisions: execution.decisions[graph.selections[componentId]] || [] }, null, 2)}</pre></details></>}
      {panel === 'about' && <><p>System 1 judges intent and evidence. Runtime rules select retrieval, frontier planning or composition, and validation.</p><p>Live Run uses models and normal provider charges apply. Run simulation makes no API calls. Model confidence and passed checks are not measured accuracy.</p><p>Marker 01 follows the request, its search plan, then the collected evidence and result. Code executes deterministic work; System 1 makes bounded judgments; frontier models plan complex searches and draft answers when selected.</p><h3>Timing assumptions</h3><p>The System 1 simulation uses {discoveryTimingAssumptions.bounded} ms per API request, rounded from the median of {discoveryTimingReference.sample_count} retained live {discoveryTimingReference.model} requests on {discoveryTimingReference.checked_on}. Those requests ranged from {Math.round(discoveryTimingReference.request_elapsed_ms.min)} to {Math.round(discoveryTimingReference.request_elapsed_ms.max)} ms. They include client/network time and response handling; server inference time was not measured. This small synthetic recording is a pacing reference, not a benchmark or a measurement of this simulation.</p><p>Code uses an illustrative {discoveryTimingAssumptions.code} ms per operation; frontier planning and drafting use 2.4 and 4.6 seconds. Live models always use their own returned timings. The app currently integrates Jev; no Koa model timing is measured here.</p><p>Each service has a connected rail. The marker crosses it once per visit, then follows the arrow to the next service. Slower movement means more service work; it does not mean repeated requests. Internal checks and parallel tasks share that visit. A real later return is labeled with its visit number.</p><p>The latency breakdown sums service work across the whole recording, including parallel requests. It is independent of replay position and is not overall elapsed time. Prepared simulations use labeled assumptions. Very short work and handoffs are stretched so you can follow them. Playback speed changes the illustration; Timing & checks keeps the actual measurements.</p></>}
    </LessonDrawer>}
  </>;
}
