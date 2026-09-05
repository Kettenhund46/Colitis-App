import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mealsBefore, buildBadDayMeals, LOOKBACK_HOURS } from './mealCorrelation';
import type { DiaryEntryWithTriggers } from '../diary/types';
import type { Meal } from './types';

function localIso(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function meal(id: number, eatenAt: string, description = 'Haferbrei'): Meal {
  return { id, eatenAt, description };
}

/** Standard ist ein guter Tag; die Ueberschreibungen machen ihn auffaellig. */
function entry(
  overrides: Partial<DiaryEntryWithTriggers> & { id: number; occurredAt: string }
): DiaryEntryWithTriggers {
  return {
    stoolFrequency: 2,
    bloodLevel: 0,
    nocturnalStools: 0,
    stoolConsistency: 'geformt',
    painLevel: 1,
    symptoms: [],
    note: null,
    triggerCategories: [],
    foodTriggerNote: null,
    ...overrides,
  };
}

function badEntry(id: number, occurredAt: string): DiaryEntryWithTriggers {
  return entry({ id, occurredAt, bloodLevel: 2 });
}

describe('meal correlation', () => {
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  describe('mealsBefore', () => {
    const reference = localIso(2026, 9, 4, 12, 0);

    it('keeps a meal from the evening before', () => {
      const meals = [meal(1, localIso(2026, 9, 3, 19, 0))];
      expect(mealsBefore(meals, reference, LOOKBACK_HOURS).map((m) => m.id)).toEqual([1]);
    });

    it('drops a meal older than the window', () => {
      const meals = [meal(1, localIso(2026, 9, 3, 11, 0))];
      expect(mealsBefore(meals, reference, LOOKBACK_HOURS)).toEqual([]);
    });

    it('keeps the meal exactly at the lower edge', () => {
      const meals = [meal(1, localIso(2026, 9, 3, 12, 0))];
      expect(mealsBefore(meals, reference, LOOKBACK_HOURS).map((m) => m.id)).toEqual([1]);
    });

    it('drops a meal at the same minute as the entry', () => {
      // Was zur selben Minute gegessen wurde, kann nicht davor liegen.
      const meals = [meal(1, reference)];
      expect(mealsBefore(meals, reference, LOOKBACK_HOURS)).toEqual([]);
    });

    it('drops a meal after the entry', () => {
      const meals = [meal(1, localIso(2026, 9, 4, 18, 0))];
      expect(mealsBefore(meals, reference, LOOKBACK_HOURS)).toEqual([]);
    });

    it('returns the latest meal first', () => {
      const meals = [
        meal(1, localIso(2026, 9, 3, 19, 0)),
        meal(2, localIso(2026, 9, 4, 8, 0)),
        meal(3, localIso(2026, 9, 3, 13, 0)),
      ];
      expect(mealsBefore(meals, reference, LOOKBACK_HOURS).map((m) => m.id)).toEqual([2, 1, 3]);
    });

    it('is empty without a single meal', () => {
      expect(mealsBefore([], reference, LOOKBACK_HOURS)).toEqual([]);
    });
  });

  describe('buildBadDayMeals', () => {
    it('reports a bad day with what was eaten before it', () => {
      const meals = [meal(1, localIso(2026, 9, 3, 19, 0), 'Pizza')];
      const entries = [badEntry(10, localIso(2026, 9, 4, 9, 0))];

      expect(buildBadDayMeals(meals, entries)).toEqual([
        {
          date: '2026-09-04',
          referenceAt: localIso(2026, 9, 4, 9, 0),
          meals: [meals[0]],
        },
      ]);
    });

    it('ignores a day that was not rated bad', () => {
      const meals = [meal(1, localIso(2026, 9, 3, 19, 0))];
      const entries = [entry({ id: 10, occurredAt: localIso(2026, 9, 4, 9, 0) })];
      expect(buildBadDayMeals(meals, entries)).toEqual([]);
    });

    it('leaves out a bad day without any meal in the window', () => {
      const meals = [meal(1, localIso(2026, 8, 1, 19, 0))];
      const entries = [badEntry(10, localIso(2026, 9, 4, 9, 0))];
      expect(buildBadDayMeals(meals, entries)).toEqual([]);
    });

    it('measures from the first entry of the day, not the last', () => {
      // Die Mahlzeit um 10 Uhr liegt vor dem Nachmittags-, aber nicht vor dem
      // Morgeneintrag -- gezaehlt wird gegen den frueheren.
      const meals = [meal(1, localIso(2026, 9, 4, 10, 0))];
      const entries = [
        badEntry(10, localIso(2026, 9, 4, 8, 0)),
        badEntry(11, localIso(2026, 9, 4, 17, 0)),
      ];
      expect(buildBadDayMeals(meals, entries)).toEqual([]);
    });

    it('rates the day as a whole, not the single entry', () => {
      // Zwei je fuer sich unauffaellige Eintraege ergeben zusammen acht
      // Stuhlgaenge -- und damit einen schub-verdaechtigen Tag.
      const meals = [meal(1, localIso(2026, 9, 3, 19, 0))];
      const entries = [
        entry({ id: 10, occurredAt: localIso(2026, 9, 4, 9, 0), stoolFrequency: 4 }),
        entry({ id: 11, occurredAt: localIso(2026, 9, 4, 17, 0), stoolFrequency: 4 }),
      ];
      expect(buildBadDayMeals(meals, entries).map((day) => day.date)).toEqual(['2026-09-04']);
    });

    it('returns the newest bad day first', () => {
      const meals = [
        meal(1, localIso(2026, 9, 1, 19, 0)),
        meal(2, localIso(2026, 9, 3, 19, 0)),
      ];
      const entries = [
        badEntry(10, localIso(2026, 9, 2, 9, 0)),
        badEntry(11, localIso(2026, 9, 4, 9, 0)),
      ];
      expect(buildBadDayMeals(meals, entries).map((day) => day.date)).toEqual([
        '2026-09-04',
        '2026-09-02',
      ]);
    });

    it('is empty without entries or meals', () => {
      expect(buildBadDayMeals([], [])).toEqual([]);
    });
  });
});
