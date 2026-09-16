# PostgreSQL deployment and recovery rehearsal

This is an isolated, **loopback-only development deployment**, not a publicly hosted service. Docker Compose, Node 24 and sufficient disk space are required. Existing SQLite data is not migrated. Never use the fixture account-registration secret on a public listener.

Pinned images: Synapse 1.160.0 and PostgreSQL 17.11 (the supported PostgreSQL 17 minor listed by upstream when checked on 2026-09-17). The database has UTF-8 encoding and `C` collation. Synapse uses a separate, non-superuser database role. PostgreSQL publishes no host port; the Matrix client listener binds only `127.0.0.1`. Docker bridge traffic is not TLS-encrypted: this does not constitute trusted remote TLS staging.

Use new private directories **outside this checkout**; their parents must already exist:

```sh
node tool/postgres-server.js init /private/chat-pg 18018
node tool/postgres-server.js up /private/chat-pg
node tool/postgres-server.js snapshot /private/chat-pg /private/chat-backup-001
node tool/postgres-server.js restore /private/chat-backup-001 /private/chat-restore-001 18019
node tool/postgres-server.js stop /private/chat-restore-001
node tool/postgres-server.js stop /private/chat-pg
```

Initialization and restoration refuse existing destination directories. Each instance records a random Compose project identifier, owning an independent named database volume. `stop` retains data. The command has no delete-volume or overwrite-source action. A failed init/restore is left for administrator inspection; do not reuse its directory or remove volumes until confirming their ownership.

Snapshot pauses Synapse, creates a PostgreSQL custom-format dump, copies configuration/signing keys/media and then restarts the source. Application downtime is expected. Following Synapse guidance, one-time encryption-key rows are excluded to prevent old keys being reissued. Snapshot completion is marked only after the dump and file copy finish. Restoration checks the dump digest and pinned version, starts only a fresh PostgreSQL volume, checks that its public schema is empty, restores transactionally and finally starts the copied Synapse. The restore port can differ, while server identity and signing key remain the same. Never expose both copies as one public homeserver.

Backups contain **database credentials, registration secrets, access tokens and private signing keys**. The directory is mode 0700 on POSIX. Configuration and dumps are mode 0600; two read-only PostgreSQL bootstrap files are mode 0444 inside that private directory so the container's PostgreSQL UID can read their explicit file mounts. Other host users cannot traverse the 0700 parent. Windows requires appropriate filesystem ACLs. These are not encrypted/offsite backups. SHA-256 detects accidental dump corruption, not malicious changes; restore only trusted snapshots controlled by the server administrator. The database dump does not include browser-held encryption keys or replace the client's recovery key. Media/config copies are not a general hostile-archive importer.

## Acceptance

`npx playwright test --config playwright.postgres.config.js` creates unique disposable projects and directories, runs actual Chromium users against Synapse/PostgreSQL, uploads generated media, rehearses restore into an independent database, checks ciphertext event IDs and authenticated media bytes, confirms one-time-key exclusion and verifies the source still exchanges encrypted messages. Cleanup removes only those generated projects/volumes. No trace, SQL, service data or secret-bearing report is uploaded. Current candidate CI results are pending; local configuration tests alone are not database acceptance.

Still required for deployment: authorized hostname and trusted TLS, restricted account provisioning, remote/offsite encrypted backup retention, disk monitoring, restore-time objectives, hardening for the deployment host and independent security review. No public deployment or paid resource was created.

References: [Synapse PostgreSQL setup](https://element-hq.github.io/synapse/latest/postgres.html), [Synapse backup requirements](https://element-hq.github.io/synapse/latest/usage/administration/backups.html), [PostgreSQL pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [supported versions](https://www.postgresql.org/support/versioning/).
