import { createClient } from 'matrix-js-sdk';
import { mountChat } from '../packages/chat-ui/index.js';
import { validateHomeserver } from '../packages/chat-core/session.js';

const $ = id => document.getElementById(id);
let active; let panel; let releaseLock;
$('login').onsubmit = async e => {
  e.preventDefault(); $('connect').disabled = true; $('status').textContent = '正在连接…';
  try {
    if (!navigator.locks) throw new Error('请在支持 Web Locks 的浏览器中通过 HTTPS 或 localhost 打开。');
    const baseUrl = validateHomeserver($('server').value);
    // Own one standalone SDK instance per origin. Embedded hosts own their client separately.
    await new Promise((resolve, reject) => {
      navigator.locks.request('mutual-chat-standalone', { ifAvailable: true }, async lock => {
        if (!lock) { reject(new Error('已有聊天窗口打开，请先关闭另一窗口。')); return; }
        const held = new Promise(done => { releaseLock = done; }); resolve(); await held;
      }).catch(reject);
    });
    const loginClient = createClient({ baseUrl });
    let auth;
    try { auth = await loginClient.loginWithPassword($('user').value, $('password').value); }
    finally { $('password').value = ''; loginClient.stopClient(); }
    active = createClient({ baseUrl, userId: auth.user_id, deviceId: auth.device_id, accessToken: auth.access_token });
    await active.initRustCrypto({ cryptoDatabasePrefix: `mutual-chat:${auth.user_id}:${auth.device_id}` });
    panel = mountChat($('chat'), { client: active });
    await active.startClient({ initialSyncLimit: 30 });
    $('login-panel').hidden = true; $('chat').hidden = false; $('logout').hidden = false; $('status').textContent = '';
  } catch (error) {
    panel?.unmount(); panel = null; active?.stopClient(); active = null; releaseLock?.(); releaseLock = null;
    $('status').textContent = error.message?.startsWith('请') || error.message?.startsWith('已有') || error.message?.startsWith('服务器') ? error.message : '连接失败。请检查服务器地址、帐号、密码及服务是否支持密码登录。';
  } finally { $('connect').disabled = false; }
};
$('logout').onclick = async () => {
  $('logout').disabled = true;
  try { await active.logout(); }
  catch { $('logout').disabled = false; alert('服务器尚未确认退出，请检查连接后重试。'); return; }
  panel?.unmount(); active.stopClient(); active = null; panel = null; releaseLock?.(); releaseLock = null;
  $('chat').hidden = true; $('logout').hidden = true; $('logout').disabled = false; $('login-panel').hidden = false;
};
window.addEventListener('pagehide', () => { panel?.unmount(); active?.stopClient(); releaseLock?.(); });
