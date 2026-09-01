import { describe, it, expect } from 'vitest';
import { buildDailyTrend } from './trendLogic';
import type { DiaryEntryWithTriggers } from './types';

function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-22T10:00:00',
    stoolFrequency: 2,
    bloodLevel: 0,
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

describe('buildDailyTrend', () => {
  it('returns exactly 7 days for a 7-day range', () => {
    expect(buildDailyTrend([], 7, REFERENCE_DATE)).toHaveLength(7);
  });

  it('returns exactly 30 days for a 30-day range', () => {
    expect(buildDailyTrend([], 30, REFERENCE_DATE)).toHaveLength(30);
  });

  it('returns exactly 90 days for a 90-day range', () => {
    expect(buildDailyTrend([], 90, REFERENCE_DATE)).toHaveLength(90);
  });

  it('orders days ascending, oldest first, ending on the reference date', () => {
    const days = buildDailyTrend([], 7, REFERENCE_DATE);
    expect(days[0].date).toBe('2026-07-16');
    expect(days[6].date).toBe('2026-07-22');
  });

  it('returns null trend values for a day with no entries', () => {
    const days = buildDailyTrend([], 7, REFERENCE_DATE);
    expect(days[6].worstPainLevel).toBeNull();
    expect(days[6].totalStoolFrequency).toBeNull();
  });

  it('takes the worst pain level and sums the frequency for multiple entries on the same day', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T08:00:00', painLevel: 3, stoolFrequency: 2 }),
      makeEntry({ id: 2, occurredAt: '2026-07-22T20:00:00', painLevel: 4, stoolFrequency: 3 }),
    ];
    const days = buildDailyTrend(entries, 7, REFERENCE_DATE);
    expect(days[6].worstPainLevel).toBe(4); // max(3, 4) = 4
    expect(days[6].totalStoolFrequency).toBe(5); // 2 + 3 = 5
  });

  it('combines three entries on the same day into the worst pain level and total frequency', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T06:00:00', painLevel: 1, stoolFrequency: 1 }),
      makeEntry({ id: 2, occurredAt: '2026-07-22T12:00:00', painLevel: 1, stoolFrequency: 1 }),
      makeEntry({ id: 3, occurredAt: '2026-07-22T18:00:00', painLevel: 2, stoolFrequency: 2 }),
    ];
    const days = buildDailyTrend(entries, 7, REFERENCE_DATE);
    expect(days[6].worstPainLevel).toBe(2); // max(1, 1, 2) = 2
    expect(days[6].totalStoolFrequency).toBe(4); // 1 + 1 + 2 = 4
  });

  it('ignores entries outside the selected range', () => {
    const entries = [makeEntry({ occurredAt: '2026-06-01T10:00:00', painLevel: 9 })];
    const days = buildDailyTrend(entries, 7, REFERENCE_DATE);
    expect(days.every((day) => day.worstPainLevel === null)).toBe(true);
  });

  it('places an entry on the correct day within the range', () => {
    const entries = [makeEntry({ occurredAt: '2026-07-18T10:00:00', painLevel: 5, stoolFrequency: 4 })];
    const days = buildDailyTrend(entries, 7, REFERENCE_DATE);
    const julyEighteenth = days.find((day) => day.date === '2026-07-18');
    expect(julyEighteenth?.worstPainLevel).toBe(5);
    expect(julyEighteenth?.totalStoolFrequency).toBe(4);
  });

  it('adds up the frequencies of a day split across entries', () => {
    const entries = [
      makeEntry({ occurredAt: '2026-07-20T08:00:00', stoolFrequency: 5, painLevel: 0 }),
      makeEntry({ occurredAt: '2026-07-20T20:00:00', stoolFrequency: 4, painLevel: 0 }),
    ];
    const days = buildDailyTrend(entries, 7, REFERENCE_DATE);
    const day = days.find((candidate) => candidate.date === '2026-07-20');
    expect(day?.totalStoolFrequency).toBe(9);
  });

  it('takes the highest pain level of a split day, not the average', () => {
    const entries = [
      makeEntry({ occurredAt: '2026-07-20T08:00:00', stoolFrequency: 0, painLevel: 0 }),
      makeEntry({ occurredAt: '2026-07-20T20:00:00', stoolFrequency: 0, painLevel: 8 }),
    ];
    const days = buildDailyTrend(entries, 7, REFERENCE_DATE);
    const day = days.find((candidate) => candidate.date === '2026-07-20');
    expect(day?.worstPainLevel).toBe(8);
  });
});
