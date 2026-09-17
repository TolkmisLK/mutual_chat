import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { register } from '../tool/fixture-accounts.js';
import { base } from '../tool/local-server.js';

test('own encrypted message redaction confirms, retries and syncs without removing another message', async ({ browser }, info) => {
  const suffix = randomBytes(5).toString('hex'); const password = randomBytes(24).toString('hex');
  const aliceId = await register('redact_a_' + suffix, password); const bobId = await register('redact_b_' + suffix, password);
  const ac = await browser.newContext(); const bc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const alice = await ac.newPage(); const bob = await bc.newPage(); let calls = 0; let roomId;
  async function login(page, id) {
    await page.goto('http://127.0.0.1:14173'); await page.getByLabel('服务器地址').fill(base); await page.getByLabel('用户 ID').fill(id); await page.getByLabel('密码', { exact: true }).fill(password);
    const response = page.waitForResponse(r => r.url().endsWith('/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '连接', exact: true }).click(); const auth = await (await response).json(); await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeEnabled(); return auth;
  }
  async function send(page, peer, text) { await page.getByRole('textbox', { name: '消息', exact: true }).fill(text); await page.getByRole('button', { name: '发送', exact: true }).click(); await expect(peer.getByRole('log')).toContainText(text); }
  try {
    const auth = await login(alice, aliceId); await login(bob, bobId); const name = '撤回验收 ' + suffix;
    await alice.getByRole('button', { name: '新建会话', exact: true }).click(); await alice.getByLabel('会话名称', { exact: true }).fill(name); await alice.getByLabel('邀请用户 ID', { exact: true }).fill(bobId);
    const created = alice.waitForResponse(r => r.url().endsWith('/createRoom') && r.status() === 200); await alice.getByRole('button', { name: '创建加密会话', exact: true }).click(); roomId = (await (await created).json()).room_id;
    bob.on('dialog', d => d.accept()); await bob.getByRole('button', { name: '邀请 · ' + name, exact: true }).click();
    const removed = '撤回测试文本 ' + suffix; const retained = '保留另一条 ' + suffix;
    await send(alice, bob, removed); await send(bob, alice, retained);
    const bubble = alice.locator('.message').filter({ hasText: removed }); const eventId = await bubble.getAttribute('data-event-id');
    await expect(bob.locator('.message').filter({ hasText: removed }).getByRole('button', { name: '撤回', exact: true })).toHaveCount(0);
    await alice.route('**/redact/**', async route => { calls++; if (calls === 1) await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ errcode: 'M_FORBIDDEN', error: 'Controlled denial fixture' }) }); else await route.continue(); });
    alice.once('dialog', d => d.dismiss()); await bubble.getByRole('button', { name: '撤回', exact: true }).click(); expect(calls).toBe(0); await expect(bob.getByRole('log')).toContainText(removed);
    alice.once('dialog', d => d.accept()); await bubble.getByRole('button', { name: '撤回', exact: true }).click(); await expect(alice.locator('.status')).toContainText('未获确认'); await expect(bob.getByRole('log')).toContainText(removed);
    await expect(bubble.getByRole('button', { name: '撤回', exact: true })).toBeEnabled();
    alice.once('dialog', d => d.accept()); const accepted = alice.waitForResponse(r => r.url().includes('/redact/') && r.status() === 200); await bubble.getByRole('button', { name: '撤回', exact: true }).click(); await accepted;
    await expect(alice.getByRole('log')).not.toContainText(removed); await expect(bob.getByRole('log')).not.toContainText(removed);
    await expect(bob.getByRole('log')).toContainText('[消息已删除]'); await expect(bob.getByRole('log')).toContainText(retained); expect(calls).toBe(2);
    await bob.getByLabel('搜索已加载消息', { exact: true }).fill(removed); await expect(bob.locator('.search-state')).toContainText('没有匹配');
    const response = await fetch(base + '/_matrix/client/v3/rooms/' + encodeURIComponent(roomId) + '/event/' + encodeURIComponent(eventId), { headers: { Authorization: 'Bearer ' + auth.access_token } });
    expect(response.status).toBe(200); const event = await response.json(); expect(event.unsigned.redacted_because).toBeTruthy(); expect(event.content.ciphertext).toBeUndefined();
    await bob.screenshot({ path: info.outputPath('redacted-mobile.png'), fullPage: true });
  } finally { await ac.close(); await bc.close(); }
});
