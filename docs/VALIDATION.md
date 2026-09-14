# Validation — 2026-09-14 (Asia/Shanghai)

Development preview. This is not a public deployment or native-device acceptance.

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

Device verification and cross-signing; session restoration and secure local storage; key backup/lost-device recovery; embedded-host interaction and authentication ownership tests; real attachments/pagination/unread controls; PostgreSQL + trusted TLS staging deployment and its backup restoration; desktop/mobile native builds and physical-device lifecycle tests. No stable release has been published.
