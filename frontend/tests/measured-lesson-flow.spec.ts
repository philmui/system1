import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChoiceSignal, LessonCatalogue, LiveClassificationResponse, MeasuredClassificationStrategy, MeasuredComponent, ProviderMeta } from '../src/lib/api.generated';
import raw from '../src/data/lessons.json' with { type: 'json' };
import { buildLessonGraph } from '../src/components/LessonFlow';
import { LiveClassificationJourney } from '../src/components/LiveClassificationJourney';
import { frontierModels } from '../src/lib/frontierModels';

const catalogue = raw as unknown as LessonCatalogue;
const snapshot = catalogue.classification.snapshot;
const doc = (example: string) => catalogue.classification.documents.find(item => item.example_id === example)!.document.id;
const meta = (provider: ProviderMeta['provider'], elapsed_ms: number): ProviderMeta => ({
  provider, elapsed_ms, request_id: `mock-${provider}`, configured_model: provider === 'openai' ? 'gpt-5.5' : 'jev-test',
  returned_model: provider === 'openai' ? 'gpt-5.5-test' : 'jev-test-returned', usage: null, rubric_version: 'test',
});
const signal = (): ChoiceSignal => ({ ...meta('jev', 174), kind: 'choice', choice: 'report', confidence: 0.95, probabilities: { report: 0.95, invoice: 0.05 } });
const step = (id: MeasuredComponent['id'], overrides: Partial<MeasuredComponent> = {}): MeasuredComponent => ({
  id, label: id, kind: id === 'judge' ? 'bounded_judgment' : id === 'policy' ? 'runtime_policy' : 'frontier_interpretation',
  status: 'succeeded', started_after_ms: id === 'judge' ? 0 : 700, elapsed_ms: id === 'judge' ? 700 : id === 'policy' ? 2 : 4320,
  queue_elapsed_ms: id === 'judge' ? 520 : 0, provider: id === 'judge' ? meta('jev', 174) : id === 'policy' ? null : meta('openai', 4310), error: null, ...overrides,
});
const strategy = (overrides: Partial<MeasuredClassificationStrategy> = {}): MeasuredClassificationStrategy => ({
  id: 'system1', label: 'System 1 + exceptions', status: 'completed', started_after_ms: 0, finished_after_ms: 710, elapsed_ms: 710,
  components: [step('judge'), step('policy')], judgment: signal(),
  policy: { policy_version: 'live-policy', threshold: 0.8, guard_matched: false, selected_route: 'accept', reason: 'accepted', explanation: 'Actual judgment meets this threshold.' },
  interpretation: null, output_category: 'report', output_kind: 'accepted_category', requires_review: false,
  bounded_attempts: 1, frontier_attempts: 0, provider_work_ms: 180,
  judgment_agreement: { matching: 1, evaluated: 1, reference_category: 'report', observed_category: 'report', basis: 'authored lesson reference', scope: 'one synthetic document; not a benchmark' },
  output_agreement: { matching: 1, evaluated: 1, reference_category: 'report', observed_category: 'report', basis: 'authored lesson reference', scope: 'one synthetic document; not a benchmark' },
  error: null, ...overrides,
});
const exception = (): MeasuredClassificationStrategy => strategy({
  elapsed_ms: 5030, finished_after_ms: 5030, components: [step('judge'), step('policy'), step('interpret')],
  judgment: { ...signal(), choice: 'invoice', confidence: 0.58 },
  policy: { policy_version: 'live-policy', threshold: 0.8, guard_matched: false, selected_route: 'interpret', reason: 'below_threshold', explanation: 'Actual category confidence is below the configured threshold.' },
  interpretation: { ...meta('openai', 4310), kind: 'proposal', category: 'report', explanation: 'Actual mocked interpretation.' },
  output_kind: 'proposal', requires_review: true, frontier_attempts: 1, provider_work_ms: 4500,
});
const graph = (measurement: MeasuredClassificationStrategy, example = 'ambiguous') => buildLessonGraph({
  run: snapshot.run, events: snapshot.events, documentId: doc(example), mode: 'wide', measurement,
});
const response = (measured = strategy()): LiveClassificationResponse => {
  const subject = catalogue.classification.documents.find(item => item.example_id === 'ambiguous')!;
  return { version: 'live-classification-v1', example_id: 'ambiguous', document_id: subject.document.id, content_version: subject.document.content_version,
    reference_category: 'report', started_at: '2026-09-29T10:00:00Z', total_elapsed_ms: measured.elapsed_ms + 20, strategy: measured,
    provenance: { documents: 'synthetic content-bound source', bounded_provider: 'live Jev', frontier_provider: 'live GPT-5.5 when selected',
      policy: 'executed taxonomy, 0.80 threshold, and text guard', confidence_note: 'Confidence is not accuracy.',
      timing_scope: 'Server preview only; no operational publication.', stopping_point: 'accepted category or unapproved proposal',
      quality_scope: 'One authored reference, not benchmark accuracy.', sample_count: 1, automatic_retries: 0, human_review: 'not performed', publication: 'not performed' },
    operational_writes: 0, published: false,
  };
};

