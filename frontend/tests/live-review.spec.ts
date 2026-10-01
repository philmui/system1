import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LiveReviewPanel } from '../src/components/LiveReview';
import type { LiveReviewResponse } from '../src/lib/api.generated';
import { examplePages } from '../src/lib/reviewExample';
import { reviewPerformance } from '../src/lib/reviewPerformance';

const page = examplePages[2];
const result: LiveReviewResponse = {
  version: 'review-pages-v1', page_id: 'ARC-000377', content_version: page.content_version,
  action: 'classify', metadata: { provider: 'openai', request_id: 'actual-request', configured_model: 'gpt-5.5', returned_model: 'gpt-5.5', elapsed_ms: 4872, usage: null, rubric_version: 'test' },
  judgment: { responsive: 'yes', personal_info: 'yes', privileged: 'uncertain', explanation: 'Actual provider explanation.' },
  proposed_route: 'attorney', redaction: null, validation: 'structured judgment', requires_review: true,
  published: false, operational_writes: 0, provider_calls: 1, provider_source: 'live', timing: 'measured provider round trip',
  metrics: null,
};

test('legal-review page identity is bound to the exact shared source text', () => {
  expect(examplePages).toHaveLength(6);
  for (const page of examplePages) expect(createHash('sha256').update(page.text).digest('hex')).toBe(page.content_version);
});

test('live review makes explicit real calls discoverable without fabricated timing or automatic calls', () => {
  let calls = 0;
  const html = renderToStaticMarkup(createElement(LiveReviewPanel, { page, classification: { status: 'idle' }, redaction: { status: 'idle' }, onClassify: () => calls++, onRedact: () => calls++ }));
  expect(calls).toBe(0);
  expect(html).toContain('Classify page');
  expect(html).toContain('Generate redaction');
  expect(html).toContain('One real API request');
  expect(html).not.toContain('Measured API request');
  expect(html).not.toContain(page.redacted);
});

test('live classification renders actual evidence and review requirement separately from modeled comparison', () => {
  const html = renderToStaticMarkup(createElement(LiveReviewPanel, { page, classification: { status: 'complete', response: result }, redaction: { status: 'idle' }, onClassify() {}, onRedact() {} }));
  expect(html).toContain('4.87 s');
  expect(html).toContain('Actual provider explanation.');
  expect(html).toContain('uncertain');
  expect(html).toContain('Needs attorney review');
  expect(html).toContain('Runtime rule → Attorney review');
  expect(html).toContain('actual-request');
  expect(html).not.toContain('Modeled machine time');
});

test('live redaction shows the actual draft and cannot imply certified completeness or release', () => {
  const actual = page.text.replace('Jordan Lee', '[REDACTED]');
  const redaction: LiveReviewResponse = { ...result, action: 'redact', judgment: null, proposed_route: null, validation: 'exact source rewrite', redaction: { redacted_text: actual, removed_spans: ['Jordan Lee'], explanation: 'Actual draft explanation.' } };
  const html = renderToStaticMarkup(createElement(LiveReviewPanel, { page, classification: { status: 'idle' }, redaction: { status: 'complete', response: redaction }, onClassify() {}, onRedact() {} }));
  expect(html).toContain('Actual draft explanation.');
  expect(html).toContain('Email: jordan.lee@arcadia.example');
  expect(html).not.toContain('Email: [REDACTED]');
  expect(html).toContain('PII completeness is not certified');
  expect(html).toContain('No operational run, approval, or publication was created.');
});

test('pending and failed calls expose no completed measurement or substituted output', () => {
  const failed = renderToStaticMarkup(createElement(LiveReviewPanel, { page, classification: { status: 'failed', message: 'Connection failed' }, redaction: { status: 'idle' }, onClassify() {}, onRedact() {} }));
  expect(failed).toContain('Connection failed');
  expect(failed).toContain('No prepared answer was substituted');
  expect(failed).not.toContain('Measured API request');
  const pending = renderToStaticMarkup(createElement(LiveReviewPanel, { page, classification: { status: 'pending', startedAt: 0 }, redaction: { status: 'idle' }, onClassify() {}, onRedact() {} }));
  expect(pending).toContain('Browser waiting time');
  expect(pending).not.toContain('Measured API request');
  expect(pending.match(/disabled=""/g)).toHaveLength(2);
});

