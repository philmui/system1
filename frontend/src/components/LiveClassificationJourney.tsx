/** @jsxImportSource react */
import { useRef, useState } from 'react';
import type { LiveClassificationResponse, RunSnapshot } from '../lib/api.generated';
import type { LiveLessonState } from '../lib/useLiveLesson';
import { classificationLatency, classificationPerformance } from '../lib/classificationPerformance';
import { runtimeRuleLabel } from '../lib/classification';
import { displayName } from '../lib/naming';
import { duration } from '../lib/timing';
import { useMediaQuery } from '../lib/useMediaQuery';
import { useClassificationJourney } from '../lib/useClassificationJourney';
import { LiveElapsed } from './LiveInterpret';
import { LessonFlow } from './LessonFlow';
import { PerformanceReport } from './PerformanceReport';
import { LiveWorkflowTiming } from './WorkflowTimingSummary';
import { Icon } from './Icon';

/** The entire view has a single live source; prepared replay events never fill a gap. */
export function LiveClassificationJourney({ state, snapshot, documentId, onLeave, inspectionOpen = false }: {
  state: LiveLessonState<LiveClassificationResponse>; inFlight: boolean; snapshot: RunSnapshot; documentId: string;
  onRun: () => void; onLeave: () => void; inspectionOpen?: boolean;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidenceSummary = useRef<HTMLElement>(null);
  const response = state.status === 'complete' ? state.response : undefined;
  const strategy = response?.strategy;
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const journey = useClassificationJourney(strategy, inspectionOpen || evidenceOpen || reduceMotion);
  const policy = strategy?.policy;
  const report = strategy ? classificationPerformance(strategy) : undefined;
  const latency = strategy ? classificationLatency(strategy) : undefined;
  return <section className="live-classification-journey" aria-label="Live classification workflow">
    <div className="classification-workflow-heading"><span className="eyebrow">Follow the document</span><p>{state.status === 'idle' ? 'Ready at Judge. Choose Run document above to process this source.' : 'The page follows the branch selected by runtime policy. Select any step to inspect its evidence.'}</p>
      {state.status === 'pending' && <div className="live-frontier-progress"><span role="status">Measuring this document’s selected route…</span><LiveElapsed startedAt={state.startedAt} /><small>Browser waiting time. The measured route appears when processing finishes; leaving does not cancel accepted work.</small><button className="quiet small" onClick={onLeave}>Leave live preview</button></div>}
      {state.status === 'failed' && <p role="alert">{displayName(state.message)}</p>}
    </div>
    {journey.steps.length > 0 && <div className="lesson-playback-with-timing"><div className="classification-route-playback" role="group" aria-label="Recorded route animation">
      <button className="quiet small" disabled={reduceMotion || inspectionOpen || evidenceOpen} aria-pressed={journey.playing} onClick={journey.toggle}><Icon name={journey.playing ? 'pause' : 'play'} size={15} />{journey.playing ? 'Pause route animation' : journey.position === journey.steps.length - 1 ? 'Replay document route' : 'Continue route animation'}</button>
      <button className="icon-button" aria-label="Previous route step" disabled={journey.position === 0} onClick={() => journey.seek(journey.position - 1)}><Icon name="stepBack" size={16} /></button>
      <button className="icon-button" aria-label="Next route step" disabled={journey.position === journey.steps.length - 1} onClick={() => journey.seek(journey.position + 1)}><Icon name="step" size={16} /></button>
      <input type="range" aria-label="Document route progress" min={0} max={journey.steps.length - 1} value={journey.position} onChange={event => journey.seek(Number(event.target.value))} />
      <label><span className="sr-only">Route animation speed</span><select aria-label="Route animation speed" value={journey.speed} onChange={event => journey.setSpeed(Number(event.target.value))}>{[.5, 1, 1.5, 2].map(speed => <option value={speed} key={speed}>{speed}×</option>)}</select></label>
      <span>{reduceMotion ? 'Reduced motion is on · selected route stays visible' : 'Visual playback · no new requests · measured timings stay fixed'}</span>
      <span>Document speed follows relative service latency. Fast steps pause for readability; long waits are compressed.</span>
    </div>{strategy && <LiveWorkflowTiming strategy={strategy} />}</div>}
    <LessonFlow run={snapshot.run} events={[]} documentId={documentId} playing={journey.playing} speed={journey.speed} journey={journey.current ? { step: journey.current, cycle: journey.cycle } : undefined}
      onInspect={() => { journey.pause(); setEvidenceOpen(true); evidenceSummary.current?.focus(); evidenceSummary.current?.scrollIntoView({ block: 'center', behavior: 'instant' }); }}
      measurement={strategy} measurementReady={state.status === 'idle'} measurementPending={state.status === 'pending'} measurementError={state.status === 'failed' ? displayName(state.message) : undefined} />
    <div className="live-frontier-panel">
      <div className="live-frontier-heading"><div><span className="eyebrow">{state.status === 'idle' ? 'Prepared document · live workflow' : 'Live workflow · runtime selects the work'}</span><p>System 1 judges. The selected frontier model runs only when interpretation is needed.</p></div>
        {(state.status === 'complete' || state.status === 'failed') && <button className="quiet small" onClick={onLeave}>Clear result</button>}</div>
      {strategy && latency && <>
        <dl className="live-classification-summary"><div><dt>{strategy.status === 'failed' ? 'Elapsed until failure' : 'Automated classification elapsed'}</dt><dd>{latency.elapsedMs === null ? 'Not recorded' : duration(latency.elapsedMs)}</dd><small>Includes queue and runtime</small></div>
          <div><dt>Frontier interpretation</dt><dd className={`classification-frontier-state ${latency.frontierState === 'Bypassed' ? 'is-bypassed' : ''}`}>{latency.frontierState}</dd><small>{strategy.bounded_attempts} System 1 · {strategy.frontier_attempts} frontier requests started</small></div>
          <div className="classification-service-summary"><dt>Service work · excludes queue</dt><dd><span>System 1 <strong>{latency.bounded.display}</strong></span><span>Frontier <strong>{latency.frontier.display}</strong></span></dd><small>{latency.bounded.failed || latency.frontier.failed ? 'Includes recorded failed attempt intervals' : 'Request work; elapsed time is measured separately'}</small></div>
        </dl>
        <div className={`classification-measurement-end ${latency.completed ? 'is-complete' : 'is-stopped'}`} role="status"><strong>{latency.status}</strong><span>Approval and publication are outside this measurement. Time to searchable: unavailable.</span></div>
      </>}
      <small className="live-classification-scope">Example cues show expected routes; live results can differ. Real API calls are timed. Both provider keys are required and provider charges apply. Approval and publication are outside this preview.</small>
    </div>
    <div className="lesson-receipt" aria-label="Actual measured decision">
      <div><span>Judgment · System 1 Model</span><strong>{strategy?.judgment ? `${strategy.judgment.choice} · ${Math.round(strategy.judgment.confidence * 100)}% confidence` : 'No completed judgment'}</strong></div>
      <div><span>Rule · Runtime</span><strong>{policy ? runtimeRuleLabel(policy.reason, policy.threshold) : 'No completed policy'}</strong></div>
      <div><span>Actual output</span><strong>{strategy?.output_category ? `${strategy.output_category} · ${strategy.output_kind === 'proposal' ? 'proposal' : 'accepted category'}` : 'No completed output'}</strong></div>
    </div>
    {policy && <p className="live-classification-route-reason">{policy.reason === 'mixed_purpose' ? 'Email with proposed agreement terms triggers interpretation and review, even when the category is clear.' : displayName(policy.explanation)}</p>}
    {report && <div className="live-classification-report"><PerformanceReport report={{ ...report, title: 'Step timing & provenance', scope: `Measured live route · ${report.scope} · one synthetic document`, note: 'Service times exclude queue waits; automated classification elapsed includes them. The measurement is complete at its category or proposal. Approval, publication, and time to searchable are outside this preview; confidence is not accuracy.' }} /></div>}
    {!report && state.status === 'idle' && <div className="live-classification-report"><h3>Step timing & provenance</h3><p>Run document to measure the System 1 request, runtime policy, and any frontier interpretation on this document.</p></div>}
    <details className="live-classification-evidence" open={evidenceOpen} onToggle={event => { setEvidenceOpen(event.currentTarget.open); if (event.currentTarget.open) journey.pause(); }}><summary ref={evidenceSummary}>Why this route? · measurement evidence</summary>
      <p>{displayName(policy?.explanation || 'Run document to see the actual judgment and routing decision. No model response is substituted.')}</p>
      {response && <><p>Source version: {response.content_version}. Policy: {policy?.policy_version || 'Not completed'}. Confidence is a model signal, not accuracy.</p>
        <p>Accepted categories and proposals are separate from publication. Human approval and time to searchable are outside this preview.</p>
        <details><summary>Inspect actual response</summary><pre className="lesson-source">{JSON.stringify(response, null, 2)}</pre></details></>}
    </details>
  </section>;
}
