import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClassificationMeasurement } from '../src/components/ClassificationMeasurement';
import { PerformanceReport } from '../src/components/PerformanceReport';
import { LiveInterpret } from '../src/components/LiveInterpret';
import { LiveClassificationJourney } from '../src/components/LiveClassificationJourney';
import { classificationElapsedRows, classificationLatency, classificationPerformance, interpretationPerformance, frontierLatencyPercent } from '../src/lib/classificationPerformance';
import { measuredMs, referenceAgreement, type PerformanceReport as Report } from '../src/lib/performanceReport';
import type { AuthoredReferenceAgreement, ChoiceSignal, LessonCatalogue, LiveClassificationComparisonResponse, LiveInterpretResponse, MeasuredClassificationStrategy, MeasuredComponent, ProviderMeta } from '../src/lib/api.generated';
import raw from '../src/data/lessons.json' with { type: 'json' };
import { mockLiveClassification } from './helpers/liveClassificationFixture';

// Deliberately distinct provider, queue, strategy, and trial values expose accidental summation.
const provider = (kind: ProviderMeta['provider'], elapsed: number): ProviderMeta => ({ provider: kind, elapsed_ms: elapsed,
  configured_model: kind === 'jev' ? 'jev-test' : 'gpt-5.5', returned_model: kind === 'jev' ? 'jev-test-returned' : 'gpt-5.5-test-returned',
  request_id: `mock-${kind}`, usage: null, rubric_version: 'test' });
const agreement = (observed: AuthoredReferenceAgreement['observed_category'] = 'invoice'): AuthoredReferenceAgreement => ({
  matching: observed === 'invoice' ? 1 : 0, evaluated: observed === null ? 0 : 1, reference_category: 'invoice', observed_category: observed,
  basis: 'authored lesson reference', scope: 'one synthetic document; not a benchmark',
});
const signal = (kind: ProviderMeta['provider'] = 'jev'): ChoiceSignal => ({ ...provider(kind, 240), kind: 'choice', choice: 'invoice', confidence: 0.97,
  probabilities: { invoice: 0.97, report: 0.03 } });
const step = (overrides: Partial<MeasuredComponent> = {}): MeasuredComponent => ({ id: 'judge', label: 'Judge · System 1', kind: 'bounded_judgment',
  status: 'succeeded', started_after_ms: 0, elapsed_ms: 950, queue_elapsed_ms: 700, provider: provider('jev', 240), error: null, ...overrides });
const policyStep = step({ id: 'policy', label: 'Route · Runtime', kind: 'runtime_policy', started_after_ms: 950, elapsed_ms: 2, queue_elapsed_ms: 0, provider: null });
const strategy = (overrides: Partial<MeasuredClassificationStrategy> = {}): MeasuredClassificationStrategy => ({
  id: 'system1', label: 'System 1 with frontier exceptions', status: 'completed', started_after_ms: 0, finished_after_ms: 960, elapsed_ms: 960,
  components: [step(), policyStep], judgment: signal(), policy: { policy_version: 'policy-test', threshold: 0.8, guard_matched: false,
    selected_route: 'accept', reason: 'accepted', explanation: 'The category meets the configured threshold.' }, interpretation: null,
  output_category: 'invoice', output_kind: 'accepted_category', requires_review: false, bounded_attempts: 1, frontier_attempts: 0, provider_work_ms: 250,
  judgment_agreement: agreement(), output_agreement: agreement(), error: null, ...overrides,
});
const frontierStrategy = (overrides: Partial<MeasuredClassificationStrategy> = {}) => strategy({ id: 'frontier_first', label: 'Frontier first',
  finished_after_ms: 1810, elapsed_ms: 1810, bounded_attempts: 0, frontier_attempts: 1, provider_work_ms: 1800,
  components: [step({ label: 'Judge · Frontier', elapsed_ms: 1800, queue_elapsed_ms: 0, provider: provider('openai', 1780) }), { ...policyStep, started_after_ms: 1800 }], judgment: signal('openai'), ...overrides });
