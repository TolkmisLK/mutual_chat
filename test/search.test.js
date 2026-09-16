import test from 'node:test';
import assert from 'node:assert/strict';
import { searchLoadedMessages } from '../packages/chat-core/search.js';
import { ChatSession } from '../packages/chat-core/session.js';

test('session search includes only textual message types, not attachment filenames', () => {
  const types = ['m.text', 'm.notice', 'm.emote', 'm.image', 'm.file', 'm.audio', 'm.video', 'm.location', undefined];
  const events = types.map((msgtype, i) => ({ getId: () => '$' + i, getSender: () => '@other:localhost', getTs: () => i,
    getType: () => 'm.room.message', getContent: () => ({ msgtype, body: 'needle' }), isRedacted: () => false }));
  const client = { on() {}, removeListener() {}, getUserId: () => '@me:localhost', getRoom: () => ({ getMyMembership: () => 'join', getLiveTimeline: () => ({ getEvents: () => events }) }) };
  const session = new ChatSession(client);
  try { assert.deepEqual(searchLoadedMessages(session.messages('!room'), 'needle'), ['$0', '$1', '$2']); }
  finally { session.dispose(); }
});

test('local search matches literal Unicode text, case-insensitively, without interpreting patterns', () => {
  const messages = [{ id: '$1', text: '你好 CAFÉ [a.*] <script>' }, { id: '$2', text: 'Cafe\u0301 第二条' }];
  assert.deepEqual(searchLoadedMessages(messages, ' cafe\u0301 '), ['$1', '$2']);
  assert.deepEqual(searchLoadedMessages(messages, '[a.*]'), ['$1']);
  assert.deepEqual(searchLoadedMessages(messages, '<script>'), ['$1']);
  assert.deepEqual(searchLoadedMessages(messages, '.*你好'), []);
});

test('search excludes unavailable/redacted bodies, invalid IDs and duplicate events', () => {
  const messages = [{ id: '$1', text: 'secret', searchable: false }, { id: '$2', text: 'secret' }, { id: '$2', text: 'secret' }, { text: 'secret' }, { id: '$3', text: null }];
  assert.deepEqual(searchLoadedMessages(messages, 'secret'), ['$2']);
});

test('search is bounded, side-effect free, and rejects empty or oversized queries', () => {
  const messages = Object.freeze(Array.from({ length: 1001 }, (_, i) => Object.freeze({ id: '$' + i, text: 'fixture' })));
  assert.equal(searchLoadedMessages(messages, 'fixture').length, 1000); assert.equal(searchLoadedMessages(messages, 'fixture')[0], '$1');
  for (const query of ['', '   ', null, 'a'.repeat(201)]) assert.deepEqual(searchLoadedMessages(messages, query), []);
  assert.deepEqual(searchLoadedMessages(null, 'fixture'), []);
});
