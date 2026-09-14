import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 180000, expect: { timeout: 60000 }, workers: 1, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:14173', browserName: 'chromium', viewport: { width: 1280, height: 900 } },
  webServer: [
    { command: 'npx vite preview --host 127.0.0.1 --port 14173 --strictPort', url: 'http://127.0.0.1:14173', reuseExistingServer: false },
    { command: 'npx vite preview --config vite.embed.config.js --host 127.0.0.1 --port 14174 --strictPort', url: 'http://127.0.0.1:14174', reuseExistingServer: false },
  ],
});
