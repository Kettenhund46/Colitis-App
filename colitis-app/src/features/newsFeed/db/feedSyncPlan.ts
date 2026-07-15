import type { RemoteFeedItem } from '../types';

export interface FeedSyncPlan {
  idsToDelete: string[];
  itemsToUpsert: RemoteFeedItem[];
}

export function computeFeedSyncPlan(existingIds: string[], incomingItems: RemoteFeedItem[]): FeedSyncPlan {
  const incomingIds = new Set(incomingItems.map((item) => item.id));
  const idsToDelete = existingIds.filter((id) => !incomingIds.has(id));
  return { idsToDelete, itemsToUpsert: incomingItems };
}
