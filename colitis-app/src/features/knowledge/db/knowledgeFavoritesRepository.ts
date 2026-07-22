import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { knowledgeFavorites } from '../../../db/schema';
import * as schema from '../../../db/schema';

export type KnowledgeFavoritesDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function listFavoriteSlugs(db: KnowledgeFavoritesDb): Promise<string[]> {
  const rows = await db.select().from(knowledgeFavorites);
  return rows.map((row) => row.articleSlug);
}

export async function addFavorite(db: KnowledgeFavoritesDb, articleSlug: string): Promise<void> {
  await db.insert(knowledgeFavorites).values({ articleSlug }).onConflictDoNothing();
}

export async function removeFavorite(db: KnowledgeFavoritesDb, articleSlug: string): Promise<void> {
  await db.delete(knowledgeFavorites).where(eq(knowledgeFavorites.articleSlug, articleSlug));
}
