import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { register } from '../tool/fixture-accounts.js';
import { base } from '../tool/local-server.js';

test('failed-message retry isolates rooms, preserves newer drafts and ignores detached completion', async ({ page }) => {
  await page.goto('http://127.0.0.1:14174');
  const result = await page.evaluate(async () => {
    const { mountChat } = await import('/widget/mutual-chat.js');
    const makeSession = () => {
      let listener = () => {}; let retrying = false; let failed = true; let finish; let retryCalls = 0;
      const session = {
        ready: true,
        rooms: () => ['a', 'b'].map(id => ({ id, name: id, membership: 'join', encrypted: true })),
        messages: room => room === 'a' ? [{ id: '~a:txn', sender: '@me:test', mine: true, text: '失败消息', time: 1, status: failed ? (retrying ? 'sending' : 'not_sent') : 'sent', canRetry: failed && !retrying, retrying }] : [],
        subscribe: fn => { listener = fn; return () => { listener = () => {}; }; },
        retryMessage: () => { retryCalls++; retrying = true; listener(); return new Promise(resolve => { finish = () => { failed = false; retrying = false; listener(); resolve(); }; }); },
        sendText: async () => {},
        controls: () => ({ finish, retryCalls }),
      };
      return session;
    };
    const choose = (root, room) => [...root.querySelectorAll('.room')].find(node => node.textContent === room).click();
    const write = (root, text) => { const input = root.querySelector('textarea'); input.value = text; input.dispatchEvent(new Event('input')); };

    const firstSession = makeSession(); const firstHost = document.createElement('div'); document.body.append(firstHost);
    const firstPanel = mountChat(firstHost, { session: firstSession }); const first = firstHost.firstChild.shadowRoot;
    choose(first, 'a'); write(first, '失败消息'); first.querySelector('.retry').click(); choose(first, 'b'); write(first, '房间 B 草稿');
    firstSession.controls().finish(); await new Promise(resolve => setTimeout(resolve));
    const otherRoomPreserved = first.querySelector('textarea').value === '房间 B 草稿' && first.querySelector('.status').textContent === '';
    choose(first, 'a'); const matchingDraftCleared = first.querySelector('textarea').value === '';
    firstPanel.unmount(); firstHost.remove();

    const secondSession = makeSession(); const secondHost = document.createElement('div'); document.body.append(secondHost);
    const secondPanel = mountChat(secondHost, { session: secondSession }); const second = secondHost.firstChild.shadowRoot;
    choose(second, 'a'); write(second, '失败消息'); second.querySelector('.retry').click(); write(second, '重试期间的新草稿');
    secondSession.controls().finish(); await new Promise(resolve => setTimeout(resolve));
    const newerDraftPreserved = second.querySelector('textarea').value === '重试期间的新草稿';
    secondPanel.unmount(); secondHost.remove();

    const thirdSession = makeSession(); const thirdHost = document.createElement('div'); document.body.append(thirdHost);
    const thirdPanel = mountChat(thirdHost, { session: thirdSession }); const third = thirdHost.firstChild.shadowRoot;
    choose(third, 'a'); third.querySelector('.retry').click(); thirdPanel.unmount(); const detached = thirdHost.children.length === 0;
    thirdSession.controls().finish(); await new Promise(resolve => setTimeout(resolve));
    const detachedIgnored = detached && thirdHost.children.length === 0 && thirdSession.controls().retryCalls === 1;
    thirdHost.remove();
    return { otherRoomPreserved, matchingDraftCleared, newerDraftPreserved, detachedIgnored };
  });
  expect(result).toEqual({ otherRoomPreserved: true, matchingDraftCleared: true, newerDraftPreserved: true, detachedIgnored: true });
});

test('sync failures and recovery are explicit without browser online heuristics', async ({ page }) => {
  await page.goto('http://127.0.0.1:14174');
  const result = await page.evaluate(async () => {
    const { mountChat } = await import('/widget/mutual-chat.js');
    let listener = () => {}; let state = 'error';
    const session = { ready: false, connectionState: () => state, rooms: () => [], messages: () => [], sendText: async () => {},
      subscribe: fn => { listener = fn; return () => { listener = () => {}; }; } };
    const host = document.createElement('div'); document.body.append(host); const panel = mountChat(host, { session }); const root = host.firstChild.shadowRoot;
    const interrupted = root.querySelector('.status').textContent;
    state = 'reconnecting'; listener(); const reconnecting = root.querySelector('.status').textContent;
    state = 'ready'; session.ready = true; listener(); const restored = root.querySelector('.status').textContent;
    panel.unmount(); host.remove(); return { interrupted, reconnecting, restored };
  });
  expect(result.interrupted).toContain('连接已中断');
  expect(result.reconnecting).toContain('正在重新连接');
  expect(result.restored).toContain('已重新连接');
});

test('a failed encrypted send retries its original transaction exactly once', async ({ browser }) => {
  const suffix = randomBytes(5).toString('hex'); const password = randomBytes(24).toString('hex');
  const aliceId = await register('retry_a_' + suffix, password); const bobId = await register('retry_b_' + suffix, password);
  const ac = await browser.newContext(); const bc = await browser.newContext(); const alice = await ac.newPage(); const bob = await bc.newPage();
  async function login(page, id) {
    await page.goto('http://127.0.0.1:14173'); await page.getByLabel('服务器地址').fill(base); await page.getByLabel('用户 ID').fill(id); await page.getByLabel('密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '连接', exact: true }).click(); await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeEnabled();
  }
  try {
    await login(alice, aliceId); await login(bob, bobId); const roomName = '发送重试 ' + suffix;
    await alice.getByRole('button', { name: '新建会话', exact: true }).click(); await alice.getByLabel('会话名称', { exact: true }).fill(roomName); await alice.getByLabel('邀请用户 ID', { exact: true }).fill(bobId);
    await alice.getByRole('button', { name: '创建加密会话', exact: true }).click(); const invite = bob.getByRole('button', { name: '邀请 · ' + roomName, exact: true });
    await expect(invite).toBeVisible(); bob.once('dialog', dialog => dialog.accept()); await invite.click(); await expect(bob.locator('header')).toContainText(roomName);
    const requests = []; let blocked = false;
    alice.on('request', request => { if (/\/send\/m\.room\.encrypted\//.test(request.url())) requests.push(new URL(request.url()).pathname); });
    await alice.route('**/send/m.room.encrypted/**', async route => { if (!blocked) { blocked = true; await route.abort('failed'); } else await route.continue(); });
    const body = '复用原事务 ' + suffix; await alice.getByRole('textbox', { name: '消息', exact: true }).fill(body); await alice.getByRole('button', { name: '发送', exact: true }).click();
    const retry = alice.getByRole('button', { name: '重试发送', exact: true }); await expect(retry).toBeEnabled(); await expect(alice.locator('.status')).toContainText('发送未确认');
    const accepted = alice.waitForResponse(response => response.url().includes('/send/m.room.encrypted/') && response.status() === 200);
    await retry.click(); await accepted; await expect(bob.getByRole('log')).toContainText(body); await expect(alice.locator('.status')).toContainText('服务器确认发送');
    await expect(alice.getByRole('textbox', { name: '消息', exact: true })).toHaveValue('');
    expect(requests).toHaveLength(2); expect(requests[1]).toBe(requests[0]);
  } finally { await ac.close(); await bc.close(); }
});
