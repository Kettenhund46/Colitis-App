import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AWMF_WATCHED_GUIDELINES, parseAwmfVersionInfo, fetchAwmfItems } from './awmfClient';
import type { FeedItem } from './types';

describe('AWMF_WATCHED_GUIDELINES', () => {
  it('contains exactly the two known guidelines', () => {
    expect(AWMF_WATCHED_GUIDELINES).toEqual([
      {
        registerNumber: '021-009',
        title: 'S3-Leitlinie Colitis ulcerosa',
        url: 'https://register.awmf.org/de/leitlinien/detail/021-009',
      },
      {
        registerNumber: '073-027',
        title: 'S3-Leitlinie Klinische Ernaehrung bei chronisch-entzuendlichen Darmerkrankungen',
        url: 'https://register.awmf.org/de/leitlinien/detail/073-027',
      },
    ]);
  });
});

describe('parseAwmfVersionInfo', () => {
  it('extracts version and publication date from the guideline page HTML', () => {
    const html = '<div class="version">Version 7.0</div><div class="date">15.11.2025</div>';
    expect(parseAwmfVersionInfo(html)).toEqual({ version: '7.0', publishedDate: '2025-11-15' });
  });

  it('returns null when the version cannot be found', () => {
    expect(parseAwmfVersionInfo('<div>unexpected page structure</div>')).toBeNull();
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchAwmfItems', () => {
  it('returns a feed item when a guideline has a newer version than previously known', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<div class="version">Version 7.0</div><div class="date">15.11.2025</div>'),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<div class="version">Version 2.1</div><div class="date">01.02.2025</div>'),
      });

    const previousItems: FeedItem[] = [
      {
        id: 'awmf:021-009:v6.2',
        source: 'awmf',
        category: 'leitlinie',
        title: 'S3-Leitlinie Colitis ulcerosa',
        summaryDe: 'Alte Version.',
        publishedDate: '2025-02-01',
        url: 'https://register.awmf.org/de/leitlinien/detail/021-009',
      },
    ];

    const items = await fetchAwmfItems(previousItems);

    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('awmf:021-009:v7.0');
    expect(items[1].id).toBe('awmf:073-027:v2.1');
  });

  it('skips a guideline whose version is already known', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<div class="version">Version 7.0</div><div class="date">15.11.2025</div>'),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<div class="version">Version 2.1</div><div class="date">01.02.2025</div>'),
    });

    const previousItems: FeedItem[] = [
      {
        id: 'awmf:021-009:v7.0',
        source: 'awmf',
        category: 'leitlinie',
        title: 'S3-Leitlinie Colitis ulcerosa',
        summaryDe: 'Bereits bekannt.',
        publishedDate: '2025-11-15',
        url: 'https://register.awmf.org/de/leitlinien/detail/021-009',
      },
    ];

    const items = await fetchAwmfItems(previousItems);

    expect(items.map((item) => item.id)).toEqual(['awmf:073-027:v2.1']);
  });

  it('keeps processing the second guideline when the first fails to parse', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve('<div>broken page</div>') })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<div class="version">Version 2.1</div><div class="date">01.02.2025</div>'),
      });

    const items = await fetchAwmfItems([]);

    expect(items.map((item) => item.id)).toEqual(['awmf:073-027:v2.1']);
  });
});
