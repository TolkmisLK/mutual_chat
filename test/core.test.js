import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
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
