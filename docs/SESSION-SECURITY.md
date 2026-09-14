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
