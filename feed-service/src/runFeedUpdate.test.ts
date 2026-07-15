import { describe, it, expect, vi } from 'vitest';
import { runFeedUpdate } from './runFeedUpdate';
import type { FeedItem, FeedPublication } from './types';

const NOW = new Date('2026-07-15T05:00:00.000Z');
const ENV = { anthropicApiKey: 'anthropic-key', publishToken: 'publish-token' };

function makeItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'pubmed:1',
    source: 'pubmed',
    category: 'studie',
    title: 'Title',
    summaryDe: '',
    publishedDate: '2026-07-10',
    url: 'https://example.com',
    ...overrides,
  };
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    fetchCurrentFeedFile: vi.fn().mockResolvedValue({ publication: null, sha: null }),
    fetchPubmedItems: vi.fn().mockResolvedValue([]),
    fetchAwmfItems: vi.fn().mockResolvedValue([]),
    fetchFdaItems: vi.fn().mockResolvedValue([]),
    fetchEmaItems: vi.fn().mockResolvedValue([]),
    summarizeNewItems: vi.fn().mockImplementation(async (items: FeedItem[]) => items),
    publishFeed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('runFeedUpdate', () => {
  it('publishes new items collected from all sources', async () => {
    const deps = makeDeps({ fetchPubmedItems: vi.fn().mockResolvedValue([makeItem({ id: 'pubmed:1' })]) });

    const result = await runFeedUpdate(deps as never, ENV, NOW);

    expect(result.published).toBe(true);
    expect(result.publishedItemCount).toBe(1);
    expect(result.failedSources).toEqual([]);
    expect(deps.publishFeed).toHaveBeenCalledTimes(1);
  });

  it('does not call publishFeed when nothing changed', async () => {
    const existing: FeedPublication = { generatedAt: '2026-07-08T05:00:00.000Z', items: [] };
    const deps = makeDeps({ fetchCurrentFeedFile: vi.fn().mockResolvedValue({ publication: existing, sha: 'sha-1' }) });

    const result = await runFeedUpdate(deps as never, ENV, NOW);

    expect(result.published).toBe(false);
    expect(deps.publishFeed).not.toHaveBeenCalled();
  });

  it('continues when one source fails and records it', async () => {
    const deps = makeDeps({
      fetchAwmfItems: vi.fn().mockRejectedValue(new Error('boom')),
      fetchPubmedItems: vi.fn().mockResolvedValue([makeItem({ id: 'pubmed:1' })]),
    });

    const result = await runFeedUpdate(deps as never, ENV, NOW);

    expect(result.failedSources).toEqual(['awmf']);
    expect(result.published).toBe(true);
  });

  it('throws when all sources fail and does not publish', async () => {
    const deps = makeDeps({
      fetchPubmedItems: vi.fn().mockRejectedValue(new Error('a')),
      fetchAwmfItems: vi.fn().mockRejectedValue(new Error('b')),
      fetchFdaItems: vi.fn().mockRejectedValue(new Error('c')),
      fetchEmaItems: vi.fn().mockRejectedValue(new Error('d')),
    });

    await expect(runFeedUpdate(deps as never, ENV, NOW)).rejects.toThrow('All feed sources failed.');
    expect(deps.publishFeed).not.toHaveBeenCalled();
  });

  it('does not re-summarize a pubmed item already present in the previous publication (overlap window)', async () => {
    const existingItem = makeItem({ id: 'pubmed:1', summaryDe: 'Bereits bekannt.' });
    const existing: FeedPublication = { generatedAt: '2026-07-08T05:00:00.000Z', items: [existingItem] };
    const deps = makeDeps({
      fetchCurrentFeedFile: vi.fn().mockResolvedValue({ publication: existing, sha: 'sha-1' }),
      fetchPubmedItems: vi.fn().mockResolvedValue([makeItem({ id: 'pubmed:1', summaryDe: '' })]),
    });

    await runFeedUpdate(deps as never, ENV, NOW);

    expect(deps.summarizeNewItems).toHaveBeenCalledWith([], ENV.anthropicApiKey);
  });
});
