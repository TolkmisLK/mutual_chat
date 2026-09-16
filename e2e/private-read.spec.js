import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { register } from '../tool/fixture-accounts.js';
import { base } from '../tool/local-server.js';

test('encrypted unread state changes only on explicit private receipt, retry preserves new arrivals and hides receipts from peers', async ({ browser }, info) => {
  const suffix = randomBytes(5).toString('hex'); const password = randomBytes(24).toString('hex');
  const aliceId = await register('reader_a_' + suffix, password); const bobId = await register('reader_b_' + suffix, password);
  const ac = await browser.newContext(); const bc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const alice = await ac.newPage(); const bob = await bc.newPage(); const receipts = []; let release;
  async function login(page, user) {
    await page.goto('http://127.0.0.1:14173'); await page.getByLabel('服务器地址').fill(base); await page.getByLabel('用户 ID').fill(user); await page.getByLabel('密码', { exact: true }).fill(password);
    const response = page.waitForResponse(r => r.url().endsWith('/_matrix/client/v3/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '连接', exact: true }).click(); const auth = await (await response).json();
    await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeEnabled(); return auth;
  }
  const sync = async (auth, since) => {
    const response = await fetch(base + '/_matrix/client/v3/sync?timeout=0' + (since ? '&since=' + encodeURIComponent(since) : ''), { headers: { Authorization: `Bearer ${auth.access_token}` } });
    expect(response.status).toBe(200); return response.json();
  };
  async function send(text) {
    await alice.getByRole('textbox', { name: '消息', exact: true }).fill(text);
    await alice.getByRole('button', { name: '发送', exact: true }).click(); await expect(bob.getByRole('log')).toContainText(text);
  }
  try {
    const a = await login(alice, aliceId); const b = await login(bob, bobId); const name = '私人已读 ' + suffix;
    await alice.getByRole('button', { name: '新建会话', exact: true }).click(); await alice.getByLabel('会话名称', { exact: true }).fill(name); await alice.getByLabel('邀请用户 ID', { exact: true }).fill(bobId);
    const created = alice.waitForResponse(r => r.url().endsWith('/createRoom') && r.status() === 200);
    await alice.getByRole('button', { name: '创建加密会话', exact: true }).click(); const roomId = (await (await created).json()).room_id;
    bob.on('dialog', d => d.accept()); await bob.getByRole('button', { name: '邀请 · ' + name, exact: true }).click();
    await expect(bob.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
    await bob.route('**/receipt/**', async route => {
      receipts.push(route.request().url());
      if (receipts.length === 1) return route.abort('failed');
      if (receipts.length === 2) await new Promise(resolve => { release = resolve; });
      await route.continue();
    });
    await send('第一条已解密消息 ' + suffix);
    const button = bob.getByRole('button', { name: '标为已读（仅自己）', exact: true });
    await expect(bob.locator('.unread')).toContainText('未读 1'); expect(receipts).toHaveLength(0);
    const peerBaseline = await sync(a); const ownBaseline = await sync(b);
    await button.click(); await expect(bob.locator('.status')).toContainText('未获服务器确认'); await expect(button).toBeEnabled();
    await expect(bob.locator('.unread')).toContainText('未读 1');
    expect(receipts).toHaveLength(1); expect(receipts[0]).toContain('/receipt/m.read.private/');
    await button.click(); await expect.poll(() => Boolean(release)).toBe(true); await expect(button).toBeDisabled();
    const firstTarget = receipts[1]; await send('请求进行中到达的新消息 ' + suffix);
    await expect(bob.locator('.unread')).toContainText('未读 2');
    release(); release = null; await expect(bob.locator('.status')).toContainText('已更新私人已读位置');
    const unread = async () => (await sync(b)).rooms.join[roomId].unread_notifications.notification_count;
    await expect.poll(unread).toBe(1); await expect(bob.locator('.unread')).toContainText('未读 1');
    await button.click(); await expect(bob.locator('.status')).toContainText('已更新私人已读位置'); await expect.poll(unread).toBe(0);
    await expect(bob.locator('.unread')).toHaveCount(0); expect(receipts).toHaveLength(3); expect(receipts[2]).not.toBe(firstTarget);
    expect(receipts.every(url => url.includes('/receipt/m.read.private/'))).toBe(true);
    const own = await sync(b, ownBaseline.next_batch); const peer = await sync(a, peerBaseline.next_batch);
    const privateReaders = data => (data.rooms?.join?.[roomId]?.ephemeral?.events || []).filter(e => e.type === 'm.receipt').flatMap(e => Object.values(e.content)).flatMap(types => Object.keys(types['m.read.private'] || {}));
    expect(privateReaders(own)).toContain(bobId); expect(privateReaders(peer)).not.toContain(bobId);
    const peerPublic = (peer.rooms?.join?.[roomId]?.ephemeral?.events || []).filter(e => e.type === 'm.receipt').flatMap(e => Object.values(e.content)).flatMap(types => Object.keys(types['m.read'] || {}));
    expect(peerPublic).not.toContain(bobId);
    expect(await bob.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await bob.screenshot({ path: info.outputPath('private-read-mobile.png'), fullPage: true });
  } finally { release?.(); await ac.close(); await bc.close(); }
});
