import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCurrentFeedFile, hasFeedChanged, publishFeed } from './publish';
import type { FeedPublication } from './types';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchCurrentFeedFile', () => {
  it('decodes the base64 content and returns publication plus sha', async () => {
    const publication: FeedPublication = { generatedAt: '2026-07-08T05:00:00.000Z', items: [] };
    const encoded = Buffer.from(JSON.stringify(publication)).toString('base64');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ content: encoded, sha: 'abc123' }),
    });

    expect(await fetchCurrentFeedFile('token')).toEqual({ publication, sha: 'abc123' });
  });

  it('returns null publication and sha when the file does not exist yet', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) });

    expect(await fetchCurrentFeedFile('token')).toEqual({ publication: null, sha: null });
  });

  it('throws on an unexpected error status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

    await expect(fetchCurrentFeedFile('token')).rejects.toThrow('GitHub contents GET failed (status 500)');
  });
});

describe('hasFeedChanged', () => {
  const publication: FeedPublication = {
    generatedAt: '2026-07-15T05:00:00.000Z',
    items: [
      {
        id: 'pubmed:1',
        source: 'pubmed',
        category: 'studie',
        title: 'A',
        summaryDe: 'B',
        publishedDate: '2026-07-01',
        url: 'https://example.com',
      },
    ],
  };

  it('is true when there is no previous publication', () => {
    expect(hasFeedChanged(null, publication)).toBe(true);
  });

  it('is false when the items are identical (ignoring generatedAt)', () => {
    const previous: FeedPublication = { ...publication, generatedAt: '2026-07-08T05:00:00.000Z' };
    expect(hasFeedChanged(previous, publication)).toBe(false);
  });

  it('is true when the items differ', () => {
    const previous: FeedPublication = { ...publication, items: [] };
    expect(hasFeedChanged(previous, publication)).toBe(true);
  });
});

describe('publishFeed', () => {
  it('PUTs base64-encoded content with the previous sha when updating', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });
    const publication: FeedPublication = { generatedAt: '2026-07-15T05:00:00.000Z', items: [] };

    await publishFeed(publication, 'previous-sha', 'token');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/Kettenhund46/colitis-app-feed/contents/feed.json',
      expect.objectContaining({ method: 'PUT' })
    );
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.sha).toBe('previous-sha');
    expect(JSON.parse(Buffer.from(body.content, 'base64').toString('utf-8'))).toEqual(publication);
  });

  it('omits sha on first publish', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });
    const publication: FeedPublication = { generatedAt: '2026-07-15T05:00:00.000Z', items: [] };

    await publishFeed(publication, null, 'token');

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.sha).toBeUndefined();
  });

  it('throws when the PUT fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: () => Promise.resolve({}) });

    await expect(
      publishFeed({ generatedAt: '2026-07-15T05:00:00.000Z', items: [] }, 'sha', 'token')
    ).rejects.toThrow('GitHub contents PUT failed (status 409)');
  });
});
