import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { ChatSession } from '../packages/chat-core/session.js';
function fixture() {
  let redacted = false; const event = { getId: () => '$own', getSender: () => '@me:localhost', getType: () => 'm.room.message', getContent: () => ({ body: 'hello', msgtype: 'm.text' }), getTs: () => 1, isRedacted: () => redacted };
  const room = { getMyMembership: () => 'join', getLiveTimeline: () => ({ getEvents: () => [event] }) };
  const client = new EventEmitter(); const calls = [];
  Object.assign(client, { getSyncState: () => 'PREPARED', getUserId: () => '@me:localhost', getRoom: id => id === '!room' ? room : null, redactEvent: async (...args) => { calls.push(args); return { event_id: '$redaction' }; } });
  return { client, room, event, calls, session: new ChatSession(client), markRedacted: () => { redacted = true; client.emit('Room.redaction'); } };
}
test('own-message redaction validates sender, sent event, membership and sync', async () => {
  const f = fixture();
  for (const change of [() => { f.event.getSender = () => '@other:localhost'; }, () => { f.event.getSender = () => '@me:localhost'; f.event.status = 'sending'; }, () => { f.event.status = null; f.event.getId = () => 'local'; }]) {
    change(); await assert.rejects(f.session.redact('!room', f.event.getId()));
  }
  f.event.getId = () => '$own'; f.room.getMyMembership = () => 'leave'; await assert.rejects(f.session.redact('!room', '$own'));
  f.room.getMyMembership = () => 'join'; f.client.emit('sync', 'ERROR'); await assert.rejects(f.session.redact('!room', '$own'));
  assert.equal(f.calls.length, 0); f.session.dispose();
});
test('redaction coalesces exact targets, keeps body until SDK event, then removes it from search', async () => {
  const f = fixture(); let finish; f.client.redactEvent = (...args) => { f.calls.push(args); return new Promise(resolve => { finish = resolve; }); };
  const a = f.session.redact('!room', '$own'); const b = f.session.redact('!room', '$own'); assert.equal(a, b); await Promise.resolve();
  assert.equal(f.calls.length, 1); assert.deepEqual(f.calls[0], ['!room', '$own']); assert.equal(f.session.messages('!room')[0].text, 'hello');
  finish({ event_id: '$redaction' }); await a; f.markRedacted();
  assert.equal(f.session.messages('!room')[0].text, '[消息已删除]'); assert.equal(f.session.messages('!room')[0].searchable, false); assert.equal(f.session.messages('!room')[0].canRedact, false);
  await assert.rejects(f.session.redact('!room', '$own')); f.session.dispose();
});
test('failed redaction can retry and disposal suppresses late updates without stopping host', async () => {
  const f = fixture(); f.client.redactEvent = async () => { throw new Error('network'); };
  await assert.rejects(f.session.redact('!room', '$own')); assert.equal(f.session.messages('!room')[0].redacting, false);
  let finish; f.client.redactEvent = () => new Promise(resolve => { finish = resolve; }); let updates = 0; f.session.subscribe(() => updates++);
  const pending = f.session.redact('!room', '$own'); await Promise.resolve(); f.session.dispose(); const count = updates; finish({ event_id: '$ok' }); await pending;
  assert.equal(updates, count); assert.equal(f.client.listenerCount('Room.redaction'), 0); await assert.rejects(f.session.redact('!room', '$own'));
});

test('failed echo cleanup matches only this request transaction and leaves host pending events intact', async () => {
  const f = fixture(); const cancelled = []; const owned = { getTxnId: () => 'owned-txn', getType: () => 'm.room.redaction', status: 'not_sent' };
  const unrelated = { getTxnId: () => 'host-txn', getType: () => 'm.room.redaction', status: 'not_sent' };
  f.client.makeTxnId = () => 'owned-txn'; f.client.cancelPendingEvent = event => cancelled.push(event);
  f.room.getPendingEvents = () => [unrelated, owned]; f.client.redactEvent = async (room, target, txn) => { assert.equal(txn, 'owned-txn'); throw new Error('network'); };
  await assert.rejects(f.session.redact('!room', '$own')); assert.deepEqual(cancelled, [owned]); f.session.dispose();
});

test('failure after unmount removes only the settled owned echo and allows a remounted panel to retry', async () => {
  const f = fixture(); let reject; let optimistic = false; let updates = 0;
  const own = { getTxnId: () => 'disposed-txn', getType: () => 'm.room.redaction', status: 'sending' };
  const host = { getTxnId: () => 'host-txn', getType: () => 'm.room.redaction', status: 'not_sent' };
  const cancelled = []; f.event.isRedacted = () => optimistic;
  f.client.makeTxnId = () => 'disposed-txn'; f.room.getPendingEvents = () => [host, own];
  f.client.cancelPendingEvent = event => { cancelled.push(event); if (event === own) optimistic = false; };
  f.client.redactEvent = () => { optimistic = true; return new Promise((resolve, fail) => { reject = fail; }); };
  f.session.subscribe(() => updates++);
  const pending = f.session.redact('!room', '$own'); await Promise.resolve();
  f.session.dispose(); const baseline = updates;
  assert.deepEqual(cancelled, [], 'unmount must not cancel an in-flight request');
  own.status = 'not_sent'; reject(Object.assign(new Error('denied after unmount'), { event: own }));
  await assert.rejects(pending, /denied/); assert.equal(updates, baseline);
  assert.deepEqual(cancelled, [own]);
  const reopened = new ChatSession(f.client); assert.equal(reopened.messages('!room')[0].canRedact, true);
  f.client.redactEvent = async () => ({ event_id: '$retry' }); await reopened.redact('!room', '$own'); reopened.dispose();
});
