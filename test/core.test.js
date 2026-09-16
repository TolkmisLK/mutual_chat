import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createClient, Room, MatrixEvent } from 'matrix-js-sdk';
import { ChatSession, validateHomeserver } from '../packages/chat-core/session.js';

function fake() {
  const client = new EventEmitter(); const sent = []; const created = [];
  const room = { roomId: '!one:example.org', name: 'One', getMyMembership: () => 'join', hasEncryptionStateEvent: () => true, getLiveTimeline: () => ({ getEvents: () => [] }) };
  Object.assign(client, { getRooms: () => [room], getRoom: id => id === room.roomId ? room : null, getUserId: () => '@me:example.org', getSyncState: () => 'PREPARED', getCrypto: () => ({}), sendTextMessage: async (...args) => { sent.push(args); }, createRoom: async options => { created.push(options); return { room_id: '!new:example.org' }; } });
  return { client, room, sent, created, session: new ChatSession(client) };
}
test('transport rejects insecure remote homeservers and embedded credentials', () => {
  assert.equal(validateHomeserver('https://example.org/'), 'https://example.org');
  assert.equal(validateHomeserver('http://127.0.0.1:8008'), 'http://127.0.0.1:8008');
  for (const value of ['http://example.org', 'https://user:pass@example.org', 'https://example.org/?token=x', 'ftp://localhost']) assert.throws(() => validateHomeserver(value));
});
test('sending requires sync, membership, valid text and initialized crypto', async () => {
  const { client, room, sent, session } = fake();
  client.emit('sync', 'ERROR'); await assert.rejects(session.sendText(room.roomId, 'hi')); client.emit('sync', 'SYNCING');
  await assert.rejects(session.sendText('!missing:example.org', 'hi')); await assert.rejects(session.sendText(room.roomId, ' '));
  client.getCrypto = () => null; await assert.rejects(session.sendText(room.roomId, 'hi')); assert.equal(sent.length, 0);
  client.getCrypto = () => ({}); await session.sendText(room.roomId, '<script>literal text</script>'); assert.equal(sent[0][1], '<script>literal text</script>');
});
test('new rooms are private and request standard Matrix encryption', async () => {
  const { session, created } = fake(); await session.createRoom('Team', ['@friend:example.org']);
  assert.equal(created[0].visibility, 'private'); assert.equal(created[0].initial_state[0].content.algorithm, 'm.megolm.v1.aes-sha2');
  await assert.rejects(session.createRoom('Team', ['not-a-user'])); assert.equal(created.length, 1);
});
test('mount lifecycle removes only its own subscriptions', () => {
  const { client, session } = fake(); let changes = 0; let hostEvents = 0;
  client.on('Room.timeline', () => hostEvents++); session.subscribe(() => changes++);
  client.emit('Room.timeline'); assert.equal(changes, 1); session.dispose(); client.emit('Room.timeline');
  assert.equal(changes, 1); assert.equal(hostEvents, 2); assert.equal(client.listenerCount('sync'), 0);
});
test('timeline is bounded and redacted/encrypted messages do not leak raw content', () => {
  const { room, session } = fake();
  room.getLiveTimeline = () => ({ getEvents: () => Array.from({ length: 250 }, (_, i) => ({ getType: () => 'm.room.encrypted', getId: () => String(i), getSender: () => '@other:example.org', isRedacted: () => i === 249, getContent: () => ({ body: 'hidden plaintext' }), getTs: () => 1 })) });
  const messages = session.messages(room.roomId); assert.equal(messages.length, 200); assert.equal(messages[0].id, '50'); assert.equal(messages.at(-1).text, '[消息已删除]'); assert.equal(messages.some(m => m.text.includes('hidden')), false);
});
test('SDK synthetic decryption failure stays a placeholder until keys arrive', () => {
  const { client, room, session } = fake(); let failed = true; let changes = 0;
  const event = { getType: () => 'm.room.message', getId: () => '$encrypted', getSender: () => '@other:example.org', isRedacted: () => false, isDecryptionFailure: () => failed, getContent: () => ({ body: failed ? '** Unable to decrypt: internal SDK failure **' : 'Recovered history' }), getTs: () => 1 };
  room.getLiveTimeline = () => ({ getEvents: () => [event] });
  session.subscribe(() => changes++);
  assert.equal(session.messages(room.roomId)[0].text, '[等待解密或缺少密钥]');
  failed = false; client.emit('Event.decrypted', event);
  assert.equal(changes, 1); assert.equal(session.messages(room.roomId)[0].text, 'Recovered history');
  session.dispose();
});

