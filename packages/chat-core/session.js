/** Framework-neutral boundary around one host-owned Matrix SDK client. */
export class ChatSession {
  constructor(client) {
    this.client = client; this.listeners = new Set(); this.ready = false; this.closed = false;
    this.history = new Map(); this.reading = new Map(); this.redacting = new Map();
    this.changed = () => { for (const fn of this.listeners) fn(); };
    this.sync = state => { this.ready = ['PREPARED', 'SYNCING'].includes(state); this.changed(); };
    this.bindings = [['sync', this.sync], ['Room.timeline', this.changed], ['Room.redaction', this.changed], ['Room.redactionCancelled', this.changed], ['Room', this.changed], ['Event.decrypted', this.changed], ['Room.name', this.changed], ['Room.myMembership', this.changed], ['Room.UnreadNotifications', this.changed], ['Room.receipt', this.changed]];
    for (const [event, fn] of this.bindings) client.on(event, fn);
    this.ready = ['PREPARED', 'SYNCING'].includes(client.getSyncState?.());
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  rooms() {
    return this.client.getRooms().filter(r => ['join', 'invite'].includes(r.getMyMembership())).map(r => {
      const count = this.unreadCount(r);
      return { id: r.roomId, name: r.name || r.roomId, membership: r.getMyMembership(), encrypted: r.hasEncryptionStateEvent(), unread: Number.isSafeInteger(count) && count > 0 ? count : 0 };
    });
  }
  unreadCount(room) {
    const fallback = room.getUnreadNotificationCount?.('total');
    // SDK 42.3 ignores non-zero server totals in encrypted rooms, but receipts
    // recalculate only highlights. Derive a total only when the confirmed read
    // boundary and the entire decrypted suffix are available. Never change the
    // host's SDK counters or treat its optimistic receipt echo as confirmation.
    if (!room.hasEncryptionStateEvent() || !this.client.getPushActionsForEvent || room.getThreads?.().length) return fallback;
    const userId = this.client.getUserId();
    const boundary = room.getEventReadUpTo?.(userId, true);
    if (!boundary) return fallback;
    const receipt = ['m.read.private', 'm.read'].map(type => room.getReadReceiptForUserId?.(userId, true, type))
      .find(value => value?.eventId === boundary && value.data?.thread_id === undefined);
    if (!receipt) return fallback;
    const events = room.getLiveTimeline().getEvents();
    const start = events.findLastIndex(event => event.getId() === boundary);
    if (start < 0 || events.length - start > 1000) return fallback;
    const seen = new Set(); let count = 0;
    for (const event of events.slice(start + 1)) {
      const id = event.getId();
      if (event.threadRootId) return fallback;
      if (event.status || event.getSender() === userId || event.isRedacted?.()) continue;
      if (!id || event.isDecryptionFailure?.() || event.getType() === 'm.room.encrypted') return fallback;
      if (seen.has(id)) continue;
      seen.add(id);
      const actions = this.client.getPushActionsForEvent(event);
      if (!actions) return fallback;
      if (actions.notify) count++;
    }
    return count;
  }
  readState(roomId) {
    const room = this.client.getRoom(roomId);
    const latest = room?.getMyMembership() === 'join' ? this.messageEvents(room).findLast(e => e.getSender() !== this.client.getUserId() && !e.status && e.getId()?.startsWith('$')) : null;
    // Never mark a missing-key placeholder as read. The UI captures this exact
    // displayed event ID: a newer arrival cannot silently extend the request.
    const eventId = latest && !latest.isDecryptionFailure?.() && latest.getType() !== 'm.room.encrypted' ? latest.getId() : null;
    return { eventId, loading: this.reading.has(roomId) };
  }
  markRead(roomId, eventId) {
    if (this.closed || !this.ready) return Promise.reject(new Error('请等待聊天同步完成后重试。'));
    const pending = this.reading.get(roomId); if (pending) return pending;
    const room = this.client.getRoom(roomId);
    const event = room?.getMyMembership() === 'join' ? this.messageEvents(room).find(e => e.getId() === eventId) : null;
    if (!event || !eventId?.startsWith('$') || event.status || event.getSender() === this.client.getUserId() || event.isDecryptionFailure?.() || event.getType() === 'm.room.encrypted') return Promise.reject(new Error('请先选择已解密的已接收消息。'));
    const request = Promise.resolve().then(() => {
      if (this.closed) return;
      // Private, room-wide receipt. No public receipt or fully-read account
      // marker, no automatic fallback if the server rejects this receipt type.
      return this.client.sendReadReceipt(event, 'm.read.private', true);
    }).finally(() => { this.reading.delete(roomId); if (!this.closed) this.changed(); });
    this.reading.set(roomId, request); this.changed(); return request;
  }
  messages(roomId) {
    const room = this.client.getRoom(roomId);
    if (!room || room.getMyMembership() !== 'join') return [];
    return this.messageEvents(room).slice(-(this.history.get(roomId)?.limit || 200)).map(e => ({
      id: e.getId(), sender: e.getSender(), mine: e.getSender() === this.client.getUserId(),
      canRedact: this.canRedact(e), redacting: this.redacting.has(roomId + '\0' + e.getId()),
      searchable: !e.isRedacted() && !e.isDecryptionFailure?.() && e.getType() === 'm.room.message' && ['m.text', 'm.notice', 'm.emote'].includes(e.getContent().msgtype) && typeof e.getContent().body === 'string',
      text: e.isRedacted() ? '[消息已删除]' : (e.isDecryptionFailure?.() || e.getType() === 'm.room.encrypted') ? '[等待解密或缺少密钥]' : typeof e.getContent().body === 'string' ? e.getContent().body : '[暂不支持的消息]',
      time: e.getTs(), status: e.status || 'sent',
    }));
  }
  messageEvents(room) {
    const seen = new Set();
    return room.getLiveTimeline().getEvents().filter(event => {
      if (!['m.room.message', 'm.room.encrypted'].includes(event.getType())) return false;
      const id = event.getId(); if (id && seen.has(id)) return false;
      if (id) seen.add(id); return true;
    });
  }
  canRedact(event) {
    return !this.closed && !event.isRedacted() && !event.status && event.getId()?.startsWith('$') && event.getSender() === this.client.getUserId();
  }
  redact(roomId, eventId) {
    if (this.closed || !this.ready) return Promise.reject(new Error('连接尚未就绪。'));
    const room = this.client.getRoom(roomId);
    const event = room?.getMyMembership() === 'join' ? this.messageEvents(room).find(e => e.getId() === eventId) : null;
    if (!event || !this.canRedact(event)) return Promise.reject(new Error('只能撤回自己已发送的消息。'));
    const key = roomId + '\0' + eventId;
    if (this.redacting.has(key)) return this.redacting.get(key);
    const txn = this.client.makeTxnId?.();
    const request = Promise.resolve().then(() => {
      if (this.closed) return;
      // SDK owns transaction IDs and local echo. Do not erase client state on
      // an ambiguous response; the server's redaction event is authoritative.
      return txn ? this.client.redactEvent(roomId, eventId, txn) : this.client.redactEvent(roomId, eventId);
    }).catch(error => {
      // Release only this adapter's failed local echo, never another host send.
      // A remote redaction may still arrive after an ambiguous network failure.
      // The host client outlives this adapter. Settle our failed echo even if
      // its panel unmounted while the request was pending; suppress only UI
      // notifications on disposal, never leave an unconfirmed deletion behind.
      if (txn) {
        let pending = [];
        try { pending = room.getPendingEvents?.() || []; } catch { /* chronological SDK ordering */ }
        const own = [error.event, ...pending, ...room.getLiveTimeline().getEvents()].find(e => e?.getTxnId?.() === txn && e.getType() === 'm.room.redaction' && e.status === 'not_sent');
        if (own) { try { this.client.cancelPendingEvent(own); } catch { /* host may already have updated it */ } }
      }
      throw error;
    }).finally(() => { this.redacting.delete(key); if (!this.closed) this.changed(); });
    this.redacting.set(key, request); this.changed(); return request;
  }
  historyState(roomId) {
    const room = this.client.getRoom(roomId); const state = this.history.get(roomId);
    const limit = state?.limit || 200; const capped = limit >= 1000;
    const canLoad = !this.closed && !capped && room?.getMyMembership() === 'join' &&
      (this.messageEvents(room).length > limit || room.oldState?.paginationToken != null);
    return { loading: Boolean(state?.pending), canLoad: Boolean(canLoad), capped };
  }
  loadEarlier(roomId) {
    if (this.closed || !this.ready) return Promise.reject(new Error('请等待聊天同步完成后重试。'));
    const room = this.client.getRoom(roomId);
    if (!room || room.getMyMembership() !== 'join') return Promise.reject(new Error('请先加入会话。'));
    let state = this.history.get(roomId);
    if (state?.pending) return state.pending;
    if (!this.historyState(roomId).canLoad) return Promise.resolve();
    if (!state) { state = { limit: 200, pending: null }; this.history.set(roomId, state); }
    const limit = Math.min(state.limit + 50, 1000);
    // One explicit page per action. Never loop automatically through state-only
    // pages or modify the SDK client's request ownership on panel unmount.
    state.pending = Promise.resolve().then(async () => {
      if (this.closed) return;
      if (this.messageEvents(room).length <= state.limit && room.oldState?.paginationToken != null) await this.client.scrollback(room, 50);
      if (!this.closed && this.messageEvents(room).length > state.limit) state.limit = limit;
    }).finally(() => { state.pending = null; if (!this.closed) this.changed(); });
    this.changed(); return state.pending;
  }
  async sendText(roomId, text) {
    if (!this.ready) throw new Error('同步尚未完成，请稍后发送。');
    const room = this.client.getRoom(roomId);
    if (!room || room.getMyMembership() !== 'join') throw new Error('请先加入会话。');
    if (typeof text !== 'string' || !text.trim() || text.length > 10000) throw new Error('消息需为 1–10000 个字符。');
    if (!this.client.getCrypto()) throw new Error('加密模块尚未就绪，无法发送。');
    // SDK owns local echo, transaction IDs, retry queue and encryption.
    return this.client.sendTextMessage(roomId, text);
  }
  async createRoom(name, invites = []) {
    if (!this.ready || !this.client.getCrypto()) throw new Error('连接或加密模块尚未就绪。');
    if (!name.trim() || name.length > 100 || invites.some(id => !/^@[^\s:]+:[^\s]+$/.test(id))) throw new Error('请填写会话名称和有效的 Matrix 用户 ID。');
    return this.client.createRoom({ name: name.trim(), visibility: 'private', preset: 'private_chat', invite: invites,
      initial_state: [{ type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } }] });
  }
  async join(roomId) {
    if (this.client.getRoom(roomId)?.getMyMembership() !== 'invite') throw new Error('未找到邀请。');
    return this.client.joinRoom(roomId);
  }
  dispose() {
    if (this.closed) return; this.closed = true; this.ready = false; this.history.clear(); this.reading.clear(); this.redacting.clear();
    for (const [event, fn] of this.bindings) this.client.removeListener(event, fn);
    this.listeners.clear();
    // Ownership remains with the host: unmounting an embedded panel never logs it out.
  }
}

export function validateHomeserver(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) throw new Error('服务器地址不能包含凭据、查询参数或片段。');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('服务器必须使用 HTTPS；本机开发可使用 HTTP。');
  return url.href.replace(/\/$/, '');
}
