import { parseLocalDate, addDays, formatLocalDateKey } from '../../lib/localDate';

/**
 * Ein Abschnitt, in dem eine bestimmte Anzahl Einnahmen je Tag faellig war.
 * Abschnitte eines Medikaments ueberlappen sich nicht und sind aufsteigend
 * nach `validFrom` sortiert.
 */
export interface ScheduleSegment {
  id: number;
  /** Erster Tag des Abschnitts, YYYY-MM-DD lokal. */
  validFrom: string;
  /** Letzter Tag. `null` heisst: gilt weiter. */
  validTo: string | null;
  /** Faellige Einnahmen je Tag. `0` heisst pausiert. */
  dosesPerDay: number;
}

/** Alle Abschnitte, nach Medikament. */
export type ScheduleHistory = Map<number, ScheduleSegment[]>;

export const PAUSED_DOSES = 0;

/**
 * Faellige Einnahmen aus der Zahl der Erinnerungszeiten. Ohne eine einzige
 * Zeit ist trotzdem eine Einnahme faellig -- wer keine Erinnerung will, nimmt
 * das Medikament deswegen nicht seltener.
 */
export function dosesFromReminderTimes(reminderTimeCount: number): number {
  return Math.max(1, reminderTimeCount);
}

/**
 * Was an einem Aenderungstag mit der Historie geschehen muss. Bewusst eine
 * Anweisung und keine neue Liste: Das Speichern braucht die Zeilen-ID des
 * Abschnitts, den es schliesst.
 */
export type ScheduleChange =
  | { kind: 'none' }
  | { kind: 'open'; validFrom: string; dosesPerDay: number }
  | { kind: 'replace'; segmentId: number; dosesPerDay: number }
  | {
      kind: 'closeAndOpen';
      segmentId: number;
      validTo: string;
      validFrom: string;
      dosesPerDay: number;
    };

function coversDate(segment: ScheduleSegment, date: string): boolean {
  if (date < segment.validFrom) {
    return false;
  }
  return segment.validTo === null || date <= segment.validTo;
}

/**
 * Die faelligen Einnahmen an einem einzelnen Tag. `null` heisst: kein
 * Abschnitt deckt diesen Tag ab -- das Medikament lief da nicht.
 */
export function dosesOnDate(segments: ScheduleSegment[], date: string): number | null {
  const covering = segments.find((segment) => coversDate(segment, date));
  return covering === undefined ? null : covering.dosesPerDay;
}

export function isPausedOn(segments: ScheduleSegment[], date: string): boolean {
  return dosesOnDate(segments, date) === PAUSED_DOSES;
}

/**
 * Seit wann pausiert wird, oder `null`, wenn an diesem Tag nicht pausiert
 * wird. Fuer die Zeile "Pausiert seit ..." auf der Karte.
 */
export function pausedSince(segments: ScheduleSegment[], date: string): string | null {
  const covering = segments.find((segment) => coversDate(segment, date));
  if (covering === undefined || covering.dosesPerDay !== PAUSED_DOSES) {
    return null;
  }
  return covering.validFrom;
}

/** Der noch offene Abschnitt, falls es einen gibt. */
export function openSegment(segments: ScheduleSegment[]): ScheduleSegment | null {
  return segments.find((segment) => segment.validTo === null) ?? null;
}

/**
 * Plant die Aenderung auf `dosesPerDay` mit Wirkung ab `changeDate`.
 *
 * Drei Faelle, die auseinandergehalten werden muessen: Ohne offenen Abschnitt
 * wird einer eroeffnet. Faellt die Aenderung auf den Starttag des offenen
 * Abschnitts, hat der nie gegolten und wird ueberschrieben -- sonst entstuende
 * ein Abschnitt ohne einen einzigen Tag. Sonst wird der alte am Vortag
 * geschlossen und ein neuer eroeffnet.
 */
export function planScheduleChange(
  segments: ScheduleSegment[],
  changeDate: string,
  dosesPerDay: number
): ScheduleChange {
  const open = openSegment(segments);

  if (open === null) {
    return { kind: 'open', validFrom: changeDate, dosesPerDay };
  }

  if (open.dosesPerDay === dosesPerDay) {
    return { kind: 'none' };
  }

  if (changeDate <= open.validFrom) {
    return { kind: 'replace', segmentId: open.id, dosesPerDay };
  }

  return {
    kind: 'closeAndOpen',
    segmentId: open.id,
    validTo: formatLocalDateKey(addDays(parseLocalDate(changeDate), -1)),
    validFrom: changeDate,
    dosesPerDay,
  };
}

/**
 * Tage eines Zeitraums, an denen das Medikament tatsaechlich faellig war --
 * Pausen zaehlen nicht mit. Grundlage jeder Quote, die aus der Historie
 * entsteht.
 */
export function dueDaysIn(segments: ScheduleSegment[], days: string[]): string[] {
  return days.filter((date) => {
    const doses = dosesOnDate(segments, date);
    return doses !== null && doses > PAUSED_DOSES;
  });
}

export function segmentsFor(history: ScheduleHistory, medicationId: number): ScheduleSegment[] {
  return history.get(medicationId) ?? [];
}

/** Ein Abschnitt samt seinem Medikament -- die Form, in der er gespeichert ist. */
export interface MedicationScheduleSegment extends ScheduleSegment {
  medicationId: number;
}

/** Sortiert flach gelesene Abschnitte nach Medikament, Reihenfolge erhalten. */
export function groupByMedication(rows: MedicationScheduleSegment[]): ScheduleHistory {
  const history: ScheduleHistory = new Map();
  for (const row of rows) {
    const segment: ScheduleSegment = {
      id: row.id,
      validFrom: row.validFrom,
      validTo: row.validTo,
      dosesPerDay: row.dosesPerDay,
    };
    const existing = history.get(row.medicationId);
    if (existing === undefined) {
      history.set(row.medicationId, [segment]);
    } else {
      existing.push(segment);
    }
  }
  return history;
}

/** Welche Medikamente an diesem Tag ausgesetzt sind. */
export function pausedMedicationIdsOn(
  rows: MedicationScheduleSegment[],
  date: string
): Set<number> {
  const paused = new Set<number>();
  for (const [medicationId, segments] of groupByMedication(rows)) {
    if (isPausedOn(segments, date)) {
      paused.add(medicationId);
    }
  }
  return paused;
}
