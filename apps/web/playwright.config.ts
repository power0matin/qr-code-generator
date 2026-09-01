import { defineConfig, devices, type Project } from '@playwright/test';

const isCI = Boolean(process.env['CI']);

const localProjects: Project[] = [
  {
    name: 'chrome',
    use: {
      ...devices['Desktop Chrome'],
      channel: 'chrome',
    },
  },
  {
    name: 'mobile-chrome',
    use: {
      ...devices['Pixel 7'],
      channel: 'chrome',
    },
  },
];

const ciProjects: Project[] = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  { name: 'mobile-webkit', use: { ...devices['iPhone 15'] } },
];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['html'], ['github']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: isCI ? 'corepack pnpm start' : 'corepack pnpm dev --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !isCI,
  },
  projects: isCI ? ciProjects : localProjects,
});
