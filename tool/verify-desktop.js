import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const executablePath = path.resolve(process.argv[2] || 'dist/desktop/MutualChat-win32-x64/MutualChat.exe');
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-chat-desktop-fixture-'));
const output = path.resolve('dist/desktop-evidence'); await fs.mkdir(output, { recursive: true });
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS; delete env.NODE_PATH;
let application;
try {
  application = await electron.launch({ executablePath, args: ['--user-data-dir=' + profile], env, chromiumSandbox: true, timeout: 60000 });
  const page = await application.firstWindow(); await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('button', { name: '连接', exact: true })).toBeVisible();
  assert.equal(page.url(), 'mutual-chat://app/');
  const isolation = await page.evaluate(() => ({ node: typeof window.process, require: typeof window.require, secure: isSecureContext, locks: typeof navigator.locks?.request, subtle: typeof crypto.subtle?.encrypt }));
  assert.deepEqual(isolation, { node: 'undefined', require: 'undefined', secure: true, locks: 'function', subtle: 'function' });
  const runtime = await application.evaluate(({ app, BrowserWindow }) => {
    const prefs = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { packaged: app.isPackaged, electron: process.versions.electron, platform: process.platform, sandbox: prefs.sandbox, sandboxDisabledByArgument: app.commandLine.hasSwitch('no-sandbox'), contextIsolation: prefs.contextIsolation, nodeIntegration: prefs.nodeIntegration, webSecurity: prefs.webSecurity, profile: app.getPath('userData') };
  });
  assert.equal(runtime.packaged, true); assert.equal(runtime.electron, '44.3.0'); assert.equal(runtime.sandbox, true); assert.equal(runtime.contextIsolation, true); assert.equal(runtime.nodeIntegration, false); assert.equal(runtime.webSecurity, true);
  assert.equal(path.resolve(runtime.profile), profile);
  assert.equal(runtime.sandboxDisabledByArgument, false);
  const denied = await page.evaluate(async () => (await fetch('mutual-chat://app/desktop/main.cjs')).status); assert.equal(denied, 404);
  const popup = await page.evaluate(() => window.open('https://example.invalid/') === null); assert.equal(popup, true);
  const navigation = application.evaluate(({ BrowserWindow }) => new Promise(resolve => {
    const contents = BrowserWindow.getAllWindows()[0].webContents;
    contents.once('will-navigate', (event, url) => resolve({ url, prevented: event.defaultPrevented, current: contents.getURL() }));
  }));
  await page.evaluate(() => { location.href = 'https://example.invalid/'; });
  assert.deepEqual(await navigation, { url: 'https://example.invalid/', prevented: true, current: 'mutual-chat://app/' });
  // A deliberately cancelled navigation has no load event; inspect the live document.
  assert.equal(await page.evaluate(() => location.href), 'mutual-chat://app/'); assert.equal(application.windows().length, 1);
  // Exercise actual secure-context WebCrypto/IndexedDB/Web Locks, not a mock.
  assert.equal(await page.evaluate(async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12)); const source = new TextEncoder().encode('generated desktop fixture');
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, source);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('desktop-fixture', 1); request.onupgradeneeded = () => request.result.createObjectStore('values'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise((resolve, reject) => { const tx = db.transaction('values', 'readwrite'); tx.objectStore('values').put('fixture-value', 'key'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close();
    return navigator.locks.request('desktop-fixture', () => new TextDecoder().decode(plain) === 'generated desktop fixture');
  }), true);
  await page.screenshot({ path: path.join(output, 'windows-desktop-login.png'), fullPage: true });
  await application.close(); application = null;
  const report = { platform: runtime.platform, electron: runtime.electron, actualPackagedWindow: true, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, secureStoragePrimitives: true, restrictedProtocol: true, popupsDenied: true, externalNavigationDenied: true, profileIsolated: true, normalClose: true, matrixLoginTested: false, physicalMachineTested: false, signed: false };
  await fs.writeFile(path.join(output, 'desktop-validation.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { if (application) await application.close(); await fs.rm(profile, { recursive: true, force: true }); }
