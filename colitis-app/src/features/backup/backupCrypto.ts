import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';

export const PBKDF2_ITERATIONS = 100_000;
export const AES_KEY_LENGTH_BYTES = 32;
export const GCM_NONCE_LENGTH_BYTES = 12;
export const PBKDF2_SALT_LENGTH_BYTES = 16;

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function deriveKeyFromPassword(password: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, password, salt, { c: PBKDF2_ITERATIONS, dkLen: AES_KEY_LENGTH_BYTES });
}

export function encryptWithKey(plaintext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
  return gcm(key, nonce).encrypt(plaintext);
}

export function decryptWithKey(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
  return gcm(key, nonce).decrypt(ciphertext);
}
