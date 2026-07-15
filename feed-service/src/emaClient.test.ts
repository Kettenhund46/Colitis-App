import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseEmaRssItems, buildEmaFeedItems, fetchEmaItems } from './emaClient';
import type { FeedItem } from './types';
import type { WatchedDrug } from './drugWatchlist';

const WATCHLIST: WatchedDrug[] = [{ germanName: 'Vedolizumab', englishName: 'Vedolizumab' }];

const SAMPLE_RSS = `<?xml version="1.0"?>
<rss><channel>
<item>
<title>EMA recommends extension of indication for Vedolizumab</title>
<link>https://www.ema.europa.eu/en/news/vedolizumab-update</link>
<description>The EMA has updated the label for Vedolizumab.</description>
<pubDate>Mon, 01 Mar 2026 10:00:00 GMT</pubDate>
</item>
<item>
<title>Unrelated announcement</title>
<link>https://www.ema.europa.eu/en/news/unrelated</link>
<description>Nothing about the watchlist here.</description>
<pubDate>Mon, 01 Mar 2026 10:00:00 GMT</pubDate>
</item>
</channel></rss>`;

describe('parseEmaRssItems', () => {
  it('extracts title, link, description and pubDate for every item', () => {
    const items = parseEmaRssItems(SAMPLE_RSS);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: 'EMA recommends extension of indication for Vedolizumab',
      link: 'https://www.ema.europa.eu/en/news/vedolizumab-update',
      description: 'The EMA has updated the label for Vedolizumab.',
      pubDate: 'Mon, 01 Mar 2026 10:00:00 GMT',
    });
  });
});

describe('buildEmaFeedItems', () => {
  it('keeps only items matching a watched drug and builds feed items', () => {
    const items = buildEmaFeedItems(SAMPLE_RSS, WATCHLIST);

    expect(items).toEqual([
      {
        id: 'ema:https-www-ema-europa-eu-en-news-vedolizumab-update',
        source: 'ema',
        category: 'zulassung',
        title: 'EMA recommends extension of indication for Vedolizumab',
        summaryDe: '',
        publishedDate: '2026-03-01',
        url: 'https://www.ema.europa.eu/en/news/vedolizumab-update',
      },
    ]);
  });

  it('excludes an item already present in previousItems', () => {
    const previousItems: FeedItem[] = [
      {
        id: 'ema:https-www-ema-europa-eu-en-news-vedolizumab-update',
        source: 'ema',
        category: 'zulassung',
        title: 'EMA recommends extension of indication for Vedolizumab',
        summaryDe: 'Bereits bekannt.',
        publishedDate: '2026-03-01',
        url: 'https://www.ema.europa.eu/en/news/vedolizumab-update',
      },
    ];

    expect(buildEmaFeedItems(SAMPLE_RSS, WATCHLIST, previousItems)).toEqual([]);
  });

  it('assigns distinct ids to recurring CHMP meeting-highlights articles whose URLs only differ past the old 60-char cutoff', () => {
    // Both links share a long common prefix (well over 60 chars once slugified)
    // and only differ in the trailing date range, mirroring EMA's real monthly
    // "meeting highlights" URL pattern. Regression test for the truncated-slug id
    // collision bug.
    const chmpRss = `<?xml version="1.0"?>
<rss><channel>
<item>
<title>Meeting highlights from the Committee for Medicinal Products for Human Use (CHMP) 15-18 July 2026, including Vedolizumab</title>
<link>https://www.ema.europa.eu/en/news/meeting-highlights-committee-medicinal-products-human-use-chmp-15-18-july-2026</link>
<description>Vedolizumab was discussed at this CHMP meeting.</description>
<pubDate>Fri, 18 Jul 2026 10:00:00 GMT</pubDate>
</item>
<item>
<title>Meeting highlights from the Committee for Medicinal Products for Human Use (CHMP) 14-17 April 2026, including Vedolizumab</title>
<link>https://www.ema.europa.eu/en/news/meeting-highlights-committee-medicinal-products-human-use-chmp-14-17-april-2026</link>
<description>Vedolizumab was discussed at this CHMP meeting.</description>
<pubDate>Fri, 17 Apr 2026 10:00:00 GMT</pubDate>
</item>
</channel></rss>`;

    const items = buildEmaFeedItems(chmpRss, WATCHLIST);

    expect(items).toHaveLength(2);
    expect(items[0].id).not.toBe(items[1].id);
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchEmaItems', () => {
  it('fetches the RSS feed and returns matching items', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve(SAMPLE_RSS) });

    const items = await fetchEmaItems(WATCHLIST, []);

    expect(items).toHaveLength(1);
    expect(items[0].source).toBe('ema');
  });

  it('throws when the RSS request is not ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('') });

    await expect(fetchEmaItems(WATCHLIST, [])).rejects.toThrow('EMA request failed (status 500)');
  });
});
