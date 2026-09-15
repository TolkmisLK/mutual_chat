import { createClient } from 'matrix-js-sdk';
import { mountChat } from '../packages/chat-ui/index.js';
import { validateHomeserver } from '../packages/chat-core/session.js';
import { VAULT_KEY, sealSession, openSession, randomStorageKey, storageKeyBytes } from './session-vault.js';

import { BackupRecovery } from './backup-recovery.js';
import { mountBackupRecovery } from './backup-recovery-ui.js';
import { DeviceSessions } from './device-sessions.js';
import { mountDeviceSessions } from './device-sessions-ui.js';

const $ = id => document.getElementById(id);
let active; let panel; let releaseLock; let current; let remembered = false; let busy = false; let closing = false;
let recovery; let recoveryPanel;
let devices; let devicesPanel;
function assertOpen() { if (closing) throw new Error('Window closed during initialization'); }
const say = text => { $('status').textContent = text; };
function landing() {
  let saved = false;
  try { saved = Boolean(localStorage.getItem(VAULT_KEY)); }
  catch { say('浏览器不允许读取本地存储，请调整设置后重试。'); }
  $('login').hidden = saved; $('unlock').hidden = !saved;
  $('login-panel').hidden = false; $('chat').hidden = true;
  $('logout').hidden = true; $('lock').hidden = true; $('security').hidden = true; $('devices').hidden = true; $('device').textContent = '';
}
async function holdLock() {
  if (!navigator.locks || !crypto.subtle) throw new Error('请通过 HTTPS 或 localhost 使用支持 Web Locks 的浏览器。');
  await new Promise((resolve, reject) => {
    navigator.locks.request('mutual-chat-standalone', { ifAvailable: true }, async lock => {
      if (!lock) { reject(new Error('已有聊天窗口打开，请先锁定或关闭另一窗口。')); return; }
      const held = new Promise(done => { releaseLock = done; }); resolve(); await held;
    }).catch(reject);
  });
}
function stop() {
  devicesPanel?.dispose(); devicesPanel = null; devices?.dispose(); devices = null;
  recoveryPanel?.dispose(); recoveryPanel = null; recovery?.dispose(); recovery = null;
  panel?.unmount(); panel = null; active?.stopClient(); active = null; current = null; remembered = false;
  releaseLock?.(); releaseLock = null;
}
async function start(session, persist) {
  current = session; remembered = persist;
  recovery = new BackupRecovery();
  active = createClient({ baseUrl: session.baseUrl, userId: session.userId, deviceId: session.deviceId, accessToken: session.accessToken, cryptoCallbacks: recovery.callbacks });
  recovery.bind(active);
  const identity = await active.whoami();
  assertOpen();
  if (identity.user_id !== session.userId || identity.device_id !== session.deviceId) throw new Error('保存的设备身份与服务器不一致。');
  await active.initRustCrypto(persist ? { cryptoDatabasePrefix: session.cryptoDatabasePrefix, storageKey: storageKeyBytes(session.storageKey) } : { useIndexedDB: false });
  assertOpen();
  panel = mountChat($('chat'), { client: active });
  await active.startClient({ initialSyncLimit: 30 });
  assertOpen();
  recoveryPanel = mountBackupRecovery(recovery, setBusy);
  devices = new DeviceSessions(active); devicesPanel = mountDeviceSessions(devices, setBusy);
}
function showChat() {
  $('login-panel').hidden = true; $('chat').hidden = false; $('logout').hidden = false; $('lock').hidden = !remembered; $('security').hidden = false; $('devices').hidden = false;
  $('device').textContent = `${current.userId} · 设备 ${current.deviceId}${remembered ? ' · 已在此浏览器保留' : ' · 临时会话'}`; say('');
}
function setBusy(value) {
  busy = value;
  for (const id of ['connect', 'unlock-button', 'forget', 'logout', 'lock', 'security', 'devices']) $(id).disabled = value;
  if (!value && closing) stop();
}
$('remember').onchange = () => {
  const enabled = $('remember').checked; $('local-passphrase-label').hidden = !enabled; $('local-passphrase').required = enabled;
  if (!enabled) $('local-passphrase').value = '';
};
$('login').onsubmit = async event => {
  event.preventDefault(); if (busy) return; setBusy(true); say('正在连接…');
  let session; let persist = false; let saved = false;
  try {
    const baseUrl = validateHomeserver($('server').value);
    persist = $('remember').checked; const passphrase = $('local-passphrase').value;
    if (persist && (passphrase.length < 12 || passphrase.length > 1024)) throw new Error('本机解锁口令需为 12–1024 个字符。');
    await holdLock();
    assertOpen();
    if (localStorage.getItem(VAULT_KEY)) throw new Error('已有保存的会话，请刷新后解锁。');
    const loginClient = createClient({ baseUrl }); let auth;
    try { auth = await loginClient.loginWithPassword($('user').value, $('password').value); }
    finally { $('password').value = ''; loginClient.stopClient(); }
    session = { baseUrl, userId: auth.user_id, deviceId: auth.device_id, accessToken: auth.access_token,
      cryptoDatabasePrefix: `mutual-chat-v1-${crypto.randomUUID()}`, storageKey: randomStorageKey() };
    assertOpen();
    await start(session, persist);
    if (persist) { const sealed = await sealSession(session, passphrase); assertOpen(); localStorage.setItem(VAULT_KEY, sealed); saved = true; }
    showChat();
  } catch (error) {
    let revoked = true;
    if (session) {
      try { await (active || createClient({ baseUrl: session.baseUrl, accessToken: session.accessToken })).logout(); }
      catch { revoked = false; }
      active?.stopClient();
      if (persist && active && revoked) { try { await active.clearStores({ cryptoDatabasePrefix: session.cryptoDatabasePrefix }); } catch {} }
      if (saved) { try { localStorage.removeItem(VAULT_KEY); } catch {} }
    }
    stop(); landing();
    say(!revoked ? '初始化失败，服务器未确认撤销本次登录。请从其他客户端的设备管理中移除此设备。' :
      /^(请|已有|本机)/.test(error.message || '') ? error.message : '连接失败，请检查帐号、密码、服务器和本地存储权限。');
  } finally { $('password').value = ''; $('local-passphrase').value = ''; setBusy(false); }
};
$('unlock').onsubmit = async event => {
  event.preventDefault(); if (busy) return; setBusy(true); say('正在解锁并核对设备…');
  try {
    await holdLock();
    assertOpen();
    const session = await openSession(localStorage.getItem(VAULT_KEY), $('unlock-passphrase').value);
    assertOpen();
    await start(session, true); showChat();
  } catch (error) {
    stop(); landing();
    say(error.errcode === 'M_UNKNOWN_TOKEN' ? '保存的登录已失效，请移除此浏览器会话后重新登录。' :
      error.message?.startsWith('已有') ? error.message : '无法解锁：请核对本机口令、网络和保存的会话是否完整。原会话已保留。');
  } finally { $('unlock-passphrase').value = ''; setBusy(false); }
};
$('security').onclick = () => { if (!busy) recoveryPanel?.open(); };
$('devices').onclick = () => { if (!busy) devicesPanel?.open(); };
$('lock').onclick = () => { if (busy) return; stop(); landing(); say('已锁定，输入本机口令可继续使用原设备。'); };
$('forget').onclick = async () => {
  if (busy || !confirm('忘记保存的登录会导致此浏览器无法恢复原设备密钥。此操作不会退出服务器上的设备，请从其他客户端撤销该设备。仍要忘记？')) return;
  setBusy(true);
  try { await holdLock(); assertOpen(); localStorage.removeItem(VAULT_KEY); landing(); say('已忘记本机登录。请在其他客户端撤销原设备；浏览器设置可清理残留的加密站点数据。'); }
  catch { say('无法忘记会话，请先锁定其他窗口并检查存储权限。'); }
  finally { releaseLock?.(); releaseLock = null; setBusy(false); }
};
$('logout').onclick = async () => {
  if (busy || !confirm('退出将清除此浏览器保存的登录和本设备密钥。未备份的历史消息可能无法再次解密。继续退出？')) return;
  setBusy(true);
  let revoked = false;
  try {
    await active.logout(); revoked = true; active.stopClient();
    let cleared = true;
    if (remembered) {
      try { localStorage.removeItem(VAULT_KEY); } catch { cleared = false; }
      try { await active.clearStores({ cryptoDatabasePrefix: current.cryptoDatabasePrefix }); } catch { cleared = false; }
    }
    stop(); landing(); say(cleared ? '已退出。' : '已退出服务器，但本地密钥库清理未完成，可在浏览器设置中清除此站点数据。');
  } catch {
    if (revoked) { stop(); landing(); say('已退出服务器，但本地清理未完成，请在浏览器设置中清除此站点数据。'); }
    else say('服务器尚未确认退出，请检查连接后重试。');
  }
  finally { setBusy(false); }
};
window.addEventListener('pagehide', () => {
  closing = true; panel?.unmount(); recoveryPanel?.dispose(); recovery?.dispose(); active?.stopClient();
  // An in-flight initializer must settle and stop before another live window
  // can acquire this database. Document destruction also releases Web Locks.
  if (!busy) stop();
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
landing();
