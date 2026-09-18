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
