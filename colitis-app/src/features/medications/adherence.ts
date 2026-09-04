import { formatLocalDate } from './medicationStatus';
import { parseLocalDate, addDays } from '../../lib/localDate';
import {
  dosesFromReminderTimes,
  dosesOnDate,
  dueDaysIn,
  segmentsFor,
  PAUSED_DOSES,
} from './scheduleHistory';
import type { ScheduleHistory } from './scheduleHistory';
import type { Medication, MedicationIntake } from './types';

export interface MedicationDayStatus {
  medicationId: number;
  name: string;
  expected: number;
  taken: number;
  /** An diesem Tag ausgesetzt: weder faellig noch versaeumt. */
  isPaused: boolean;
}

/**
 * Wie ein Tag gelesen werden muss. Eine Pause ist kein Versaeumnis und auch
 * kein vollstaendiger Tag -- sie braucht ihren eigenen Zustand, sonst faerbt
 * sie sich rot.
 */
export type DayState = 'complete' | 'incomplete' | 'paused';

export interface DaySummary {
  /** Lokales Kalenderdatum, YYYY-MM-DD. */
  date: string;
  /** Nur die an diesem Tag faelligen Medikamente. */
  medications: MedicationDayStatus[];
  /** Die tatsaechlich erfassten Zeilen dieses Tages. */
  intakes: MedicationIntake[];
  state: DayState;
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

/**
 * Die heute faelligen Einnahmen. Gilt fuer den heutigen Tag und die Vorschau
 * auf den Vorrat -- fuer jeden vergangenen Tag fragt die Rueckschau
 * stattdessen die Zeitplan-Historie.
 */
export function expectedDosesPerDay(medication: Medication): number {
  return dosesFromReminderTimes(medication.reminderTimes.length);
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

/**
 * Die faellige Anzahl eines vergangenen Tages. Sie kommt aus der
 * Zeitplan-Historie, nicht aus dem heutigen Stand des Medikaments -- sonst
 * bewertet eine Dosisaenderung rueckwirkend jeden Tag davor neu.
 *
 * Fehlt jeder Abschnitt, bleibt die heutige Anzahl als Notnagel. Das ist das
 * Verhalten von vor der Historisierung und greift nur, wenn ein Medikament
 * ohne Historie in die Datenbank gelangt ist.
 */
function expectedOnDate(
  medication: Medication,
  history: ScheduleHistory,
  date: string
): number {
  return dosesOnDate(segmentsFor(history, medication.id), date) ?? expectedDosesPerDay(medication);
}

function dayStateOf(statuses: MedicationDayStatus[]): DayState {
  const active = statuses.filter((status) => !status.isPaused);
  if (active.length === 0) {
    return 'paused';
  }
  return active.every((status) => status.taken >= status.expected) ? 'complete' : 'incomplete';
}

export function buildDaySummaries(
  medications: Medication[],
  intakes: MedicationIntake[],
  history: ScheduleHistory,
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
      const statuses = due.map((medication) => {
        const expected = expectedOnDate(medication, history, date);
        return {
          medicationId: medication.id,
          name: medication.name,
          expected,
          taken: counts.get(medication.id) ?? 0,
          isPaused: expected === PAUSED_DOSES,
        };
      });
      summaries.push({
        date,
        medications: statuses,
        intakes: dayIntakes,
        state: dayStateOf(statuses),
      });
    }
    cursor = addDays(cursor, -1);
  }

  return summaries;
}

export interface IntakeAdherence {
  /** Tage des Zeitraums, an denen tatsaechlich etwas faellig war. */
  dueDays: string[];
  /** Verschiedene Tage mit mindestens einer erfassten Einnahme. */
  daysWithIntake: number;
  /** Tage, an denen alle faelligen Einnahmen erfasst wurden. */
  completeDays: number;
  /** Alle erfassten Einnahmen an faelligen Tagen. */
  totalIntakes: number;
}

/**
 * Wie zuverlaessig ein Medikament in einem Zeitraum erfasst wurde.
 *
 * Faellig ist nur, was die Zeitplan-Historie als faellig fuehrt -- Pausen sind
 * keine versaeumten Tage. Ohne Abschnitte bleibt die Laufzeit des Medikaments
 * als Grundlage; das ist das Verhalten von vor der Historisierung.
 *
 * Gezaehlt werden nur Einnahmen an faelligen Tagen. Sonst koennte
 * daysWithIntake groesser als dueDays werden -- "an 12 von 10 Tagen erfasst"
 * waere im Arztdokument nicht erklaerbar.
 */
export function computeIntakeAdherence(
  medication: Medication,
  intakes: MedicationIntake[],
  history: ScheduleHistory,
  periodDays: string[]
): IntakeAdherence {
  const segments = segmentsFor(history, medication.id);
  const dueDays =
    segments.length === 0
      ? periodDays.filter((date) => isMedicationDueOn(medication, date))
      : dueDaysIn(segments, periodDays);

  const dueDaySet = new Set(dueDays);
  const countByDay = new Map<string, number>();
  let totalIntakes = 0;
  for (const intake of intakes) {
    if (intake.medicationId !== medication.id) {
      continue;
    }
    const day = localDateOf(intake.takenAt);
    if (dueDaySet.has(day)) {
      countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
      totalIntakes += 1;
    }
  }

  // Vollstaendig heisst: so viele Einnahmen wie an diesem Tag faellig waren --
  // nach der damals gueltigen Anzahl, nicht nach der heutigen.
  const completeDays = dueDays.filter(
    (date) => (countByDay.get(date) ?? 0) >= expectedOnDate(medication, history, date)
  ).length;

  return {
    dueDays,
    daysWithIntake: countByDay.size,
    completeDays,
    totalIntakes,
  };
}

export const PAUSED_DAY_TEXT = 'pausiert';

export function formatDaySummaryLabel(summary: DaySummary): string {
  if (summary.state === 'paused') {
    return PAUSED_DAY_TEXT;
  }
  if (summary.state === 'complete') {
    return 'alles genommen';
  }
  return summary.medications
    .filter((status) => !status.isPaused && status.taken < status.expected)
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
