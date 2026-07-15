import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildPubmedSearchTerm,
  buildPubmedEsearchUrl,
  buildPubmedEsummaryUrl,
  parsePubmedEsearchResponse,
  parsePubmedDate,
  parsePubmedEsummaryResponse,
  fetchPubmedItems,
} from './pubmedClient';

describe('buildPubmedSearchTerm', () => {
  it('builds a term filtered to clinical trials, guidelines, systematic reviews and meta-analyses since the given date', () => {
    const term = buildPubmedSearchTerm('2026-01-13');
    expect(term).toBe(
      '("ulcerative colitis"[Title/Abstract]) AND (Clinical Trial[pt] OR Guideline[pt] OR Systematic Review[pt] OR Meta-Analysis[pt]) AND ("2026/01/13"[Date - Publication] : "3000"[Date - Publication])'
    );
  });
});

describe('buildPubmedEsearchUrl', () => {
  it('builds the esearch URL with the expected fixed parameters', () => {
    const url = buildPubmedEsearchUrl('2026-01-13');
    expect(url.startsWith('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?')).toBe(true);
    expect(url).toContain('db=pubmed');
    expect(url).toContain('retmode=json');
    expect(url).toContain('sort=pub+date');
  });
});

describe('buildPubmedEsummaryUrl', () => {
  it('joins pmids with commas (percent-encoded)', () => {
    const url = buildPubmedEsummaryUrl(['111', '222']);
    expect(url).toContain('id=111%2C222');
  });
});

describe('parsePubmedEsearchResponse', () => {
  it('extracts the id list', () => {
    expect(parsePubmedEsearchResponse({ esearchresult: { idlist: ['111', '222'] } })).toEqual(['111', '222']);
  });

  it('returns an empty array when idlist is missing', () => {
    expect(parsePubmedEsearchResponse({})).toEqual([]);
  });
});

describe('parsePubmedDate', () => {
  it('parses a full date', () => {
    expect(parsePubmedDate('2026 Jul 15')).toBe('2026-07-15');
  });

  it('parses a year and month only, defaulting the day to 01', () => {
    expect(parsePubmedDate('2026 Jul')).toBe('2026-07-01');
  });

  it('parses a year only, defaulting month and day to 01', () => {
    expect(parsePubmedDate('2026')).toBe('2026-01-01');
  });
});

describe('parsePubmedEsummaryResponse', () => {
  it('builds feed items from the summary result', () => {
    const items = parsePubmedEsummaryResponse({
      result: { uids: ['111'], '111': { uid: '111', title: 'A Trial', pubdate: '2026 Jul 15' } },
    });

    expect(items).toEqual([
      {
        id: 'pubmed:111',
        source: 'pubmed',
        category: 'studie',
        title: 'A Trial',
        summaryDe: '',
        publishedDate: '2026-07-15',
        url: 'https://pubmed.ncbi.nlm.nih.gov/111/',
      },
    ]);
  });

  it('skips entries missing a title or pubdate', () => {
    const items = parsePubmedEsummaryResponse({ result: { uids: ['111'], '111': { uid: '111' } } });
    expect(items).toEqual([]);
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchPubmedItems', () => {
  it('searches then summarizes and returns feed items', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ esearchresult: { idlist: ['111'] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            result: { uids: ['111'], '111': { uid: '111', title: 'A Trial', pubdate: '2026 Jul 15' } },
          }),
      });

    const items = await fetchPubmedItems('2026-01-13');

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('pubmed:111');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns an empty array without calling esummary when there are no results', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ esearchresult: { idlist: [] } }),
    });

    const items = await fetchPubmedItems('2026-01-13');

    expect(items).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when esearch responds with a non-ok status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

    await expect(fetchPubmedItems('2026-01-13')).rejects.toThrow('PubMed request failed (status 500)');
  });
});
