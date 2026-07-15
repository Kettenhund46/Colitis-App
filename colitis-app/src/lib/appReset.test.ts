import { describe, it, expect, vi, beforeEach } from 'vitest';

const deleteDatabaseAsyncMock = vi.fn();
const resetDbCacheMock = vi.fn();
const clearDbKeyMock = vi.fn();
const resetAppLockMock = vi.fn();

vi.mock('expo-sqlite', () => ({
  deleteDatabaseAsync: (...args: unknown[]) => deleteDatabaseAsyncMock(...args),
}));

vi.mock('../db/client', () => ({
  DB_FILE_NAME: 'colitis.db',
  resetDbCache: () => resetDbCacheMock(),
}));

vi.mock('./encryption', () => ({
  clearDbKey: () => clearDbKeyMock(),
}));

vi.mock('../features/appLock/pinAuth', () => ({
  resetAppLock: () => resetAppLockMock(),
}));

import { resetAppData } from './appReset';

beforeEach(() => {
  vi.clearAllMocks();
  deleteDatabaseAsyncMock.mockResolvedValue(undefined);
  resetDbCacheMock.mockReturnValue(undefined);
  clearDbKeyMock.mockResolvedValue(undefined);
  resetAppLockMock.mockResolvedValue(undefined);
});

describe('resetAppData', () => {
  it('runs all reset steps when everything succeeds', async () => {
    await expect(resetAppData()).resolves.toBeUndefined();
    expect(deleteDatabaseAsyncMock).toHaveBeenCalledWith('colitis.db');
    expect(clearDbKeyMock).toHaveBeenCalled();
    expect(resetAppLockMock).toHaveBeenCalled();
    expect(resetDbCacheMock).toHaveBeenCalled();
  });

  it('still attempts every remaining step when one step fails, then throws naming it', async () => {
    clearDbKeyMock.mockRejectedValueOnce(new Error('SecureStore kaputt'));

    await expect(resetAppData()).rejects.toThrow('Datenbank-Schlüssel löschen');

    expect(deleteDatabaseAsyncMock).toHaveBeenCalled();
    expect(clearDbKeyMock).toHaveBeenCalled();
    expect(resetAppLockMock).toHaveBeenCalled();
    expect(resetDbCacheMock).toHaveBeenCalled();
  });

  it('names every failed step when multiple steps fail', async () => {
    deleteDatabaseAsyncMock.mockRejectedValueOnce(new Error('DB gesperrt'));
    resetAppLockMock.mockRejectedValueOnce(new Error('SecureStore kaputt'));

    let caught: unknown;
    try {
      await resetAppData();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toContain('Datenbank löschen');
    expect(message).toContain('PIN zurücksetzen');
  });
});
