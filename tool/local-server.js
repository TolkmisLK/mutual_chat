// Isolated loopback development server. Not a production deployment launcher.
import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const directory = fileURLToPath(new URL('../deploy/local/data/', import.meta.url));
export const base = 'http://127.0.0.1:18008';
const compose = fileURLToPath(new URL('../deploy/local/compose.yaml', import.meta.url));
export async function docker(args) {
  await new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', '-p', 'mutual-chat-local', '-f', compose, ...args], {
      stdio: 'inherit', shell: false, env: { ...process.env,
        SYNAPSE_UID: String(process.getuid?.() ?? 991), SYNAPSE_GID: String(process.getgid?.() ?? 991) },
    });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Docker exited ${code}`)));
  });
}
export async function init() {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const secret = () => randomBytes(32).toString('hex');
  const config = { server_name: 'localhost', public_baseurl: base + '/', pid_file: '/data/synapse.pid',
    listeners: [{ port: 8008, tls: false, type: 'http', x_forwarded: false, resources: [{ names: ['client'], compress: false }] }],
    database: { name: 'sqlite3', args: { database: '/data/homeserver.db' } }, media_store_path: '/data/media',
    signing_key_path: '/data/localhost.signing.key', log_config: '/data/log.yaml', report_stats: false,
    enable_registration: false, registration_shared_secret: secret(), macaroon_secret_key: secret(), form_secret: secret(),
    trusted_key_servers: [], suppress_key_server_warning: true, federation_domain_whitelist: [],
    rc_login: { address: { per_second: 1, burst_count: 20 }, account: { per_second: 1, burst_count: 20 }, failed_attempts: { per_second: 1, burst_count: 20 } },
  };
  try { await fs.writeFile(directory + 'homeserver.yaml', JSON.stringify(config, null, 2), { flag: 'wx', mode: 0o600 }); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
  const logs = { version: 1, formatters: { plain: { format: '%(asctime)s %(levelname)s %(name)s %(message)s' } },
    handlers: { console: { class: 'logging.StreamHandler', formatter: 'plain' } }, root: { level: 'WARNING', handlers: ['console'] }, disable_existing_loggers: false };
  try { await fs.writeFile(directory + 'log.yaml', JSON.stringify(logs), { flag: 'wx', mode: 0o600 }); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
}
export async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(base + '/_matrix/client/versions', { signal: AbortSignal.timeout(2000) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Local Synapse did not become ready within 90 seconds');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const action = process.argv[2] || 'up';
  if (action === 'up') { await init(); await docker(['up', '-d']); await waitForServer(); console.log('Local Matrix server ready on ' + base); }
  else if (action === 'stop') await docker(['stop']);
  else if (action === 'restart') { await docker(['restart']); await waitForServer(); }
  else throw new Error('Supported actions: up, stop, restart. No automatic data deletion.');
}