const historyEvent = i => ({ getType: () => 'm.room.message', getId: () => '$' + i, getSender: () => '@other:example.org', isRedacted: () => false, getContent: () => ({ body: 'History ' + i }), getTs: () => i });
test('cached history expands in pages, deduplicates IDs and bounds rendered messages', async () => {
  const { session, room, client } = fake(); const events = Array.from({ length: 1200 }, (_, i) => historyEvent(i));
  room.getLiveTimeline = () => ({ getEvents: () => [...events, events.at(-1)] }); room.oldState = { paginationToken: null };
  client.scrollback = () => { throw new Error('Cached history must not request the server'); };
  assert.equal(session.messages(room.roomId).length, 200);
  await session.loadEarlier(room.roomId); assert.equal(session.messages(room.roomId).length, 250);
  for (let i = 0; i < 30; i++) await session.loadEarlier(room.roomId);
  assert.equal(session.messages(room.roomId).length, 1000);
  assert.deepEqual(session.historyState(room.roomId), { loading: false, canLoad: false, capped: true });
  assert.equal(new Set(session.messages(room.roomId).map(m => m.id)).size, 1000);
});
test('one room shares pending pagination and server exhaustion stops new requests', async () => {
  const { session, room, client } = fake(); let calls = 0; let finish; const events = [historyEvent(1)];
  room.getLiveTimeline = () => ({ getEvents: () => events }); room.oldState = { paginationToken: 'previous' };
  client.scrollback = async (target, limit) => { assert.equal(target, room); assert.equal(limit, 50); calls++; await new Promise(resolve => { finish = resolve; }); events.unshift(historyEvent(0)); room.oldState.paginationToken = null; };
  const first = session.loadEarlier(room.roomId); const second = session.loadEarlier(room.roomId); assert.equal(first, second);
  assert.equal(session.historyState(room.roomId).loading, true); await Promise.resolve(); assert.equal(calls, 1);
  finish(); await first;
  assert.deepEqual(session.messages(room.roomId).map(m => m.id), ['$0', '$1']);
  assert.equal(session.historyState(room.roomId).canLoad, false); await session.loadEarlier(room.roomId); assert.equal(calls, 1);
});
test('failed pagination is retryable and disposed adapters ignore pending completion', async () => {
  const { session, room, client } = fake(); room.oldState = { paginationToken: 'previous' }; let calls = 0; let finish; let changes = 0;
  session.subscribe(() => changes++);
  client.scrollback = async () => { if (++calls === 1) throw new Error('network fixture failure'); await new Promise(resolve => { finish = resolve; }); };
  await assert.rejects(session.loadEarlier(room.roomId), /network/); assert.equal(session.historyState(room.roomId).loading, false);
  const pending = session.loadEarlier(room.roomId); await Promise.resolve(); assert.equal(calls, 2);
  session.dispose(); const baseline = changes; finish(); await pending; assert.equal(changes, baseline);
  assert.equal(session.historyState(room.roomId).canLoad, false); await assert.rejects(session.loadEarlier(room.roomId));
  assert.equal(client.listenerCount('Room.timeline'), 0);
});

test('unread notifications are SDK-derived and receipt subscriptions detach', () => {
  const { client, room, session } = fake(); let count = 3; let updates = 0;
  room.getUnreadNotificationCount = type => { assert.equal(type, 'total'); return count; };
  session.subscribe(() => updates++); assert.equal(session.rooms()[0].unread, 3);
  for (const invalid of [-1, Infinity, NaN, '2']) { count = invalid; assert.equal(session.rooms()[0].unread, 0); }
  client.emit('Room.UnreadNotifications'); client.emit('Room.receipt'); assert.equal(updates, 2);
  session.dispose(); assert.equal(client.listenerCount('Room.receipt'), 0); assert.equal(client.listenerCount('Room.UnreadNotifications'), 0);
});

test('real SDK receipts reconcile encrypted totals only after server confirmation, preserving newer arrivals', () => {
  const userId = '@me:example.org'; const roomId = '!read:example.org';
  const client = createClient({ baseUrl: 'https://example.org', userId });
  const room = new Room(roomId, client, userId);
  client.getRooms = () => [room]; client.getRoom = () => room;
  room.hasEncryptionStateEvent = () => true; room.getMyMembership = () => 'join';
  client.getPushActionsForEvent = event => ({ notify: event.getContent().msgtype !== 'm.notice', tweaks: {} });
  const event = (id, msgtype = 'm.text') => new MatrixEvent({ event_id: id, room_id: roomId, sender: '@other:example.org', type: 'm.room.message', origin_server_ts: 1, content: { msgtype, body: id } });
  const first = event('$first'); const second = event('$second');
  room.addLiveEvents([first, second], { addToState: false }); room.setUnreadNotificationCount('total', 2);
  const session = new ChatSession(client);
  room.addLocalEchoReceipt(userId, first, 'm.read.private', true);
  assert.equal(session.rooms()[0].unread, 2, 'aborted/held HTTP receipt cannot clear notifications');
  const acknowledge = target => room.addReceipt(new MatrixEvent({ type: 'm.receipt', room_id: roomId, content: { [target]: { 'm.read.private': { [userId]: { ts: 2 } } } } }));
  acknowledge('$first');
  assert.equal(room.getUnreadNotificationCount('total'), 2, 'locked SDK reproduces stale total');
  assert.equal(session.rooms()[0].unread, 1);
  room.addLiveEvents([event('$notice', 'm.notice'), event('$third')], { addToState: false });
  assert.equal(session.rooms()[0].unread, 2, 'count SDK push actions, not every timeline event');
  acknowledge('$third'); assert.equal(session.rooms()[0].unread, 0);
  assert.equal(room.getUnreadNotificationCount('total'), 2, 'adapter never mutates host counters'); session.dispose();
});

