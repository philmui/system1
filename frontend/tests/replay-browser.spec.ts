import { expect, test, type Page } from '@playwright/test';
import type { Document, Event, Run, RunSnapshot } from '../src/lib/api.generated';
import { classificationReplaySteps } from '../src/lib/replay';

// A recorded parallel batch: one direct acceptance, one reviewed proposal,
// and one unreadable document. No providers or persistent library are changed.
function recording() {
  const events: Event[] = [];
  const emit = (type: Event['type'], instance_id: string, payload: Record<string, unknown>) => events.push({
    schema_version: 1, event_id: `event-${events.length + 1}`, sequence: events.length + 1,
    timestamp: '2026-01-01T00:00:00Z', run_id: 'replay-fixture', instance_id, type, payload, attempt: 1,
    parent_instance_id: /:(extract|jev|interpret|outcome)$/.test(instance_id) ? `worker:${instance_id.split(':')[0]}` : null,
  });
  const node = (id: string, name: string, state: string, documentId?: string, extra = {}) => emit(
    state === 'failed' ? 'node_failed' : ['running', 'queued', 'awaiting_review'].includes(state) ? 'node_started' : 'node_completed',
    id, { node_name: name, label: name, state, document_id: documentId, ...extra },
  );
  const edge = (source: string, target: string) => emit('edge_selected', source, { source_instance_id: source, target_instance_id: target, label: 'Recorded route' });
  const signal = { provider: 'fixture', request_id: 'fixture-request', configured_model: 'fixture', returned_model: 'fixture', elapsed_ms: 56, usage: null, rubric_version: 'v1' };
  const decide = (doc: string, proposal = false) => emit('decision', `${doc}:${proposal ? 'interpret' : 'jev'}`, {
    id: `${doc}:${proposal ? 'proposal' : 'choice'}`, input_refs: [doc], input_excerpt: 'Recorded document text.',
    rubric: 'Choose the document category.', threshold: .8, policy_version: 'v1', omitted_context: [], policy_elapsed_ms: 1,
    signal: proposal ? { ...signal, kind: 'proposal', category: 'contract', explanation: 'The email contains proposed service terms.' }
      : { ...signal, kind: 'choice', choice: doc === 'a' ? 'invoice' : 'contract', confidence: doc === 'a' ? .97 : .51, probabilities: { invoice: doc === 'a' ? .97 : .49, contract: doc === 'a' ? .03 : .51 } },
    selected_route: proposal ? 'review' : doc === 'a' ? 'accept' : 'interpret',
    explanation: proposal ? 'Every LLM proposal requires human review.' : doc === 'a' ? 'Confidence meets the acceptance threshold.' : 'Confidence is below the acceptance threshold.',
  });
  emit('run_started', 'run', { kind: 'classification', mode: 'test-fixture' });
  node('dispatch', 'dispatch', 'running');
  for (const id of ['a', 'b', 'c']) emit('worker_created', `worker:${id}`, { node_name: 'worker', label: `Document ${id}`, state: 'queued', document_id: id });
  node('dispatch', 'dispatch', 'succeeded');
  node('worker:a', 'worker', 'running', 'a');
  node('a:extract', 'extract', 'running', 'a');
  node('a:extract', 'extract', 'succeeded', 'a');
  edge('a:extract', 'a:jev');
  node('worker:b', 'worker', 'running', 'b');
  node('b:extract', 'extract', 'running', 'b');
  node('b:extract', 'extract', 'succeeded', 'b');
  edge('b:extract', 'b:jev');
  node('a:jev', 'jev', 'running', 'a');
  node('b:jev', 'jev', 'running', 'b');
  node('a:jev', 'jev', 'succeeded', 'a'); decide('a'); edge('a:jev', 'a:outcome');
  node('a:outcome', 'outcome', 'succeeded', 'a', { outcome: 'accepted' });
  node('worker:a', 'worker', 'succeeded', 'a', { outcome: 'accepted' });
  node('b:jev', 'jev', 'succeeded', 'b'); decide('b'); edge('b:jev', 'b:interpret');
  node('b:interpret', 'interpret', 'running', 'b');
  node('c:extract', 'extract', 'running', 'c');
  node('c:extract', 'extract', 'failed', 'c', { detail: 'The document contains no readable text.' });
  edge('c:extract', 'c:outcome');
  node('c:outcome', 'outcome', 'failed', 'c', { outcome: 'extraction_issue' });
  node('worker:c', 'worker', 'failed', 'c', { outcome: 'extraction_issue' });
  node('b:interpret', 'interpret', 'succeeded', 'b'); decide('b', true); edge('b:interpret', 'b:outcome');
  node('b:outcome', 'outcome', 'awaiting_review', 'b', { outcome: 'awaiting_review' });
  node('worker:b', 'worker', 'awaiting_review', 'b', { outcome: 'awaiting_review' });
  node('join', 'join', 'succeeded', undefined, { completed: 3, expected: 3 }); edge('join', 'review');
  const review = { interrupt_id: 'review-1', revision: 1, items: [{ document_id: 'b', filename: 'atlas-ambiguous-email.md', proposal: 'contract', explanation: 'Mixed content.' }] };
  node('review', 'review', 'awaiting_review'); emit('review_requested', 'review', review);
  node('worker:b', 'worker', 'succeeded', 'b', { outcome: 'accepted' });
  emit('review_resumed', 'review', { interrupt_id: 'review-1', revision: 1, count: 1 });
  node('review', 'review', 'succeeded'); edge('review', 'index');
  node('index', 'index', 'running'); node('index', 'index', 'succeeded'); edge('index', 'done');
  node('done', 'done', 'succeeded');
  const result = { indexed_count: 2, outcomes: {
    a: { document_id: 'a', status: 'accepted', category: 'invoice' },
    b: { document_id: 'b', status: 'accepted', category: 'contract' },
    c: { document_id: 'c', status: 'extraction_issue', category: 'unknown' },
  } };
  emit('run_completed', 'run', { status: 'partially_succeeded', result });
  const run = { id: 'replay-fixture', thread_id: 'replay-fixture', kind: 'classification', status: 'partially_succeeded', mode: 'test-fixture',
    graph_version: 'v1', policy_version: 'v1', created_at: events[0].timestamp, updated_at: events[0].timestamp,
    result, review: null, last_event_sequence: events.length, trace_url: null, telemetry_status: 'disabled',
    request: { document_ids: ['a', 'b', 'c'] }, configuration: { choice_threshold: .8 }, linked_run_id: null, error: null,
  } as Run;
  const documents = ['atlas-invoice-january.md', 'atlas-ambiguous-email.md', 'atlas-empty.txt'].map((filename, index) => ({
    id: ['a', 'b', 'c'][index], filename, category: ['invoice', 'contract', 'unknown'][index], category_provenance: 'jev',
    indexed: index !== 2, synthetic: true, document_date: null, date_provenance: 'unknown', extraction_status: index === 2 ? 'empty' : 'readable',
  })) as Document[];
  return { snapshot: { run, events, last_event_sequence: events.length } as RunSnapshot, documents };
}
const fixture = recording();

