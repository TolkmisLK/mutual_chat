import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initPostgres, readInstance, validPort, withOperation, restorePostgres, startPostgres, snapshotPostgres } from '../tool/postgres-server.js';

test('PostgreSQL instance initialization is private, loopback-only and refuses overwrite', async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-pg-config-'));
  const root = path.join(parent, 'new-instance');
  try {
    const instance = await initPostgres(root, 18018);
    const raw = await fs.readFile(path.join(root, 'data/homeserver.yaml'), 'utf8'); const config = JSON.parse(raw);
    assert.equal(config.database.name, 'psycopg2'); assert.equal(config.database.args.host, 'postgres');
    assert.equal(config.enable_registration, false); assert.deepEqual(config.federation_domain_whitelist, []);
    assert.equal(config.public_baseurl, 'http://127.0.0.1:18018/');
    assert.match(config.database.args.password, /^[a-f0-9]{64}$/);
    assert.notEqual(config.database.args.password, config.registration_shared_secret);
    const sql = await fs.readFile(path.join(root, 'init.sql'), 'utf8');
    assert.match(sql, /CREATE ROLE synapse LOGIN PASSWORD/); assert.doesNotMatch(sql, /SUPERUSER/); assert.match(sql, /LC_COLLATE 'C' LC_CTYPE 'C'/);
    assert.equal((await readInstance(root)).project, instance.project);
    await assert.rejects(initPostgres(root, 18018), { code: 'EEXIST' });
    assert.equal(await fs.readFile(path.join(root, 'data/homeserver.yaml'), 'utf8'), raw);
    if (process.platform !== 'win32') { assert.equal((await fs.stat(root)).mode & 0o777, 0o700); assert.equal((await fs.stat(path.join(root, 'admin-password'))).mode & 0o777, 0o444); assert.equal((await fs.stat(path.join(root, 'data/homeserver.yaml'))).mode & 0o777, 0o600); }
  } finally { await fs.rm(parent, { recursive: true, force: true }); }
});
test('PostgreSQL launcher validates ports before creating state', () => {
  for (const port of [0, 80, 65536, 1.5, 'not-a-port']) assert.throws(() => validPort(port));
  assert.equal(validPort('18019'), 18019);
});

test('instance operations exclude concurrent writers and release on failure without stealing locks', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-pg-lock-'));
  try {
    await withOperation({ root }, async () => {
      await assert.rejects(withOperation({ root }, () => assert.fail('must not execute')), /Another operation/);
      assert.equal((await fs.stat(path.join(root, 'operation.lock'))).isFile(), true);
    });
    await assert.rejects(withOperation({ root }, async () => { throw new Error('fixture'); }), /fixture/);
    await assert.rejects(fs.stat(path.join(root, 'operation.lock')), { code: 'ENOENT' });
    await fs.writeFile(path.join(root, 'operation.lock'), 'previous owner', { flag: 'wx' });
    await assert.rejects(withOperation({ root }, () => assert.fail()), /Never automatically remove/);
    assert.equal(await fs.readFile(path.join(root, 'operation.lock'), 'utf8'), 'previous owner');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('corrupt snapshot is rejected before creating any restore destination or starting Docker', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-pg-invalid-'));
  try {
    await fs.writeFile(path.join(root, 'database.dump'), 'corrupted');
    await fs.writeFile(path.join(root, 'snapshot.json'), JSON.stringify({ schema: 1, postgres: '17.11', synapse: '1.160.0', dumpSha256: '0'.repeat(64) }));
    const target = path.join(root, 'must-not-exist'); await assert.rejects(restorePostgres(root, target), /checksum mismatch/);
    await assert.rejects(fs.stat(target), { code: 'ENOENT' });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('incomplete restore marker blocks startup and snapshots without invoking Docker or deleting state', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-pg-pending-'));
  try {
    const instance = await initPostgres(path.join(root, 'instance'));
    const marker = path.join(instance.root, 'restore.pending');
    await fs.writeFile(marker, 'interrupted import', { flag: 'wx', mode: 0o600 });
    assert.equal((await readInstance(instance.root)).project, instance.project); // stop/inspection remain possible
    for (let attempt = 0; attempt < 2; attempt++) {
      await assert.rejects(startPostgres(instance), /Incomplete restore/);
      await assert.rejects(snapshotPostgres(instance, path.join(root, 'backup')), /Incomplete restore/);
    }
    assert.equal(await fs.readFile(marker, 'utf8'), 'interrupted import');
    await assert.rejects(fs.stat(path.join(root, 'backup')), { code: 'ENOENT' });
    await assert.rejects(fs.stat(path.join(instance.root, 'operation.lock')), { code: 'ENOENT' });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
