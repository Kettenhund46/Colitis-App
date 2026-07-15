import { fetchWithTimeout } from './httpClient';
import type { FeedItem } from './types';
import type { WatchedDrug } from './drugWatchlist';

// LIVE-FORMAT VERIFICATION NOTE (see task-5-report.md for full detail):
//
// The EMA feed URL assumed in the task brief (https://www.ema.europa.eu/en/rss.xml)
// returns HTTP 404 on the live site. The current, working news feed URL - found via
// EMA's own public RSS feed index at https://www.ema.europa.eu/en/rss-feeds - is
// https://www.ema.europa.eu/en/news.xml (Content-Type: application/rss+xml). It is a
// valid, publicly accessible RSS 2.0 feed matching the structure this parser assumes:
// <item><title>/<link>/<description>/<pubDate>. Verified live that current watchlist
// drug names (e.g. Ustekinumab, Upadacitinib, Budesonide) genuinely appear in recent
// item titles/descriptions, so matchesWatchlist finds real matches. This was a pure
// URL correction (no robots.txt disallow, no credentials, no ToS concern) - only
// EMA_RSS_URL below was changed from the brief; the parsing logic is unchanged.
const EMA_RSS_URL = 'https://www.ema.europa.eu/en/news.xml';
const EMA_TIMEOUT_MESSAGE = 'EMA request timed out.';

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) {
    return '';
  }
  return match[1]
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .trim();
}

export function parseEmaRssItems(xml: string): RssItem[] {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return itemBlocks.map((block) => ({
    title: extractTag(block, 'title'),
    link: extractTag(block, 'link'),
    description: extractTag(block, 'description'),
    pubDate: extractTag(block, 'pubDate'),
  }));
}

function matchesWatchlist(item: RssItem, watchlist: WatchedDrug[]): boolean {
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  return watchlist.some((drug) => haystack.includes(drug.englishName.toLowerCase()));
}

function slugifyForId(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
}

export function buildEmaFeedItems(xml: string, watchlist: WatchedDrug[], previousItems: FeedItem[] = []): FeedItem[] {
  const items = parseEmaRssItems(xml);
  const result: FeedItem[] = [];

  for (const item of items) {
    if (!item.pubDate || !item.link || !matchesWatchlist(item, watchlist)) {
      continue;
    }
    const parsedDate = new Date(item.pubDate);
    if (Number.isNaN(parsedDate.getTime())) {
      continue;
    }
    const id = `ema:${slugifyForId(item.link)}`;
    if (previousItems.some((existing) => existing.id === id)) {
      continue;
    }
    result.push({
      id,
      source: 'ema',
      category: 'zulassung',
      title: item.title,
      summaryDe: '',
      publishedDate: parsedDate.toISOString().slice(0, 10),
      url: item.link,
    });
  }

  return result;
}

export async function fetchEmaItems(watchlist: WatchedDrug[], previousItems: FeedItem[]): Promise<FeedItem[]> {
  const response = await fetchWithTimeout(EMA_RSS_URL, EMA_TIMEOUT_MESSAGE);
  if (!response.ok) {
    throw new Error(`EMA request failed (status ${response.status})`);
  }
  const xml = await response.text();
  return buildEmaFeedItems(xml, watchlist, previousItems);
}