const trial = (strategies: LiveClassificationComparisonResponse['strategies'] = [strategy(), frontierStrategy()]): LiveClassificationComparisonResponse => ({
  version: 'test-v1', comparison_id: 'mock-paired-trial', example_id: 'clear', document_id: 'doc-invoice', content_version: 'source-hash', reference_category: 'invoice',
  started_at: '2026-09-29T00:00:00Z', total_elapsed_ms: 1820, strategies,
  provenance: { documents: 'synthetic content-bound source', bounded_provider: 'live Jev', frontier_provider: 'live GPT-5.5',
    policy: 'same taxonomy, 0.80 threshold, and text guard', confidence_note: 'Confidence is not calibrated correctness.',
    timing_scope: 'One shared start to accepted category or unapproved proposal.', stopping_point: 'accepted category or unapproved proposal',
    quality_scope: 'One authored example; not production accuracy.', sample_count: 1, max_in_flight_provider_requests: 1,
    automatic_retries: 0, human_review: 'not performed', publication: 'not performed' }, operational_writes: 0, published: false,
});
const interpretation = (): LiveInterpretResponse => ({
  version: 'test-v1', example_id: 'proposed', document_id: 'doc-proposed', content_version: 'source-hash',
  proposal: { ...provider('openai', 6071), kind: 'proposal', category: 'correspondence', explanation: 'Actual mocked response.' },
  policy: { source: 'executed', decision_id: null, policy_version: 'policy-test', example_id: 'proposed', content_version: 'source-hash',
    signal: { ...signal('fixture'), choice: 'contract', elapsed_ms: 55 }, threshold: 0.8, guard_enabled: true, guard_matched: true,
    selected_route: 'interpret', reason: 'mixed_purpose', explanation: 'The source discusses proposed terms.', requires_review: true,
    source_excerpt: 'Please confirm these proposed terms.', reference_category: 'correspondence', reference_mismatch: false, policy_violation: false },
  requires_review: true, published: false, operational_writes: 0, provider_calls: 1, provider_source: 'live', signal_source: 'prepared', timing: 'measured provider round trip',
  metrics: { total_elapsed_ms: 6080, policy_elapsed_ms: 0.5, reference_category: 'correspondence', proposal_matches_reference: true, evaluated_documents: 1,
    quality_basis: 'authored lesson reference; not benchmark accuracy', timing_scope: 'interpretation preview' },
});
const renderTrial = (response: LiveClassificationComparisonResponse) => renderToStaticMarkup(createElement(ClassificationMeasurement, {
  state: { status: 'complete', response }, disabled: false, onRun() {},
}));
const row = (html: string, name: string) => html.match(/<tr\b[^>]*>.*?<\/tr>/g)?.find(item => item.includes(name)) || '';

test('reference counts reject unavailable, fractional, contradictory, and zero denominators', () => {
  for (const [matching, evaluated] of [[0, 0], [1, 0], [2, 1], [-1, 3], [1, 1.5], [0.5, 1], [NaN, 1], [1, Infinity], [1, undefined]]) {
    expect(referenceAgreement(matching as number, evaluated as number, 'Reference agreement', 'Authored examples')).toMatchObject({ value: 'Not evaluated', tone: 'neutral' });
  }
  expect(referenceAgreement(0, 1, 'Reference agreement', 'Mismatch')).toMatchObject({ value: '0 / 1', tone: 'caution' });
  expect(referenceAgreement(1, 1, 'Reference agreement', 'Match')).toMatchObject({ value: '1 / 1', tone: 'positive' });
  for (const value of [undefined, null, -1, Infinity, NaN, '12']) expect(measuredMs(value)).toBeNull();
  expect(measuredMs(0)).toBe(0);
});

