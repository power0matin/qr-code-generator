import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920] as const;

async function expectDecodable(page: Page): Promise<void> {
  const status = page.getByLabel('Decode status');
  await expect(status).toHaveText('✓ Decodes', { timeout: 15_000 });
}

test('studio renders and baseline QR decodes', async ({ page }) => {
  await page.goto('/generator');
  await expect(page.getByRole('heading', { name: 'QR Studio' })).toBeVisible();
  await expectDecodable(page);
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
    await expectDecodable(page);
  }
});

test('renderer output round-trips through image scanner', async ({ page }, testInfo) => {
  const file = path.join(testInfo.outputDir, 'rendered-qr.png');
  await page.goto('/generator');
  await expectDecodable(page);
  await page.locator('.qr-paper').screenshot({ path: file });
  await page.goto('/scanner');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByRole('heading', { name: 'Decoded content' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('https://example.com', { exact: true })).toBeVisible();
});

test('scan redesign does not put payload in the URL', async ({ page }, testInfo) => {
  const file = path.join(testInfo.outputDir, 'privacy-roundtrip.png');
  await page.goto('/generator');
  await expectDecodable(page);
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
    await expectDecodable(page);
  }
});

test('logo and gradient stay decodable', async ({ page }) => {
  await page.goto('/generator');
  await page.getByRole('tab', { name: 'logo' }).click();
  await page.locator('input[type=file][accept*="image/png"]').setInputFiles(path.resolve('tests/fixtures/logo.png'));
  await expectDecodable(page);
  await page.getByRole('tab', { name: 'style' }).click();
  await page.getByLabel('Module gradient').check();
  await expectDecodable(page);
});

test('@a11y critical accessibility smoke test', async ({ page }) => {
  await page.goto('/generator');
  await expectDecodable(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const critical = results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
  expect(critical).toEqual([]);
});

test('PNG and SVG exports start only after preflight verification', async ({ page }) => {
  await page.goto('/generator');
  await expectDecodable(page);
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
  await expectDecodable(page);
  await page.locator('#format').selectOption('png');
  await page.getByLabel('Transparent background').check();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Verify & download' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});

test('Phase 2 neighbour-aware module styles remain decodable', async ({ page }) => {
  await page.goto('/generator');
  for (const label of ['Connected', 'Fluid']) {
    await page.getByRole('tab', { name: 'style' }).click();
    await page.getByRole('button', { name: label, exact: true }).click();
    await expectDecodable(page);
  }
});

test('Phase 2 independent finder overrides remain decodable', async ({ page }) => {
  await page.goto('/generator');
  await page.getByRole('tab', { name: 'eyes' }).click();
  await page.getByRole('button', { name: 'Top right', exact: true }).click();
  await page.locator('#finder-outer-override').selectOption('rounded');
  await page.locator('#finder-inner-override').selectOption('circle');
  await page.getByLabel('Custom outer color').check();
  await page.getByLabel('Outer color hex value').fill('#1e3a8a');
  await page.getByLabel('Custom inner color').check();
  await page.getByLabel('Inner color hex value').fill('#4338ca');
  await expectDecodable(page);
});

test('Phase 2 multi-stop module and background gradients remain decodable', async ({ page }) => {
  await page.goto('/generator');
  await page.getByRole('tab', { name: 'style' }).click();
  await page.getByLabel('Module gradient').check();
  await page.getByRole('button', { name: 'Add color stop' }).first().click();
  await expectDecodable(page);
  await page.getByLabel('Background gradient').check();
  await expectDecodable(page);
});
