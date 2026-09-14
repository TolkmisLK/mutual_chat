import { createClient } from 'matrix-js-sdk';

// Served only by the loopback Vite development server in the browser fixture.
// It is not imported into any production entry or copied to dist.
window.seedBackup = async ({ baseUrl, user, password, roomName, message }) => {
  if (!['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname)) throw new Error('Fixture server must be loopback');
  const keys = new Map(); let client;
  async function until(check, label) {
    const until = Date.now() + 90000;
    while (Date.now() < until) { const value = await check(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 200)); }
    throw new Error('Fixture timed out: ' + label);
  }
  try {
    const auth = await createClient({ baseUrl }).loginWithPassword(user, password);
    client = createClient({ baseUrl, userId: auth.user_id, deviceId: auth.device_id, accessToken: auth.access_token, cryptoCallbacks: {
      cacheSecretStorageKey: (id, _info, key) => keys.set(id, key.slice()),
      getSecretStorageKey: async ({ keys: requested }) => {
        const id = await client.secretStorage.getDefaultKeyId();
        return id && requested[id] && keys.has(id) ? [id, keys.get(id)] : null;
      },
    } });
    await client.initRustCrypto({ useIndexedDB: false }); await client.startClient({ initialSyncLimit: 30 });
    await until(() => ['PREPARED', 'SYNCING'].includes(client.getSyncState()), 'sync');
    const crypto = client.getCrypto();
    // This account is generated uniquely by the test and has no existing keys.
    if (await crypto.userHasCrossSigningKeys() || await crypto.getKeyBackupInfo()) throw new Error('Refusing to modify a nonempty fixture identity');
    await crypto.bootstrapCrossSigning({ authUploadDeviceSigningKeys: async request => {
      try { return await request(null); }
      catch (error) {
        if (error.httpStatus !== 401) throw error;
        return request({ type: 'm.login.password', identifier: { type: 'm.id.user', user }, password, session: error.data.session });
      }
    } });
    const recovery = await crypto.createRecoveryKeyFromPassphrase();
    await crypto.bootstrapSecretStorage({ createSecretStorageKey: async () => recovery, setupNewKeyBackup: true });
    const { room_id } = await client.createRoom({ name: roomName, visibility: 'private', preset: 'private_chat',
      initial_state: [{ type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } }] });
    await until(() => client.getRoom(room_id)?.hasEncryptionStateEvent(), 'room encryption');
    const { event_id } = await client.sendTextMessage(room_id, message);
    const headers = { Authorization: 'Bearer ' + auth.access_token };
    const backup = await until(async () => {
      const response = await fetch(baseUrl + '/_matrix/client/v3/room_keys/version', { headers });
      if (!response.ok) return false;
      const value = await response.json(); return value.count > 0 ? value : false;
    }, 'encrypted backup upload');
    const backupKeys = await (await fetch(baseUrl + '/_matrix/client/v3/room_keys/keys?version=' + encodeURIComponent(backup.version), { headers })).text();
    if (backupKeys.includes(message)) throw new Error('Backup leaked fixture plaintext');
    return { recoveryKey: recovery.encodedPrivateKey, roomId: room_id, eventId: event_id, deviceId: auth.device_id, version: backup.version, token: auth.access_token };
  } finally { client?.stopClient(); for (const key of keys.values()) key.fill(0); keys.clear(); }
};
