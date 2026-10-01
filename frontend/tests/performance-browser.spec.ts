import { expect, test } from '@playwright/test';
import raw from '../src/data/lessons.json' with { type: 'json' };

const subject = raw.classification.documents.find(item => item.example_id === 'clear')!;
const agreement = { matching: 1, evaluated: 1, observed_category: 'invoice', reference_category: 'invoice', basis: 'authored lesson reference', scope: 'one synthetic document; not a benchmark' };
const comparison = {
  comparison_id: 'browser-measurement', version: 'browser-test', example_id: 'clear', document_id: subject.document.id, content_version: subject.document.content_version,
  reference_category: 'invoice', total_elapsed_ms: 2200, started_at: '2026-09-29T00:00:00Z', published: false, operational_writes: 0,
  provenance: { max_in_flight_provider_requests: 2, timing_scope: 'Concurrent trial excluding approval and publication.', confidence_note: 'The numeric threshold is shared; confidence is not calibrated accuracy.', quality_scope: 'One authored example, not a benchmark.' },
  strategies: ['system1', 'frontier_first'].map((id, index) => ({
    id, label: index ? 'Frontier first' : 'System 1 + exceptions', status: 'completed', elapsed_ms: index ? 2150 : 160,
    bounded_attempts: index ? 0 : 1, frontier_attempts: index ? 1 : 0, output_category: 'invoice', output_kind: 'accepted_category', requires_review: false,
    judgment_agreement: agreement, output_agreement: agreement, policy: { selected_route: 'accept', explanation: 'Category accepted by the same policy.' },
    components: [
      { id: 'judge', label: index ? 'Frontier bounded judgment' : 'System 1 judgment', status: 'succeeded', elapsed_ms: index ? 2120 : 145, queue_elapsed_ms: 5, provider: { elapsed_ms: index ? 2100 : 125, returned_model: index ? 'gpt-5.5' : 'jev-example' } },
      { id: 'policy', label: 'Runtime policy', status: 'succeeded', elapsed_ms: 0.2, queue_elapsed_ms: 0 },
    ],
  })),
};

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) test(`classification measurement is explicit, readable, and separate from the live workflow at ${viewport.width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let requests = 0;
  await page.route('**/api/lessons/compare-classification', async route => {
    requests++;
    expect(route.request().postDataJSON()).toEqual({ example_id: 'clear', content_version: subject.document.content_version, frontier_model: 'gpt-5.5' });
    await route.fulfill({ json: comparison });
  });
  await page.goto('/#explore/classify?example=clear');
  await page.getByRole('group', { name: 'Classification mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
  await page.getByRole('button', { name: 'Compare latency & quality', exact: true }).click();
  expect(requests).toBe(0);
  const measure = page.getByRole('button', { name: 'Measure both strategies', exact: true });
  await measure.focus();
  await page.keyboard.press('Enter');
  const report = page.getByRole('region', { name: 'System 1 + exceptions', exact: true });
  await expect(report.getByText('125 ms', { exact: true })).toBeVisible();
  await expect(report.getByText('160 ms', { exact: true })).toBeVisible();
  await expect(report).toContainText('1 / 1');
  const elapsed = page.getByRole('region', { name: 'Measured strategy elapsed', exact: true });
  await expect(elapsed).toContainText('Same document · same duration scale');
  await expect(elapsed.locator('.classification-elapsed-row')).toHaveCount(2);
  await expect(elapsed).toContainText('0 frontier requests started');
  await expect(elapsed).toContainText('1 frontier request started');
  await expect(elapsed).toContainText('time to searchable is unavailable');
  await expect(page.getByText('1.99 s lower', { exact: true })).toBeVisible();
  expect(requests).toBe(1);
  await expect(page.locator('.lesson-classification-flow')).toHaveCount(0);
  const exceeds = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(exceeds).toBe(false);
  await page.screenshot({ path: testInfo.outputPath(`classification-metrics-${viewport.width}.png`), fullPage: true });
  await page.getByRole('button', { name: 'Workflow', exact: true }).click();
  await expect(page.locator('.lesson-classification-flow')).toBeVisible();
  await expect(page.locator('[data-id="judge"]')).toContainText('Ready to run');
  await expect(page.locator('.performance-report')).toHaveCount(0);
  expect(requests).toBe(1);
});

test('Find measurement explicitly requests live bounded models and does not promise a route before execution', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/api/lessons/discover', async route => {
    requests++;
    expect(route.request().postDataJSON()).toEqual({ example_id: 'find', bounded_mode: 'live', frontier_model: 'gpt-5.5' });
    await gate;
    await route.fulfill({ status: 503, json: { detail: 'Test unavailable provider; no prepared substitution.' } });
  });
  try {
    await page.goto('/#explore/discover?example=find');
    await page.getByRole('group', { name: 'Discovery mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
    expect(requests).toBe(0);
    await page.getByRole('button', { name: 'Run Find', exact: true }).click();
    await expect(page.getByText('Runtime selects next work', { exact: false })).toBeVisible();
    await expect(page.locator('.live-workflow-pending')).not.toContainText('Retrieve');
    release();
    await expect(page.getByRole('alert')).toContainText('no prepared substitution');
    expect(requests).toBe(1);
  } finally { release(); }
});
