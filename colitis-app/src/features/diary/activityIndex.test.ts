import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  stoolFrequencySubscore,
  computeDayActivityIndex,
  buildDailyActivityIndex,
  averageActivityIndex,
  latestActivityPoint,
  formatActivityIndexValue,
  formatActivityIndexBreakdown,
  formatActivityAverage,
  formatNormalStoolsLabel,
  MAX_ACTIVITY_INDEX,
} from './activityIndex';
import type { DayTotals } from './calendarLogic';
import type { BloodLevel } from './constants';
import type { DiaryEntryWithTriggers } from './types';

function totals(totalStoolFrequency: number, worstBloodLevel: BloodLevel = 0): DayTotals {
  return { totalStoolFrequency, worstPainLevel: 0, nocturnalStools: 0, worstBloodLevel };
}

function localIso(year: number, month: number, day: number, hour = 9): string {
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();
}

function entry(overrides: Partial<DiaryEntryWithTriggers> & { id: number }): DiaryEntryWithTriggers {
  return {
    occurredAt: localIso(2026, 8, 1),
    stoolFrequency: 0,
    bloodLevel: 0,
    nocturnalStools: 0,
    stoolConsistency: 'normal',
    painLevel: 0,
    symptoms: [],
    note: null,
    triggerCategories: [],
    foodTriggerNote: null,
    ...overrides,
  };
}

describe('stoolFrequencySubscore', () => {
  it('is 0 at the personal normal', () => {
    expect(stoolFrequencySubscore(2, 2)).toBe(0);
  });

  it('is 0 below the personal normal, never negative', () => {
    expect(stoolFrequencySubscore(0, 3)).toBe(0);
  });

  it('is 1 for one or two more than normal', () => {
    expect(stoolFrequencySubscore(3, 2)).toBe(1);
    expect(stoolFrequencySubscore(4, 2)).toBe(1);
  });

  it('is 2 for three or four more than normal', () => {
    expect(stoolFrequencySubscore(5, 2)).toBe(2);
    expect(stoolFrequencySubscore(6, 2)).toBe(2);
  });

  it('is 3 from five more than normal upwards', () => {
    expect(stoolFrequencySubscore(7, 2)).toBe(3);
    expect(stoolFrequencySubscore(30, 2)).toBe(3);
  });

  it('shifts with the personal normal instead of using absolute counts', () => {
    // Sechs Stuhlgaenge sind fuer den einen ein Schub, fuer den anderen normal.
    expect(stoolFrequencySubscore(6, 1)).toBe(3);
    expect(stoolFrequencySubscore(6, 6)).toBe(0);
  });
});

describe('computeDayActivityIndex', () => {
  it('adds both subscores', () => {
    expect(computeDayActivityIndex(totals(5, 2), 2)).toEqual({
      stoolSubscore: 2,
      bloodSubscore: 2,
      total: 4,
    });
  });

  it('reaches zero on a day at the personal normal without blood', () => {
    expect(computeDayActivityIndex(totals(2, 0), 2).total).toBe(0);
  });

  it('cannot exceed the maximum', () => {
    expect(computeDayActivityIndex(totals(99, 3), 1).total).toBe(MAX_ACTIVITY_INDEX);
  });

  it('takes the blood subscore straight from the day, unchanged', () => {
    expect(computeDayActivityIndex(totals(0, 3), 5).bloodSubscore).toBe(3);
  });
});

describe('buildDailyActivityIndex', () => {
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
  });

  afterAll(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it('returns one point per recorded day, in order', () => {
    const points = buildDailyActivityIndex(
      [
        entry({ id: 1, occurredAt: localIso(2026, 8, 3), stoolFrequency: 5 }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 1), stoolFrequency: 2 }),
      ],
      '2026-08-01',
      '2026-08-03',
      2
    );

    expect(points.map((point) => point.date)).toEqual(['2026-08-01', '2026-08-03']);
  });

  it('skips days without an entry instead of scoring them zero', () => {
    const points = buildDailyActivityIndex(
      [entry({ id: 1, occurredAt: localIso(2026, 8, 2), stoolFrequency: 2 })],
      '2026-08-01',
      '2026-08-03',
      2
    );

    expect(points).toHaveLength(1);
    expect(points[0].date).toBe('2026-08-02');
  });

  it('sums several entries of the same day before scoring', () => {
    const points = buildDailyActivityIndex(
      [
        entry({ id: 1, occurredAt: localIso(2026, 8, 1, 8), stoolFrequency: 3 }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 1, 20), stoolFrequency: 3 }),
      ],
      '2026-08-01',
      '2026-08-01',
      2
    );

    // Sechs statt zweimal drei: vier ueber dem Normalwert, also Teilwert 2.
    expect(points[0].index.stoolSubscore).toBe(2);
  });

  it('takes the worst blood level of the day', () => {
    const points = buildDailyActivityIndex(
      [
        entry({ id: 1, occurredAt: localIso(2026, 8, 1, 8), bloodLevel: 1 }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 1, 20), bloodLevel: 3 }),
      ],
      '2026-08-01',
      '2026-08-01',
      2
    );

    expect(points[0].index.bloodSubscore).toBe(3);
  });

  it('is empty without any entry', () => {
    expect(buildDailyActivityIndex([], '2026-08-01', '2026-08-03', 2)).toEqual([]);
  });
});

describe('averageActivityIndex', () => {
  const point = (total: number) => ({
    date: '2026-08-01',
    index: { stoolSubscore: total, bloodSubscore: 0, total },
  });

  it('is null without any point', () => {
    expect(averageActivityIndex([])).toBeNull();
  });

  it('rounds to one decimal', () => {
    expect(averageActivityIndex([point(1), point(2), point(2)])).toBe(1.7);
  });

  it('returns the value itself for a single day', () => {
    expect(averageActivityIndex([point(3)])).toBe(3);
  });
});

describe('latestActivityPoint', () => {
  it('is null without any point', () => {
    expect(latestActivityPoint([])).toBeNull();
  });

  it('returns the last point, which is the most recent day', () => {
    const points = [
      { date: '2026-08-01', index: { stoolSubscore: 1, bloodSubscore: 0, total: 1 } },
      { date: '2026-08-05', index: { stoolSubscore: 2, bloodSubscore: 1, total: 3 } },
    ];

    expect(latestActivityPoint(points)?.date).toBe('2026-08-05');
  });
});

describe('labels', () => {
  const index = { stoolSubscore: 2, bloodSubscore: 1, total: 3 };

  it('names the maximum alongside the value', () => {
    expect(formatActivityIndexValue(index)).toBe('3 von 6');
  });

  it('breaks the value down into its two parts', () => {
    expect(formatActivityIndexBreakdown(index)).toBe('Stuhlfrequenz 2 · Blut 1');
  });

  it('writes the average with a comma', () => {
    expect(formatActivityAverage(1.7)).toBe('1,7');
  });

  it('uses the singular for a normal of one', () => {
    expect(formatNormalStoolsLabel(1)).toBe('üblich: 1 Stuhlgang pro Tag');
  });

  it('uses the plural above one', () => {
    expect(formatNormalStoolsLabel(3)).toBe('üblich: 3 Stuhlgänge pro Tag');
  });
});
