import { describe, it, expect, vi, beforeEach } from 'vitest';

const storeMock = new Map<string, string>();
let cryptoCallCount = 0;

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
  getRandomBytesAsync: vi.fn((length: number) => {
    cryptoCallCount++;
    return Promise.resolve(new Uint8Array(length).map((_, i) => (i + cryptoCallCount) % 256));
  }),
}));

import { generateOrGetDbKey, clearDbKey } from './encryption';

beforeEach(() => {
  storeMock.clear();
  cryptoCallCount = 0;
  vi.clearAllMocks();
});

describe('generateOrGetDbKey', () => {
  it('generates a 64-character hex key on first call', async () => {
    const key = await generateOrGetDbKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('persists the generated key in SecureStore', async () => {
    const key = await generateOrGetDbKey();
    expect(storeMock.get('colitis_db_encryption_key')).toBe(key);
  });

  it('returns the same key on subsequent calls without generating a new one', async () => {
    const Crypto = await import('expo-crypto');
    const first = await generateOrGetDbKey();
    const second = await generateOrGetDbKey();
    expect(second).toBe(first);
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledTimes(1);
  });
});

describe('clearDbKey', () => {
  it('removes the stored key so a subsequent call generates a new one', async () => {
    const first = await generateOrGetDbKey();
    await clearDbKey();
    const second = await generateOrGetDbKey();
    expect(second).not.toBe(first);
  });
});
