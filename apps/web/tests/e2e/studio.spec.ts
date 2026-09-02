import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920] as const;

async function expectDecodable(page: Page): Promise<void> {
  const status = page.getByLabel('Decode status');
  await expect(status).toHaveText('✓ Decodes', { timeout: 15_000 });
}

async function qrMarkup(page: Page): Promise<string> {
  return page.locator('.qr-paper svg').evaluate((element) => element.outerHTML);
}

async function expectQrToChange(page: Page, previousMarkup: string): Promise<void> {
  await expect.poll(async () => (await qrMarkup(page)) !== previousMarkup, { timeout: 10_000 }).toBe(true);
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

test('smart input canonicalizes a detected email into an email QR payload', async ({ page }, testInfo) => {
  const file = path.join(testInfo.outputDir, 'smart-email.png');
  await page.goto('/generator');

  const initialQr = await qrMarkup(page);

  await page.getByLabel('Smart input').fill('hello@example.com');
  await page.getByRole('button', { name: 'Detect & use' }).click();
  await expect(page.getByText('Email address detected.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('hello@example.com');
  await expectQrToChange(page, initialQr);
  await expectDecodable(page);

  await page.locator('.qr-paper').screenshot({ path: file });
  await page.goto('/scanner');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText('mailto:hello@example.com', { exact: true })).toBeVisible({ timeout: 15_000 });
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



test('scanner rejects oversized raster dimensions before browser image decoding', async ({ page }) => {
  await page.goto('/scanner');
  const oversizedPng = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(oversizedPng, 0);
  Buffer.from('IHDR').copy(oversizedPng, 12);
  oversizedPng.writeUInt32BE(12000, 16);
  oversizedPng.writeUInt32BE(12000, 20);
  await page.locator('input[type=file]').setInputFiles({ name: 'oversized-scan.png', mimeType: 'image/png', buffer: oversizedPng });
  await expect(page.getByRole('alert', { name: 'Scan error' })).toContainText('Image dimensions are too large to scan safely.');
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

test('design tabs support arrow-key keyboard navigation', async ({ page }) => {
  await page.goto('/generator');
  const styleTab = page.getByRole('tab', { name: 'style' });
  await styleTab.focus();
  await styleTab.press('ArrowRight');
  const eyesTab = page.getByRole('tab', { name: 'eyes' });
  await expect(eyesTab).toBeFocused();
  await expect(eyesTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'eyes' })).toBeVisible();
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

test('payloads beyond QR capacity fail safely without crashing the studio', async ({ page }) => {
  await page.goto('/generator');
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.locator('form textarea').fill('x'.repeat(6_000));
  await expect(page.getByRole('alert', { name: 'QR render error' })).toContainText('QR cannot be rendered', { timeout: 15_000 });
  await expect(page.getByLabel('Decode status')).toHaveText('Encode failed');
  await expect(page.getByRole('button', { name: 'Verify & download' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'QR Studio' })).toBeVisible();
});

test('saved WiFi project cards do not expose credentials', async ({ page }) => {
  const secret = 'top-secret-qr-password';
  const projectName = `wifi-privacy-${Date.now()}`;
  await page.goto('/generator');

  const initialQr = await qrMarkup(page);

  const wifiButton = page.getByRole('button', { name: 'WiFi', exact: true });
  await wifiButton.click();
  await expect(wifiButton).toHaveAttribute('aria-pressed', 'true');
  await expectQrToChange(page, initialQr);

  const ssidInput = page.getByLabel('Network name (SSID)');
  const beforeSsid = await qrMarkup(page);
  await ssidInput.fill('Private Network');
  await expect(ssidInput).toHaveValue('Private Network');
  await expectQrToChange(page, beforeSsid);

  const securitySelect = page.getByRole('combobox', { name: 'WiFi security', exact: true });
  await expect(securitySelect).toHaveValue('nopass');
  await securitySelect.selectOption('WPA');
  await expect(securitySelect).toHaveValue('WPA');

  // WPA without a password is intentionally invalid, so the last valid QR may stay
  // unchanged until the password is provided. Assert the next valid state instead.
  const beforePassword = await qrMarkup(page);
  const passwordInput = page.getByLabel('WiFi password', { exact: true });
  await passwordInput.fill(secret);
  await expect(passwordInput).toHaveValue(secret);
  await expectQrToChange(page, beforePassword);
  await expectDecodable(page);

  await page.getByLabel('Project name').fill(projectName);
  await page.getByRole('button', { name: 'Save locally' }).click();
  await expect(page.getByText('Saved locally on this device.')).toBeVisible();

  await page.goto('/projects');
  const card = page.locator('.project-card').filter({ hasText: projectName });
  await expect(card).toBeVisible();
  await expect(card).toContainText('WiFi credentials hidden in the project list.');
  await expect(card).not.toContainText(secret);
  await expect(page.locator('body')).not.toContainText(secret);

  await card.getByRole('button', { name: 'Load' }).click();
  await expect(page).toHaveURL(/\/generator$/);
  await expect(page.getByText('Local project loaded.')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'WiFi', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Network name (SSID)')).toHaveValue('Private Network');
  await expect(page.getByRole('combobox', { name: 'WiFi security', exact: true })).toHaveValue('WPA');
  await expect(page.getByLabel('WiFi password', { exact: true })).toHaveValue(secret);
  await expectDecodable(page);
});

test('saving a loaded favorite project preserves its favorite state', async ({ page }) => {
  const projectName = `favorite-regression-${Date.now()}`;
  await page.goto('/generator');
  await page.getByLabel('Project name').fill(projectName);
  await page.getByRole('button', { name: 'Save locally' }).click();
  await expect(page.getByText('Saved locally on this device.')).toBeVisible();

  await page.goto('/projects');
  const firstCard = page.locator('.project-card').filter({ hasText: projectName });
  await expect(firstCard).toBeVisible();
  await firstCard.getByRole('button', { name: 'Add favorite' }).click();
  await expect(firstCard.getByRole('button', { name: 'Remove favorite' })).toBeVisible();
  await firstCard.getByRole('button', { name: 'Load' }).click();

  await expect(page).toHaveURL(/\/generator$/);
  await expect(page.getByText('Local project loaded.')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel('Project name')).toHaveValue(projectName);
  await page.getByRole('button', { name: 'Save locally' }).click();
  await expect(page.getByText('Saved locally on this device.')).toBeVisible();

  await page.goto('/projects');
  const savedCard = page.locator('.project-card').filter({ hasText: projectName });
  await expect(savedCard.getByRole('button', { name: 'Remove favorite' })).toBeVisible();
});

test('logo ingestion rejects MIME spoofing and strips unsafe SVG content', async ({ page }) => {
  await page.goto('/generator');
  await page.getByRole('tab', { name: 'logo' }).click();
  const input = page.locator('#logo');

  await input.setInputFiles({ name: 'spoofed.png', mimeType: 'image/png', buffer: Buffer.from('not-a-png') });
  await expect(page.getByText('The logo file contents do not match its declared image type.')).toBeVisible();

  const oversizedPng = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(oversizedPng, 0);
  Buffer.from('IHDR').copy(oversizedPng, 12);
  oversizedPng.writeUInt32BE(5000, 16);
  oversizedPng.writeUInt32BE(5000, 20);
  await input.setInputFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: oversizedPng });
  await expect(page.getByText('Logo dimensions are too large. Use an image up to 4096×4096 and 16 megapixels.')).toBeVisible();

  const blankSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="g"><stop offset="0" stop-color="#111827"/></linearGradient></defs></svg>';
  await input.setInputFiles({ name: 'blank.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(blankSvg) });
  await expect(page.getByText('SVG did not contain renderable geometry after sanitization.')).toBeVisible();

  const unsafeSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><script>alert(1)</script><rect width="40" height="40" fill="url(https://attacker.example/paint)"/><circle cx="20" cy="20" r="12" fill="#111827"/></svg>';
  await input.setInputFiles({ name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(unsafeSvg) });
  await expectDecodable(page);
  const href = await page.locator('.qr-paper image').getAttribute('href');
  expect(href).not.toBeNull();
  const decodedHref = decodeURIComponent(href ?? '');
  expect(decodedHref).not.toContain('<script');
  expect(decodedHref).not.toContain('attacker.example');
});
