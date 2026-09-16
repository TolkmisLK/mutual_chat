import test from 'node:test';
import assert from 'node:assert/strict';
import { searchLoadedMessages } from '../packages/chat-core/search.js';

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
