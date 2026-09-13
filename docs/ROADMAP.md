# Delivery and acceptance roadmap

## Architecture

`packages/chat-core` provides a framework-neutral session boundary; `packages/chat-ui` mounts a style-isolated panel; `src` is the standalone application shell. Both UI forms share the same session logic. A Matrix homeserver owns identities, room membership and durable event history. The official Matrix SDK owns sync, local echoes, retries, transaction IDs and Rust-based encryption.

Reference: [Matrix SDK documentation](https://matrix-org.github.io/matrix-js-sdk/index.html), including its explicit single-client-per-crypto-database requirement. Do not implement custom cryptography or treat UI tests as encryption interoperability tests.

## Next development slices

1. Local reproducible homeserver deployment and test-account bootstrap without public registration; TLS, persistent volumes and backup/restore instructions. Pin and test the selected server version before documenting it as supported.
2. Durable session restoration, cross-signing, device verification and key-backup/recovery UI. Test lost-device and forgotten-password paths. Gate public launch on these features.
3. Two-user encrypted message interoperability, invites, reconnect, duplicate-send behavior, redaction, pagination, unread counts, search and safe authenticated media.
4. Standalone desktop package and mobile app wrapper with secure token storage, lifecycle handling and notification permissions. Never embed tokens in builds or source code.
5. An integration example in a separate host app demonstrating mount/unmount, shared sessions, host navigation, theme and authentication ownership.
6. Contact/block/report controls and server-side access restrictions appropriate to an invite-only initial deployment. Voice/video calls and Telegram protocol interoperability are not initial release requirements.

## Release gates

- Reproducible locked build, automated core/UI/integration tests and dependency audit.
- Real homeserver tests for encrypted delivery, multi-device verification and key recovery.
- Windows desktop and Android package validation; iOS signing/device acceptance requires an authorized Apple environment.
- Independent application and embedded module both work; unmount never logs out the host or leaks listeners.
- Reviewed browser/mobile UI, bounded timeline memory, stable reconnect and explicit failure states.
- Deployed staging service with verified TLS, persistence, backup restoration and observability; no paid infrastructure purchased without authorization.
- Clearly separate tested functionality from remaining gates. Do not publish a stable release merely because the bundle compiles.
