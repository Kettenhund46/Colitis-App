/**
 * Merkt sich, ob gerade ein Systemdialog fuer eine Berechtigung offen ist.
 *
 * Ein solcher Dialog legt die App in den Hintergrund. Ohne diesen Merker
 * schlaegt die App-Sperre beim Zurueckkommen erneut zu, und der Nutzer landet
 * auf dem Sperrbildschirm, obwohl er die App nie verlassen hat.
 *
 * Gezaehlt statt geschaltet: Laufen zwei Anfragen ineinander -- etwa Standort
 * und Benachrichtigungen kurz nacheinander --, wuerde ein einzelnes Flag von
 * der ersten beendeten Anfrage geloescht, waehrend die zweite noch offen ist.
 */

let pendingCount = 0;

export function beginPendingPermissionRequest(): void {
  pendingCount += 1;
}

export function endPendingPermissionRequest(): void {
  pendingCount = Math.max(0, pendingCount - 1);
}

export function isPermissionRequestPending(): boolean {
  return pendingCount > 0;
}

/** Nur fuer Tests: setzt den Zaehler zurueck. */
export function resetPendingPermissionRequests(): void {
  pendingCount = 0;
}

/**
 * Fuehrt eine Berechtigungsanfrage aus und haelt den Merker so lange, wie sie
 * laeuft -- auch wenn sie mit einem Fehler endet.
 */
export async function runWithPendingPermission<T>(request: () => Promise<T>): Promise<T> {
  beginPendingPermissionRequest();
  try {
    return await request();
  } finally {
    endPendingPermissionRequest();
  }
}
