import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceSessions } from '../src/device-sessions.js';
const challenge = (stages = ['m.login.password']) => Object.assign(new Error('UIA'), { httpStatus: 401, data: { session: 'uia-fixture', flows: [{ stages }] } });
function fixture() {
  const calls = []; let now = 1000;
  const client = { getUserId: () => '@fixture:localhost', getDeviceId: () => 'current',
    getDevices: async () => ({ devices: [{ device_id: 'current', display_name: 'Here', last_seen_ip: 'private-fixture' }, { device_id: 'other', display_name: '<script>plain text</script>', last_seen_ts: 1234 }] }),
    deleteDevice: async (id, auth) => { calls.push({ id, auth }); } };
  const controller = new DeviceSessions(client, () => now); return { client, calls, controller, advance: () => { now += 300000; } };
}
test('device list whitelists display fields and removal refuses current or unlisted targets', async () => {
  const { controller, calls } = fixture();
  await assert.rejects(controller.requestRemoval('other'), /刷新/);
  const devices = await controller.list(); assert.equal(devices[0].current, true); assert.equal(JSON.stringify(devices).includes('private-fixture'), false);
  await assert.rejects(controller.requestRemoval('current'), /当前/); await assert.rejects(controller.requestRemoval('foreign'), /刷新/);
  assert.deepEqual(await controller.requestRemoval('other'), { removed: true, id: 'other' });
  assert.deepEqual(calls, [{ id: 'other', auth: undefined }]);
});
test('server UIA challenge binds password reauthentication to the confirmed target and same account', async () => {
  const { controller, client, calls } = fixture();
  client.deleteDevice = async (id, auth) => { calls.push({ id, auth }); if (!auth) throw challenge(); };
  await controller.list(); assert.equal((await controller.requestRemoval('other')).passwordRequired, true);
  assert.deepEqual(await controller.confirmPassword('generated-fixture-password'), { removed: true, id: 'other' });
  assert.deepEqual(calls[1], { id: 'other', auth: { type: 'm.login.password', identifier: { type: 'm.id.user', user: '@fixture:localhost' }, password: 'generated-fixture-password', session: 'uia-fixture' } });
  assert.equal(controller.challenge, null); assert.equal(JSON.stringify(controller).includes('generated-fixture-password'), false);
});
test('wrong password can retry but unsupported flows, cancelled or expired challenges cannot send credentials', async () => {
  const { controller, client, calls, advance } = fixture();
  client.deleteDevice = async (id, auth) => { calls.push({ id, auth }); throw challenge(); };
  await controller.list(); await controller.requestRemoval('other');
  assert.equal((await controller.confirmPassword('wrong-password')).rejected, true);
  controller.cancel(); await assert.rejects(controller.confirmPassword('never-sent'), /重新/);
  await controller.requestRemoval('other'); advance(); await assert.rejects(controller.confirmPassword('never-sent'), /重新/);
  client.deleteDevice = async () => { throw challenge(['m.login.password', 'm.login.email.identity']); };
  await assert.rejects(controller.requestRemoval('other'), /其他认证/);
  assert.equal(JSON.stringify(calls).includes('never-sent'), false); assert.equal(controller.challenge, null);
});
test('concurrent operations and disposal reject late challenge without deleting additional devices', async () => {
  const { controller, client } = fixture(); let reject;
  await controller.list(); client.deleteDevice = () => new Promise((_resolve, fail) => { reject = fail; });
  const pending = controller.requestRemoval('other'); await assert.rejects(controller.list(), /仍在进行/);
  controller.dispose(); reject(challenge()); await assert.rejects(pending, /关闭/);
  assert.equal(controller.challenge, null); await assert.rejects(controller.list(), /关闭/);
});
test('ambiguous network errors are not treated as a successful revocation', async () => {
  const { controller, client } = fixture(); await controller.list(); client.deleteDevice = async () => { throw new Error('fixture network failure'); };
  await assert.rejects(controller.requestRemoval('other'), /未确认/); assert.equal(controller.known.has('other'), true);
});
