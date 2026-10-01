import type { MeasuredClassificationStrategy, RunSnapshot } from './api.generated';
import type { LessonNodeId } from './lessonLayout';
import { runtimeRuleLabel } from './classification';
import { classificationServiceMs } from './classificationPerformance';
import { duration } from './timing';
import { lessonTiming } from './lessonTiming';
import { classificationReplaySteps } from './replay';

export interface ClassificationJourneyStep {
  node?: LessonNodeId;
  edge?: string;
  title: string;
  detail: string;
  duration: number;
}

/** A common linear scale preserves relative work above the reading floor.
 * Long calls compress together; tiny code steps remain visible, unknown != zero. */
export function relativeMotionTiming(values: (number | null)[]) {
  const valid = (ms: number | null): ms is number => ms !== null && Number.isFinite(ms) && ms >= 0;
  const maximum = Math.max(0, ...values.filter(valid));
  const scale = maximum > 6000 ? 6000 / maximum : 1;
  return (ms: number | null) => valid(ms) ? Math.max(650, ms * scale) : 1100;
}

/** Presentation steps describe returned work; they never simulate a provider event. */
export function classificationJourney(strategy?: MeasuredClassificationStrategy): ClassificationJourneyStep[] {
  if (!strategy || strategy.status !== 'completed' || !strategy.judgment || !strategy.policy || !strategy.output_category) return [];
  const succeeded = (id: string) => strategy.components.filter(component => component.id === id).at(-1)?.status === 'succeeded';
  if (!succeeded('judge') || !succeeded('policy')) return [];
  const direct = strategy.policy.selected_route === 'accept';
  if (direct ? strategy.output_kind !== 'accepted_category' : !succeeded('interpret') || !strategy.interpretation || strategy.output_kind !== 'proposal') return [];
  const work = (id: string) => {
    const components = strategy.components.filter(component => component.id === id);
    const values = components.map(classificationServiceMs);
    return values.length && values.every(value => value !== null) ? values.reduce<number>((sum, value) => sum + value!, 0) : null;
  };
  const judgeMs = work('judge'), policyMs = work('policy'), interpretMs = direct ? null : work('interpret');
  const motionDuration = relativeMotionTiming([judgeMs, policyMs, interpretMs]);
  const time = (ms: number | null) => ms === null ? 'Service timing unavailable; motion is illustrative.' : `Recorded service work: ${duration(ms)}.`;
  return [
    { node: 'judge', title: 'Judge · System 1', detail: `Returned ${strategy.judgment.choice} with ${Math.round(strategy.judgment.confidence * 100)}% confidence.`, duration: 650 },
    { edge: 'judge--policy', title: 'Judgment → runtime policy', detail: `The document carries its category and confidence to the runtime. ${time(judgeMs)}`, duration: motionDuration(judgeMs) },
    { node: 'policy', title: 'Route · Runtime policy', detail: `${runtimeRuleLabel(strategy.policy.reason, strategy.policy.threshold)}. Selected: ${direct ? 'accept' : 'interpret'}.`, duration: 1100 },
    { edge: direct ? 'policy--accept' : 'policy--interpret', title: direct ? 'Runtime policy → accept' : 'Runtime policy → interpret',
      detail: direct ? `The bounded category passes the rule; no frontier request is needed. ${time(policyMs)}` : `The runtime selects frontier interpretation for this document. ${time(interpretMs)}`, duration: motionDuration(direct ? policyMs : interpretMs) },
    { node: direct ? 'accept' : 'interpret', title: direct ? 'Accepted category · preview ends here' : 'Proposal ready · preview ends here',
      detail: direct ? `${strategy.output_category} accepted. Publication is a separate step.` : `${strategy.output_category} proposed. Human approval is required before publication.`, duration: 0 },
  ];
}

/** Retained lessons use the same latency scale. Fixture sleeps cannot drive it. */
export function classificationPlaybackSteps(snapshot: RunSnapshot, documentId: string) {
  const steps = classificationReplaySteps(snapshot.events, documentId, !!snapshot.run.request.simulated_review);
  const { nodes, simulatedReview } = lessonTiming(snapshot.run, snapshot.events, documentId);
  const work = { judge: nodes.judge.primaryDurationMs, policy: nodes.policy.primaryDurationMs,
    interpret: nodes.interpret.primaryDurationMs, publish: nodes.publish.primaryDurationMs };
  const motionDuration = relativeMotionTiming(Object.values(work));
  return steps.flatMap(step => {
    // V2 goes directly from judgment to per-document publication in the log.
    // Show acceptance as its own handoff at the same retained decision prefix.
    if (snapshot.run.graph_version === 'atlas-classification-v2' && step.kind === 'decision' && step.stage === 'route'
      && snapshot.events[step.cursor - 1]?.payload.selected_route === 'accept') return [
        { ...step, duration: Math.max(1050, motionDuration(work.policy)) },
        { ...step, kind: 'transfer' as const, title: 'Runtime policy → accept', detail: 'The category passes the rule. This document can skip frontier interpretation.',
          source: `${documentId}:policy`, target: `${documentId}:accept`, duration: motionDuration(work.policy) },
      ];
    if (step.kind === 'decision' && step.stage === 'route') return { ...step, duration: Math.max(1050, motionDuration(work.policy)) };
    if (step.kind !== 'transfer') return step;
    const component = step.target?.endsWith(':jev') ? 'judge' : step.target?.endsWith(':interpret') ? 'interpret'
      : step.target?.endsWith(':publish') || step.target === 'index' ? 'publish' : step.target?.endsWith(':outcome') && step.source?.endsWith(':jev') ? 'policy' : undefined;
    if (component) return { ...step, duration: motionDuration(work[component]) };
    if (step.target === 'review') return { ...step, duration: simulatedReview ? 1100 : relativeMotionTiming([nodes.review.primaryDurationMs])(nodes.review.primaryDurationMs) };
    return step;
  });
}

export function classificationDocumentLabel(documentIds: unknown, documentId: string) {
  const index = Array.isArray(documentIds) ? documentIds.indexOf(documentId) : -1;
  return String(index < 0 ? 1 : index + 1).padStart(2, '0');
}
