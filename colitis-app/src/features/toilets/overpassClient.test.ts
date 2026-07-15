import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchNearbyToilets } from './overpassClient';
import { OVERPASS_CLIENT_TIMEOUT_MS } from './constants';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchNearbyToilets', () => {
  it('POSTs the Overpass query and parses the response into toilets', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          elements: [{ type: 'node', id: 1, lat: 52.52, lon: 13.405, tags: { name: 'Test-Toilette' } }],
        }),
    });

    const toilets = await fetchNearbyToilets({ latitude: 52.52, longitude: 13.405 }, 1500);

    expect(toilets).toEqual([
      { id: '1', latitude: 52.52, longitude: 13.405, name: 'Test-Toilette', openingHours: null },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://overpass-api.de/api/interpreter',
      expect.objectContaining({
        method: 'POST',
        body: '[out:json][timeout:25];node["amenity"="toilets"](around:1500,52.52,13.405);out body;',
      })
    );
  });

  it('throws a German error when the response is not ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 504, json: () => Promise.resolve({}) });

    await expect(fetchNearbyToilets({ latitude: 0, longitude: 0 }, 1500)).rejects.toThrow(
      'Overpass-Anfrage fehlgeschlagen (Status 504)'
    );
  });

  it('propagates a network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network unreachable'));

    await expect(fetchNearbyToilets({ latitude: 0, longitude: 0 }, 1500)).rejects.toThrow('network unreachable');
  });

  it('aborts the request after a client-side timeout and reports a German error', async () => {
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

      const resultPromise = fetchNearbyToilets({ latitude: 0, longitude: 0 }, 1500);
      const assertion = expect(resultPromise).rejects.toThrow('Overpass-Anfrage abgebrochen (Zeitüberschreitung).');
      await vi.advanceTimersByTimeAsync(OVERPASS_CLIENT_TIMEOUT_MS);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
