import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { selectRun, verifyEvidence, verifyChecksum, verifyWebTree, verifyWindowsEntries } from '../tool/preview-release-guard.js';

const sha = 'a'.repeat(40);
const repository = 'TolkmisLK/mutual_chat';
const workflow = { id: 123, path: '.github/workflows/ci.yml' };
const run = { id: 456, workflow_id: 123, path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main', head_sha: sha,
  head_repository: { full_name: repository }, status: 'completed', conclusion: 'success' };
const source = { version: '0.1.0', tag: 'v0.1.0-preview.1', sha, repository, workflow, listing: { total_count: 1, workflow_runs: [run] } };

test('release source must be one successful main-push CI at the exact tag SHA', () => {
  assert.equal(selectRun(source), 456);
  for (const bad of [
    { tag: 'v0.1.0-preview.0' },
    { sha: 'b'.repeat(40) },
    { listing: { total_count: 2, workflow_runs: [run, run] } },
    { listing: { total_count: 1, workflow_runs: [{ ...run, event: 'pull_request' }] } },
    { listing: { total_count: 1, workflow_runs: [{ ...run, head_branch: 'feature' }] } },
    { listing: { total_count: 1, workflow_runs: [{ ...run, conclusion: 'failure' }] } },
    { listing: { total_count: 1, workflow_runs: [{ ...run, path: '.github/workflows/other.yml' }] } },
  ]) assert.throws(() => selectRun({ ...source, ...bad }));
});

test('release evidence requires all jobs and the two unexpired selected artifacts', () => {
  const names = ['desktop-matrix', 'windows-desktop', 'check', 'integration'];
  const jobList = { total_count: names.length, jobs: names.map(name => ({ name, run_id: 456, status: 'completed', conclusion: 'success' })) };
  const artifactList = { total_count: 2, artifacts: ['mutual-chat-windows-desktop', 'mutual-chat-web-and-widget']
    .map(name => ({ name, expired: false, size_in_bytes: 12, workflow_run: { id: 456 } })) };
  assert.doesNotThrow(() => verifyEvidence({ runId: 456, jobList, artifactList }));
  assert.throws(() => verifyEvidence({ runId: 456, jobList: { ...jobList, jobs: jobList.jobs.slice(1) }, artifactList }));
  assert.throws(() => verifyEvidence({ runId: 456, jobList, artifactList: { ...artifactList, artifacts: [{ ...artifactList.artifacts[0], expired: true }, artifactList.artifacts[1]] } }));
  assert.throws(() => verifyEvidence({ runId: 456, jobList, artifactList: { total_count: 2, artifacts: [artifactList.artifacts[0], artifactList.artifacts[0]] } }));
});

test('checksums and web roots reject changed or unexpected public payloads', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-preview-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const zip = path.join(root, 'preview.zip'); const sum = `${zip}.sha256`;
  await fs.writeFile(zip, 'fixture');
  await fs.writeFile(sum, `${createHash('sha256').update('fixture').digest('hex')}  preview.zip\n`);
  await verifyChecksum(zip, sum);
  await fs.writeFile(zip, 'changed'); await assert.rejects(verifyChecksum(zip, sum));
  const web = path.join(root, 'web');
  for (const dir of ['app', 'widget', 'embed-host']) await fs.mkdir(path.join(web, dir), { recursive: true });
  for (const file of ['app/index.html', 'widget/mutual-chat.js', 'embed-host/index.html']) await fs.writeFile(path.join(web, file), 'public');
  assert.equal(await verifyWebTree(web), 3);
  await fs.writeFile(path.join(web, 'app', '.env.local'), 'secret'); await assert.rejects(verifyWebTree(web));
});

test('Windows archive has the expected app root and no private entries', () => {
  const files = ['MutualChat-win32-x64/MutualChat.exe', 'MutualChat-win32-x64/resources/app.asar'];
  assert.doesNotThrow(() => verifyWindowsEntries(files));
  for (const entry of ['MutualChat-win32-x64/desktop-evidence/result.json', 'MutualChat-win32-x64/.env.local',
    'MutualChat-win32-x64/../secret', 'other/MutualChat.exe']) {
    assert.throws(() => verifyWindowsEntries([...files, entry]));
  }
});
