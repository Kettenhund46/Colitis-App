import { fetchWithTimeout } from './httpClient';
import type { FeedItem } from './types';

const PUBMED_ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const PUBMED_ESUMMARY_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const PUBMED_RETMAX = 50;
const PUBMED_TIMEOUT_MESSAGE = 'PubMed request timed out.';

const MONTH_NAMES: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

export function buildPubmedSearchTerm(sinceDate: string): string {
  const sinceForPubmed = sinceDate.replace(/-/g, '/');
  return `("ulcerative colitis"[Title/Abstract]) AND (Clinical Trial[pt] OR Guideline[pt] OR Systematic Review[pt] OR Meta-Analysis[pt]) AND ("${sinceForPubmed}"[Date - Publication] : "3000"[Date - Publication])`;
}

export function buildPubmedEsearchUrl(sinceDate: string): string {
  const params = new URLSearchParams({
    db: 'pubmed',
    term: buildPubmedSearchTerm(sinceDate),
    retmode: 'json',
    retmax: String(PUBMED_RETMAX),
    sort: 'pub date',
  });
  return `${PUBMED_ESEARCH_URL}?${params.toString()}`;
}

export function buildPubmedEsummaryUrl(pmids: string[]): string {
  const params = new URLSearchParams({ db: 'pubmed', id: pmids.join(','), retmode: 'json' });
  return `${PUBMED_ESUMMARY_URL}?${params.toString()}`;
}

export function parsePubmedEsearchResponse(data: unknown): string[] {
  const response = data as { esearchresult?: { idlist?: string[] } };
  return response.esearchresult?.idlist ?? [];
}

export function parsePubmedDate(pubdate: string): string {
  const parts = pubdate.trim().split(/\s+/);
  const year = parts[0];
  const month = parts[1] && MONTH_NAMES[parts[1]] ? MONTH_NAMES[parts[1]] : '01';
  const dayRaw = parts[2] ?? '';
  const day = /^\d{1,2}$/.test(dayRaw) ? dayRaw.padStart(2, '0') : '01';
  return `${year}-${month}-${day}`;
}

interface PubmedEsummaryEntry {
  title?: string;
  pubdate?: string;
}

export function parsePubmedEsummaryResponse(data: unknown): FeedItem[] {
  const response = data as { result?: Record<string, unknown> };
  const result = response.result ?? {};
  const uids = (result.uids as string[] | undefined) ?? [];
  const items: FeedItem[] = [];
  for (const uid of uids) {
    const entry = result[uid] as PubmedEsummaryEntry | undefined;
    if (!entry?.title || !entry.pubdate) {
      continue;
    }
    items.push({
      id: `pubmed:${uid}`,
      source: 'pubmed',
      category: 'studie',
      title: entry.title,
      summaryDe: '',
      publishedDate: parsePubmedDate(entry.pubdate),
      url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
    });
  }
  return items;
}

async function fetchPubmedJson(url: string): Promise<unknown> {
  const response = await fetchWithTimeout(url, PUBMED_TIMEOUT_MESSAGE);
  if (!response.ok) {
    throw new Error(`PubMed request failed (status ${response.status})`);
  }
  return response.json();
}

export async function fetchPubmedItems(sinceDate: string): Promise<FeedItem[]> {
  const esearchData = await fetchPubmedJson(buildPubmedEsearchUrl(sinceDate));
  const pmids = parsePubmedEsearchResponse(esearchData);
  if (pmids.length === 0) {
    return [];
  }
  const esummaryData = await fetchPubmedJson(buildPubmedEsummaryUrl(pmids));
  return parsePubmedEsummaryResponse(esummaryData);
}
