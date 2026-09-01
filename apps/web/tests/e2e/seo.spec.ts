import { expect, test } from '@playwright/test';

test('home has product metadata and structured data', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Free QR Code Generator & Designer/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
});

test('dynamic page does not claim Phase 3 is shipped', async ({ page }) => {
  await page.goto('/dynamic-qr-code');
  await expect(page.getByText('Roadmap status')).toBeVisible();
  await expect(page.getByText(/not presented as shipped in Phase 1/)).toBeVisible();
});
