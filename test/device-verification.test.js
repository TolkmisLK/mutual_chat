import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { DeviceVerification } from '../src/device-verification.js';
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const client = new EventEmitter(), request = new EventEmitter(), verifier = new EventEmitter();
  const counts = { accepts: 0, starts: 0, confirms: 0, mismatches: 0, cancels: 0, verifies: 0, requests: 0 };
  let done;
  const result = new Promise(resolve => { done = resolve; });
  const sas = { sas: { decimal: [1234, 5678, 9012] }, confirm: async () => { counts.confirms++; }, mismatch: () => { counts.mismatches++; } };
  Object.assign(verifier, { verify: () => { counts.verifies++; return result; }, getShowSasCallbacks: () => sas });
  Object.assign(request, { otherUserId: '@me:local', otherDeviceId: 'B', roomId: undefined, initiatedByMe: true, phase: 2, pending: true,
    accept: async () => { counts.accepts++; request.phase = 3; request.emit('change'); },
    otherPartySupportsMethod: method => method === 'm.sas.v1',
    startVerification: async () => { counts.starts++; request.phase = 4; request.chosenMethod = 'm.sas.v1'; request.verifier = verifier; request.emit('change'); return verifier; },
    cancel: async () => { counts.cancels++; request.pending = false; request.phase = 5; request.emit('change'); },
  });
  const crypto = { userHasCrossSigningKeys: async () => false, getUserDeviceInfo: async () => {}, requestDeviceVerification: async () => { counts.requests++; return request; }, getDeviceVerificationStatus: async () => ({ localVerified: true }) };
  Object.assign(client, { getUserId: () => '@me:local', getDeviceId: () => 'A', getDevices: async () => ({ devices: [{ device_id: 'A' }, { device_id: 'B' }] }), getCrypto: () => crypto });
  const controller = new DeviceVerification(client);
  return { client, controller, request, verifier, sas, crypto, counts, done };
}
test('SAS only targets listed own other devices; receiving never accepts or confirms automatically', async () => {
  const f = fixture();
  await assert.rejects(f.controller.begin('A')); await assert.rejects(f.controller.begin('missing')); assert.equal(f.counts.requests, 0);
  for (const change of [{ otherUserId: '@stranger:local' }, { otherDeviceId: 'A' }, { roomId: '!room:local' }]) {
    f.client.emit('crypto.verificationRequestReceived', { ...f.request, ...change }); assert.equal(f.controller.request, null);
  }
  f.request.initiatedByMe = false; f.client.emit('crypto.verificationRequestReceived', f.request);
  assert.equal(f.controller.snapshot().incoming, true); assert.equal(f.counts.accepts, 0); assert.equal(f.counts.confirms, 0);
  await f.controller.accept(); assert.equal(f.counts.accepts, 1);
  await f.controller.start(); await tick(); assert.equal(f.counts.verifies, 1); assert.equal(f.counts.confirms, 0);
  assert.deepEqual(f.controller.snapshot().decimal, [1234, 5678, 9012]); f.controller.dispose();
});
test('confirmation queues a MAC but success waits for SDK completion and local device verification', async () => {
  const f = fixture(); await f.controller.begin('B'); f.request.phase = 3; await f.controller.start(); await tick();
  await f.controller.match(); assert.equal(f.counts.confirms, 1); assert.equal(f.controller.verified, false);
  await assert.rejects(f.controller.match());
  f.request.phase = 6; f.request.pending = false; f.done(); await tick(); assert.equal(f.controller.verified, true); f.controller.dispose();
  const untrusted = fixture(); await untrusted.controller.begin('B'); untrusted.request.phase = 3; await untrusted.controller.start(); await tick();
  untrusted.crypto.getDeviceVerificationStatus = async () => ({ localVerified: false }); await untrusted.controller.match();
  untrusted.request.phase = 6; untrusted.done(); await tick(); assert.equal(untrusted.controller.verified, false); untrusted.controller.dispose();
});
test('mismatch, cancellation and disposal cannot reuse stale SAS controls or listeners', async () => {
  const f = fixture(); await f.controller.begin('B'); f.request.phase = 3; await f.controller.start(); await tick();
  await f.controller.cancel(true); assert.equal(f.counts.mismatches, 1); assert.equal(f.counts.confirms, 0);
  await assert.rejects(f.controller.match()); f.verifier.emit('show_sas', f.sas); assert.equal(f.controller.sas, null);
  assert.equal(f.request.listenerCount('change'), 0); assert.equal(f.verifier.listenerCount('show_sas'), 0);
  f.controller.dispose(); f.controller.dispose(); assert.equal(f.client.listenerCount('crypto.verificationRequestReceived'), 0);
});
test('a request sent before disposal is cancelled when its delayed result arrives', async () => {
  const f = fixture(); let deliver;
  f.crypto.requestDeviceVerification = () => new Promise(resolve => { deliver = resolve; });
  const pending = f.controller.begin('B'); await tick(); f.controller.dispose(); deliver(f.request); await pending;
  assert.equal(f.counts.cancels, 1); assert.equal(f.controller.request, null);
});
test('closing during a pending request cancels its delayed result instead of reopening a flow', async () => {
  const f = fixture(); let deliver;
  f.crypto.requestDeviceVerification = () => new Promise(resolve => { deliver = resolve; });
  const pending = f.controller.begin('B'); await tick(); await f.controller.cancel(); deliver(f.request); await pending;
  assert.equal(f.counts.cancels, 1); assert.equal(f.controller.request, null); f.controller.dispose();
});
test('changed target and malformed SAS cannot authorize a confirmation', async () => {
  const f = fixture(); await f.controller.begin('B'); f.request.phase = 3; await f.controller.start(); await tick();
  f.sas.sas.decimal = [1, NaN, 2]; f.verifier.emit('show_sas'); await assert.rejects(f.controller.match());
  f.sas.sas.decimal = [1234, 5678, 9012]; f.request.otherDeviceId = 'C'; f.request.emit('change'); await assert.rejects(f.controller.match());
  assert.equal(f.counts.confirms, 0); f.controller.dispose();
});
test('fresh own key query precedes verification without requiring or creating cross-signing keys', async () => {
  const f = fixture(), calls = [];
  f.crypto.userHasCrossSigningKeys = async (user, download) => { assert.equal(user, '@me:local'); assert.equal(download, true); calls.push('refresh'); return false; };
  f.crypto.getUserDeviceInfo = async () => { calls.push('devices'); };
  f.crypto.requestDeviceVerification = async () => { calls.push('request'); return f.request; };
  await f.controller.begin('B'); assert.deepEqual(calls, ['refresh', 'devices', 'request']); f.controller.dispose();
  const g = fixture(); let finish;
  g.crypto.userHasCrossSigningKeys = () => new Promise(resolve => { finish = resolve; });
  const pending = g.controller.begin('B'); await tick(); await g.controller.cancel(); finish(false); await pending;
  assert.equal(g.counts.requests, 0); g.controller.dispose();
});
test('outgoing Requested flow retains its explicit target until SDK supplies the accepting device', async () => {
  const f = fixture(); f.request.otherDeviceId = undefined;
  f.client.emit('crypto.verificationRequestReceived', f.request); assert.equal(f.controller.request, null);
  await f.controller.begin('B'); assert.equal(f.controller.snapshot().deviceId, 'B'); assert.equal(f.counts.cancels, 0);
  f.request.otherDeviceId = 'C'; f.request.phase = 3; f.request.emit('change');
  assert.equal(f.controller.snapshot().message, '设备身份改变，核对已停止。');
  await assert.rejects(f.controller.start()); assert.equal(f.counts.starts, 0);
  await assert.rejects(f.controller.match()); f.controller.dispose();
  const g = fixture(); g.request.otherDeviceId = undefined; await g.controller.begin('B');
  g.request.otherDeviceId = 'B'; g.request.phase = 3; g.request.emit('change');
  await g.controller.start(); await tick(); assert.deepEqual(g.controller.snapshot().decimal, [1234, 5678, 9012]); g.controller.dispose();
});
