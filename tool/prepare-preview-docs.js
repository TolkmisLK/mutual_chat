import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = 'https://github.com/TolkmisLK/mutual_chat';
const guide = 'docs/EMBEDDING.md';
const markdownLink = /(\[[^\]]+\]\()([^)]+)(\))/g;

export async function prepareEmbedGuide({ root, tag, sha }) {
  assert.match(tag, /^v\d+\.\d+\.\d+-preview\.[1-9]\d*$/);
  assert.match(sha, /^[a-f0-9]{40}$/);
  const version = tag.match(/^v(\d+\.\d+\.\d+)-preview\./)[1];
  const packageVersion = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
  assert.equal(version, packageVersion);
  const source = path.join(root, guide);
  const markdown = await fs.readFile(source, 'utf8');
  const escapedVersion = version.replaceAll('.', '\\.');
  const currentTag = markdown.replace(new RegExp(`v${escapedVersion}-preview\\.[1-9]\\d*`, 'g'), tag);
  const links = [...currentTag.matchAll(markdownLink)];
  let converted = 0;
  const replacements = new Map();
  for (const match of links) {
    const target = match[2];
    if (/^(?:https?:\/\/|mailto:|#)/i.test(target)) continue;
    assert.equal(target.includes('?'), false, `Unsupported guide link: ${target}`);
    const [relative, anchor] = target.split('#', 2);
    assert.ok(relative && !relative.includes('\\'), `Invalid guide link: ${target}`);
    const resolved = path.resolve(path.dirname(source), relative);
    const repoPath = path.relative(root, resolved).replaceAll('\\', '/');
    assert.ok(repoPath && !repoPath.startsWith('../') && !path.isAbsolute(repoPath), `Guide link escapes repository: ${target}`);
    assert.equal((await fs.lstat(resolved)).isFile(), true, `Guide link is not a regular file: ${target}`);
    const encodedPath = repoPath.split('/').map(encodeURIComponent).join('/');
    replacements.set(target, `${repository}/blob/${sha}/${encodedPath}${anchor ? `#${anchor}` : ''}`);
    converted++;
  }
  assert.ok(converted > 0, 'Expected source guide to contain relative cross references');
  const output = currentTag.replace(markdownLink, (whole, prefix, target, suffix) =>
    `${prefix}${replacements.get(target) ?? target}${suffix}`);
  assert.equal([...output.matchAll(markdownLink)].some(match => !/^(?:https?:\/\/|mailto:|#)/i.test(match[2])), false);
  return { output, converted };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [tag, sha, destination] = process.argv.slice(2);
  assert.ok(destination, 'Usage: prepare-preview-docs.js TAG SHA DESTINATION');
  const { output, converted } = await prepareEmbedGuide({ root: process.cwd(), tag, sha });
  await fs.writeFile(destination, output);
  console.log(`Prepared ${guide}: ${converted} links pinned to ${sha}`);
}
