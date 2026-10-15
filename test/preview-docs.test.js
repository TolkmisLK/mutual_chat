import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareEmbedGuide } from '../tool/prepare-preview-docs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = 'a'.repeat(40);
const tag = 'v0.1.0-preview.2';

test('the actual packaged embedding guide pins every cross-reference to its release commit', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-preview-guide-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const outputFile = path.join(temp, 'EMBEDDING.md');
  execFileSync(process.execPath, ['tool/prepare-preview-docs.js', tag, sha, outputFile], { cwd: root });
  const guide = await fs.readFile(outputFile, 'utf8');
  assert.ok(guide.includes(tag));
  assert.equal(guide.includes('v0.1.0-preview.1'), false);
  const links = [...guide.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(match => match[1]);
  assert.equal(links.some(link => !/^https:\/\//.test(link)), false);
  const pinned = `https://github.com/TolkmisLK/mutual_chat/blob/${sha}/`;
  const expected = [
    'docs/PREVIEW-RELEASE.md', 'examples/embed-host/main.js', 'docs/SESSION-SECURITY.md',
    'examples/embed-host/README.md', 'docs/VALIDATION.md', 'docs/ROADMAP.md', 'docs/LOCAL-SERVER.md',
  ];
  for (const file of expected) assert.ok(links.includes(pinned + file), `Missing pinned link to ${file}`);
  assert.equal(links.filter(link => link.startsWith(pinned)).length, 9);
});

test('packaging refuses a missing or escaping relative guide link', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-preview-guide-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  await fs.mkdir(path.join(temp, 'docs'));
  await fs.writeFile(path.join(temp, 'package.json'), '{"version":"0.1.0"}');
  const source = path.join(temp, 'docs', 'EMBEDDING.md');
  await fs.writeFile(source, '[missing](MISSING.md)');
  await assert.rejects(prepareEmbedGuide({ root: temp, tag, sha }));
  await fs.writeFile(source, '[outside](../../private.md)');
  await assert.rejects(prepareEmbedGuide({ root: temp, tag, sha }));
});
