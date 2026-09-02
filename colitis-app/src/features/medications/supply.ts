import { parseLocalDate, addDays, formatLocalDateKey } from '../../lib/localDate';
import { expectedDosesPerDay } from './adherence';
import { formatDayCount } from '../../lib/counting';
import type { Medication } from './types';

/**
 * Vorlauf in Tagen, bevor an ein neues Rezept erinnert wird. Sieben reichen
 * fuer Praxis und Apotheke, auch ueber ein Wochenende.
 */
export const DEFAULT_PRESCRIPTION_LEAD_DAYS = 7;

/** Obergrenze, damit ein Tippfehler nicht als Vorlauf durchgeht. */
export const MAX_PRESCRIPTION_LEAD_DAYS = 60;

export const NO_SUPPLY_TEXT = 'Für dieses Medikament wird kein Vorrat geführt.';

/**
 * Ohne hinterlegten Bestand bleibt die gesamte Vorratsanzeige aus. `null` ist
 * damit nicht "leer", sondern "wird nicht gefuehrt" -- ein Unterschied, der
 * ueberall durchgehalten wird.
 */
export function isSupplyTracked(medication: Medication): boolean {
  return medication.stockUnits !== null;
}

/**
 * Einheiten, die ein voller Tag kostet: Einnahmen pro Tag mal Einheiten je
 * Einnahme. Beides kommt aus dem Medikament selbst.
 */
export function unitsPerDay(medication: Medication): number {
  return expectedDosesPerDay(medication) * Math.max(1, medication.unitsPerIntake);
}

/**
 * Volle Tage, die der Bestand noch reicht. Angebrochene Tage zaehlen nicht
 * mit -- wer noch eine von drei Tagesdosen hat, kommt nicht durch den Tag.
 */
export function daysRemaining(medication: Medication): number | null {
  if (medication.stockUnits === null) {
    return null;
  }
  return Math.floor(Math.max(0, medication.stockUnits) / unitsPerDay(medication));
}

/** Der erste Tag, an dem der Bestand nicht mehr reicht. */
export function runsOutOn(medication: Medication, today: string): string | null {
  const days = daysRemaining(medication);
  if (days === null) {
    return null;
  }
  return formatLocalDateKey(addDays(parseLocalDate(today), days));
}

/** Ob der Vorrat innerhalb des Vorlaufs zur Neige geht. */
export function isSupplyLow(medication: Medication, leadDays: number): boolean {
  const days = daysRemaining(medication);
  return days !== null && days <= leadDays;
}

/**
 * Der Bestand nach einer erfassten Einnahme. Faellt nie unter null -- wer
 * mehr erfasst als hinterlegt war, hat den Bestand nicht gepflegt, nicht
 * Tabletten aus dem Nichts genommen.
 */
export function stockAfterIntake(medication: Medication): number | null {
  if (medication.stockUnits === null) {
    return null;
  }
  return Math.max(0, medication.stockUnits - Math.max(1, medication.unitsPerIntake));
}

/** Der Bestand, nachdem eine irrtuemlich erfasste Einnahme entfernt wurde. */
export function stockAfterIntakeRemoved(medication: Medication): number | null {
  if (medication.stockUnits === null) {
    return null;
  }
  return medication.stockUnits + Math.max(1, medication.unitsPerIntake);
}

/** Der Bestand nach dem Nachlegen einer Packung. */
export function stockAfterRefill(medication: Medication): number | null {
  if (medication.stockUnits === null || medication.packUnits === null) {
    return null;
  }
  return medication.stockUnits + Math.max(1, medication.packUnits);
}

export function formatUnitCount(units: number): string {
  return units === 1 ? '1 Einheit' : `${units} Einheiten`;
}

/** "Vorrat: 42 Einheiten · reicht 14 Tage" */
export function formatSupplyLabel(medication: Medication): string | null {
  const days = daysRemaining(medication);
  if (medication.stockUnits === null || days === null) {
    return null;
  }
  if (days === 0) {
    return `Vorrat: ${formatUnitCount(medication.stockUnits)} · reicht nicht mehr für einen ganzen Tag`;
  }
  return `Vorrat: ${formatUnitCount(medication.stockUnits)} · reicht ${formatDayCount(days)}`;
}

export function formatRefillLabel(medication: Medication): string | null {
  return medication.packUnits === null ? null : `+ Packung (${medication.packUnits})`;
}

const SUPPLY_REMINDER_HOUR = 10;

/**
 * Wann an das Rezept erinnert wird: so viele Tage vor dem Aufbrauchen, wie der
 * Vorlauf sagt. Liegt dieser Zeitpunkt schon hinter uns -- weil der Vorrat
 * bereits knapp ist --, wird nichts geplant; dafuer steht die Warnung in der
 * Liste. Eine Benachrichtigung fuer die Vergangenheit gibt es nicht.
 */
export function buildSupplyReminderTrigger(
  medication: Medication,
  today: string,
  leadDays: number,
  now: Date
): { type: 'date'; date: Date } | null {
  const days = daysRemaining(medication);
  if (days === null) {
    return null;
  }

  const remindAt = addDays(parseLocalDate(today), days - leadDays);
  remindAt.setHours(SUPPLY_REMINDER_HOUR, 0, 0, 0);

  if (remindAt.getTime() <= now.getTime()) {
    return null;
  }
  return { type: 'date', date: remindAt };
}

export const SUPPLY_REMINDER_TITLE = 'Rezept besorgen';

/**
 * Ohne Restzeit im Text: Die Benachrichtigung wird beim Erfassen einer
 * Einnahme geplant und trifft Tage spaeter ein -- eine damals gerechnete Zahl
 * waere dann falsch.
 */
export function buildSupplyReminderBody(medication: Medication): string {
  return `${medication.name} geht zur Neige. Zeit für ein neues Rezept.`;
}
