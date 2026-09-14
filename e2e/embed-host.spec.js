import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { register } from '../tool/fixture-accounts.js';
import { base } from '../tool/local-server.js';

test('built widget preserves host login, subscriptions and pending encrypted sends across navigation', async ({ page }, info) => {
  const suffix = randomBytes(5).toString('hex'); const password = randomBytes(24).toString('hex');
  const user = await register('host_' + suffix, password); const errors = []; let logouts = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().endsWith('/logout')) logouts++; });
  await page.goto('http://127.0.0.1:14174');
  await page.getByLabel('服务器地址').fill(base); await page.getByLabel('用户 ID').fill(user); await page.getByLabel('密码', { exact: true }).fill(password);
  const login = page.waitForResponse(r => r.url().endsWith('/_matrix/client/v3/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '连接', exact: true }).click(); const auth = await (await login).json();
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const diagnostic = async () => JSON.parse(await page.locator('#diagnostics').textContent());
  await expect(page.locator('#workspace')).toBeVisible();
  await expect.poll(async () => ['PREPARED', 'SYNCING'].includes((await diagnostic()).syncState)).toBe(true);
  const roomName = '宿主会话 ' + suffix; let prompts = 0;
  page.on('dialog', d => d.accept(++prompts === 1 ? roomName : ''));
  await page.getByRole('button', { name: '打开聊天', exact: true }).click();
  await expect(page.getByRole('button', { name: '新建会话' })).toBeEnabled();
  await page.getByRole('button', { name: '新建会话' }).click();
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '工作台', exact: true }).click();
  const baseline = await diagnostic(); expect(baseline.sharedSubscribers).toBe(0);
  for (const mode of ['shared', 'owned']) {
    await page.getByLabel('挂载方式').selectOption(mode);
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: '打开聊天', exact: true }).click();
      expect((await diagnostic()).sharedSubscribers).toBe(mode === 'shared' ? 1 : 0);
      await page.getByRole('button', { name: '工作台', exact: true }).click();
      const current = await diagnostic(); expect(current.sdkListeners).toEqual(baseline.sdkListeners);
      expect(current.sharedSubscribers).toBe(0); expect(current.deviceId).toBe(auth.device_id);
      await expect(page.locator('#chat > div')).toHaveCount(0);
    }
    await page.getByRole('button', { name: '打开聊天', exact: true }).click();
    await page.getByRole('button', { name: roomName, exact: true }).click();
    let release; let captured;
    const pending = new Promise(resolve => { captured = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const pattern = '**/send/m.room.encrypted/**';
    await page.route(pattern, async route => { captured(); await gate; await route.continue(); });
    const text = `切换页面后完成发送 ${mode} ${suffix}`;
    try {
      await page.getByRole('textbox', { name: '消息', exact: true }).fill(text);
      await page.getByRole('button', { name: '发送', exact: true }).click();
      await pending;
      await page.getByRole('button', { name: '工作台', exact: true }).click();
      const response = page.waitForResponse(r => r.url().includes('/send/m.room.encrypted/') && r.status() === 200);
      release(); await response;
      await page.getByRole('button', { name: '打开聊天', exact: true }).click();
      await page.getByRole('button', { name: roomName, exact: true }).click();
      await expect(page.getByRole('log')).toContainText(text);
      await expect(page.getByRole('log').locator('.message').filter({ hasText: text })).toHaveCount(1);
    } finally { release(); await page.unroute(pattern); }
    await page.getByRole('button', { name: '工作台', exact: true }).click();
    expect((await diagnostic()).sdkListeners).toEqual(baseline.sdkListeners);
  }
  expect(logouts).toBe(0);
  const who = await fetch(base + '/_matrix/client/v3/account/whoami', { headers }); expect(who.status).toBe(200);
  expect((await who.json()).device_id).toBe(auth.device_id);
  const rooms = await (await fetch(base + '/_matrix/client/v3/joined_rooms', { headers })).json();
  const history = await (await fetch(base + '/_matrix/client/v3/rooms/' + encodeURIComponent(rooms.joined_rooms[0]) + '/messages?dir=b&limit=50', { headers })).json();
  expect(history.chunk.filter(e => e.type === 'm.room.encrypted')).toHaveLength(2);
  await page.getByRole('button', { name: '打开聊天', exact: true }).click();
  await page.getByRole('button', { name: roomName, exact: true }).click();
  await page.screenshot({ path: info.outputPath('embedded-host.png'), fullPage: true });
  await page.getByRole('button', { name: '退出帐号', exact: true }).click(); await expect(page.locator('#login-panel')).toBeVisible();
  expect(logouts).toBe(1);
  expect((await fetch(base + '/_matrix/client/v3/account/whoami', { headers })).status).toBe(401);
  expect(errors).toEqual([]);
});

test('detached widget ignores stale controls and late async results', async ({ page }) => {
  await page.goto('http://127.0.0.1:14174');
  const result = await page.evaluate(async () => {
    const { mountChat } = await import('/widget/mutual-chat.js');
    const root = document.createElement('div'); document.body.append(root);
    let sends = 0; let joins = 0; let creates = 0; let disposed = 0; let subscribed = 0; let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const session = { ready: true, rooms: () => [{ id: 'one', name: 'One', membership: 'join', encrypted: true }], messages: () => [],
      subscribe: () => { subscribed++; return () => { subscribed--; }; }, dispose: () => { disposed++; },
      sendText: async () => { sends++; await pending; }, join: async () => { joins++; }, createRoom: async () => { creates++; } };
    const panel = mountChat(root, { session }); const shadow = root.firstChild.shadowRoot;
    const oldRoom = shadow.querySelector('.room'); oldRoom.click();
    const form = shadow.querySelector('form'); const handler = form.onsubmit;
    const create = shadow.querySelector('.create').onclick;
    shadow.querySelector('textarea').value = 'preserve detached draft';
    const running = handler({ preventDefault() {} });
    panel.unmount(); panel.unmount(); finish(); await running;
    await handler({ preventDefault() {} }); await create(); oldRoom.click();
    const detachedDraft = shadow.querySelector('textarea').value;
    const detached = root.children.length === 0;
    const again = mountChat(root, { session }); again.unmount(); root.remove();
    return { sends, joins, creates, disposed, subscribed, detachedDraft, detached };
  });
  expect(result).toEqual({ sends: 1, joins: 0, creates: 0, disposed: 0, subscribed: 0, detachedDraft: 'preserve detached draft', detached: true });
});
