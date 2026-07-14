import { describe, it, expect, vi, beforeEach } from 'vitest';

const deleteDatabaseAsync = vi.fn((..._args: unknown[]) => Promise.resolve());

vi.mock('expo-sqlite', () => ({
  deleteDatabaseAsync: (...args: unknown[]) => deleteDatabaseAsync(...args),
}));

const clearDbKey = vi.fn(() => Promise.resolve());
vi.mock('./encryption', () => ({
  clearDbKey: () => clearDbKey(),
}));

const resetAppLock = vi.fn(() => Promise.resolve());
vi.mock('../features/appLock/pinAuth', () => ({
  resetAppLock: () => resetAppLock(),
}));

const resetDbCache = vi.fn();
vi.mock('../db/client', () => ({
  DB_FILE_NAME: 'colitis.db',
  resetDbCache: () => resetDbCache(),
}));

import { resetAppData } from './appReset';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resetAppData', () => {
  it('deletes the database file by its configured name', async () => {
    await resetAppData();
    expect(deleteDatabaseAsync).toHaveBeenCalledWith('colitis.db');
  });

  it('clears the DB key, resets the app lock, and resets the DB cache', async () => {
    await resetAppData();
    expect(clearDbKey).toHaveBeenCalledTimes(1);
    expect(resetAppLock).toHaveBeenCalledTimes(1);
    expect(resetDbCache).toHaveBeenCalledTimes(1);
  });
});
