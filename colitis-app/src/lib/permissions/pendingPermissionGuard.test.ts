import { describe, it, expect, beforeEach } from 'vitest';
import {
  beginPendingPermissionRequest,
  endPendingPermissionRequest,
  isPermissionRequestPending,
  resetPendingPermissionRequests,
  runWithPendingPermission,
} from './pendingPermissionGuard';

describe('pendingPermissionGuard', () => {
  beforeEach(() => {
    resetPendingPermissionRequests();
  });

  it('reports not pending before any request begins', () => {
    expect(isPermissionRequestPending()).toBe(false);
  });

  it('reports pending after a request begins', () => {
    beginPendingPermissionRequest();
    expect(isPermissionRequestPending()).toBe(true);
  });

  it('reports not pending again after a request ends', () => {
    beginPendingPermissionRequest();
    endPendingPermissionRequest();
    expect(isPermissionRequestPending()).toBe(false);
  });

  it('ending without a matching begin does not throw and stays not pending', () => {
    expect(() => endPendingPermissionRequest()).not.toThrow();
    expect(isPermissionRequestPending()).toBe(false);
  });

  it('stays pending while a second request is still open', () => {
    // Standort und Benachrichtigungen koennen kurz nacheinander fragen. Ein
    // einzelnes Flag wuerde hier zu frueh geloescht.
    beginPendingPermissionRequest();
    beginPendingPermissionRequest();
    endPendingPermissionRequest();
    expect(isPermissionRequestPending()).toBe(true);
    endPendingPermissionRequest();
    expect(isPermissionRequestPending()).toBe(false);
  });
});

describe('runWithPendingPermission', () => {
  beforeEach(() => {
    resetPendingPermissionRequests();
  });

  it('holds the marker while the request runs', async () => {
    let pendingWhileRunning = false;
    await runWithPendingPermission(async () => {
      pendingWhileRunning = isPermissionRequestPending();
      return 'granted';
    });
    expect(pendingWhileRunning).toBe(true);
    expect(isPermissionRequestPending()).toBe(false);
  });

  it('passes the result through', async () => {
    await expect(runWithPendingPermission(async () => 42)).resolves.toBe(42);
  });

  it('releases the marker when the request throws', async () => {
    // Bleibt der Merker haengen, sperrt die App nie wieder zu.
    await expect(
      runWithPendingPermission(async () => {
        throw new Error('abgelehnt');
      })
    ).rejects.toThrow('abgelehnt');
    expect(isPermissionRequestPending()).toBe(false);
  });
});
