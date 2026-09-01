/**
 * Eine Nachkommastelle in deutscher Schreibweise: 3.4 wird zu "3,4".
 *
 * Lag zeichengleich in drei Modulen -- der Zusammenfassung, dem
 * Aktivitaetsindex und dem Verlaufsdiagramm.
 */
export function formatDecimalComma(value: number): string {
  return value.toFixed(1).replace('.', ',');
}
