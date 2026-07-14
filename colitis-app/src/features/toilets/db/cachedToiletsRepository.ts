import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { cachedToilets } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { Toilet } from '../types';

export type ToiletsCacheDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function replaceCachedToilets(db: ToiletsCacheDb, toilets: Toilet[]): Promise<void> {
  await db.delete(cachedToilets);
  for (const toilet of toilets) {
    await db.insert(cachedToilets).values({
      osmId: toilet.id,
      latitude: toilet.latitude,
      longitude: toilet.longitude,
      name: toilet.name,
      openingHours: toilet.openingHours,
    });
  }
}

export async function listCachedToilets(db: ToiletsCacheDb): Promise<Toilet[]> {
  const rows = await db.select().from(cachedToilets);
  return rows.map((row) => ({
    id: row.osmId,
    latitude: row.latitude,
    longitude: row.longitude,
    name: row.name,
    openingHours: row.openingHours,
  }));
}
