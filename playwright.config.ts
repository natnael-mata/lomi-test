/**
 * The UI E2E layer: real journeys through a real browser (TEST.md, layer 4).
 *
 * Runs against the dev servers, started here if they are not already up, and
 * reseeds the tester accounts before every run (`e2e/global-setup.ts`) so each
 * journey starts from the state the persona table promises.
 *
 * **The system Chrome, not a downloaded one.** `channel: 'chrome'` drives the
 * browser the layout and focus sweeps already use, so nothing extra has to be
 * fetched on a fresh machine or in CI with Chrome installed.
 *
 * One worker: the journeys share one database and one sign in limiter, and a
 * persona answered by two tests at once is a flaky test, not a fast one.
 *
 * Run with `npm run test:e2e`. Needs Postgres (`npm run db:dev`).
 */
import { defineConfig } from '@playwright/test';

const WEB = process.env.E2E_WEB ?? 'http://localhost:3100';
const API = process.env.E2E_API ?? 'http://localhost:4000';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: 'e2e/.report', open: 'never' }]],
  use: {
    baseURL: WEB,
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    // The phone most students use: 390 wide, touch, the bottom tab bar.
    {
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:api',
      url: `${API}/health`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    { command: 'npm run dev:web', url: WEB, reuseExistingServer: true, timeout: 180_000 },
  ],
});
