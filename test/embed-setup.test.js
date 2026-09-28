import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareHost, connectionHint } from '../examples/embed-host/setup.js';

test('embed preflight rejects unsupported environments and unsafe origins', () => {
  const supported = { secureContext: true, locks: {} };
  assert.throws(() => prepareHost('https://matrix.example.org', { ...supported, secureContext: false }), e => e.setupCode === 'secure-context');
  assert.throws(() => prepareHost('https://matrix.example.org', { secureContext: true }), e => e.setupCode === 'web-locks');
  for (const url of ['http://matrix.example.org', 'https://user:secret@matrix.example.org', 'https://matrix.example.org?token=secret']) {
    assert.throws(() => prepareHost(url, supported), e => e.setupCode === 'server-address');
  }
  assert.equal(prepareHost('https://matrix.example.org', supported), 'https://matrix.example.org');
  assert.equal(prepareHost('http://localhost:18008', supported), 'http://localhost:18008');
});

test('embed errors distinguish recovery actions without exposing remote content', () => {
  assert.match(connectionHint({ errcode: 'M_FORBIDDEN', message: 'secret' }, 'login'), /密码/);
  assert.match(connectionHint({ httpStatus: 429 }, 'login'), /稍后/);
  assert.match(connectionHint({ setupCode: 'window-busy' }, 'setup'), /另一个/);
  assert.match(connectionHint({}, 'crypto'), /存储/);
  assert.doesNotMatch(connectionHint({ message: '<script>secret</script>', errcode: 'secret' }, 'login'), /secret|script/);
});