test('real Judge service bars exclude queue time while strategy and trial elapsed remain separate', () => {
  const result = trial();
  const report = classificationPerformance(result.strategies[0]);
  expect(report.elapsed.value).toBe('960 ms');
  expect(report.components[0]).toMatchObject({ role: 'jev', elapsedMs: 240, model: 'jev-test-returned' });
  expect(report.components[0].detail).toContain('Queue wait: 700 ms');
  expect(report.components[0].detail).toContain('Step including queue: 950 ms');
  expect(report.components.find(item => item.id === 'policy')?.elapsedMs).toBe(2);
  expect(report.components.find(item => item.id === 'interpret')).toMatchObject({ elapsedMs: null, timingLabel: 'Not used' });
  const html = renderTrial(result);
  expect(row(html, 'Judge · System 1')).toContain('performance-bar');
  expect(row(html, 'Judge · System 1')).toContain('240 ms');
  expect(row(html, 'Frontier interpretation')).not.toContain('performance-bar');
  expect(html).toContain('Total trial elapsed: 1.82 s');
  expect(html).toContain('not the sum of both strategies');
  expect(html).toContain('Queueing affects elapsed differences');
  expect(html).not.toContain('2.77 s');
});

test('the latency summary distinguishes bypassed frontier work from unreached and incomplete work', () => {
  const direct = classificationLatency(strategy());
  expect(direct).toMatchObject({ elapsedMs: 960, completed: true, frontierState: 'Bypassed', status: 'Category accepted · measurement complete',
    bounded: { elapsedMs: 240, attempts: 1, display: '240 ms' }, frontier: { elapsedMs: null, attempts: 0, display: 'No request' } });
  expect(classificationLatency(frontierStrategy())).toMatchObject({ frontierState: 'Used', frontier: { elapsedMs: 1780, attempts: 1 } });
  const failed = strategy({ status: 'failed', output_kind: 'unavailable', output_category: null, policy: null, judgment: null,
    components: [step({ status: 'failed', provider: null, elapsed_ms: 780, queue_elapsed_ms: 700 })] });
  expect(classificationLatency(failed)).toMatchObject({ completed: false, frontierState: 'Not reached', bounded: { elapsedMs: 80, failed: true } });
  const incomplete = strategy({ frontier_attempts: 2, components: [step(), policyStep, step({ id: 'interpret', kind: 'frontier_interpretation', provider: provider('openai', 2000) })] });
  expect(classificationLatency(incomplete).frontier).toMatchObject({ elapsedMs: null, attempts: 2, display: 'Unmeasured' });
  const fixture = strategy({ components: [step({ provider: provider('fixture', 55) }), policyStep] });
  expect(classificationLatency(fixture).bounded).toMatchObject({ elapsedMs: null, display: 'Unmeasured' });
  expect(classificationPerformance(fixture).components[0]).toMatchObject({ elapsedMs: null, timingLabel: 'Prepared' });
});

test('paired elapsed bars use recorded wall intervals on one scale without adding component work', () => {
  const values: LiveClassificationComparisonResponse['strategies'] = [strategy({ elapsed_ms: 1000 }), frontierStrategy({ elapsed_ms: 2000 })];
  expect(classificationElapsedRows(values).map(item => [item.elapsedMs, item.widthPercent])).toEqual([[1000, 50], [2000, 100]]);
  values[0].components[0].elapsed_ms = 99999;
  expect(classificationElapsedRows(values).map(item => item.widthPercent)).toEqual([50, 100]);
  const html = renderTrial(trial(values));
  const overview = html.slice(html.indexOf('classification-elapsed-comparison'), html.indexOf('measurement-delta'));
  expect(overview).toContain('Same document · same duration scale');
  expect(overview).toContain('0 frontier requests started');
  expect(overview).toContain('1 frontier request started');
  expect(overview).toContain('width:50%');
  expect(overview).toContain('width:100%');
  expect(overview).toContain('1.00 s');
  expect(overview).toContain('2.00 s');
  expect(overview).not.toContain('99.99 s');
  expect(html).toContain('Two fresh executions apply the same policy');
  expect(html).toContain('Either strategy may need frontier interpretation');
  expect(classificationElapsedRows([strategy({ elapsed_ms: 0 }), frontierStrategy({ elapsed_ms: 0 })]).map(item => item.widthPercent)).toEqual([0, 0]);
  expect(classificationElapsedRows([strategy({ elapsed_ms: NaN }), frontierStrategy({ elapsed_ms: 1000 })]).map(item => item.widthPercent)).toEqual([null, 100]);
});

