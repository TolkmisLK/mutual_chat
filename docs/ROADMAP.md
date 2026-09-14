# Delivery and acceptance roadmap

## Architecture

`packages/chat-core` provides a framework-neutral session boundary; `packages/chat-ui` mounts a style-isolated panel; `src` is the standalone application shell. Both UI forms share the same session logic. A Matrix homeserver owns identities, room membership and durable event history. The official Matrix SDK owns sync, local echoes, retries, transaction IDs and Rust-based encryption.

Reference: [Matrix SDK documentation](https://matrix-org.github.io/matrix-js-sdk/index.html), including its explicit single-client-per-crypto-database requirement. Do not implement custom cryptography or treat UI tests as encryption interoperability tests.

## Next development slices

1. Local reproducible Synapse 1.160.0 deployment, restricted test-account bootstrap, persisted storage and two-user encrypted browser/restart tests passed (see VALIDATION.md). Next: PostgreSQL, trusted TLS and tested backup restoration for staging deployment.
2. Opt-in encrypted local session restoration and same-device history decryption passed real-server browser tests (see SESSION-SECURITY.md and VALIDATION.md). Next: cross-signing, device verification and remote key-backup/recovery UI. Test lost-device and forgotten-recovery-key paths. Gate public launch on these features.
3. Two-user encrypted message interoperability, invites, reconnect, duplicate-send behavior, redaction, pagination, unread counts, search and safe authenticated media.
4. Standalone desktop package and mobile app wrapper with secure token storage, lifecycle handling and notification permissions. Never embed tokens in builds or source code.
5. A separate host example consumes the built module; real-browser mount/unmount, shared sessions, pending encrypted sends, host navigation and authentication ownership passed (see EMBEDDING.md and VALIDATION.md). Next: retained drafts and framework-specific adapters as needed.
6. Contact/block/report controls and server-side access restrictions appropriate to an invite-only initial deployment. Voice/video calls and Telegram protocol interoperability are not initial release requirements.

## Release gates

- Reproducible locked build, automated core/UI/integration tests and dependency audit.
- Real homeserver tests for encrypted delivery, multi-device verification and key recovery.
- Windows desktop and Android package validation; iOS signing/device acceptance requires an authorized Apple environment.
- Independent application and embedded module both work; unmount never logs out the host or leaks listeners.
- Reviewed browser/mobile UI, bounded timeline memory, stable reconnect and explicit failure states.
- Deployed staging service with verified TLS, persistence, backup restoration and observability; no paid infrastructure purchased without authorization.
- Clearly separate tested functionality from remaining gates. Do not publish a stable release merely because the bundle compiles.
