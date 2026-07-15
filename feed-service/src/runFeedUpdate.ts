import type { FeedItem, FeedPublication } from './types';
import type { FeedFileState } from './publish';
import type { WatchedDrug } from './drugWatchlist';
import { DRUG_WATCHLIST } from './drugWatchlist';
import { computePubmedSearchSinceDate } from './dateWindow';
import { mergeAndFilterItems, buildPublication } from './mergeAndWindow';
import { hasFeedChanged } from './publish';

export interface FeedUpdateDeps {
  fetchCurrentFeedFile: (token: string) => Promise<FeedFileState>;
  fetchPubmedItems: (sinceDate: string) => Promise<FeedItem[]>;
  fetchAwmfItems: (previousItems: FeedItem[]) => Promise<FeedItem[]>;
  fetchFdaItems: (watchlist: WatchedDrug[], previousItems: FeedItem[]) => Promise<FeedItem[]>;
  fetchEmaItems: (watchlist: WatchedDrug[], previousItems: FeedItem[]) => Promise<FeedItem[]>;
  summarizeNewItems: (items: FeedItem[], apiKey: string) => Promise<FeedItem[]>;
  publishFeed: (publication: FeedPublication, previousSha: string | null, token: string) => Promise<void>;
}

export interface FeedUpdateResult {
  publishedItemCount: number;
  failedSources: string[];
  published: boolean;
}

export async function runFeedUpdate(
  deps: FeedUpdateDeps,
  env: { anthropicApiKey: string; publishToken: string },
  now: Date
): Promise<FeedUpdateResult> {
  const { publication: previous, sha } = await deps.fetchCurrentFeedFile(env.publishToken);
  const previousItems = previous?.items ?? [];
  const sinceDate = computePubmedSearchSinceDate(previous?.generatedAt ?? null, now);

  const sourceCalls: Array<{ name: string; run: () => Promise<FeedItem[]> }> = [
    { name: 'pubmed', run: () => deps.fetchPubmedItems(sinceDate) },
    { name: 'awmf', run: () => deps.fetchAwmfItems(previousItems) },
    { name: 'fda', run: () => deps.fetchFdaItems(DRUG_WATCHLIST, previousItems) },
    { name: 'ema', run: () => deps.fetchEmaItems(DRUG_WATCHLIST, previousItems) },
  ];

  const collected: FeedItem[] = [];
  const failedSources: string[] = [];

  for (const source of sourceCalls) {
    try {
      collected.push(...(await source.run()));
    } catch (error: unknown) {
      console.error(`Source ${source.name} failed:`, error);
      failedSources.push(source.name);
    }
  }

  if (failedSources.length === sourceCalls.length) {
    throw new Error('All feed sources failed.');
  }

  const newItems = collected.filter((item) => !previousItems.some((existing) => existing.id === item.id));
  const summarized = await deps.summarizeNewItems(newItems, env.anthropicApiKey);

  const merged = mergeAndFilterItems(previousItems, summarized, now);
  const publication = buildPublication(merged, now);

  let published = false;
  if (hasFeedChanged(previous, publication)) {
    await deps.publishFeed(publication, sha, env.publishToken);
    published = true;
  }

  return { publishedItemCount: publication.items.length, failedSources, published };
}
