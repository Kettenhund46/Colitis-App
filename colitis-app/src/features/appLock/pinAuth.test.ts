import { describe, it, expect, vi, beforeEach } from 'vitest';

const storeMock = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(storeMock.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    storeMock.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    storeMock.delete(key);
    return Promise.resolve();
  }),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => 'test-salt-uuid'),
  digestStringAsync: vi.fn((_algorithm: string, data: string) => Promise.resolve(`hash(${data})`)),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  CryptoEncoding: { HEX: 'HEX' },
}));

import { isAppLockEnabled, setPin, verifyPin, disableAppLock, resetAppLock } from './pinAuth';

beforeEach(() => {
  storeMock.clear();
  vi.clearAllMocks();
});

describe('isAppLockEnabled', () => {
  it('returns false before any PIN has been set', async () => {
    expect(await isAppLockEnabled()).toBe(false);
  });

  it('returns true after setPin', async () => {
    await setPin('123456');
    expect(await isAppLockEnabled()).toBe(true);
  });
});

describe('setPin / verifyPin', () => {
  it('verifies the correct PIN', async () => {
    await setPin('123456');
    expect(await verifyPin('123456')).toBe(true);
  });

  it('rejects an incorrect PIN', async () => {
    await setPin('123456');
    expect(await verifyPin('654321')).toBe(false);
  });

  it('rejects verification when no PIN has been set', async () => {
    expect(await verifyPin('123456')).toBe(false);
  });
});

describe('disableAppLock', () => {
  it('clears the PIN and marks the lock as disabled', async () => {
    await setPin('123456');
    await disableAppLock();
    expect(await isAppLockEnabled()).toBe(false);
    expect(await verifyPin('123456')).toBe(false);
  });
});

describe('resetAppLock', () => {
  it('clears the PIN entirely, including the enabled flag', async () => {
    await setPin('123456');
    await resetAppLock();
    expect(await isAppLockEnabled()).toBe(false);
    expect(await verifyPin('123456')).toBe(false);
  });
});
