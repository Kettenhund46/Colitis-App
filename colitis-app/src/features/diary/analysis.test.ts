import { describe, it, expect } from 'vitest';
import { computeTriggerPatterns } from './analysis';
import type { DiaryEntryWithTriggers } from './types';

function buildEntry(overrides: Partial<DiaryEntryWithTriggers>): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-01T08:00:00.000Z',
    stoolFrequency: 3,
    bloodLevel: 0,
    stoolConsistency: 'normal',
    painLevel: 4,
    symptoms: [],
    note: null,
    triggerCategories: [],
    foodTriggerNote: null,
    ...overrides,
  };
}

describe('computeTriggerPatterns', () => {
  it('returns an empty array for no entries', () => {
    expect(computeTriggerPatterns([])).toEqual([]);
  });

  it('returns an empty array when no entry has any trigger category', () => {
    const entries = [buildEntry({ id: 1 }), buildEntry({ id: 2 })];
    expect(computeTriggerPatterns(entries)).toEqual([]);
  });

  it('computes count and average pain level for a single matching entry', () => {
    const entries = [buildEntry({ id: 1, painLevel: 6, triggerCategories: ['stress'] })];
    expect(computeTriggerPatterns(entries)).toEqual([
      { category: 'stress', entryCount: 1, averagePainLevel: 6 },
    ]);
  });

  it('averages pain level across multiple entries with the same trigger, rounded to 1 decimal', () => {
    const entries = [
      buildEntry({ id: 1, painLevel: 5, triggerCategories: ['ernaehrung'] }),
      buildEntry({ id: 2, painLevel: 8, triggerCategories: ['ernaehrung'] }),
      buildEntry({ id: 3, painLevel: 4, triggerCategories: ['ernaehrung'] }),
    ];
    // (5 + 8 + 4) / 3 = 5.666... -> 5.7
    expect(computeTriggerPatterns(entries)).toEqual([
      { category: 'ernaehrung', entryCount: 3, averagePainLevel: 5.7 },
    ]);
  });

  it('counts an entry with multiple trigger categories toward each of its categories', () => {
    const entries = [buildEntry({ id: 1, painLevel: 7, triggerCategories: ['stress', 'schlaf'] })];
    const result = computeTriggerPatterns(entries);
    expect(result).toEqual([
      { category: 'stress', entryCount: 1, averagePainLevel: 7 },
      { category: 'schlaf', entryCount: 1, averagePainLevel: 7 },
    ]);
  });

  it('returns results in canonical TRIGGER_CATEGORY_OPTIONS order regardless of insertion order', () => {
    const entries = [
      buildEntry({ id: 1, triggerCategories: ['sonstiges'] }),
      buildEntry({ id: 2, triggerCategories: ['ernaehrung'] }),
      buildEntry({ id: 3, triggerCategories: ['medikament'] }),
    ];
    const categories = computeTriggerPatterns(entries).map((stat) => stat.category);
    expect(categories).toEqual(['ernaehrung', 'medikament', 'sonstiges']);
  });

  it('excludes categories with no matching entries', () => {
    const entries = [buildEntry({ id: 1, triggerCategories: ['stress'] })];
    const categories = computeTriggerPatterns(entries).map((stat) => stat.category);
    expect(categories).toEqual(['stress']);
  });
});
