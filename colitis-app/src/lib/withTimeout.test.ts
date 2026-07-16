import { describe, it, expect, vi } from 'vitest';
import { withTimeout, TimeoutError } from './withTimeout';

describe('withTimeout', () => {
  it('resolves with the inner value when it settles before the timeout', async () => {
    await expect(withTimeout(Promise.resolve('value'), 1000, 'timeout')).resolves.toBe('value');
  });

  it('rejects with the inner error when it rejects before the timeout', async () => {
    const error = new Error('boom');
    await expect(withTimeout(Promise.reject(error), 1000, 'timeout')).rejects.toBe(error);
  });

  it('rejects with a TimeoutError carrying the given message when the inner promise never settles in time', async () => {
    vi.useFakeTimers();
    try {
      const neverResolves = new Promise(() => {});
      const resultPromise = withTimeout(neverResolves, 1000, 'Zeitüberschreitung.');
      const assertion = expect(resultPromise).rejects.toThrow('Zeitüberschreitung.');
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects with an instance of TimeoutError on timeout', async () => {
    vi.useFakeTimers();
    try {
      const neverResolves = new Promise(() => {});
      const resultPromise = withTimeout(neverResolves, 1000, 'timeout');
      const assertion = expect(resultPromise).rejects.toBeInstanceOf(TimeoutError);
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
