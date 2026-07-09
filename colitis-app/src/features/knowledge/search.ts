import type { KnowledgeArticle } from './types';

export function filterKnowledgeArticles(articles: KnowledgeArticle[], query: string): KnowledgeArticle[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return articles;
  }

  return articles.filter(
    (article) =>
      article.title.toLowerCase().includes(normalizedQuery) ||
      article.body.toLowerCase().includes(normalizedQuery)
  );
}
