import { expect, test } from '@playwright/test';

test('manifest is available', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json() as { name?: string; start_url?: string };
  expect(manifest.name).toContain('ModuQR');
  expect(manifest.start_url).toBe('/generator');
});

test('service worker serves an offline studio after caching', async ({ page, context }, testInfo) => {
  test.skip(!['chrome', 'chromium'].includes(testInfo.project.name), 'Offline service-worker smoke test runs once on desktop Chromium.');
  await page.goto('/generator');
  await page.waitForFunction(() => document.documentElement.dataset['moduqrSwCleanup'] === 'done' || document.documentElement.dataset['moduqrSwReady'] === 'done');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are not supported by this browser.');
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.reload({ waitUntil: 'networkidle' });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'QR Studio' })).toBeVisible();
  await context.setOffline(false);
});
