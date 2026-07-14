import { eq, asc } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { savedPlaces } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { SavedPlace, SavedPlaceInput } from '../types';

export type SavedPlacesDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function createSavedPlace(db: SavedPlacesDb, input: SavedPlaceInput): Promise<SavedPlace> {
  const [inserted] = await db
    .insert(savedPlaces)
    .values({
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      note: input.note,
      category: input.category,
    })
    .returning({ id: savedPlaces.id });

  return { id: inserted.id, ...input };
}

export async function listSavedPlaces(db: SavedPlacesDb): Promise<SavedPlace[]> {
  const rows = await db.select().from(savedPlaces).orderBy(asc(savedPlaces.id));
  return rows.map(rowToSavedPlace);
}

export async function updateSavedPlace(
  db: SavedPlacesDb,
  id: number,
  input: SavedPlaceInput
): Promise<SavedPlace> {
  await db
    .update(savedPlaces)
    .set({
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      note: input.note,
      category: input.category,
    })
    .where(eq(savedPlaces.id, id));

  return { id, ...input };
}

export async function deleteSavedPlace(db: SavedPlacesDb, id: number): Promise<void> {
  await db.delete(savedPlaces).where(eq(savedPlaces.id, id));
}

function rowToSavedPlace(row: typeof savedPlaces.$inferSelect): SavedPlace {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    note: row.note,
    category: row.category,
  };
}
