import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'postgres.spec.js', timeout: 240000, expect: { timeout: 60000 }, workers: 1, retries: 0,
  reporter: [['list']], use: { browserName: 'chromium' },
  webServer: { command: 'npx vite preview --host 127.0.0.1 --port 14173 --strictPort', url: 'http://127.0.0.1:14173', reuseExistingServer: false },
});