test('component reports preserve action scope and expose reference mismatches without claiming production accuracy', () => {
  const measured: LiveReviewResponse = { ...result, metrics: {
    handler_wall_ms: 4920, input_checks_ms: 2, provider_ms: 4872, code_validation_ms: 3, reference_evaluation_ms: 1,
    timing_scope: 'One preview action; excludes HTTP transport and attorney approval.', workflow_elapsed_ms: null, workflow_quality: null,
    reference: { version: 'review-references-v1', metric: 'fictional_reference_agreement', matched: 2, total: 3,
      checks: [{ criterion: 'Potential privilege', expected: 'no', observed: 'uncertain', matched: false }], extra_removed_characters: null, rewrite_integrity: null,
      basis: 'Authored fictional references, not production accuracy.' },
  } };
  const report = reviewPerformance(measured);
  expect(report.elapsed.value).toBe('4.92 s');
  expect(report.quality.value).toBe('2 / 3');
  expect(report.quality.tone).toBe('caution');
  expect(report.components.find(component => component.id === 'provider')!.elapsedMs).toBe(4872);
  expect(report.components.find(component => component.id === 'approval')!).toMatchObject({ elapsedMs: null, timingLabel: 'Pending' });
  expect(report.outcome.detail).toContain('End-to-end workflow time and final release quality remain unavailable');
  const html = renderToStaticMarkup(createElement(LiveReviewPanel, { page, classification: { status: 'complete', response: measured }, redaction: { status: 'idle' }, onClassify() {}, onRedact() {} }));
  expect(html).toContain('2 / 3');
  expect(html).toContain('expected no; observed uncertain (mismatch)');
  expect(html).toContain('4.92 s');
  expect(html).toContain('4.87 s');
  expect(html).not.toContain('67% accuracy');
});

test('missing historical metrics and zero reference denominators remain unavailable', () => {
  const missing = reviewPerformance(result);
  expect(missing.elapsed.value).toBe('Not recorded');
  expect(missing.quality.value).toBe('Not evaluated');
  expect(missing.components.find(component => component.id === 'provider')!.elapsedMs).toBe(4872);
  expect(missing.components.find(component => component.id === 'validate')!.elapsedMs).toBeNull();
  const withoutProperty = { ...result };
  delete (withoutProperty as Partial<LiveReviewResponse>).metrics;
  expect(reviewPerformance(withoutProperty)).toEqual(missing);
  const noTargets = { ...result, action: 'redact', metrics: { reference: { version: 'test', metric: 'authored_pii_span_coverage', matched: 0, total: 0, checks: [], basis: 'No authored targets.', extra_removed_characters: 0 } } } as unknown as LiveReviewResponse;
  expect(reviewPerformance(noTargets).quality.value).toBe('Not evaluated');
});

test('full target coverage with extra removals remains a caution, not a successful release', () => {
  const overredacted = { ...result, action: 'redact', metrics: { reference: { version: 'test', metric: 'authored_pii_span_coverage', matched: 4, total: 4, checks: [], basis: 'Authored target coverage only.', extra_removed_characters: 180, rewrite_integrity: true } } } as unknown as LiveReviewResponse;
  const report = reviewPerformance(overredacted);
  expect(report.quality.value).toBe('4 / 4');
  expect(report.quality.tone).toBe('caution');
  expect(report.quality.detail).toContain('180 non-target source characters were also removed');
  expect(report.outcome.value).toBe('Needs attorney review');
  expect(report.components.find(component => component.id === 'validate')!.quality.label).toBe('Exact replacement integrity');
  expect(report.note).toContain('independent actions');
});