test('a live direct result replaces a prepared exception and never inherits its scripted publication', () => {
  const result = strategy();
  const actual = graph(result);
  const withoutRecording = buildLessonGraph({ run: snapshot.run, events: [], documentId: doc('ambiguous'), mode: 'wide', measurement: result });
  expect(actual).toEqual(withoutRecording);
  expect(actual.nodes.find(node => node.id === 'judge')?.data).toMatchObject({ subtitle: 'System 1 Model · live', detail: 'report · 95% confidence', state: 'succeeded', metric: '174 ms' });
  expect(actual.nodes.find(node => node.id === 'policy')?.data).toMatchObject({ detail: 'Acceptance rule passed', metric: '2.0 ms' });
  expect(actual.nodes.find(node => node.id === 'accept')?.data).toMatchObject({ state: 'succeeded', detail: 'Category: report', onPath: true, active: true });
  expect(actual.nodes.find(node => node.id === 'interpret')?.data).toMatchObject({ state: 'skipped', detail: 'No request made', onPath: false, dimmed: true });
  expect(actual.nodes.find(node => node.id === 'review')?.data).toMatchObject({ state: 'skipped', onPath: false });
  expect(actual.nodes.find(node => node.id === 'publish')?.data).toMatchObject({ state: 'outside_preview', title: 'Publish', onPath: false, active: false, detail: 'Makes content searchable' });
  expect(actual.edges.filter(edge => edge.data?.traversed).map(edge => edge.id).sort()).toEqual(['judge--policy', 'policy--accept']);
  expect(actual.edges.some(edge => edge.data?.current || edge.data?.moving)).toBe(false);
  expect(actual.nodes.find(node => node.id === 'judge')?.ariaLabel).toContain('174 ms');
  expect(actual.nodes.find(node => node.id === 'interpret')?.data.metric).toBeUndefined();
});

test('ready-to-run projection has no fixture judgment, measurements, completed route, or stale live result', () => {
  const actual = buildLessonGraph({ run: snapshot.run, events: snapshot.events, documentId: doc('proposed'), mode: 'wide', measurementReady: true, measurement: exception() });
  const empty = buildLessonGraph({ run: snapshot.run, events: [], documentId: doc('proposed'), mode: 'wide', measurementReady: true });
  expect(actual).toEqual(empty);
  expect(actual.nodes.find(node => node.id === 'judge')?.data).toMatchObject({ subtitle: 'System 1 Model', detail: 'Ready to run', state: 'queued' });
  expect(actual.nodes.every(node => !node.data.onPath && node.data.metric === undefined)).toBe(true);
  expect(actual.nodes.filter(node => node.data.documentLabel).map(node => node.id)).toEqual(['judge']);
  expect(actual.nodes.filter(node => !['review', 'publish'].includes(node.id)).every(node => node.data.state === 'queued')).toBe(true);
  expect(actual.nodes.filter(node => ['review', 'publish'].includes(node.id)).every(node => node.data.state === 'outside_preview')).toBe(true);
  expect(actual.nodes.find(node => node.id === 'review')?.data.detail).toBe('Only after a valid proposal');
  expect(actual.edges.every(edge => !edge.data?.traversed && !edge.data?.current && !edge.data?.moving)).toBe(true);
  expect(actual.nodes.some(node => /96%|58%|Simulated checkpoint|Searchable|Proposal:/.test(node.ariaLabel || ''))).toBe(false);
});

