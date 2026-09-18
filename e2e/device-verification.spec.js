import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { register } from '../tool/fixture-accounts.js';
import { base } from '../tool/local-server.js';

test('two real RustCrypto devices require explicit SAS matching and reject a mismatch', async ({ browser }, info) => {
  const suffix = randomBytes(5).toString('hex'), password = randomBytes(24).toString('hex');
  const user = await register('sas_' + suffix, password);
  const first = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const second = await browser.newContext(); const a = await first.newPage(), b = await second.newPage();
  async function login(page) {
    await page.goto('http://127.0.0.1:14173'); await page.getByLabel('服务器地址').fill(base); await page.getByLabel('用户 ID').fill(user); await page.getByLabel('密码', { exact: true }).fill(password);
    const response = page.waitForResponse(r => r.url().endsWith('/_matrix/client/v3/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '连接', exact: true }).click(); const auth = await (await response).json();
    await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeEnabled(); return auth;
  }
  try {
    const aa = await login(a), bb = await login(b); expect(aa.device_id).not.toBe(bb.device_id);
    await a.getByRole('button', { name: '核对设备', exact: true }).click(); await b.getByRole('button', { name: '核对设备', exact: true }).click();
    async function begin() {
      await a.getByLabel('另一设备 ID', { exact: true }).fill(bb.device_id); await a.getByRole('button', { name: '发起设备核对', exact: true }).click();
      await expect(b.locator('#verification-target')).toContainText(aa.device_id);
      await expect(b.getByRole('button', { name: '接受此设备请求', exact: true })).toBeVisible();
      await expect(a.locator('#verification-numbers')).toBeHidden(); await expect(b.locator('#verification-numbers')).toBeHidden();
      await b.getByRole('button', { name: '接受此设备请求', exact: true }).click();
      await expect(a.getByRole('button', { name: '开始数字核对', exact: true })).toBeVisible(); await a.getByRole('button', { name: '开始数字核对', exact: true }).click();
      await expect(a.locator('#verification-numbers')).toBeVisible(); await expect(b.locator('#verification-numbers')).toBeVisible();
      expect(await a.locator('#verification-numbers').textContent()).toBe(await b.locator('#verification-numbers').textContent());
    }
    await begin(); await b.getByRole('button', { name: '数字不同，拒绝', exact: true }).click();
    await expect(a.locator('#verification-state')).toContainText(/取消|未完成/); await expect(a.locator('#verification-numbers')).toBeHidden();
    await expect(a.locator('#verification-state')).not.toContainText('已通过');
    await begin();
    await a.getByRole('button', { name: '三个数字全部相同', exact: true }).click();
    await expect(a.locator('#verification-state')).not.toContainText('已通过');
    await b.getByRole('button', { name: '三个数字全部相同', exact: true }).click();
    await expect(a.locator('#verification-state')).toHaveText('此设备已通过本机 SAS 核对。');
    await expect(b.locator('#verification-state')).toHaveText('此设备已通过本机 SAS 核对。');
    // Verification must not silently create or replace a server key backup.
    const headers = { Authorization: 'Bearer ' + aa.access_token };
    expect((await fetch(base + '/_matrix/client/v3/room_keys/version', { headers })).status).toBe(404);
    expect((await fetch(base + '/_matrix/client/v3/account/whoami', { headers })).status).toBe(200);
    expect(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await a.screenshot({ path: info.outputPath('device-sas-mobile.png'), fullPage: true });
  } finally { await first.close(); await second.close(); }
});
