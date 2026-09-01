import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildAppointmentReminderTrigger,
  buildAppointmentReminderContent,
  APPOINTMENT_REMINDER_LEAD_DAYS,
} from './appointmentReminder';
import type { DoctorVisit } from './types';

function visit(overrides: Partial<DoctorVisit> = {}): DoctorVisit {
  return {
    id: 1,
    visitDate: '2026-08-01',
    doctorName: null,
    reason: null,
    note: null,
    nextAppointmentDate: '2026-09-15',
    nextAppointmentNotificationId: null,
    ...overrides,
  };
}

describe('buildAppointmentReminderTrigger', () => {
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

  it('reminds on the evening before the appointment', () => {
    const trigger = buildAppointmentReminderTrigger('2026-09-15', new Date(2026, 8, 1, 12, 0, 0, 0));

    expect(trigger).not.toBeNull();
    expect(trigger?.date).toEqual(new Date(2026, 8, 14, 18, 0, 0, 0));
  });

  it('crosses the month boundary without arithmetic of its own', () => {
    const trigger = buildAppointmentReminderTrigger('2026-03-01', new Date(2026, 1, 10, 12, 0, 0, 0));

    // 2026 ist kein Schaltjahr, der Vortag des 1. Maerz ist der 28. Februar.
    expect(trigger?.date).toEqual(new Date(2026, 1, 28, 18, 0, 0, 0));
  });

  it('crosses the year boundary', () => {
    const trigger = buildAppointmentReminderTrigger('2027-01-01', new Date(2026, 11, 1, 12, 0, 0, 0));

    expect(trigger?.date).toEqual(new Date(2026, 11, 31, 18, 0, 0, 0));
  });

  it('returns null when the evening before has already passed', () => {
    // Termin ist morgen frueh, es ist aber schon 20 Uhr -- der Vorabend ist weg.
    const trigger = buildAppointmentReminderTrigger('2026-09-02', new Date(2026, 8, 1, 20, 0, 0, 0));

    expect(trigger).toBeNull();
  });

  it('returns null for an appointment in the past', () => {
    expect(buildAppointmentReminderTrigger('2026-07-01', new Date(2026, 8, 1, 12, 0, 0, 0))).toBeNull();
  });

  it('still schedules when the evening before is only minutes away', () => {
    const trigger = buildAppointmentReminderTrigger('2026-09-02', new Date(2026, 8, 1, 17, 59, 0, 0));

    expect(trigger?.date).toEqual(new Date(2026, 8, 1, 18, 0, 0, 0));
  });

  it('rejects a malformed date', () => {
    expect(() => buildAppointmentReminderTrigger('15.09.2026', new Date())).toThrow(/Ungültiges Termindatum/);
  });

  it('reminds one day ahead', () => {
    expect(APPOINTMENT_REMINDER_LEAD_DAYS).toBe(1);
  });
});

describe('buildAppointmentReminderContent', () => {
  it('names the doctor and the reason when both are known', () => {
    const content = buildAppointmentReminderContent(
      visit({ doctorName: 'Dr. Müller', reason: 'Kontrolle' })
    );

    expect(content.title).toBe('Morgen ist dein Arzttermin');
    expect(content.body).toBe('Termin bei Dr. Müller (Kontrolle). Deine Zusammenfassung ist bereit.');
  });

  it('leaves out what is missing instead of printing an empty bracket', () => {
    const content = buildAppointmentReminderContent(visit({ doctorName: 'Dr. Müller' }));

    expect(content.body).toBe('Termin bei Dr. Müller. Deine Zusammenfassung ist bereit.');
  });

  it('works without any detail', () => {
    expect(buildAppointmentReminderContent(visit()).body).toBe(
      'Termin. Deine Zusammenfassung ist bereit.'
    );
  });

  it('treats a whitespace-only name as missing', () => {
    expect(buildAppointmentReminderContent(visit({ doctorName: '   ' })).body).toBe(
      'Termin. Deine Zusammenfassung ist bereit.'
    );
  });
});
