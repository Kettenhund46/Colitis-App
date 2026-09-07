import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchFeedPublication,
  parseFeedPublication,
  FeedNotPublishedError,
  isFeedNotPublished,
} from './feedClient';
import { FEED_URL, FEED_CLIENT_TIMEOUT_MS } from './constants';

describe('parseFeedPublication', () => {
  it('returns the publication when the shape is valid', () => {
    const data = { generatedAt: '2026-07-15T05:00:00.000Z', items: [] };
    expect(parseFeedPublication(data)).toEqual(data);
  });

  it('throws when generatedAt is missing', () => {
    expect(() => parseFeedPublication({ items: [] })).toThrow('Feed-Antwort hat ein unerwartetes Format.');
  });

  it('throws when items is not an array', () => {
    expect(() => parseFeedPublication({ generatedAt: '2026-07-15', items: 'nope' })).toThrow(
      'Feed-Antwort hat ein unerwartetes Format.'
    );
  });

  it('returns the publication when all items have a valid shape', () => {
    const data = {
      generatedAt: '2026-07-15T05:00:00.000Z',
      items: [
        {
          id: '1',
          source: 'pubmed',
          category: 'studie',
          title: 'Titel',
          summaryDe: 'Zusammenfassung',
          publishedDate: '2026-07-01',
          url: 'https://example.com/1',
        },
      ],
    };
    expect(parseFeedPublication(data)).toEqual(data);
  });

  it('throws when an item has an unrecognized source', () => {
    const data = {
      generatedAt: '2026-07-15T05:00:00.000Z',
      items: [
        {
          id: '1',
          source: 'unknown',
          category: 'studie',
          title: 'Titel',
          summaryDe: 'Zusammenfassung',
          publishedDate: '2026-07-01',
          url: 'https://example.com/1',
        },
      ],
    };
    expect(() => parseFeedPublication(data)).toThrow('Feed-Antwort hat ein unerwartetes Format.');
  });

  it('throws when an item is missing a required field', () => {
    const data = {
      generatedAt: '2026-07-15T05:00:00.000Z',
      items: [
        {
          id: '1',
          source: 'pubmed',
          category: 'studie',
          summaryDe: 'Zusammenfassung',
          publishedDate: '2026-07-01',
          url: 'https://example.com/1',
        },
      ],
    };
    expect(() => parseFeedPublication(data)).toThrow('Feed-Antwort hat ein unerwartetes Format.');
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchFeedPublication', () => {
  it('fetches and parses the feed', async () => {
    const publication = { generatedAt: '2026-07-15T05:00:00.000Z', items: [] };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(publication) });

    expect(await fetchFeedPublication()).toEqual(publication);
    expect(fetchMock).toHaveBeenCalledWith(FEED_URL, expect.objectContaining({}));
  });

  it('meldet einen 404 als "noch nicht veröffentlicht", nicht als Stoerung', async () => {
    // Die Adresse steht fest im Code und ist damit nicht vertippt. Liegt dort
    // nichts, ist das ein Dauerzustand -- der Bildschirm muss ihn von einer
    // voruebergehenden Stoerung unterscheiden koennen.
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) });

    await expect(fetchFeedPublication()).rejects.toBeInstanceOf(FeedNotPublishedError);
  });

  it('behandelt einen Serverfehler weiterhin als gewoehnlichen Fehler', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

    const fehler = await fetchFeedPublication().catch((error: unknown) => error);
    expect(isFeedNotPublished(fehler)).toBe(false);
    expect(fehler).toBeInstanceOf(Error);
    expect((fehler as Error).message).toContain('Status 500');
  });

  it('erkennt einen gewoehnlichen Netzfehler nicht als "nicht veröffentlicht"', async () => {
    // Offline heisst: spaeter nochmal versuchen. Nicht veroeffentlicht heisst:
    // warten hilft nicht. Die beiden duerfen nicht zusammenfallen.
    fetchMock.mockRejectedValueOnce(new Error('network unreachable'));

    const fehler = await fetchFeedPublication().catch((error: unknown) => error);
    expect(isFeedNotPublished(fehler)).toBe(false);
  });

  it('propagates a network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network unreachable'));

    await expect(fetchFeedPublication()).rejects.toThrow('network unreachable');
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

      const resultPromise = fetchFeedPublication();
      const assertion = expect(resultPromise).rejects.toThrow('Feed-Anfrage abgebrochen (Zeitüberschreitung).');
      await vi.advanceTimersByTimeAsync(FEED_CLIENT_TIMEOUT_MS);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
