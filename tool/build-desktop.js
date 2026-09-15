import { packager } from '@electron/packager';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const platform = process.argv[2] || process.platform;
if (!['win32', 'linux'].includes(platform)) throw new Error('Only Windows and Linux preview packaging are configured');
const destination = path.resolve('dist/desktop');
const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-chat-package-'));
try {
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
  await fs.writeFile(path.join(staging, 'package.json'), JSON.stringify({ name: 'mutual-chat', productName: 'MutualChat', version: pkg.version, main: 'desktop/main.cjs', author: 'TolkmisLK', license: 'MIT' }));
  await fs.mkdir(path.join(staging, 'desktop'));
  for (const name of ['main.cjs', 'policy.cjs']) await fs.copyFile(path.join('desktop', name), path.join(staging, 'desktop', name));
  await fs.cp('dist/app', path.join(staging, 'app'), { recursive: true, errorOnExist: true, force: false });
  await fs.copyFile('LICENSE', path.join(staging, 'LICENSE'));
  await fs.copyFile('docs/DESKTOP.md', path.join(staging, 'DESKTOP.md'));
  const outputs = await packager({ dir: staging, out: destination, name: 'MutualChat', appVersion: pkg.version, executableName: 'MutualChat', platform, arch: 'x64', electronVersion: '44.3.0', asar: true, prune: false, overwrite: false });
  console.log(JSON.stringify({ outputs, electronVersion: '44.3.0', platform, arch: 'x64', signed: false }));
} finally { await fs.rm(staging, { recursive: true, force: true }); }
