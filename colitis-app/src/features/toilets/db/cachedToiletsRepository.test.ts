import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { replaceCachedToilets, listCachedToilets } from './cachedToiletsRepository';
import type { Toilet } from '../types';

const toiletA: Toilet = { id: 'osm-1', latitude: 52.52, longitude: 13.405, name: 'Bahnhof', openingHours: '24/7' };
const toiletB: Toilet = { id: 'osm-2', latitude: 52.53, longitude: 13.41, name: null, openingHours: null };

describe('cached toilets repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns an empty list when nothing has been cached yet', async () => {
    expect(await listCachedToilets(db)).toEqual([]);
  });

  it('stores and returns cached toilets', async () => {
    await replaceCachedToilets(db, [toiletA, toiletB]);

    const list = await listCachedToilets(db);
    expect(list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'osm-1', name: 'Bahnhof', openingHours: '24/7' }),
        expect.objectContaining({ id: 'osm-2', name: null, openingHours: null }),
      ])
    );
    expect(list).toHaveLength(2);
  });

  it('fully replaces the previous cache on the next call', async () => {
    await replaceCachedToilets(db, [toiletA]);
    await replaceCachedToilets(db, [toiletB]);

    const list = await listCachedToilets(db);
    expect(list.map((toilet) => toilet.id)).toEqual(['osm-2']);
  });

  it('clears the cache when replaced with an empty list', async () => {
    await replaceCachedToilets(db, [toiletA]);
    await replaceCachedToilets(db, []);

    expect(await listCachedToilets(db)).toEqual([]);
  });
});
