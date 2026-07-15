import { describe, it, expect } from 'vitest';
import { computeFeedSyncPlan } from './feedSyncPlan';
import type { RemoteFeedItem } from '../types';

function makeItem(id: string): RemoteFeedItem {
  return {
    id,
    source: 'pubmed',
    category: 'studie',
    title: 'Titel',
    summaryDe: 'Zusammenfassung.',
    publishedDate: '2026-07-01',
    url: 'https://example.com',
  };
}

describe('computeFeedSyncPlan', () => {
  it('upserts all incoming items and deletes nothing when there is no existing cache', () => {
    const plan = computeFeedSyncPlan([], [makeItem('a'), makeItem('b')]);
    expect(plan.idsToDelete).toEqual([]);
    expect(plan.itemsToUpsert.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('deletes existing ids that are not present in the incoming items', () => {
    const plan = computeFeedSyncPlan(['a', 'b'], [makeItem('b')]);
    expect(plan.idsToDelete).toEqual(['a']);
  });

  it('does not delete existing ids that are still present in the incoming items', () => {
    const plan = computeFeedSyncPlan(['a'], [makeItem('a')]);
    expect(plan.idsToDelete).toEqual([]);
  });

  it('upserts every incoming item regardless of whether it already existed', () => {
    const plan = computeFeedSyncPlan(['a'], [makeItem('a'), makeItem('c')]);
    expect(plan.itemsToUpsert.map((item) => item.id)).toEqual(['a', 'c']);
  });
});
