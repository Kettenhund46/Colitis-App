import { describe, it, expect } from 'vitest';
import {
  dosesOnDate,
  isPausedOn,
  pausedSince,
  openSegment,
  planScheduleChange,
  dueDaysIn,
  segmentsFor,
  groupByMedication,
  pausedMedicationIdsOn,
  PAUSED_DOSES,
} from './scheduleHistory';
import type { ScheduleSegment } from './scheduleHistory';

function segment(overrides: Partial<ScheduleSegment> & { id: number }): ScheduleSegment {
  return {
    validFrom: '2026-06-01',
    validTo: null,
    dosesPerDay: 3,
    ...overrides,
  };
}

describe('dosesOnDate', () => {
  it('reads the number that was in force on that day, not the current one', () => {
    const segments = [
      segment({ id: 1, validFrom: '2026-06-01', validTo: '2026-07-31', dosesPerDay: 3 }),
      segment({ id: 2, validFrom: '2026-08-01', validTo: null, dosesPerDay: 1 }),
    ];
    expect(dosesOnDate(segments, '2026-06-15')).toBe(3);
    expect(dosesOnDate(segments, '2026-08-15')).toBe(1);
  });

  it('includes both boundary days of a closed segment', () => {
    const segments = [segment({ id: 1, validFrom: '2026-06-01', validTo: '2026-07-31' })];
    expect(dosesOnDate(segments, '2026-06-01')).toBe(3);
    expect(dosesOnDate(segments, '2026-07-31')).toBe(3);
  });

  it('returns null before the first segment', () => {
    const segments = [segment({ id: 1, validFrom: '2026-06-01' })];
    expect(dosesOnDate(segments, '2026-05-31')).toBeNull();
  });

  it('returns null after a closed last segment', () => {
    const segments = [segment({ id: 1, validFrom: '2026-06-01', validTo: '2026-06-30' })];
    expect(dosesOnDate(segments, '2026-07-01')).toBeNull();
  });

  it('returns null without any segment', () => {
    expect(dosesOnDate([], '2026-06-15')).toBeNull();
  });
});

describe('isPausedOn', () => {
  it('is paused inside a zero segment', () => {
    const segments = [
      segment({ id: 1, validFrom: '2026-06-01', validTo: '2026-06-30', dosesPerDay: 3 }),
      segment({ id: 2, validFrom: '2026-07-01', validTo: '2026-07-14', dosesPerDay: PAUSED_DOSES }),
      segment({ id: 3, validFrom: '2026-07-15', validTo: null, dosesPerDay: 3 }),
    ];
    expect(isPausedOn(segments, '2026-07-05')).toBe(true);
    expect(isPausedOn(segments, '2026-06-05')).toBe(false);
    expect(isPausedOn(segments, '2026-07-20')).toBe(false);
  });

  it('is not paused on a day no segment covers', () => {
    expect(isPausedOn([], '2026-07-05')).toBe(false);
  });
});

describe('pausedSince', () => {
  it('names the first day of the pause', () => {
    const segments = [
      segment({ id: 1, validFrom: '2026-07-01', validTo: null, dosesPerDay: PAUSED_DOSES }),
    ];
    expect(pausedSince(segments, '2026-07-20')).toBe('2026-07-01');
  });

  it('is null while the medication is running', () => {
    expect(pausedSince([segment({ id: 1 })], '2026-07-20')).toBeNull();
  });
});

describe('openSegment', () => {
  it('finds the segment without an end', () => {
    const segments = [
      segment({ id: 1, validFrom: '2026-06-01', validTo: '2026-07-31' }),
      segment({ id: 2, validFrom: '2026-08-01', validTo: null }),
    ];
    expect(openSegment(segments)?.id).toBe(2);
  });

  it('is null when every segment is closed', () => {
    expect(openSegment([segment({ id: 1, validTo: '2026-06-30' })])).toBeNull();
  });
});

