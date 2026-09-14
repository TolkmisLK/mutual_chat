# Isolated local Matrix server

This fixture is for development/CI, not public hosting. It uses [Synapse v1.160.0](https://github.com/element-hq/synapse/releases/tag/v1.160.0), verified against the upstream release on 2026-09-14. The image is version-pinned, not digest-pinned; a future production deployment must record the resolved image digest and its security review.

## Start and stop

Install Docker Engine/Desktop with Docker Compose v2 and Node.js 24, then:

```sh
npm ci --ignore-scripts
npm run server:local
npm run server:local -- stop
```

The helper creates a private `deploy/local/data/` configuration only if absent and never overwrites an existing configuration or deletes data. Synapse listens only on `127.0.0.1:18008` on the host. Public registration is disabled, only client resources are exposed, federation destinations are disallowed, and anonymous statistics are disabled. A random local administrative registration secret is kept in the private config, not printed or checked into git. The helper uses the current Unix UID/GID; Windows Docker uses the image's 991:991 default and requires a writable bind mount.

SQLite, media and signing keys persist in that directory. Keep server name `localhost` for this fixture; do not reuse its identities for a later public deployment. No trusted TLS or multi-machine support is claimed for loopback HTTP.

## Integration tests

```sh
npm run build
npx playwright install --with-deps chromium
npm run test:browser
```

The test creates two unique non-admin fixture accounts using Synapse's [official shared-secret registration API](https://github.com/element-hq/synapse/blob/v1.160.0/docs/admin_api/register_api.md). Passwords are random and token responses remain only in process memory. No network traces are retained because login traces may contain credentials. Reports/screenshots contain only generated test identities and messages. The test leaves its accounts and room in the fixture database so evidence is inspectable; never run it against an unrelated homeserver.

The server must already be running. Tests cover private room invitations, bidirectional RustCrypto message delivery, encrypted outbound event content, service restart, and encrypted history retrieved from persisted server storage. These tests do not verify cross-signing, lost-device recovery or TLS deployment. Check the actual CI result before treating any case as passed.

## Local backup and restoration rehearsal

Stop the server before copying **the entire** data directory, including SQLite, config, media and signing keys. Store that copy privately; it includes secrets. Restore into an empty fixture directory with the same ownership, then restart. Never overwrite a running database or casually delete a real data directory. Automated backup/restore acceptance is still pending.

## Production boundary

Upstream [Docker instructions](https://github.com/element-hq/synapse/blob/v1.160.0/docker/README.md) recommend PostgreSQL for production and require HTTPS/reverse proxy for practical use. A production slice must add trusted TLS, PostgreSQL, restricted account provisioning, private secret storage, tested backup restoration, security updates and operational monitoring. This local Compose file is deliberately not presented as that deployment.
