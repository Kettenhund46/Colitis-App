const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function resolveBackupReminderEnabled(rawEnabled: boolean | null, lastBackupAt: string | null): boolean {
  if (rawEnabled !== null) {
    return rawEnabled;
  }
  return lastBackupAt !== null;
}

export function buildBackupReminderTrigger(lastBackupAt: string, intervalDays: number, now: Date): Date | null {
  const dueDate = new Date(new Date(lastBackupAt).getTime() + intervalDays * MILLISECONDS_PER_DAY);
  if (dueDate.getTime() <= now.getTime()) {
    return null;
  }
  return dueDate;
}
