import { describe, it, expect } from 'vitest';
import { buildMedicationPassHtml, formatMedicationStartDate } from './medicationPassBuilder';
import type { Medication } from './types';

function makeMedication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 1,
    name: 'Salofalk',
    dose: '500mg',
    schedule: '1x täglich',
    startDate: '2026-01-15',
    endDate: null,
    sideEffectsNote: null,
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
    const html = buildMedicationPassHtml([], TODAY);
    expect(html).toContain('Medikamenten-Pass');
    expect(html).toContain('22.07.2026');
  });

  it('renders a message when there are no active medications', () => {
    const html = buildMedicationPassHtml([], TODAY);
    expect(html).toContain('Keine aktiven Medikamente vorhanden.');
  });

  it('includes name, dose, schedule, and start date for an active medication', () => {
    const html = buildMedicationPassHtml([makeMedication()], TODAY);
    expect(html).toContain('Salofalk');
    expect(html).toContain('500mg');
    expect(html).toContain('1x täglich');
    expect(html).toContain('Seit 15.01.2026');
  });

  it('excludes a medication that ended before today', () => {
    const html = buildMedicationPassHtml([makeMedication({ name: 'Beendet', endDate: '2026-01-01' })], TODAY);
    expect(html).not.toContain('Beendet');
    expect(html).toContain('Keine aktiven Medikamente vorhanden.');
  });

  it('includes a medication ending today or in the future', () => {
    const html = buildMedicationPassHtml([makeMedication({ name: 'Noch aktiv', endDate: '2026-07-22' })], TODAY);
    expect(html).toContain('Noch aktiv');
  });

  it('excludes ended medications while including active ones in a mixed list', () => {
    const html = buildMedicationPassHtml(
      [
        makeMedication({ name: 'Aktiv', endDate: null }),
        makeMedication({ id: 2, name: 'Beendet', endDate: '2026-01-01' }),
      ],
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
      TODAY
    );
    expect(html).not.toContain('Übelkeit');
    expect(html).not.toContain('08:00');
  });

  it('escapes HTML special characters in the medication name', () => {
    const html = buildMedicationPassHtml([makeMedication({ name: '<script>alert(1)</script>' })], TODAY);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
