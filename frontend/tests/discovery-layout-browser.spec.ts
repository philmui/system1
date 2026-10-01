import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockLiveDiscovery } from './helpers/liveDiscoveryFixture';

type Bounds = { x: number; y: number; width: number; height: number };
async function bounds(locator: Locator): Promise<Bounds> {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}
async function sameBounds(locator: Locator, expected: Bounds) {
  const actual = await bounds(locator);
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(actual[key] - expected[key]), `canvas ${key}`).toBeLessThanOrEqual(2);
}
async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
async function stopAndSeek(page: Page, key: 'Home' | 'End') {
  const pause = page.getByRole('button', { name: 'Pause lesson', exact: true });
  if (await pause.isVisible()) await pause.click();
  const timeline = page.getByRole('slider', { name: 'Lesson progress', exact: true });
  await timeline.focus();
  await timeline.press(key);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test(`Discovery keeps graph and controls visible without a report pushing them below ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let requests = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/lessons/discover', async route => {
      requests++;
      expect(route.request().postDataJSON()).toEqual({ example_id: 'compare', bounded_mode: 'live', frontier_model: 'gpt-5.5' });
      await gate;
      await route.fulfill({ json: mockLiveDiscovery() });
    });
    try {
      await page.goto('/#explore/discover?example=compare');
      await page.getByRole('group', { name: 'Discovery mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
      const workbench = page.locator('.discovery-workbench');
      const canvas = workbench.locator('.discovery-journey-canvas');
      const run = workbench.getByRole('button', { name: 'Run Compare', exact: true });
      const timeline = page.getByRole('slider', { name: 'Lesson progress', exact: true });
      await expect(run).toBeInViewport({ ratio: 1 });
      await expect(canvas).toBeInViewport({ ratio: 1 });
      await expect(timeline).toBeInViewport({ ratio: 1 });
      const controls = await bounds(workbench.getByRole('group', { name: 'Workflow playback controls' }));
      const latency = await bounds(workbench.getByRole('region', { name: 'Whole run service latency breakdown' }));
      const visualization = await bounds(canvas);
      expect(controls.y + controls.height).toBeLessThanOrEqual(visualization.y + 1);
      expect(latency.y + latency.height).toBeLessThanOrEqual(visualization.y + 1);
      expect(latency.x).toBeGreaterThanOrEqual(controls.x + controls.width - 1);
      await expect(workbench.locator('.discovery-latency')).toContainText('Assumed · whole example');
      await expect(workbench.locator('.discovery-latency-total')).toContainText('7.63 s');
      const bar = workbench.locator('.discovery-latency-bar');
      await expect(bar).toBeInViewport({ ratio: 1 });
      const barBounds = await bounds(bar);
      const contributions = await bounds(workbench.getByLabel('Contributions to total service work', { exact: true }));
      expect(barBounds.y + barBounds.height).toBeLessThanOrEqual(contributions.y);
      const segments = bar.locator('span');
      await expect(segments).toHaveCount(3);
      for (const [index, ms] of [4, 625, 7000].entries()) {
        const segment = await bounds(segments.nth(index));
        expect(Math.abs(segment.width - barBounds.width * ms / 7629)).toBeLessThanOrEqual(0.1);
      }
      await expect(workbench.locator('.performance-report')).toHaveCount(0);
      expect(requests).toBe(0);
      const initial = await bounds(canvas);
      await page.screenshot({ path: testInfo.outputPath(`discovery-idle-${viewport.width}.png`) });
      await run.click();
      await expect(workbench.locator('.live-workflow-pending')).toContainText('Runtime selects next work');
      await expect(workbench.locator('.live-workflow-pending')).not.toContainText('Compose');
      await expect(workbench.getByRole('button', { name: 'Running…', exact: true })).toBeDisabled();
      await expect(workbench.getByRole('combobox', { name: 'Frontier model', exact: true })).toBeDisabled();
      await expect(workbench.locator('.discovery-latency-total')).toContainText('—');
      await expect(segments).toHaveCount(0);
      await sameBounds(canvas, initial);
      await expect(canvas).toBeInViewport({ ratio: 1 });
      release();
      await expect(workbench.locator('.discovery-run-summary')).toContainText('Whole returned run');
      await expect(workbench.locator('.discovery-run-summary')).toContainText('9.50 s');
      await expect(workbench.locator('.discovery-latency')).toContainText('Recorded · whole recording');
      const serviceTotals = await workbench.locator('.discovery-latency').textContent();
      await expect(page.getByRole('button', { name: 'Pause lesson', exact: true })).toBeVisible();
      await stopAndSeek(page, 'End');
      await expect(workbench.locator('.discovery-latency')).toHaveText(serviceTotals!);
      await sameBounds(canvas, initial);
      await expect(canvas).toBeInViewport({ ratio: 1 });
      await expect(timeline).toBeInViewport({ ratio: 1 });
      await expect(run).toBeInViewport({ ratio: 1 });
      await expect(workbench.locator('.performance-report')).toHaveCount(0);
      await expect(page.locator('.claim')).toHaveCount(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      for (const theme of ['Dark', 'Light']) {
        await page.getByTitle(`${theme} mode`, { exact: true }).click();
        await noHorizontalOverflow(page);
        await expect(canvas).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: testInfo.outputPath(`discovery-complete-${theme.toLowerCase()}-${viewport.width}.png`) });
      }
      await workbench.getByRole('combobox', { name: 'Frontier model', exact: true }).selectOption('gpt-4.1');
      await expect(workbench.locator('.discovery-run-summary')).not.toContainText('Whole returned run');
      await expect(workbench.locator('.performance-report')).toHaveCount(0);
      await sameBounds(canvas, initial);
      expect(requests).toBe(1);
    } finally { release(); }
  });
}

test('timing and source drawers return keyboard focus; results follow the replay prefix while whole-run timing stays labeled', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let requests = 0;
  await page.route('**/api/lessons/discover', route => { requests++; return route.fulfill({ json: mockLiveDiscovery() }); });
  await page.goto('/#explore/discover?example=compare');
  await page.getByRole('group', { name: 'Discovery mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
  const workbench = page.locator('.discovery-workbench');
  await workbench.getByRole('button', { name: 'Run Compare', exact: true }).click();
  await expect(workbench.locator('.discovery-run-summary')).toContainText('Whole returned run');
  const timing = workbench.getByRole('button', { name: 'Timing & checks', exact: true });
  await expect(timing).toBeEnabled();
  await timing.focus();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog');
  await expect(drawer.locator('.performance-report')).toContainText('Whole returned execution');
  await expect(drawer).toContainText('9.50 s');
  await expect(drawer).toContainText('not overall latency');
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(timing).toBeFocused();
  await expect(page.getByRole('button', { name: 'Play lesson', exact: true })).toBeVisible();
  const sources = workbench.getByRole('button', { name: 'View sources', exact: true });
  await sources.focus();
  await page.keyboard.press('Enter');
  await expect(drawer).toContainText('access policy');
  await page.keyboard.press('Escape');
  await expect(sources).toBeFocused();
  await stopAndSeek(page, 'End');
  const results = workbench.getByRole('button', { name: 'View results', exact: true });
  await results.focus();
  await page.keyboard.press('Enter');
  await expect(drawer.getByRole('heading', { name: 'An answer, with its evidence', exact: true })).toBeVisible();
  await expect(drawer.locator('.claim')).toHaveCount(2);
  await expect(drawer).toContainText('30 days in 2025 to 14 days in 2026');
  await page.keyboard.press('Escape');
  await expect(results).toBeFocused();
  await stopAndSeek(page, 'Home');
  await expect(results).toBeDisabled();
  await expect(page.locator('.discovery-prefix-count')).toHaveText('At this step: 0 frontier requests');
  await expect(page.locator('.claim')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'An answer, with its evidence', exact: true })).toHaveCount(0);
  await expect(workbench.locator('.discovery-run-summary')).toContainText('Whole returned run');
  await expect(workbench.locator('.discovery-run-summary')).toContainText('9.50 s');
  await timing.click();
  await drawer.getByRole('button', { name: 'Return to prepared example', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(workbench.locator('.discovery-run-summary')).toContainText('Prepared example');
  await expect(workbench.locator('.discovery-run-summary')).not.toContainText('Whole returned run');
  await expect(page.getByRole('slider', { name: 'Lesson progress', exact: true })).toHaveValue('0');
  await expect(results).toBeDisabled();
  await expect(workbench.locator('.performance-report')).toHaveCount(0);
  expect(requests).toBe(1);
});

test('pending and failed Find preserve the canvas and make no claim about an unreturned route', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/api/lessons/discover', async route => {
    requests++;
    await gate;
    await route.fulfill({ status: 503, json: { detail: 'Provider unavailable. No replacement result.' } });
  });
  try {
    await page.goto('/#explore/discover?example=find');
    await page.getByRole('group', { name: 'Discovery mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
    const canvas = page.locator('.discovery-journey-canvas');
    const initial = await bounds(canvas);
    const run = page.locator('.discovery-workbench').getByRole('button', { name: 'Run Find', exact: true });
    await run.click();
    const pending = page.locator('.live-workflow-pending');
    await expect(pending).toContainText('Judge intent');
    await expect(pending).toContainText('Runtime selects next work');
    await expect(pending).not.toContainText('Retrieve');
    await expect(pending).not.toContainText('Compose');
    await sameBounds(canvas, initial);
    release();
    await expect(page.getByRole('alert')).toContainText('No replacement result');
    await expect(run).toBeEnabled();
    await sameBounds(canvas, initial);
    await expect(canvas).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.discovery-workbench .performance-report')).toHaveCount(0);
    await expect(page.locator('.discovery-run-summary')).not.toContainText('Whole returned run');
    expect(requests).toBe(1);
  } finally { release(); }
});

test('mobile Discovery keeps run, playback, and evidence controls reachable without horizontal scrolling', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/lessons/discover', route => route.fulfill({ json: mockLiveDiscovery() }));
  await page.goto('/#explore/discover?example=compare');
  await page.getByRole('group', { name: 'Discovery mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
  const workbench = page.locator('.discovery-workbench');
  const run = workbench.getByRole('button', { name: 'Run Compare', exact: true });
  await expect(run).toBeInViewport({ ratio: 1 });
  await noHorizontalOverflow(page);
  await run.click();
  await expect(workbench.locator('.discovery-run-summary')).toContainText('Whole returned run');
  await stopAndSeek(page, 'End');
  await expect(page.locator('.discovery-journey-canvas')).toBeVisible();
  await expect(workbench.locator('.performance-report')).toHaveCount(0);
  for (const theme of ['Dark', 'Light']) {
    await page.getByTitle(`${theme} mode`, { exact: true }).click();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`discovery-mobile-${theme.toLowerCase()}.png`), fullPage: true });
  }
  await workbench.getByRole('button', { name: 'View results', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.claim')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(workbench.getByRole('button', { name: 'View results', exact: true })).toBeFocused();
});

test('source inspection remains open and focused when a pending Discovery request returns', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const response = mockLiveDiscovery();
  // Real preview runs use an isolated store; a source can retain its lesson
  // identity while receiving a different operational document identifier.
  let serialized = JSON.stringify(response);
  for (const source of response.documents) serialized = serialized.replaceAll(source.document.id, `returned-${source.document.id}`);
  await page.route('**/api/lessons/discover', async route => { await gate; await route.fulfill({ body: serialized, contentType: 'application/json' }); });
  try {
    await page.goto('/#explore/discover?example=compare');
    await page.getByRole('group', { name: 'Discovery mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
    const workbench = page.locator('.discovery-workbench');
    await workbench.getByRole('button', { name: 'Run Compare', exact: true }).click();
    await expect(workbench.locator('.live-workflow-pending')).toBeVisible();
    const sources = workbench.getByRole('button', { name: 'View sources', exact: true });
    await sources.focus();
    await page.keyboard.press('Enter');
    const drawer = page.getByRole('dialog');
    const selectedSource = drawer.getByRole('combobox', { name: 'Source', exact: true });
    await selectedSource.selectOption({ index: 1 });
    const sourceTitle = await selectedSource.locator('option:checked').textContent();
    await selectedSource.focus();
    release();
    await expect(workbench.locator('.discovery-run-summary')).toContainText('Whole returned run');
    await expect(drawer).toBeVisible();
    await expect(selectedSource.locator('option:checked')).toHaveText(sourceTitle!);
    expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    await expect(sources).toBeFocused();
    await expect(page.getByRole('button', { name: 'Play lesson', exact: true })).toBeVisible();
  } finally { release(); }
});

test('keyboard citation inspection focuses each source and result heading without closing the dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.route('**/api/lessons/discover', route => route.fulfill({ json: mockLiveDiscovery() }));
  await page.goto('/#explore/discover?example=compare');
  await page.getByRole('group', { name: 'Discovery mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
  await page.getByRole('button', { name: 'Run Compare', exact: true }).click();
  await expect(page.locator('.discovery-run-summary')).toContainText('Whole returned run');
  await stopAndSeek(page, 'End');
  await page.getByRole('button', { name: 'View results', exact: true }).click();
  const drawer = page.getByRole('dialog');
  const citation = drawer.locator('.citation').last();
  await citation.focus();
  await page.keyboard.press('Enter');
  await expect(drawer.getByRole('heading', { name: 'Source documents', exact: true })).toBeFocused();
  await expect(drawer).toHaveJSProperty('scrollTop', 0);
  expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true);
  const back = drawer.getByRole('button', { name: 'Back to results', exact: true });
  await back.focus();
  await page.keyboard.press('Enter');
  await expect(drawer.locator('.claim')).toHaveCount(2);
  await expect(drawer.getByRole('heading', { name: 'Results at this replay step', exact: true })).toBeFocused();
  await expect(drawer).toHaveJSProperty('scrollTop', 0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'View results', exact: true })).toBeFocused();
});

test('Discovery starts with six capability cards; All steps preserves the paused cursor and adds no request', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let requests = 0;
  const response = mockLiveDiscovery();
  const explanation = String(response.snapshot.events.find(event => event.type === 'decision' && event.instance_id === 'intent')!.payload.explanation);
  await page.route('**/api/lessons/discover', route => { requests++; return route.fulfill({ json: response }); });
  await page.goto('/#explore/discover?example=compare');
  await page.getByRole('group', { name: 'Discovery mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
  const workbench = page.locator('.discovery-workbench');
  const canvas = workbench.locator('.discovery-journey-canvas');
  await expect(canvas.locator('.discovery-tree-card')).toHaveCount(6);
  await expect(canvas.locator('.react-flow__node-component')).toHaveCount(0);
  expect(requests).toBe(0);
  await workbench.getByRole('button', { name: 'Run Compare', exact: true }).click();
  await expect(workbench.locator('.discovery-run-summary')).toContainText('Whole returned run');
  await stopAndSeek(page, 'End');
  const timeline = page.getByRole('slider', { name: 'Lesson progress', exact: true });
  const position = await timeline.inputValue();
  expect(Number(position)).toBeGreaterThan(0);
  const requestCount = await workbench.locator('.discovery-prefix-count').textContent();
  const judgment = canvas.locator('[data-tree-id="judgment"]');
  await judgment.focus();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('heading', { name: 'System 1 returns a signal; runtime rules select the route.', exact: true })).toBeVisible();
  await expect(drawer.getByText('Runtime rule', { exact: true })).toBeVisible();
  await expect(drawer).toContainText(explanation);
  await expect(drawer).toContainText('Policy version');
  await page.keyboard.press('Escape');
  await expect(judgment).toBeFocused();
  await workbench.getByRole('button', { name: 'All steps', exact: true }).click();
  await expect(canvas.locator('.discovery-tree-card')).toHaveCount(0);
  await expect(canvas.locator('.react-flow__node-component')).toHaveCount(9);
  await expect(timeline).toHaveValue(position);
  await expect(workbench.locator('.discovery-prefix-count')).toHaveText(requestCount!);
  await expect(page.getByRole('button', { name: 'Play lesson', exact: true })).toBeVisible();
  await workbench.getByRole('button', { name: 'Decision tree', exact: true }).click();
  await expect(canvas.locator('.discovery-tree-card')).toHaveCount(6);
  await expect(timeline).toHaveValue(position);
  await judgment.click();
  const inspectAll = drawer.getByRole('button', { name: 'Inspect all steps', exact: true });
  await inspectAll.focus();
  await page.keyboard.press('Enter');
  await expect(drawer).not.toBeVisible();
  await expect(workbench.getByRole('button', { name: 'Decision tree', exact: true })).toBeFocused();
  await expect(canvas.locator('.react-flow__node-component')).toHaveCount(9);
  await expect(timeline).toHaveValue(position);
  await workbench.getByRole('button', { name: 'Decision tree', exact: true }).click();
  await stopAndSeek(page, 'Home');
  await judgment.click();
  await expect(drawer).toContainText('No routing decision is visible yet.');
  await expect(drawer).not.toContainText(explanation);
  await page.keyboard.press('Escape');
  expect(requests).toBe(1);
});

test('short 800px Discovery stage grows cards around partial-result text without overlapping or clipping them', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 540 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const response = mockLiveDiscovery();
  response.snapshot.run.status = 'partially_succeeded';
  response.snapshot.run.result = { ...response.snapshot.run.result, partial: true };
  const terminal = response.snapshot.events.find(event => event.type === 'run_completed')!;
  terminal.payload.status = 'partially_succeeded';
  terminal.payload.result = { ...(terminal.payload.result as object), partial: true };
  await page.route('**/api/lessons/discover', route => route.fulfill({ json: response }));
  await page.goto('/#explore/discover?example=compare');
  await page.getByRole('group', { name: 'Discovery mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
  await page.getByRole('button', { name: 'Run Compare', exact: true }).click();
  await expect(page.locator('.discovery-run-summary')).toContainText('Whole returned run');
  await stopAndSeek(page, 'End');
  const canvas = page.locator('.discovery-journey-canvas');
  const cards = canvas.locator('.discovery-tree-card');
  await expect(cards).toHaveCount(6);
  await expect(canvas.locator('[data-tree-id="answer"]')).toContainText('partially succeeded');
  await expect(canvas.locator('[data-tree-id="answer"]')).toContainText('partial result');
  for (const theme of ['Dark', 'Light']) {
    await page.getByTitle(`${theme} mode`, { exact: true }).click();
    const measured = await cards.evaluateAll(elements => elements.map(element => {
      const bounds = element.getBoundingClientRect();
      const rect = (value: DOMRect) => ({ left: value.left, top: value.top, right: value.right, bottom: value.bottom });
      const text = [...element.querySelectorAll('strong, small, .tree-card-roles, .tree-card-detail')].flatMap(item => {
        const range = document.createRange();
        range.selectNodeContents(item);
        return [...range.getClientRects()].map(rect);
      });
      return { id: element.getAttribute('data-tree-id'), bounds: rect(bounds), text,
        height: element.clientHeight, scrollHeight: element.scrollHeight, width: element.clientWidth, scrollWidth: element.scrollWidth };
    }));
    for (const card of measured) {
      expect(card.scrollHeight, `${theme}: ${card.id} text exceeds card height`).toBeLessThanOrEqual(card.height + 1);
      expect(card.scrollWidth, `${theme}: ${card.id} text exceeds card width`).toBeLessThanOrEqual(card.width + 1);
      for (const text of card.text) {
        expect(text.left, `${card.id} left text`).toBeGreaterThanOrEqual(card.bounds.left - 1);
        expect(text.top, `${card.id} top text`).toBeGreaterThanOrEqual(card.bounds.top - 1);
        expect(text.right, `${card.id} right text`).toBeLessThanOrEqual(card.bounds.right + 1);
        expect(text.bottom, `${card.id} bottom text`).toBeLessThanOrEqual(card.bounds.bottom + 1);
      }
      for (const other of measured.filter(other => other.id !== card.id)) {
        const overlaps = card.bounds.left < other.bounds.right && card.bounds.right > other.bounds.left
          && card.bounds.top < other.bounds.bottom && card.bounds.bottom > other.bounds.top;
        expect(overlaps, `${theme}: ${card.id} overlaps ${other.id}`).toBe(false);
      }
    }
    // Local scrolling is allowed when the viewport cannot fit every card.
    await canvas.locator('[data-tree-id="answer"]').scrollIntoViewIfNeeded();
    await canvas.locator('[data-tree-id="answer"]').click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Compose → validate → return', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(canvas.locator('[data-tree-id="answer"]')).toBeFocused();
  }
});
