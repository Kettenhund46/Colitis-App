import { desc, eq, inArray } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { cachedFeedItems } from '../../../db/schema';
import * as schema from '../../../db/schema';
import { computeFeedSyncPlan } from './feedSyncPlan';
import type { FeedItem, RemoteFeedItem } from '../types';

export type NewsFeedDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function syncFeedItems(db: NewsFeedDb, items: RemoteFeedItem[]): Promise<void> {
  const existingRows = await db.select({ id: cachedFeedItems.id }).from(cachedFeedItems);
  const existingIds = existingRows.map((row) => row.id);
  const plan = computeFeedSyncPlan(existingIds, items);

  if (plan.idsToDelete.length > 0) {
    await db.delete(cachedFeedItems).where(inArray(cachedFeedItems.id, plan.idsToDelete));
  }

  for (const item of plan.itemsToUpsert) {
    await db
      .insert(cachedFeedItems)
      .values({
        id: item.id,
        source: item.source,
        category: item.category,
        title: item.title,
        summaryDe: item.summaryDe,
        publishedDate: item.publishedDate,
        url: item.url,
        isRead: false,
      })
      .onConflictDoUpdate({
        target: cachedFeedItems.id,
        set: {
          source: item.source,
          category: item.category,
          title: item.title,
          summaryDe: item.summaryDe,
          publishedDate: item.publishedDate,
          url: item.url,
        },
      });
  }
}

export async function listCachedFeedItems(db: NewsFeedDb): Promise<FeedItem[]> {
  const rows = await db.select().from(cachedFeedItems).orderBy(desc(cachedFeedItems.publishedDate));
  return rows.map(rowToFeedItem);
}

export async function markFeedItemAsRead(db: NewsFeedDb, id: string): Promise<void> {
  await db.update(cachedFeedItems).set({ isRead: true }).where(eq(cachedFeedItems.id, id));
}

function rowToFeedItem(row: typeof cachedFeedItems.$inferSelect): FeedItem {
  return {
    id: row.id,
    source: row.source,
    category: row.category,
    title: row.title,
    summaryDe: row.summaryDe,
    publishedDate: row.publishedDate,
    url: row.url,
    isRead: row.isRead,
  };
}
