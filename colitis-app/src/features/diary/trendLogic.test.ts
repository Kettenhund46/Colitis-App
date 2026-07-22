import { describe, it, expect } from 'vitest';
import { buildDailyAverages } from './trendLogic';
import type { DiaryEntryWithTriggers } from './types';

function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-22T10:00:00',
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

const REFERENCE_DATE = new Date(2026, 6, 22); // 22. Juli 2026, lokal (Monat 0-indiziert)

describe('buildDailyAverages', () => {
  it('returns exactly 7 days for a 7-day range', () => {
    expect(buildDailyAverages([], 7, REFERENCE_DATE)).toHaveLength(7);
  });

  it('returns exactly 30 days for a 30-day range', () => {
    expect(buildDailyAverages([], 30, REFERENCE_DATE)).toHaveLength(30);
  });

  it('returns exactly 90 days for a 90-day range', () => {
    expect(buildDailyAverages([], 90, REFERENCE_DATE)).toHaveLength(90);
  });

  it('orders days ascending, oldest first, ending on the reference date', () => {
    const days = buildDailyAverages([], 7, REFERENCE_DATE);
    expect(days[0].date).toBe('2026-07-16');
    expect(days[6].date).toBe('2026-07-22');
  });

  it('returns null averages for a day with no entries', () => {
    const days = buildDailyAverages([], 7, REFERENCE_DATE);
    expect(days[6].averagePainLevel).toBeNull();
    expect(days[6].averageStoolFrequency).toBeNull();
  });

  it('averages multiple entries on the same day, rounded to one decimal', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T08:00:00', painLevel: 3, stoolFrequency: 2 }),
      makeEntry({ id: 2, occurredAt: '2026-07-22T20:00:00', painLevel: 4, stoolFrequency: 3 }),
    ];
    const days = buildDailyAverages(entries, 7, REFERENCE_DATE);
    expect(days[6].averagePainLevel).toBe(3.5);
    expect(days[6].averageStoolFrequency).toBe(2.5);
  });

  it('rounds a repeating-decimal average to one decimal place', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T06:00:00', painLevel: 1, stoolFrequency: 1 }),
      makeEntry({ id: 2, occurredAt: '2026-07-22T12:00:00', painLevel: 1, stoolFrequency: 1 }),
      makeEntry({ id: 3, occurredAt: '2026-07-22T18:00:00', painLevel: 2, stoolFrequency: 2 }),
    ];
    const days = buildDailyAverages(entries, 7, REFERENCE_DATE);
    expect(days[6].averagePainLevel).toBe(1.3); // (1+1+2)/3 = 1.333...
    expect(days[6].averageStoolFrequency).toBe(1.3);
  });

  it('ignores entries outside the selected range', () => {
    const entries = [makeEntry({ occurredAt: '2026-06-01T10:00:00', painLevel: 9 })];
    const days = buildDailyAverages(entries, 7, REFERENCE_DATE);
    expect(days.every((day) => day.averagePainLevel === null)).toBe(true);
  });

  it('places an entry on the correct day within the range', () => {
    const entries = [makeEntry({ occurredAt: '2026-07-18T10:00:00', painLevel: 5, stoolFrequency: 4 })];
    const days = buildDailyAverages(entries, 7, REFERENCE_DATE);
    const julyEighteenth = days.find((day) => day.date === '2026-07-18');
    expect(julyEighteenth?.averagePainLevel).toBe(5);
    expect(julyEighteenth?.averageStoolFrequency).toBe(4);
  });
});
