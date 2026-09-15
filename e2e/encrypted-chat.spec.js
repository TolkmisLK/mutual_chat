import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { register } from '../tool/fixture-accounts.js';
import { base, docker, waitForServer } from '../tool/local-server.js';
import { checkRestoredSnapshot } from '../tool/fixture-snapshot.js';

test('two users exchange encrypted messages and read history after server restart', async ({ browser }, info) => {
  const suffix = randomBytes(5).toString('hex'); const password = randomBytes(24).toString('hex');
  const aliceId = await register('alice_' + suffix, password); const bobId = await register('bob_' + suffix, password);
  const a = await browser.newContext(); const b = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const alice = await a.newPage(); const bob = await b.newPage(); const ciphertext = []; let aliceAuth;
  // Observe outbound wire events without recording tokens, passwords or a trace.
  alice.on('request', request => {
    if (/\/send\/m\.room\.encrypted\//.test(request.url())) ciphertext.push(request.postDataJSON());
  });
  async function login(page, id) {
    await page.goto('http://127.0.0.1:14173');
    await page.getByLabel('服务器地址').fill(base); await page.getByLabel('用户 ID').fill(id);
    await page.getByLabel('密码', { exact: true }).fill(password);
    const response = page.waitForResponse(r => r.url().endsWith('/_matrix/client/v3/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '连接', exact: true }).click();
    const auth = await (await response).json(); if (page === alice) aliceAuth = auth;
    await expect(page.locator('#chat')).toBeVisible();
  }
  try {
    await login(alice, aliceId); await login(bob, bobId);
    const roomName = '加密验收 ' + suffix;
    await expect(alice.getByRole('button', { name: '新建会话' })).toBeEnabled();
    await alice.getByRole('button', { name: '新建会话' }).click();
    await alice.getByLabel('会话名称', { exact: true }).fill(roomName); await alice.getByLabel('邀请用户 ID', { exact: true }).fill(bobId);
    await alice.getByRole('button', { name: '创建加密会话', exact: true }).click();
    const invitation = bob.getByRole('button', { name: '邀请 · ' + roomName, exact: true });
    await expect(invitation).toBeVisible(); bob.on('dialog', dialog => dialog.accept()); await invitation.click();
    await expect(bob.locator('header').filter({ hasText: roomName })).toContainText('端到端加密会话');
    const first = '你好，来自 Alice 的加密消息 ' + suffix;
    await expect(alice.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
    await alice.getByRole('textbox', { name: '消息', exact: true }).fill(first); await alice.getByRole('button', { name: '发送', exact: true }).click();
    await expect(bob.getByRole('log')).toContainText(first);
    expect(ciphertext.length).toBeGreaterThan(0); expect(ciphertext[0].algorithm).toBe('m.megolm.v1.aes-sha2');
    expect(JSON.stringify(ciphertext)).not.toContain(first);
    const reply = '<script>只作为文本</script> Bob 回复 ' + suffix;
    await bob.getByRole('textbox', { name: '消息', exact: true }).fill(reply); await bob.getByRole('button', { name: '发送', exact: true }).click();
    await expect(alice.getByRole('log')).toContainText(reply); await expect(alice.locator('#chat script')).toHaveCount(0);
    await docker(['restart']); await waitForServer();
    const after = '重连后消息 ' + suffix;
    await expect(alice.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
    await alice.getByRole('textbox', { name: '消息', exact: true }).fill(after); await alice.getByRole('button', { name: '发送', exact: true }).click();
    await expect(bob.getByRole('log')).toContainText(after); await expect(bob.getByRole('log')).toContainText(first);
    // Query server storage after restart, independently of the SDK's in-memory timeline.
    const headers = { Authorization: `Bearer ${aliceAuth.access_token}` };
    const joined = await (await fetch(base + '/_matrix/client/v3/joined_rooms', { headers })).json();
    expect(joined.joined_rooms).toHaveLength(1);
    const history = await (await fetch(base + '/_matrix/client/v3/rooms/' + encodeURIComponent(joined.joined_rooms[0]) + '/messages?dir=b&limit=50', { headers })).json();
    expect(history.chunk.filter(e => e.type === 'm.room.encrypted').length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(history)).not.toContain(first); expect(JSON.stringify(history)).not.toContain(reply);
    await checkRestoredSnapshot(async restoredBase => {
      const response = await fetch(restoredBase + '/_matrix/client/v3/rooms/' + encodeURIComponent(joined.joined_rooms[0]) + '/messages?dir=b&limit=50', { headers });
      expect(response.status).toBe(200);
      const restored = await response.json();
      expect(restored.chunk.filter(e => e.type === 'm.room.encrypted').map(e => e.event_id).sort())
        .toEqual(history.chunk.filter(e => e.type === 'm.room.encrypted').map(e => e.event_id).sort());
      expect(JSON.stringify(restored)).not.toContain(first);
    });
    await expect(bob.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
    const restoredMessage = '备份演练后继续通信 ' + suffix;
    await bob.getByRole('textbox', { name: '消息', exact: true }).fill(restoredMessage);
    await bob.getByRole('button', { name: '发送', exact: true }).click();
    await expect(alice.getByRole('log')).toContainText(restoredMessage);
    expect(await bob.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Device verification, key backup and lost-device recovery remain separate gates.
    await alice.screenshot({ path: info.outputPath('encrypted-desktop.png'), fullPage: true });
    await bob.screenshot({ path: info.outputPath('encrypted-mobile-viewport.png'), fullPage: true });
  } finally { await a.close(); await b.close(); }
});
