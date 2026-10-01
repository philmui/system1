import type { LiveInterpretResponse, MeasuredClassificationStrategy, MeasuredComponent, AuthoredReferenceAgreement } from './api.generated';
import { measuredMs, referenceAgreement, unevaluated, type ComponentMetric, type PerformanceReport } from './performanceReport';
import { duration } from './timing';

/** Relative elapsed time, not percentage saved. The frontier strategy is the denominator. */
export function frontierLatencyPercent(system1Ms: unknown, frontierMs: unknown): number | null {
  const system1 = measuredMs(system1Ms), frontier = measuredMs(frontierMs);
  if (system1 === null || frontier === null || frontier === 0) return null;
  const percent = system1 / frontier * 100;
  return Number.isFinite(percent) ? percent : null;
}

/** Service work excludes admission queueing; a fixture delay is never live work. */
export function classificationServiceMs(component: MeasuredComponent): number | null {
  if (component.provider?.provider === 'fixture') return null;
  const request = measuredMs(component.provider?.elapsed_ms);
  if (request !== null) return request;
  const elapsed = measuredMs(component.elapsed_ms), queue = measuredMs(component.queue_elapsed_ms);
  return elapsed === null || queue === null ? null : measuredMs(elapsed - queue);
}

function serviceWork(components: MeasuredComponent[], attempts: number) {
  const values = components.map(classificationServiceMs);
  const elapsedMs = attempts > 0 && components.length === attempts && values.every(value => value !== null)
    ? values.reduce<number>((sum, value) => sum + value!, 0) : null;
  return { elapsedMs, attempts, failed: components.some(component => component.status === 'failed'),
    display: attempts === 0 && !components.length ? 'No request' : elapsedMs === null ? 'Unmeasured' : duration(elapsedMs) };
}

/** One returned strategy only. Never infer a skipped frontier call from a filename. */
export function classificationLatency(strategy: MeasuredClassificationStrategy) {
  const completed = strategy.status === 'completed' && ['accepted_category', 'proposal'].includes(strategy.output_kind);
  const bounded = strategy.components.filter(component => component.id === 'judge' && strategy.id === 'system1');
  const frontier = strategy.components.filter(component => component.id === 'interpret' || component.id === 'judge' && strategy.id === 'frontier_first');
  const frontierState = strategy.frontier_attempts > 0 ? 'Used' : completed && strategy.policy?.selected_route === 'accept' ? 'Bypassed' : completed ? 'Not recorded' : 'Not reached';
  return { elapsedMs: measuredMs(strategy.elapsed_ms), completed, frontierState,
    status: completed ? strategy.output_kind === 'proposal' ? 'Proposal ready · measurement complete' : 'Category accepted · measurement complete' : 'Measurement stopped · no completed output',
    bounded: serviceWork(bounded, strategy.bounded_attempts), frontier: serviceWork(frontier, strategy.frontier_attempts) };
}

/** Both bars use the same duration scale; no component sum is treated as latency. */
export function classificationElapsedRows(strategies: MeasuredClassificationStrategy[]) {
  const maximum = Math.max(0, ...strategies.map(strategy => measuredMs(strategy.elapsed_ms) ?? 0));
  return strategies.map(strategy => {
    const elapsedMs = measuredMs(strategy.elapsed_ms);
    return { strategy, elapsedMs, widthPercent: elapsedMs === null ? null : maximum > 0 ? elapsedMs / maximum * 100 : 0 };
  });
}

const reference = (agreement: AuthoredReferenceAgreement, label: string) => referenceAgreement(agreement.matching, agreement.evaluated, label,
  `Observed: ${agreement.observed_category || 'no output'}. Authored reference: ${agreement.reference_category}. One synthetic document, not benchmark accuracy. Judgment and final output evaluate the same document; they are not independent samples.`);

export function interpretationPerformance(result: LiveInterpretResponse): PerformanceReport {
  const metrics = result.metrics;
  const proposalQuality = metrics ? referenceAgreement(Number(metrics.proposal_matches_reference), metrics.evaluated_documents, 'Proposal reference agreement',
    `Observed: ${result.proposal.category}. Authored reference: ${metrics.reference_category}. One synthetic example, not benchmark accuracy or an approved result.`)
    : unevaluated('Proposal reference agreement', 'This response does not contain a recorded reference evaluation.');
  const judgment = result.policy.signal;
  return {
    title: 'Interpretation report', scope: 'This preview measures policy and interpretation. The System 1 judgment is prepared.',
    elapsed: { label: 'Preview elapsed', value: metrics ? duration(metrics.total_elapsed_ms) : 'Not recorded', detail: 'Server elapsed to a proposal. Excludes a live System 1 call, human approval, and publication.' },
    quality: { ...proposalQuality, detail: metrics ? `Compared with authored category “${metrics.reference_category}”. One document; not benchmark accuracy.` : proposalQuality.detail },
    outcome: { label: 'Publication', value: 'Needs approval', detail: 'No human has reviewed this proposal. Full workflow latency and final published accuracy are not yet available.', tone: 'caution' },
    components: [
      { id: 'judge', name: 'Judge · System 1', role: 'jev', elapsedMs: null, timingLabel: 'Prepared',
        quality: metrics ? referenceAgreement(Number(judgment.choice === metrics.reference_category), 1, 'Prepared category agreement', `Prepared category: ${judgment.choice}; authored reference: ${metrics.reference_category}. This evaluates a fixture, not a live System 1 Model response.`) : unevaluated('Category agreement', 'Reference evaluation not recorded.'),
        detail: 'No live bounded-model request was made in this interpretation-only preview. Open Classify documents, choose Live models, then Run document to measure the actual route, or Compare latency & quality to measure both strategies.' },
      { id: 'policy', name: 'Route · Runtime', role: 'runtime', elapsedMs: measuredMs(metrics?.policy_elapsed_ms),
        quality: { label: 'Applied policy', value: 'Interpret', detail: `${result.policy.explanation} Policy: ${result.policy.policy_version}. A deterministic route is not a semantic accuracy score.` }, detail: 'Elapsed time of the authoritative runtime policy evaluation.' },
      { id: 'interpret', name: 'Interpret · Frontier', role: 'llm', elapsedMs: measuredMs(result.proposal.elapsed_ms),
        model: result.proposal.returned_model || result.proposal.configured_model || undefined, quality: proposalQuality, detail: 'Server-observed API round trip, including network and response parsing.' },
      { id: 'review', name: 'Approve · Human', role: 'human', elapsedMs: null, timingLabel: 'Not performed', quality: unevaluated('Approval quality', 'No review task was created or completed.'), detail: 'Human turnaround is separate from machine work and has not been measured.' },
      { id: 'publish', name: 'Publish · Code', role: 'output', elapsedMs: null, timingLabel: 'Not performed', quality: unevaluated('Published accuracy', 'The proposal has no publication authorization.'), detail: 'This preview cannot publish.' },
    ],
    note: 'Prepared signals have no measured live latency. Reference agreement is a small authored-example check; confidence is not accuracy.',
  };
}