async function openRecording(page: Page) {
  const methods: string[] = [];
  await page.route('**/api/**', async route => {
    methods.push(route.request().method());
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/health' ? { mode: 'test-fixture', fts5: true, integrations: {} }
      : path === '/api/documents' ? { documents: fixture.documents, excluded_unknown_dates: 0 }
        : path === '/api/runs' ? { runs: [fixture.snapshot.run] } : fixture.snapshot;
    await route.fulfill({ json: body });
  });
  await page.goto('/#runs/replay-fixture');
  await expect(page.getByTestId('replay-narrative')).toBeVisible();
  return methods;
}

async function seek(page: Page, document: string, predicate: (step: ReturnType<typeof classificationReplaySteps>[number]) => boolean) {
  const steps = classificationReplaySteps(fixture.snapshot.events, document);
  const index = steps.findIndex(predicate);
  expect(index).toBeGreaterThanOrEqual(0);
  const slider = page.getByRole('slider', { name: 'Replay step', exact: true });
  await slider.focus(); await slider.press('Home');
  for (let i = 0; i <= index; i++) await slider.press('ArrowRight');
  await expect(slider).toHaveValue(String(index + 1));
}

test('the numbered document moves once, preserves its position when paused, and resumes at the selected speed', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 1000 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const methods = await openRecording(page);
  await seek(page, 'a', step => step.source === 'a:extract');
  const packet = page.getByTestId('replay-document');
  await expect(packet).toBeVisible();
  expect((await packet.boundingBox())!.height).toBeGreaterThan(40);
  await expect(packet.locator('text')).toHaveText('01');
  await expect(page.locator('.flow-node.is-active')).toHaveCount(1);
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect.poll(() => packet.evaluate(el => Number(el.getAnimations()[0]?.currentTime || 0))).toBeGreaterThan(200);
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await expect.poll(() => packet.evaluate(el => el.getAnimations()[0]?.playState)).toBe('paused');
  const stopped = await packet.evaluate(el => Number(el.getAnimations()[0].currentTime));
  const position = await packet.boundingBox();
  await page.waitForTimeout(350);
  expect(await packet.evaluate(el => Number(el.getAnimations()[0].currentTime))).toBeCloseTo(stopped, 0);
  expect((await packet.boundingBox())!.x).toBeCloseTo(position!.x, 0);
  await page.getByRole('slider', { name: 'Playback speed', exact: true }).press('End');
  await expect.poll(() => packet.evaluate(el => el.getAnimations()[0]?.playbackRate)).toBe(4);
  const at = Number(await page.getByRole('slider', { name: 'Replay step', exact: true }).inputValue());
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect.poll(async () => Number(await page.getByRole('slider', { name: 'Replay step', exact: true }).inputValue()), { intervals: [50], timeout: 2500 }).toBeGreaterThan(at);
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await seek(page, 'a', step => step.kind === 'decision');
  await expect(page.locator('.replay-decision-badge')).toContainText('Invoice');
  await page.getByRole('button', { name: 'Step backward' }).click();
  await expect(page.locator('.replay-decision-badge')).toHaveCount(0);
  await page.getByRole('button', { name: 'Batch overview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Batch overview', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(methods.every(method => method === 'GET')).toBe(true);
  expect(errors).toEqual([]);
});

test('interpretation, review, and failure remain understandable on mobile and with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 1000 });
  await openRecording(page);
  await page.getByRole('combobox', { name: 'Follow input' }).selectOption('worker:b');
  await seek(page, 'b', step => step.target === 'b:interpret');
  await expect(page.getByTestId('replay-narrative')).toContainText('Taking the interpretation route');
  await expect(page.getByTestId('rf__node-interpret').locator('.flow-node')).toHaveClass(/is-active/);
  await expect(page.getByTestId('replay-document').locator('text')).toHaveText('02');
  await page.getByRole('button', { name: 'Full workflow', exact: true }).click();
  await seek(page, 'b', step => step.kind === 'review' && step.title.includes('must review'));
  await expect(page.getByTestId('rf__node-review').locator('.flow-node')).toHaveClass(/is-active/);
  await expect(page.getByTestId('replay-narrative')).toContainText('A person must review');
  await page.getByRole('combobox', { name: 'Follow input' }).selectOption('worker:c');
  await page.getByRole('slider', { name: 'Replay step', exact: true }).press('End');
  await expect(page.getByTestId('replay-narrative')).toContainText('Document not indexed');
  await expect(page.getByTestId('rf__node-index').locator('.flow-node')).toHaveClass(/is-dimmed/);
  await page.getByRole('combobox', { name: 'Follow input' }).selectOption('worker:b');
  await seek(page, 'b', step => step.target === 'b:interpret');
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('replay-narrative')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('.recorded-inputs > summary').click();
  const toolbar = await page.locator('.canvas-toolbar').boundingBox();
  const inputs = await page.locator('.run-input-tray').boundingBox();
  const viewToggle = await page.getByRole('group', { name: 'Replay view' }).boundingBox();
  expect(viewToggle!.y + viewToggle!.height).toBeLessThanOrEqual(toolbar!.y + toolbar!.height);
  expect(inputs!.y).toBeGreaterThanOrEqual(toolbar!.y + toolbar!.height);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const packet = page.getByTestId('replay-document');
  await expect(packet).toBeVisible();
  await expect.poll(() => packet.evaluate(el => el.getAnimations().length)).toBe(0);
  await expect(page.locator('.flow-route.is-current')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Step forward' })).toBeEnabled();
});
