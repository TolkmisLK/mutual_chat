// Loopback-only PostgreSQL deployment and cold application snapshot rehearsal.
// No migration, public listener, existing-volume restore or automatic data deletion.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { waitForServer } from './local-server.js';
const composeFile = fileURLToPath(new URL('../deploy/postgres/compose.yaml', import.meta.url));
const secret = () => randomBytes(32).toString('hex');
const repository = fileURLToPath(new URL('../', import.meta.url));
function privateTarget(directory) {
  const target = path.resolve(directory); const relative = path.relative(repository, target);
  if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) throw new Error('Store service data and backups outside the source repository.');
  return target;
}
export function validPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use an unprivileged TCP port (1024–65535).');
  return port;
}
async function privateWrite(file, content) { await fs.writeFile(file, content, { flag: 'wx', mode: 0o600 }); }
export async function initPostgres(directory, port = 18018) {
  const root = privateTarget(directory); port = validPort(port);
  await fs.mkdir(root, { mode: 0o700 }); // deliberately refuses an existing directory
  await fs.mkdir(path.join(root, 'data'), { mode: 0o700 });
  const databasePassword = secret();
  await privateWrite(path.join(root, 'admin-password'), secret());
  await privateWrite(path.join(root, 'init.sql'), `CREATE ROLE synapse LOGIN PASSWORD '${databasePassword}';\nCREATE DATABASE synapse OWNER synapse ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;\n`);
  const config = { server_name: 'localhost', public_baseurl: `http://127.0.0.1:${port}/`,
    listeners: [{ port: 8008, tls: false, type: 'http', x_forwarded: false, resources: [{ names: ['client'], compress: false }] }],
    database: { name: 'psycopg2', args: { user: 'synapse', password: databasePassword, dbname: 'synapse', host: 'postgres', cp_min: 2, cp_max: 5 } },
    media_store_path: '/data/media', signing_key_path: '/data/localhost.signing.key', log_config: '/data/log.yaml',
    report_stats: false, enable_registration: false, registration_shared_secret: secret(), macaroon_secret_key: secret(), form_secret: secret(),
    trusted_key_servers: [], suppress_key_server_warning: true, federation_domain_whitelist: [],
  };
  await privateWrite(path.join(root, 'data/homeserver.yaml'), JSON.stringify(config, null, 2));
  await privateWrite(path.join(root, 'data/log.yaml'), JSON.stringify({ version: 1, handlers: { console: { class: 'logging.StreamHandler' } }, root: { level: 'WARNING', handlers: ['console'] }, disable_existing_loggers: false }));
  await privateWrite(path.join(root, 'instance.json'), JSON.stringify({ schema: 1, project: 'mutual-chat-pg-' + randomBytes(8).toString('hex'), port }));
  return readInstance(root);
}
export async function readInstance(directory) {
  const root = await fs.realpath(directory);
  const info = JSON.parse(await fs.readFile(path.join(root, 'instance.json'), 'utf8'));
  if (info.schema !== 1 || !/^mutual-chat-pg-[a-f0-9]{16}$/.test(info.project)) throw new Error('Invalid PostgreSQL instance marker.');
  return { root, project: info.project, port: validPort(info.port), base: `http://127.0.0.1:${validPort(info.port)}` };
}
export async function compose(instance, args, { input, output, capture = false } = {}) {
  let text = ''; let overflow = false;
  await new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', '-p', instance.project, '-f', composeFile, ...args], {
      shell: false, env: { ...process.env, CHAT_PG_ROOT: instance.root, CHAT_PG_PORT: String(instance.port),
        SYNAPSE_UID: String(process.getuid?.() ?? 991), SYNAPSE_GID: String(process.getgid?.() ?? 991) },
      stdio: [input ?? 'ignore', output ?? (capture ? 'pipe' : 'inherit'), 'inherit'],
    });
    const timer = setTimeout(() => child.kill('SIGTERM'), 180000);
    child.stdout?.on('data', chunk => { if (text.length + chunk.length > 1024 * 1024) { overflow = true; child.kill(); } else text += chunk.toString(); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code === 0 && !overflow ? resolve() : reject(new Error('PostgreSQL compose operation failed. Check local service logs; do not upload secrets.')); });
  });
  return text;
}
export async function startPostgres(instance) { await compose(instance, ['up', '-d']); await waitForServer(instance.base); }
async function digest(file) {
  const handle = await fs.open(file, 'r'); const hash = createHash('sha256');
  try { for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk); }
  finally { await handle.close(); }
  return hash.digest('hex');
}
export async function snapshotPostgres(instance, destination) {
  const target = privateTarget(destination);
  await fs.mkdir(target, { mode: 0o700 }); // no overwrite of backups
  let stopped = false;
  try {
    await compose(instance, ['stop', 'synapse']); stopped = true;
    // No app writes while both SQL and media/config are copied. DB stays running.
    const dump = await fs.open(path.join(target, 'database.dump'), 'wx', 0o600);
    try { await compose(instance, ['exec', '-T', 'postgres', 'pg_dump', '-U', 'postgres', '-d', 'synapse', '-Fc', '--exclude-table-data=public.e2e_one_time_keys_json'], { output: dump.fd }); }
    finally { await dump.close(); }
    for (const name of ['data', 'admin-password', 'init.sql']) await fs.cp(path.join(instance.root, name), path.join(target, name), { recursive: true, force: false, errorOnExist: true });
    await privateWrite(path.join(target, 'snapshot.json'), JSON.stringify({ schema: 1, postgres: '17.11', synapse: '1.160.0', dumpSha256: await digest(path.join(target, 'database.dump')) }));
    return target;
  } finally { if (stopped) await startPostgres(instance); }
}
export async function restorePostgres(snapshot, destination, port = 18019) {
  snapshot = await fs.realpath(snapshot); port = validPort(port);
  const meta = JSON.parse(await fs.readFile(path.join(snapshot, 'snapshot.json'), 'utf8'));
  if (meta.schema !== 1 || meta.postgres !== '17.11' || meta.synapse !== '1.160.0' || meta.dumpSha256 !== await digest(path.join(snapshot, 'database.dump'))) throw new Error('Snapshot version or checksum mismatch.');
  const root = privateTarget(destination); await fs.mkdir(root, { mode: 0o700 });
  for (const name of ['data', 'admin-password', 'init.sql']) await fs.cp(path.join(snapshot, name), path.join(root, name), { recursive: true, force: false, errorOnExist: true });
  await privateWrite(path.join(root, 'instance.json'), JSON.stringify({ schema: 1, project: 'mutual-chat-pg-' + randomBytes(8).toString('hex'), port }));
  const instance = await readInstance(root);
  const configPath = path.join(root, 'data/homeserver.yaml');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  config.public_baseurl = instance.base + '/';
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  await compose(instance, ['up', '-d', '--wait', 'postgres']);
  const count = await compose(instance, ['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'synapse', '-Atc', "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"], { capture: true });
  if (count.trim() !== '0') throw new Error('Refusing restore into a nonempty database.');
  const dump = await fs.open(path.join(snapshot, 'database.dump'), 'r');
  try { await compose(instance, ['exec', '-T', 'postgres', 'pg_restore', '-U', 'postgres', '-d', 'synapse', '--exit-on-error', '--single-transaction'], { input: dump.fd }); }
  finally { await dump.close(); }
  await startPostgres(instance);
  return instance;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [action, directory, extra, port] = process.argv.slice(2);
  if (!directory) throw new Error('Specify an explicit private directory outside this repository.');
  if (action === 'init') await initPostgres(directory, extra || 18018);
  else if (action === 'up') await startPostgres(await readInstance(directory));
  else if (action === 'stop') await compose(await readInstance(directory), ['stop']);
  else if (action === 'snapshot' && extra) await snapshotPostgres(await readInstance(directory), extra);
  else if (action === 'restore' && extra) await restorePostgres(directory, extra, port || 18019);
  else throw new Error('Actions: init DIR [PORT], up DIR, stop DIR, snapshot DIR NEW_BACKUP, restore BACKUP NEW_DIR [PORT].');
}
