import { expect, test } from '@playwright/test';

test('home has product metadata and structured data', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Free QR Code Generator & Designer/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\.png$/);
});

test('scanner landing page enters the real scanner', async ({ page }) => {
  await page.goto('/qr-code-scanner');
  await expect(page.getByRole('link', { name: 'Open QR Scanner' })).toHaveAttribute('href', '/scanner');
});

test('dynamic roadmap page is noindex and does not claim the feature is shipped', async ({ page }) => {
  await page.goto('/dynamic-qr-code');
  await expect(page.getByText('Roadmap status')).toBeVisible();
  await expect(page.getByText(/not presented as a shipped feature/)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
});

test('batch roadmap page is noindex', async ({ page }) => {
  await page.goto('/batch-qr-code-generator');
  await expect(page.getByText('Roadmap status')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
});


test('private workspace and roadmap-only routes stay out of the sitemap', async ({ page, request }) => {
  await page.goto('/projects');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  const body = await sitemap.text();
  expect(body).not.toContain('/projects');
  expect(body).not.toContain('/dynamic-qr-code');
  expect(body).not.toContain('/batch-qr-code-generator');
});
