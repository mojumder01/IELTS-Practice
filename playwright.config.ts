import { defineConfig, devices } from '@playwright/test';

const port = 4173;

// Containers with a preinstalled Chromium (whose build differs from this
// Playwright version) point here instead of running `playwright install`.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const launchOptions = executablePath ? { executablePath } : {};

// e2e runs its own production build against a placeholder Firebase project,
// so results never depend on real credentials or a developer's .env.local.
// Values set here beat .env files when Vite builds.
const e2eEnv = {
  VITE_FIREBASE_API_KEY: 'e2e-placeholder-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-ielts-practice.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-ielts-practice',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_OWNER_UID: 'e2eOwnerUid000000000000000000',
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], launchOptions },
    },
    {
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        launchOptions,
      },
    },
  ],
  webServer: {
    command: `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    env: e2eEnv,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
