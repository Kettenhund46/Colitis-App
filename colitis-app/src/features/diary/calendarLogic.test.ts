import { describe, it, expect } from 'vitest';
import {
  rateDiaryEntry,
  rateDayEntries,
  groupEntriesByDay,
  buildCalendarGrid,
  buildDayRatings,
  accentForRating,
} from './calendarLogic';
import type { DiaryEntryWithTriggers } from './types';

function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-08T10:00:00.000Z',
    stoolFrequency: 2,
    bloodLevel: 0,
    nocturnalStools: 0,
    stoolConsistency: 'normal',
    painLevel: 2,
    symptoms: [],
    note: null,
    triggerCategories: [],
    foodTriggerNote: null,
    ...overrides,
  };
}

describe('rateDiaryEntry', () => {
  it('rates a low-symptom entry as good', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 0, bloodLevel: 0 }))).toBe('good');
  });

  it('rates blood as bad even with low pain and frequency', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 0, bloodLevel: 1 }))).toBe('bad');
  });

  it('rates painLevel 7 as bad', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 7, stoolFrequency: 0 }))).toBe('bad');
  });

  it('rates painLevel 6 as medium (below the bad threshold)', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 6, stoolFrequency: 0 }))).toBe('medium');
  });

  it('rates stoolFrequency 8 as bad', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 8 }))).toBe('bad');
  });

  it('rates stoolFrequency 7 as medium (below the bad threshold)', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 7 }))).toBe('medium');
  });

  it('rates painLevel 4 as medium', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 4, stoolFrequency: 0 }))).toBe('medium');
  });

  it('rates painLevel 3 as good (below the medium threshold)', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 3, stoolFrequency: 0 }))).toBe('good');
  });

  it('rates stoolFrequency 5 as medium', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 5 }))).toBe('medium');
  });

  it('rates stoolFrequency 4 as good (below the medium threshold)', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 4 }))).toBe('good');
  });
});

describe('rateDayEntries', () => {
  it('returns good for a single good entry', () => {
    const entries = [makeEntry({ painLevel: 1, stoolFrequency: 1 })];
    expect(rateDayEntries(entries)).toBe('good');
  });

  it('returns the worst rating when entries are mixed good and bad', () => {
    const entries = [makeEntry({ painLevel: 1 }), makeEntry({ bloodLevel: 1 })];
    expect(rateDayEntries(entries)).toBe('bad');
  });

  it('returns the worst rating when entries are mixed good and medium', () => {
    const entries = [makeEntry({ painLevel: 1 }), makeEntry({ painLevel: 4 })];
    expect(rateDayEntries(entries)).toBe('medium');
  });

  it('is independent of entry order', () => {
    const entries = [makeEntry({ bloodLevel: 1 }), makeEntry({ painLevel: 1 }), makeEntry({ painLevel: 4 })];
    expect(rateDayEntries(entries)).toBe('bad');
  });

  it('adds up the frequencies of a day split across entries', () => {
    const entries = [
      makeEntry({ stoolFrequency: 5, painLevel: 0, bloodLevel: 0 }),
      makeEntry({ stoolFrequency: 4, painLevel: 0, bloodLevel: 0 }),
    ];
    expect(rateDayEntries(entries)).toBe('bad');
  });

  it('rates a split day as medium once the sum reaches five', () => {
    const entries = [
      makeEntry({ stoolFrequency: 3, painLevel: 0, bloodLevel: 0 }),
      makeEntry({ stoolFrequency: 2, painLevel: 0, bloodLevel: 0 }),
    ];
    expect(rateDayEntries(entries)).toBe('medium');
  });

  it('keeps a quiet split day good', () => {
    const entries = [
      makeEntry({ stoolFrequency: 2, painLevel: 1, bloodLevel: 0 }),
      makeEntry({ stoolFrequency: 2, painLevel: 2, bloodLevel: 0 }),
    ];
    expect(rateDayEntries(entries)).toBe('good');
  });

  it('takes the highest pain level of the day, not the sum', () => {
    const entries = [
      makeEntry({ stoolFrequency: 0, painLevel: 3, bloodLevel: 0 }),
      makeEntry({ stoolFrequency: 0, painLevel: 3, bloodLevel: 0 }),
    ];
    expect(rateDayEntries(entries)).toBe('good');
  });

  it('flags the day as bad when any entry recorded blood', () => {
    const entries = [
      makeEntry({ stoolFrequency: 1, painLevel: 0, bloodLevel: 1 }),
      makeEntry({ stoolFrequency: 1, painLevel: 0, bloodLevel: 0 }),
    ];
    expect(rateDayEntries(entries)).toBe('bad');
  });

  it('rates a day without entries as good', () => {
    expect(rateDayEntries([])).toBe('good');
  });
});

