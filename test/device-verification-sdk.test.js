import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@matrix-org/matrix-sdk-crypto-wasm';

// Real SDK request shape, with generated in-memory keys and simulated HTTP
// responses. This is NOT the separate real Synapse/browser acceptance gate.
test('Rust device-targeted request omits accepting device ID until a response', async () => {
  await wasm.initAsync(); const user = '@fixture:localhost', machines = [];
  try {
    for (const id of ['A', 'B']) machines.push(await wasm.OlmMachine.initialize(new wasm.UserId(user), new wasm.DeviceId(id)));
    const keys = {};
    for (const machine of machines) {
      const upload = (await machine.outgoingRequests()).find(r => r.type === wasm.RequestType.KeysUpload);
      const body = JSON.parse(upload.body); keys[body.device_keys.device_id] = body.device_keys;
      await machine.markRequestAsSent(upload.id, upload.type, JSON.stringify({ one_time_key_counts: { signed_curve25519: 50 } }));
    }
    const query = machines[0].queryKeysForUsers([new wasm.UserId(user)]);
    await machines[0].markRequestAsSent(query.id, query.type, JSON.stringify({ device_keys: { [user]: keys }, failures: {} }));
    const device = await machines[0].getDevice(new wasm.UserId(user), new wasm.DeviceId('B'));
    try {
      const [request, outgoing] = device.requestVerification([wasm.VerificationMethod.SasV1]);
      try {
        assert.equal(request.otherDeviceId, undefined); assert.equal(request.weStarted(), true);
        assert.equal(request.phase(), wasm.VerificationRequestPhase.Created);
        assert.deepEqual(Object.keys(JSON.parse(outgoing.body).messages[user]), ['B']);
      } finally { request.free(); outgoing.free(); }
    } finally { device.free(); }
  } finally { for (const machine of machines) machine.close(); }
});

test('real in-memory Rust SAS only trusts after both confirmations and done exchange', async () => {
  await wasm.initAsync(); const user = '@sas:localhost', machines = [], keys = {};
  const id = value => new wasm.UserId(value);
  try {
    for (const name of ['A', 'B']) machines.push(await wasm.OlmMachine.initialize(id(user), new wasm.DeviceId(name)));
    for (const machine of machines) {
      const upload = (await machine.outgoingRequests()).find(r => r.type === wasm.RequestType.KeysUpload);
      const body = JSON.parse(upload.body); keys[body.device_keys.device_id] = body.device_keys;
      await machine.markRequestAsSent(upload.id, upload.type, JSON.stringify({ one_time_key_counts: { signed_curve25519: 50 } }));
    }
    for (const machine of machines) {
      const query = machine.queryKeysForUsers([id(user)]);
      await machine.markRequestAsSent(query.id, query.type, JSON.stringify({ device_keys: { [user]: keys }, failures: {} }));
    }
    async function deliver(from, request) {
      if (!request) return;
      const to = 1 - from, name = to ? 'B' : 'A';
      const content = JSON.parse(request.body).messages[user][name];
      await machines[from].markRequestAsSent(request.id, request.type, '{}');
      await machines[to].receiveSyncChanges(JSON.stringify([{ sender: user, type: request.event_type, content }]), new wasm.DeviceLists(), new Map());
    }
    async function drain() {
      for (let turn = 0; turn < 20; turn++) {
        let sent = false;
        for (const from of [0, 1]) for (const request of await machines[from].outgoingRequests()) {
          if (request.type === wasm.RequestType.ToDevice) { await deliver(from, request); sent = true; }
        }
        if (!sent) return;
      }
      assert.fail('SAS fixture transport did not settle');
    }
    const device = await machines[0].getDevice(id(user), new wasm.DeviceId('B'));
    const [a, outgoing] = device.requestVerification([wasm.VerificationMethod.SasV1]);
    await deliver(0, outgoing);
    const b = machines[1].getVerificationRequest(id(user), a.flowId);
    await deliver(1, b.acceptWithMethods([wasm.VerificationMethod.SasV1]));
    const [sasA, start] = await a.startSas(); await deliver(0, start);
    const sasB = b.getVerification(); await deliver(1, sasB.accept()); await drain();
    assert.deepEqual([...sasA.decimals()], [...sasB.decimals()]);
    for (const request of await sasA.confirm()) await deliver(0, request);
    await drain(); assert.equal(sasA.isDone(), false);
    for (const request of await sasB.confirm()) await deliver(1, request);
    await drain();
    assert.equal(sasA.isDone(), true); assert.equal(sasB.isDone(), true);
    assert.equal(a.phase(), wasm.VerificationRequestPhase.Done); assert.equal(b.phase(), wasm.VerificationRequestPhase.Done);
    assert.equal(a.otherDeviceId, undefined); assert.equal(b.otherDeviceId, undefined);
    for (const [index, name] of [[0, 'B'], [1, 'A']]) {
      const verified = await machines[index].getDevice(id(user), new wasm.DeviceId(name));
      assert.equal(verified.isLocallyTrusted(), true); verified.free();
    }
    sasA.free(); sasB.free(); a.free(); b.free(); device.free(); outgoing.free();
  } finally { for (const machine of machines) machine.close(); }
});