test('a live exception replaces a prepared direct route and stops at its completed interpretation', () => {
  const actual = graph(exception(), 'clear');
  expect(actual.nodes.find(node => node.id === 'judge')?.data.detail).toBe('invoice · 58% confidence');
  expect(actual.nodes.find(node => node.id === 'policy')?.data.detail).toBe('Below 80% threshold');
  expect(actual.nodes.find(node => node.id === 'accept')?.data).toMatchObject({ state: 'skipped', dimmed: true, onPath: false });
  expect(actual.nodes.find(node => node.id === 'interpret')?.data).toMatchObject({ subtitle: 'GPT-5.5 · live', detail: 'Proposal: report', state: 'succeeded', metric: '4.31 s', active: true });
  expect(actual.nodes.find(node => node.id === 'review')?.data).toMatchObject({ state: 'outside_preview', detail: 'Approval required to publish', active: false, onPath: false });
  expect(actual.nodes.find(node => node.id === 'review')?.data.metric).toBeUndefined();
  expect(actual.nodes.find(node => node.id === 'publish')?.data).toMatchObject({ state: 'outside_preview', onPath: false, active: false });
  expect(actual.nodes.find(node => node.id === 'publish')?.ariaLabel).not.toContain('Searchable');
  expect(actual.edges.filter(edge => edge.data?.traversed).map(edge => edge.id).sort()).toEqual(['judge--policy', 'policy--interpret']);
  for (const id of ['interpret--review', 'accept--publish', 'review--publish']) expect(actual.edges.find(edge => edge.id === id)?.data)
    .toMatchObject({ label: id === 'review--publish' ? 'If approved' : 'Later', traversed: false, current: false, moving: false, dimmed: true });
  expect(actual.nodes.find(node => node.id === 'review')?.ariaLabel).toContain('Outside preview');
  expect(actual.nodes.find(node => node.id === 'review')?.ariaLabel).not.toContain('Paused');
});

test('pending and request-level failure expose no component progress, previous result, or selected route', () => {
  for (const overlay of [{ measurementPending: true }, { measurementError: 'Provider configuration is missing' }]) {
    const actual = buildLessonGraph({ run: snapshot.run, events: snapshot.events, documentId: doc('proposed'), mode: 'narrow', measurement: exception(), ...overlay });
    expect(actual.nodes.filter(node => !['review', 'publish'].includes(node.id)).every(node => node.data.state === 'queued')).toBe(true);
    expect(actual.nodes.filter(node => ['review', 'publish'].includes(node.id)).every(node => node.data.state === 'outside_preview')).toBe(true);
    expect(actual.nodes.every(node => !node.data.active && !node.data.onPath && node.data.metric === undefined)).toBe(true);
    expect(actual.edges.every(edge => !edge.data?.traversed && !edge.data?.moving && !edge.data?.current)).toBe(true);
    expect(actual.nodes.find(node => node.id === 'policy')?.data.detail).toBe('Route not returned');
    expect(actual.nodes.find(node => node.id === 'judge')?.data.detail).toBe('measurementPending' in overlay ? 'Response pending' : 'Measurement unavailable');
    expect(actual.nodes.find(node => node.id === 'review')?.ariaLabel).not.toContain('Simulated checkpoint');
  }
});

