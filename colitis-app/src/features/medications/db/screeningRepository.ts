import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { screeningReminders } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { ScreeningReminder, NewScreeningReminderInput } from '../types';

export type ScreeningDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function getScreeningReminder(db: ScreeningDb): Promise<ScreeningReminder | null> {
  const rows = await db.select().from(screeningReminders);
  if (rows.length === 0) {
    return null;
  }
  return rowToScreeningReminder(rows[0]);
}

export interface ScreeningReminderUpsertResult {
  previous: ScreeningReminder | null;
  current: ScreeningReminder;
}

export async function upsertScreeningReminder(
  db: ScreeningDb,
  input: NewScreeningReminderInput
): Promise<ScreeningReminderUpsertResult> {
  const existing = await getScreeningReminder(db);

  if (existing === null) {
    const [inserted] = await db
      .insert(screeningReminders)
      .values({
        intervalMonths: input.intervalMonths,
        nextDueDate: input.nextDueDate,
        note: input.note,
        notificationId: null,
      })
      .returning({ id: screeningReminders.id });

    return {
      previous: null,
      current: {
        id: inserted.id,
        intervalMonths: input.intervalMonths,
        nextDueDate: input.nextDueDate,
        note: input.note,
        notificationId: null,
      },
    };
  }

  await db
    .update(screeningReminders)
    .set({
      intervalMonths: input.intervalMonths,
      nextDueDate: input.nextDueDate,
      note: input.note,
    })
    .where(eq(screeningReminders.id, existing.id));

  return {
    previous: existing,
    current: {
      id: existing.id,
      intervalMonths: input.intervalMonths,
      nextDueDate: input.nextDueDate,
      note: input.note,
      notificationId: existing.notificationId,
    },
  };
}

export async function setScreeningReminderNotificationId(
  db: ScreeningDb,
  id: number,
  notificationId: string | null
): Promise<void> {
  await db.update(screeningReminders).set({ notificationId }).where(eq(screeningReminders.id, id));
}

function rowToScreeningReminder(row: typeof screeningReminders.$inferSelect): ScreeningReminder {
  return {
    id: row.id,
    intervalMonths: row.intervalMonths,
    nextDueDate: row.nextDueDate,
    note: row.note,
    notificationId: row.notificationId,
  };
}
