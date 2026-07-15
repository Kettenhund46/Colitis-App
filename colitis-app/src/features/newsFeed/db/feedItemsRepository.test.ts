import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { syncFeedItems, listCachedFeedItems, markFeedItemAsRead } from './feedItemsRepository';
import type { RemoteFeedItem } from '../types';

const itemA: RemoteFeedItem = {
  id: 'pubmed:1',
  source: 'pubmed',
  category: 'studie',
  title: 'Titel A',
  summaryDe: 'Zusammenfassung A.',
  publishedDate: '2026-07-01',
  url: 'https://pubmed.ncbi.nlm.nih.gov/1/',
};
const itemB: RemoteFeedItem = {
  id: 'awmf:021-009:v7.0',
  source: 'awmf',
  category: 'leitlinie',
  title: 'Titel B',
  summaryDe: 'Zusammenfassung B.',
  publishedDate: '2026-06-01',
  url: 'https://register.awmf.org/de/leitlinien/detail/021-009',
};

describe('news feed items repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns an empty list when nothing has been synced yet', async () => {
    expect(await listCachedFeedItems(db)).toEqual([]);
  });

  it('inserts new items as unread', async () => {
    await syncFeedItems(db, [itemA]);

    const list = await listCachedFeedItems(db);
    expect(list).toEqual([{ ...itemA, isRead: false }]);
  });

  it('removes items no longer present in a later sync', async () => {
    await syncFeedItems(db, [itemA, itemB]);
    await syncFeedItems(db, [itemB]);

    const list = await listCachedFeedItems(db);
    expect(list.map((item) => item.id)).toEqual(['awmf:021-009:v7.0']);
  });

  it('preserves the read status of an item across a sync that still includes it', async () => {
    await syncFeedItems(db, [itemA]);
    await markFeedItemAsRead(db, itemA.id);

    await syncFeedItems(db, [itemA, itemB]);

    const list = await listCachedFeedItems(db);
    const stillPresent = list.find((item) => item.id === itemA.id);
    expect(stillPresent?.isRead).toBe(true);
  });

  it('updates changed fields of an existing item without resetting isRead', async () => {
    await syncFeedItems(db, [itemA]);
    await markFeedItemAsRead(db, itemA.id);

    const updatedItemA: RemoteFeedItem = { ...itemA, title: 'Aktualisierter Titel' };
    await syncFeedItems(db, [updatedItemA]);

    const list = await listCachedFeedItems(db);
    expect(list).toEqual([{ ...updatedItemA, isRead: true }]);
  });

  it('sorts by publishedDate descending', async () => {
    await syncFeedItems(db, [itemA, itemB]);

    const list = await listCachedFeedItems(db);
    expect(list.map((item) => item.id)).toEqual(['pubmed:1', 'awmf:021-009:v7.0']);
  });

  it('marks an item as read', async () => {
    await syncFeedItems(db, [itemA]);
    await markFeedItemAsRead(db, itemA.id);

    const list = await listCachedFeedItems(db);
    expect(list[0].isRead).toBe(true);
  });
});
