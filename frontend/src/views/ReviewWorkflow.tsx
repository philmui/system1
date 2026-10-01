import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { PlaybackSpeed } from '../components/PlaybackSpeed';
import { ReviewLane } from '../components/ReviewLane';
import { LiveReview } from '../components/LiveReview';
import { MeasurementGuide } from '../components/MeasurementGuide';
import '../live-review.css';
import { examplePages } from '../lib/reviewExample';
import { useMediaQuery } from '../lib/useMediaQuery';
import { advanceReviewClock, buildReviewTrace, defaultScenario, money, nextTraceStep, reviewClockRate, reviewDecisionComparison, scenarioFields, traceSnapshot, validateScenario, type HumanVerdict, type ReviewNodeId, type Scenario, type Strategy } from '../lib/workflowComparison';

const workDetails: Record<ReviewNodeId, { title: string; description: string }> = {
  input: { title: 'Read page · code', description: 'Code loads a page into shared state. The moving paper represents that same page throughout both graphs.' },
  agent: { title: 'Classify page · model + code', description: 'One model request returns three decisions. The software wrapper validates the answers, updates state, and selects the next edge using explicit rules. Routing is code inside this step; it is not another model call.' },
  redact: { title: 'Redact PII · model call', description: 'Only a page that needs rewriting takes this branch. A frontier LLM removes personal information. This local example uses a prepared redacted copy.' },
  attorney: { title: 'Review page · human checkpoint', description: 'Potential privilege or uncertainty pauses this page for an attorney. Other work may continue. A release still requires redaction when personal information remains.' },
  produce: { title: 'Produced · final state', description: 'Pages cleared for handover reach this state directly, after redaction, or after an attorney releases them. Only an arriving page has been produced.' },
  aside: { title: 'Set aside · final state', description: 'A nonresponsive page is set aside only when there is no unresolved privilege concern. No generative rewrite is needed.' },
  withheld: { title: 'Withheld · final state', description: 'An attorney’s decision to withhold sends the page here. Waiting at a checkpoint never counts as permission to produce it.' },
};
type Panel = 'page' | 'step' | 'assumptions' | 'key' | null;
const toDraft = (scenario: Scenario) => Object.fromEntries(Object.entries(scenario).map(([key, value]) => [key, String(value)])) as Record<keyof Scenario, string>;

