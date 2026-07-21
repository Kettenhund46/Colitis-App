import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import {
  getScreeningReminder,
  upsertScreeningReminder,
  setScreeningReminderNotificationId,
  deleteScreeningReminder,
} from './screeningRepository';

describe('screening repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns null when no screening reminder exists yet', async () => {
    expect(await getScreeningReminder(db)).toBeNull();
  });

  it('inserts a new screening reminder when none exists', async () => {
    const { previous, current } = await upsertScreeningReminder(db, {
      intervalMonths: 12,
      nextDueDate: '2027-01-15',
      note: null,
    });

    expect(previous).toBeNull();
    expect(current.id).toBeGreaterThan(0);
    expect(current.intervalMonths).toBe(12);
    expect(current.nextDueDate).toBe('2027-01-15');
    expect(current.notificationId).toBeNull();
  });

  it('updates the existing screening reminder and returns the previous values', async () => {
    const { current: first } = await upsertScreeningReminder(db, {
      intervalMonths: 12,
      nextDueDate: '2027-01-15',
      note: null,
    });
    await setScreeningReminderNotificationId(db, first.id, 'notif-old');

    const { previous, current } = await upsertScreeningReminder(db, {
      intervalMonths: 24,
      nextDueDate: '2028-03-01',
      note: 'Nach Rücksprache verschoben',
    });

    expect(previous?.id).toBe(first.id);
    expect(previous?.notificationId).toBe('notif-old');
    expect(current.id).toBe(first.id);
    expect(current.intervalMonths).toBe(24);
    expect(current.nextDueDate).toBe('2028-03-01');

    const reloaded = await getScreeningReminder(db);
    expect(reloaded?.nextDueDate).toBe('2028-03-01');
    expect(reloaded?.note).toBe('Nach Rücksprache verschoben');
  });

  it('persists a notification id', async () => {
    const { current } = await upsertScreeningReminder(db, {
      intervalMonths: 12,
      nextDueDate: '2027-01-15',
      note: null,
    });

    await setScreeningReminderNotificationId(db, current.id, 'notif-xyz');

    const reloaded = await getScreeningReminder(db);
    expect(reloaded?.notificationId).toBe('notif-xyz');
  });

  it('deletes the screening reminder and returns its previous notification id', async () => {
    const { current } = await upsertScreeningReminder(db, {
      intervalMonths: 12,
      nextDueDate: '2027-01-15',
      note: null,
    });
    await setScreeningReminderNotificationId(db, current.id, 'notif-to-cancel');

    const deleted = await deleteScreeningReminder(db);

    expect(deleted?.notificationId).toBe('notif-to-cancel');
    expect(await getScreeningReminder(db)).toBeNull();
  });

  it('returns null when deleting and no screening reminder exists', async () => {
    expect(await deleteScreeningReminder(db)).toBeNull();
  });
});
