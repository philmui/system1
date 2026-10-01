import { expect, test } from '@playwright/test';
import raw from '../src/data/lessons.json' with { type: 'json' };
import { frontierModels } from '../src/lib/frontierModels';
import { mockLiveClassification } from './helpers/liveClassificationFixture';

const result = mockLiveClassification();

for (const example of ['clear', 'ambiguous'] as const) for (const width of [1440, 390]) test(`Run document selects the actual ${example === 'clear' ? 'direct' : 'high-confidence guarded'} route without fixture approval at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const subject = raw.classification.documents.find(item => item.example_id === example)!;
  const result = mockLiveClassification(example);
  const guarded = example === 'ambiguous';
  let requests = 0;
  await page.route('**/api/lessons/classify/live', async route => {
    requests++;
    expect(route.request().postDataJSON()).toEqual({ example_id: example, content_version: subject.document.content_version, frontier_model: 'gpt-5.5' });
    await route.fulfill({ json: result });
  });
  await page.goto(`/#explore/classify?example=${example}&source=illustrative`);
  await page.getByRole('group', { name: 'Classification mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
  const run = page.locator('.lesson-subject').getByRole('button', { name: 'Run document', exact: true });
  await expect(run).toBeVisible();
  await expect(page.getByRole('button', { name: /^Run (System 1 Model|GPT-5\.5)/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Watch prepared replay', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-id="judge"]')).toContainText('Ready to run');
  await expect(page.locator('.performance-report')).toHaveCount(0);
  expect(requests).toBe(0);
  await run.click();
  const live = page.getByRole('region', { name: 'Live classification workflow', exact: true });
  await expect(live).toBeVisible();
  await expect(live.locator('.live-classification-summary')).toContainText(guarded ? '6.32 s' : '192 ms');
  await expect(live.locator('.live-classification-summary')).toContainText(`1 System 1 · ${guarded ? 1 : 0} frontier`);
  await expect(live.locator('.live-classification-summary')).toContainText('Automated classification elapsed');
  await expect(live.locator('.classification-frontier-state')).toHaveText(guarded ? 'Used' : 'Bypassed');
  await expect(live.locator('.classification-measurement-end')).toContainText(guarded ? 'Proposal ready · measurement complete' : 'Category accepted · measurement complete');
  await expect(live.locator('.classification-measurement-end')).toContainText('Time to searchable: unavailable');
  await expect(live.locator('.lesson-receipt')).toContainText(guarded ? 'report · 100% confidence' : 'invoice · 97% confidence');
  await expect(live.locator('.lesson-receipt')).toContainText(guarded ? 'Mixed-purpose guard' : 'Acceptance rule passed');
  await expect(live.locator('.lesson-receipt')).toContainText(guarded ? 'report · proposal' : 'invoice · accepted category');
  const graph = live.locator('.lesson-classification-flow');
  await graph.scrollIntoViewIfNeeded();
  await expect(graph.locator('[data-id="judge"]')).toContainText('System 1 Model · live');
  await expect(graph.locator('[data-id="judge"]')).toContainText('175 ms');
  await expect(live.locator('.performance-components tr.role-jev .performance-duration')).toHaveText('175 ms');
  await expect(graph.locator('[data-id="interpret"]')).toContainText(guarded ? 'GPT-5.5 · live' : 'No request made');
  await expect(graph.locator('[data-id="review"]')).toContainText(guarded ? 'Approval required to publish' : 'Not required by this route');
  if (guarded) {
    await expect(graph.locator('[data-id="interpret"]')).toContainText('6.07 s');
    await expect(live.locator('.lesson-receipt')).not.toContainText('report · 96%');
    await expect(live.locator('.lesson-receipt')).not.toContainText('accepted category');
  }
  await expect(graph.locator('[data-id="publish"]')).toContainText('Outside preview');
  await expect(graph).not.toContainText('Simulated checkpoint');
  await expect(graph).not.toContainText('Searchable');
  await expect(live.locator('.lesson-receipt')).not.toContainText('invoice · 58%');
  await expect(page.getByRole('slider', { name: 'Lesson progress' })).toHaveCount(0);
  await expect(page.locator('.lesson-subject').getByRole('button', { name: 'Run again', exact: true })).toBeEnabled();
  await expect(page.locator('.lesson-outcome')).toHaveCount(0);
  expect(requests).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('leaving a pending workflow returns to ready and disables another call and ignores its later result', async ({ page }) => {
  let requests = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/lessons/classify/live', async route => { requests++; await gate; await route.fulfill({ json: result }); });
  try {
    await page.goto('/#explore/classify?example=ambiguous');
    await page.getByRole('group', { name: 'Classification mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
    await page.locator('.lesson-subject').getByRole('button', { name: 'Run document', exact: true }).click();
    const live = page.getByRole('region', { name: 'Live classification workflow', exact: true });
    await expect(live.getByRole('status')).toContainText('Measuring this document');
    await expect(live.locator('.lesson-receipt')).toContainText('No completed judgment');
    await expect(live.locator('.lesson-receipt')).toContainText('No completed policy');
    await expect(live.locator('.lesson-classification-flow .is-active')).toHaveCount(0);
    await expect(live.locator('.lesson-classification-flow .is-on-path')).toHaveCount(0);
    await expect(live.locator('.performance-report')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Frontier model', exact: true })).toBeDisabled();
    await live.getByRole('button', { name: 'Leave live preview', exact: true }).click();
    await expect(page.locator('.lesson-subject').getByRole('button', { name: 'Processing document…', exact: true })).toBeDisabled();
    release();
    await expect(page.locator('.lesson-subject').getByRole('button', { name: 'Run document', exact: true })).toBeEnabled();
    await expect(live.locator('[data-id="judge"]')).toContainText('Ready to run');
    await expect(live.locator('.performance-report')).toHaveCount(0);
    await expect(page.getByText('175 ms', { exact: true })).toHaveCount(0);
    await expect(page.getByText('report · 100% confidence', { exact: true })).toHaveCount(0);
    expect(requests).toBe(1);
  } finally { release(); }
});

test('live workflow failure does not substitute a prepared judgment, proposal, or publication', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/lessons/classify/live', route => { requests++; return route.fulfill({ status: 502, json: { detail: 'Live Jev request could not connect.' } }); });
  await page.goto('/#explore/classify?example=proposed');
  await page.getByRole('group', { name: 'Classification mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
  await page.locator('.lesson-subject').getByRole('button', { name: 'Run document', exact: true }).click();
  const live = page.getByRole('region', { name: 'Live classification workflow', exact: true });
  await expect(live.getByRole('alert')).toContainText('Live System 1 Model request could not connect');
  await expect(live.locator('.lesson-receipt')).toContainText('No completed judgment');
  await expect(live.locator('.lesson-receipt')).toContainText('No completed policy');
  await expect(live.locator('.lesson-receipt')).toContainText('No completed output');
  await expect(live.locator('.performance-report')).toHaveCount(0);
  await expect(live.locator('[data-id="judge"]')).toContainText('Measurement unavailable');
  await expect(live.locator('[data-id="publish"]')).toContainText('Outside preview');
  await expect(live.locator('.lesson-classification-flow')).not.toContainText('Simulated checkpoint');
  await expect(page.locator('.lesson-subject').getByRole('button', { name: 'Retry document', exact: true })).toBeEnabled();
  expect(requests).toBe(1);
});

test('frontier model selection persists without starting work and each response uses its actual selected model', async ({ page }) => {
  const requested: string[] = [];
  const proposed = raw.classification.documents.find(item => item.example_id === 'proposed')!;
  await page.route('**/api/lessons/classify/live', async route => {
    const body = route.request().postDataJSON();
    const option = frontierModels.find(model => model.value === body.frontier_model)!;
    expect(option).toBeDefined();
    expect(body).toEqual({ example_id: 'proposed', content_version: proposed.document.content_version, frontier_model: option.value });
    requested.push(option.value);
    await route.fulfill({ json: mockLiveClassification('proposed', option.value) });
  });
  await page.goto('/#explore/classify?example=proposed');
  await page.getByRole('group', { name: 'Classification mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
  const selector = page.getByRole('combobox', { name: 'Frontier model', exact: true });
  await expect(selector).toHaveValue('gpt-5.5');
  await expect(selector.locator('option')).toHaveText(frontierModels.map(model => model.label));
  const live = page.getByRole('region', { name: 'Live classification workflow', exact: true });
  for (const [index, option] of frontierModels.entries()) {
    await selector.selectOption(option.value);
    await expect(live.locator('[data-id="judge"]')).toContainText('Ready to run');
    await expect(live.locator('.performance-report')).toHaveCount(0);
    expect(requested).toHaveLength(index);
    await page.locator('.lesson-subject').getByRole('button', { name: 'Run document', exact: true }).click();
    await expect(live.locator('[data-id="interpret"]')).toContainText(`${option.label} · live`);
    await expect(live.locator('.lesson-receipt')).toContainText('correspondence · proposal');
    await expect(live.locator('[data-id="review"]')).toContainText('Approval required to publish');
    await expect(live.locator('[data-id="publish"]')).toContainText('Outside preview');
    expect(requested).toHaveLength(index + 1);
  }
  await selector.selectOption('gpt-4.1');
  await expect(live.locator('[data-id="judge"]')).toContainText('Ready to run');
  await page.reload();
  await expect(selector).toHaveValue('gpt-4.1');
  await expect(live.locator('[data-id="judge"]')).toContainText('Ready to run');
  await expect(live.locator('.performance-report')).toHaveCount(0);
  expect(requested).toEqual(frontierModels.map(model => model.value));
});

test('review destinations distinguish real calls from prepared strategy comparisons', async ({ page }) => {
  await page.goto('/#explore/review');
  await expect(page.getByRole('button', { name: 'Prepared comparison', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Live requests', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Classify page', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Compare', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Prepared comparison', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Run simulation', exact: true })).toBeVisible();
});
