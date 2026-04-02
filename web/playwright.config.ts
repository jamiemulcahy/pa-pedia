import { defineConfig } from '@playwright/test'

// Use a separate port to avoid conflicts with a running dev server
const E2E_PORT = 5174

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    headless: true,
    actionTimeout: 10_000,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: `npx vite --port ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      // Use test fixture factions instead of real faction data
      VITE_FACTIONS_DIR: './e2e/fixtures/factions',
    },
  },
})
