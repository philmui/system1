/** @jsxImportSource react */
import type { LiveClassificationComparisonResponse } from '../lib/api.generated';
import type { LiveLessonState } from '../lib/useLiveLesson';
import { classificationElapsedRows, classificationPerformance, frontierLatencyPercent } from '../lib/classificationPerformance';
import { duration } from '../lib/timing';
import { displayName } from '../lib/naming';
import { measuredMs } from '../lib/performanceReport';
import { PerformanceReport } from './PerformanceReport';
import { LiveElapsed } from './LiveInterpret';
import { MeasurementGuide } from './MeasurementGuide';

export function ClassificationMeasurement({ state, disabled, onRun }: {
  state: LiveLessonState<LiveClassificationComparisonResponse>; disabled: boolean; onRun: () => void;
}) {
  const result = state.status === 'complete' ? state.response : undefined;
  const system1 = result?.strategies.find(strategy => strategy.id === 'system1');
  const frontier = result?.strategies.find(strategy => strategy.id === 'frontier_first');
  const complete = system1?.status === 'completed' && frontier?.status === 'completed';
  const system1Elapsed = measuredMs(system1?.elapsed_ms), frontierElapsed = measuredMs(frontier?.elapsed_ms);
  const difference = complete && system1Elapsed !== null && frontierElapsed !== null ? frontierElapsed - system1Elapsed : null;
  const relativeLatency = complete ? frontierLatencyPercent(system1Elapsed, frontierElapsed) : null;
  const reports = result?.strategies.map(classificationPerformance) || [];
  const scale = Math.max(1, ...reports.flatMap(report => report.components.map(component => component.elapsedMs || 0)));
  return <section className="classification-measurement" aria-label="Compare measured latency and quality">
    <div className="measurement-intro"><div><h3>Same document. Two live strategies.</h3><p>Two fresh executions apply the same policy. Either strategy may need frontier interpretation.</p></div></div>
    <MeasurementGuide />
    <div className="measurement-actions"><button className="primary" disabled={disabled || state.status === 'pending'} onClick={onRun}>{state.status === 'pending' ? 'Measuring both strategies…' : result ? 'Measure again' : 'Measure both strategies'}</button>
      <small>Live System 1 Model + selected frontier model · normal provider charges apply</small></div>
    {!result && <p className="performance-note">Same source, category choices, and publication rules. Stops before human approval or publication. No model calls occur until you press Measure.</p>}
    {state.status === 'pending' && <div className="live-frontier-progress"><span role="status">Measuring real requests and runtime policy…</span><LiveElapsed startedAt={state.startedAt} /><small>Both strategies share provider capacity. Leaving does not cancel accepted requests.</small></div>}
    {state.status === 'failed' && <p role="alert" className="live-frontier-error">{displayName(state.message)}</p>}
    {result && <>
      <section className="classification-elapsed-comparison" aria-label="Measured strategy elapsed">
        <header><h4>Automated classification elapsed</h4><span>Same document · same duration scale</span></header>
        {classificationElapsedRows(result.strategies).map(({ strategy, elapsedMs, widthPercent }) => <div key={strategy.id} className={`classification-elapsed-row role-${strategy.id === 'system1' ? 'jev' : 'llm'}`}>
          <div className="classification-elapsed-label"><strong>{displayName(strategy.label)}</strong><span>{strategy.frontier_attempts} frontier request{strategy.frontier_attempts === 1 ? '' : 's'} started{strategy.status === 'failed' ? ' · failed' : strategy.output_kind === 'proposal' ? ' · proposal ready' : ' · category accepted'}</span></div>
          <div className="classification-elapsed-track" aria-hidden="true">{widthPercent !== null && <i style={{ width: `${widthPercent}%` }} />}</div>
          <strong className="classification-elapsed-value">{elapsedMs === null ? 'Not recorded' : duration(elapsedMs)}{strategy.status === 'failed' && <small>until failure</small>}</strong>
        </div>)}
        <p>Includes requests, queue waits, and runtime policy. Both measurements end before approval and publication; time to searchable is unavailable.</p>
      </section>
      <div className="measurement-delta" aria-label="Observed differences">
        <div><span>Latency with System 1 Model</span><strong>{!complete ? 'Incomplete trial' : relativeLatency === null ? 'Ratio unavailable' : `${relativeLatency.toFixed(1)}% of frontier`}</strong>
          <small>{!complete ? 'Both strategies must complete to compare' : difference === null ? 'Comparable elapsed timings were not recorded' : difference === 0 ? 'Equal elapsed time' : `${duration(Math.abs(difference))} ${difference > 0 ? 'lower' : 'higher'}`}</small>
          {relativeLatency !== null && <small>{relativeLatency < 100 ? 'Below 100% means less elapsed time' : relativeLatency > 100 ? 'Above 100% means more elapsed time' : '100% means equal elapsed time'}</small>}
          <small>{complete && frontierElapsed === 0 ? 'A zero frontier baseline has no percentage ratio.' : difference === null && complete ? 'Missing timing is not zero.' : 'Observed in this shared-capacity trial'}</small></div>
        <div><span>Frontier requests avoided</span><strong>{complete ? frontier.frontier_attempts - system1.frontier_attempts : 'Unavailable'}</strong><small>{complete ? `${system1.frontier_attempts} with System 1 · ${frontier.frontier_attempts} frontier first` : 'Both strategies must complete to compare'}</small></div>
        <div><span>Quality sample size</span><strong>1 document</strong><small>One authored category · not benchmark accuracy</small></div>
      </div>
      <p className="performance-note">Concurrent trial · {result.provenance.max_in_flight_provider_requests} shared provider slot{result.provenance.max_in_flight_provider_requests === 1 ? '' : 's'}. Queueing affects elapsed differences. Exception routes can take longer; no strategy is assumed to win.</p>
      <div className="measurement-pair">{reports.map(report => <PerformanceReport key={report.title} report={report} compact scaleMs={scale} />)}</div>
      <details className="measurement-assumptions"><summary>Measurement scope & accuracy limits</summary>
        <p>Relative latency = System 1 Model automated classification elapsed ÷ frontier-first automated classification elapsed × 100. Below 100% means less elapsed time; above 100% means more. This is the route time, including any interpretation and queue waits, not just the Judge request.</p>
        <p>{displayName(result.provenance.timing_scope)} Total trial elapsed: {duration(result.total_elapsed_ms)}. This is measured independently, not the sum of both strategies.</p>
        <p>{displayName(result.provenance.confidence_note)}</p><p>{displayName(result.provenance.quality_scope)}</p>
        <p>Reference category: {result.reference_category}. Neither a reference match nor a valid schema authorizes publication. Final published accuracy and human turnaround are not evaluated.</p>
        <p>No automatic retries. Failed attempts remain in the component report. Source version: {result.content_version}. Trial: {result.comparison_id}.</p>
      </details>
    </>}
  </section>;
}
