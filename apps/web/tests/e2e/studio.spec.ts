import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920] as const;

test('studio renders and baseline QR decodes', async ({ page }) => {
  await page.goto('/generator');
  await expect(page.getByRole('heading', { name: 'QR Studio' })).toBeVisible();
  await expect(page.getByText('✓ Decodes')).toBeVisible({ timeout: 15_000 });
});

for (const width of widths) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/generator');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });
}

test('Phase 1 payload types produce decodable previews', async ({ page }) => {
  await page.goto('/generator');
  const types = ['URL', 'Text', 'Email', 'Phone', 'SMS', 'WhatsApp', 'WiFi', 'vCard', 'Location', 'Event'];
  for (const label of types) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByText('✓ Decodes')).toBeVisible({ timeout: 15_000 });
  }
});

test('renderer output round-trips through image scanner', async ({ page }, testInfo) => {
  const file = path.join(testInfo.outputDir, 'rendered-qr.png');
  await page.goto('/generator');
  await expect(page.getByText('✓ Decodes')).toBeVisible({ timeout: 15_000 });
  await page.locator('.qr-paper').screenshot({ path: file });
  await page.goto('/scanner');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByRole('heading', { name: 'Decoded content' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('https://example.com', { exact: true })).toBeVisible();
});

test('scan redesign does not put payload in the URL', async ({ page }, testInfo) => {
  const file = path.join(testInfo.outputDir, 'privacy-roundtrip.png');
  await page.goto('/generator');
  await expect(page.getByText('✓ Decodes')).toBeVisible({ timeout: 15_000 });
  await page.locator('.qr-paper').screenshot({ path: file });
  await page.goto('/scanner');
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByRole('button', { name: 'Redesign' }).click();
  await expect(page).toHaveURL(/\/generator$/);
  expect(page.url()).not.toContain(encodeURIComponent('https://example.com'));
});



test('all shipped presets remain decodable for the baseline payload', async ({ page }) => {
  await page.goto('/generator');
  await page.getByRole('tab', { name: 'presets' }).click();
  const presets = page.locator('.preset-card');
  const count = await presets.count();
  expect(count).toBeGreaterThanOrEqual(20);
  for (let index = 0; index < count; index += 1) {
    await presets.nth(index).click();
    await expect(page.getByText('✓ Decodes')).toBeVisible({ timeout: 15_000 });
  }
});

test('logo and gradient stay decodable', async ({ page }) => {
  await page.goto('/generator');
  await page.getByRole('tab', { name: 'logo' }).click();
  await page.locator('input[type=file][accept*="image/png"]').setInputFiles(path.resolve('tests/fixtures/logo.png'));
  await expect(page.getByText('✓ Decodes')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('tab', { name: 'style' }).click();
  await page.getByLabel('Use gradient').check();
  await expect(page.getByText('✓ Decodes')).toBeVisible({ timeout: 15_000 });
});

test('@a11y critical accessibility smoke test', async ({ page }) => {
  await page.goto('/generator');
  await expect(page.getByText('✓ Decodes')).toBeVisible({ timeout: 15_000 });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const critical = results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
  expect(critical).toEqual([]);
});

test('PNG and SVG exports start only after preflight verification', async ({ page }) => {
  await page.goto('/generator');
  await expect(page.getByText('✓ Decodes')).toBeVisible({ timeout: 15_000 });
  for (const format of ['png', 'svg', 'jpeg', 'webp', 'pdf']) {
    await page.locator('#format').selectOption(format);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Verify & download' }).click();
    const download = await downloadPromise;
    const extension = format === 'jpeg' ? 'jpg' : format;
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));
  }
});


test('transparent PNG export completes after white-composite verification', async ({ page }) => {
  await page.goto('/generator');
  await expect(page.getByText('✓ Decodes')).toBeVisible({ timeout: 15_000 });
  await page.locator('#format').selectOption('png');
  await page.getByLabel('Transparent background').check();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Verify & download' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});
