/** @jsxImportSource react */
import { useMemo } from 'react';
import type { Event, MeasuredClassificationStrategy, Run } from '../lib/api.generated';
import { classificationLatency } from '../lib/classificationPerformance';
import { humanWaitDuration, lessonTiming } from '../lib/lessonTiming';
import { duration } from '../lib/timing';
import { Icon } from './Icon';

interface TimingSummary {
  source: 'Illustrative' | 'Recorded' | 'Measured';
  scope: string;
  label: string;
  total: string;
  totalMs: number | null;
  parts: { label: string; value: string; ms: number | null; role: 'jev' | 'llm' | 'runtime' }[];
  otherDetails?: { label: string; ms: number }[];
  otherNote?: string;
  note: string;
  review?: string;
}

const displayMs = (ms: number | null) => ms === 0 ? '0 ms' : duration(ms);

/** Residual elapsed time for a single serial document route, never a batch sum. */
function remainingMs(total: number | null, parts: (number | null)[]) {
  if (total === null || parts.some(part => part === null)) return null;
  const remaining = total - parts.reduce<number>((sum, part) => sum + part!, 0);
  // Allow only floating-point noise; inconsistent measurements stay unknown.
  return remaining >= -0.001 ? Math.max(0, remaining) : null;
}

function WorkflowTimingSummary({ source, scope, label, total, totalMs, parts, otherDetails, otherNote, note, review }: TimingSummary) {
  const remainder = remainingMs(totalMs, parts.map(part => part.ms));
  const complete = totalMs !== null && totalMs > 0 && remainder !== null && remainder < 0.001;
  return <aside className="workflow-timing-summary" aria-label="Workflow timing summary">
    <div className="workflow-timing-heading"><span className="workflow-timing-source">{source}</span><span>{scope}</span></div>
    <dl className="workflow-timing-total"><dt><Icon name="clock" size={16} />{label}</dt><dd>{total}</dd></dl>
    {complete && <div className="workflow-timing-composition" aria-hidden="true">{parts.map(part => <span key={part.label} className={`role-${part.role}`} style={{ width: `${part.ms! / totalMs! * 100}%` }} />)}</div>}
    <dl className="workflow-timing-parts" aria-label="Contributions to the total">{parts.map(part => <div key={part.label} className={`workflow-timing-part role-${part.role}`}>
      <dt>{part.label}</dt><dd>{part.value}</dd>
    </div>)}</dl>
    {(otherDetails || otherNote) && <details className="workflow-timing-details"><summary>Break down other steps</summary>
      {otherDetails && <dl>{otherDetails.map(part => <div key={part.label}><dt>{part.label}</dt><dd>{displayMs(part.ms)}</dd></div>)}</dl>}
      {otherNote && <p>{otherNote}</p>}
    </details>}
    <p className="workflow-timing-note">{note}</p>
    {review && <p className="workflow-timing-review"><Icon name="human" size={13} /><span>{review}</span></p>}
  </aside>;
}

