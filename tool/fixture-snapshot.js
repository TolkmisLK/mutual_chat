import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { directory, docker, waitForServer } from './local-server.js';

export async function copyPrivateSnapshot(source) {
  const snapshot = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-chat-restore-'));
  await fs.chmod(snapshot, 0o700);
  const data = path.join(snapshot, 'data');
  try { await fs.cp(source, data, { recursive: true, force: false, errorOnExist: true }); }
  catch (error) { await fs.rm(snapshot, { recursive: true, force: true }); throw error; }
  return { snapshot, data };
}

// Rehearse restoration into an independent disposable server; never replace source data.
export async function checkRestoredSnapshot(check) {
  let snapshot; let copy;
  let stopped = false;
  try {
    await docker(['stop']); stopped = true;
    const saved = await copyPrivateSnapshot(directory); snapshot = saved.snapshot;
    copy = { project: 'mutual-chat-restore-' + randomBytes(5).toString('hex'), data: saved.data, port: 18009 };
    await docker(['up', '-d'], copy); await waitForServer('http://127.0.0.1:18009');
    await check('http://127.0.0.1:18009');
  } finally {
    // Do not delete a bind mount until the copied server has stopped successfully.
    try {
      if (copy) await docker(['down'], copy);
      if (snapshot) await fs.rm(snapshot, { recursive: true, force: true });
    } finally {
      if (stopped) { await docker(['up', '-d']); await waitForServer(); }
    }
  }
}
