import { describe, it, expect } from 'vitest';
import {
  buildMedicationPassHtml,
  formatMedicationStartDate,
  formatPassAdherenceLabel,
  passAdherencePeriod,
  NO_ADHERENCE_TEXT,
  PASS_ADHERENCE_DAYS,
} from './medicationPassBuilder';
import type { ScheduleHistory } from './scheduleHistory';
import type { Medication } from './types';

// Ohne Abschnitte gilt die Laufzeit des Medikaments -- fuer die Zeilen, die
// nur Name, Dosis und Start pruefen, ist das die einfachste Grundlage.
const NO_HISTORY: ScheduleHistory = new Map();

function makeMedication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 1,
    name: 'Salofalk',
    dose: '500mg',
    schedule: '1x täglich',
    startDate: '2026-01-15',
    endDate: null,
    sideEffectsNote: null,
    unitsPerIntake: 1,
    packUnits: null,
    stockUnits: null,
    supplyNotificationId: null,
    reminderTimes: [],
    ...overrides,
  };
}

const TODAY = new Date(2026, 6, 22); // 22. Juli 2026, lokal (Monat 0-indiziert)

describe('formatMedicationStartDate', () => {
  it('converts JJJJ-MM-TT to TT.MM.JJJJ', () => {
    expect(formatMedicationStartDate('2026-01-15')).toBe('15.01.2026');
  });
});

describe('buildMedicationPassHtml', () => {
  it('includes the title and the creation date', () => {
    const html = buildMedicationPassHtml([], [], NO_HISTORY, TODAY);
    expect(html).toContain('Medikamenten-Pass');
    expect(html).toContain('22.07.2026');
  });

  it('renders a message when there are no active medications', () => {
    const html = buildMedicationPassHtml([], [], NO_HISTORY, TODAY);
    expect(html).toContain('Keine aktiven Medikamente vorhanden.');
  });

  it('includes name, dose, schedule, and start date for an active medication', () => {
    const html = buildMedicationPassHtml([makeMedication()], [], NO_HISTORY, TODAY);
    expect(html).toContain('Salofalk');
    expect(html).toContain('500mg');
    expect(html).toContain('1x täglich');
    expect(html).toContain('Seit 15.01.2026');
  });

  it('excludes a medication that ended before today', () => {
    const html = buildMedicationPassHtml([makeMedication({ name: 'Beendet', endDate: '2026-01-01' })], [], NO_HISTORY, TODAY);
    expect(html).not.toContain('Beendet');
    expect(html).toContain('Keine aktiven Medikamente vorhanden.');
  });

  it('includes a medication ending today or in the future', () => {
    const html = buildMedicationPassHtml([makeMedication({ name: 'Noch aktiv', endDate: '2026-07-22' })], [], NO_HISTORY, TODAY);
    expect(html).toContain('Noch aktiv');
  });

  it('excludes ended medications while including active ones in a mixed list', () => {
    const html = buildMedicationPassHtml(
      [
        makeMedication({ name: 'Aktiv', endDate: null }),
        makeMedication({ id: 2, name: 'Beendet', endDate: '2026-01-01' }),
      ],
      [],
      NO_HISTORY,
      TODAY
    );
    expect(html).toContain('Aktiv');
    expect(html).not.toContain('Beendet');
  });

  it('does not include the side effects note or reminder times', () => {
    const html = buildMedicationPassHtml(
      [
        makeMedication({
          sideEffectsNote: 'Übelkeit',
          reminderTimes: [{ id: 1, time: '08:00', notificationId: null }],
        }),
      ],
      [],
      NO_HISTORY,
      TODAY
    );
    expect(html).not.toContain('Übelkeit');
    expect(html).not.toContain('08:00');
  });

  it('escapes HTML special characters in the medication name', () => {
    const html = buildMedicationPassHtml([makeMedication({ name: '<script>alert(1)</script>' })], [], NO_HISTORY, TODAY);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('formatPassAdherenceLabel', () => {
  it('says plainly when nothing was due', () => {
    expect(formatPassAdherenceLabel(0, 0)).toBe(NO_ADHERENCE_TEXT);
  });

  it('uses the singular for a single day', () => {
    expect(formatPassAdherenceLabel(1, 1)).toBe('An 1 von 1 Tag vollständig genommen');
  });

  it('uses the plural above one', () => {
    expect(formatPassAdherenceLabel(83, 90)).toBe('An 83 von 90 Tagen vollständig genommen');
  });
});

describe('passAdherencePeriod', () => {
  it('spans ninety days including today', () => {
    const days = passAdherencePeriod(TODAY);
    expect(days).toHaveLength(PASS_ADHERENCE_DAYS);
    expect(days[days.length - 1]).toBe('2026-07-22');
    expect(days[0]).toBe('2026-04-24');
  });
});

describe('buildMedicationPassHtml with intakes', () => {
  const medication = makeMedication({
    id: 1,
    name: 'Mesalazin',
    startDate: '2026-07-20',
    reminderTimes: [{ id: 1, time: '08:00', notificationId: null }],
  });

  function intakeAt(id: number, day: number) {
    return { id, medicationId: 1, takenAt: new Date(2026, 6, day, 8, 0).toISOString() };
  }

  it('counts a day complete against the number that was due back then', () => {
    // Bis zum 20.07. waren zwei faellig, ab dem 21.07. nur noch eine.
    const history: ScheduleHistory = new Map([
      [
        1,
        [
          { id: 1, validFrom: '2026-07-20', validTo: '2026-07-20', dosesPerDay: 2 },
          { id: 2, validFrom: '2026-07-21', validTo: null, dosesPerDay: 1 },
        ],
      ],
    ]);
    const html = buildMedicationPassHtml(
      [medication],
      [intakeAt(1, 20), intakeAt(2, 21), intakeAt(3, 22)],
      history,
      TODAY
    );
    expect(html).toContain('An 2 von 3 Tagen vollständig genommen');
  });

  it('leaves a paused stretch out of the due days', () => {
    const history: ScheduleHistory = new Map([
      [
        1,
        [
          { id: 1, validFrom: '2026-07-20', validTo: '2026-07-21', dosesPerDay: 1 },
          { id: 2, validFrom: '2026-07-22', validTo: null, dosesPerDay: 0 },
        ],
      ],
    ]);
    const html = buildMedicationPassHtml([medication], [intakeAt(1, 20)], history, TODAY);
    expect(html).toContain('An 1 von 2 Tagen vollständig genommen');
  });

  it('says plainly when nothing was due yet', () => {
    const history: ScheduleHistory = new Map([
      [1, [{ id: 1, validFrom: '2026-08-01', validTo: null, dosesPerDay: 1 }]],
    ]);
    const html = buildMedicationPassHtml([medication], [], history, TODAY);
    expect(html).toContain(NO_ADHERENCE_TEXT);
  });

  it('carries the note saying where the numbers come from', () => {
    const html = buildMedicationPassHtml([medication], [], NO_HISTORY, TODAY);
    expect(html).toContain('selbst abgehakten Einnahmen');
  });
});
