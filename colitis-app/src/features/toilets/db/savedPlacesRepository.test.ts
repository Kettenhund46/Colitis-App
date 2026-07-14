import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { createSavedPlace, listSavedPlaces, updateSavedPlace, deleteSavedPlace } from './savedPlacesRepository';

describe('saved places repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a saved place and returns it with an id', async () => {
    const created = await createSavedPlace(db, {
      name: 'Büro',
      latitude: 52.52,
      longitude: 13.405,
      note: '2. Stock',
      category: 'Arbeit',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe('Büro');
    expect(created.note).toBe('2. Stock');
  });

  it('lists all saved places', async () => {
    await createSavedPlace(db, {
      name: 'Büro',
      latitude: 52.52,
      longitude: 13.405,
      note: null,
      category: 'Arbeit',
    });
    await createSavedPlace(db, {
      name: 'Lieblingscafé',
      latitude: 52.53,
      longitude: 13.41,
      note: null,
      category: 'Café',
    });

    const list = await listSavedPlaces(db);
    expect(list.map((place) => place.name)).toEqual(['Büro', 'Lieblingscafé']);
  });

  it('updates an existing saved place', async () => {
    const created = await createSavedPlace(db, {
      name: 'Büro',
      latitude: 52.52,
      longitude: 13.405,
      note: null,
      category: 'Arbeit',
    });

    const updated = await updateSavedPlace(db, created.id, {
      name: 'Büro (neu)',
      latitude: 52.521,
      longitude: 13.406,
      note: 'Umgezogen',
      category: 'Arbeit',
    });

    expect(updated).toEqual({
      id: created.id,
      name: 'Büro (neu)',
      latitude: 52.521,
      longitude: 13.406,
      note: 'Umgezogen',
      category: 'Arbeit',
    });
  });

  it('deletes a saved place', async () => {
    const created = await createSavedPlace(db, {
      name: 'Büro',
      latitude: 52.52,
      longitude: 13.405,
      note: null,
      category: 'Arbeit',
    });

    await deleteSavedPlace(db, created.id);

    expect(await listSavedPlaces(db)).toEqual([]);
  });
});
