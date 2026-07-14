import { describe, it, expect } from 'vitest';
import {
  PBKDF2_SALT_LENGTH_BYTES,
  GCM_NONCE_LENGTH_BYTES,
  AES_KEY_LENGTH_BYTES,
  bytesToHex,
  hexToBytes,
  deriveKeyFromPassword,
  encryptWithKey,
  decryptWithKey,
} from './backupCrypto';

describe('bytesToHex / hexToBytes', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
  });

  it('produces lowercase, zero-padded hex', () => {
    expect(bytesToHex(new Uint8Array([0, 255]))).toBe('00ff');
  });
});

describe('deriveKeyFromPassword', () => {
  const salt = new Uint8Array(PBKDF2_SALT_LENGTH_BYTES).fill(7);

  it('derives a key of the expected length', () => {
    const key = deriveKeyFromPassword('correct horse battery staple', salt);
    expect(key).toHaveLength(AES_KEY_LENGTH_BYTES);
  });

  it('is deterministic for the same password and salt', () => {
    const key1 = deriveKeyFromPassword('same-password', salt);
    const key2 = deriveKeyFromPassword('same-password', salt);
    expect(key1).toEqual(key2);
  });

  it('produces a different key for a different password', () => {
    const key1 = deriveKeyFromPassword('password-one', salt);
    const key2 = deriveKeyFromPassword('password-two', salt);
    expect(key1).not.toEqual(key2);
  });

  it('produces a different key for a different salt', () => {
    const otherSalt = new Uint8Array(PBKDF2_SALT_LENGTH_BYTES).fill(9);
    const key1 = deriveKeyFromPassword('same-password', salt);
    const key2 = deriveKeyFromPassword('same-password', otherSalt);
    expect(key1).not.toEqual(key2);
  });
});

describe('encryptWithKey / decryptWithKey', () => {
  const salt = new Uint8Array(PBKDF2_SALT_LENGTH_BYTES).fill(3);
  const nonce = new Uint8Array(GCM_NONCE_LENGTH_BYTES).fill(5);
  const key = deriveKeyFromPassword('backup-password', salt);
  const plaintext = new TextEncoder().encode('geheime Tagebuch-Daten');

  it('round-trips plaintext through encrypt then decrypt', () => {
    const ciphertext = encryptWithKey(plaintext, key, nonce);
    const decrypted = decryptWithKey(ciphertext, key, nonce);
    expect(decrypted).toEqual(plaintext);
  });

  it('produces ciphertext different from the plaintext', () => {
    const ciphertext = encryptWithKey(plaintext, key, nonce);
    expect(ciphertext).not.toEqual(plaintext);
  });

  it('throws when decrypting with the wrong key', () => {
    const wrongKey = deriveKeyFromPassword('different-password', salt);
    const ciphertext = encryptWithKey(plaintext, key, nonce);
    expect(() => decryptWithKey(ciphertext, wrongKey, nonce)).toThrow();
  });

  it('throws when decrypting with the wrong nonce', () => {
    const wrongNonce = new Uint8Array(GCM_NONCE_LENGTH_BYTES).fill(6);
    const ciphertext = encryptWithKey(plaintext, key, nonce);
    expect(() => decryptWithKey(ciphertext, key, wrongNonce)).toThrow();
  });
});