test('the workflow precedes measured results, with unavailable publication and no invented comparison', () => {
  const catalogue = raw as unknown as LessonCatalogue;
  for (const example of ['clear', 'ambiguous'] as const) {
    const response = mockLiveClassification(example);
    const html = renderToStaticMarkup(createElement(LiveClassificationJourney, {
      state: { status: 'complete', response }, inFlight: false, snapshot: catalogue.classification.snapshot, documentId: response.document_id, onRun() {}, onLeave() {},
    }));
    const summary = html.slice(html.indexOf('live-classification-summary'), html.indexOf('performance-report'));
    expect(html.indexOf('lesson-classification-flow')).toBeLessThan(html.indexOf('live-classification-summary'));
    expect(summary).toContain('Automated classification elapsed');
    expect(summary).toContain(example === 'clear' ? 'Category accepted · measurement complete' : 'Proposal ready · measurement complete');
    expect(summary).toContain(example === 'clear' ? 'Bypassed' : 'Used');
    expect(summary).toContain('Service work · excludes queue');
    expect(summary).toContain('175 ms');
    expect(summary).toContain(example === 'clear' ? 'No request' : '6.07 s');
    expect(summary).toContain('Time to searchable: unavailable');
    expect(summary).not.toContain('performance-report');
    expect(summary).not.toContain('% of frontier');
    expect(html).toContain('Pause route animation');
    expect(html).toContain('Outside preview');
  }
});

test('missing provider metadata uses measured service interval without adding queue twice', () => {
  const report = classificationPerformance(strategy({ components: [step({ provider: null })] }));
  expect(report.components[0].elapsedMs).toBe(250);
  expect(report.components[0].detail).toContain('Measured local step interval');
  const invalid = classificationPerformance(strategy({ components: [step({ provider: null, elapsed_ms: 10, queue_elapsed_ms: 20 })] }));
  expect(invalid.components[0].elapsedMs).toBeNull();
});

test('prepared Interpretation Judge gets no latency bar while the actual frontier response does', () => {
  const report = interpretationPerformance(interpretation());
  expect(report.elapsed.value).toBe('6.08 s');
  expect(report.components.find(item => item.id === 'judge')).toMatchObject({ elapsedMs: null, timingLabel: 'Prepared', quality: { value: '0 / 1' } });
  expect(report.components.find(item => item.id === 'interpret')).toMatchObject({ elapsedMs: 6071, quality: { value: '1 / 1' } });
  const html = renderToStaticMarkup(createElement(PerformanceReport, { report }));
  expect(row(html, 'Judge · System 1')).not.toContain('performance-bar');
  expect(row(html, 'Interpret · Frontier')).toContain('performance-bar');
  expect(html).not.toContain('55 ms');
  expect(html).toContain('Needs approval');
  expect(html).toContain('fixture, not a live System 1 Model response');
  expect(html.replace(/<details class="measurement-guide">[\s\S]*?<\/details>/g, '').replace(/<[^>]+>/g, '')).not.toContain('100%');
});

test('historical interpretation without evaluation or policy timing keeps those values unavailable', () => {
  const result = interpretation();
  result.metrics = null;
  const report = interpretationPerformance(result);
  expect(report.elapsed.value).toBe('Not recorded');
  expect(report.quality.value).toBe('Not evaluated');
  expect(report.components.find(item => item.id === 'policy')?.elapsedMs).toBeNull();
  expect(report.components.find(item => item.id === 'interpret')?.elapsedMs).toBe(6071);
  const invalid = interpretation();
  delete (invalid.metrics as Partial<NonNullable<LiveInterpretResponse['metrics']>>).evaluated_documents;
  expect(interpretationPerformance(invalid).quality.value).toBe('Not evaluated');
});

test('reference mismatches remain inspectable and missing paired denominators never become accuracy', () => {
  const mismatch = strategy({ judgment_agreement: agreement('report'), output_agreement: agreement('report'), output_category: 'report' });
  const report = classificationPerformance(mismatch);
  expect(report.quality).toMatchObject({ value: '0 / 1', tone: 'caution' });
  const html = renderToStaticMarkup(createElement(PerformanceReport, { report }));
  expect(html).toContain('Observed: report. Authored reference: invoice');
  expect(html).toContain('not independent samples');
  expect(html).toContain('not benchmark accuracy');
  delete (mismatch.output_agreement as Partial<AuthoredReferenceAgreement>).evaluated;
  expect(classificationPerformance(mismatch).quality.value).toBe('Not evaluated');
});

