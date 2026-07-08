import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DB_KEY_STORAGE_KEY = 'colitis_db_encryption_key';
const KEY_BYTE_LENGTH = 32;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function generateOrGetDbKey(): Promise<string> {
  const existingKey = await SecureStore.getItemAsync(DB_KEY_STORAGE_KEY);
  if (existingKey) {
    return existingKey;
  }

  const randomBytes = await Crypto.getRandomBytesAsync(KEY_BYTE_LENGTH);
  const newKey = bytesToHex(randomBytes);
  await SecureStore.setItemAsync(DB_KEY_STORAGE_KEY, newKey);
  return newKey;
}
