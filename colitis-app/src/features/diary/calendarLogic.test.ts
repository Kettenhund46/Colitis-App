import { describe, it, expect } from 'vitest';
import { rateDiaryEntry, rateDayEntries, groupEntriesByDay, buildCalendarGrid } from './calendarLogic';
import type { DiaryEntryWithTriggers } from './types';

function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-08T10:00:00.000Z',
    stoolFrequency: 2,
    hasBlood: false,
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
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 0, hasBlood: false }))).toBe('good');
  });

  it('rates blood as bad even with low pain and frequency', () => {
    expect(rateDiaryEntry(makeEntry({ painLevel: 0, stoolFrequency: 0, hasBlood: true }))).toBe('bad');
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
    const entries = [makeEntry({ painLevel: 1 }), makeEntry({ hasBlood: true })];
    expect(rateDayEntries(entries)).toBe('bad');
  });

  it('returns the worst rating when entries are mixed good and medium', () => {
    const entries = [makeEntry({ painLevel: 1 }), makeEntry({ painLevel: 4 })];
    expect(rateDayEntries(entries)).toBe('medium');
  });

  it('is independent of entry order', () => {
    const entries = [makeEntry({ hasBlood: true }), makeEntry({ painLevel: 1 }), makeEntry({ painLevel: 4 })];
    expect(rateDayEntries(entries)).toBe('bad');
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
    const firstCellDate = new Date(cells[0].date);
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
