import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import {
  createDoctorVisit,
  listDoctorVisits,
  getDoctorVisitById,
  updateDoctorVisit,
  deleteDoctorVisit,
} from './doctorVisitsRepository';

describe('doctor visits repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a doctor visit with only the required field set', async () => {
    const created = await createDoctorVisit(db, {
      visitDate: '2026-07-20',
      doctorName: null,
      reason: null,
      note: null,
      nextAppointmentDate: null,
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.visitDate).toBe('2026-07-20');
    expect(created.doctorName).toBeNull();
    expect(created.reason).toBeNull();
    expect(created.note).toBeNull();
    expect(created.nextAppointmentDate).toBeNull();
  });

  it('creates a doctor visit with all fields set', async () => {
    const created = await createDoctorVisit(db, {
      visitDate: '2026-07-20',
      doctorName: 'Dr. Müller, Gastroenterologie',
      reason: 'Kontrolle',
      note: 'Blutwerte unauffällig, Dosis unverändert.',
      nextAppointmentDate: '2026-10-20',
    });

    expect(created.doctorName).toBe('Dr. Müller, Gastroenterologie');
    expect(created.reason).toBe('Kontrolle');
    expect(created.note).toBe('Blutwerte unauffällig, Dosis unverändert.');
    expect(created.nextAppointmentDate).toBe('2026-10-20');
  });

  it('lists doctor visits ordered by date, newest first', async () => {
    await createDoctorVisit(db, {
      visitDate: '2026-01-15',
      doctorName: null,
      reason: null,
      note: null,
      nextAppointmentDate: null,
    });
    await createDoctorVisit(db, {
      visitDate: '2026-06-01',
      doctorName: null,
      reason: null,
      note: null,
      nextAppointmentDate: null,
    });

    const list = await listDoctorVisits(db);

    expect(list.map((visit) => visit.visitDate)).toEqual(['2026-06-01', '2026-01-15']);
  });

  it('gets a single doctor visit by id', async () => {
    const created = await createDoctorVisit(db, {
      visitDate: '2026-07-20',
      doctorName: 'Dr. Müller',
      reason: null,
      note: null,
      nextAppointmentDate: null,
    });

    const found = await getDoctorVisitById(db, created.id);
    expect(found?.doctorName).toBe('Dr. Müller');
  });

  it('returns null when a doctor visit is not found', async () => {
    const found = await getDoctorVisitById(db, 999);
    expect(found).toBeNull();
  });

  it('updates a doctor visit', async () => {
    const created = await createDoctorVisit(db, {
      visitDate: '2026-07-20',
      doctorName: 'Dr. Müller',
      reason: 'Kontrolle',
      note: null,
      nextAppointmentDate: null,
    });

    await updateDoctorVisit(db, created.id, {
      visitDate: '2026-07-21',
      doctorName: 'Dr. Schmidt',
      reason: 'Akuter Schub',
      note: 'Kortison-Stoß begonnen.',
      nextAppointmentDate: '2026-08-01',
    });

    const updated = await getDoctorVisitById(db, created.id);
    expect(updated).toEqual({
      id: created.id,
      visitDate: '2026-07-21',
      doctorName: 'Dr. Schmidt',
      reason: 'Akuter Schub',
      note: 'Kortison-Stoß begonnen.',
      nextAppointmentDate: '2026-08-01',
    });
  });

  it('throws when updating a doctor visit that does not exist', async () => {
    await expect(
      updateDoctorVisit(db, 999, {
        visitDate: '2026-07-21',
        doctorName: null,
        reason: null,
        note: null,
        nextAppointmentDate: null,
      })
    ).rejects.toThrow('Arztbesuch mit ID 999 wurde nicht gefunden.');
  });

  it('deletes a doctor visit', async () => {
    const created = await createDoctorVisit(db, {
      visitDate: '2026-07-20',
      doctorName: null,
      reason: null,
      note: null,
      nextAppointmentDate: null,
    });

    await deleteDoctorVisit(db, created.id);

    expect(await getDoctorVisitById(db, created.id)).toBeNull();
  });

  it('throws when deleting a doctor visit that does not exist', async () => {
    await expect(deleteDoctorVisit(db, 999)).rejects.toThrow('Arztbesuch mit ID 999 wurde nicht gefunden.');
  });
});
