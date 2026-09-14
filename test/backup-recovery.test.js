import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key.js';
import { BackupRecovery } from '../src/backup-recovery.js';
const raw = new Uint8Array(32).fill(7);
const encoded = encodeRecoveryKey(raw);
function fixture() {
  const controller = new BackupRecovery(); const calls = [];
  const info = { algorithm: 'm.secret_storage.v1.aes-hmac-sha2' };
  const client = {
    getSyncState: () => 'SYNCING',
    secretStorage: {
      getKey: async () => ['fixture-key', info], getDefaultKeyId: async () => 'fixture-key',
      checkKey: async key => Buffer.from(key).equals(Buffer.from(raw)),
    },
    getCrypto: () => ({
      getKeyBackupInfo: async () => ({ version: '3', count: 2 }),
      loadSessionBackupPrivateKeyFromSecretStorage: async () => {
        calls.push('load');
        const tuple = await controller.callbacks.getSecretStorageKey({ keys: { 'fixture-key': info } }, 'm.megolm_backup.v1');
        assert.equal(tuple[0], 'fixture-key'); assert.deepEqual(tuple[1], raw);
      },
      restoreKeyBackup: async ({ progressCallback }) => { calls.push('restore'); progressCallback({ successes: 2 }); return { total: 2, imported: 2 }; },
    }),
  };
  controller.bind(client); return { controller, client, calls, info };
}
test('existing-backup restore delegates cryptography and clears its temporary recovery secret', async () => {
  const { controller, calls, info } = fixture(); const progress = [];
  assert.equal(await controller.callbacks.getSecretStorageKey({ keys: { 'fixture-key': info } }, 'm.megolm_backup.v1'), null);
  assert.deepEqual(await controller.status(), { version: '3', count: 2 });
  assert.deepEqual(await controller.restore(encoded, item => progress.push(item.successes)), { total: 2, imported: 2 });
  assert.deepEqual(calls, ['load', 'restore']); assert.deepEqual(progress, [2]);
  assert.equal(controller.key, null); assert.equal(controller.keyId, null); assert.equal(controller.running, false);
});
test('malformed, wrong-account and absent recovery material never reaches backup import', async () => {
  const { controller, client, calls } = fixture();
  await assert.rejects(controller.restore('not-a-key'), /格式/);
  await assert.rejects(controller.restore('x'.repeat(1025)), /格式/);
  await assert.rejects(controller.restore(encodeRecoveryKey(new Uint8Array(32).fill(8))), /不匹配/);
  client.secretStorage.getKey = async () => null;
  await assert.rejects(controller.restore(encoded), /没有可用/);
  assert.deepEqual(calls, []); assert.equal(controller.key, null);
});
test('recovery waits for sync and rejects parallel restores without discarding the active one', async () => {
  const { controller, client, calls } = fixture();
  client.getSyncState = () => 'ERROR'; await assert.rejects(controller.restore(encoded), /同步/);
  client.getSyncState = () => 'SYNCING';
  let release; const original = client.secretStorage.getKey;
  client.secretStorage.getKey = () => new Promise(resolve => { release = () => original().then(resolve); });
  const first = controller.restore(encoded);
  await assert.rejects(controller.restore(encoded), /仍在进行/);
  release(); await first; assert.deepEqual(calls, ['load', 'restore']);
});
test('disposing during a pending storage lookup prevents later import and secret retention', async () => {
  const { controller, client, calls } = fixture(); let release;
  client.secretStorage.getKey = () => new Promise(resolve => { release = resolve; });
  const pending = controller.restore(encoded); controller.dispose(); release(['fixture-key', {}]);
  await assert.rejects(pending, /关闭/); assert.deepEqual(calls, []); assert.equal(controller.key, null);
  await assert.rejects(controller.status(), /关闭/);
});
test('secret callback refuses unrelated secret names and changed default keys', async () => {
  const { controller, client, info } = fixture();
  controller.running = true; controller.key = raw.slice(); controller.keyId = 'fixture-key';
  assert.equal(await controller.callbacks.getSecretStorageKey({ keys: { 'fixture-key': info } }, 'm.cross_signing.master'), null);
  client.secretStorage.getDefaultKeyId = async () => 'changed';
  assert.equal(await controller.callbacks.getSecretStorageKey({ keys: { 'fixture-key': info } }, 'm.megolm_backup.v1'), null);
  controller.dispose(); assert.equal(controller.key, null);
});
