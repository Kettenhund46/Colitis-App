import { describe, it, expect } from 'vitest';
import { mergeAndFilterItems, buildPublication } from './mergeAndWindow';
import type { FeedItem } from './types';

const NOW = new Date('2026-07-15T05:00:00.000Z');

function makeItem(overrides: Partial<FeedItem>): FeedItem {
  return {
    id: 'pubmed:1',
    source: 'pubmed',
    category: 'studie',
    title: 'Test',
    summaryDe: 'Zusammenfassung.',
    publishedDate: '2026-07-01',
    url: 'https://example.com/1',
    ...overrides,
  };
}

describe('mergeAndFilterItems', () => {
  it('combines existing and new items, deduplicated by id', () => {
    const existing = [makeItem({ id: 'pubmed:1', title: 'Alt' })];
    const incoming = [makeItem({ id: 'pubmed:1', title: 'Neu' }), makeItem({ id: 'pubmed:2' })];

    const result = mergeAndFilterItems(existing, incoming, NOW);

    expect(result).toHaveLength(2);
    expect(result.find((item) => item.id === 'pubmed:1')?.title).toBe('Neu');
  });

  it('drops items outside the rolling window', () => {
    const existing = [makeItem({ id: 'pubmed:old', publishedDate: '2026-01-01' })];

    const result = mergeAndFilterItems(existing, [], NOW);

    expect(result).toHaveLength(0);
  });

  it('sorts items by publishedDate descending', () => {
    const existing = [
      makeItem({ id: 'pubmed:1', publishedDate: '2026-06-01' }),
      makeItem({ id: 'pubmed:2', publishedDate: '2026-07-01' }),
    ];

    const result = mergeAndFilterItems(existing, [], NOW);

    expect(result.map((item) => item.id)).toEqual(['pubmed:2', 'pubmed:1']);
  });
});

describe('buildPublication', () => {
  it('wraps items with the current timestamp', () => {
    const items = [makeItem({})];

    const publication = buildPublication(items, NOW);

    expect(publication.generatedAt).toBe(NOW.toISOString());
    expect(publication.items).toBe(items);
  });
});
