import { rescheduleAllReminders } from './rescheduleReminders';
import { rescheduleBackupReminder } from './scheduleBackupReminder';
import { rescheduleDiaryReminder } from '../diary/scheduleDiaryReminder';
import { getPrescriptionLeadDays } from '../settings/settingsStorage';
import type { BackupDb } from './db/backupRepository';
import type { BackupData } from './types';

/** Die Erinnerungsarten, so wie sie dem Nutzer gegenueber heissen. */
export type ReminderKind = 'Medikamente' | 'Sicherung' | 'Tagebuch';

/**
 * Plant nach dem Wiederherstellen einer Sicherung alle Erinnerungen neu --
 * jede fuer sich. Frueher war das eine Kette aus drei `await`, in der ein
 * Fehler bei den Medikamenten die Tagebuch-Erinnerung mitriss, also
 * ausgerechnet die, die der Nutzer taeglich bemerkt.
 *
 * Gibt die Arten zurueck, die sich nicht planen liessen; ein leeres Feld
 * heisst, dass alles steht.
 */
export async function rescheduleAllAfterRestore(
  db: BackupDb,
  data: BackupData
): Promise<ReminderKind[]> {
  const steps: [ReminderKind, () => Promise<unknown>][] = [
    ['Medikamente', async () => rescheduleAllReminders(db, data, new Date(), await getPrescriptionLeadDays())],
    ['Sicherung', () => rescheduleBackupReminder()],
    ['Tagebuch', () => rescheduleDiaryReminder()],
  ];

  const failed: ReminderKind[] = [];

  for (const [kind, run] of steps) {
    try {
      await run();
    } catch (error: unknown) {
      console.error(
        `[Sicherung] Erinnerung "${kind}" liess sich nach dem Wiederherstellen nicht planen:`,
        error
      );
      failed.push(kind);
    }
  }

  return failed;
}

export function formatRestoreResultMessage(failed: ReminderKind[]): string {
  if (failed.length === 0) {
    return 'Backup erfolgreich wiederhergestellt.';
  }
  const clause =
    failed.length === 1
      ? 'Diese Erinnerung konnte nicht neu geplant werden'
      : 'Diese Erinnerungen konnten nicht neu geplant werden';
  return `Daten wiederhergestellt. ${clause}: ${failed.join(', ')}.`;
}
