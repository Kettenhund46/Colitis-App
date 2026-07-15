import * as SQLite from 'expo-sqlite';
import { DB_FILE_NAME, resetDbCache } from '../db/client';
import { clearDbKey } from './encryption';
import { resetAppLock } from '../features/appLock/pinAuth';

interface ResetStepFailure {
  step: string;
  error: unknown;
}

export async function resetAppData(): Promise<void> {
  const failures: ResetStepFailure[] = [];

  await runResetStep(failures, 'Datenbank löschen', () => SQLite.deleteDatabaseAsync(DB_FILE_NAME));
  await runResetStep(failures, 'Datenbank-Schlüssel löschen', () => clearDbKey());
  await runResetStep(failures, 'PIN zurücksetzen', () => resetAppLock());
  await runResetStep(failures, 'Datenbank-Cache zurücksetzen', () => Promise.resolve(resetDbCache()));

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`[AppReset] Schritt fehlgeschlagen (${failure.step}):`, failure.error);
    }
    const failedSteps = failures.map((failure) => failure.step).join(', ');
    throw new Error(`Zurücksetzen unvollständig, folgende Schritte sind fehlgeschlagen: ${failedSteps}`);
  }
}

async function runResetStep(
  failures: ResetStepFailure[],
  step: string,
  action: () => Promise<void> | void
): Promise<void> {
  try {
    await action();
  } catch (error: unknown) {
    failures.push({ step, error });
  }
}
