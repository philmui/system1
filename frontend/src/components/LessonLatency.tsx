/** @jsxImportSource react */
import { useId, useMemo, useState } from 'react';
import type { Event, Run } from '../lib/api.generated';
import { humanWaitDuration, illustrativeDocumentLatency, lessonTiming, lessonTimingSource, type LessonTimingStage } from '../lib/lessonTiming';
import { defaultBatchScenario } from '../lib/batchComparison';
import { duration } from '../lib/timing';
import { Icon } from './Icon';

export interface LessonLatencyProps {
  run: Run;
  /** The current replay prefix, never the complete recording during playback. */
  events: Event[];
  documentId: string;
  onCompare?: () => void;
  compareHref?: string;
}
const stageOrder: LessonTimingStage[] = ['judgment', 'policy', 'interpretation', 'publication', 'review'];

/** Recorded observations and the separate teaching scenario share no timing inputs. */
export function LessonLatency({ run, events, documentId, onCompare, compareHref = '#compare/classify?source=illustrative' }: LessonLatencyProps) {
  const timing = useMemo(() => lessonTiming(run, events, documentId), [run, events, documentId]);
  const [reviewSeconds, setReviewSeconds] = useState(defaultBatchScenario.reviewSeconds);
  const reviewSelectId = useId();
  const comparison = useMemo(() => illustrativeDocumentLatency(timing.route, { reviewSeconds }), [timing.route, reviewSeconds]);
  return <section className="lesson-latency" aria-label="Recorded step timings and illustrative latency comparison">
    <header className="lesson-latency-heading"><span><Icon name="clock" size={15} /> Step timing & provenance</span><small>{timing.provenance}</small></header>
    <dl className="lesson-latency-strip" aria-label="Timings at the current replay position">{stageOrder.map(id => {
      const stage = timing.stages[id];
      return <div key={id} className={`lesson-latency-stage role-${stage.role}`} data-state={stage.status}>
        <dt>{stage.label}</dt>
        <dd>{stage.display}</dd>
        <small>{stage.detail}</small>
      </div>;
    })}</dl>
    <div className="lesson-latency-illustration">
      <div className="lesson-latency-illustration-label"><span>{timing.route === 'accept' ? 'Routine route · skips frontier interpretation' : timing.route === 'interpret' ? 'Exception route · uses both capabilities' : 'The runtime decides which work is needed'}</span>
        <small>{timing.route === 'accept' ? 'This document avoids a frontier request. See the batch to compare the wider workload.' : timing.route === 'interpret' ? 'This document needs extra interpretation. The batch benefits when routine documents skip that work.' : 'Follow the decision to see whether this document needs a frontier model.'}</small></div>
      {onCompare ? <button className="text-button" onClick={onCompare}>Compare workload<Icon name="arrow" size={14} /></button>
        : <a className="text-button" href={compareHref}>Compare workload<Icon name="arrow" size={14} /></a>}
    </div>
    {comparison && <p className="lesson-latency-route-note">{comparison.route === 'accept'
      ? 'This illustration skips frontier interpretation. Both routes include the same publication checks.'
      : 'This exception adds judgment and interpretation. Human approval adds a separate wait before publication.'}</p>}
    <details className="lesson-latency-details">
      <summary>Timing evidence & assumptions</summary>
      <div className="lesson-latency-details-body">
        <p>Live model timing requires a recorded provider identity and a measured request interval. Fixture delays and human approval scripts are execution diagnostics. Parallel work is not summed into batch latency.</p>
        <div className="lesson-latency-table-scroll"><table><thead><tr><th scope="col">Step</th><th scope="col">Recorded time</th><th scope="col">Evidence</th></tr></thead><tbody>
          {stageOrder.map(id => { const stage = timing.stages[id]; const scripted = id === 'review' && timing.simulatedReview; const diagnosticModel = (id === 'judgment' || id === 'interpretation') && stage.primaryDurationMs === null && stage.records.length > 0; return <tr key={id}><th scope="row">{stage.label}</th><td>{stage.display}<small>{stage.detail}</small></td><td>{lessonTimingSource(stage, timing.fixture, timing.simulatedReview)}{diagnosticModel
            ? <details><summary>Execution diagnostics</summary>{stage.records.map(record => <p key={record.id}>Attempt {record.attempt} · {record.state}: {record.fixture ? 'Fixture execution delay' : record.provider === 'mixed' || record.provider === 'unknown' || !record.provider ? 'Unidentified execution interval' : record.source === 'provider' ? `${record.provider === 'openai' ? 'OpenAI' : 'System 1 Model'} request measurement` : 'Recorded stage interval'} · {duration(record.elapsedMs)}.{record.fixture ? ' Not live model latency.' : ''}</p>)}{stage.durationMs === null && <p>Recorded interval total incomplete.</p>}</details>
            : scripted && stage.knownWorkMs !== null
            ? <small>Script execution timing: {duration(stage.knownWorkMs)}{stage.durationMs === null ? ' (partial)' : ''}. Diagnostic only.</small>
            : stage.durationMs === null && stage.knownWorkMs !== null && <small>{duration(stage.knownWorkMs)} across {stage.measuredAttempts} measured attempts only; total incomplete.</small>}</td></tr>; })}
          <tr><th scope="row">First read → searchable</th><td>{duration(timing.documentToSearchableMs)}</td><td>{timing.fixture ? 'Fixture wall interval' : 'Recorded wall interval'}; includes queues and review. Requires this document’s publication commit.</td></tr>
        </tbody></table></div>
        <p>Simulated responses are not live requests. Their execution delays appear only in diagnostics. A pending attempt has no completed duration, and an identified live request is not a model-performance benchmark. Missing or mixed timings never become a complete live-latency total.</p>
        {comparison && <>
          <h3>Illustrative assumptions</h3>
          <p>One readable document, no queue, fixed service times, equal final categories and review outcomes. These assumed durations do not measure GPT-5.5 or System 1 Model performance. Starts from Compare strategies’ defaults; changing the human wait here affects only this illustration.</p>
          {comparison.route === 'interpret' && <div className="lesson-latency-human-wait">
            <label htmlFor={reviewSelectId}>Human wait · assumed in both strategies</label>
            <select id={reviewSelectId} value={reviewSeconds} onChange={event => setReviewSeconds(Number(event.target.value))} aria-describedby={`${reviewSelectId}-note`}>
              <option value={900}>15 min</option><option value={3600}>1 hour</option><option value={86400}>1 day</option>
            </select><small id={`${reviewSelectId}-note`}>An assumption, not a response-time estimate.</small>
          </div>}
          <div className="lesson-latency-table-scroll"><table><thead><tr><th scope="col">Included work</th><th scope="col">System 1 route</th><th scope="col">Frontier by default</th></tr></thead><tbody>
            <tr><th scope="row">Bounded judgment</th><td>{duration(comparison.system1.boundedMs)}</td><td>Not used</td></tr>
            <tr><th scope="row">Frontier work</th><td>{comparison.system1.frontierAttempts ? duration(comparison.system1.frontierMs) : 'Not used'}</td><td>{duration(comparison.frontier.frontierMs)}</td></tr>
            <tr><th scope="row">Code checks & publication</th><td>{duration(comparison.system1.codeMs)}</td><td>{duration(comparison.frontier.codeMs)}</td></tr>
            <tr><th scope="row">Automated work subtotal</th><td>{duration(comparison.system1.automatedMs)}</td><td>{duration(comparison.frontier.automatedMs)}</td></tr>
            <tr><th scope="row">Human wait · assumed</th><td>{comparison.route === 'interpret' ? humanWaitDuration(comparison.system1.reviewWaitMs) : 'Not required'}</td><td>{comparison.route === 'interpret' ? humanWaitDuration(comparison.frontier.reviewWaitMs) : 'Not required'}</td></tr>
            <tr><th scope="row">Time to searchable · automated work + wait</th><td>{humanWaitDuration(comparison.system1.timeToSearchableMs)}</td><td>{humanWaitDuration(comparison.frontier.timeToSearchableMs)}</td></tr>
            <tr><th scope="row">Total model attempts</th><td>{comparison.system1.modelAttempts}</td><td>{comparison.frontier.modelAttempts}</td></tr>
          </tbody></table></div>
          <p>Classification and interpretation are different frontier tasks with separate assumed times. The baseline assumes one classification request under equivalent safeguards. Quality, real prices, provider latency, batch concurrency, and production exception rates are not evaluated here.</p>
        </>}
      </div>
    </details>
  </section>;
}
