import { describe, it, expect, beforeEach } from 'vitest';
import {
  beginPendingPermissionRequest,
  endPendingPermissionRequest,
  isPermissionRequestPending,
} from './pendingPermissionGuard';

describe('pendingPermissionGuard', () => {
  beforeEach(() => {
    endPendingPermissionRequest();
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
});