test('actual bounded failure retains its failed attempt interval and prevents all downstream evidence', () => {
  const failed = strategy({ status: 'failed', judgment: null, policy: null, output_kind: 'unavailable', output_category: null,
    components: [step('judge', { status: 'failed', provider: null, elapsed_ms: 870, queue_elapsed_ms: 520, error: 'Timed out' })], error: 'Timed out' });
  const actual = graph(failed, 'proposed');
  expect(actual.nodes.find(node => node.id === 'judge')?.data).toMatchObject({ state: 'failed', detail: 'Attempt failed', metric: '350 ms' });
  expect(actual.nodes.filter(node => !['judge', 'review', 'publish'].includes(node.id)).every(node => node.data.state === 'queued' && node.data.metric === undefined)).toBe(true);
  expect(actual.nodes.filter(node => ['review', 'publish'].includes(node.id)).every(node => node.data.state === 'outside_preview' && node.data.metric === undefined)).toBe(true);
  expect(actual.edges.every(edge => !edge.data?.traversed)).toBe(true);
});

test('runtime failure after a valid judgment records no selected branch or invented policy latency', () => {
  const failed = strategy({ status: 'failed', components: [step('judge')], policy: null, output_category: null, output_kind: 'unavailable', error: 'Policy did not complete' });
  const actual = graph(failed);
  expect(actual.nodes.find(node => node.id === 'judge')?.data.state).toBe('succeeded');
  expect(actual.nodes.find(node => node.id === 'policy')?.data).toMatchObject({ state: 'failed', detail: 'Policy did not complete', metric: undefined });
  expect(actual.edges.filter(edge => edge.data?.traversed).map(edge => edge.id)).toEqual(['judge--policy']);
});

test('a failed frontier attempt shows its interval without a proposal, approval, or fixture latency', () => {
  const failed = exception();
  failed.status = 'failed'; failed.interpretation = null; failed.output_kind = 'unavailable'; failed.output_category = null;
  failed.components[2] = step('interpret', { status: 'failed', provider: null, elapsed_ms: 6100, queue_elapsed_ms: 1000, error: 'Timed out' });
  const actual = graph(failed, 'proposed');
  expect(actual.nodes.find(node => node.id === 'interpret')?.data).toMatchObject({ state: 'failed', detail: 'Attempt failed · no proposal', metric: '5.10 s', onPath: true });
  expect(actual.nodes.find(node => node.id === 'review')?.data).toMatchObject({ state: 'outside_preview', onPath: false, active: false, detail: 'Only after a valid proposal' });
  expect(actual.nodes.find(node => node.id === 'publish')?.data).toMatchObject({ state: 'outside_preview', onPath: false, active: false });
  expect(actual.edges.filter(edge => edge.data?.traversed).map(edge => edge.id).sort()).toEqual(['judge--policy', 'policy--interpret']);
});

test('high-confidence guard comes from the measured policy and fixture metadata never becomes live speed', () => {
  const result = exception();
  result.judgment = { ...signal(), choice: 'contract', confidence: 0.96 };
  result.policy = { ...result.policy!, reason: 'mixed_purpose', guard_matched: true };
  const actual = graph(result, 'clear');
  expect(actual.nodes.find(node => node.id === 'judge')?.data.detail).toBe('contract · 96% confidence');
  expect(actual.nodes.find(node => node.id === 'policy')?.data.detail).toBe('Mixed-purpose guard');
  result.components[0].provider = meta('fixture', 55);
  result.components[2].provider = { ...meta('fixture', 71), configured_model: 'gpt-5.5', returned_model: null };
  const simulated = graph(result);
  expect(simulated.nodes.find(node => node.id === 'judge')?.data).toMatchObject({ subtitle: 'System 1 Model · simulated', metric: undefined });
  expect(simulated.nodes.find(node => node.id === 'interpret')?.data).toMatchObject({ subtitle: 'GPT-5.5 · simulated', metric: undefined });
});

