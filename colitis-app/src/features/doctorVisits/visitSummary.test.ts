import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { determinePeriod, formatPeriodLabel } from './visitSummary';
import type { DoctorVisit } from './types';

function visit(overrides: Partial<DoctorVisit> & { id: number; visitDate: string }): DoctorVisit {
  return {
    doctorName: null,
    reason: null,
    note: null,
    nextAppointmentDate: null,
    ...overrides,
  };
}

describe('visitSummary', () => {
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

  describe('determinePeriod', () => {
    it('starts at the most recent past visit', () => {
      const visits = [
        visit({ id: 1, visitDate: '2026-05-12', doctorName: 'Dr. Weber' }),
        visit({ id: 2, visitDate: '2026-02-03', doctorName: 'Dr. Klein' }),
      ];
      const period = determinePeriod(visits, '2026-08-23');
      expect(period.fromDate).toBe('2026-05-12');
      expect(period.toDate).toBe('2026-08-23');
    });

    it('does not care about the order the visits arrive in', () => {
      const visits = [
        visit({ id: 2, visitDate: '2026-02-03' }),
        visit({ id: 1, visitDate: '2026-05-12' }),
      ];
      expect(determinePeriod(visits, '2026-08-23').fromDate).toBe('2026-05-12');
    });

    it('ignores a visit dated in the future', () => {
      const visits = [
        visit({ id: 3, visitDate: '2026-11-04' }),
        visit({ id: 1, visitDate: '2026-05-12' }),
      ];
      expect(determinePeriod(visits, '2026-08-23').fromDate).toBe('2026-05-12');
    });

    it('takes a visit that happened today', () => {
      const visits = [visit({ id: 1, visitDate: '2026-08-23' })];
      expect(determinePeriod(visits, '2026-08-23').fromDate).toBe('2026-08-23');
    });

    it('falls back to the last 90 days without any visit', () => {
      const period = determinePeriod([], '2026-08-23');
      expect(period.fromDate).toBe('2026-05-26');
      expect(period.toDate).toBe('2026-08-23');
      expect(period.dayCount).toBe(90);
      expect(period.sinceVisitLabel).toBeNull();
    });

    it('falls back to the last 90 days when the only visit is in the future', () => {
      const visits = [visit({ id: 3, visitDate: '2026-11-04' })];
      expect(determinePeriod(visits, '2026-08-23').sinceVisitLabel).toBeNull();
    });

    it('counts the days including both ends', () => {
      const visits = [visit({ id: 1, visitDate: '2026-08-21' })];
      expect(determinePeriod(visits, '2026-08-23').dayCount).toBe(3);
    });

    it('names the doctor in the label', () => {
      const visits = [visit({ id: 1, visitDate: '2026-05-12', doctorName: 'Dr. Weber' })];
      expect(determinePeriod(visits, '2026-08-23').sinceVisitLabel).toBe(
        'seit dem Besuch bei Dr. Weber'
      );
    });

    it('falls back to the date when no doctor name is stored', () => {
      const visits = [visit({ id: 1, visitDate: '2026-05-12' })];
      expect(determinePeriod(visits, '2026-08-23').sinceVisitLabel).toBe(
        'seit dem Besuch am 12.05.2026'
      );
    });

    it('treats a blank doctor name like none at all', () => {
      const visits = [visit({ id: 1, visitDate: '2026-05-12', doctorName: '   ' })];
      expect(determinePeriod(visits, '2026-08-23').sinceVisitLabel).toBe(
        'seit dem Besuch am 12.05.2026'
      );
    });
  });

  describe('formatPeriodLabel', () => {
    it('names the range and the visit it follows', () => {
      const label = formatPeriodLabel({
        fromDate: '2026-05-12',
        toDate: '2026-08-23',
        dayCount: 104,
        sinceVisitLabel: 'seit dem Besuch bei Dr. Weber',
      });
      expect(label).toBe('12.05.2026 – 23.08.2026 · 104 Tage seit dem Besuch bei Dr. Weber');
    });

    it('names the fallback range without a visit', () => {
      const label = formatPeriodLabel({
        fromDate: '2026-05-26',
        toDate: '2026-08-23',
        dayCount: 90,
        sinceVisitLabel: null,
      });
      expect(label).toBe('26.05.2026 – 23.08.2026 · letzte 90 Tage');
    });
  });
});
