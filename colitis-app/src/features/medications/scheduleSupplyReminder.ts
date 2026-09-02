import {
  requestNotificationPermission,
  cancelScheduledReminder,
  rememberScheduledReminder,
  scheduleDateReminder,
} from '../../lib/notifications/notificationService';
import { formatLocalDateKey } from '../../lib/localDate';
import {
  buildSupplyReminderTrigger,
  buildSupplyReminderBody,
  stockAfterIntake,
  stockAfterIntakeRemoved,
  stockAfterRefill,
  SUPPLY_REMINDER_TITLE,
} from './supply';
import {
  getMedicationById,
  setMedicationStock,
  setSupplyNotificationId,
} from './db/medicationsRepository';
import type { MedicationsDb } from './db/medicationsRepository';
import type { Medication } from './types';

export type SupplyReminderResult =
  | 'scheduled'
  | 'not-tracked'
  | 'already-low'
  | 'permission-denied'
  | 'medication-missing';

/**
 * Plant die Rezept-Erinnerung eines Medikaments neu. Wird nach jeder
 * Bestandsaenderung gerufen -- der Zeitpunkt haengt am Bestand, also aendert
 * ihn jede erfasste Einnahme.
 */
export async function rescheduleSupplyReminder(
  db: MedicationsDb,
  medicationId: number,
  leadDays: number,
  now: Date = new Date()
): Promise<SupplyReminderResult> {
  const medication = await getMedicationById(db, medicationId);
  if (medication === null) {
    return 'medication-missing';
  }

  if (medication.supplyNotificationId !== null) {
    await cancelScheduledReminder(medication.supplyNotificationId);
    await setSupplyNotificationId(db, medicationId, null);
  }

  if (medication.stockUnits === null) {
    return 'not-tracked';
  }

  const trigger = buildSupplyReminderTrigger(medication, formatLocalDateKey(now), leadDays, now);
  if (trigger === null) {
    return 'already-low';
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    return 'permission-denied';
  }

  const notificationId = await scheduleDateReminder(trigger.date, {
    title: SUPPLY_REMINDER_TITLE,
    body: buildSupplyReminderBody(medication),
  });
  await rememberScheduledReminder(notificationId, (id) =>
    setSupplyNotificationId(db, medicationId, id)
  );
  return 'scheduled';
}

/** Zieht eine erfasste Einnahme vom Bestand ab und plant die Erinnerung neu. */
export async function applyIntakeToSupply(
  db: MedicationsDb,
  medicationId: number,
  leadDays: number,
  now: Date = new Date()
): Promise<void> {
  await changeStock(db, medicationId, leadDays, now, stockAfterIntake);
}

/** Legt den Bestand nach dem Entfernen einer Einnahme wieder zurueck. */
export async function revertIntakeFromSupply(
  db: MedicationsDb,
  medicationId: number,
  leadDays: number,
  now: Date = new Date()
): Promise<void> {
  await changeStock(db, medicationId, leadDays, now, stockAfterIntakeRemoved);
}

/** Legt eine Packung nach. */
export async function refillSupply(
  db: MedicationsDb,
  medicationId: number,
  leadDays: number,
  now: Date = new Date()
): Promise<void> {
  await changeStock(db, medicationId, leadDays, now, stockAfterRefill);
}

/**
 * Wird der Vorrat fuer dieses Medikament nicht gefuehrt, passiert nichts --
 * insbesondere wird dann auch keine Benachrichtigung geplant.
 */
async function changeStock(
  db: MedicationsDb,
  medicationId: number,
  leadDays: number,
  now: Date,
  nextStockOf: (medication: Medication) => number | null
): Promise<void> {
  const medication = await getMedicationById(db, medicationId);
  if (medication === null || medication.stockUnits === null) {
    return;
  }

  const nextStock = nextStockOf(medication);
  if (nextStock === null || nextStock === medication.stockUnits) {
    return;
  }

  await setMedicationStock(db, medicationId, nextStock);
  await rescheduleSupplyReminder(db, medicationId, leadDays, now);
}