describe('groupEntriesByDay', () => {
  it('groups two entries on the same local day under one key', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-21T08:00:00' }),
      makeEntry({ id: 2, occurredAt: '2026-07-21T20:00:00' }),
    ];
    const grouped = groupEntriesByDay(entries);
    expect(grouped.size).toBe(1);
    expect(grouped.get('2026-07-21')).toHaveLength(2);
  });

  it('splits entries just before and after local midnight into separate days', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-21T23:59:00' }),
      makeEntry({ id: 2, occurredAt: '2026-07-22T00:01:00' }),
    ];
    const grouped = groupEntriesByDay(entries);
    expect(grouped.size).toBe(2);
    expect(grouped.get('2026-07-21')).toHaveLength(1);
    expect(grouped.get('2026-07-22')).toHaveLength(1);
  });

  it('returns an empty map for no entries', () => {
    expect(groupEntriesByDay([]).size).toBe(0);
  });
});

describe('buildCalendarGrid', () => {
  it('always returns exactly 42 cells', () => {
    expect(buildCalendarGrid(2026, 6)).toHaveLength(42);
  });

  it('marks days outside the requested month as isCurrentMonth: false', () => {
    const cells = buildCalendarGrid(2026, 6); // July 2026
    const outside = cells.filter((cell) => !cell.isCurrentMonth);
    const inside = cells.filter((cell) => cell.isCurrentMonth);
    expect(inside).toHaveLength(31); // July has 31 days
    expect(outside.length).toBeGreaterThan(0);
  });

  it('starts the grid on a Monday', () => {
    const cells = buildCalendarGrid(2026, 6);
    const [year, month, day] = cells[0].date.split('-').map(Number);
    const firstCellDate = new Date(year, month - 1, day);
    expect(firstCellDate.getDay()).toBe(1); // 1 = Monday
  });

  it('handles a December-to-January month rollover', () => {
    const cells = buildCalendarGrid(2026, 11); // December 2026
    const inside = cells.filter((cell) => cell.isCurrentMonth);
    expect(inside).toHaveLength(31);
    expect(inside[0].date).toBe('2026-12-01');
    expect(inside[inside.length - 1].date).toBe('2026-12-31');
  });

  it('handles February in a leap year', () => {
    const cells = buildCalendarGrid(2028, 1); // February 2028 (leap year)
    const inside = cells.filter((cell) => cell.isCurrentMonth);
    expect(inside).toHaveLength(29);
  });
});

describe('buildDayRatings', () => {
  it('returns an empty map for no entries', () => {
    expect(buildDayRatings([]).size).toBe(0);
  });

  it('rates a day with a single entry', () => {
    const entries = [
      makeEntry({ occurredAt: '2026-08-18T09:00:00', stoolFrequency: 1, painLevel: 0, bloodLevel: 0 }),
    ];
    expect(buildDayRatings(entries).get('2026-08-18')).toBe('good');
  });

  it('rates a split day by its combined values, not by a single entry', () => {
    const entries = [
      makeEntry({ occurredAt: '2026-08-18T09:00:00', stoolFrequency: 5, painLevel: 0, bloodLevel: 0 }),
      makeEntry({ occurredAt: '2026-08-18T20:00:00', stoolFrequency: 4, painLevel: 0, bloodLevel: 0 }),
    ];
    expect(buildDayRatings(entries).get('2026-08-18')).toBe('bad');
  });

  it('keeps days apart from one another', () => {
    const entries = [
      makeEntry({ occurredAt: '2026-08-17T09:00:00', stoolFrequency: 1, painLevel: 0, bloodLevel: 0 }),
      makeEntry({ occurredAt: '2026-08-18T09:00:00', stoolFrequency: 1, painLevel: 0, bloodLevel: 1 }),
    ];
    const ratings = buildDayRatings(entries);

    expect(ratings.get('2026-08-17')).toBe('good');
    expect(ratings.get('2026-08-18')).toBe('bad');
    expect(ratings.size).toBe(2);
  });

  it('agrees with rateDayEntries for the same day', () => {
    const entries = [
      makeEntry({ occurredAt: '2026-08-18T09:00:00', stoolFrequency: 3, painLevel: 5, bloodLevel: 0 }),
      makeEntry({ occurredAt: '2026-08-18T20:00:00', stoolFrequency: 2, painLevel: 1, bloodLevel: 0 }),
    ];
    expect(buildDayRatings(entries).get('2026-08-18')).toBe(rateDayEntries(entries));
  });
});

describe('accentForRating', () => {
  it('leaves days without a rating without an edge', () => {
    expect(accentForRating(undefined)).toBeUndefined();
  });

  it('maps a flare-suspect day to the danger edge', () => {
    expect(accentForRating('bad')).toBe('danger');
  });

  it('maps a good day to the good edge and a middling one to warning', () => {
    expect(accentForRating('good')).toBe('good');
    expect(accentForRating('medium')).toBe('warning');
  });
});