test('frontier identities use each measured response rather than a fixed or current default model', () => {
  for (const option of frontierModels) {
    const result = exception();
    result.components[2].provider = { ...meta('openai', 4310), configured_model: option.value, returned_model: null };
    expect(graph(result).nodes.find(node => node.id === 'interpret')?.data.subtitle).toBe(`${option.label} · live`);
    const recorded = `${option.value}-recorded-version`;
    result.components[2].provider!.returned_model = recorded;
    expect(graph(result).nodes.find(node => node.id === 'interpret')?.data.subtitle).toBe(`${option.label} · live`);
    result.components[2].provider!.configured_model = null;
    expect(graph(result).nodes.find(node => node.id === 'interpret')?.ariaLabel).toContain(recorded);
  }
});

test('live overlays preserve the verified responsive route geometry and accessibility names', () => {
  for (const mode of ['wide', 'compact', 'narrow'] as const) {
    const prepared = buildLessonGraph({ run: snapshot.run, events: [], documentId: doc('clear'), mode });
    const measured = buildLessonGraph({ run: snapshot.run, events: snapshot.events, documentId: doc('clear'), mode, measurement: exception() });
    expect(measured.nodes.map(node => ({ id: node.id, position: node.position, width: node.width, height: node.height })))
      .toEqual(prepared.nodes.map(node => ({ id: node.id, position: node.position, width: node.width, height: node.height })));
    for (const route of measured.edges) {
      const original = prepared.edges.find(edge => edge.id === route.id)!;
      expect(route.data?.curveControls).toEqual(original.data?.curveControls);
      expect(route.data?.labelPosition).toEqual(original.data?.labelPosition);
      expect([route.sourceHandle, route.targetHandle]).toEqual([original.sourceHandle, original.targetHandle]);
    }
    expect(measured.nodes.find(node => node.id === 'judge')?.ariaLabel).toContain('System 1 Model · live');
    expect(measured.nodes.find(node => node.id === 'publish')?.ariaLabel).toContain('Outside preview');
    expect(measured.nodes.find(node => node.id === 'publish')?.ariaLabel).toContain('Makes content searchable');
    expect(measured.nodes.find(node => node.id === 'publish')?.ariaLabel).not.toContain('Ready');
  }
});

test('the live journey renders actual direct judgment and timings instead of the prepared ambiguous decision', () => {
  let calls = 0;
  const html = renderToStaticMarkup(createElement(LiveClassificationJourney, { snapshot, documentId: doc('ambiguous'),
    state: { status: 'complete', response: response() }, inFlight: false, onRun: () => calls++, onLeave() {} }));
  expect(calls).toBe(0);
  expect(html).toContain('Actual measured decision');
  expect(html).toContain('report · 95%');
  expect(html).toContain('report · accepted category');
  expect(html).toContain('Acceptance rule passed');
  expect(html).toContain('Step timing &amp; provenance');
  expect(html).toContain('174 ms');
  expect(html).toContain('710 ms');
  expect(html).toContain('0 frontier requests started');
  expect(html).toContain('1 System 1 · 0 frontier');
  expect(html).toContain('Category accepted · measurement complete');
  expect(html).toContain('Actual judgment meets this threshold');
  expect(html).toContain('this preview does not publish');
  expect(html).toContain('Measured route');
  expect(html).toContain('Outside preview: approval &amp; publication');
  expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>.*?Pause route animation<\/button>/);
  expect(html).toContain('Visual playback · no new requests · measured timings stay fixed');
  expect(html).not.toContain('invoice · 58%');
  expect(html).not.toContain('Simulated checkpoint');
  expect(html).not.toContain(snapshot.run.id);
  expect(html).not.toContain(snapshot.events[0].timestamp);
});

