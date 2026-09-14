import test from 'node:test';
import assert from 'node:assert/strict';
import { sealSession, openSession, validateSession, randomStorageKey, storageKeyBytes } from '../src/session-vault.js';

const passphrase = 'fixture-only-long-local-passphrase';
const session = () => ({ baseUrl: 'https://matrix.example.org', userId: '@test:matrix.example.org', deviceId: 'fixture-device',
  accessToken: 'fixture-access-token-canary', cryptoDatabasePrefix: 'mutual-chat-v1-12345678-1234-1234-1234-123456789abc', storageKey: randomStorageKey() });
test('encrypted vault round trip preserves identity and random SDK key without plaintext credentials', async () => {
  const source = session(); const sealed = await sealSession(source, passphrase);
  assert.deepEqual(await openSession(sealed, passphrase), source);
  for (const secret of [source.accessToken, source.storageKey, source.userId, passphrase]) assert(!sealed.includes(secret));
  assert.equal(storageKeyBytes(source.storageKey).length, 32);
  const second = await sealSession(source, passphrase);
  assert.notEqual(JSON.parse(sealed).salt, JSON.parse(second).salt); assert.notEqual(JSON.parse(sealed).iv, JSON.parse(second).iv);
  assert.notEqual(sealed, second);
});
test('wrong passphrase and modified authenticated payloads cannot open a vault', async () => {
  const sealed = await sealSession(session(), passphrase);
  await assert.rejects(openSession(sealed, 'fixture-but-wrong-passphrase'));
  for (const field of ['ciphertext', 'salt', 'iv']) {
    const corrupt = JSON.parse(sealed); const bytes = Buffer.from(corrupt[field], 'base64'); bytes[0] ^= 1; corrupt[field] = bytes.toString('base64');
    await assert.rejects(openSession(JSON.stringify(corrupt), passphrase));
  }
});
test('vault rejects unknown schema, unbounded inputs and weak or unbounded passphrases', async () => {
  for (const invalid of ['null', '{}', '{', 'x'.repeat(65537), JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, iterations: 1e20 })]) {
    await assert.rejects(openSession(invalid, passphrase));
  }
  await assert.rejects(sealSession(session(), 'short'));
  await assert.rejects(sealSession(session(), 'x'.repeat(1025)));
});
test('stored identity cannot select arbitrary crypto databases or insecure remote servers', () => {
  for (const override of [{ cryptoDatabasePrefix: 'another-app' }, { baseUrl: 'http://remote.example' }, { storageKey: 'invalid' },
    { baseUrl: 'https://user:password@example.org' }, { userId: 'not-a-matrix-id' }, { password: 'unexpected secret' }]) {
    assert.throws(() => validateSession({ ...session(), ...override }));
  }
});