describe('planScheduleChange', () => {
  it('opens the first segment when none exists', () => {
    expect(planScheduleChange([], '2026-08-01', 3)).toEqual({
      kind: 'open',
      validFrom: '2026-08-01',
      dosesPerDay: 3,
    });
  });

  it('does nothing when the number did not change', () => {
    const segments = [segment({ id: 1, dosesPerDay: 3 })];
    expect(planScheduleChange(segments, '2026-08-01', 3)).toEqual({ kind: 'none' });
  });

  it('closes the old segment on the previous day and opens a new one', () => {
    const segments = [segment({ id: 1, validFrom: '2026-06-01', dosesPerDay: 3 })];
    expect(planScheduleChange(segments, '2026-08-01', 1)).toEqual({
      kind: 'closeAndOpen',
      segmentId: 1,
      validTo: '2026-07-31',
      validFrom: '2026-08-01',
      dosesPerDay: 1,
    });
  });

  it('crosses the turn of the year when closing', () => {
    const segments = [segment({ id: 1, validFrom: '2026-06-01', dosesPerDay: 3 })];
    expect(planScheduleChange(segments, '2027-01-01', 1)).toMatchObject({
      validTo: '2026-12-31',
    });
  });

  it('overwrites instead of creating a segment without a single day', () => {
    const segments = [segment({ id: 1, validFrom: '2026-08-01', dosesPerDay: 3 })];
    expect(planScheduleChange(segments, '2026-08-01', 1)).toEqual({
      kind: 'replace',
      segmentId: 1,
      dosesPerDay: 1,
    });
  });

  it('overwrites when the change is dated before the open segment', () => {
    const segments = [segment({ id: 1, validFrom: '2026-08-05', dosesPerDay: 3 })];
    expect(planScheduleChange(segments, '2026-08-01', 1)).toMatchObject({ kind: 'replace' });
  });

  it('treats a pause as an ordinary change to zero', () => {
    const segments = [segment({ id: 1, validFrom: '2026-06-01', dosesPerDay: 3 })];
    expect(planScheduleChange(segments, '2026-08-01', PAUSED_DOSES)).toMatchObject({
      kind: 'closeAndOpen',
      dosesPerDay: 0,
    });
  });

  it('does not change the segments it was given', () => {
    const segments = [segment({ id: 1, validFrom: '2026-06-01', dosesPerDay: 3 })];
    planScheduleChange(segments, '2026-08-01', 1);
    expect(segments).toEqual([
      { id: 1, validFrom: '2026-06-01', validTo: null, dosesPerDay: 3 },
    ]);
  });
});

describe('dueDaysIn', () => {
  const days = ['2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03'];

  it('leaves out the paused days', () => {
    const segments = [
      segment({ id: 1, validFrom: '2026-06-01', validTo: '2026-06-30', dosesPerDay: 3 }),
      segment({ id: 2, validFrom: '2026-07-01', validTo: '2026-07-02', dosesPerDay: PAUSED_DOSES }),
      segment({ id: 3, validFrom: '2026-07-03', validTo: null, dosesPerDay: 3 }),
    ];
    expect(dueDaysIn(segments, days)).toEqual(['2026-06-30', '2026-07-03']);
  });

  it('leaves out the days no segment covers', () => {
    const segments = [segment({ id: 1, validFrom: '2026-07-02', validTo: null, dosesPerDay: 3 })];
    expect(dueDaysIn(segments, days)).toEqual(['2026-07-02', '2026-07-03']);
  });

  it('is empty without any segment', () => {
    expect(dueDaysIn([], days)).toEqual([]);
  });
});

describe('segmentsFor', () => {
  it('returns an empty list for an unknown medication', () => {
    expect(segmentsFor(new Map(), 7)).toEqual([]);
  });

  it('returns the stored segments', () => {
    const segments = [segment({ id: 1 })];
    expect(segmentsFor(new Map([[7, segments]]), 7)).toBe(segments);
  });
});

describe('groupByMedication', () => {
  it('sorts flat rows into one list per medication', () => {
    const history = groupByMedication([
      { id: 1, medicationId: 5, validFrom: '2026-06-01', validTo: '2026-07-31', dosesPerDay: 3 },
      { id: 2, medicationId: 6, validFrom: '2026-06-01', validTo: null, dosesPerDay: 1 },
      { id: 3, medicationId: 5, validFrom: '2026-08-01', validTo: null, dosesPerDay: 1 },
    ]);
    expect(history.get(5)?.map((segment) => segment.id)).toEqual([1, 3]);
    expect(history.get(6)?.map((segment) => segment.id)).toEqual([2]);
  });

  it('is empty without any row', () => {
    expect(groupByMedication([])).toEqual(new Map());
  });
});

describe('pausedMedicationIdsOn', () => {
  const rows = [
    { id: 1, medicationId: 5, validFrom: '2026-06-01', validTo: '2026-07-31', dosesPerDay: 3 },
    { id: 2, medicationId: 5, validFrom: '2026-08-01', validTo: null, dosesPerDay: 0 },
    { id: 3, medicationId: 6, validFrom: '2026-06-01', validTo: null, dosesPerDay: 1 },
  ];

  it('names only what is paused on that day', () => {
    expect(pausedMedicationIdsOn(rows, '2026-08-15')).toEqual(new Set([5]));
  });

  it('names nothing before the pause began', () => {
    expect(pausedMedicationIdsOn(rows, '2026-07-15')).toEqual(new Set());
  });

  it('names nothing without any row', () => {
    expect(pausedMedicationIdsOn([], '2026-08-15')).toEqual(new Set());
  });
});
