import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Document, RunSnapshot } from '../src/lib/api.generated';
const backend = 'http://127.0.0.1:8001';
const screenshots = resolve('..', 'docs', 'screenshots');
test('classification fan-out, persistent review, grounded discovery, reconnect, and replay', async ({
  page,
  request,
  context,
}) => {
  await mkdir(screenshots, { recursive: true });
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  let disconnectedOnce = false;
  await page.route('**/api/runs/*/events?*', async (route) => {
    if (!disconnectedOnce) {
      disconnectedOnce = true;
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': deliberate browser-test reconnect\n\n',
      });
    } else await route.continue();
  });
  await page.setViewportSize({ width: 1512, height: 1000 });
  await page.goto('/#library');
  await expect(page.getByText('Simulated', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Explore Project Atlas' }).click();
  await expect(page.getByRole('button', { name: 'Classify (13)' })).toBeVisible();
  // The demo collection now contains only readable files. Supply an explicit
  // negative fixture in this isolated browser-test store to exercise failure UI.
  await request.post(`${backend}/api/documents`, { multipart: { files: { name: 'atlas-empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) } } });
  await page.reload();
  await page.getByRole('checkbox', { name: 'Select all documents' }).uncheck();
  const filenames = ['atlas-invoice-january.md', 'atlas-ambiguous-agreement-email.md', 'atlas-empty.txt'];
  for (const filename of filenames)
    await page.getByRole('checkbox', { name: `Select ${filename}`, exact: true }).check();
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 7000 });
  await page.screenshot({ path: resolve(screenshots, 'library-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Classify (3)' }).click();
  await expect(page.getByTestId('review-panel')).toBeVisible();
  await expect(page.locator('.input-trace-button')).toHaveCount(3);
  await page.getByTestId('rf__node-dispatch').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('rf__node-dispatch').locator('.is-selected')).toBeVisible();
  await page.locator('.recorded-inputs > summary').click();
  await page.locator('.input-trace-button').first().click();
  // A worker can be the empty input. Select an actual decision from the event list.
  await page.getByRole('button', { name: /Event timeline/ }).click();
  await page
    .locator('.event-list button')
    .filter({ has: page.locator('strong', { hasText: /^Decision$/ }) })
    .first()
    .click();
  await expect(page.getByTestId('decision-detail')).toBeVisible();
  await expect(page.getByText('Distribution-derived confidence; not calibrated correctness.')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(screenshots, 'run-desktop.png'), fullPage: true });
  const classificationUrl = page.url();
  await page.reload();
  await expect(page.getByTestId('review-panel')).toBeVisible();
  await page.getByLabel('Review atlas-ambiguous-agreement-email.md', { exact: true }).selectOption('accept');
  await page.getByRole('button', { name: 'Submit all & resume' }).click();
  await expect(page.getByRole('heading', { name: 'Classification results' })).toBeVisible();
  await expect(page.getByTestId('review-panel')).toHaveCount(0);
  await expect(page.locator('.input-trace-button .state-awaiting_review')).toHaveCount(0);
  const documentsResponse = await request.get(`${backend}/api/documents`);
  const all = ((await documentsResponse.json()) as { documents: Document[] }).documents;
  const remaining = all.filter((document) => !filenames.includes(document.filename));
  const classification = await request.post(`${backend}/api/runs/classification`, {
    data: { document_ids: remaining.map((document) => document.id) },
    headers: { 'Idempotency-Key': 'browser-remaining' },
  });
  const secondRun = (await classification.json()) as { id: string };
  await expect
    .poll(
      async () =>
        ((await (await request.get(`${backend}/api/runs/${secondRun.id}`)).json()) as RunSnapshot).run.status,
    )
    .toMatch(/succeeded|awaiting_review/);
  const secondSnapshot = (await (
    await request.get(`${backend}/api/runs/${secondRun.id}`)
  ).json()) as RunSnapshot;
  if (secondSnapshot.run.review) {
    const review = secondSnapshot.run.review;
    await request.post(`${backend}/api/runs/${secondRun.id}/review`, {
      data: {
        interrupt_id: review.interrupt_id,
        revision: review.revision,
        decisions: review.items.map((item) => ({ document_id: item.document_id, action: 'accept' })),
      },
    });
    await expect
      .poll(
        async () =>
          ((await (await request.get(`${backend}/api/runs/${secondRun.id}`)).json()) as RunSnapshot).run
            .status,
      )
      .toBe('succeeded');
  }
  await page.getByRole('link', { name: 'Discover', exact: true }).click();
  await page.getByRole('button', { name: /Compare the details/ }).click();
  await page.getByRole('button', { name: 'Discover', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'An answer, with its evidence' })).toBeVisible();
  await expect(page.locator('.input-trace-button')).toHaveCount(2);
  await expect(page.locator('.discovery-results .citation').first()).toBeVisible();
  await page.getByRole('button', { name: 'Timing & evidence', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Latency and result formation' })).toBeVisible();
  await expect(page.locator('.formation-step').filter({ hasText: 'Draft claims' })).toContainText(/[1-8]/);
  await expect(page.locator('.timing-span.span-jev').first()).toBeVisible();
  await expect(page.getByLabel('System 1 Model request timings')).toBeVisible();
  await expect(page.locator('.jev-request')).toHaveCount(8);
  await expect(page.locator('.jev-request strong').first()).toContainText(/ms|s/);
  await page.getByRole('button', { name: 'Results & sources', exact: true }).click();
  await page.locator('.discovery-results .citation').first().click();
  await expect(page.getByRole('dialog', { name: 'Source passage' })).toBeVisible();
  await expect(page.locator('.source-passage mark')).toBeVisible();
  await page.screenshot({ path: resolve(screenshots, 'source-desktop.png'), fullPage: false });
  await page.keyboard.press('Escape');
  const discoveryId = page.url().split('/').at(-1)!;
  const snapshotBefore = (await (
    await request.get(`${backend}/api/runs/${discoveryId}`)
  ).json()) as RunSnapshot;
  await context.setOffline(true);
  await context.setOffline(false);
  await page.goto(`/#runs/${discoveryId}`);
  await expect(page.getByRole('heading', { name: 'An answer, with its evidence' })).toBeVisible();
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(page.locator('.replay-label')).toHaveText('Replay');
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await page.getByRole('slider', { name: 'Timeline event' }).fill('0');
  await expect(page.locator('.input-trace-button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Step forward' }).click();
  await page.getByRole('slider', { name: 'Timeline event' }).fill(String(snapshotBefore.events.length));
  await expect(page.getByRole('heading', { name: 'An answer, with its evidence' })).toBeVisible();
  const snapshotAfter = (await (
    await request.get(`${backend}/api/runs/${discoveryId}`)
  ).json()) as RunSnapshot;
  expect(snapshotAfter.events).toEqual(snapshotBefore.events);
  expect(snapshotAfter.run.result).toEqual(snapshotBefore.run.result);
  for (const stage of ['intent', 'plan', 'join', 'synthesize', 'citations', 'support', 'done'])
    await expect(page.getByTestId(`rf__node-${stage}`)).toBeVisible();
  // A horizontal SVG route has a zero-height geometric bounding box even
  // though its stroke is visible. Check the painted path inside the canvas.
  const firstRoute = page.locator('.react-flow__edge .react-flow__edge-path').first();
  await expect(firstRoute).toBeAttached();
  expect(await firstRoute.evaluate(element => (element as SVGPathElement).getTotalLength())).toBeGreaterThan(0);
  await expect(firstRoute).toHaveCSS('stroke-width', '3.5px');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(screenshots, 'discovery-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Timing & evidence', exact: true }).click();
  await page
    .getByRole('region', { name: 'Latency and result formation' })
    .screenshot({ path: resolve(screenshots, 'latency-formation.png') });
  await page.getByRole('button', { name: 'Expand workers', exact: true }).click();
  await expect(page.locator('.react-flow__node[data-id="task-1:retrieve"]')).toBeVisible();
  await page
    .getByTestId('execution-graph')
    .screenshot({ path: resolve(screenshots, 'expanded-workers.png') });
  await page.getByRole('button', { name: 'Collapse workers', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Event timeline/ }).click();
  await expect(page.getByLabel('Execution event list')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(screenshots, 'run-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Results & sources', exact: true }).click();
  await page.locator('.results-title').scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(screenshots, 'results-mobile.png'), fullPage: false });
  await page.getByRole('link', { name: 'Discover', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(screenshots, 'discover-mobile.png'), fullPage: true });
  await page.getByRole('textbox', { name: 'Your question' }).fill('Find invoices containing Atlas');
  await page.getByLabel('Category', { exact: true }).selectOption('invoice');
  await page.getByLabel('Document date from', { exact: true }).fill('2026-01-01');
  await page.getByLabel('Through (inclusive)', { exact: true }).fill('2026-03-31');
  await page.getByRole('button', { name: 'Discover', exact: true }).click();
  await expect(page.locator('.passage-card')).toHaveCount(2);
  await expect(page.locator('.search-scope')).toContainText('unknown dates excluded');
  await expect(page.locator('.claim')).toHaveCount(0);
  await page.getByRole('link', { name: 'Discover', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Your question' })
    .fill('What is the Atlas submarine insurance policy number?');
  await page.getByRole('button', { name: 'Discover', exact: true }).click();
  await expect(
    page
      .locator('.result-message')
      .filter({
        hasText: 'The available documents do not provide sufficient supporting evidence for this request.',
      }),
  ).toBeVisible();
  await page.goto(classificationUrl);
  await expect(page.getByRole('heading', { name: 'Classification results' })).toBeVisible();
  expect(disconnectedOnce).toBeTruthy();
  expect(browserErrors).toEqual([]);
});
