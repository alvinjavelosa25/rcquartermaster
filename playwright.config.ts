import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PORT ?? 3000)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`
const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grepInvert: /@desktop-only/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // In CI the app is built first (see .github/workflows/ci.yml); locally the dev server is reused.
        command: isCI ? 'npm run start' : 'npm run dev',
        url: `${baseURL}/api/health`,
        reuseExistingServer: !isCI,
        timeout: 180_000,
        env: {
          SITE_ENV: 'development',
          STORAGE_DRIVER: 'local',
          NEXT_PUBLIC_SITE_URL: baseURL,
          CRON_SECRET: process.env.E2E_CRON_SECRET ?? 'e2e-cron-secret-0123456789',
          // Small limits so the rate-limit test is quick; every test uses its own client IP (see fixtures.ts).
          RFQ_RATE_LIMIT_PER_HOUR: '5',
          RFQ_RATE_LIMIT_PER_DAY: '50',
          RFQ_RATE_LIMIT_PER_EMAIL_PER_DAY: '500',
          UPLOAD_RATE_LIMIT_PER_HOUR: '200',
        },
      },
})