export function ReviewWorkflow({ initialExperience = 'live' }: { initialExperience?: 'live' | 'illustration' } = {}) {
  const [experience, setExperience] = useState<'live' | 'illustration'>(initialExperience);
  const narrow = useMediaQuery('(max-width: 1050px)');
  const [pageIndex, setPageIndex] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { const pause = () => setPlaying(false); window.addEventListener('pause-workflow-playback', pause); return () => window.removeEventListener('pause-workflow-playback', pause); }, []);
  const [speed, setSpeed] = useState(1);
  const [scenario, setScenario] = useState(defaultScenario);
  const [draft, setDraft] = useState(() => toDraft(defaultScenario));
  const [verdict, setVerdict] = useState<HumanVerdict>();
  const [focused, setFocused] = useState(false);
  const [controls, setControls] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<{ node: ReviewNodeId; strategy: Strategy }>({ node: 'input', strategy: 'system1' });
  const [version, setVersion] = useState<'original' | 'redacted'>('original');
  const [assumptionError, setAssumptionError] = useState('');
  const drawerHeading = useRef<HTMLHeadingElement>(null);
  const focusButton = useRef<HTMLButtonElement>(null);
  const page = examplePages[pageIndex];
  const traces = useMemo(() => [buildReviewTrace(page, 'system1', scenario, verdict), buildReviewTrace(page, 'frontier', scenario, verdict)], [page, scenario, verdict]);
  const duration = Math.max(...traces.map(trace => trace.end));
  // Native range inputs normalize long floating-point decimal strings. Keep
  // their endpoint stable, while seeking it still selects the exact trace end.
  const timelineEnd = Number(duration.toFixed(9));
  const clockRate = reviewClockRate(scenario);
  const snapshots = traces.map(trace => traceSnapshot(trace, time));
  const bothComplete = snapshots.every(snapshot => snapshot.finished);
  const pending = snapshots.some(snapshot => snapshot.awaiting) && (!verdict || verdict.at > time);
  const isPlaying = playing && time < duration;
  const maxMachineSeconds = Math.max(scenario.systemSeconds, scenario.frontierSeconds) + scenario.wrapperSeconds + scenario.redactSeconds;

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const advance = (now: number) => {
      const elapsed = Math.min(.1, (now - previous) / 1000);
      previous = now;
      setTime(value => advanceReviewClock(value, elapsed, speed, duration));
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, duration]);
  useEffect(() => { if (time >= duration) setPlaying(false); }, [time, duration]);
  useEffect(() => {
    if (!focused && !panel) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (panel) { setPanel(null); focusButton.current?.focus(); }
      else { setFocused(false); focusButton.current?.focus(); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [focused, panel]);
  useEffect(() => { if (panel) drawerHeading.current?.focus({ preventScroll: true }); }, [panel, selected.node]);

  const reset = () => { setTime(0); setPlaying(false); setVerdict(undefined); setVersion('original'); };
  const play = () => {
    if (time >= duration) { setTime(0); setPlaying(true); }
    else setPlaying(value => !value);
  };
  const choosePage = (index: number) => { reset(); setPageIndex(index); setPanel(null); setSelected({ node: 'input', strategy: 'system1' }); };
  const inspect = (node: ReviewNodeId, strategy: Strategy) => {
    setSelected({ node, strategy }); setPanel(node === 'input' ? 'page' : 'step'); setPlaying(false);
  };
  const openPanel = (next: Panel) => {
    setPlaying(false);
    setPanel(current => current === next ? null : next);
    if (next === 'assumptions') { setDraft(toDraft(scenario)); setAssumptionError(''); setPlaying(false); }
  };
  const selectedSnapshot = snapshots[selected.strategy === 'system1' ? 0 : 1];
  const hasRedactedCopy = selectedSnapshot.redacted && !!page.redacted;
  const state = {
    page_id: page.id,
    text_loaded: traces[selected.strategy === 'system1' ? 0 : 1].steps.some(step => step.id === 'input' && time >= step.end),
    decisions: selectedSnapshot.answersVisible ? { responsive: page.responsive, personal_info: page.pii, privileged: page.privileged } : null,
    pii_redacted: selectedSnapshot.redacted,
    attorney_verdict: verdict && time >= verdict.at && selectedSnapshot.reachedNodes.has('attorney') ? verdict.outcome : null,
    output: selectedSnapshot.result,
  };
  const latencyDelta = snapshots[1].machineSeconds - snapshots[0].machineSeconds;
  const costDelta = snapshots[1].cost - snapshots[0].cost;
  const review = (outcome: HumanVerdict['outcome']) => { setVerdict({ outcome, at: time }); setPanel(null); setPlaying(true); focusButton.current?.focus(); };
  const panelTitle = panel === 'assumptions' ? 'Scenario assumptions' : panel === 'key' ? 'Reading AgentGraph' : panel === 'page' ? page.title : workDetails[selected.node].title;

  return <div className={`review-workspace comparison-workspace ${experience === 'illustration' ? 'is-prepared' : 'is-live'} ${focused ? 'focus-workflow' : ''}`}>
    <h1 className="visually-hidden">Document review · compare AgentGraph workflows</h1>
    <div className="review-experience-controls"><div className="segmented" role="group" aria-label="Review experience"><button aria-pressed={experience === 'live'} onClick={() => { setExperience('live'); setPlaying(false); setFocused(false); setPanel(null); }}>Live requests</button><button aria-pressed={experience === 'illustration'} onClick={() => { setExperience('illustration'); setPlaying(false); }}>Prepared comparison</button></div>
      {experience === 'live' && <label>Fictional page<select value={pageIndex} onChange={event => choosePage(Number(event.target.value))}>{examplePages.map((item, index) => <option key={item.id} value={index}>{item.title}</option>)}</select></label>}</div>
    {!focused && <><p className="page-task-guide">{experience === 'illustration' ? 'Prepared simulation · no model calls. Choose a page and press Run simulation. Both approaches use assumed times and the same prepared outcomes; quality is not measured.' : 'Choose a fictional page, then Classify page or Generate redaction. These are real model requests; every draft still needs review.'}</p><MeasurementGuide /></>}
    {experience === 'live' ? <LiveReview key={page.id} page={page} /> : <>
    <div className="workflow-dock">
      <div className="dock-main">
        <div className="dock-transport">
          <button className="primary dock-play" aria-label={isPlaying ? 'Pause simulation' : time >= duration ? 'Replay simulation' : 'Run simulation'} onClick={play}><Icon name={isPlaying ? 'pause' : 'play'} size={16} /><span>{isPlaying ? 'Pause simulation' : time >= duration ? 'Replay simulation' : 'Run simulation'}</span></button>
          <button className="icon-button" aria-label="Step example forward" title="Next step in either graph" disabled={time >= duration} onClick={() => { setPlaying(false); setTime(nextTraceStep(traces, time)); }}><Icon name="step" size={17} /></button>
          <button className="icon-button" aria-label="Reset example" title="Reset page and review decisions" onClick={reset}><Icon name="refresh" size={16} /></button>
        </div>
        <label className="comparison-page-picker"><span className="visually-hidden">Document to follow in both graphs</span><Icon name="file" size={15} /><select value={pageIndex} aria-label="Document to follow in both graphs" onChange={event => choosePage(Number(event.target.value))}>{examplePages.map((item, index) => <option key={item.id} value={index}>{String(index + 1).padStart(2, '0')} · {item.title}</option>)}</select></label>
        <div className="dock-speed"><PlaybackSpeed value={speed} onChange={setSpeed} label="Example playback speed" /></div>
        <div className="dock-view-controls">
          <button className="icon-button dock-expand" aria-label={controls ? 'Collapse playback controls' : 'Expand playback controls'} title={controls ? 'Fewer controls' : 'Timeline, details and assumptions'} aria-expanded={controls} aria-controls="comparison-controls" onClick={() => setControls(value => !value)}><Icon name="chevronDown" size={18} /></button>
          <button ref={focusButton} className={`focus-toggle ${focused ? 'active' : ''}`} aria-pressed={focused} aria-label={focused ? 'Exit graph focus' : 'Focus graph'} title={focused ? 'Exit focus · Escape' : 'Maximize the workflow'} onClick={() => setFocused(value => !value)}><Icon name={focused ? 'collapse' : 'expand'} size={17} /><span>{focused ? 'Exit focus' : 'Focus graph'}</span></button>
        </div>
      </div>
      <div id="comparison-controls" className="dock-secondary" hidden={!controls}>
        <label className="timeline"><span>Animation</span><input type="range" min={0} max={timelineEnd} step="any" value={Math.min(time, timelineEnd)} aria-label="Example timeline" aria-valuetext={`${Math.round(time / duration * 100)} percent of animation; handoffs include extra reading time`} onChange={event => { setPlaying(false); const selectedTime = Number(event.target.value); setTime(selectedTime >= timelineEnd ? duration : selectedTime); }} /><output>{Math.round(time / duration * 100)}%</output></label>
        <div className="dock-detail-buttons"><button className="quiet small" aria-expanded={panel === 'page'} onClick={() => openPanel('page')}><Icon name="file" size={14} />Page & state</button><button className="quiet small" aria-expanded={panel === 'assumptions'} onClick={() => openPanel('assumptions')}><Icon name="sliders" size={14} />Assumptions</button><button className="quiet small" aria-expanded={panel === 'key'} onClick={() => openPanel('key')}><Icon name="info" size={14} />Graph key</button></div>
      </div>
      <div className="comparison-decision-timing" role="group" aria-label="Assumed classification time comparison">
        <div className="decision-timing-label"><strong>Assumed decision time</strong><span>Same page · 3 decisions / request</span></div>
        {([{ label: 'System 1', seconds: scenario.systemSeconds, role: 'jev' }, { label: 'Frontier', seconds: scenario.frontierSeconds, role: 'llm' }] as const).map(model => <div key={model.role} className={`decision-timing-model role-${model.role}`}>
          <span>{model.label}<strong>{model.seconds.toFixed(2)} s</strong></span><i aria-hidden="true"><b style={{ width: `${model.seconds / Math.max(scenario.systemSeconds, scenario.frontierSeconds) * 100}%` }} /></i>
        </div>)}
        <strong className="decision-timing-ratio">{reviewDecisionComparison(scenario)}</strong>
      </div>
      <div className="comparison-caption"><span><i />Model work uses the same time scale. File handoffs are slowed for readability and excluded from latency.</span><button className="text-button" onClick={() => openPanel('assumptions')}>Assumptions<Icon name="chevron" size={11} /></button></div>
      {pending && <div className="comparison-review-prompt"><span><Icon name="pause" size={14} />This page is waiting for an attorney.</span><button className="secondary small" onClick={() => inspect('attorney', snapshots[0].awaiting ? 'system1' : 'frontier')}>Review page<Icon name="chevron" size={12} /></button></div>}
      {bothComplete && <div className="comparison-result" role="status"><Icon name="checkCircle" size={14} /><span>Same prepared outcome.</span><strong>{Math.abs(latencyDelta) < .00001 ? 'Equal machine time' : `System 1 path: ${Math.abs(latencyDelta).toFixed(2)}s ${latencyDelta > 0 ? 'less' : 'more'} machine time`}</strong><span>{Math.abs(costDelta) < .0000001 ? 'Equal modeled cost' : `${money(Math.abs(costDelta))} ${costDelta > 0 ? 'lower' : 'higher'} modeled cost`}</span></div>}
      <p className="visually-hidden" role="status">{page.title}. Disaggregated: {snapshots[0].current.activity}. Frontier: {snapshots[1].current.activity}.</p>
    </div>
    <div className="comparison-stage" aria-label="Synchronized workflow comparison">
      {traces.map(trace => <ReviewLane key={trace.strategy} page={page} trace={trace} time={time} narrow={narrow}
        moving={isPlaying} speed={speed}
        maxMachineSeconds={maxMachineSeconds} selected={panel === 'step' && selected.strategy === trace.strategy ? selected.node : undefined}
        onSelect={node => inspect(node, trace.strategy)} />)}
    </div>
    {panel && <section className="workflow-drawer" aria-label={panelTitle}>
      <header><h3 ref={drawerHeading} tabIndex={-1}>{panelTitle}</h3><button className="icon-button" aria-label="Close workflow details" onClick={() => { setPanel(null); focusButton.current?.focus(); }}><Icon name="close" size={16} /></button></header>
      {panel === 'assumptions' ? <form onSubmit={event => {
        event.preventDefault();
        const next = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim() === '' ? NaN : Number(value)])) as unknown as Scenario;
        if (!validateScenario(next)) { setAssumptionError('Enter a number within each field’s range.'); return; }
        setScenario(next); reset(); setPanel(null); focusButton.current?.focus();
      }}>
        <p>These are editable teaching assumptions, not measured results or provider prices. Both graphs use the same page, prepared answers, rules, and one classification request for all three decisions. This isolates which model does the work.</p>
        <div className="scenario-fields">{scenarioFields.map(field => <label key={field.key}><span>{field.label}</span><div><input type="number" min={field.min} max={field.max} step="any" value={draft[field.key]} required aria-label={`${field.label}, ${field.unit}`} onChange={event => setDraft(values => ({ ...values, [field.key]: event.target.value }))} /><small>{field.unit}</small></div></label>)}</div>
        <p className="scenario-notes">At 1× playback, model work runs at {clockRate.toFixed(2)} modeled seconds per screen second in both lanes. Changing speed scales the entire animation equally. Each file handoff gets at least 0.8 screen seconds; longer paths take longer. Short code steps also get reading time. These presentation holds add no modeled latency. Machine time sums the assumed requests and checks; human waiting stays separate. The decision-time ratio compares classification only: redaction uses the same frontier model in both lanes, so the whole-workflow advantage depends on the route. Costs accrue when requests complete. No models are called. Accuracy, consistency and reliability need evaluation; this illustration measures none of them.</p>
        {assumptionError && <p role="alert" className="error-banner">{assumptionError}</p>}
        <div className="drawer-actions"><a href="https://gist.github.com/sydney-runkle/a632ba4ea0b2b72501dfa4b6ab2a7d8a" target="_blank" rel="noreferrer">Reference workflow<Icon name="link" size={12} /></a><button type="button" className="secondary small" onClick={() => setDraft(toDraft(defaultScenario))}>Restore defaults</button><button className="primary small" type="submit">Apply & reset</button></div>
      </form> : panel === 'key' ? <div className="graph-key-details">
        <div><span className="key-boundary"><Icon name="workflow" /></span><strong>AgentGraph = the workflow</strong><p>The runtime coordinates all the work inside the blue boundary, including shared state, conditional edges, and human checkpoints.</p></div>
        <div><span className="key-node"><Icon name="box" /></span><strong>Node = a unit of work</strong><p>A node can run code, call a model or tool, or contain a subgraph. Verb labels describe the work; small type labels identify who performs it.</p></div>
        <div><span className="key-page"><Icon name="file" /></span><strong>Page = evolving state</strong><p>Follow the numbered paper. A model adds three decisions; redaction updates the text; an attorney adds a verdict. Select a node to inspect state.</p></div>
        <div><span className="key-edge"><Icon name="arrow" /></span><strong>Edge = what runs next</strong><p>Thick flowing lines show the current handoff. Solid colored lines preserve the chosen path; dotted lines are available alternatives. Pause freezes the document and the flow.</p></div>
        <p className="reliability-note"><Icon name="shield" size={17} /><span>Bounded decisions, validated state, fixed rules, and human checkpoints make control flow explicit. Both architectures can enforce the same checks; stronger accuracy or reliability claims require measured evidence.</span></p>
      </div> : <div className="workflow-detail-grid">
        <div><p>{panel === 'page' ? `${page.id} · ${page.kind}. Synthetic example; both graphs process this same page.` : workDetails[selected.node].description}</p>
          {(panel === 'page' || selected.node === 'redact' || selected.node === 'attorney' || selected.node === 'produce') && <div className="comparison-source"><div className="source-version"><strong>Page content</strong>{hasRedactedCopy && <div className="segmented"><button aria-pressed={version === 'original'} onClick={() => setVersion('original')}>Original</button><button aria-pressed={version === 'redacted'} onClick={() => setVersion('redacted')}>Redacted copy</button></div>}</div><pre>{version === 'redacted' && hasRedactedCopy ? page.redacted : page.text}</pre></div>}
          {selected.node === 'attorney' && pending && <div className="example-verdict"><p>Your verdict applies to this page in both lanes after each reaches its own checkpoint. Release confirms responsiveness and clears privilege; any remaining PII still goes through redaction.</p><button className="secondary small" onClick={() => review('withhold')}>Withhold page</button><button className="primary small" onClick={() => review('release')}>Release page</button></div>}
        </div>
        <div className="shared-state"><div><strong>Shared state</strong><div className="segmented"><button aria-pressed={selected.strategy === 'system1'} onClick={() => setSelected(value => ({ ...value, strategy: 'system1' }))}>System 1 path</button><button aria-pressed={selected.strategy === 'frontier'} onClick={() => setSelected(value => ({ ...value, strategy: 'frontier' }))}>Frontier path</button></div></div><pre>{JSON.stringify(state, null, 2)}</pre></div>
      </div>}
    </section>}
    </>}
  </div>;
}