test('a failed strategy retains failed service work without claiming valid output or a winning delta', () => {
  const failed = strategy({ status: 'failed', elapsed_ms: 790, finished_after_ms: 790, components: [step({ status: 'failed', provider: null,
    elapsed_ms: 780, queue_elapsed_ms: 700, error: 'Timeout' })], judgment: null, policy: null, output_category: null, output_kind: 'unavailable',
    requires_review: null, judgment_agreement: agreement(null), output_agreement: agreement(null), error: 'Timeout' });
  const report = classificationPerformance(failed);
  expect(report.elapsed.label).toBe('Elapsed until failure');
  expect(report.components[0]).toMatchObject({ elapsedMs: 80, quality: { value: 'Not evaluated' } });
  expect(report.components[0].detail).toContain('Failed attempt duration; no successful result');
  expect(report.components.find(item => item.id === 'interpret')?.timingLabel).toBe('Not reached');
  expect(report.quality.value).toBe('Not evaluated');
  expect(report.scope).toContain('1 bounded');
  const html = renderTrial(trial([failed, frontierStrategy()]));
  expect(html).toContain('Incomplete trial');
  expect(html).toContain('Both strategies must complete to compare');
  expect(html).toContain('Timeout');
  expect(html).not.toContain('System 1 elapsed difference</span><strong>1.02 s lower');
});

test('a slower System 1 trial and additional frontier attempts stay visible as unfavorable results', () => {
  const result = trial([strategy({ elapsed_ms: 3500, finished_after_ms: 3500, frontier_attempts: 2 }), frontierStrategy({ elapsed_ms: 2500, finished_after_ms: 2500 })]);
  result.total_elapsed_ms = 3510;
  const html = renderTrial(result);
  expect(html).toContain('1.00 s higher');
  expect(html).toContain('140.0% of frontier');
  expect(html).toContain('Frontier requests avoided</span><strong>-1</strong>');
  expect(html).toContain('2 with System 1 · 1 frontier first');
  expect(html).toContain('no strategy is assumed to win');
  expect(html).toContain('1 document');
  expect(html).toContain('Final published accuracy and human turnaround are not evaluated');
});

test('relative latency uses the frontier baseline and retains absolute differences', () => {
  expect(frontierLatencyPercent(250, 2000)).toBe(12.5);
  expect(frontierLatencyPercent(2000, 2000)).toBe(100);
  expect(frontierLatencyPercent(3500, 2000)).toBe(175);
  expect(frontierLatencyPercent(0, 2000)).toBe(0);
  for (const [system1, frontier] of [[0, 0], [1, 0], [null, 5], [5, undefined], [-1, 5], [NaN, 5], [5, Infinity], [Number.MAX_VALUE, Number.MIN_VALUE]]) {
    expect(frontierLatencyPercent(system1, frontier)).toBeNull();
  }
  const html = renderTrial(trial([strategy({ elapsed_ms: 250 }), frontierStrategy({ elapsed_ms: 2000 })]));
  expect(html).toContain('12.5% of frontier');
  expect(html).toContain('1.75 s lower');
  expect(html).toContain('not just the Judge request');
  const zero = renderTrial(trial([strategy({ elapsed_ms: 0 }), frontierStrategy({ elapsed_ms: 0 })]));
  expect(zero).toContain('Ratio unavailable');
  expect(zero).toContain('zero frontier baseline');
  expect(zero).not.toContain('NaN%');
});

test('missing or invalid overall durations withhold the absolute delta as well as the ratio', () => {
  for (const elapsed of [NaN, Infinity, -1, undefined]) {
    const html = renderTrial(trial([strategy({ elapsed_ms: elapsed as number }), frontierStrategy()]));
    expect(html).toContain('Ratio unavailable');
    expect(html).toContain('Comparable elapsed timings were not recorded');
    expect(html).toContain('Missing timing is not zero');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    expect(html).not.toContain('ms higher');
  }
});

