import { desc, eq, gte } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { meals } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { Meal, MealInput } from '../types';

export type MealsDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

const COLUMNS = {
  id: meals.id,
  eatenAt: meals.eatenAt,
  description: meals.description,
};

export async function createMeal(db: MealsDb, input: MealInput): Promise<void> {
  await db.insert(meals).values({ eatenAt: input.eatenAt, description: input.description });
}

/**
 * Alle Mahlzeiten ab der Untergrenze, neueste zuerst. `null` liest alles.
 * Der Zeitstempel ist ISO in UTC -- der lexikografische Vergleich ist damit
 * zugleich der zeitliche.
 */
export async function listMeals(db: MealsDb, fromIsoInclusive: string | null): Promise<Meal[]> {
  if (fromIsoInclusive === null) {
    return db.select(COLUMNS).from(meals).orderBy(desc(meals.eatenAt));
  }
  return db
    .select(COLUMNS)
    .from(meals)
    .where(gte(meals.eatenAt, fromIsoInclusive))
    .orderBy(desc(meals.eatenAt));
}

export async function deleteMeal(db: MealsDb, mealId: number): Promise<void> {
  await db.delete(meals).where(eq(meals.id, mealId));
}
