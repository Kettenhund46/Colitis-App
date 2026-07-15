import type { FeedItem, FeedPublication } from './types';
import { isWithinRollingWindow } from './dateWindow';

export function mergeAndFilterItems(existing: FeedItem[], newItems: FeedItem[], now: Date): FeedItem[] {
  const byId = new Map<string, FeedItem>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of newItems) {
    byId.set(item.id, item);
  }

  const merged = Array.from(byId.values()).filter((item) => isWithinRollingWindow(item.publishedDate, now));
  merged.sort((a, b) => (a.publishedDate < b.publishedDate ? 1 : a.publishedDate > b.publishedDate ? -1 : 0));
  return merged;
}

export function buildPublication(items: FeedItem[], now: Date): FeedPublication {
  return { generatedAt: now.toISOString(), items };
}
