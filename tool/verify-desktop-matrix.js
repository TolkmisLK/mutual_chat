import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { register } from './fixture-accounts.js';
import { base } from './local-server.js';

// Generated loopback fixtures only. Never save traces, profiles or auth payloads.
const executablePath = path.resolve(process.argv[2] || 'dist/desktop/MutualChat-linux-x64/MutualChat');
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-desktop-matrix-'));
const output = path.resolve('dist/desktop-matrix-evidence');
await fs.mkdir(output, { recursive: true });
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS; delete env.NODE_PATH;
const suffix = randomBytes(5).toString('hex'); const password = randomBytes(24).toString('hex');
const passphrase = 'local-desktop-' + randomBytes(24).toString('hex');
const applications = new Set(); let loginRequests = 0;
const wire = []; const vaultKey = 'mutual-chat:session:v1';
async function launch(name) {
  const application = await electron.launch({ executablePath, args: ['--user-data-dir=' + path.join(directory, name)], chromiumSandbox: true, env, timeout: 60000 });
  applications.add(application);
  const page = await application.firstWindow(); page.setDefaultTimeout(45000);
  const sandboxed = await application.evaluate(({ app, BrowserWindow }) => app.isPackaged && !app.commandLine.hasSwitch('no-sandbox') && BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().sandbox);
  assert.equal(sandboxed, true);
  page.on('request', request => {
    if (request.url().endsWith('/_matrix/client/v3/login') && request.method() === 'POST') loginRequests++;
    if (request.url().includes('/send/m.room.encrypted/')) wire.push(request.postDataJSON());
  });
  return { application, page };
}
async function close(application) { await application.close(); applications.delete(application); }
async function login(page, user, remember) {
  await page.getByLabel('服务器地址').fill(base); await page.getByLabel('用户 ID').fill(user);
  await page.getByLabel('密码', { exact: true }).fill(password);
  if (remember) { await page.getByLabel('在此浏览器保留会话').check(); await page.locator('#local-passphrase').fill(passphrase); }
  const response = page.waitForResponse(r => r.url().endsWith('/_matrix/client/v3/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '连接', exact: true }).click();
  const auth = await (await response).json();
  await expect(page.locator('#chat')).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeEnabled({ timeout: 45000 });
  return auth;
}
async function send(page, message) {
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled({ timeout: 45000 });
  await page.getByRole('textbox', { name: '消息', exact: true }).fill(message);
  const response = page.waitForResponse(r => r.url().includes('/send/m.room.encrypted/') && r.status() === 200);
  await page.getByRole('button', { name: '发送', exact: true }).click(); await response;
}
try {
  const aliceId = await register('desktop_a_' + suffix, password); const bobId = await register('desktop_b_' + suffix, password);
  let alice = await launch('alice'); const bob = await launch('bob');
  const auth = await login(alice.page, aliceId, true); await login(bob.page, bobId, false);
  const room = '桌面加密验收 ' + suffix;
  await alice.page.getByRole('button', { name: '新建会话', exact: true }).click();
  await alice.page.getByLabel('会话名称', { exact: true }).fill(room);
  await alice.page.getByLabel('邀请用户 ID', { exact: true }).fill(bobId);
  await alice.page.getByRole('button', { name: '创建加密会话', exact: true }).click();
  // Electron provides a native confirmation dialog; accept only this test-owned one.
  bob.page.on('dialog', dialog => dialog.accept());
  const invite = bob.page.getByRole('button', { name: '邀请 · ' + room, exact: true });
  await expect(invite).toBeVisible({ timeout: 45000 }); await invite.click();
  const first = '桌面之间第一条加密消息 ' + suffix;
  await send(alice.page, first); await expect(bob.page.getByRole('log')).toContainText(first, { timeout: 45000 });
  const reply = '桌面回复与持久化密钥 ' + suffix;
  await send(bob.page, reply); await expect(alice.page.getByRole('log')).toContainText(reply, { timeout: 45000 });
  const sealed = await alice.page.evaluate(key => localStorage.getItem(key), vaultKey); assert.ok(sealed);
  for (const secret of [auth.access_token, auth.device_id, aliceId, password, passphrase]) assert.equal(sealed.includes(secret), false);
  await close(alice.application); alice = await launch('alice');
  await expect(alice.page.locator('#unlock')).toBeVisible();
  await alice.page.locator('#unlock-passphrase').fill('wrong-local-desktop-passphrase');
  await alice.page.getByRole('button', { name: '解锁', exact: true }).click();
  await expect(alice.page.locator('#status')).toContainText('无法解锁');
  assert.equal(await alice.page.evaluate(key => localStorage.getItem(key), vaultKey), sealed);
  await alice.page.locator('#unlock-passphrase').fill(passphrase);
  await alice.page.getByRole('button', { name: '解锁', exact: true }).click();
  await expect(alice.page.locator('#chat')).toBeVisible({ timeout: 60000 });
  await expect(alice.page.locator('#device')).toContainText(auth.device_id);
  await alice.page.getByRole('button', { name: room, exact: true }).click();
  await expect(alice.page.getByRole('log')).toContainText(first, { timeout: 45000 });
  await expect(alice.page.getByRole('log')).toContainText(reply, { timeout: 45000 });
  assert.equal(loginRequests, 2); // one initial login per account; no replacement device on reopen
  const after = '关闭应用再打开后继续加密 ' + suffix;
  await send(alice.page, after); await expect(bob.page.getByRole('log')).toContainText(after, { timeout: 45000 });
  assert.ok(wire.length >= 3);
  for (const event of wire) assert.equal(event.algorithm, 'm.megolm.v1.aes-sha2');
  for (const plain of [first, reply, after]) assert.equal(JSON.stringify(wire).includes(plain), false);
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const rooms = await (await fetch(base + '/_matrix/client/v3/joined_rooms', { headers })).json();
  assert.equal(rooms.joined_rooms.length, 1);
  const history = await (await fetch(base + '/_matrix/client/v3/rooms/' + encodeURIComponent(rooms.joined_rooms[0]) + '/messages?dir=b&limit=50', { headers })).json();
  assert.ok(history.chunk.filter(event => event.type === 'm.room.encrypted').length >= 3);
  for (const plain of [first, reply, after]) assert.equal(JSON.stringify(history).includes(plain), false);
  await alice.page.screenshot({ path: path.join(output, 'desktop-encrypted-restored.png'), fullPage: true });
  await close(alice.application); await close(bob.application);
  const report = { platform: process.platform, electron: '44.3.0', actualPackagedProcesses: true, chromiumSandboxEnabled: true, privateEncryptedRoom: true, twoWayDecryption: true, wireAndServerCiphertext: true, wrongPassphrasePreservesVault: true, processRestartSameDevice: true, oldHistoryDecrypted: true, continuedEncryptedSend: true, loginRequests, physicalDeviceTested: false, windowsMatrixTested: process.platform === 'win32', trustedRemoteTlsTested: false };
  await fs.writeFile(path.join(output, 'desktop-matrix-validation.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally {
  for (const application of applications) await application.close();
  await fs.rm(directory, { recursive: true, force: true });
}
