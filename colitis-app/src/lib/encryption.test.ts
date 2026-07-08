import { describe, it, expect, vi, beforeEach } from 'vitest';

const storeMock = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(storeMock.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    storeMock.set(key, value);
    return Promise.resolve();
  }),
}));

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn((length: number) =>
    Promise.resolve(new Uint8Array(length).map((_, i) => i % 256))
  ),
}));

import { generateOrGetDbKey } from './encryption';

beforeEach(() => {
  storeMock.clear();
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