test('an idle live journey has ready capabilities without fixture decisions, measurements, or automatic calls', () => {
  let requests = 0;
  const html = renderToStaticMarkup(createElement(LiveClassificationJourney, { snapshot, documentId: doc('proposed'),
    state: { status: 'idle' }, inFlight: false, onRun: () => requests++, onLeave() {} }));
  expect(requests).toBe(0);
  expect(html).toContain('Ready to run');
  expect(html).toContain('No completed judgment');
  expect(html).toContain('No completed policy');
  expect(html).toContain('Run document to measure');
  expect(html).not.toContain('performance-report');
  expect(html).not.toContain('Live requests started');
  expect(html).not.toContain('contract · 96%');
  expect(html).not.toContain('Simulated checkpoint');
  expect(html).not.toContain('Searchable');
  expect(html).not.toContain(snapshot.run.id);
});

test('a returned live proposal remains a proposal with a separate unperformed approval', () => {
  const html = renderToStaticMarkup(createElement(LiveClassificationJourney, { snapshot, documentId: doc('ambiguous'),
    state: { status: 'complete', response: response(exception()) }, inFlight: false, onRun() {}, onLeave() {} }));
  expect(html).toContain('invoice · 58%');
  expect(html).toContain('report · proposal');
  expect(html).toContain('Below 80% threshold');
  expect(html).toContain('4.31 s');
  expect(html).toContain('1 System 1 · 1 frontier');
  expect(html).toContain('Proposal ready');
  expect(html).toContain('Unapproved proposal; not published');
  expect(html).toContain('No operational approval or publication occurs');
  expect(html).toContain('Outside preview: approval &amp; publication');
  const contextualStatuses = [...html.matchAll(/class="flow-state state-outside_preview"[^>]*>(.*?)<\/span>/g)];
  expect(contextualStatuses).toHaveLength(2);
  for (const [, status] of contextualStatuses) {
    expect(status).toContain('<svg');
    expect(status).toContain('M12 11v6'); // Existing info icon, not a pending-work dot or pause.
    expect(status).not.toContain('<i');
  }
  expect(html).not.toContain('class="flow-state state-awaiting_review"');
  expect(html).not.toContain('report · accepted category');
  expect(html).not.toContain('Simulated checkpoint');
});

test('a high-confidence live report still follows its mixed-purpose rule into interpretation and unapproved output', () => {
  for (const confidence of [.96, 1]) {
    const actual = exception();
    actual.judgment = { ...signal(), choice: 'report', confidence, probabilities: { report: confidence, correspondence: 1 - confidence } };
    actual.policy = { ...actual.policy!, guard_matched: true, reason: 'mixed_purpose', explanation: 'Proposed terms in the report require interpretation despite high confidence.' };
    const projection = graph(actual);
    expect(projection.nodes.find(node => node.id === 'judge')?.data.detail).toBe(`report · ${confidence * 100}% confidence`);
    expect(projection.nodes.find(node => node.id === 'policy')?.data.detail).toBe('Mixed-purpose guard');
    expect(projection.nodes.find(node => node.id === 'accept')?.data.state).toBe('skipped');
    expect(projection.nodes.find(node => node.id === 'interpret')?.data).toMatchObject({ state: 'succeeded', detail: 'Proposal: report' });
    expect(projection.nodes.find(node => node.id === 'publish')?.data).toMatchObject({ state: 'outside_preview', onPath: false, active: false });
    const html = renderToStaticMarkup(createElement(LiveClassificationJourney, { snapshot, documentId: doc('ambiguous'),
      state: { status: 'complete', response: response(actual) }, inFlight: false, onRun() {}, onLeave() {} }));
    expect(html).toContain(`report · ${confidence * 100}% confidence`);
    expect(html).toContain('<span>Rule · Runtime</span><strong>Mixed-purpose guard</strong>');
    expect(html).toContain('report · proposal');
    expect(html).toContain('1 System 1 · 1 frontier');
    expect(html).toContain('Proposal ready · measurement complete');
    expect(html).toContain('Approval required to publish');
    expect(html).not.toContain('report · accepted category');
    expect(html).not.toContain('Acceptance rule passed');
    expect(html).not.toContain('Simulated checkpoint');
  }
});

