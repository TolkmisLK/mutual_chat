import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import policy from '../desktop/policy.cjs';
test('desktop protocol only maps bundled entry and flat compiled assets', () => {
  const root = path.resolve('fixture-app');
  assert.equal(policy.assetPath('mutual-chat://app/', root), path.join(root, 'index.html'));
  assert.equal(policy.assetPath('mutual-chat://app/assets/crypto-A23.wasm', root), path.join(root, 'assets', 'crypto-A23.wasm'));
  for (const url of ['file:///etc/passwd', 'https://app/', 'mutual-chat://user:pass@app/', 'mutual-chat://other/', 'mutual-chat://app/desktop/main.cjs', 'mutual-chat://app/assets/%2e%2e%5csecret.js', 'mutual-chat://app/assets/secret/other.js', 'mutual-chat://app/assets/secret.js?path=/etc/passwd']) assert.throws(() => policy.assetPath(url, root));
});
test('desktop top-level navigation stays on its exact local app origin', () => {
  assert.equal(policy.isApplicationPage('mutual-chat://app/#room'), true);
  for (const url of ['https://example.org', 'javascript:alert(1)', 'file:///etc/passwd', 'mutual-chat://app/assets/index.js', 'mutual-chat://other/', 'mutual-chat://user@app/']) assert.equal(policy.isApplicationPage(url), false);
});
