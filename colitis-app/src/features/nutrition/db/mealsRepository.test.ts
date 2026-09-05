import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { createMeal, listMeals, deleteMeal } from './mealsRepository';

describe('meals repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('stores a meal and reads it back', async () => {
    await createMeal(db, { eatenAt: '2026-09-04T06:30:00.000Z', description: 'Haferbrei' });

    const stored = await listMeals(db, null);
    expect(stored).toEqual([
      { id: expect.any(Number), eatenAt: '2026-09-04T06:30:00.000Z', description: 'Haferbrei' },
    ]);
  });

  it('returns the newest meal first', async () => {
    await createMeal(db, { eatenAt: '2026-09-04T06:30:00.000Z', description: 'Frühstück' });
    await createMeal(db, { eatenAt: '2026-09-04T17:00:00.000Z', description: 'Abendessen' });
    await createMeal(db, { eatenAt: '2026-09-04T11:00:00.000Z', description: 'Mittagessen' });

    expect((await listMeals(db, null)).map((meal) => meal.description)).toEqual([
      'Abendessen',
      'Mittagessen',
      'Frühstück',
    ]);
  });

  it('cuts off below the lower bound', async () => {
    await createMeal(db, { eatenAt: '2026-08-01T10:00:00.000Z', description: 'Alt' });
    await createMeal(db, { eatenAt: '2026-09-04T10:00:00.000Z', description: 'Neu' });

    const recent = await listMeals(db, '2026-09-01T00:00:00.000Z');
    expect(recent.map((meal) => meal.description)).toEqual(['Neu']);
  });

  it('includes a meal exactly at the lower bound', async () => {
    await createMeal(db, { eatenAt: '2026-09-01T00:00:00.000Z', description: 'Genau am Rand' });

    const recent = await listMeals(db, '2026-09-01T00:00:00.000Z');
    expect(recent).toHaveLength(1);
  });

  it('removes a single meal', async () => {
    await createMeal(db, { eatenAt: '2026-09-04T06:30:00.000Z', description: 'Haferbrei' });
    await createMeal(db, { eatenAt: '2026-09-04T11:00:00.000Z', description: 'Suppe' });

    const [newest] = await listMeals(db, null);
    await deleteMeal(db, newest.id);

    expect((await listMeals(db, null)).map((meal) => meal.description)).toEqual(['Haferbrei']);
  });

  it('is empty before anything was recorded', async () => {
    expect(await listMeals(db, null)).toEqual([]);
  });
});
