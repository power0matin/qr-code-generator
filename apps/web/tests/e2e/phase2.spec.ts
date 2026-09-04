import { expect, test } from '@playwright/test';

function csvRows(count: number): string {
  return ['name,url', ...Array.from({ length: count }, (_, index) => `item-${index + 1},https://example.com/${index + 1}`)].join('\n');
}

test('Phase 2 batch prepares the 500-row browser limit without navigating away', async ({ page }) => {
  await page.goto('/batch-qr-code-generator');
  await page.getByLabel('Dataset').fill(csvRows(500));
  await page.getByRole('button', { name: 'Prepare & preview' }).click();
  await expect(page.getByRole('status')).toContainText('500 rows prepared', { timeout: 15_000 });
  await expect(page.getByText('500 prepared rows')).toBeVisible();
  await expect(page.getByText('…and 490 more rows.')).toBeVisible();
});

test('Phase 2 batch rejects row 501 before QR rendering', async ({ page }) => {
  await page.goto('/batch-qr-code-generator');
  await page.getByLabel('Dataset').fill(csvRows(501));
  await page.getByRole('button', { name: 'Prepare & preview' }).click();
  await expect(page.getByRole('status')).toContainText('Batch is limited to 500 rows per run.', { timeout: 15_000 });
});

test('camera policy allows same-origin scanner and denied permission keeps upload fallback available', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); },
      },
    });
  });
  const response = await page.goto('/scanner');
  expect(response?.headers()['permissions-policy']).toContain('camera=(self)');
  await page.getByRole('button', { name: 'Scan with camera' }).click();
  await expect(page.getByRole('alert', { name: 'Scan error' })).toContainText('Camera permission was denied.');
  await expect(page.getByRole('button', { name: 'Choose image' })).toBeEnabled();
});

test('professional preset search exposes at least 50 presets and favorites locally', async ({ page }) => {
  await page.goto('/generator');
  await page.getByRole('tab', { name: 'presets' }).click();
  const presets = page.locator('.preset-card');
  expect(await presets.count()).toBeGreaterThanOrEqual(50);
  await page.getByLabel('Find preset').fill('print');
  expect(await presets.count()).toBeGreaterThan(0);
  const first = page.locator('.preset-card-wrap').first();
  const favorite = first.getByRole('button', { name: /Add .* to favorites/ });
  await favorite.click();
  await expect(first.getByRole('button', { name: /Remove .* from favorites/ })).toBeVisible();
});

test('per-region styling remains usable at mobile width without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/generator');
  await page.getByRole('tab', { name: 'style' }).click();
  await page.locator('#region-timing-shape').selectOption('square');
  await expect(page.getByLabel('Decode status')).toHaveText('✓ Decodes', { timeout: 15_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});

test('project tags and revision history persist locally', async ({ page }) => {
  const name = `phase2-history-${Date.now()}`;
  await page.goto('/generator');
  await page.getByLabel('Project name').fill(name);
  await page.getByLabel('Project tags').fill('campaign, print');
  await page.getByRole('button', { name: 'Save locally' }).click();
  await expect(page.getByRole('status')).toContainText('Saved locally · revision 1.');

  await page.getByLabel('Project tags').fill('campaign, print, approved');
  await page.getByRole('button', { name: 'Save locally' }).click();
  await expect(page.getByRole('status')).toContainText('Saved locally · revision 2.');
  await expect(page.getByRole('heading', { name: /Design history/ })).toBeVisible();
  await expect(page.getByText('Revision 2 · current')).toBeVisible();
  await expect(page.getByText('Revision 1', { exact: true })).toBeVisible();

  await page.goto('/projects');
  const card = page.locator('.project-card').filter({ hasText: name });
  await expect(card).toContainText('revision 2');
  await expect(card.getByText('approved', { exact: true })).toBeVisible();
});

test('stress simulation UI and deterministic Auto Fix remain connected to the editor', async ({ page }) => {
  await page.goto('/generator');
  await page.getByRole('tab', { name: 'style' }).click();
  await page.getByRole('button', { name: 'Fluid', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Auto Fix' })).toBeEnabled();
  await page.getByRole('button', { name: 'Run stress tests' }).click();
  await expect(page.getByLabel('Stress test results').locator('.simulation-chip')).toHaveCount(5, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Auto Fix' }).click();
  await expect(page.getByRole('button', { name: 'Rounded', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Decode status')).toHaveText('✓ Decodes', { timeout: 15_000 });
});

test('editor remains structurally usable under RTL direction at a touch viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/generator');
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  await page.getByRole('tab', { name: 'presets' }).click();
  await expect(page.getByLabel('Find preset')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
