import { validateHomeserver } from '../packages/chat-core/session.js';

export const VAULT_KEY = 'mutual-chat:session:v1';
const ITERATIONS = 600000;
const aad = new TextEncoder().encode('Mutual Chat local session v1');
const encode = bytes => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
function decode(value) {
  if (typeof value !== 'string' || value.length > 65536 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid vault encoding');
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
export function randomStorageKey() { return encode(crypto.getRandomValues(new Uint8Array(32))); }
export function storageKeyBytes(value) { const key = decode(value); if (key.length !== 32) throw new Error('Invalid storage key'); return key; }
export function validateSession(value) {
  const fields = ['baseUrl', 'userId', 'deviceId', 'accessToken', 'cryptoDatabasePrefix', 'storageKey'];
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join() !== fields.sort().join() ||
      fields.some(k => typeof value[k] !== 'string' || !value[k] || value[k].length > 16384)) throw new Error('Invalid stored session');
  if (validateHomeserver(value.baseUrl) !== value.baseUrl || !/^@[^\s:]+:[^\s]+$/.test(value.userId) ||
      !/^mutual-chat-v1-[a-f0-9-]{36}$/.test(value.cryptoDatabasePrefix)) throw new Error('Invalid stored identity');
  storageKeyBytes(value.storageKey); return value;
}
async function keyFromPassphrase(passphrase, salt) {
  if (typeof passphrase !== 'string' || passphrase.length < 12 || passphrase.length > 1024) throw new Error('本机解锁口令需为 12–1024 个字符。');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function sealSession(session, passphrase) {
  validateSession(session);
  const plaintext = new TextEncoder().encode(JSON.stringify(session));
  if (plaintext.length > 32768) throw new Error('Stored session too large');
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFromPassphrase(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, key, plaintext);
  plaintext.fill(0);
  return JSON.stringify({ version: 1, salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) });
}
export async function openSession(serialized, passphrase) {
  if (typeof serialized !== 'string' || serialized.length > 65536) throw new Error('Invalid vault');
  const value = JSON.parse(serialized);
  if (!value || value.version !== 1 || Object.keys(value).sort().join() !== 'ciphertext,iv,salt,version') throw new Error('Unsupported vault');
  const salt = decode(value.salt); const iv = decode(value.iv); const ciphertext = decode(value.ciphertext);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) throw new Error('Invalid vault parameters');
  const key = await keyFromPassphrase(passphrase, salt);
  const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, key, ciphertext));
  try { return validateSession(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext))); }
  finally { plaintext.fill(0); }
}
