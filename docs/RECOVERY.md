# 恢复已有远程历史密钥备份

独立应用可从**已存在**的 Matrix 密钥备份恢复历史消息。登录且完成同步后打开“恢复密钥”，输入之前从可信 Matrix 客户端保存的恢复密钥，保持页面开启直到完成。它不是帐号密码，也不是本机解锁口令。记住会话时导入的密钥进入已加密的 SDK 数据库；临时登录只保留在内存。

官方 SDK 校验恢复密钥格式、帐号密钥存储元数据、备份私钥与服务器公钥匹配，再导入已备份的房间密钥。本功能不会创建/重置备份、跨签名身份或设备信任；首次备份、联系人验证及自动备份状态界面仍未实现。错误密钥、缺少备份或网络失败会报告错误而不创建替代密钥。一次只运行一项恢复；失败前可能已部分导入有效密钥，重试不会回滚它们。大型备份可能耗时和占内存，目前没有长时任务的取消后续传界面。

只能恢复原设备实际备份过的密钥；丢失恢复密钥、删除备份、服务器已删事件或从未备份的消息无法靠帐号密码找回。PR #5 的真实服务器浏览器场景验证了错误密钥拒绝、新设备恢复旧消息、备份版本不变及再次解锁；大型/部分备份与物理设备仍未验收。详见 [VALIDATION.md](VALIDATION.md) 与 [SESSION-SECURITY.md](SESSION-SECURITY.md)。

---

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
