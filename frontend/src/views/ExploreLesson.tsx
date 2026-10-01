import { displayName } from '../lib/naming';
import { useMemo, useState } from 'react';
import type { LiveClassificationResponse, LiveClassificationComparisonResponse, LiveClassificationComparisonRequest, RunSnapshot } from '../lib/api.generated';
import { api } from '../lib/api';
import { useLiveLesson } from '../lib/useLiveLesson';
import { useFrontierModel } from '../lib/useFrontierModel';
import { FrontierModelSelect } from '../components/FrontierModelSelect';
import type { LessonDocument } from '../lib/lessons';
import { useLessonPlayback } from '../lib/useLessonPlayback';
import { discoveryFrontierAttempts, lessonState } from '../lib/lessonState';
import { classificationDecision, policyReason, policyTitles } from '../lib/classification';
import { buildExecutionGraph } from '../components/ExecutionGraph';
import { FlowCanvas } from '../components/FlowCanvas';
import { LessonFlow } from '../components/LessonFlow';
import { LessonLatency } from '../components/LessonLatency';
import { RecordedWorkflowTiming } from '../components/WorkflowTimingSummary';
import { ClassificationMeasurement } from '../components/ClassificationMeasurement';
import { LiveClassificationJourney } from '../components/LiveClassificationJourney';
import { LessonDrawer } from '../components/LessonDrawer';
import { Results } from '../components/Results';
import { Icon } from '../components/Icon';
import type { ReplayStep } from '../lib/replay';
import { useMediaQuery } from '../lib/useMediaQuery';

