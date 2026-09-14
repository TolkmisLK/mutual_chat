import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { directory, docker, waitForServer } from './local-server.js';

// Rehearse restoration into an independent disposable server; never replace source data.
export async function checkRestoredSnapshot(check) {
  const snapshot = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-chat-restore-'));
  await fs.chmod(snapshot, 0o700);
  const copy = { project: 'mutual-chat-restore-' + randomBytes(5).toString('hex'), data: snapshot, port: 18009 };
  let stopped = false;
  try {
    await docker(['stop']); stopped = true;
    await fs.cp(directory, snapshot, { recursive: true, force: false, errorOnExist: true });
    await docker(['up', '-d'], copy); await waitForServer('http://127.0.0.1:18009');
    await check('http://127.0.0.1:18009');
  } finally {
    // Do not delete a bind mount until the copied server has stopped successfully.
    await docker(['down'], copy);
    await fs.rm(snapshot, { recursive: true, force: true });
    if (stopped) { await docker(['up', '-d']); await waitForServer(); }
  }
}
