const { app, BrowserWindow, Menu, protocol, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { CSP, assetPath, isApplicationPage } = require('./policy.cjs');

app.setName('MutualChat'); app.setAppUserModelId('dev.ncc.mutualchat'); app.enableSandbox();
const profile = app.commandLine.getSwitchValue('user-data-dir');
if (profile) { if (!path.isAbsolute(profile)) throw new Error('Profile directory must be absolute'); app.setPath('userData', profile); }
protocol.registerSchemesAsPrivileged([{ scheme: 'mutual-chat', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
let window;
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.on('will-download', event => event.preventDefault());
    protocol.handle('mutual-chat', async request => {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      try {
        const file = assetPath(request.url, path.join(__dirname, '..', 'app'));
        const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm' }[path.extname(file)];
        return new Response(await fs.readFile(file), { headers: { 'Content-Type': type, 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
      } catch { return new Response('Not found', { status: 404 }); }
    });
    window = new BrowserWindow({ width: 1200, height: 850, minWidth: 380, minHeight: 600, show: false, title: 'Mutual Chat',
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false, allowRunningInsecureContent: false, spellcheck: false } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => { if (!isApplicationPage(url)) event.preventDefault(); });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.once('ready-to-show', () => window.show());
    await window.loadURL('mutual-chat://app/');
  }).catch(error => { console.error('Desktop startup failed:', error.message); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
}
