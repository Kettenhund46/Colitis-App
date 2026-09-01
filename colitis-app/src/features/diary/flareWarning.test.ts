import { describe, it, expect } from 'vitest';
import { shouldShowFlareWarning } from './flareWarning';
import type { DiaryEntryWithTriggers } from './types';

function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-22T10:00:00',
    stoolFrequency: 1,
    bloodLevel: 0,
    nocturnalStools: 0,
    stoolConsistency: 'normal',
    painLevel: 1,
    symptoms: [],
    note: null,
    triggerCategories: [],
    foodTriggerNote: null,
    ...overrides,
  };
}

const REFERENCE_DATE = new Date(2026, 6, 22); // 22. Juli 2026, lokal (Monat 0-indiziert)

describe('shouldShowFlareWarning', () => {
  it('returns false for no entries', () => {
    expect(shouldShowFlareWarning([], REFERENCE_DATE)).toBe(false);
  });

  it('returns false when only 2 bad days occur within the last 7 days', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T08:00:00', bloodLevel: 1 }),
      makeEntry({ id: 2, occurredAt: '2026-07-20T08:00:00', bloodLevel: 1 }),
    ];
    expect(shouldShowFlareWarning(entries, REFERENCE_DATE)).toBe(false);
  });

  it('returns true when exactly 3 bad days occur within the last 7 days', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T08:00:00', bloodLevel: 1 }),
      makeEntry({ id: 2, occurredAt: '2026-07-20T08:00:00', bloodLevel: 1 }),
      makeEntry({ id: 3, occurredAt: '2026-07-18T08:00:00', bloodLevel: 1 }),
    ];
    expect(shouldShowFlareWarning(entries, REFERENCE_DATE)).toBe(true);
  });

  it('does not count a bad day outside the 7-day window', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T08:00:00', bloodLevel: 1 }),
      makeEntry({ id: 2, occurredAt: '2026-07-20T08:00:00', bloodLevel: 1 }),
      makeEntry({ id: 3, occurredAt: '2026-07-10T08:00:00', bloodLevel: 1 }),
    ];
    expect(shouldShowFlareWarning(entries, REFERENCE_DATE)).toBe(false);
  });

  it('counts non-consecutive bad days within the window the same as consecutive ones', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T08:00:00', bloodLevel: 1 }),
      makeEntry({ id: 2, occurredAt: '2026-07-19T08:00:00', bloodLevel: 1 }),
      makeEntry({ id: 3, occurredAt: '2026-07-16T08:00:00', bloodLevel: 1 }),
    ];
    expect(shouldShowFlareWarning(entries, REFERENCE_DATE)).toBe(true);
  });

  it('ignores good days when counting toward the threshold', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: '2026-07-22T08:00:00', bloodLevel: 1 }),
      makeEntry({ id: 2, occurredAt: '2026-07-21T08:00:00', painLevel: 1, stoolFrequency: 1 }),
      makeEntry({ id: 3, occurredAt: '2026-07-20T08:00:00', bloodLevel: 1 }),
    ];
    expect(shouldShowFlareWarning(entries, REFERENCE_DATE)).toBe(false);
  });
});
