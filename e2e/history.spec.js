import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { register } from '../tool/fixture-accounts.js';
import { base } from '../tool/local-server.js';

test('real encrypted history paginates after initial sync, retries failure and preserves the reading anchor', async ({ browser, page }, info) => {
  // Seed through the real SDK and respect the fixture server's normal message
  // rate limits. No synthetic sync payloads or plaintext room messages.
  test.setTimeout(300000);
  const suffix = randomBytes(5).toString('hex'); const password = randomBytes(24).toString('hex');
  const user = await register('history_' + suffix, password); const message = '最早的加密历史 ' + suffix;
  const roomName = '分页历史 ' + suffix; const context = await browser.newContext(); let seed;
  try {
    const source = await context.newPage(); await source.goto('http://127.0.0.1:14175/e2e/backup-fixture.html');
    await source.waitForFunction(() => typeof window.seedBackup === 'function');
    seed = await source.evaluate(args => window.seedBackup(args), { baseUrl: base, user, password, roomName, message, historyCount: 32 });
  } finally { await context.close(); }
  await page.goto('/'); await page.getByLabel('服务器地址').fill(base); await page.getByLabel('用户 ID').fill(user);
  await page.getByLabel('密码', { exact: true }).fill(password); await page.getByRole('button', { name: '连接', exact: true }).click();
  await page.getByRole('button', { name: roomName, exact: true }).click();
  const first = page.locator('.message').filter({ has: page.getByText(message, { exact: true }) });
  await expect(page.locator('.message')).toHaveCount(30); await expect(first).toHaveCount(0);
  await page.getByRole('button', { name: '恢复密钥', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复历史密钥', exact: true })).toBeEnabled();
  try {
    await page.locator('#backup-key').fill(seed.recoveryKey); await page.getByRole('button', { name: '恢复历史密钥', exact: true }).click();
    await expect(page.locator('#backup-result')).toContainText('恢复完成');
  } finally { await page.locator('#backup-key').evaluate(input => { input.value = ''; }).catch(() => {}); }
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('log')).toContainText(message + ' · 31');
  let requests = 0; let fail = true;
  await page.route(/\/rooms\/[^/]+\/messages\?/, route => {
    requests++;
    if (fail) { fail = false; return route.abort('failed'); }
    return route.continue();
  });
  const earlier = page.getByRole('button', { name: '加载更早消息', exact: true });
  await earlier.click(); await expect(page.getByRole('status').filter({ hasText: '历史加载失败' })).toBeVisible();
  await expect(earlier).toBeEnabled(); expect(requests).toBe(1);
  const anchor = await page.getByRole('log').evaluate(log => {
    log.scrollTop = log.scrollHeight / 2;
    const node = [...log.children].find(node => node.getBoundingClientRect().bottom > log.getBoundingClientRect().top);
    return { id: node.dataset.eventId, offset: node.getBoundingClientRect().top - log.getBoundingClientRect().top };
  });
  await earlier.click(); await expect(earlier).toBeDisabled();
  await expect(first).toHaveCount(1); await expect(page.locator('.message')).toHaveCount(32);
  await expect(page.getByRole('log')).not.toContainText('[等待解密或缺少密钥]'); expect(requests).toBe(2);
  const after = await page.getByRole('log').evaluate((log, id) => {
    const node = [...log.children].find(node => node.dataset.eventId === id);
    return node.getBoundingClientRect().top - log.getBoundingClientRect().top;
  }, anchor.id);
  expect(Math.abs(after - anchor.offset)).toBeLessThan(3);
  const ids = await page.locator('.message').evaluateAll(nodes => nodes.map(node => node.dataset.eventId)); expect(new Set(ids).size).toBe(32);
  // Synapse may return one final state-only page before marking history done.
  for (let i = 0; i < 3 && await earlier.isVisible(); i++) {
    await earlier.click(); await expect(page.locator('.history-state')).not.toContainText('正在加载');
  }
  await expect(earlier).toBeHidden(); await expect(page.locator('.history-state')).toContainText('已到当前可访问历史的开头');
  await page.getByRole('log').evaluate(log => { log.scrollTop = 0; });
  await page.screenshot({ path: info.outputPath('encrypted-history-pagination.png'), fullPage: true });
});
