import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildFdaSearchUrl, parseFdaResponse, fetchFdaItems } from './fdaClient';
import type { FeedItem } from './types';
import type { WatchedDrug } from './drugWatchlist';

const UPADACITINIB: WatchedDrug = { germanName: 'Upadacitinib', englishName: 'Upadacitinib' };

describe('buildFdaSearchUrl', () => {
  it('builds a search URL for the uppercased active ingredient', () => {
    const url = buildFdaSearchUrl('Upadacitinib');
    expect(url.startsWith('https://api.fda.gov/drug/drugsfda.json?')).toBe(true);
    expect(url).toContain(encodeURIComponent('products.active_ingredients.name:"UPADACITINIB"'));
  });
});

describe('parseFdaResponse', () => {
  it('picks the most recent submission and builds a feed item', () => {
    const data = {
      results: [
        {
          products: [{ brand_name: 'Rinvoq' }],
          submissions: [
            { submission_status_date: '20250101', submission_type: 'ORIG' },
            { submission_status_date: '20260301', submission_type: 'SUPPL' },
          ],
        },
      ],
    };

    expect(parseFdaResponse(data, UPADACITINIB)).toEqual({
      id: 'fda:upadacitinib:2026-03-01',
      source: 'fda',
      category: 'zulassung',
      title: 'Upadacitinib (Rinvoq): SUPPL bei der FDA',
      summaryDe: '',
      publishedDate: '2026-03-01',
      url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm',
    });
  });

  it('returns null when there are no results', () => {
    expect(parseFdaResponse({ results: [] }, UPADACITINIB)).toBeNull();
  });

  it('returns null when no submission has a status date', () => {
    const data = { results: [{ products: [], submissions: [{ submission_type: 'ORIG' }] }] };
    expect(parseFdaResponse(data, UPADACITINIB)).toBeNull();
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchFdaItems', () => {
  it('collects new items across the watchlist', async () => {
    const watchlist: WatchedDrug[] = [
      { germanName: 'Infliximab', englishName: 'Infliximab' },
      { germanName: 'Vedolizumab', englishName: 'Vedolizumab' },
    ];

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            results: [
              {
                products: [{ brand_name: 'Entyvio' }],
                submissions: [{ submission_status_date: '20260101', submission_type: 'SUPPL' }],
              },
            ],
          }),
      });

    const items = await fetchFdaItems(watchlist, []);

    expect(items).toEqual([
      {
        id: 'fda:vedolizumab:2026-01-01',
        source: 'fda',
        category: 'zulassung',
        title: 'Vedolizumab (Entyvio): SUPPL bei der FDA',
        summaryDe: '',
        publishedDate: '2026-01-01',
        url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm',
      },
    ]);
  });

  it('skips an item already present in previousItems', async () => {
    const watchlist: WatchedDrug[] = [{ germanName: 'Vedolizumab', englishName: 'Vedolizumab' }];
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          results: [
            {
              products: [{ brand_name: 'Entyvio' }],
              submissions: [{ submission_status_date: '20260101', submission_type: 'SUPPL' }],
            },
          ],
        }),
    });

    const previousItems: FeedItem[] = [
      {
        id: 'fda:vedolizumab:2026-01-01',
        source: 'fda',
        category: 'zulassung',
        title: 'Vedolizumab (Entyvio): SUPPL bei der FDA',
        summaryDe: 'Bereits bekannt.',
        publishedDate: '2026-01-01',
        url: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm',
      },
    ];

    expect(await fetchFdaItems(watchlist, previousItems)).toEqual([]);
  });

  it('continues with the next drug after a request failure', async () => {
    const watchlist: WatchedDrug[] = [
      { germanName: 'Infliximab', englishName: 'Infliximab' },
      { germanName: 'Vedolizumab', englishName: 'Vedolizumab' },
    ];
    fetchMock.mockRejectedValueOnce(new Error('network unreachable')).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          results: [
            {
              products: [{ brand_name: 'Entyvio' }],
              submissions: [{ submission_status_date: '20260101', submission_type: 'SUPPL' }],
            },
          ],
        }),
    });

    const items = await fetchFdaItems(watchlist, []);

    expect(items.map((item) => item.id)).toEqual(['fda:vedolizumab:2026-01-01']);
  });
});