export function classificationPerformance(strategy: MeasuredClassificationStrategy): PerformanceReport {
  const components: ComponentMetric[] = strategy.components.map(component => {
    const judge = component.id === 'judge';
    const policy = component.id === 'policy';
    const provider = component.provider;
    const elapsed = classificationServiceMs(component);
    return {
      id: component.id, name: component.label, role: policy ? 'runtime' : judge && strategy.id === 'system1' ? 'jev' : 'llm', elapsedMs: elapsed,
      model: provider?.returned_model || provider?.configured_model || undefined, timingLabel: provider?.provider === 'fixture' ? 'Prepared' : undefined,
      quality: component.status === 'failed' ? unevaluated('No valid output', component.error || 'The component failed.')
        : judge ? reference(strategy.judgment_agreement, 'Category agreement')
          : policy ? { label: 'Applied policy', value: strategy.policy?.selected_route === 'accept' ? 'Accept' : 'Interpret', detail: `${strategy.policy?.explanation || 'Policy details unavailable.'} This is the executed rule, not a semantic accuracy measurement.` }
            : reference(strategy.output_agreement, 'Proposal agreement'),
      detail: `${component.status === 'failed' ? 'Failed attempt duration; no successful result. ' : ''}${provider?.provider === 'fixture' ? 'No live provider call; fixture timing is excluded.' : provider ? 'Provider round trip includes network and parsing.' : 'Measured local step interval.'} Queue wait: ${duration(component.queue_elapsed_ms)}. Step including queue: ${duration(component.elapsed_ms)}.`,
    };
  });
  if (!strategy.components.some(component => component.id === 'interpret')) components.push({ id: 'interpret', name: 'Frontier interpretation', role: 'llm', elapsedMs: null,
    timingLabel: strategy.status === 'completed' ? 'Not used' : 'Not reached', quality: { label: 'Selected route', value: strategy.status === 'completed' ? 'Bypassed' : 'Stopped', detail: 'No interpretation request was started.' }, detail: 'Skipped work has no service latency; it is not a zero-duration API call.' });
  components.push({ id: 'approval', name: 'Approval & publication', role: 'human', elapsedMs: null, timingLabel: 'Outside preview', quality: unevaluated('Published accuracy', 'No operational approval or publication occurs in this measurement.'), detail: 'This measurement stops at an accepted category or an unapproved proposal. Time to searchable is unavailable because publication is outside this measurement.' });
  return {
    title: strategy.label,
    scope: `${strategy.bounded_attempts} bounded + ${strategy.frontier_attempts} frontier requests started`,
    elapsed: { label: strategy.status === 'failed' ? 'Elapsed until failure' : 'Automated classification elapsed', value: measuredMs(strategy.elapsed_ms) === null ? 'Not recorded' : duration(strategy.elapsed_ms), detail: 'Includes requests, queue waits, and runtime policy. Ends before approval and publication.' },
    quality: { ...reference(strategy.output_agreement, 'Final preview agreement'), detail: strategy.output_category ? `Output: ${strategy.output_category} · reference: ${strategy.output_agreement.reference_category}. One document.` : 'No completed output to compare with the authored category.' },
    outcome: { label: 'Output status', value: strategy.status === 'failed' ? 'Failed' : strategy.output_kind === 'proposal' ? 'Proposal ready' : 'Category accepted', detail: strategy.error || (strategy.output_kind === 'proposal' ? 'Unapproved proposal; not published. Measurement complete; human approval remains required for publication.' : 'Accepted by policy; this preview does not publish. Measurement complete.'), tone: strategy.status === 'failed' ? 'caution' : 'neutral' },
    components,
    note: 'Service bars share one scale across both strategies. They exclude queue waits; automated classification elapsed includes them. Time to searchable is outside this measurement. Accuracy beyond this authored example is not evaluated.',
  };
}