test('unread reconciliation preserves SDK count for incomplete, encrypted or threaded suffixes', () => {
  const { client, room, session } = fake(); let events = [historyEvent(1), historyEvent(2)];
  room.getUnreadNotificationCount = () => 7; room.getLiveTimeline = () => ({ getEvents: () => events });
  client.getPushActionsForEvent = () => ({ notify: true });
  room.getEventReadUpTo = (user, ignore) => { assert.equal(ignore, true); return '$1'; };
  room.getReadReceiptForUserId = (user, ignore, type) => { assert.equal(ignore, true); return type === 'm.read.private' ? { eventId: '$1', data: {} } : null; };
  assert.equal(session.rooms()[0].unread, 1);
  events = [historyEvent(2)]; assert.equal(session.rooms()[0].unread, 7);
  events = [historyEvent(1), historyEvent(2)]; events[1].isDecryptionFailure = () => true; assert.equal(session.rooms()[0].unread, 7);
  events[1] = historyEvent(2); events[1].getType = () => 'm.room.encrypted'; assert.equal(session.rooms()[0].unread, 7);
  events[1] = historyEvent(2); events[1].threadRootId = '$thread'; assert.equal(session.rooms()[0].unread, 7);
  events[1] = historyEvent(2); room.getThreads = () => [{}]; assert.equal(session.rooms()[0].unread, 7);
  room.getThreads = () => []; client.getPushActionsForEvent = () => undefined; assert.equal(session.rooms()[0].unread, 7);
  client.getPushActionsForEvent = () => ({ notify: true }); events.push(events[1]); assert.equal(session.rooms()[0].unread, 1);
  events = Array.from({ length: 1002 }, (_, i) => historyEvent(i + 1)); assert.equal(session.rooms()[0].unread, 7);
  session.dispose();
});

test('explicit private receipt captures event and coalesces concurrent requests without touching newer arrivals', async () => {
  const { client, room, session } = fake(); const events = [historyEvent(1)]; let finish; const calls = [];
  room.getLiveTimeline = () => ({ getEvents: () => events });
  client.sendReadReceipt = (...args) => { calls.push(args); return new Promise(resolve => { finish = resolve; }); };
  assert.deepEqual(session.readState(room.roomId), { eventId: '$1', loading: false }); assert.equal(calls.length, 0);
  const pending = session.markRead(room.roomId, '$1'); events.push(historyEvent(2));
  assert.equal(session.markRead(room.roomId, '$2'), pending); await Promise.resolve();
  assert.deepEqual(calls[0], [events[0], 'm.read.private', true]); assert.equal(session.readState(room.roomId).loading, true);
  finish(); await pending; assert.equal(session.readState(room.roomId).loading, false); assert.equal(session.readState(room.roomId).eventId, '$2'); assert.equal(calls.length, 1);
});

test('private receipt rejects invalid targets, retries failure, and does not fall back to public receipts', async () => {
  const { client, room, session } = fake(); const event = historyEvent(1); let failed = true; let calls = 0;
  room.getLiveTimeline = () => ({ getEvents: () => [event] }); client.sendReadReceipt = async (target, type) => { calls++; assert.equal(type, 'm.read.private'); if (failed) throw Error('unsupported private receipt'); };
  await assert.rejects(session.markRead('!missing', '$1')); await assert.rejects(session.markRead(room.roomId, '$unknown'));
  event.isDecryptionFailure = () => true; assert.equal(session.readState(room.roomId).eventId, null); await assert.rejects(session.markRead(room.roomId, '$1'));
  event.isDecryptionFailure = () => false; event.status = 'sending'; await assert.rejects(session.markRead(room.roomId, '$1'));
  event.status = null; event.getSender = () => client.getUserId(); await assert.rejects(session.markRead(room.roomId, '$1'));
  event.getSender = () => '@other:example.org'; client.emit('sync', 'ERROR'); await assert.rejects(session.markRead(room.roomId, '$1')); client.emit('sync', 'SYNCING');
  assert.equal(calls, 0); await assert.rejects(session.markRead(room.roomId, '$1'), /unsupported/); assert.equal(calls, 1); assert.equal(session.readState(room.roomId).loading, false);
  failed = false; await session.markRead(room.roomId, '$1'); assert.equal(calls, 2);
});

test('disposing receipt adapter suppresses late callbacks without stopping host client', async () => {
  const { client, room, session } = fake(); const event = historyEvent(1); let finish; let updates = 0;
  room.getLiveTimeline = () => ({ getEvents: () => [event] }); client.sendReadReceipt = () => new Promise(resolve => { finish = resolve; });
  client.stopClient = () => { throw Error('host ownership'); }; session.subscribe(() => updates++);
  const request = session.markRead(room.roomId, '$1'); await Promise.resolve(); session.dispose(); const before = updates;
  finish(); await request; assert.equal(updates, before); await assert.rejects(session.markRead(room.roomId, '$1'));
});
