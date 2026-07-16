import { describe, it, expect } from 'vitest';
import { SYMPTOM_OPTIONS, STOOL_CONSISTENCY_OPTIONS, TRIGGER_CATEGORY_OPTIONS, labelFor } from './constants';

describe('diary constants', () => {
  it('has no duplicate symptom keys', () => {
    const keys = SYMPTOM_OPTIONS.map((option) => option.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has no duplicate stool consistency keys', () => {
    const keys = STOOL_CONSISTENCY_OPTIONS.map((option) => option.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('trigger category keys match the diary_entries schema enum exactly', () => {
    const keys = TRIGGER_CATEGORY_OPTIONS.map((option) => option.key).sort();
    expect(keys).toEqual(['ernaehrung', 'medikament', 'schlaf', 'sonstiges', 'stress'].sort());
  });

  it('every option has a non-empty German label', () => {
    const allOptions = [...SYMPTOM_OPTIONS, ...STOOL_CONSISTENCY_OPTIONS, ...TRIGGER_CATEGORY_OPTIONS];
    for (const option of allOptions) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });

  describe('labelFor', () => {
    it('returns the German label for a known key', () => {
      expect(labelFor(SYMPTOM_OPTIONS, 'bauchschmerzen')).toBe('Bauchschmerzen');
    });

    it('returns the raw key when no matching option exists', () => {
      expect(labelFor(SYMPTOM_OPTIONS, 'unbekannt')).toBe('unbekannt');
    });
  });
});
