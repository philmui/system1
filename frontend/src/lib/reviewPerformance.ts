import type { LiveReviewResponse } from './api.generated';
import { measuredMs, referenceAgreement, unevaluated, type MetricValue, type PerformanceReport } from './performanceReport';
import { duration } from './timing';

/** Each command is one preview action, never a completed legal-review workflow. */
export function reviewPerformance(result: LiveReviewResponse): PerformanceReport {
  const metrics = result.metrics;
  const reference = metrics?.reference;
  const redaction = result.action === 'redact';
  const label = redaction ? 'Authored PII targets removed' : 'Fictional reference agreement';
  const evidence = reference ? `${reference.basis} Reference version: ${reference.version}. ${reference.checks.map(check => `${check.criterion}: expected ${check.expected}; observed ${check.observed}${check.matched ? ' (match)' : ' (mismatch)'}.`).join(' ')}`
    : 'This response has no recorded reference evaluation. No quality result is inferred from the prepared example or model confidence.';
  const extra = reference?.extra_removed_characters;
  const summaryDetail = redaction ? `Authored targets only.${extra !== null && extra !== undefined ? ` ${extra} non-target source characters were also removed.` : ''}`
    : `Against ${reference?.total ?? 'unavailable'} authored labels on one fictional page. Not production accuracy.`;
  const quality: MetricValue = reference ? referenceAgreement(reference.matched, reference.total, label, summaryDetail)
    : unevaluated(label, evidence);
  if (redaction && extra !== undefined && extra !== null && extra > 0) quality.tone = 'caution';
  const componentQuality = { ...quality, detail: `${evidence}${redaction && extra !== null && extra !== undefined ? ` ${extra} non-target source characters were also removed.` : ''}` };
  const elapsed = measuredMs(metrics?.handler_wall_ms);
  const providerMs = metrics ? measuredMs(metrics.provider_ms) : measuredMs(result.metadata.elapsed_ms);
  const validationDetail = redaction
    ? 'Code required disjoint exact source spans and a draft matching only those replacements. It does not certify complete PII removal or permission to release.'
    : 'Code validated the three structured choices and applied the routing rule. A valid schema does not establish semantic correctness.';
  return {
    title: redaction ? 'Redaction action report' : 'Classification action report',
    scope: 'One live frontier action on one fictional page. Attorney approval and final release are pending.',
    elapsed: { label: 'Action elapsed', value: elapsed === null ? 'Not recorded' : duration(elapsed), detail: metrics?.timing_scope || 'Historical response has provider time only; server action elapsed is unavailable.' },
    quality,
    outcome: { label: 'Release state', value: 'Needs attorney review', detail: 'No document was released. End-to-end workflow time and final release quality remain unavailable.', tone: 'caution' },
    components: [
      { id: 'source', name: 'Check source', role: 'source', elapsedMs: measuredMs(metrics?.input_checks_ms), quality: { label: 'Content binding', value: 'Matched', detail: `The page ID and content hash were checked against the fixed fictional source: ${result.content_version}.` }, detail: 'Input admission and source binding; no arbitrary uploaded text is accepted.' },
      { id: 'provider', name: redaction ? 'Generate redaction' : 'Classify page', role: 'llm', model: result.metadata.returned_model || result.metadata.configured_model || 'Model unavailable', elapsedMs: providerMs, quality: componentQuality, detail: 'One measured provider request, including client network and parsing. This is not a production latency or accuracy benchmark.' },
      { id: 'validate', name: redaction ? 'Validate rewrite' : 'Validate & route', role: 'runtime', elapsedMs: measuredMs(metrics?.code_validation_ms), quality: { label: redaction ? 'Exact replacement integrity' : 'Structured contract', value: 'Passed', detail: validationDetail }, detail: validationDetail },
      { id: 'reference', name: 'Check references', role: 'runtime', elapsedMs: measuredMs(metrics?.reference_evaluation_ms), quality: componentQuality, detail: 'The application compares this response with versioned authored references. These checks do not represent a held-out production evaluation.' },
      { id: 'approval', name: 'Attorney approval', role: 'human', elapsedMs: null, timingLabel: 'Pending', quality: unevaluated('Final release quality', 'No attorney approval or final release evaluation has occurred.'), detail: 'The preview does not create or bypass an operational approval.' },
    ],
    note: 'Action elapsed is measured separately from component work. Classification and redaction buttons start independent actions; their times are not summed into end-to-end workflow latency. Confidence is not accuracy.',
  };
}
