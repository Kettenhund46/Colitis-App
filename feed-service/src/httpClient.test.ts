import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithTimeout } from './httpClient';
import { HTTP_CLIENT_TIMEOUT_MS } from './constants';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchWithTimeout', () => {
  it('returns the response on success', async () => {
    const response = { ok: true, status: 200 };
    fetchMock.mockResolvedValueOnce(response);

    const result = await fetchWithTimeout('https://example.com', 'timed out');

    expect(result).toBe(response);
  });

  it('propagates a network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network unreachable'));

    await expect(fetchWithTimeout('https://example.com', 'timed out')).rejects.toThrow('network unreachable');
  });

  it('throws the given message after a client-side timeout', async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementationOnce((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        });
      });

      const resultPromise = fetchWithTimeout('https://example.com', 'PubMed request timed out.');
      const assertion = expect(resultPromise).rejects.toThrow('PubMed request timed out.');
      await vi.advanceTimersByTimeAsync(HTTP_CLIENT_TIMEOUT_MS);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
