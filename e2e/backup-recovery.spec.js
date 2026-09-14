import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { register } from '../tool/fixture-accounts.js';
import { base } from '../tool/local-server.js';
test('a new browser device recovers old encrypted history from an existing remote backup', async ({ browser, page }, info) => {
  const suffix = randomBytes(5).toString('hex'); const password = randomBytes(24).toString('hex');
  const user = await register('backup_' + suffix, password); const message = '原设备丢失前的加密消息 ' + suffix;
  const roomName = '备份恢复 ' + suffix; const seedContext = await browser.newContext(); let seed;
  try {
    const seedPage = await seedContext.newPage(); await seedPage.goto('http://127.0.0.1:14175/e2e/backup-fixture.html');
    await seedPage.waitForFunction(() => typeof window.seedBackup === 'function');
    seed = await seedPage.evaluate(args => window.seedBackup(args), { baseUrl: base, user, password, roomName, message });
  } finally { await seedContext.close(); }
  // The original SDK and browser context are gone. Recovery cannot rely on
  // device-to-device secret sharing or a pre-existing IndexedDB profile.
  const originalHeaders = { Authorization: 'Bearer ' + seed.token };
  const history = await (await fetch(base + '/_matrix/client/v3/rooms/' + encodeURIComponent(seed.roomId) + '/event/' + encodeURIComponent(seed.eventId), { headers: originalHeaders })).json();
  expect(history.type).toBe('m.room.encrypted'); expect(JSON.stringify(history.content)).not.toContain(message);
  await page.goto('/'); await page.getByLabel('服务器地址').fill(base); await page.getByLabel('用户 ID').fill(user);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('在此浏览器保留会话').check();
  await page.locator('#local-passphrase').fill('local-fixture-' + randomBytes(24).toString('hex'));
  const login = page.waitForResponse(r => r.url().endsWith('/_matrix/client/v3/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '连接', exact: true }).click();
  const auth = await (await login).json(); expect(auth.device_id).not.toBe(seed.deviceId);
  await page.getByRole('button', { name: roomName, exact: true }).click();
  await expect(page.getByRole('log')).toContainText('[等待解密或缺少密钥]');
  await expect(page.getByRole('log')).not.toContainText(message);
  await expect(page.getByRole('button', { name: '新建会话' })).toBeEnabled();
  await page.getByRole('button', { name: '恢复密钥', exact: true }).click();
  await expect(page.locator('#backup-state')).toContainText('备份版本 ' + seed.version);
  await page.locator('#backup-key').fill('invalid-fixture-recovery-key');
  await page.getByRole('button', { name: '恢复历史密钥', exact: true }).click();
  await expect(page.locator('#backup-result')).toContainText('格式不正确');
  try {
    await page.locator('#backup-key').fill(seed.recoveryKey);
    await page.getByRole('button', { name: '恢复历史密钥', exact: true }).click();
    await expect(page.locator('#backup-result')).toContainText('恢复完成');
    await expect(page.locator('#backup-key')).toHaveValue('');
  } finally {
    // No recovery secrets in failure snapshots or browser artifacts.
    await page.locator('#backup-key').evaluate(input => { input.value = ''; }).catch(() => {});
  }
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('log')).toContainText(message);
  const unchanged = await (await fetch(base + '/_matrix/client/v3/room_keys/version', { headers: originalHeaders })).json();
  expect(unchanged.version).toBe(seed.version);
  const continued = '恢复后新设备继续发送 ' + suffix;
  await page.getByRole('textbox', { name: '消息', exact: true }).fill(continued);
  const sent = page.waitForResponse(r => r.url().includes('/send/m.room.encrypted/') && r.status() === 200);
  await page.getByRole('button', { name: '发送', exact: true }).click(); await sent;
  await expect(page.getByRole('log')).toContainText(continued);
  await page.screenshot({ path: info.outputPath('recovered-backup.png'), fullPage: true });
});
