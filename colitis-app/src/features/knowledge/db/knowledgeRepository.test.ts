import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import * as schema from '../../../db/schema';
import { knowledgeContent } from '../../../db/schema';
import { seedKnowledgeArticles, listKnowledgeArticles, getKnowledgeArticleBySlug } from './knowledgeRepository';
import { KNOWLEDGE_ARTICLES } from '../content/articles';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const migrationSql = readFileSync(
    join(__dirname, '../../../../drizzle/0000_remarkable_junta.sql'),
    'utf-8'
  );
  for (const statement of migrationSql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) {
      sqlite.exec(trimmed);
    }
  }
  return drizzle(sqlite, { schema });
}

describe('knowledge repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('seeds all articles into an empty database', async () => {
    await seedKnowledgeArticles(db);
    const articles = await listKnowledgeArticles(db);

    expect(articles).toHaveLength(KNOWLEDGE_ARTICLES.length);
    expect(articles.map((article) => article.slug)).toEqual(
      KNOWLEDGE_ARTICLES.map((article) => article.slug)
    );
  });

  it('does not duplicate rows when seeded twice', async () => {
    await seedKnowledgeArticles(db);
    await seedKnowledgeArticles(db);
    const articles = await listKnowledgeArticles(db);

    expect(articles).toHaveLength(KNOWLEDGE_ARTICLES.length);
  });

  it('updates existing article content instead of duplicating when it changes', async () => {
    await seedKnowledgeArticles(db);
    await db
      .update(knowledgeContent)
      .set({ title: 'Veralteter Titel', body: 'Veralteter Text' })
      .where(eq(knowledgeContent.slug, 'ueberblick'));

    await seedKnowledgeArticles(db);

    const canonical = KNOWLEDGE_ARTICLES.find((entry) => entry.slug === 'ueberblick')!;
    const article = await getKnowledgeArticleBySlug(db, 'ueberblick');

    expect(article?.title).toBe(canonical.title);
    expect(article?.body).toBe(canonical.body);

    const allArticles = await listKnowledgeArticles(db);
    expect(allArticles).toHaveLength(KNOWLEDGE_ARTICLES.length);
  });

  it('round-trips sources as an array', async () => {
    await seedKnowledgeArticles(db);
    const canonical = KNOWLEDGE_ARTICLES.find((entry) => entry.slug === 'ueberblick')!;
    const article = await getKnowledgeArticleBySlug(db, 'ueberblick');

    expect(article?.sources).toEqual(canonical.sources);
  });

  it('returns null for an unknown slug', async () => {
    await seedKnowledgeArticles(db);
    const article = await getKnowledgeArticleBySlug(db, 'nicht-vorhanden');

    expect(article).toBeNull();
  });
});
