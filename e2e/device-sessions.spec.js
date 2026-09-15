import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { register } from '../tool/fixture-accounts.js';
import { base } from '../tool/local-server.js';

test('account device removal requires confirmation and server password auth, preserving current device and history', async ({ browser }, info) => {
  const suffix = randomBytes(5).toString('hex'); const password = randomBytes(24).toString('hex');
  const user = await register('devices_' + suffix, password);
  const first = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const second = await browser.newContext();
  const owner = await first.newPage(); const other = await second.newPage(); let removals = 0;
  owner.on('request', request => { if (request.method() === 'DELETE' && request.url().includes('/devices/')) removals++; });
  async function login(page) {
    await page.goto('http://127.0.0.1:14173'); await page.getByLabel('服务器地址').fill(base); await page.getByLabel('用户 ID').fill(user); await page.getByLabel('密码', { exact: true }).fill(password);
    const response = page.waitForResponse(r => r.url().endsWith('/_matrix/client/v3/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '连接', exact: true }).click(); const auth = await (await response).json();
    await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeEnabled(); return auth;
  }
  try {
    const a = await login(owner); const b = await login(other);
    expect(a.device_id).not.toBe(b.device_id);
    const headers = { Authorization: `Bearer ${a.access_token}` }; const otherHeaders = { Authorization: `Bearer ${b.access_token}` };
    const room = '保留消息 ' + suffix;
    await owner.getByRole('button', { name: '新建会话', exact: true }).click(); await owner.getByLabel('会话名称', { exact: true }).fill(room); await owner.getByRole('button', { name: '创建加密会话', exact: true }).click();
    await expect(owner.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
    await owner.getByRole('textbox', { name: '消息', exact: true }).fill('设备管理不能删除消息 ' + suffix);
    const sent = owner.waitForResponse(r => r.url().includes('/send/m.room.encrypted/') && r.status() === 200);
    await owner.getByRole('button', { name: '发送', exact: true }).click(); await sent;
    const rooms = await (await fetch(base + '/_matrix/client/v3/joined_rooms', { headers })).json();
    const historyUrl = base + '/_matrix/client/v3/rooms/' + encodeURIComponent(rooms.joined_rooms[0]) + '/messages?dir=b&limit=50';
    const messageIds = async () => (await (await fetch(historyUrl, { headers })).json()).chunk.filter(e => e.type === 'm.room.encrypted').map(e => e.event_id).sort();
    const before = await messageIds(); expect(before).toHaveLength(1);
    await owner.getByRole('button', { name: '设备会话', exact: true }).click();
    const row = id => owner.locator('.device-row').filter({ hasText: id });
    await expect(row(a.device_id).getByRole('button', { name: '当前设备', exact: true })).toBeDisabled();
    await row(b.device_id).getByRole('button', { name: '移除设备', exact: true }).click();
    await expect(owner.locator('#device-target')).toContainText(b.device_id);
    await owner.getByRole('button', { name: '取消移除', exact: true }).click(); expect(removals).toBe(0);
    await row(b.device_id).getByRole('button', { name: '移除设备', exact: true }).click(); await owner.getByRole('button', { name: '确认移除设备', exact: true }).click();
    await expect(owner.locator('#device-auth')).toBeVisible();
    await owner.getByLabel('帐号密码', { exact: true }).fill('incorrect-fixture-password'); await owner.getByRole('button', { name: '认证并移除', exact: true }).click();
    await expect(owner.locator('#devices-status')).toContainText('认证未通过'); await expect(owner.locator('#device-password')).toHaveValue('');
    expect((await fetch(base + '/_matrix/client/v3/account/whoami', { headers: otherHeaders })).status).toBe(200);
    await owner.getByLabel('帐号密码', { exact: true }).fill(password); await owner.getByRole('button', { name: '认证并移除', exact: true }).click();
    await expect(owner.locator('#devices-status')).toContainText('已移除指定设备'); await expect(row(b.device_id)).toHaveCount(0); await expect(row(a.device_id)).toBeVisible();
    expect((await fetch(base + '/_matrix/client/v3/account/whoami', { headers: otherHeaders })).status).toBe(401);
    expect((await fetch(base + '/_matrix/client/v3/account/whoami', { headers })).status).toBe(200); expect(await messageIds()).toEqual(before);
    await expect(owner.locator('#device-password')).toHaveValue('');
    expect(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await owner.screenshot({ path: info.outputPath('device-revocation-mobile.png'), fullPage: true });
    await owner.getByRole('button', { name: '关闭', exact: true }).click(); await expect(owner.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
  } finally { await first.close(); await second.close(); }
});
