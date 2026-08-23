import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  determinePeriod,
  formatPeriodLabel,
  computeFigures,
  findNotablePhases,
  formatRatingLabel,
  formatPhaseLabel,
  formatSparseDataLabel,
} from './visitSummary';
import type { DoctorVisit } from './types';
import type { DiaryEntryWithTriggers } from '../diary/types';

function visit(overrides: Partial<DoctorVisit> & { id: number; visitDate: string }): DoctorVisit {
  return {
    doctorName: null,
    reason: null,
    note: null,
    nextAppointmentDate: null,
    ...overrides,
  };
}

function entry(
  overrides: Partial<DiaryEntryWithTriggers> & { id: number; occurredAt: string }
): DiaryEntryWithTriggers {
  return {
    stoolFrequency: 1,
    hasBlood: false,
    stoolConsistency: 'weich',
    painLevel: 0,
    symptoms: [],
    note: null,
    triggerCategories: [],
    foodTriggerNote: null,
    ...overrides,
  };
}

/** Ein Zeitstempel, der einer bestimmten lokalen Uhrzeit entspricht. */
function localIso(year: number, month: number, day: number, hour = 9): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

const PERIOD_AUGUST = {
  fromDate: '2026-08-01',
  toDate: '2026-08-20',
  dayCount: 20,
  sinceVisitLabel: null,
};

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

  describe('computeFigures', () => {
    it('returns null below seven days with entries', () => {
      const entries = [1, 2, 3, 4, 5, 6].map((day) =>
        entry({ id: day, occurredAt: localIso(2026, 8, day) })
      );
      expect(computeFigures(entries, PERIOD_AUGUST)).toBeNull();
    });

    it('computes at exactly seven days with entries', () => {
      const entries = [1, 2, 3, 4, 5, 6, 7].map((day) =>
        entry({ id: day, occurredAt: localIso(2026, 8, day) })
      );
      expect(computeFigures(entries, PERIOD_AUGUST)).not.toBeNull();
    });

    it('averages over days with entries, not over calendar days', () => {
      // Sieben Tage, je vier Stuehle -- der Schnitt ist 4, nicht 28/20.
      const entries = [1, 2, 3, 4, 5, 6, 7].map((day) =>
        entry({ id: day, occurredAt: localIso(2026, 8, day), stoolFrequency: 4 })
      );
      expect(computeFigures(entries, PERIOD_AUGUST)?.stoolsPerDay).toBe(4);
    });

    it('sums several entries of the same day into one day', () => {
      const entries = [
        entry({ id: 1, occurredAt: localIso(2026, 8, 1, 9), stoolFrequency: 2 }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 1, 18), stoolFrequency: 3 }),
        ...[2, 3, 4, 5, 6, 7].map((day) =>
          entry({ id: day + 10, occurredAt: localIso(2026, 8, day), stoolFrequency: 5 })
        ),
      ];
      const figures = computeFigures(entries, PERIOD_AUGUST);
      // Sieben Tage, alle mit fuenf Stuehlen.
      expect(figures?.stoolsPerDay).toBe(5);
    });

    it('counts a day with blood once, however many entries it has', () => {
      const entries = [
        entry({ id: 1, occurredAt: localIso(2026, 8, 1, 9), hasBlood: true }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 1, 18), hasBlood: true }),
        ...[2, 3, 4, 5, 6, 7].map((day) => entry({ id: day + 10, occurredAt: localIso(2026, 8, day) })),
      ];
      expect(computeFigures(entries, PERIOD_AUGUST)?.daysWithBlood).toBe(1);
    });

    it('takes the worst pain level of each day', () => {
      const entries = [
        entry({ id: 1, occurredAt: localIso(2026, 8, 1, 9), painLevel: 2 }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 1, 18), painLevel: 8 }),
        ...[2, 3, 4, 5, 6, 7].map((day) =>
          entry({ id: day + 10, occurredAt: localIso(2026, 8, day), painLevel: 0 })
        ),
      ];
      // 8 an einem Tag, 0 an sechs -- Schnitt 8/7 = 1,1.
      expect(computeFigures(entries, PERIOD_AUGUST)?.averagePainLevel).toBe(1.1);
    });

    it('counts the day ratings', () => {
      const entries = [
        ...[1, 2, 3, 4, 5].map((day) => entry({ id: day, occurredAt: localIso(2026, 8, day) })),
        entry({ id: 6, occurredAt: localIso(2026, 8, 6), painLevel: 5 }),
        entry({ id: 7, occurredAt: localIso(2026, 8, 7), hasBlood: true }),
      ];
      const figures = computeFigures(entries, PERIOD_AUGUST);
      expect(figures?.goodDays).toBe(5);
      expect(figures?.mediumDays).toBe(1);
      expect(figures?.badDays).toBe(1);
    });

    it('ignores entries outside the period', () => {
      const entries = [
        ...[1, 2, 3, 4, 5, 6, 7].map((day) => entry({ id: day, occurredAt: localIso(2026, 8, day) })),
        entry({ id: 99, occurredAt: localIso(2026, 7, 15), stoolFrequency: 40 }),
      ];
      expect(computeFigures(entries, PERIOD_AUGUST)?.stoolsPerDay).toBe(1);
    });
  });

  describe('findNotablePhases', () => {
    function badDay(id: number, day: number, withBlood = false): DiaryEntryWithTriggers {
      return entry({ id, occurredAt: localIso(2026, 8, day), painLevel: 8, hasBlood: withBlood });
    }

    function goodDay(id: number, day: number): DiaryEntryWithTriggers {
      return entry({ id, occurredAt: localIso(2026, 8, day) });
    }

    it('finds a run of three affected days', () => {
      const phases = findNotablePhases([badDay(1, 5), badDay(2, 6), badDay(3, 7)], PERIOD_AUGUST);
      expect(phases).toHaveLength(1);
      expect(phases[0].fromDate).toBe('2026-08-05');
      expect(phases[0].toDate).toBe('2026-08-07');
      expect(phases[0].affectedDays).toBe(3);
      expect(phases[0].spanDays).toBe(3);
    });

    it('ignores a run of two', () => {
      expect(findNotablePhases([badDay(1, 5), badDay(2, 6)], PERIOD_AUGUST)).toEqual([]);
    });

    it('lets a good day break the run', () => {
      const entries = [badDay(1, 5), badDay(2, 6), goodDay(3, 7), badDay(4, 8)];
      expect(findNotablePhases(entries, PERIOD_AUGUST)).toEqual([]);
    });

    it('does not let an unrecorded day break the run', () => {
      // Am 6. wurde nichts erfasst.
      const phases = findNotablePhases([badDay(1, 5), badDay(2, 7), badDay(3, 8)], PERIOD_AUGUST);
      expect(phases).toHaveLength(1);
      expect(phases[0].affectedDays).toBe(3);
      expect(phases[0].spanDays).toBe(4);
    });

    it('starts and ends on an affected day', () => {
      // Am 4. und am 9. wurde nichts erfasst -- sie gehoeren nicht zur Strecke.
      const phases = findNotablePhases([badDay(1, 5), badDay(2, 6), badDay(3, 8)], PERIOD_AUGUST);
      expect(phases[0].fromDate).toBe('2026-08-05');
      expect(phases[0].toDate).toBe('2026-08-08');
    });

    it('counts the days with blood inside the phase', () => {
      const phases = findNotablePhases(
        [badDay(1, 5, true), badDay(2, 6), badDay(3, 7, true)],
        PERIOD_AUGUST
      );
      expect(phases[0].daysWithBlood).toBe(2);
    });

    it('returns at most two, the ones with the most affected days', () => {
      const entries = [
        badDay(1, 2), badDay(2, 3), badDay(3, 4),
        goodDay(4, 5),
        badDay(5, 7), badDay(6, 8), badDay(7, 9), badDay(8, 10), badDay(9, 11),
        goodDay(10, 12),
        badDay(11, 14), badDay(12, 15), badDay(13, 16), badDay(14, 17),
      ];
      const phases = findNotablePhases(entries, PERIOD_AUGUST);
      expect(phases).toHaveLength(2);
      expect(phases.map((phase) => phase.affectedDays)).toEqual([5, 4]);
    });

    it('returns the chosen phases oldest first', () => {
      const entries = [
        badDay(1, 2), badDay(2, 3), badDay(3, 4), badDay(4, 5),
        goodDay(5, 6),
        badDay(6, 8), badDay(7, 9), badDay(8, 10), badDay(9, 11), badDay(10, 12),
      ];
      const phases = findNotablePhases(entries, PERIOD_AUGUST);
      expect(phases[0].fromDate).toBe('2026-08-02');
      expect(phases[1].fromDate).toBe('2026-08-08');
    });

    it('returns nothing when no run is long enough', () => {
      expect(findNotablePhases([goodDay(1, 5), goodDay(2, 6)], PERIOD_AUGUST)).toEqual([]);
    });
  });

  describe('labels', () => {
    it('formatRatingLabel names all three counts', () => {
      const label = formatRatingLabel({
        stoolsPerDay: 3.2,
        daysWithBlood: 12,
        averagePainLevel: 2.4,
        goodDays: 71,
        mediumDays: 18,
        badDays: 7,
      });
      expect(label).toBe('71 gut · 18 mittel · 7 schub-verdächtig');
    });

    it('formatPhaseLabel names range, counts and blood', () => {
      const label = formatPhaseLabel({
        fromDate: '2026-07-03',
        toDate: '2026-07-14',
        spanDays: 12,
        affectedDays: 8,
        daysWithBlood: 6,
      });
      expect(label).toBe(
        '03.07.2026 – 14.07.2026: an 8 von 12 Tagen mittel oder schub-verdächtig, an 6 Tagen Blut vermerkt.'
      );
    });

    it('formatPhaseLabel omits the blood clause at zero', () => {
      const label = formatPhaseLabel({
        fromDate: '2026-07-03',
        toDate: '2026-07-05',
        spanDays: 3,
        affectedDays: 3,
        daysWithBlood: 0,
      });
      expect(label).toBe('03.07.2026 – 05.07.2026: an 3 von 3 Tagen mittel oder schub-verdächtig.');
    });

    it('formatSparseDataLabel names both numbers', () => {
      expect(formatSparseDataLabel(4, 103)).toBe(
        'An 4 von 103 Tagen wurde etwas erfasst — zu wenig für eine Auswertung des Zeitraums.'
      );
    });
  });
});
