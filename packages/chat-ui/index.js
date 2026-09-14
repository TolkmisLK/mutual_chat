import { ChatSession } from '../chat-core/session.js';
export { ChatSession } from '../chat-core/session.js';

export function mountChat(container, { client, session: providedSession }) {
  if (!container || typeof container.append !== 'function' || !container.ownerDocument) throw new TypeError('A DOM container is required');
  if (!providedSession && !client) throw new TypeError('A Matrix client or shared session is required');
  const session = providedSession || new ChatSession(client);
  const host = document.createElement('div'); container.append(host); const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
  :host{display:block;height:100%;font:15px/1.5 system-ui;color:#20343f}*{box-sizing:border-box}.desk{display:grid;grid-template-columns:260px 1fr;height:100%;min-height:420px;border:1px solid #d8e2e8;border-radius:18px;overflow:hidden;background:#f7fafc}aside{background:#fff;border-right:1px solid #d8e2e8;padding:20px;overflow:auto}h2{font-size:19px;margin:0 0 20px}.room{display:block;width:100%;text-align:left;margin:7px 0;padding:12px;border:0;border-radius:10px;background:#edf4f8;color:inherit;cursor:pointer}.room[aria-pressed=true]{background:#d6eaff}section{display:flex;flex-direction:column;min-width:0;min-height:0}header{padding:18px 24px;border-bottom:1px solid #d8e2e8;font-weight:600}.messages{flex:1;overflow:auto;padding:24px}.message{max-width:85%;width:fit-content;background:#fff;border:1px solid #dde6ed;border-radius:12px;padding:12px 16px;margin:12px 0;white-space:pre-wrap;overflow-wrap:anywhere}.mine{margin-left:auto;background:#e0effb}.sender{display:block;font-size:11px;color:#5c7382;margin-bottom:5px}form{display:flex;gap:10px;padding:16px;border-top:1px solid #d8e2e8}textarea{flex:1;resize:vertical;min-width:0;border:1px solid #ccd9e2;border-radius:10px;padding:10px;font:inherit}button{font:inherit;padding:9px 14px;border:1px solid #bfd2df;border-radius:8px;background:#1a6296;color:#fff;cursor:pointer}button:disabled{opacity:.5;cursor:default}.status{padding:0 20px;font-size:13px;color:#566c7a;min-height:24px}.create{width:100%;margin-top:18px}.empty{color:#647c8a}button:focus-visible,textarea:focus-visible{outline:3px solid #d9a847;outline-offset:2px}@media(max-width:640px){.desk{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}aside{max-height:170px;border-right:0;border-bottom:1px solid #d8e2e8;padding:12px}.rooms{display:flex;overflow:auto;gap:8px}.room{min-width:140px}.create{width:auto;margin:6px 0}h2{margin-bottom:6px}.messages{padding:12px}header{padding:12px}.message{max-width:95%}}@media(prefers-color-scheme:dark){:host{color:#e1ebf2}.desk{background:#14212d;border-color:#314353}aside,.message{background:#1d2e3d;border-color:#314353}.room{background:#293d50}.room[aria-pressed=true],.mine{background:#254b6a}textarea{background:#1d2e3d;color:inherit}.sender,.status,.empty{color:#a6bbc9}}
  </style><div class="desk"><aside><h2>Mutual Chat</h2><div class="rooms"></div><button class="create">新建会话</button></aside><section><header>选择一个会话</header><div class="messages" role="log" aria-live="polite"></div><p class="status" role="status"></p><form><textarea aria-label="消息" maxlength="10000" placeholder="输入消息" rows="2"></textarea><button>发送</button></form></section></div>`;
  const q = s => root.querySelector(s); let selected; let sending = false; let stopped = false; let wasReady = session.ready;
  const status = text => { if (!stopped) q('.status').textContent = text; };
  function render() {
    if (stopped) return; const rooms = session.rooms(); q('.rooms').replaceChildren();
    for (const room of rooms) {
      const b = document.createElement('button'); b.className = 'room'; b.setAttribute('aria-pressed', String(room.id === selected));
      b.textContent = `${room.membership === 'invite' ? '邀请 · ' : ''}${room.name}`;
      b.onclick = async () => {
        if (stopped) return;
        try {
          if (room.membership === 'invite') { if (!confirm(`接受「${room.name}」的邀请？`)) return; await session.join(room.id); }
          selected = room.id; render();
        } catch { status('无法加入会话，请检查连接或邀请状态。'); }
      }; q('.rooms').append(b);
    }
    const current = rooms.find(r => r.id === selected && r.membership === 'join');
    q('header').textContent = current ? `${current.name} · ${current.encrypted ? '端到端加密会话' : '未加密会话'}` : '选择一个会话';
    const messages = q('.messages'); const atEnd = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
    messages.replaceChildren();
    for (const message of current ? session.messages(selected) : []) {
      const bubble = document.createElement('div'); bubble.className = `message ${message.mine ? 'mine' : ''}`;
      const sender = document.createElement('span'); sender.className = 'sender'; sender.textContent = `${message.sender} · ${new Date(message.time).toLocaleTimeString()}${message.status === 'sent' ? '' : ` · ${message.status}`}`;
      const body = document.createElement('span'); body.textContent = message.text; bubble.append(sender, body); messages.append(bubble);
    }
    if (atEnd) messages.scrollTop = messages.scrollHeight;
    q('form button').disabled = sending || !current || !session.ready;
    q('.create').disabled = !session.ready;
    if (!session.ready) status('正在连接并同步消息…');
    else if (!wasReady) status('');
    wasReady = session.ready;
  }
  q('form').onsubmit = async e => {
    e.preventDefault(); if (stopped || sending) return;
    const input = q('textarea'); const text = input.value; const target = selected;
    sending = true; render();
    try { await session.sendText(target, text); if (!stopped && input.value === text) input.value = ''; status(''); }
    catch (error) { status(error.message?.startsWith('请') || error.message?.startsWith('消息') ? error.message : '发送未确认，请先检查会话中的发送状态，避免重复发送。'); }
    finally { sending = false; render(); }
  };
  q('.create').onclick = async () => {
    if (stopped) return;
    const name = prompt('会话名称'); if (!name) return; const raw = prompt('邀请的 Matrix 用户 ID（逗号分隔，可留空）'); if (raw === null) return;
    try { const room = await session.createRoom(name, raw.split(',').map(s => s.trim()).filter(Boolean)); selected = room.room_id; status('会话已创建，正在同步。'); }
    catch { status('创建失败，请检查用户 ID、连接和服务器权限。'); }
  };
  const unsubscribe = session.subscribe(render); render();
  return { session, unmount() {
    if (stopped) return;
    stopped = true; unsubscribe(); if (!providedSession) session.dispose();
    q('form').onsubmit = null;
    for (const button of root.querySelectorAll('button')) button.onclick = null;
    host.remove();
  } };
}
