# 本机会话存储与安全边界

独立应用提供两种明确模式；嵌入组件的认证和存储始终由宿主管理。

- **临时登录（默认）**：令牌与 RustCrypto 存储留在内存中。刷新页面需要重新登录；关页不等于服务器确认退出，须用退出按钮撤销令牌。临时会话关闭后，未备份的历史密钥可能丢失。
- **在此浏览器保留会话**：设置独立的 12–1024 字符本机口令。刷新或锁定后输入口令，并经服务器核验，才恢复原设备、令牌和加密数据库；不会悄悄新建替代设备。

本地 `localStorage` 的 `mutual-chat:session:v1` 只保存版本、随机盐/随机 nonce 和认证密文。口令经 PBKDF2-HMAC-SHA256（600,000 次）派生 AES-256-GCM 密钥，密文内含服务器、用户/设备 ID、令牌、随机数据库前缀和 SDK 存储密钥；服务器密码与本机口令不序列化。RustCrypto 的 IndexedDB 由 SDK 存储密钥保护，临时模式不使用 IndexedDB。Web Lock 防止两个独立窗口同时写同一设备库；锁定时先停止 SDK 再释放所有权。

错误口令、损坏密文、已撤销令牌或网络错误不会覆盖已保存保险箱。正常退出须先获服务器确认，然后删除保险箱并清理该 SDK 数据库；失败会提示重试。“忘记已保存登录”无需口令，只能删密文封套，无法从中找出并清除数据库前缀；可能需要在浏览器设置中清理此来源数据，并从另一可信客户端撤销该设备。忘记登录不等于服务器退出。

请使用独立强口令和受信任的 HTTPS 来源。本机静态加密不能保护已解锁页面免受同源恶意脚本、扩展、浏览器或操作系统入侵，也不保证 JavaScript 内存清零。丢失口令/浏览器资料或清理站点数据会造成历史密钥丢失；首次备份与跨签名仍未完成。相关 Node Web Crypto 与真实服务器浏览器验证见下方英文证据及 [VALIDATION.md](VALIDATION.md)。

---

# Local session storage

The standalone application offers two explicit modes. The embedded component still delegates authentication and storage to its host.

- **Temporary login** (default): the access token and RustCrypto store stay in memory. Reloading closes this device locally and requires a new login. Closing a page is not a confirmed server logout; use the logout button to revoke its token. History keys are not recoverable after closing this temporary session.
- **Remember in this browser**: choose a separate local passphrase of 12–1024 characters. Reloading or locking requires this passphrase and then a successful server identity check. Unlocking reuses the original device, token and crypto database; it never silently creates a replacement device.

Use a long, unique local passphrase. This feature protects stored data at rest; it is not an operating-system keystore and cannot protect an unlocked session from malicious same-origin code, browser extensions, a compromised browser or someone operating the unlocked page. Keep the serving origin trusted and use HTTPS outside localhost. Clearing site data, losing the local passphrase or losing the browser profile can lose history keys. Cross-signing, device verification and remote key backup/recovery remain unfinished; this is still a development preview.

## Storage format and locking

`mutual-chat:session:v1` in localStorage contains only a version, random 16-byte salt, random 12-byte nonce and authenticated ciphertext. Web Crypto PBKDF2-HMAC-SHA256 with 600,000 iterations derives an AES-256-GCM key from the local passphrase. AES-GCM uses a 128-bit tag and fixed version-specific additional authenticated data. The envelope holds the normalized homeserver, user/device IDs, access token, opaque database prefix and a random 32-byte SDK storage key. A new salt and nonce are generated on each seal. The server password and local passphrase are not serialized.

RustCrypto receives the random storage key through the official SDK `storageKey` option. The same key and database prefix are restored on unlock. Temporary sessions use `useIndexedDB: false`. A Web Lock prevents two standalone windows from writing the same device store; locking stops the SDK before releasing ownership. A page closing during initialization retains ownership until initialization fails and stops, or the document is destroyed. No guarantee of JavaScript memory zeroization is made.

Wrong passphrases, malformed/tampered envelopes, revoked tokens and network errors do not overwrite the saved vault. The vault parser bounds input sizes and accepts only its fixed schema and KDF parameters. Logout first requires server confirmation, then removes the saved envelope and clears this SDK database. Failed local cleanup is reported. If logout cannot be confirmed, the application keeps the session for retry.

**Forget saved login** works without the local passphrase. It deletes the encrypted envelope, so it cannot discover or erase the opaque SDK database prefix inside it. An inaccessible encrypted database can remain until the user clears this origin's site data in browser settings. Forgetting is not server logout; revoke that device from another trusted client. This distinction is shown before and after forgetting.

## Evidence and references

Four Node Web Crypto tests cover round-trip identity/key restoration, randomized envelopes, wrong passwords, ciphertext/salt/nonce tampering, strict schemas, size limits and stored identity validation. The real-server browser suite includes same-device reload, prior-history decryption, competing windows, lock handoff, continued encrypted sending, explicit logout and revoked-token failure. See [VALIDATION.md](VALIDATION.md) for which runs have actually passed.

- [MatrixClient API](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html): `initRustCrypto`, `storageKey`, `useIndexedDB`, `clearStores` and single-client storage ownership.
- [OWASP password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): PBKDF2-HMAC-SHA256 work factor. This browser-compatible choice does not imply FIPS certification or an independent security audit.
