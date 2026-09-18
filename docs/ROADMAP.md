# Delivery and acceptance roadmap

## Architecture

`packages/chat-core` provides a framework-neutral session boundary; `packages/chat-ui` mounts a style-isolated panel; `src` is the standalone application shell. Both UI forms share the same session logic. A Matrix homeserver owns identities, room membership and durable event history. The official Matrix SDK owns sync, local echoes, retries, transaction IDs and Rust-based encryption.

Reference: [Matrix SDK documentation](https://matrix-org.github.io/matrix-js-sdk/index.html), including its explicit single-client-per-crypto-database requirement. Do not implement custom cryptography or treat UI tests as encryption interoperability tests.

## Next development slices

1. Local reproducible Synapse 1.160.0 deployment, restricted test-account bootstrap, persisted storage and two-user encrypted browser/restart tests passed (see VALIDATION.md). PostgreSQL 17.11 loopback deployment and independent SQL/media/signing-key restore rehearsal also passed. Next: trusted TLS staging, restricted operator provisioning and encrypted offsite backup retention.
2. Opt-in encrypted local session restoration, existing remote-backup recovery and standalone same-account SAS verification passed real-server browser tests (see SESSION-SECURITY.md, RECOVERY.md, DEVICE-VERIFICATION.md and VALIDATION.md). Next: first-time backup setup, cross-signing setup and contact identity verification. Never use a backup-reset API as an unguarded first-time initializer: the locked SDK's reset path deletes existing backup versions. Test partial setup, competing clients and forgotten-recovery-key paths before enabling setup for users.
3. Two-user encrypted messages, invites, reconnect, duplicate-send behavior, explicit backward pagination, private read receipts, bounded local search and own-message redaction passed their recorded gates. Pagination currently stops at 1,000 rendered messages; full timeline-window navigation and safe authenticated chat attachments remain. PostgreSQL's media restore test is not a chat-attachment UI feature.
4. Standalone Windows x64 packaging/startup and Linux native encrypted exchange/profile-restart passed PR #7 gates, with sandboxing retained. Next: Windows native Matrix and consumer-machine checks, accessible distribution/signing/update policy, and mobile wrapper with secure token storage and lifecycle handling. Never embed tokens in builds or source code.
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
