import { describe, it, expect } from 'vitest';
import { KNOWLEDGE_ARTICLES } from './articles';

describe('KNOWLEDGE_ARTICLES', () => {
  it('contains exactly 10 articles', () => {
    expect(KNOWLEDGE_ARTICLES).toHaveLength(10);
  });

  it('has the expected slugs in the expected order', () => {
    expect(KNOWLEDGE_ARTICLES.map((article) => article.slug)).toEqual([
      'ueberblick',
      'ursachen',
      'behandlung',
      'folgen',
      'forschung',
      'medikamente',
      'ernaehrung',
      'impfungen',
      'arbeit',
      'reisen',
    ]);
  });

  it('has unique slugs', () => {
    const slugs = KNOWLEDGE_ARTICLES.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every article has a non-empty title, body and at least one https source', () => {
    for (const article of KNOWLEDGE_ARTICLES) {
      expect(article.title.length).toBeGreaterThan(0);
      expect(article.body.length).toBeGreaterThan(0);
      expect(article.sources.length).toBeGreaterThan(0);
      for (const source of article.sources) {
        expect(source.startsWith('https://')).toBe(true);
      }
    }
  });
});
