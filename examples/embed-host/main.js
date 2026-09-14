import { createClient } from 'matrix-js-sdk';
import { ChatSession, mountChat } from '/widget/mutual-chat.js';
import { validateHomeserver } from '../../packages/chat-core/session.js';

const $ = id => document.getElementById(id);
let client; let shared; let panel; let releaseLock; let hostSyncCount = 0;
const observed = ['sync', 'Room.timeline', 'Room', 'Event.decrypted', 'Room.name', 'Room.myMembership'];
const hostSync = () => { hostSyncCount++; diagnostics(); };
function diagnostics() {
  if (!client) { $('diagnostics').textContent = ''; return; }
  $('diagnostics').textContent = JSON.stringify({ connected: true, userId: client.getUserId(), deviceId: client.getDeviceId(),
    syncState: client.getSyncState(), syncEvents: hostSyncCount, sdkListeners: observed.map(event => [event, client.listenerCount(event)]),
    sharedSubscribers: shared?.listeners.size ?? 0, panelMounted: Boolean(panel) });
}
function detach() { panel?.unmount(); panel = null; $('chat').hidden = true; $('overview-panel').hidden = false; diagnostics(); }
function attach() {
  if (!client || panel) return;
  panel = mountChat($('chat'), $('mode').value === 'shared' ? { session: shared } : { client });
  $('chat').hidden = false; $('overview-panel').hidden = true; diagnostics();
}
function cleanup() {
  detach(); shared?.dispose(); shared = null;
  client?.removeListener('sync', hostSync); client?.stopClient(); client = null;
  releaseLock?.(); releaseLock = null; diagnostics();
}
$('login').onsubmit = async event => {
  event.preventDefault(); $('connect').disabled = true; $('status').textContent = '正在连接…';
  try {
    if (!navigator.locks) throw new Error('Web Locks required');
    const baseUrl = validateHomeserver($('server').value);
    await new Promise((resolve, reject) => {
      navigator.locks.request('mutual-chat-embed-host', { ifAvailable: true }, async lock => {
        if (!lock) { reject(new Error('Another host window is open')); return; }
        const held = new Promise(done => { releaseLock = done; }); resolve(); await held;
      }).catch(reject);
    });
    const loginClient = createClient({ baseUrl }); let auth;
    try { auth = await loginClient.loginWithPassword($('user').value, $('password').value); }
    finally { $('password').value = ''; loginClient.stopClient(); }
    client = createClient({ baseUrl, userId: auth.user_id, deviceId: auth.device_id, accessToken: auth.access_token });
    await client.initRustCrypto({ cryptoDatabasePrefix: `mutual-embed:${auth.user_id}:${auth.device_id}` });
    shared = new ChatSession(client); client.on('sync', hostSync);
    await client.startClient({ initialSyncLimit: 30 });
    $('login-panel').hidden = true; $('workspace').hidden = false; $('logout').hidden = false; $('status').textContent = '';
    diagnostics();
  } catch {
    // Revoke the newly created server session if initialization failed after login.
    let revoked = true; if (client) { try { await client.logout(); } catch { revoked = false; } }
    cleanup(); $('status').textContent = revoked ? '连接失败，请检查登录信息、网络或其他已打开的示例窗口。' : '初始化失败且服务器未确认撤销登录，请在帐号的设备管理中移除本次设备。';
  } finally { $('password').value = ''; $('connect').disabled = false; }
};
$('overview').onclick = detach;
$('open-chat').onclick = attach;
$('mode').onchange = () => { const mounted = Boolean(panel); detach(); if (mounted) attach(); };
$('logout').onclick = async () => {
  $('logout').disabled = true;
  try { await client.logout(); cleanup(); $('workspace').hidden = true; $('logout').hidden = true; $('login-panel').hidden = false; }
  catch { $('status').textContent = '退出未得到服务器确认，请检查连接后重试。'; }
  finally { $('logout').disabled = false; }
};
window.addEventListener('pagehide', cleanup);
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