test('unknown and tied recorded policy reasons take precedence over a simultaneously matched guard in the graph and receipt', () => {
  for (const { reason, label, judgment } of [
    { reason: 'unknown' as const, label: 'Unknown category', judgment: { ...signal(), choice: 'unknown' as const, confidence: 1, probabilities: { unknown: 1 } } },
    { reason: 'tied' as const, label: 'Tied category signals', judgment: { ...signal(), choice: 'report' as const, confidence: .5, probabilities: { report: .5, correspondence: .5 } } },
  ]) {
    const actual = exception();
    actual.judgment = judgment;
    actual.policy = { ...actual.policy!, guard_matched: true, reason, explanation: `${label} is the selected policy reason; other matching rules are not the selected reason.` };
    expect(graph(actual).nodes.find(node => node.id === 'policy')?.data.detail).toBe(label);
    const html = renderToStaticMarkup(createElement(LiveClassificationJourney, { snapshot, documentId: doc('ambiguous'),
      state: { status: 'complete', response: response(actual) }, inFlight: false, onRun() {}, onLeave() {} }));
    expect(html).toContain(`<span>Rule · Runtime</span><strong>${label}</strong>`);
    expect(html).not.toContain('<span>Rule · Runtime</span><strong>Mixed-purpose guard</strong>');
    expect(html).toContain('report · proposal');
    expect(html).toContain('Proposal ready · measurement complete');
    expect(html).toContain('Approval required to publish');
  }
});

test('pending and transport failure do not substitute prepared timing or completed receipt fields', () => {
  for (const state of [{ status: 'pending' as const, startedAt: 0 }, { status: 'failed' as const, message: 'Live Jev is unavailable' }]) {
    const html = renderToStaticMarkup(createElement(LiveClassificationJourney, { snapshot, documentId: doc('proposed'), state, inFlight: true, onRun() {}, onLeave() {} }));
    expect(html).toContain('No completed judgment');
    expect(html).toContain('No completed policy');
    expect(html).toContain('No completed output');
    expect(html).toContain('No model response is substituted');
    expect(html).not.toContain('performance-report');
    expect(html).not.toContain('contract · 96%');
    expect(html).not.toContain('Simulated checkpoint');
    if (state.status === 'pending') {
      expect(html).toContain('Browser waiting time');
      expect(html).not.toContain('Retry classification');
    } else {
      expect(html).toContain('role="alert"');
      expect(html).toContain('Live System 1 Model is unavailable');
      expect(html).not.toContain('class="primary"');
    }
  }
});

test('a returned failed attempt is measured failure, distinct from a request with no measurement', () => {
  const failed = strategy({ status: 'failed', judgment: null, policy: null, interpretation: null, elapsed_ms: 900,
    output_category: null, output_kind: 'unavailable', requires_review: null, error: 'The bounded request timed out',
    components: [step('judge', { status: 'failed', provider: null, elapsed_ms: 870, queue_elapsed_ms: 520, error: 'The bounded request timed out' })],
    judgment_agreement: { ...strategy().judgment_agreement, matching: 0, evaluated: 0, observed_category: null },
    output_agreement: { ...strategy().output_agreement, matching: 0, evaluated: 0, observed_category: null },
  });
  const html = renderToStaticMarkup(createElement(LiveClassificationJourney, { snapshot, documentId: doc('proposed'),
    state: { status: 'complete', response: response(failed) }, inFlight: false, onRun() {}, onLeave() {} }));
  expect(html).toContain('Elapsed until failure');
  expect(html).toContain('900 ms');
  expect(html).toContain('350 ms');
  expect(html).toContain('Failed attempt duration; no successful result');
  expect(html).toContain('No completed output');
  expect(html).toContain('Not evaluated');
  expect(html).toContain('The bounded request timed out');
  expect(html).not.toContain('Category accepted');
  expect(html).not.toContain('Simulated checkpoint');
});
