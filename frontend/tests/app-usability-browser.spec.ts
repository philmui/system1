import { expect, test } from '@playwright/test';

test('a first-time user can run and inspect prepared workflows without starting model requests', async ({ page }) => {
  const modelWrites: string[] = [];
  await page.route(/\/api\/lessons\/(classify\/(live|compare)|discover|review\/.*)/, route => {
    modelWrites.push(route.request().url());
    return route.fulfill({ status: 405, json: { detail: 'Prepared simulations must not start a model request.' } });
  });
  await page.goto('/#explore/classify?example=clear');
  const run = page.locator('.lesson-subject').getByRole('button', { name: 'Run simulation', exact: true });
  await expect(run).toBeInViewport();
  await expect(page.locator('.node-document')).toHaveCount(1);
  await run.click();
  await expect(page.locator('.lesson-subject').getByRole('button', { name: 'Pause simulation', exact: true })).toBeVisible();
  const timeline = page.getByRole('slider', { name: 'Lesson progress' });
  await timeline.focus(); await timeline.press('End');
  await expect(page.locator('.lesson-outcome')).toContainText('Searchable as invoice');
  await expect(page.locator('[data-id="publish"] .node-document')).toHaveCount(1);
  await timeline.press('Home');
  await expect(page.locator('.lesson-outcome')).not.toContainText('Searchable');
  await expect(page.locator('[data-id="judge"] .node-document')).toHaveCount(1);
  for (const task of ['find', 'compare']) {
    await page.goto(`/#explore/discover?example=${task}`);
    await expect(page.getByRole('button', { name: 'Run simulation', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'View results', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Run simulation', exact: true }).click();
    await timeline.focus(); await timeline.press('End');
    await page.getByRole('button', { name: 'View results', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(task === 'find' ? 'Relevant passages' : 'An answer, with its evidence');
    await page.keyboard.press('Escape');
  }
  await page.goto('/#explore/review');
  await expect(page.getByRole('button', { name: 'Prepared comparison', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Run simulation', exact: true })).toContainText('Run simulation');
  await page.getByRole('button', { name: 'Run simulation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause simulation', exact: true })).toBeVisible();
  expect(modelWrites).toEqual([]);
});

test('help pauses a simulation, explains measurements and restores keyboard focus; skip link preserves the route', async ({ page }) => {
  await page.goto('/#explore/classify?example=proposed');
  await page.getByRole('button', { name: 'Run simulation', exact: true }).click();
  const help = page.getByRole('button', { name: 'How to use', exact: true });
  await help.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('no model calls');
  await dialog.getByText('How to read latency & quality', { exact: true }).click();
  await expect(dialog).toContainText('1 / 1');
  await expect(dialog).toContainText('Parallel work can overlap');
  await expect(dialog).toContainText('separate from correctness');
  await page.keyboard.press('Escape');
  await expect(help).toBeFocused();
  await expect(page.getByRole('button', { name: /^(Continue|Run) simulation$/, exact: true })).toBeVisible();
  const value = await page.getByRole('slider', { name: 'Lesson progress' }).inputValue();
  await page.waitForTimeout(800);
  await expect(page.getByRole('slider', { name: 'Lesson progress' })).toHaveValue(value);
  const hash = new URL(page.url()).hash;
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
  await skip.focus(); await skip.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  expect(new URL(page.url()).hash).toBe(hash);
});

for (const width of [320, 390, 1440]) test(`every destination has usable navigation and help without horizontal overflow at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of ['explore/classify', 'explore/discover?example=compare', 'explore/review', 'compare/classify?source=illustrative', 'experiment/classify?example=proposed', 'experiment/safeguards?example=invalid-citation', 'documents', 'runs', 'discover']) {
    await page.goto(`/#${route}`);
    await expect(page.locator('main h1').first()).toBeVisible();
    if (route.startsWith('explore/') || route.startsWith('compare/')) await expect(page.locator('main .primary').first()).toBeInViewport({ ratio: 1 });
    for (const theme of ['Dark', 'Light']) {
      await page.getByTitle(`${theme} mode`, { exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} in ${theme}`).toBe(true);
    }
    const help = page.getByRole('button', { name: 'How to use', exact: true });
    await help.click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'How to use this app', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toBeFocused();
    if (route.startsWith('explore') || route.startsWith('compare/')) await page.screenshot({ path: testInfo.outputPath(`${route.replaceAll(/[^a-z]/g, '-')}-${width}.png`), fullPage: true });
  }
});
