import { describe, it, expect } from 'vitest';
import {
  STOOL_CONSISTENCY_SEVERITY,
  worseConsistency,
  findTodaysEntry,
  buildQuickEntryInput,
  buildQuickEntryUpdate,
} from './quickEntryLogic';
import type { DiaryEntryWithTriggers } from './types';

function localIso(year: number, monthIndex: number, day: number, hour: number): string {
  return new Date(year, monthIndex, day, hour, 0, 0).toISOString();
}

function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: localIso(2026, 6, 27, 10),
    stoolFrequency: 2,
    hasBlood: false,
    stoolConsistency: 'normal',
    painLevel: 3,
    symptoms: ['muedigkeit'],
    note: 'Vorhandene Notiz',
    triggerCategories: ['stress'],
    foodTriggerNote: null,
    ...overrides,
  };
}

describe('STOOL_CONSISTENCY_SEVERITY', () => {
  it('orders consistencies from harmless to worst', () => {
    expect(STOOL_CONSISTENCY_SEVERITY.hart).toBe(0);
    expect(STOOL_CONSISTENCY_SEVERITY.normal).toBe(1);
    expect(STOOL_CONSISTENCY_SEVERITY.weich).toBe(2);
    expect(STOOL_CONSISTENCY_SEVERITY.waessrig).toBe(3);
  });
});

describe('worseConsistency', () => {
  it('returns the worse value regardless of argument order', () => {
    expect(worseConsistency('hart', 'normal')).toBe('normal');
    expect(worseConsistency('normal', 'hart')).toBe('normal');
    expect(worseConsistency('normal', 'weich')).toBe('weich');
    expect(worseConsistency('weich', 'normal')).toBe('weich');
    expect(worseConsistency('weich', 'waessrig')).toBe('waessrig');
    expect(worseConsistency('waessrig', 'weich')).toBe('waessrig');
    expect(worseConsistency('hart', 'waessrig')).toBe('waessrig');
    expect(worseConsistency('waessrig', 'hart')).toBe('waessrig');
  });

  it('returns the value itself when both are equal', () => {
    expect(worseConsistency('weich', 'weich')).toBe('weich');
  });
});

describe('findTodaysEntry', () => {
  const now = new Date(2026, 6, 27, 18, 0, 0);

  it('returns null for an empty list', () => {
    expect(findTodaysEntry([], now)).toBeNull();
  });

  it('returns null when every entry is from another day', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: localIso(2026, 6, 26, 23) }),
      makeEntry({ id: 2, occurredAt: localIso(2026, 6, 28, 1) }),
    ];
    expect(findTodaysEntry(entries, now)).toBeNull();
  });

  it("returns today's entry", () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: localIso(2026, 6, 26, 9) }),
      makeEntry({ id: 2, occurredAt: localIso(2026, 6, 27, 9) }),
    ];
    expect(findTodaysEntry(entries, now)?.id).toBe(2);
  });

  it('returns the newest entry when several exist for today', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: localIso(2026, 6, 27, 8) }),
      makeEntry({ id: 2, occurredAt: localIso(2026, 6, 27, 15) }),
      makeEntry({ id: 3, occurredAt: localIso(2026, 6, 27, 11) }),
    ];
    expect(findTodaysEntry(entries, now)?.id).toBe(2);
  });

  it('ignores an entry from the same day and month one year earlier', () => {
    const entries = [makeEntry({ id: 1, occurredAt: localIso(2025, 6, 27, 10) })];
    expect(findTodaysEntry(entries, now)).toBeNull();
  });
});

describe('buildQuickEntryInput', () => {
  it('records frequency 1 and leaves every optional field empty', () => {
    const occurredAt = localIso(2026, 6, 27, 12);
    const input = buildQuickEntryInput('weich', false, occurredAt);

    expect(input).toEqual({
      occurredAt,
      stoolFrequency: 1,
      hasBlood: false,
      stoolConsistency: 'weich',
      painLevel: 0,
      symptoms: [],
      note: null,
      triggerCategories: [],
      foodTriggerNote: null,
    });
  });

  it('passes the blood flag through', () => {
    const input = buildQuickEntryInput('waessrig', true, localIso(2026, 6, 27, 12));
    expect(input.hasBlood).toBe(true);
  });
});

describe('buildQuickEntryUpdate', () => {
  it('increments the frequency by one', () => {
    const update = buildQuickEntryUpdate(makeEntry({ stoolFrequency: 4 }), 'normal', false);
    expect(update.stoolFrequency).toBe(5);
  });

  it('keeps blood set once it was recorded', () => {
    const update = buildQuickEntryUpdate(makeEntry({ hasBlood: true }), 'normal', false);
    expect(update.hasBlood).toBe(true);
  });

  it('sets blood when this tap reports it', () => {
    const update = buildQuickEntryUpdate(makeEntry({ hasBlood: false }), 'normal', true);
    expect(update.hasBlood).toBe(true);
  });

  it('keeps the worse consistency when the new one is milder', () => {
    const update = buildQuickEntryUpdate(makeEntry({ stoolConsistency: 'waessrig' }), 'hart', false);
    expect(update.stoolConsistency).toBe('waessrig');
  });

  it('takes over the new consistency when it is worse', () => {
    const update = buildQuickEntryUpdate(makeEntry({ stoolConsistency: 'hart' }), 'weich', false);
    expect(update.stoolConsistency).toBe('weich');
  });

  it('falls back to normal when the stored consistency is unknown', () => {
    const update = buildQuickEntryUpdate(makeEntry({ stoolConsistency: 'unbekannt' }), 'hart', false);
    expect(update.stoolConsistency).toBe('normal');
  });

  it('reports only the three quick fields', () => {
    const update = buildQuickEntryUpdate(makeEntry(), 'normal', false);
    expect(Object.keys(update).sort()).toEqual(['hasBlood', 'stoolConsistency', 'stoolFrequency']);
  });
});
