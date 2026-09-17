import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, createHmac, createHash } from 'node:crypto';
import { initPostgres, readInstance, startPostgres, snapshotPostgres, restorePostgres, compose } from '../tool/postgres-server.js';

test('PostgreSQL encrypted exchange, cold media snapshot and fresh-volume restoration', async ({ browser }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-chat-pg-acceptance-')); await fs.chmod(root, 0o700);
  let source, restored, failedRestore; const contexts = []; let cleanupSucceeded = true;
  const password = randomBytes(24).toString('hex'); const suffix = randomBytes(4).toString('hex');
  async function request(base, endpoint, auth, init = {}) {
    const r = await fetch(base + endpoint, { ...init, headers: { ...(auth ? { Authorization: 'Bearer ' + auth.access_token } : {}), ...init.headers }, signal: AbortSignal.timeout(15000) });
    expect(r.status).toBeGreaterThanOrEqual(200); expect(r.status).toBeLessThan(300); return r;
  }
  async function register(name) {
    const config = JSON.parse(await fs.readFile(path.join(source.root, 'data/homeserver.yaml'), 'utf8'));
    const url = source.base + '/_synapse/admin/v1/register'; const { nonce } = await (await fetch(url)).json();
    const mac = createHmac('sha1', config.registration_shared_secret).update([nonce, name, password, 'notadmin'].join('\0')).digest('hex');
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nonce, username: name, password, admin: false, mac, inhibit_login: true }) });
    expect(r.ok).toBe(true); const auth = await r.json();
    if (auth.access_token) await request(source.base, '/_matrix/client/v3/logout', auth, { method: 'POST' });
    return auth.user_id;
  }
  async function login(id) {
    const context = await browser.newContext(); contexts.push(context); const page = await context.newPage();
    await page.goto('http://127.0.0.1:14173'); await page.getByLabel('服务器地址').fill(source.base);
    await page.getByLabel('用户 ID').fill(id); await page.getByLabel('密码', { exact: true }).fill(password);
    const response = page.waitForResponse(r => r.url().endsWith('/_matrix/client/v3/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '连接', exact: true }).click(); const auth = await (await response).json();
    await expect(page.getByRole('button', { name: '新建会话', exact: true })).toBeEnabled(); return { page, auth };
  }
  try {
    source = await initPostgres(path.join(root, 'source'), 18018); await startPostgres(source);
    const role = await compose(source, ['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-Atc', "SELECT rolsuper FROM pg_roles WHERE rolname='synapse'"], { capture: true }); expect(role.trim()).toBe('f');
    const locale = await compose(source, ['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-Atc', "SELECT datcollate || ':' || datctype FROM pg_database WHERE datname='synapse'"], { capture: true }); expect(locale.trim()).toBe('C:C');
    const alice = await login(await register('alice_' + suffix)); const bobId = await register('bob_' + suffix); const bob = await login(bobId);
    const name = 'PostgreSQL ' + suffix;
    await alice.page.getByRole('button', { name: '新建会话', exact: true }).click();
    await alice.page.getByLabel('会话名称', { exact: true }).fill(name); await alice.page.getByLabel('邀请用户 ID', { exact: true }).fill(bobId);
    await alice.page.getByRole('button', { name: '创建加密会话', exact: true }).click();
    bob.page.on('dialog', d => d.accept()); await bob.page.getByRole('button', { name: '邀请 · ' + name, exact: true }).click();
    const message = 'Postgres encrypted ' + suffix;
    await alice.page.getByRole('textbox', { name: '消息', exact: true }).fill(message); await alice.page.getByRole('button', { name: '发送', exact: true }).click();
    await expect(bob.page.getByRole('log')).toContainText(message);
    const { joined_rooms: rooms } = await (await request(source.base, '/_matrix/client/v3/joined_rooms', alice.auth)).json(); expect(rooms).toHaveLength(1);
    const endpoint = '/_matrix/client/v3/rooms/' + encodeURIComponent(rooms[0]) + '/messages?dir=b&limit=50';
    const history = await (await request(source.base, endpoint, alice.auth)).json(); const ids = history.chunk.filter(e => e.type === 'm.room.encrypted').map(e => e.event_id).sort();
    expect(ids.length).toBeGreaterThan(0); expect(JSON.stringify(history)).not.toContain(message);
    const media = randomBytes(65537); const upload = await (await request(source.base, '/_matrix/media/v3/upload', alice.auth, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: media })).json();
    const [server, id] = upload.content_uri.slice(6).split('/'); const mediaPath = '/_matrix/client/v1/media/download/' + encodeURIComponent(server) + '/' + encodeURIComponent(id);
    const sourceKeys = await compose(source, ['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'synapse', '-Atc', 'SELECT count(*) FROM e2e_one_time_keys_json'], { capture: true });
    expect(Number(sourceKeys.trim())).toBeGreaterThan(0); // prove exclusion, not an already-empty table
    const backup = path.join(root, 'snapshot'); await snapshotPostgres(source, backup);
    await expect(bob.page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
    restored = await restorePostgres(backup, path.join(root, 'restored'), 18019);
    const copy = await (await request(restored.base, endpoint, alice.auth)).json();
    expect(copy.chunk.filter(e => e.type === 'm.room.encrypted').map(e => e.event_id).sort()).toEqual(ids); expect(JSON.stringify(copy)).not.toContain(message);
    expect(Buffer.from(await (await request(restored.base, mediaPath, alice.auth)).arrayBuffer())).toEqual(media);
    const keys = await compose(restored, ['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'synapse', '-Atc', 'SELECT count(*) FROM e2e_one_time_keys_json'], { capture: true }); expect(keys.trim()).toBe('0');
    await expect(fs.stat(path.join(restored.root, 'restore.pending'))).rejects.toMatchObject({ code: 'ENOENT' });
    // Checksum-valid invalid archive: real pg_restore failure, not digest preflight.
    // Only this isolated backup copy is modified.
    const invalid = path.join(root, 'invalid-archive'); await fs.cp(backup, invalid, { recursive: true, force: false, errorOnExist: true });
    const bytes = Buffer.from('not a PostgreSQL custom archive');
    await fs.writeFile(path.join(invalid, 'database.dump'), bytes);
    const manifestPath = path.join(invalid, 'snapshot.json'); const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    manifest.dumpSha256 = createHash('sha256').update(bytes).digest('hex'); await fs.writeFile(manifestPath, JSON.stringify(manifest));
    const failedPath = path.join(root, 'failed-restore');
    try { await expect(restorePostgres(invalid, failedPath, 18020)).rejects.toThrow('compose operation failed'); }
    finally { try { failedRestore = await readInstance(failedPath); } catch { /* no project created yet */ } }
    expect(failedRestore).toBeTruthy();
    await expect(startPostgres(failedRestore)).rejects.toThrow('Incomplete restore');
    await expect(snapshotPostgres(failedRestore, path.join(root, 'blocked-backup'))).rejects.toThrow('Incomplete restore');
    expect((await fs.stat(path.join(failedPath, 'restore.pending'))).isFile()).toBe(true);
    const failedTables = await compose(failedRestore, ['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'synapse', '-Atc', "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"], { capture: true });
    expect(failedTables.trim()).toBe('0');
    const running = await compose(failedRestore, ['ps', '--status', 'running', '--services'], { capture: true });
    expect(running.trim().split(/\s+/)).toEqual(['postgres']);
    await expect(restorePostgres(backup, source.root, 18019)).rejects.toThrow();
    const reply = 'Source still works ' + suffix; await bob.page.getByRole('textbox', { name: '消息', exact: true }).fill(reply); await bob.page.getByRole('button', { name: '发送', exact: true }).click(); await expect(alice.page.getByRole('log')).toContainText(reply);
    console.log(JSON.stringify({ postgres: '17.11', synapse: '1.160.0', nonSuperuser: true, localeC: true, encryptedDelivery: true, restoredCiphertextIds: true, restoredMediaBytes: media.length, oneTimeKeysExcluded: true, failedImportBlocksStartup: true, failedDatabaseRemainsEmpty: true, sourcePreserved: true, trustedRemoteTlsTested: false }));
  } finally {
    for (const context of contexts) await context.close();
    // Only unique projects created by this test. Never delete an operator's volume.
    for (const instance of [failedRestore, restored, source].filter(Boolean)) { try { await compose(instance, ['down', '-v']); } catch { cleanupSucceeded = false; } }
    if (cleanupSucceeded) await fs.rm(root, { recursive: true, force: true });
  }
});
