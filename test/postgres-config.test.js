import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initPostgres, readInstance, validPort } from '../tool/postgres-server.js';

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
