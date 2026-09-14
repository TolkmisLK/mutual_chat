import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyPrivateSnapshot } from '../tool/fixture-snapshot.js';

test('snapshot copies into a new child directory and never changes the source', async t => {
  const source = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-snapshot-source-'));
  t.after(() => fs.rm(source, { recursive: true, force: true }));
  await fs.mkdir(path.join(source, 'media'));
  await fs.writeFile(path.join(source, 'config'), 'fixture configuration', { mode: 0o600 });
  await fs.writeFile(path.join(source, 'media', 'sample'), Buffer.from([0, 255, 128]));
  const { snapshot, data } = await copyPrivateSnapshot(source);
  t.after(() => fs.rm(snapshot, { recursive: true, force: true }));
  assert.equal(await fs.readFile(path.join(data, 'config'), 'utf8'), 'fixture configuration');
  assert.deepEqual(await fs.readFile(path.join(data, 'media', 'sample')), Buffer.from([0, 255, 128]));
  if (process.platform !== 'win32') assert.equal((await fs.stat(snapshot)).mode & 0o777, 0o700);
  await fs.writeFile(path.join(data, 'config'), 'changed copy');
  assert.equal(await fs.readFile(path.join(source, 'config'), 'utf8'), 'fixture configuration');
});
