import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key.js';

// Read/restore existing Matrix backup only. Never create, reset, delete or
// cross-sign an identity/backup here; peer verification is a separate feature.
export class BackupRecovery {
  constructor() {
    this.client = null; this.closed = false; this.running = false; this.key = null; this.keyId = null;
    this.callbacks = { getSecretStorageKey: async ({ keys }, name) => {
      this.assertOpen();
      if (!this.running || name !== 'm.megolm_backup.v1' || !this.keyId || !this.key || !keys[this.keyId]) return null;
      if (await this.client.secretStorage.getDefaultKeyId() !== this.keyId) return null;
      if (!await this.client.secretStorage.checkKey(this.key, keys[this.keyId])) return null;
      this.assertOpen(); return [this.keyId, this.key.slice()];
    } };
  }
  bind(client) { this.client = client; }
  assertOpen() { if (this.closed || !this.client) throw new Error('会话已关闭。'); }
  clear() { this.key?.fill(0); this.key = null; this.keyId = null; }
  dispose() { this.closed = true; this.clear(); }
  ready() {
    this.assertOpen();
    if (!['PREPARED', 'SYNCING'].includes(this.client.getSyncState())) throw new Error('请等待聊天同步完成后重试。');
  }
  async status() {
    this.ready(); const info = await this.client.getCrypto().getKeyBackupInfo(); this.assertOpen();
    return info ? { version: info.version, count: info.count } : null;
  }
  async restore(encoded, onProgress = () => {}) {
    this.ready(); if (this.running) throw new Error('恢复仍在进行，请等待完成。');
    if (typeof encoded !== 'string' || encoded.length > 1024) throw new Error('恢复密钥格式不正确。');
    let decoded;
    try { decoded = decodeRecoveryKey(encoded); } catch { throw new Error('恢复密钥格式不正确。'); }
    this.running = true;
    try {
      const tuple = await this.client.secretStorage.getKey(); this.assertOpen();
      if (!tuple) throw new Error('此帐号没有可用的恢复资料；不会自动创建或重置。');
      if (!await this.client.secretStorage.checkKey(decoded, tuple[1])) throw new Error('恢复密钥与此帐号不匹配。');
      this.assertOpen(); this.key = decoded.slice(); this.keyId = tuple[0];
      const api = this.client.getCrypto();
      // The SDK checks that the decrypted backup private key matches the
      // server's backup public key before caching it with the backup version.
      await api.loadSessionBackupPrivateKeyFromSecretStorage(); this.assertOpen();
      const result = await api.restoreKeyBackup({ progressCallback: progress => {
        if (!this.closed) onProgress(progress);
      } });
      this.assertOpen(); return result;
    } finally { decoded.fill(0); this.clear(); this.running = false; }
  }
}
