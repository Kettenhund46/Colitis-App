import { describe, it, expect, vi, beforeEach } from 'vitest';

const hasHardwareAsync = vi.fn((..._args: unknown[]) => Promise.resolve(true));
const isEnrolledAsync = vi.fn((..._args: unknown[]) => Promise.resolve(true));
const authenticateAsync = vi.fn<(..._args: unknown[]) => Promise<{ success: boolean; error?: string }>>(
  (..._args: unknown[]) => Promise.resolve({ success: true }),
);

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: (...args: unknown[]) => hasHardwareAsync(...args),
  isEnrolledAsync: (...args: unknown[]) => isEnrolledAsync(...args),
  authenticateAsync: (...args: unknown[]) => authenticateAsync(...args),
}));

import { isBiometricsAvailable, authenticateWithBiometrics } from './biometrics';

beforeEach(() => {
  vi.clearAllMocks();
  hasHardwareAsync.mockResolvedValue(true);
  isEnrolledAsync.mockResolvedValue(true);
  authenticateAsync.mockResolvedValue({ success: true });
});

describe('isBiometricsAvailable', () => {
  it('returns true when hardware exists and biometrics are enrolled', async () => {
    expect(await isBiometricsAvailable()).toBe(true);
  });

  it('returns false when there is no hardware', async () => {
    hasHardwareAsync.mockResolvedValueOnce(false);
    expect(await isBiometricsAvailable()).toBe(false);
    expect(isEnrolledAsync).not.toHaveBeenCalled();
  });

  it('returns false when hardware exists but nothing is enrolled', async () => {
    isEnrolledAsync.mockResolvedValueOnce(false);
    expect(await isBiometricsAvailable()).toBe(false);
  });
});

describe('authenticateWithBiometrics', () => {
  it('returns true on successful authentication and disables the device fallback', async () => {
    const result = await authenticateWithBiometrics('Colitis-App entsperren');
    expect(result).toBe(true);
    expect(authenticateAsync).toHaveBeenCalledWith({
      promptMessage: 'Colitis-App entsperren',
      disableDeviceFallback: true,
    });
  });

  it('returns false when authentication fails', async () => {
    authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    expect(await authenticateWithBiometrics('Colitis-App entsperren')).toBe(false);
  });
});
