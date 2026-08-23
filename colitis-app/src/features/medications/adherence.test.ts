import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  expectedDosesPerDay,
  isMedicationDueOn,
  localDateOf,
  intakesOnDate,
  countByMedication,
  buildDaySummaries,
  formatDaySummaryLabel,
  formatDayHeading,
  formatIntakeTime,
  formatTakenButtonLabel,
  periodStartDate,
  queryLowerBoundIso,
  medicationNameById,
} from './adherence';
import type { Medication, MedicationIntake } from './types';

function medication(overrides: Partial<Medication> & { id: number; name: string }): Medication {
  return {
    dose: '500mg',
    schedule: 'nach Bedarf',
    startDate: '2026-08-01',
    endDate: null,
    sideEffectsNote: null,
    reminderTimes: [],
    ...overrides,
  };
}

function reminderTimesFor(times: string[]) {
  return times.map((time, index) => ({ id: index + 1, time, notificationId: null }));
}

/** Ein Zeitstempel, der einer bestimmten lokalen Uhrzeit entspricht. */
function localIso(year: number, month: number, day: number, hour: number, minute: number): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function intake(id: number, medicationId: number, takenAt: string): MedicationIntake {
  return { id, medicationId, takenAt };
}

describe('adherence', () => {
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

  describe('expectedDosesPerDay', () => {
    it('expects one dose when no reminder time is stored', () => {
      expect(expectedDosesPerDay(medication({ id: 1, name: 'Azathioprin' }))).toBe(1);
    });

    it('expects one dose per reminder time', () => {
      const withThree = medication({
        id: 1,
        name: 'Mesalazin',
        reminderTimes: reminderTimesFor(['08:00', '13:00', '19:00']),
      });
      expect(expectedDosesPerDay(withThree)).toBe(3);
    });
  });

  describe('isMedicationDueOn', () => {
    const running = medication({ id: 1, name: 'Mesalazin', startDate: '2026-08-05', endDate: '2026-08-08' });

    it('is not due before the start date', () => {
      expect(isMedicationDueOn(running, '2026-08-04')).toBe(false);
    });

    it('is due on the start date', () => {
      expect(isMedicationDueOn(running, '2026-08-05')).toBe(true);
    });

    it('is due on the end date', () => {
      expect(isMedicationDueOn(running, '2026-08-08')).toBe(true);
    });

    it('is not due after the end date', () => {
      expect(isMedicationDueOn(running, '2026-08-09')).toBe(false);
    });

    it('stays due without an end date', () => {
      const open = medication({ id: 2, name: 'Azathioprin', startDate: '2026-08-05' });
      expect(isMedicationDueOn(open, '2027-01-01')).toBe(true);
    });
  });

  describe('localDateOf', () => {
    it('keeps the local calendar day for a time just after midnight', () => {
      // In UTC+2 liegt dieser Zeitstempel noch auf dem Vortag.
      expect(localDateOf(localIso(2026, 8, 21, 0, 30))).toBe('2026-08-21');
    });

    it('keeps the local calendar day for a time just before midnight', () => {
      expect(localDateOf(localIso(2026, 8, 21, 23, 45))).toBe('2026-08-21');
    });
  });

  describe('intakesOnDate and countByMedication', () => {
    const intakes = [
      intake(1, 10, localIso(2026, 8, 20, 8, 0)),
      intake(2, 10, localIso(2026, 8, 20, 13, 0)),
      intake(3, 11, localIso(2026, 8, 20, 19, 0)),
      intake(4, 10, localIso(2026, 8, 19, 8, 0)),
    ];

    it('keeps only the intakes of the given local day', () => {
      expect(intakesOnDate(intakes, '2026-08-20').map((entry) => entry.id)).toEqual([1, 2, 3]);
    });

    it('counts the intakes per medication', () => {
      const counts = countByMedication(intakesOnDate(intakes, '2026-08-20'));
      expect(counts.get(10)).toBe(2);
      expect(counts.get(11)).toBe(1);
    });

    it('leaves a medication without intakes out of the counts', () => {
      const counts = countByMedication(intakesOnDate(intakes, '2026-08-18'));
      expect(counts.size).toBe(0);
    });
  });

  describe('buildDaySummaries', () => {
    const mesalazin = medication({
      id: 10,
      name: 'Mesalazin',
      startDate: '2026-08-18',
      reminderTimes: reminderTimesFor(['08:00', '13:00', '19:00']),
    });
    const prednisolon = medication({
      id: 11,
      name: 'Prednisolon',
      startDate: '2026-08-18',
      endDate: '2026-08-19',
    });

    it('returns the days newest first', () => {
      const summaries = buildDaySummaries([mesalazin], [], '2026-08-18', '2026-08-20');
      expect(summaries.map((summary) => summary.date)).toEqual(['2026-08-20', '2026-08-19', '2026-08-18']);
    });

    it('skips days on which nothing was due', () => {
      const summaries = buildDaySummaries([mesalazin], [], '2026-08-16', '2026-08-18');
      expect(summaries.map((summary) => summary.date)).toEqual(['2026-08-18']);
    });

    it('marks a day complete only when every due medication reached its count', () => {
      const intakes = [
        intake(1, 10, localIso(2026, 8, 18, 8, 0)),
        intake(2, 10, localIso(2026, 8, 18, 13, 0)),
        intake(3, 10, localIso(2026, 8, 18, 19, 0)),
      ];
      const summaries = buildDaySummaries([mesalazin], intakes, '2026-08-18', '2026-08-19');
      expect(summaries[0].date).toBe('2026-08-19');
      expect(summaries[0].isComplete).toBe(false);
      expect(summaries[1].date).toBe('2026-08-18');
      expect(summaries[1].isComplete).toBe(true);
    });

    it('counts an ended medication only within its runtime', () => {
      const summaries = buildDaySummaries([mesalazin, prednisolon], [], '2026-08-18', '2026-08-20');
      const byDate = new Map(summaries.map((summary) => [summary.date, summary]));
      expect(byDate.get('2026-08-19')?.medications.map((status) => status.name)).toEqual([
        'Mesalazin',
        'Prednisolon',
      ]);
      expect(byDate.get('2026-08-20')?.medications.map((status) => status.name)).toEqual(['Mesalazin']);
    });

    it('carries the intakes of each day', () => {
      const intakes = [intake(7, 10, localIso(2026, 8, 19, 8, 0))];
      const summaries = buildDaySummaries([mesalazin], intakes, '2026-08-18', '2026-08-19');
      expect(summaries[0].intakes.map((entry) => entry.id)).toEqual([7]);
      expect(summaries[1].intakes).toEqual([]);
    });

    it('returns nothing when the range is inverted', () => {
      expect(buildDaySummaries([mesalazin], [], '2026-08-20', '2026-08-18')).toEqual([]);
    });
  });

  describe('formatDaySummaryLabel', () => {
    it('confirms a complete day', () => {
      const summary = {
        date: '2026-08-20',
        medications: [{ medicationId: 10, name: 'Mesalazin', expected: 3, taken: 3 }],
        intakes: [],
        isComplete: true,
      };
      expect(formatDaySummaryLabel(summary)).toBe('alles genommen');
    });

    it('names only what is missing', () => {
      const summary = {
        date: '2026-08-20',
        medications: [
          { medicationId: 10, name: 'Mesalazin', expected: 3, taken: 2 },
          { medicationId: 11, name: 'Azathioprin', expected: 1, taken: 1 },
          { medicationId: 12, name: 'Prednisolon', expected: 1, taken: 0 },
        ],
        intakes: [],
        isComplete: false,
      };
      expect(formatDaySummaryLabel(summary)).toBe('Mesalazin: 2 von 3 · Prednisolon: 0 von 1');
    });
  });

  describe('formatDayHeading', () => {
    it('names the weekday and the padded date', () => {
      expect(formatDayHeading('2026-08-05')).toBe('Mi 05.08.');
    });
  });

  describe('formatIntakeTime', () => {
    it('pads hours and minutes to two digits', () => {
      expect(formatIntakeTime(localIso(2026, 8, 20, 8, 5))).toBe('08:05');
    });
  });

  describe('formatTakenButtonLabel', () => {
    it('stays plain for a single dose', () => {
      expect(formatTakenButtonLabel(0, 1)).toBe('Heute genommen');
    });

    it('counts up for several doses', () => {
      expect(formatTakenButtonLabel(1, 3)).toBe('Heute genommen (1 von 3)');
    });

    it('confirms once every dose is taken', () => {
      expect(formatTakenButtonLabel(3, 3)).toBe('Heute genommen ✓');
    });
  });

  describe('periodStartDate', () => {
    const medications = [
      medication({ id: 10, name: 'Mesalazin', startDate: '2026-05-04' }),
      medication({ id: 11, name: 'Azathioprin', startDate: '2026-03-17' }),
    ];

    it('counts the last 30 days including today', () => {
      expect(periodStartDate('30', medications, '2026-08-22')).toBe('2026-07-24');
    });

    it('counts the last 90 days including today', () => {
      expect(periodStartDate('90', medications, '2026-08-22')).toBe('2026-05-25');
    });

    it('starts at the earliest start date for the whole range', () => {
      expect(periodStartDate('alles', medications, '2026-08-22')).toBe('2026-03-17');
    });

    it('falls back to today when there is no medication at all', () => {
      expect(periodStartDate('alles', [], '2026-08-22')).toBe('2026-08-22');
    });
  });

  describe('queryLowerBoundIso', () => {
    it('reaches exactly one day further back than the local start of the requested day', () => {
      const startOfDay = new Date(2026, 7, 22).getTime();
      const bound = new Date(queryLowerBoundIso('2026-08-22')).getTime();
      expect(bound).toBe(startOfDay - 24 * 60 * 60 * 1000);
    });
  });

  describe('medicationNameById', () => {
    const medications = [medication({ id: 10, name: 'Mesalazin' })];

    it('finds the name', () => {
      expect(medicationNameById(medications, 10)).toBe('Mesalazin');
    });

    it('falls back when the medication is gone', () => {
      expect(medicationNameById(medications, 99)).toBe('Unbekanntes Medikament');
    });
  });
});