/** Whole-recording totals stay fixed while the separate replay prefix advances. */
export function RecordedWorkflowTiming({ run, events, documentId }: { run: Run; events: Event[]; documentId: string }) {
  const timing = useMemo(() => lessonTiming(run, events, documentId), [run, events, documentId]);
  const modelStages = [timing.stages.judgment, timing.stages.interpretation].filter(stage => stage.attempts > 0);
  const simulated = modelStages.length > 0 && modelStages.every(stage => stage.modelProvenance === 'simulated' && stage.failedAttempts === 0);
  // Prepared execution delays and scripted approvals never stand in for real latency.
  const illustration = simulated && timing.documentToSearchableMs !== null ? timing.illustration : null;
  if (illustration) {
    const work = illustration.system1;
    return <WorkflowTimingSummary source="Illustrative" scope="Full document route · automated steps" label="Total workflow time"
      total={duration(work.automatedMs)} totalMs={work.automatedMs} parts={[
        { label: 'System 1 decision', value: duration(work.boundedMs), ms: work.boundedMs, role: 'jev' },
        { label: 'Frontier interpretation', value: work.frontierAttempts ? duration(work.frontierMs) : 'Skipped', ms: work.frontierMs, role: 'llm' },
        { label: 'Other steps', value: duration(work.codeMs), ms: work.codeMs, role: 'runtime' },
      ]} otherDetails={[
        { label: 'Runtime policy', ms: work.policyMs },
        ...(work.validationMs > 0 ? [{ label: 'Proposal validation', ms: work.validationMs }] : []),
        { label: 'Publishing', ms: work.publicationMs },
      ]} note="Assumed service times, no queue."
      review={illustration.route === 'interpret' ? 'Add human review before searchable; wait varies.' : undefined} />;
  }
  const live = modelStages.length > 0 && modelStages.every(stage => stage.modelProvenance === 'live' && stage.primaryDurationMs !== null);
  const scriptedReview = timing.simulatedReview && timing.stages.review.attempts > 0;
  const total = live && !scriptedReview ? timing.documentToSearchableMs : null;
  const review = timing.stages.review;
  const boundedMs = timing.stages.judgment.primaryDurationMs;
  const frontierMs = timing.stages.interpretation.status === 'not_used' ? 0 : timing.stages.interpretation.primaryDurationMs;
  const otherMs = remainingMs(total, [boundedMs, frontierMs]);
  return <WorkflowTimingSummary source="Recorded" scope="Full document route" label="Time to searchable"
    total={total === null ? 'Unavailable' : humanWaitDuration(total)} totalMs={total} parts={[
      { label: 'System 1 decision', value: timing.stages.judgment.display, ms: boundedMs, role: 'jev' },
      { label: 'Frontier interpretation', value: timing.stages.interpretation.status === 'not_used' ? 'Skipped' : timing.stages.interpretation.display, ms: frontierMs, role: 'llm' },
      { label: 'Other elapsed', value: displayMs(otherMs), ms: otherMs, role: 'runtime' },
    ]} otherNote={otherMs !== null ? 'The remaining elapsed time after model requests, including runtime, queues, publication and any recorded human review.' : undefined}
    note={total !== null ? 'First read to publication, including queue, runtime & review.' : 'A complete measured route to publication is unavailable.'}
    review={scriptedReview ? 'Human review was simulated; no wait measured.' : review.primaryDurationMs !== null ? `Includes ${humanWaitDuration(review.primaryDurationMs)} of human review.` : review.status === 'pending' ? 'Awaiting human review.' : undefined} />;
}

export function LiveWorkflowTiming({ strategy }: { strategy: MeasuredClassificationStrategy }) {
  const timing = classificationLatency(strategy);
  const boundedMs = strategy.bounded_attempts === 0 && !strategy.components.some(component => component.id === 'judge' && strategy.id === 'system1') ? 0 : timing.bounded.elapsedMs;
  const frontierMs = strategy.frontier_attempts === 0 && !strategy.components.some(component => component.id === 'interpret' || component.id === 'judge' && strategy.id === 'frontier_first') ? 0 : timing.frontier.elapsedMs;
  const otherMs = remainingMs(timing.elapsedMs, [boundedMs, frontierMs]);
  return <WorkflowTimingSummary source="Measured" scope="This document · live preview" label={strategy.status === 'failed' ? 'Until failure' : 'Total classification time'}
    total={timing.elapsedMs === null ? 'Unavailable' : duration(timing.elapsedMs)} totalMs={timing.elapsedMs} parts={[
      { label: 'System 1 decision', value: timing.bounded.display, ms: boundedMs, role: 'jev' },
      { label: 'Frontier interpretation', value: timing.frontierState === 'Bypassed' ? 'Skipped' : timing.frontierState === 'Not reached' ? 'Not reached' : timing.frontier.display, ms: frontierMs, role: 'llm' },
      { label: 'Other elapsed', value: displayMs(otherMs), ms: otherMs, role: 'runtime' },
    ]} otherNote={otherMs !== null ? 'Total elapsed minus model service time. Includes runtime policy, queue waits and request overhead.' : undefined}
    note="Total includes queue & runtime; model times show service work. Approval & publication are outside this preview."
    review={timing.completed && strategy.requires_review ? 'Add human review before publishing; wait unmeasured.' : undefined} />;
}
