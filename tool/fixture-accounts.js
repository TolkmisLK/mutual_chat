import { createHmac } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { directory, base } from './local-server.js';
// Official Synapse shared-secret registration; local fixture only, never print tokens.
export async function register(username, password) {
  const config = JSON.parse(await fs.readFile(directory + 'homeserver.yaml', 'utf8'));
  const url = base + '/_synapse/admin/v1/register';
  const { nonce } = await (await fetch(url)).json();
  const mac = createHmac('sha1', config.registration_shared_secret).update([nonce, username, password, 'notadmin'].join('\0')).digest('hex');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nonce, username, password, admin: false, mac, inhibit_login: true }) });
  if (!response.ok) throw new Error(`Fixture registration failed (${response.status})`);
  const auth = await response.json();
  // Older servers can ignore inhibit_login on this admin API: revoke bootstrap session.
  if (auth.access_token) await fetch(base + '/_matrix/client/v3/logout', { method: 'POST', headers: { Authorization: `Bearer ${auth.access_token}` } });
  return auth.user_id;
}
