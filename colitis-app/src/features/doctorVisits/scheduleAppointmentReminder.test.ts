import { describe, it, expect, vi, beforeEach } from 'vitest';

const cancelScheduledReminder = vi.fn();
const scheduleDateReminder = vi.fn();
const requestNotificationPermission = vi.fn();

// Nachbau von `rememberScheduledReminder`; das Original haengt an
// expo-notifications und ist in notificationService.test.ts geprueft.
vi.mock('../../lib/notifications/notificationService', () => ({
  cancelScheduledReminder: (notificationId: string) => cancelScheduledReminder(notificationId),
  scheduleDateReminder: (date: Date, content: unknown) => scheduleDateReminder(date, content),
  requestNotificationPermission: () => requestNotificationPermission(),
  rememberScheduledReminder: async (
    notificationId: string | null,
    remember: (notificationId: string | null) => Promise<void>
  ) => {
    try {
      await remember(notificationId);
    } catch (error: unknown) {
      if (notificationId !== null) {
        await cancelScheduledReminder(notificationId);
      }
      throw error;
    }
  },
}));

const getDoctorVisitById = vi.fn();
const setDoctorVisitNotificationId = vi.fn();

vi.mock('./db/doctorVisitsRepository', () => ({
  getDoctorVisitById: (db: unknown, visitId: number) => getDoctorVisitById(db, visitId),
  setDoctorVisitNotificationId: (db: unknown, visitId: number, notificationId: string | null) =>
    setDoctorVisitNotificationId(db, visitId, notificationId),
}));

import { rescheduleAppointmentReminder, cancelAppointmentReminder } from './scheduleAppointmentReminder';
import type { DoctorVisitsDb } from './db/doctorVisitsRepository';
import type { DoctorVisit } from './types';

const db = {} as unknown as DoctorVisitsDb;
const NOW = new Date(2026, 8, 1, 12, 0, 0, 0);

function visit(overrides: Partial<DoctorVisit> = {}): DoctorVisit {
  return {
    id: 7,
    visitDate: '2026-08-01',
    doctorName: 'Dr. Müller',
    reason: null,
    note: null,
    nextAppointmentDate: '2026-09-15',
    nextAppointmentNotificationId: null,
    ...overrides,
  };
}

describe('rescheduleAppointmentReminder', () => {
  beforeEach(() => {
    cancelScheduledReminder.mockReset();
    cancelScheduledReminder.mockResolvedValue(undefined);
    scheduleDateReminder.mockReset();
    scheduleDateReminder.mockResolvedValue('neue-kennung');
    requestNotificationPermission.mockReset();
    requestNotificationPermission.mockResolvedValue(true);
    getDoctorVisitById.mockReset();
    setDoctorVisitNotificationId.mockReset();
    setDoctorVisitNotificationId.mockResolvedValue(undefined);
  });

  it('schedules for the evening before and stores the id', async () => {
    getDoctorVisitById.mockResolvedValue(visit());

    const result = await rescheduleAppointmentReminder(db, 7, NOW);

    expect(result).toBe('scheduled');
    expect(scheduleDateReminder).toHaveBeenCalledWith(new Date(2026, 8, 14, 18, 0, 0, 0), {
      title: 'Morgen ist dein Arzttermin',
      body: 'Termin bei Dr. Müller. Deine Zusammenfassung ist bereit.',
    });
    expect(setDoctorVisitNotificationId).toHaveBeenLastCalledWith(db, 7, 'neue-kennung');
  });

  it('cancels the previous reminder before planning a new one', async () => {
    getDoctorVisitById.mockResolvedValue(visit({ nextAppointmentNotificationId: 'alte-kennung' }));

    await rescheduleAppointmentReminder(db, 7, NOW);

    expect(cancelScheduledReminder).toHaveBeenCalledWith('alte-kennung');
    expect(setDoctorVisitNotificationId).toHaveBeenNthCalledWith(1, db, 7, null);
    expect(setDoctorVisitNotificationId).toHaveBeenLastCalledWith(db, 7, 'neue-kennung');
  });

  it('cancels the previous reminder when the appointment date was removed', async () => {
    getDoctorVisitById.mockResolvedValue(
      visit({ nextAppointmentDate: null, nextAppointmentNotificationId: 'alte-kennung' })
    );

    const result = await rescheduleAppointmentReminder(db, 7, NOW);

    expect(result).toBe('no-appointment');
    expect(cancelScheduledReminder).toHaveBeenCalledWith('alte-kennung');
    expect(scheduleDateReminder).not.toHaveBeenCalled();
  });

  it('schedules nothing for an appointment whose eve has passed', async () => {
    getDoctorVisitById.mockResolvedValue(visit({ nextAppointmentDate: '2026-07-01' }));

    const result = await rescheduleAppointmentReminder(db, 7, NOW);

    expect(result).toBe('in-past');
    expect(scheduleDateReminder).not.toHaveBeenCalled();
  });

  it('reports a denied permission and schedules nothing', async () => {
    getDoctorVisitById.mockResolvedValue(visit());
    requestNotificationPermission.mockResolvedValue(false);

    const result = await rescheduleAppointmentReminder(db, 7, NOW);

    expect(result).toBe('permission-denied');
    expect(scheduleDateReminder).not.toHaveBeenCalled();
  });

  it('reports a missing visit instead of throwing', async () => {
    getDoctorVisitById.mockResolvedValue(null);

    expect(await rescheduleAppointmentReminder(db, 7, NOW)).toBe('visit-missing');
  });

  it('cancels the fresh notification when its id cannot be stored', async () => {
    getDoctorVisitById.mockResolvedValue(visit());
    setDoctorVisitNotificationId.mockRejectedValueOnce(new Error('Datenbank weg'));

    await expect(rescheduleAppointmentReminder(db, 7, NOW)).rejects.toThrow('Datenbank weg');
    expect(cancelScheduledReminder).toHaveBeenCalledWith('neue-kennung');
  });
});

describe('cancelAppointmentReminder', () => {
  beforeEach(() => {
    cancelScheduledReminder.mockReset();
    cancelScheduledReminder.mockResolvedValue(undefined);
    getDoctorVisitById.mockReset();
    setDoctorVisitNotificationId.mockReset();
    setDoctorVisitNotificationId.mockResolvedValue(undefined);
  });

  it('cancels the reminder and clears the stored id', async () => {
    getDoctorVisitById.mockResolvedValue(visit({ nextAppointmentNotificationId: 'kennung' }));

    await cancelAppointmentReminder(db, 7);

    expect(cancelScheduledReminder).toHaveBeenCalledWith('kennung');
    expect(setDoctorVisitNotificationId).toHaveBeenCalledWith(db, 7, null);
  });

  it('does nothing when no reminder was planned', async () => {
    getDoctorVisitById.mockResolvedValue(visit());

    await cancelAppointmentReminder(db, 7);

    expect(cancelScheduledReminder).not.toHaveBeenCalled();
    expect(setDoctorVisitNotificationId).not.toHaveBeenCalled();
  });

  it('does nothing when the visit is already gone', async () => {
    getDoctorVisitById.mockResolvedValue(null);

    await cancelAppointmentReminder(db, 7);

    expect(cancelScheduledReminder).not.toHaveBeenCalled();
  });
});
