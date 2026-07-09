import { asc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { knowledgeContent } from '../../../db/schema';
import * as schema from '../../../db/schema';
import { KNOWLEDGE_ARTICLES } from '../content/articles';
import type { KnowledgeArticle } from '../types';

export type KnowledgeDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function seedKnowledgeArticles(db: KnowledgeDb): Promise<void> {
  for (const article of KNOWLEDGE_ARTICLES) {
    await db
      .insert(knowledgeContent)
      .values({
        slug: article.slug,
        title: article.title,
        body: article.body,
        sources: JSON.stringify(article.sources),
      })
      .onConflictDoUpdate({
        target: knowledgeContent.slug,
        set: {
          title: article.title,
          body: article.body,
          sources: JSON.stringify(article.sources),
        },
      });
  }
}

export async function listKnowledgeArticles(db: KnowledgeDb): Promise<KnowledgeArticle[]> {
  const rows = await db.select().from(knowledgeContent).orderBy(asc(knowledgeContent.id));
  return rows.map(rowToArticle);
}

export async function getKnowledgeArticleBySlug(
  db: KnowledgeDb,
  slug: string
): Promise<KnowledgeArticle | null> {
  const rows = await db.select().from(knowledgeContent).where(eq(knowledgeContent.slug, slug));
  return rows.length > 0 ? rowToArticle(rows[0]) : null;
}

function rowToArticle(row: typeof knowledgeContent.$inferSelect): KnowledgeArticle {
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    sources: JSON.parse(row.sources) as string[],
  };
}
