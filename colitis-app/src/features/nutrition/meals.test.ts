import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  isValidMealText,
  isValidMealTime,
  toEatenAtIso,
  localDayOf,
  formatMealTime,
  sortNewestFirst,
  groupByDay,
  formatMealCountLabel,
  MAX_MEAL_LENGTH,
} from './meals';
import type { Meal } from './types';

function meal(overrides: Partial<Meal> & { id: number }): Meal {
  return {
    eatenAt: '2026-09-04T10:00:00.000Z',
    description: 'Haferbrei',
    ...overrides,
  };
}

/** Lokale Zeit als ISO -- so, wie sie aus dem Formular käme. */
function localIso(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

describe('nutrition meals', () => {
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  describe('isValidMealText', () => {
    it('rejects an empty field', () => {
      expect(isValidMealText('')).toBe(false);
    });

    it('rejects whitespace alone', () => {
      expect(isValidMealText('   ')).toBe(false);
    });

    it('accepts a short note', () => {
      expect(isValidMealText('Brot mit Käse')).toBe(true);
    });

    it('accepts exactly the maximum length', () => {
      expect(isValidMealText('a'.repeat(MAX_MEAL_LENGTH))).toBe(true);
    });

    it('rejects one character beyond it', () => {
      expect(isValidMealText('a'.repeat(MAX_MEAL_LENGTH + 1))).toBe(false);
    });
  });

  describe('isValidMealTime', () => {
    it('accepts a normal time', () => {
      expect(isValidMealTime('08:30')).toBe(true);
    });

    it('accepts both ends of the day', () => {
      expect(isValidMealTime('00:00')).toBe(true);
      expect(isValidMealTime('23:59')).toBe(true);
    });

    it('rejects an impossible hour', () => {
      expect(isValidMealTime('24:00')).toBe(false);
    });

    it('rejects an impossible minute', () => {
      expect(isValidMealTime('08:60')).toBe(false);
    });

    it('rejects a missing leading zero', () => {
      expect(isValidMealTime('8:30')).toBe(false);
    });
  });

  describe('toEatenAtIso', () => {
    it('reads date and time as local and stores the instant', () => {
      expect(toEatenAtIso('2026-09-04', '08:30')).toBe(localIso(2026, 9, 4, 8, 30));
    });

    it('keeps an early morning meal on its own day', () => {
      const iso = toEatenAtIso('2026-09-04', '00:30');
      expect(localDayOf(meal({ id: 1, eatenAt: iso }))).toBe('2026-09-04');
    });
  });

  describe('formatMealTime', () => {
    it('pads the local time to four digits', () => {
      expect(formatMealTime(meal({ id: 1, eatenAt: localIso(2026, 9, 4, 8, 5) }))).toBe('08:05');
    });
  });

  describe('sortNewestFirst', () => {
    it('puts the latest meal first', () => {
      const meals = [
        meal({ id: 1, eatenAt: localIso(2026, 9, 4, 8, 0) }),
        meal({ id: 2, eatenAt: localIso(2026, 9, 4, 19, 0) }),
        meal({ id: 3, eatenAt: localIso(2026, 9, 4, 13, 0) }),
      ];
      expect(sortNewestFirst(meals).map((entry) => entry.id)).toEqual([2, 3, 1]);
    });

    it('does not change the list it was given', () => {
      const meals = [
        meal({ id: 1, eatenAt: localIso(2026, 9, 4, 8, 0) }),
        meal({ id: 2, eatenAt: localIso(2026, 9, 4, 19, 0) }),
      ];
      sortNewestFirst(meals);
      expect(meals.map((entry) => entry.id)).toEqual([1, 2]);
    });
  });

  describe('groupByDay', () => {
    it('sorts the meals into local calendar days, newest day first', () => {
      const meals = [
        meal({ id: 1, eatenAt: localIso(2026, 9, 3, 19, 0) }),
        meal({ id: 2, eatenAt: localIso(2026, 9, 4, 8, 0) }),
        meal({ id: 3, eatenAt: localIso(2026, 9, 4, 13, 0) }),
      ];
      const grouped = groupByDay(meals);
      expect([...grouped.keys()]).toEqual(['2026-09-04', '2026-09-03']);
      expect(grouped.get('2026-09-04')?.map((entry) => entry.id)).toEqual([3, 2]);
    });

    it('is empty without a single meal', () => {
      expect(groupByDay([])).toEqual(new Map());
    });
  });

  describe('formatMealCountLabel', () => {
    it('says plainly when nothing was recorded', () => {
      expect(formatMealCountLabel(0)).toBe('Noch nichts erfasst');
    });

    it('uses the singular for one', () => {
      expect(formatMealCountLabel(1)).toBe('1 Mahlzeit erfasst');
    });

    it('uses the plural above one', () => {
      expect(formatMealCountLabel(9)).toBe('9 Mahlzeiten erfasst');
    });
  });
});
