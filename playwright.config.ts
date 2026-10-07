import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests against the GitHub Pages build (`yarn build:pages`), served under /point-editor/.
 * E2E_BASE_URL=https://jfredmc.github.io/point-editor/ runs them against the live site.
 */
const liveUrl = process.env['E2E_BASE_URL'];
const baseURL = liveUrl ?? 'http://localhost:4300/point-editor/';
const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, locale: 'es-CO', timezoneId: 'America/Bogota', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: liveUrl ? undefined : { command: 'node scripts/serve-pages.mjs', url: baseURL, reuseExistingServer: !isCI, timeout: 15_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
