import { test, expect } from '@playwright/test';

test('embed setup rejects a remote plaintext origin before sending credentials and permits retry', async ({ page }) => {
  let remoteRequests = 0;
  await page.route('http://matrix.example.org/**', route => { remoteRequests++; return route.abort(); });
  await page.goto('http://127.0.0.1:14174');
  await page.locator('#server').fill('http://matrix.example.org');
  await page.locator('#user').fill('@test:example.org');
  await page.locator('#password').fill('not-a-real-password');
  await page.locator('#connect').click();
  await expect(page.locator('#status')).toContainText('服务器地址无效');
  await expect(page.locator('#connect')).toBeEnabled();
  await expect(page.locator('#password')).toHaveValue('');
  expect(remoteRequests).toBe(0);
  await page.route('https://matrix.example.org/**', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ errcode: 'M_FORBIDDEN', error: 'private-server-detail' }) }));
  await page.locator('#server').fill('https://matrix.example.org');
  await page.locator('#password').fill('not-a-real-password');
  await page.locator('#connect').click();
  await expect(page.locator('#status')).toContainText('登录被拒绝');
  await expect(page.locator('#status')).not.toContainText('private-server-detail');
  await expect(page.locator('#password')).toHaveValue('');
});

test('embed setup explains missing Web Locks without attempting login', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await page.goto('http://127.0.0.1:14174');
  await page.locator('#server').fill('https://matrix.example.org');
  await page.locator('#user').fill('@test:example.org');
  await page.locator('#password').fill('not-a-real-password');
  await page.locator('#connect').click();
  await expect(page.locator('#status')).toContainText('Web Locks');
  await expect(page.locator('#connect')).toBeEnabled();
  await expect(page.locator('#password')).toHaveValue('');
});
