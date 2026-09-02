/**
 * Zaehlwoerter fuer Tage. Lagen bisher nur in der Arzt-Zusammenfassung; mit
 * der Vorratsanzeige waere die zweite Kopie entstanden.
 */

/** Nominativ: "1 Tag", "104 Tage". */
export function formatDayCount(count: number): string {
  return count === 1 ? `${count} Tag` : `${count} Tage`;
}

/** Dativ: "an 1 Tag", "an 104 Tagen". */
export function formatDayCountDative(count: number): string {
  return count === 1 ? `${count} Tag` : `${count} Tagen`;
}
