import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  determinePeriod,
  formatPeriodLabel,
  computeFigures,
  findNotablePhases,
  formatRatingLabel,
  formatPhaseLabel,
  formatSparseDataLabel,
  formatTriggerListLabel,
  formatDecimal,
  computeTriggerShares,
  buildMedicationLines,
  formatMedicationIntakeLabel,
  formatMedicationDetailLabel,
  buildVisitSummary,
} from './visitSummary';
import type { DoctorVisit } from './types';
import type { DiaryEntryWithTriggers } from '../diary/types';
import type { Medication, MedicationIntake } from '../medications/types';

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

function medication(
  overrides: Partial<Medication> & { id: number; name: string }
): Medication {
  return {
    dose: '500 mg',
    schedule: '3x täglich',
    startDate: '2026-08-01',
    endDate: null,
    sideEffectsNote: null,
    reminderTimes: [],
    ...overrides,
  };
}

function intake(id: number, medicationId: number, day: number, hour = 9): MedicationIntake {
  return { id, medicationId, takenAt: localIso(2026, 8, day, hour) };
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
      expect(label).toBe('12.05.2026 – 23.08.2026 · 104 Tage · seit dem Besuch bei Dr. Weber');
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

    it('prefers the more recent phase when two are equally long', () => {
      // Drei Strecken zu je drei betroffenen Tagen. Genommen werden die beiden
      // juengeren, ausgegeben in zeitlicher Folge.
      const entries = [
        badDay(1, 2), badDay(2, 3), badDay(3, 4),
        goodDay(4, 5),
        badDay(5, 7), badDay(6, 8), badDay(7, 9),
        goodDay(8, 10),
        badDay(9, 12), badDay(10, 13), badDay(11, 14),
      ];
      const phases = findNotablePhases(entries, PERIOD_AUGUST);
      expect(phases.map((phase) => phase.fromDate)).toEqual(['2026-08-07', '2026-08-12']);
    });

    it('finds a phase that runs to the last day of the period', () => {
      const phases = findNotablePhases([badDay(1, 18), badDay(2, 19), badDay(3, 20)], PERIOD_AUGUST);
      expect(phases).toHaveLength(1);
      expect(phases[0].fromDate).toBe('2026-08-18');
      expect(phases[0].toDate).toBe('2026-08-20');
    });

    it('finds a phase that starts on the first day of the period', () => {
      const phases = findNotablePhases([badDay(1, 1), badDay(2, 2), badDay(3, 3)], PERIOD_AUGUST);
      expect(phases[0].fromDate).toBe('2026-08-01');
    });

    it('folds several entries of one day into a single rated day', () => {
      // Vier Stuehle plus vier Stuehle ergeben acht -- der Tag ist damit
      // schub-verdaechtig, obwohl kein einzelner Eintrag es waere.
      const entries = [
        entry({ id: 1, occurredAt: localIso(2026, 8, 5, 9), stoolFrequency: 4 }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 5, 18), stoolFrequency: 4 }),
        badDay(3, 6),
        badDay(4, 7),
      ];
      const phases = findNotablePhases(entries, PERIOD_AUGUST);
      expect(phases).toHaveLength(1);
      expect(phases[0].fromDate).toBe('2026-08-05');
      expect(phases[0].affectedDays).toBe(3);
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

    it('formatPhaseLabel uses the singular for a single day with blood', () => {
      const label = formatPhaseLabel({
        fromDate: '2026-07-03',
        toDate: '2026-07-05',
        spanDays: 3,
        affectedDays: 3,
        daysWithBlood: 1,
      });
      expect(label).toBe('03.07.2026 – 05.07.2026: an 3 von 3 Tagen mittel oder schub-verdächtig, an 1 Tag Blut vermerkt.');
    });

    it('formatSparseDataLabel names both numbers', () => {
      expect(formatSparseDataLabel(4, 103)).toBe(
        'An 4 von 103 Tagen wurde etwas erfasst — zu wenig für eine Auswertung des Zeitraums.'
      );
    });

    it('formatSparseDataLabel uses the singular for a single day', () => {
      expect(formatSparseDataLabel(1, 1)).toBe(
        'An 1 von 1 Tag wurde etwas erfasst — zu wenig für eine Auswertung des Zeitraums.'
      );
    });

    it('formatMedicationIntakeLabel uses the singular for one day and one intake', () => {
      const label = formatMedicationIntakeLabel({
        medicationId: 1,
        name: 'Mesalazin',
        dose: '500 mg',
        schedule: '1-0-1',
        startDate: '2026-08-23',
        endDate: null,
        hasEnded: false,
        dueDays: 1,
        daysWithIntake: 1,
        totalIntakes: 1,
      });
      expect(label).toBe('An 1 von 1 Tag erfasst, 1 Einnahme');
    });

    it('formatPeriodLabel shows a single-day period without a repeated date', () => {
      const label = formatPeriodLabel({
        fromDate: '2026-08-23',
        toDate: '2026-08-23',
        dayCount: 1,
        sinceVisitLabel: 'seit dem Besuch am 23.08.2026',
      });
      expect(label).toBe('23.08.2026 · 1 Tag · seit dem Besuch am 23.08.2026');
    });

    it('formatTriggerListLabel joins the shares with a middle dot', () => {
      expect(
        formatTriggerListLabel([
          { label: 'Stress', percent: 61 },
          { label: 'Schlaf', percent: 38 },
        ])
      ).toBe('Stress (61 %) · Schlaf (38 %)');
    });

    it('formatTriggerListLabel yields an empty string without shares', () => {
      expect(formatTriggerListLabel([])).toBe('');
    });

    it('formatDecimal writes one decimal place with a comma', () => {
      expect(formatDecimal(3.24)).toBe('3,2');
      expect(formatDecimal(4)).toBe('4,0');
    });

    it('formatMedicationDetailLabel names a planned end as planned', () => {
      const label = formatMedicationDetailLabel({
        medicationId: 1,
        name: 'Prednisolon',
        dose: '20 mg',
        schedule: 'morgens',
        startDate: '2026-08-01',
        endDate: '2026-09-30',
        hasEnded: false,
        dueDays: 20,
        daysWithIntake: 20,
        totalIntakes: 20,
      });
      expect(label).toBe('20 mg · morgens · seit 01.08.2026 · geplantes Ende 30.09.2026');
    });

    it('formatMedicationDetailLabel names a past end as ended', () => {
      const label = formatMedicationDetailLabel({
        medicationId: 1,
        name: 'Prednisolon',
        dose: '20 mg',
        schedule: 'morgens',
        startDate: '2026-08-01',
        endDate: '2026-08-10',
        hasEnded: true,
        dueDays: 10,
        daysWithIntake: 10,
        totalIntakes: 10,
      });
      expect(label).toBe('20 mg · morgens · seit 01.08.2026 · beendet am 10.08.2026');
    });

    it('formatMedicationDetailLabel omits the ending without an end date', () => {
      const label = formatMedicationDetailLabel({
        medicationId: 1,
        name: 'Mesalazin',
        dose: '500 mg',
        schedule: '3x täglich',
        startDate: '2026-08-01',
        endDate: null,
        hasEnded: false,
        dueDays: 20,
        daysWithIntake: 20,
        totalIntakes: 60,
      });
      expect(label).toBe('500 mg · 3x täglich · seit 01.08.2026');
    });
  });

  describe('computeTriggerShares', () => {
    it('states the share of entries that named the trigger', () => {
      const entries = [
        entry({ id: 1, occurredAt: localIso(2026, 8, 1), triggerCategories: ['stress'] }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 2), triggerCategories: ['stress'] }),
        entry({ id: 3, occurredAt: localIso(2026, 8, 3), triggerCategories: ['schlaf'] }),
        entry({ id: 4, occurredAt: localIso(2026, 8, 4) }),
      ];
      expect(computeTriggerShares(entries)).toEqual([
        { label: 'Stress', percent: 50 },
        { label: 'Schlaf', percent: 25 },
      ]);
    });

    it('returns at most three, highest first', () => {
      const entries = [
        entry({
          id: 1,
          occurredAt: localIso(2026, 8, 1),
          triggerCategories: ['stress', 'schlaf', 'ernaehrung', 'sonstiges'],
        }),
        entry({ id: 2, occurredAt: localIso(2026, 8, 2), triggerCategories: ['stress'] }),
      ];
      const shares = computeTriggerShares(entries);
      expect(shares).toHaveLength(3);
      expect(shares[0].label).toBe('Stress');
      expect(shares[0].percent).toBe(100);
    });

    it('returns nothing without entries', () => {
      expect(computeTriggerShares([])).toEqual([]);
    });

    it('keeps the most frequent trigger even when several round to the same percent', () => {
      // 100 Eintraege: Ernaehrung 9, Stress 9, Schlaf 9, Sonstiges 10.
      // Gerundet sind das 9, 9, 9 und 10 Prozent -- entscheidend ist die Anzahl.
      const entries = [
        ...Array.from({ length: 9 }, (_, index) =>
          entry({ id: 100 + index, occurredAt: localIso(2026, 8, 1), triggerCategories: ['ernaehrung'] })
        ),
        ...Array.from({ length: 9 }, (_, index) =>
          entry({ id: 200 + index, occurredAt: localIso(2026, 8, 2), triggerCategories: ['stress'] })
        ),
        ...Array.from({ length: 9 }, (_, index) =>
          entry({ id: 300 + index, occurredAt: localIso(2026, 8, 3), triggerCategories: ['schlaf'] })
        ),
        ...Array.from({ length: 10 }, (_, index) =>
          entry({ id: 400 + index, occurredAt: localIso(2026, 8, 4), triggerCategories: ['sonstiges'] })
        ),
      ];
      expect(computeTriggerShares(entries)[0].label).toBe('Sonstiges');
    });

    it('drops a trigger that rounds down to zero percent', () => {
      const entries = [
        entry({ id: 1, occurredAt: localIso(2026, 8, 1), triggerCategories: ['sonstiges'] }),
        ...Array.from({ length: 300 }, (_, index) =>
          entry({ id: 100 + index, occurredAt: localIso(2026, 8, 2), triggerCategories: ['stress'] })
        ),
      ];
      const shares = computeTriggerShares(entries);
      expect(shares.map((share) => share.label)).toEqual(['Stress']);
    });
  });

  describe('buildMedicationLines', () => {
    it('skips a medication that did not run in the period', () => {
      const older = medication({ id: 1, name: 'Prednisolon', startDate: '2026-01-01', endDate: '2026-02-01' });
      expect(buildMedicationLines([older], [], PERIOD_AUGUST)).toEqual([]);
    });

    it('uses the days it actually ran as the denominator', () => {
      // Laeuft vom 1. bis zum 10., der Zeitraum geht bis zum 20.
      const ended = medication({ id: 1, name: 'Prednisolon', startDate: '2026-08-01', endDate: '2026-08-10' });
      const lines = buildMedicationLines([ended], [], PERIOD_AUGUST);
      expect(lines[0].dueDays).toBe(10);
    });

    it('counts a day with intake once, however many intakes it has', () => {
      const running = medication({ id: 1, name: 'Mesalazin' });
      const intakes = [intake(1, 1, 3, 8), intake(2, 1, 3, 13), intake(3, 1, 3, 19)];
      const lines = buildMedicationLines([running], intakes, PERIOD_AUGUST);
      expect(lines[0].daysWithIntake).toBe(1);
      expect(lines[0].totalIntakes).toBe(3);
    });

    it('ignores intakes of another medication', () => {
      const running = medication({ id: 1, name: 'Mesalazin' });
      const lines = buildMedicationLines([running], [intake(1, 2, 3)], PERIOD_AUGUST);
      expect(lines[0].totalIntakes).toBe(0);
    });

    it('ignores intakes outside the period', () => {
      const running = medication({ id: 1, name: 'Mesalazin' });
      const outside: MedicationIntake = {
        id: 9,
        medicationId: 1,
        takenAt: new Date(2026, 6, 15, 9).toISOString(),
      };
      expect(buildMedicationLines([running], [outside], PERIOD_AUGUST)[0].totalIntakes).toBe(0);
    });

    it('carries dose, schedule and end date', () => {
      const ended = medication({
        id: 1,
        name: 'Prednisolon',
        dose: '20 mg',
        schedule: 'morgens',
        endDate: '2026-08-10',
      });
      const line = buildMedicationLines([ended], [], PERIOD_AUGUST)[0];
      expect(line.name).toBe('Prednisolon');
      expect(line.dose).toBe('20 mg');
      expect(line.schedule).toBe('morgens');
      expect(line.endDate).toBe('2026-08-10');
    });

    it('carries the medication id so that two medications of the same name stay apart', () => {
      const first = medication({ id: 1, name: 'Prednisolon', startDate: '2026-08-01', endDate: '2026-08-05' });
      const second = medication({ id: 2, name: 'Prednisolon', startDate: '2026-08-10' });
      const lines = buildMedicationLines([first, second], [], PERIOD_AUGUST);
      expect(lines.map((line) => line.medicationId)).toEqual([1, 2]);
    });

    it('treats an end date in the future as still running', () => {
      const planned = medication({ id: 1, name: 'Prednisolon', startDate: '2026-08-01', endDate: '2026-09-30' });
      expect(buildMedicationLines([planned], [], PERIOD_AUGUST)[0].hasEnded).toBe(false);
    });

    it('treats an end date on the last day of the period as still running', () => {
      const ending = medication({ id: 1, name: 'Prednisolon', startDate: '2026-08-01', endDate: '2026-08-20' });
      expect(buildMedicationLines([ending], [], PERIOD_AUGUST)[0].hasEnded).toBe(false);
    });

    it('treats an end date before the end of the period as ended', () => {
      const ended = medication({ id: 1, name: 'Prednisolon', startDate: '2026-08-01', endDate: '2026-08-10' });
      expect(buildMedicationLines([ended], [], PERIOD_AUGUST)[0].hasEnded).toBe(true);
    });

    it('ignores an intake on a day the medication was not running', () => {
      // Beendet am 10., aber am 12. noch protokolliert.
      const ended = medication({ id: 1, name: 'Prednisolon', startDate: '2026-08-01', endDate: '2026-08-10' });
      const line = buildMedicationLines([ended], [intake(1, 1, 12)], PERIOD_AUGUST)[0];
      expect(line.daysWithIntake).toBe(0);
      expect(line.totalIntakes).toBe(0);
    });
  });

  describe('formatMedicationIntakeLabel', () => {
    it('names days with intake and the total', () => {
      const label = formatMedicationIntakeLabel({
        medicationId: 1,
        name: 'Mesalazin',
        dose: '500 mg',
        schedule: '3x täglich',
        startDate: '2026-05-04',
        endDate: null,
        hasEnded: false,
        dueDays: 103,
        daysWithIntake: 96,
        totalIntakes: 268,
      });
      expect(label).toBe('An 96 von 103 Tagen erfasst, 268 Einnahmen');
    });
  });

  describe('buildVisitSummary', () => {
    const sevenGoodDays = [1, 2, 3, 4, 5, 6, 7].map((day) =>
      entry({ id: day, occurredAt: localIso(2026, 8, day), triggerCategories: ['stress'] })
    );

    it('assembles period, figures, triggers and medications', () => {
      const summary = buildVisitSummary({
        entries: sevenGoodDays,
        medications: [medication({ id: 1, name: 'Mesalazin' })],
        intakes: [intake(1, 1, 3)],
        visits: [visit({ id: 1, visitDate: '2026-08-01', doctorName: 'Dr. Weber' })],
        screening: null,
        today: '2026-08-20',
      });

      expect(summary.period.fromDate).toBe('2026-08-01');
      expect(summary.daysWithEntries).toBe(7);
      expect(summary.figures).not.toBeNull();
      expect(summary.triggers[0].label).toBe('Stress');
      expect(summary.medications).toHaveLength(1);
      expect(summary.isEmpty).toBe(false);
    });

    it('drops figures, phases and triggers when the period is too sparse', () => {
      const summary = buildVisitSummary({
        entries: sevenGoodDays.slice(0, 3),
        medications: [],
        intakes: [],
        visits: [visit({ id: 1, visitDate: '2026-08-01' })],
        screening: null,
        today: '2026-08-20',
      });

      expect(summary.figures).toBeNull();
      expect(summary.phases).toEqual([]);
      expect(summary.triggers).toEqual([]);
      expect(summary.daysWithEntries).toBe(3);
    });

    it('is empty without entries and without medications', () => {
      const summary = buildVisitSummary({
        entries: [],
        medications: [],
        intakes: [],
        visits: [visit({ id: 1, visitDate: '2026-08-01' })],
        screening: null,
        today: '2026-08-20',
      });
      expect(summary.isEmpty).toBe(true);
    });

    it('is not empty when only a medication is present', () => {
      const summary = buildVisitSummary({
        entries: [],
        medications: [medication({ id: 1, name: 'Mesalazin' })],
        intakes: [],
        visits: [visit({ id: 1, visitDate: '2026-08-01' })],
        screening: null,
        today: '2026-08-20',
      });
      expect(summary.isEmpty).toBe(false);
    });

    it('carries the next screening date', () => {
      const summary = buildVisitSummary({
        entries: [],
        medications: [],
        intakes: [],
        visits: [],
        screening: { id: 1, intervalMonths: 12, nextDueDate: '2027-01-15', note: null, notificationId: null },
        today: '2026-08-20',
      });
      expect(summary.nextScreeningDate).toBe('2027-01-15');
    });
  });
});
