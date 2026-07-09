import { describe, it, expect } from 'vitest';
import { filterKnowledgeArticles } from './search';
import type { KnowledgeArticle } from './types';

const articles: KnowledgeArticle[] = [
  {
    slug: 'a',
    title: 'Ursachen und Auslöser',
    body: 'Genetik und Immunsystem spielen eine Rolle.',
    sources: ['https://example.com/a'],
  },
  {
    slug: 'b',
    title: 'Behandlungsmöglichkeiten',
    body: 'Mesalazin ist die Basistherapie.',
    sources: ['https://example.com/b'],
  },
];

describe('filterKnowledgeArticles', () => {
  it('returns all articles for an empty query', () => {
    expect(filterKnowledgeArticles(articles, '')).toEqual(articles);
  });

  it('returns all articles for a whitespace-only query', () => {
    expect(filterKnowledgeArticles(articles, '   ')).toEqual(articles);
  });

  it('matches case-insensitively in the title', () => {
    expect(filterKnowledgeArticles(articles, 'URSACHEN')).toEqual([articles[0]]);
  });

  it('matches case-insensitively in the body', () => {
    expect(filterKnowledgeArticles(articles, 'mesalazin')).toEqual([articles[1]]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterKnowledgeArticles(articles, 'zzzzz')).toEqual([]);
  });
});
