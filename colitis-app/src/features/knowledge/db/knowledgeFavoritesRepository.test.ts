import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { listFavoriteSlugs, addFavorite, removeFavorite } from './knowledgeFavoritesRepository';

describe('knowledge favorites repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns an empty list when nothing is favorited', async () => {
    expect(await listFavoriteSlugs(db)).toEqual([]);
  });

  it('adds a favorite and finds it in the list', async () => {
    await addFavorite(db, 'ueberblick');
    expect(await listFavoriteSlugs(db)).toEqual(['ueberblick']);
  });

  it('adding the same favorite twice does not throw and does not duplicate', async () => {
    await addFavorite(db, 'ueberblick');
    await expect(addFavorite(db, 'ueberblick')).resolves.not.toThrow();
    expect(await listFavoriteSlugs(db)).toEqual(['ueberblick']);
  });

  it('removes a favorite', async () => {
    await addFavorite(db, 'ueberblick');
    await removeFavorite(db, 'ueberblick');
    expect(await listFavoriteSlugs(db)).toEqual([]);
  });

  it('removing a favorite that does not exist does not throw', async () => {
    await expect(removeFavorite(db, 'nicht-vorhanden')).resolves.not.toThrow();
  });

  it('lists multiple favorites', async () => {
    await addFavorite(db, 'ueberblick');
    await addFavorite(db, 'ernaehrung');
    const slugs = await listFavoriteSlugs(db);
    expect(slugs.sort()).toEqual(['ernaehrung', 'ueberblick'].sort());
  });
});
