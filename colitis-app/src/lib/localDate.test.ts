import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { formatLocalDateKey, parseLocalDate, addDays, eachDayInclusive } from './localDate';

describe('localDate', () => {
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

  describe('formatLocalDateKey', () => {
    it('pads month and day to two digits', () => {
      expect(formatLocalDateKey(new Date(2026, 7, 5))).toBe('2026-08-05');
    });

    it('keeps the local day for a time just after midnight', () => {
      expect(formatLocalDateKey(new Date(2026, 7, 5, 0, 30))).toBe('2026-08-05');
    });
  });

  describe('parseLocalDate', () => {
    it('reads the string as a local calendar day', () => {
      const parsed = parseLocalDate('2026-08-05');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(7);
      expect(parsed.getDate()).toBe(5);
      expect(parsed.getHours()).toBe(0);
    });

    it('round-trips with formatLocalDateKey', () => {
      expect(formatLocalDateKey(parseLocalDate('2026-02-29'))).toBe('2026-03-01');
    });
  });

  describe('addDays', () => {
    it('crosses a month boundary', () => {
      expect(formatLocalDateKey(addDays(parseLocalDate('2026-08-31'), 1))).toBe('2026-09-01');
    });

    it('walks backwards across a year boundary', () => {
      expect(formatLocalDateKey(addDays(parseLocalDate('2027-01-01'), -1))).toBe('2026-12-31');
    });

    it('survives the spring daylight-saving change', () => {
      // In Europe/Berlin faellt die Nacht auf den 29.03.2026 um eine Stunde
      // kuerzer aus. Ueber Kalenderfelder gerechnet stoert das nicht.
      expect(formatLocalDateKey(addDays(parseLocalDate('2026-03-28'), 1))).toBe('2026-03-29');
      expect(formatLocalDateKey(addDays(parseLocalDate('2026-03-29'), 1))).toBe('2026-03-30');
    });
  });

  describe('eachDayInclusive', () => {
    it('includes both ends', () => {
      expect(eachDayInclusive('2026-08-03', '2026-08-06')).toEqual([
        '2026-08-03',
        '2026-08-04',
        '2026-08-05',
        '2026-08-06',
      ]);
    });

    it('returns the single day when both ends match', () => {
      expect(eachDayInclusive('2026-08-03', '2026-08-03')).toEqual(['2026-08-03']);
    });

    it('returns nothing when the range is inverted', () => {
      expect(eachDayInclusive('2026-08-06', '2026-08-03')).toEqual([]);
    });
  });
});