export function ExploreLesson({ snapshot, documents, example, onChoose, autoPlay = false, next, nextLabel, onCompare, compareLabel = 'Compare this batch', onExperiment, recorded = false, allowLiveRun = false, primaryRun, mixedLive = false, liveBounded = false }: {
  snapshot: RunSnapshot; documents: LessonDocument[]; example: string; onChoose: (id: string) => void; autoPlay?: boolean;
  next: () => void; nextLabel: string; onCompare: () => void; compareLabel?: string; onExperiment: () => void; recorded?: boolean; allowLiveRun?: boolean;
  primaryRun?: { label: string; action: () => void; disabled?: boolean }; mixedLive?: boolean; liveBounded?: boolean;
}) {
  const classification = snapshot.run.kind === 'classification';
  const subject = documents.find(item => item.example_id === example) || documents[0];
  const measurement = useLiveLesson<LiveClassificationComparisonResponse>();
  const single = useLiveLesson<LiveClassificationResponse>();
  const [frontierModel, selectFrontierModel] = useFrontierModel();
  const [experience, setExperience] = useState<'simulation' | 'live'>(() => typeof window !== 'undefined' && window.sessionStorage.getItem('classification-experience') === 'live' ? 'live' : 'simulation');
  const [metricsView, setMetricsView] = useState(false);
  const canChooseExperience = allowLiveRun && !recorded && classification && ['clear', 'policy', 'ambiguous', 'proposed', 'finalized'].includes(subject.example_id);
  const measurementAvailable = canChooseExperience && experience === 'live';
  const [drawer, setDrawer] = useState<'source' | 'why' | 'inspect' | null>(null);
  const [sourceId, setSourceId] = useState(subject?.document.id);
  const playback = useLessonPlayback(snapshot, classification ? subject?.document.id || '' : '', autoPlay && !canChooseExperience && !primaryRun && (recorded || mixedLive));
  const visible = useMemo(() => snapshot.events.slice(0, playback.cursor), [snapshot, playback.cursor]);
  const state = useMemo(() => lessonState(visible, documents.map(item => item.document.id)), [visible, documents]);
  const decision = classificationDecision(state.execution, subject?.document.id || '');
  const signal = decision?.signal.kind === 'choice' ? decision.signal : undefined;
  const current = playback.current && 'stage' in playback.current ? playback.current as ReplayStep : undefined;
  const startMeasurement = () => {
    if (!measurementAvailable || single.inFlight) return;
    playback.pause();
    void measurement.start(() => api.compareClassification(subject.example_id as LiveClassificationComparisonRequest['example_id'], subject.document.content_version, frontierModel));
  };
  const startSingle = () => {
    if (!measurementAvailable || measurement.inFlight) return;
    playback.pause(); setMetricsView(false); setDrawer(null);
    void single.start(() => api.classifyLesson(subject.example_id as LiveClassificationComparisonRequest['example_id'], subject.document.content_version, frontierModel));
  };
  const narrow = useMediaQuery('(max-width: 760px)');
  const discoveryGraph = useMemo(() => classification ? undefined : buildExecutionGraph({ run: snapshot.run, execution: state.execution, selected: null, focused: '', expanded: false, moving: true, speed: 1, narrow }), [classification, snapshot.run, state.execution, narrow]);
  const discovery = useMemo(() => discoveryGraph ? { ...discoveryGraph, edges: discoveryGraph.edges.map(edge => ({ ...edge, data: edge.data ? {
    ...edge.data, flowing: playback.playing, moving: playback.playing && !!edge.data.moving, speed: playback.speed,
  } : undefined })) } : undefined, [discoveryGraph, playback.playing, playback.speed]);
  const source = documents.find(item => item.document.id === sourceId) || subject;
  const openDrawer = (which: 'source' | 'why' | 'inspect') => { playback.pause(); setDrawer(which); };
  const statement = !classification ? state.execution.result ? mixedLive ? liveBounded ? 'Code checks citations; live bounded judgments screen support. Both have distinct limits.' : 'Citation checks executed; semantic support signals are prepared.' : 'Prepared result. Inspect its citations and source passages.' : 'Follow each capability selected for this request.'
    : !decision ? 'A bounded judgment becomes an action only after the runtime checks it.'
      : decision.selected_route === 'accept' ? 'The runtime accepts this category without frontier interpretation.'
        : policyReason(decision) === 'mixed_purpose' ? 'The guard requires review despite high confidence.' : 'Uncertainty selects interpretation. A proposal still needs approval.';
  const sourceOpen = (id?: string, passageId?: string) => {
    setSourceId(id || documents.find(item => item.passages.some(passage => passage.id === passageId))?.document.id || subject?.document.id); openDrawer('source');
  };
  return <section className="explore-lesson" aria-label={classification ? 'Classification lesson' : 'Discovery lesson'}>
    {canChooseExperience && <>
      <div className="lesson-experience-choice" role="group" aria-label="Classification mode">{(['simulation', 'live'] as const).map(mode => <button key={mode} className="secondary small" aria-pressed={experience === mode} disabled={single.inFlight || measurement.inFlight} onClick={() => { playback.seek(0); single.leave(); measurement.leave(); setMetricsView(false); setExperience(mode); window.sessionStorage.setItem('classification-experience', mode); }}>{mode === 'simulation' ? 'Simulation' : 'Live models'}</button>)}<span>{experience === 'simulation' ? 'Prepared responses · no model calls · no setup needed' : 'Real model requests · provider charges apply'}</span></div>
      <ol className="classification-guide" aria-label="How to process a document"><li><b>1</b>Choose a document</li><li><b>2</b>{measurementAvailable ? 'Run document' : 'Run simulation'}</li><li><b>3</b>Follow its route</li></ol>
    </>}
    {classification && <div className="example-choices" aria-label="Choose a document to follow">
      {documents.filter(item => recorded || item.example_id === subject.example_id || ['clear', 'ambiguous', 'proposed'].includes(item.example_id)).map(item => <button key={item.example_id} aria-pressed={subject.example_id === item.example_id}
        className={`example-choice ${subject.example_id === item.example_id ? 'selected' : ''}`} onClick={() => onChoose(item.example_id)}>
        <Icon name="file" size={22} /><span><strong>{item.title}</strong><small>{item.cue}</small></span><Icon name={subject.example_id === item.example_id ? 'checkCircle' : 'chevron'} size={16} />
      </button>)}
    </div>}
    <div className="lesson-stage">
      <header className={`lesson-subject ${canChooseExperience ? 'classification-input' : ''}`}><div><span className="eyebrow">{canChooseExperience ? 'Selected document' : classification ? 'Following one document' : 'Following one request'}</span><h2>{classification ? subject?.title : String(snapshot.run.request.query)}</h2>{canChooseExperience && <p>{measurementAvailable ? 'Run this document to see its judgment, selected route, and result.' : 'Run the simulation to follow this document through its recorded workflow.'}</p>}</div>
        <div className="lesson-subject-actions">{measurementAvailable && <button className="primary classification-run" disabled={single.inFlight || measurement.inFlight} onClick={startSingle}><Icon name={single.inFlight ? 'clock' : 'play'} size={18} />{single.inFlight ? 'Processing document…' : single.state.status === 'failed' || single.state.status === 'complete' && single.state.response.strategy.status === 'failed' ? 'Retry document' : single.state.status === 'complete' ? 'Run again' : 'Run document'}</button>}
          {!measurementAvailable && !metricsView && <button className={`primary ${canChooseExperience ? 'classification-run' : ''}`} disabled={primaryRun?.disabled} onClick={primaryRun?.action || playback.toggle}><Icon name={playback.playing ? 'pause' : 'play'} size={16} />{primaryRun ? primaryRun.label : canChooseExperience || !recorded && !mixedLive ? playback.playing ? 'Pause simulation' : playback.position >= playback.count ? 'Replay simulation' : playback.position ? 'Continue simulation' : 'Run simulation' : playback.playing ? 'Pause' : playback.position >= playback.count ? 'Replay' : playback.position ? 'Continue' : classification && subject.example_id === 'clear' ? 'Follow this invoice' : 'Play this example'}</button>}<button className="quiet small" onClick={() => sourceOpen()}><Icon name="file" size={15} />{classification ? 'View document' : 'View sources'}</button>
</div></header>
      {measurementAvailable && <div className="classification-run-options"><FrontierModelSelect value={frontierModel} disabled={single.inFlight || measurement.inFlight} onChange={model => { selectFrontierModel(model); single.leave(); measurement.leave(); playback.pause(); }} /><small>Used only if the runtime selects interpretation. Live model calls; approval and publication are separate.</small></div>}
      {measurementAvailable && <div className="metrics-view-switch" role="group" aria-label="Document view"><button className="secondary small" aria-pressed={!metricsView} onClick={() => setMetricsView(false)}>Workflow</button><button className="secondary small" aria-pressed={metricsView} onClick={() => { playback.pause(); setMetricsView(true); }}><Icon name="clock" size={16} />Compare latency & quality</button></div>}
      {metricsView && measurementAvailable ? <ClassificationMeasurement state={measurement.state} disabled={measurement.inFlight || single.inFlight} onRun={startMeasurement} /> : measurementAvailable ? <LiveClassificationJourney state={single.state} inFlight={single.inFlight || measurement.inFlight} snapshot={snapshot} documentId={subject.document.id} onRun={startSingle} onLeave={single.leave} inspectionOpen={drawer !== null} /> : <>
      <div className={classification ? 'lesson-playback-with-timing' : undefined}>
      <div className="lesson-playback-tools">
      <div className="lesson-playback lesson-playback-top" role="group" aria-label="Lesson playback">
        <button className="icon-button" onClick={playback.toggle} aria-label={playback.playing ? 'Pause lesson' : 'Play lesson'}><Icon name={playback.playing ? 'pause' : 'play'} size={18} /></button>
        <button className="icon-button" aria-label="Previous step" disabled={!playback.position} onClick={() => playback.seek(playback.position - 1)}><Icon name="stepBack" /></button>
        <button className="icon-button" aria-label="Next step" disabled={playback.position >= playback.count} onClick={() => playback.seek(playback.position + 1)}><Icon name="step" /></button>
        <input type="range" aria-label="Lesson progress" min={0} max={playback.count} value={playback.position} onChange={event => playback.seek(Number(event.target.value))} />
        <label className="lesson-speed"><span className="sr-only">Playback speed</span><select aria-label="Playback speed" value={playback.speed} onChange={event => playback.setSpeed(Number(event.target.value))}>{[.5, 1, 1.5, 2].map(speed => <option value={speed} key={speed}>{speed}×</option>)}</select></label>
        <button className="quiet small" onClick={() => openDrawer('inspect')}><Icon name="layers" size={15} />Inspect</button>
      </div>
      {classification && <p className="lesson-playback-hint">Playback speed changes the animation only.</p>}
      </div>
      {classification && <RecordedWorkflowTiming run={snapshot.run} events={snapshot.events} documentId={subject.document.id} />}
      </div>
      {classification ? <LessonFlow run={snapshot.run} events={visible} documentId={subject.document.id} current={current} playing={playback.playing} speed={playback.speed} onInspect={() => openDrawer('why')} />
        : discovery && <div className="lesson-flow discovery-lesson-flow"><FlowCanvas {...discovery} onSelect={() => openDrawer('inspect')} layoutKey={`discovery-${narrow}`} minFitZoom={narrow ? .65 : .42} label="Intent, planning, retrieval, screening, composition and validation" /></div>}
      <div className="lesson-receipt" aria-label="Current decision">
        {classification ? <><div><span>Judgment · System 1</span><strong>{signal ? `${signal.choice} · ${Math.round(signal.confidence * 100)}%` : 'Not recorded yet'}</strong></div>
          <div><span>Rule · Runtime</span><strong>{decision ? policyReason(decision) === 'mixed_purpose' ? 'Proposed-terms guard' : decision.selected_route === 'accept' ? 'Acceptance passed' : 'Interpretation required' : 'Threshold + guards'}</strong></div>
          <div><span>Action · Selected capability</span><strong>{decision ? decision.selected_route === 'accept' ? 'Accept category' : 'Frontier interpretation' : 'Await the judgment'}</strong></div></>
          : <><div><span>Bounded judgment</span><strong>Intent · relevance · support</strong></div><div><span>Runtime & code</span><strong>Route · retrieve · validate</strong></div><div><span>Frontier work</span><strong>{discoveryFrontierAttempts(visible)} requests started</strong></div></>}
      </div>
      <div className="lesson-explanation"><p>{statement}</p><button className="text-button" onClick={() => openDrawer('why')}>Why?<Icon name="chevron" size={13} /></button></div>
      {classification && <LessonLatency run={snapshot.run} events={visible} documentId={subject.document.id} onCompare={onCompare} />}
      <div className="lesson-outcome" aria-live="polite">
        <span><Icon name={classification && state.status(subject.document.id) === 'Searchable' ? 'checkCircle' : 'workflow'} size={17} />{classification ? `${state.status(subject.document.id)}${state.publishedCategories.get(subject.document.id) ? ` as ${state.publishedCategories.get(subject.document.id)}` : ''}` : state.execution.result ? 'Results available' : 'Ready to explore'}</span>
        {classification && <small>{state.published.size} searchable · {state.usage.frontierCalls} frontier calls{state.awaiting ? ` · ${state.awaiting} awaiting review` : ''}</small>}
      </div>
      </>}
    </div>
    {!classification && state.execution.result && <Results run={snapshot.run} result={state.execution.result} documents={documents.map(item => item.document)} onSource={sourceOpen} />}
    <div className="lesson-next"><button className="text-button" onClick={next}>{nextLabel}<Icon name="arrow" size={16} /></button><div>{classification && !measurementAvailable && state.published.has(subject.document.id) && <a className="text-button" href="#explore/discover?example=find">Try a plain-language search lesson</a>}{classification && <button className="secondary small" onClick={onCompare}>{compareLabel}</button>}<button className="quiet small" onClick={onExperiment}>{classification ? 'Change the threshold' : 'Explore a safeguard'}</button></div></div>
    <div className="lesson-provenance"><Icon name="info" size={13} /><span>{metricsView ? 'Synthetic source · live models when measured · same runtime policy · no publication' : measurementAvailable ? single.state.status === 'idle' ? 'Prepared document · live classification · approval and publication outside preview' : single.state.status === 'pending' ? 'Live workflow requested · awaiting response · no publication' : single.state.status === 'failed' ? 'Live request unavailable · no completed response · no publication' : 'Live attempts · inspect completed stages · no publication' : mixedLive ? `${liveBounded ? 'Live' : 'Prepared'} bounded judgments and support checks · live frontier when selected · exact citation validation · illustrated playback` : <>{snapshot.run.mode === 'test-fixture' ? 'Simulated model responses · executed runtime rules' : 'Recorded provider calls'}{snapshot.run.request.simulated_review ? ' · simulated approval' : ''} · illustrated playback timing</>}</span></div>
    {drawer && <LessonDrawer title={drawer === 'source' ? source?.title || 'Source documents' : drawer === 'why' ? 'Why this route?' : 'Inspect this recording'} onClose={() => setDrawer(null)}>
      {drawer === 'source' ? <>{documents.length > 1 && <label className="field">Source<select value={source?.document.id} onChange={event => setSourceId(event.target.value)}>{documents.map(item => <option value={item.document.id} key={item.document.id}>{item.title}</option>)}</select></label>}<pre className="lesson-source">{source?.text}</pre><p className="micro">{source?.document.synthetic ? 'Synthetic source' : 'Retained source'} · {source?.document.filename}</p></>
        : drawer === 'why' ? <>{decision ? <><h3>{policyTitles[policyReason(decision)]}</h3><p>{displayName(decision.explanation)}</p><blockquote>{subject?.source_excerpt || decision.input_excerpt}</blockquote><dl className="lesson-facts"><dt>Recorded threshold</dt><dd>{typeof decision.threshold === 'number' ? `${Math.round(decision.threshold * 100)}%` : 'Unavailable'}</dd><dt>Confidence</dt><dd>Model signal; not measured accuracy.</dd><dt>Next action</dt><dd>{decision.selected_route === 'accept' ? 'Accept this bounded category. Publication is a separate step.' : 'A frontier model proposes a category. Review authorizes publication.'}</dd></dl><p className="micro">Policy {decision.policy_version}. Source excerpt is relevant context, not a claim about model attention.</p><h3>What the workflow enforces</h3><p>The model returns a bounded category. Runtime rules select the next capability; valid approval authorizes publication. A proposal alone cannot make a document searchable.</p>{snapshot.run.request.simulated_review === true && decision.selected_route === 'interpret' && <p>This lesson illustrates the approval. No human response time was measured; the replay skips the wait for a real reviewer.</p>}<p>Discovery accepts plain-language requests, then applies retrieval, citation, and support checks along its selected route.</p></> : <><h3>{classification ? 'Play to reach the recorded decision' : 'Separate capabilities, one request'}</h3><p>{classification ? 'The runtime checks a structured judgment before selecting an action.' : 'Intent and relevance are bounded judgments. Code retrieves and validates. Frontier planning and composition are selected only on their recorded routes.'}</p></>}</>
          : <><p className="micro">{playback.cursor} of {snapshot.events.length} recorded events visible. Inspect uses the current replay position.</p><dl className="lesson-facts"><dt>Workflow</dt><dd>{snapshot.run.graph_version}</dd><dt>Policy</dt><dd>{snapshot.run.policy_version}</dd><dt>Provider mode</dt><dd>{snapshot.run.mode}</dd><dt>Configured frontier model</dt><dd>{String(snapshot.run.configuration.openai_model || 'Unavailable')}</dd></dl><details><summary>Visible decisions and events</summary><pre className="lesson-source">{JSON.stringify(visible, null, 2)}</pre></details>{recorded && <a className="secondary" href={`#runs/${snapshot.run.id}`}>Open full run<Icon name="arrow" size={14} /></a>}</>}
    </LessonDrawer>}
  </section>;
}
