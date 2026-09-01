import { expect, test } from '@playwright/test';

test('manifest is available', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json() as { name?: string; start_url?: string };
  expect(manifest.name).toContain('ModuQR');
  expect(manifest.start_url).toBe('/generator');
});

test('service worker serves an offline studio after caching', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Offline service-worker smoke test is run once on Chromium.');
  await page.goto('/generator');
  await page.evaluate(async () => { if ('serviceWorker' in navigator) await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'QR Studio' })).toBeVisible();
  await context.setOffline(false);
});