test('a common service scale is used across reports, with true zero distinct from unmeasured work', () => {
  const report: Report = { ...classificationPerformance(strategy()), components: [
    { ...classificationPerformance(strategy()).components[0], elapsedMs: 250 },
    { id: 'zero', name: 'Zero measured work', role: 'runtime', elapsedMs: 0, quality: referenceAgreement(1, 1, 'Check', 'Recorded'), detail: 'Measured zero' },
    { id: 'unknown', name: 'Unknown work', role: 'human', elapsedMs: null, timingLabel: 'Pending', quality: referenceAgreement(0, 0, 'Check', 'Pending'), detail: 'No completed response' },
  ] };
  const html = renderToStaticMarkup(createElement(PerformanceReport, { report, scaleMs: 1000 }));
  expect(row(html, 'Judge · System 1')).toContain('width:25%');
  expect(row(html, 'Zero measured work')).toContain('width:0%');
  expect(row(html, 'Unknown work')).toContain('Pending');
  expect(row(html, 'Unknown work')).not.toContain('performance-bar');
  expect(html).toContain('scope="col"');
  expect(html).toContain('scope="row"');
  expect(html).toContain('Evidence<span class="sr-only"> for Judge · System 1');
});

test('paid actions are explicit and disabled during a pending or detached request', () => {
  let calls = 0;
  const idle = renderToStaticMarkup(createElement(ClassificationMeasurement, { state: { status: 'idle' }, disabled: false, onRun: () => calls++ }));
  expect(calls).toBe(0);
  expect(idle).toContain('normal provider charges apply');
  expect(idle).toContain('No model calls occur until you press Measure');
  const detached = renderToStaticMarkup(createElement(ClassificationMeasurement, { state: { status: 'idle' }, disabled: true, onRun() {} }));
  expect(detached).toContain('disabled=""');
  const pending = renderToStaticMarkup(createElement(ClassificationMeasurement, { state: { status: 'pending', startedAt: 0 }, disabled: false, onRun() {} }));
  expect(pending).toContain('disabled=""');
  expect(pending).not.toContain('Observed differences');
  const retry = renderToStaticMarkup(createElement(LiveInterpret, { state: { status: 'failed', message: 'Connection unavailable' }, inFlight: true, onRun() {}, onLeave() {} }));
  expect(retry).toMatch(/<button[^>]*disabled=""[^>]*>Retry interpretation<\/button>/);
});

test('request failure has no substituted measurements and preserves a retry action', () => {
  const html = renderToStaticMarkup(createElement(ClassificationMeasurement, { state: { status: 'failed', message: 'Live Jev is not configured' }, disabled: false, onRun() {} }));
  expect(html).toContain('role="alert"');
  expect(html).toContain('Live System 1 Model is not configured');
  expect(html).toContain('Measure both strategies');
  expect(html).not.toContain('Observed differences');
  expect(html).not.toContain('performance-bar');
});

test('server-authored report descriptions render System 1 Model without changing model IDs or evidence records', () => {
  const response = strategy({ components: [step({ label: 'Jev bounded judgment' }), policyStep] });
  const report = classificationPerformance(response);
  report.scope = 'Live Jev signals';
  report.note = 'Live Jev support judgments remain fallible.';
  report.components[0].quality.detail = 'Jev returned a category matching this authored reference.';
  const original = JSON.stringify(response);
  const html = renderToStaticMarkup(createElement(PerformanceReport, { report }));
  expect(html).toContain('System 1 Model bounded judgment');
  expect(html).toContain('Live System 1 Model signals');
  expect(html).toContain('Live System 1 Model support judgments remain fallible');
  expect(html).toContain('System 1 Model returned a category');
  expect(html).toContain('jev-test-returned');
  expect(html).not.toContain('Jev');
  expect(JSON.stringify(response)).toBe(original);
  expect(response.components[0].provider?.provider).toBe('jev');
  expect(response.components[0].label).toBe('Jev bounded judgment');
});
