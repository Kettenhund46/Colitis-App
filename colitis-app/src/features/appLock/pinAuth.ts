import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const PIN_HASH_STORAGE_KEY = 'colitis_app_lock_pin_hash';
const PIN_SALT_STORAGE_KEY = 'colitis_app_lock_pin_salt';
const LOCK_ENABLED_STORAGE_KEY = 'colitis_app_lock_enabled';

export async function isAppLockEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(LOCK_ENABLED_STORAGE_KEY);
  return value === 'true';
}

export async function setPin(pin: string): Promise<void> {
  const salt = Crypto.randomUUID();
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(PIN_SALT_STORAGE_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_STORAGE_KEY, hash);
  await SecureStore.setItemAsync(LOCK_ENABLED_STORAGE_KEY, 'true');
}

export async function verifyPin(pin: string): Promise<boolean> {
  const salt = await SecureStore.getItemAsync(PIN_SALT_STORAGE_KEY);
  const storedHash = await SecureStore.getItemAsync(PIN_HASH_STORAGE_KEY);
  if (!salt || !storedHash) {
    return false;
  }
  const hash = await hashPin(pin, salt);
  return hash === storedHash;
}

export async function disableAppLock(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_STORAGE_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_STORAGE_KEY);
  await SecureStore.setItemAsync(LOCK_ENABLED_STORAGE_KEY, 'false');
}

export async function resetAppLock(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_STORAGE_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_STORAGE_KEY);
  await SecureStore.deleteItemAsync(LOCK_ENABLED_STORAGE_KEY);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}
