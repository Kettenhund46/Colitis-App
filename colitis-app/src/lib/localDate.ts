/**
 * Kalendertage, wie der Nutzer sie sieht -- also lokal, nicht UTC. Diese drei
 * Funktionen lagen vorher dreifach im Baum: in calendarLogic, medicationStatus
 * und adherence. Wer hier etwas aendert, aendert es fuer Tagebuch,
 * Medikamente und Arztbesuche zugleich.
 */

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Ein Kalenderdatum als lokalen Tag lesen. new Date('2026-08-21') waere UTC
 * und wuerde den Tag in oestlichen Zeitzonen verschieben.
 */
export function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Ueber Kalenderfelder rechnen, nicht ueber Millisekunden -- sonst geht die
 * Rechnung an den beiden Tagen der Zeitumstellung um eine Stunde daneben.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Alle Kalendertage von fromDate bis toDate, aufsteigend, beide eingeschlossen. */
export function eachDayInclusive(fromDate: string, toDate: string): string[] {
  const to = parseLocalDate(toDate);
  const days: string[] = [];

  let cursor = parseLocalDate(fromDate);
  while (cursor.getTime() <= to.getTime()) {
    days.push(formatLocalDateKey(cursor));
    cursor = addDays(cursor, 1);
  }

  return days;
}
