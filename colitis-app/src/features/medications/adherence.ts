import { formatLocalDate } from './medicationStatus';
import { parseLocalDate, addDays } from '../../lib/localDate';
import type { Medication, MedicationIntake } from './types';

export interface MedicationDayStatus {
  medicationId: number;
  name: string;
  expected: number;
  taken: number;
}

export interface DaySummary {
  /** Lokales Kalenderdatum, YYYY-MM-DD. */
  date: string;
  /** Nur die an diesem Tag faelligen Medikamente. */
  medications: MedicationDayStatus[];
  /** Die tatsaechlich erfassten Zeilen dieses Tages. */
  intakes: MedicationIntake[];
  isComplete: boolean;
}

export type HistoryPeriod = '30' | '90' | 'alles';

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAYS_BY_PERIOD: Record<'30' | '90', number> = { '30': 30, '90': 90 };
const UNKNOWN_MEDICATION_NAME = 'Unbekanntes Medikament';

/**
 * Der Zeitstempel im Protokoll ist UTC, der Kalendertag des Nutzers ist lokal.
 * Ohne diese Umrechnung faellt eine Einnahme kurz nach Mitternacht auf den
 * Vortag und damit in die falsche Zeile.
 */
export function localDateOf(takenAt: string): string {
  return formatLocalDate(new Date(takenAt));
}

export function expectedDosesPerDay(medication: Medication): number {
  return Math.max(1, medication.reminderTimes.length);
}

export function isMedicationDueOn(medication: Medication, date: string): boolean {
  if (date < medication.startDate) {
    return false;
  }
  if (medication.endDate !== null && date > medication.endDate) {
    return false;
  }
  return true;
}

export function intakesOnDate(intakes: MedicationIntake[], date: string): MedicationIntake[] {
  return intakes.filter((intake) => localDateOf(intake.takenAt) === date);
}

export function countByMedication(intakes: MedicationIntake[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const intake of intakes) {
    counts.set(intake.medicationId, (counts.get(intake.medicationId) ?? 0) + 1);
  }
  return counts;
}

function groupIntakesByDate(intakes: MedicationIntake[]): Map<string, MedicationIntake[]> {
  const byDate = new Map<string, MedicationIntake[]>();
  for (const intake of intakes) {
    const date = localDateOf(intake.takenAt);
    const bucket = byDate.get(date);
    if (bucket === undefined) {
      byDate.set(date, [intake]);
    } else {
      bucket.push(intake);
    }
  }
  return byDate;
}

export function buildDaySummaries(
  medications: Medication[],
  intakes: MedicationIntake[],
  fromDate: string,
  toDate: string
): DaySummary[] {
  const byDate = groupIntakesByDate(intakes);
  const from = parseLocalDate(fromDate);
  const summaries: DaySummary[] = [];

  let cursor = parseLocalDate(toDate);
  while (cursor.getTime() >= from.getTime()) {
    const date = formatLocalDate(cursor);
    const due = medications.filter((medication) => isMedicationDueOn(medication, date));
    if (due.length > 0) {
      const dayIntakes = byDate.get(date) ?? [];
      const counts = countByMedication(dayIntakes);
      const statuses = due.map((medication) => ({
        medicationId: medication.id,
        name: medication.name,
        expected: expectedDosesPerDay(medication),
        taken: counts.get(medication.id) ?? 0,
      }));
      summaries.push({
        date,
        medications: statuses,
        intakes: dayIntakes,
        isComplete: statuses.every((status) => status.taken >= status.expected),
      });
    }
    cursor = addDays(cursor, -1);
  }

  return summaries;
}

export function formatDaySummaryLabel(summary: DaySummary): string {
  if (summary.isComplete) {
    return 'alles genommen';
  }
  return summary.medications
    .filter((status) => status.taken < status.expected)
    .map((status) => `${status.name}: ${status.taken} von ${status.expected}`)
    .join(' · ');
}

export function formatDayHeading(date: string): string {
  const parsed = parseLocalDate(date);
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${WEEKDAY_LABELS[parsed.getDay()]} ${day}.${month}.`;
}

export function formatIntakeTime(takenAt: string): string {
  const parsed = new Date(takenAt);
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatTakenButtonLabel(taken: number, expected: number): string {
  if (taken >= expected) {
    return 'Heute genommen ✓';
  }
  if (expected === 1) {
    return 'Heute genommen';
  }
  return `Heute genommen (${taken} von ${expected})`;
}

export function periodStartDate(
  period: HistoryPeriod,
  medications: Medication[],
  today: string
): string {
  if (period === 'alles') {
    if (medications.length === 0) {
      return today;
    }
    return medications
      .map((medication) => medication.startDate)
      .reduce((earliest, candidate) => (candidate < earliest ? candidate : earliest));
  }
  // Der heutige Tag zaehlt mit, deshalb einer weniger zurueck.
  return formatLocalDate(addDays(parseLocalDate(today), -(DAYS_BY_PERIOD[period] - 1)));
}

/**
 * Untergrenze der Datenbankabfrage: ein Tag frueher als gefragt. Der
 * gespeicherte Zeitstempel ist UTC, gesucht wird nach lokalen Tagen — ohne
 * diesen Puffer fiele die frueheste Einnahme am Rand heraus.
 */
export function queryLowerBoundIso(fromDate: string): string {
  return addDays(parseLocalDate(fromDate), -1).toISOString();
}

export function medicationNameById(medications: Medication[], medicationId: number): string {
  const found = medications.find((medication) => medication.id === medicationId);
  return found === undefined ? UNKNOWN_MEDICATION_NAME : found.name;
}
