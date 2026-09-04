import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import {
  createMedication,
  updateMedication,
  endMedication,
  pauseMedication,
  resumeMedication,
  deleteMedication,
} from './medicationsRepository';
import {
  listScheduleSegments,
  listScheduleHistory,
  applyScheduleChange,
  closeScheduleAt,
  alignHistoryStart,
} from './scheduleHistoryRepository';
import type { MedicationInput } from '../types';

function input(overrides: Partial<MedicationInput> = {}): MedicationInput {
  return {
    name: 'Mesalazin',
    dose: '500mg',
    schedule: '3x täglich',
    startDate: '2026-06-01',
    endDate: null,
    sideEffectsNote: null,
    unitsPerIntake: 1,
    packUnits: null,
    stockUnits: null,
    reminderTimes: ['08:00', '13:00', '19:00'],
    ...overrides,
  };
}

describe('schedule history repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('opens a first segment when a medication is created', async () => {
    const created = await createMedication(db, input());
    const segments = await listScheduleSegments(db, created.id);
    expect(segments).toEqual([
      { id: expect.any(Number), validFrom: '2026-06-01', validTo: null, dosesPerDay: 3 },
    ]);
  });

  it('counts one due dose even without a single reminder time', async () => {
    const created = await createMedication(db, input({ reminderTimes: [] }));
    const segments = await listScheduleSegments(db, created.id);
    expect(segments[0].dosesPerDay).toBe(1);
  });

  it('closes the old segment and opens a new one when the count changes', async () => {
    const created = await createMedication(db, input());
    await updateMedication(db, created.id, input({ reminderTimes: ['08:00'] }), '2026-08-01');

    const segments = await listScheduleSegments(db, created.id);
    expect(segments).toEqual([
      { id: expect.any(Number), validFrom: '2026-06-01', validTo: '2026-07-31', dosesPerDay: 3 },
      { id: expect.any(Number), validFrom: '2026-08-01', validTo: null, dosesPerDay: 1 },
    ]);
  });

  it('leaves the history alone when only the dose text changed', async () => {
    const created = await createMedication(db, input());
    await updateMedication(db, created.id, input({ dose: '1000mg' }), '2026-08-01');

    const segments = await listScheduleSegments(db, created.id);
    expect(segments).toHaveLength(1);
  });

  it('pauses as a segment with zero doses', async () => {
    const created = await createMedication(db, input());
    await pauseMedication(db, created.id, '2026-08-01');

    const segments = await listScheduleSegments(db, created.id);
    expect(segments[1]).toMatchObject({ validFrom: '2026-08-01', validTo: null, dosesPerDay: 0 });
  });

  it('resumes with the count its reminder times give today', async () => {
    const created = await createMedication(db, input());
    await pauseMedication(db, created.id, '2026-08-01');
    await resumeMedication(db, created.id, '2026-08-15');

    const segments = await listScheduleSegments(db, created.id);
    expect(segments).toHaveLength(3);
    expect(segments[1]).toMatchObject({ validTo: '2026-08-14', dosesPerDay: 0 });
    expect(segments[2]).toMatchObject({ validFrom: '2026-08-15', validTo: null, dosesPerDay: 3 });
  });

  it('does not resume a paused medication through an ordinary edit', async () => {
    const created = await createMedication(db, input());
    await pauseMedication(db, created.id, '2026-08-01');
    await updateMedication(db, created.id, input({ reminderTimes: ['08:00'] }), '2026-08-10');

    const segments = await listScheduleSegments(db, created.id);
    expect(segments).toHaveLength(2);
    expect(segments[1].dosesPerDay).toBe(0);
  });

  it('closes the open segment when the medication ends', async () => {
    const created = await createMedication(db, input());
    await endMedication(db, created.id, '2026-08-31');

    const segments = await listScheduleSegments(db, created.id);
    expect(segments[0].validTo).toBe('2026-08-31');
  });

  it('drops the segments behind a backdated end and closes the one before', async () => {
    const created = await createMedication(db, input());
    await updateMedication(db, created.id, input({ reminderTimes: ['08:00'] }), '2026-08-01');
    await closeScheduleAt(db, created.id, '2026-07-15');

    const segments = await listScheduleSegments(db, created.id);
    expect(segments).toEqual([
      { id: expect.any(Number), validFrom: '2026-06-01', validTo: '2026-07-15', dosesPerDay: 3 },
    ]);
  });

  it('leaves an earlier end date alone', async () => {
    const created = await createMedication(db, input());
    await endMedication(db, created.id, '2026-07-01');
    await closeScheduleAt(db, created.id, '2026-08-01');

    const segments = await listScheduleSegments(db, created.id);
    expect(segments[0].validTo).toBe('2026-07-01');
  });

  it('moves the first segment along when the start date is brought forward', async () => {
    const created = await createMedication(db, input());
    await updateMedication(db, created.id, input({ startDate: '2026-05-01' }), '2026-08-01');

    const segments = await listScheduleSegments(db, created.id);
    expect(segments[0].validFrom).toBe('2026-05-01');
  });

  it('leaves the start alone when it would swallow a closed segment', async () => {
    const created = await createMedication(db, input());
    await updateMedication(db, created.id, input({ reminderTimes: ['08:00'] }), '2026-07-01');
    await alignHistoryStart(db, created.id, '2026-09-01');

    const segments = await listScheduleSegments(db, created.id);
    expect(segments[0].validFrom).toBe('2026-06-01');
  });

  it('removes the history along with the medication', async () => {
    const created = await createMedication(db, input());
    await deleteMedication(db, created.id);

    expect(await listScheduleSegments(db, created.id)).toEqual([]);
  });

  it('groups the segments of every medication by id', async () => {
    const first = await createMedication(db, input({ name: 'Mesalazin' }));
    const second = await createMedication(db, input({ name: 'Azathioprin', reminderTimes: ['20:00'] }));

    const history = await listScheduleHistory(db);
    expect(history.get(first.id)).toHaveLength(1);
    expect(history.get(second.id)?.[0].dosesPerDay).toBe(1);
  });

  it('sorts the segments of one medication oldest first', async () => {
    const created = await createMedication(db, input());
    await updateMedication(db, created.id, input({ reminderTimes: ['08:00'] }), '2026-08-01');
    await applyScheduleChange(db, created.id, '2026-09-01', 2);

    const history = await listScheduleHistory(db);
    expect(history.get(created.id)?.map((segment) => segment.validFrom)).toEqual([
      '2026-06-01',
      '2026-08-01',
      '2026-09-01',
    ]);
  });
});
