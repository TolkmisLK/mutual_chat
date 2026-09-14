# Recover an existing remote history-key backup

The standalone app can restore history keys from an **existing** Matrix secret-storage/key-backup setup. Use the recovery key you previously saved from a trusted Matrix client, not the account password or this browser's local unlock passphrase. Open **恢复密钥** after login and synchronization, enter the key, and keep the page open until completion. A remembered browser session stores imported keys in its encrypted SDK database; a temporary login keeps them only in memory.

This slice does not create or reset secret storage, backup versions or cross-signing identities. It does not verify other devices or claim a restored device is cross-signed. First-time backup setup, peer verification, cross-signing recovery and automatic-backup status UX are still unfinished. Keep using a trusted Matrix client to create/manage your existing backup until those features are delivered here.

## What is checked

The official SDK decodes the Matrix recovery-key format and checks the key against the account's secret-storage metadata. The callback supplies it only for the requested `m.megolm_backup.v1` secret while the explicit restore operation is active, and only for the current default storage key. The SDK decrypts the backup private key, checks it matches the server backup public key, and restores backed-up room keys. The app clears its temporary recovery-key byte buffer and password input after the operation, including failures; this is not a guarantee of JavaScript memory zeroization.

Wrong or malformed keys, missing secret storage and network failures are reported without creating replacement keys or deleting backups. Only one restore runs at once; closing/locking the client disposes the controller. A restore can be partially imported before a later network failure; retry is permitted. There is no rollback that deletes already imported valid keys. Large backups may take substantial time and memory inside the SDK; the UI shows progress and should remain open. A cancel-and-resume UX for multi-hour backups remains future work.

Only messages whose keys were actually backed up can be recovered. This does not recover a lost recovery key, a deleted remote backup, server-deleted message events, or messages the original device never backed up. Possession of an account password alone is intentionally insufficient. Browser/OS compromise and hostile same-origin scripts remain outside the local at-rest protection boundary described in [SESSION-SECURITY.md](SESSION-SECURITY.md).

## Verification scope

Unit cases cover SDK delegation, temporary-key cleanup, wrong/missing material, synchronization gates, concurrent operations, closing during pending work and rejecting unrelated secret requests. A new real-server browser case creates a private fixture backup with the official SDK, closes the original device context, logs in on a distinct browser device, confirms old history is not decryptable before recovery, restores it, confirms the backup version is unchanged and continues encrypted sending. The fixture initialization helper is served only by a loopback development test server, not imported into production entries.

The real-server scenario passed in PR #5 CI, including malformed and valid-but-wrong secrets, recovery on a distinct device, unchanged backup version and another local reload/unlock that still decrypts imported history. See [VALIDATION.md](VALIDATION.md) for exact commit, run, timings and inspected screenshots. Large/partial backups and physical-device lifecycle remain untested.

Primary implementation references: [Matrix SDK 42.3.0 backup recovery](https://github.com/matrix-org/matrix-js-sdk/blob/v42.3.0/src/rust-crypto/rust-crypto.ts), [SDK recovery-key representation](https://github.com/matrix-org/matrix-js-sdk/blob/v42.3.0/src/crypto-api/recovery-key.ts).
