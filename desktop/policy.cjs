const path = require('node:path');
const CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: http://localhost:* http://127.0.0.1:* http://[::1]:*; img-src 'self' data:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
function assetPath(requestUrl, root) {
  const url = new URL(requestUrl);
  if (url.protocol !== 'mutual-chat:' || url.host !== 'app' || url.username || url.password || url.search) throw new Error('Unknown application resource');
  const name = decodeURIComponent(url.pathname);
  if (name === '/' || name === '/index.html') return path.join(root, 'index.html');
  if (!/^\/assets\/[A-Za-z0-9_.-]+\.(?:js|css|wasm)$/.test(name)) throw new Error('Unknown application resource');
  return path.join(root, name.slice(1));
}
function isApplicationPage(value) {
  try { const url = new URL(value); return url.protocol === 'mutual-chat:' && url.host === 'app' && !url.username && !url.password && !url.search && ['/', '/index.html'].includes(url.pathname); }
  catch { return false; }
}
module.exports = { CSP, assetPath, isApplicationPage };
