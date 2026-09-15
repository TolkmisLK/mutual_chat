# Validation — 2026-09-15 (Asia/Shanghai)

Development preview. This is not a public deployment or native-device acceptance.

## Earlier-message pagination — candidate pending CI

Local 19 unit tests and all three production builds pass. The new controlled regressions cover cached expansion, event-ID deduplication, the 1,000-message rendering cap, shared pending requests, exhausted history, failed-page retry and disposed adapters ignoring later completion. Seven browser scenarios are discovered. A new real SDK/Synapse scenario seeds 32 encrypted messages, restores their backed-up key in a new browser and tests the real backward-history endpoint, an interrupted request, retry, reading-anchor preservation and accessible-history exhaustion. Actual service/browser execution is pending CI; no new screenshot or encryption acceptance is claimed yet. See [HISTORY.md](HISTORY.md).

## Existing remote backup recovery

[PR #5 CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/34896682693), candidate `d8f8476f633c6ee5ab90202b3379602f6127a3fd`: both jobs passed, with 16 unit tests, three production builds and six real/controlled Chromium scenarios (56.0 seconds). Local unit tests and three builds also passed after local execution became available again; Docker remains unavailable locally, so real-server execution is evidenced by CI.

The new recovery scenario (7.6 seconds) creates a backup only for a generated test identity using the official SDK, closes that original context, and signs in on a distinct production-app device. Old history initially lacks keys. Malformed and syntactically valid but wrong secrets are rejected; the correct recovery key imports the old message, leaves the server backup version unchanged, and permits a new encrypted send. A further reload/unlock retains the same new device and decrypts both messages without re-entering the recovery key. Existing session, revocation, host lifecycle and two-user/server-snapshot cases passed again.

The initial candidate failed because SDK decryption failures use a synthetic message event containing an internal error body. The core now explicitly handles `isDecryptionFailure()` as a localized missing-key placeholder, with a unit regression proving transition to recovered plaintext. No cryptographic assertion was removed.

Artifact `10368314826` was downloaded and actual recovered-backup and phone-viewport screenshots were inspected: old/new history is visible after reload, composer is ready, and header controls wrap on narrow screens. No secrets or browser traces are included. Production recovery never initializes, resets or deletes backup/cross-signing identities; first-time setup and peer verification remain unfinished. See [RECOVERY.md](RECOVERY.md).

## Encrypted local session restoration

[PR #4 CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/34817824421), candidate `e8a8ca0d3b1206bf63298673962909a6d2b3b2eb`: both jobs passed. Ten unit tests, all three builds and all five Chromium scenarios passed (browser suite 42.8 seconds). The standalone shell now offers temporary memory-only login and opt-in encrypted local session storage.

- Same-device restoration (3.1 seconds): a generated account sends an encrypted message, reloads, rejects a wrong local passphrase without changing the vault, unlocks with the original device ID, and decrypts the earlier message. Only the original login request occurs. A competing window cannot initialize until the first locks; after ownership transfers, the second window decrypts history and sends another encrypted message. Explicit logout removes the vault and the original server token returns 401.
- Revoked token (1.3 seconds): after server-side logout, unlocking remains blocked and preserves the encrypted vault rather than silently logging in as a replacement device.
- The previous real two-user/restart/snapshot scenario and both embedded lifecycle scenarios pass with the new default temporary storage mode.

Artifact `10337501056` was downloaded. Actual restored-session and phone-viewport screenshots were inspected: old and new messages are visible after lock handoff, the original device is identified, and the temporary mobile-viewport conversation remains usable. These are Chromium captures, not physical-device tests. See [SESSION-SECURITY.md](SESSION-SECURITY.md) for the format, threat model and deletion limitations. This does not establish lost-profile recovery or trusted peer verification.

## Embedded host navigation and lifecycle

[PR #3 CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/34811896034), candidate `434a7d756503431fe77476a1fc0cf09a6695e8eb`: `check` and `integration` passed. Six unit tests and all three production outputs (widget, standalone, host example) passed. The widget copied into the host output was also compared locally byte for byte with the standalone ES module; public exports are `ChatSession` and `mountChat`.

All three Chromium scenarios passed in 41.1 seconds:

- Real embedded host (2.8 seconds): shared and panel-owned session modes each repeatedly mounted/unmounted, returned SDK listener counts to baseline and removed panel subscriptions. In each mode a real encrypted request was held until after navigation away, then delivered exactly once and displayed after remount. The server stored two encrypted events in total. The original user/device/token remained active throughout navigation; only explicit host logout invalidated the token. No browser page errors occurred.
- Controlled adapter teardown (178 ms): stale controls and callbacks after unmount could not trigger another send or change the detached draft; repeated unmount was harmless and left the host-owned adapter intact. This case tests component lifecycle, not cryptography.
- Existing real two-user scenario (35.1 seconds): invitation, encrypted delivery, server restart and snapshot recovery passed again. It now sends and receives another message after the snapshot rehearsal restores the source server before taking screenshots.

Artifact `10334484902` was downloaded. The embedded host screenshot and the updated phone-viewport conversation were inspected: host navigation and its separate style remain intact, both delayed messages appear once, and the phone composer is ready after restored communication. These are actual Chromium renders with generated fixture identities, not native-phone captures.

The integration example is documented in [EMBEDDING.md](EMBEDDING.md). Unsent drafts and selected-room state reset on unmount. Secure session restoration, device verification and key recovery are still separate unfinished work.

## Real server/browser interoperability

[PR #2 candidate CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/34794508200), commit `cc6a25c5fd923e7fc2c20a2a73147b5091574935`: both `check` and `integration` jobs passed.

- Core: 5 controlled-SDK tests passed. Standalone application and embedded ES module production builds passed.
- Deployment: pinned `matrixdotorg/synapse:v1.160.0` started using our loopback-only Compose configuration and persisted SQLite directory in the Ubuntu CI host.
- Browser: 1 end-to-end scenario passed (11.4 seconds; suite 13.4 seconds). Two independent Chromium browser contexts logged in as uniquely generated non-admin local accounts, initialized official SDK RustCrypto, invited/joined a private encrypted room, and displayed bidirectional decrypted text.
- Wire check: Alice's outbound message used `m.room.encrypted` with `m.megolm.v1.aes-sha2`; its payload did not contain the source message text. Bob's literal `<script>` message displayed as text, not executable HTML.
- Recovery scope: the Docker service restarted; existing browser devices reconnected and exchanged another message. A separate authenticated server messages request returned at least three encrypted events from persisted storage, with no message plaintext. This does **not** prove lost-device key recovery or power-loss consistency.
- UI: downloaded browser artifact `10329317080` and inspected actual desktop (1280×900) and mobile-viewport (390×844) screenshots. Chinese text, room list, wrapped message bubbles and composer render without horizontal overflow. These are desktop Chromium viewports, not physical-phone acceptance.

Tokens/passwords are never saved in the report. Browser network tracing is disabled to avoid capturing credentials. Screenshots contain only generated fixture accounts and messages. The server test fixture is not deployed to the public Internet.

## Local private backup restoration

[Final PR #2 CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/34794923410), candidate `68ba5649b82fdaee1adab10fa0cb8e90d3532115`: both jobs passed, including all 6 unit tests (5 controlled-SDK tests plus 1 real filesystem snapshot-isolation regression) and the extended real-browser scenario.

The scenario stops the source fixture before copying its entire data directory into a newly created private temporary directory. A second independent Compose project starts the copy on loopback port 18009. The original test token can query the same room there, and the restored encrypted message event IDs match the source history. The copied server is removed before deleting only its private fixture copy; the source server is restarted without replacing source files. A regression test confirms editing the copied config does not change the source.

The first attempt failed because an existing temporary root collided with `fs.cp`'s no-overwrite option; the corrected absent child-path layout passed. No test gate was removed. This verifies local SQLite/config/signing-key restoration and retained session/history, **not** PostgreSQL disaster recovery, remote/off-site backups, media-file restoration or client secret-key recovery. No browser trace or copied secret directory is uploaded as an artifact.

Local production-dependency audit on this date (`npm audit --omit=dev --audit-level=high`) reported 0 vulnerabilities. This only reflects known registry advisories for that dependency scope, not a general security certification.

## Reproduce commands

Docker Compose v2, Node 24, and Linux/compatible Docker environment:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run server:local
npx playwright install --with-deps chromium
npm run test:browser
npm run server:local -- stop
```

See [LOCAL-SERVER.md](LOCAL-SERVER.md) for configuration, storage and private backup boundaries. Local development environment lacked Docker/browser binaries, so interoperability execution is evidenced by CI, not claimed as a local-container run.

## Unfinished launch gates

Device verification and cross-signing; first-time backup setup and large/partial backup recovery; real attachments/pagination/unread controls; PostgreSQL + trusted TLS staging deployment and its backup restoration; desktop/mobile native builds and physical-device lifecycle tests. Local session restoration, existing remote backup recovery and embedded-host interaction have the real-browser evidence above. No stable release has been published.
