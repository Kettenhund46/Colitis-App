import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSummaryPrompt, parseAnthropicSummary, summarizeItem, summarizeNewItems } from './summarize';
import type { FeedItem } from './types';

function makeItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'pubmed:1',
    source: 'pubmed',
    category: 'studie',
    title: 'A new trial on ulcerative colitis treatment',
    summaryDe: '',
    publishedDate: '2026-07-01',
    url: 'https://pubmed.ncbi.nlm.nih.gov/1/',
    ...overrides,
  };
}

describe('buildSummaryPrompt', () => {
  it('includes title, source, category and link', () => {
    const prompt = buildSummaryPrompt(makeItem());
    expect(prompt).toContain('A new trial on ulcerative colitis treatment');
    expect(prompt).toContain('pubmed');
    expect(prompt).toContain('studie');
    expect(prompt).toContain('https://pubmed.ncbi.nlm.nih.gov/1/');
  });
});

describe('parseAnthropicSummary', () => {
  it('extracts and trims the text block', () => {
    expect(parseAnthropicSummary({ content: [{ type: 'text', text: '  Kurze Zusammenfassung.  ' }] })).toBe(
      'Kurze Zusammenfassung.'
    );
  });

  it('throws when there is no text block', () => {
    expect(() => parseAnthropicSummary({ content: [] })).toThrow(
      'Anthropic response did not contain a text block.'
    );
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('summarizeItem', () => {
  it('posts the prompt and returns the summary text', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ content: [{ type: 'text', text: 'Kurze Zusammenfassung.' }] }),
    });

    const summary = await summarizeItem(makeItem(), 'test-key');

    expect(summary).toBe('Kurze Zusammenfassung.');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'test-key', 'anthropic-version': '2023-06-01' }),
      })
    );
  });

  it('throws when the request is not ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

    await expect(summarizeItem(makeItem(), 'test-key')).rejects.toThrow('Anthropic request failed (status 500)');
  });
});

describe('summarizeNewItems', () => {
  it('summarizes every item and fills in summaryDe', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ content: [{ type: 'text', text: 'Kurze Zusammenfassung.' }] }),
    });

    const items = await summarizeNewItems([makeItem({ id: 'pubmed:1' }), makeItem({ id: 'pubmed:2' })], 'test-key');

    expect(items).toHaveLength(2);
    expect(items.every((item) => item.summaryDe === 'Kurze Zusammenfassung.')).toBe(true);
  });

  it('skips an item whose summarization fails and keeps the others', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: [{ type: 'text', text: 'Kurze Zusammenfassung.' }] }),
      });

    const items = await summarizeNewItems([makeItem({ id: 'pubmed:1' }), makeItem({ id: 'pubmed:2' })], 'test-key');

    expect(items.map((item) => item.id)).toEqual(['pubmed:2']);
  });
});
