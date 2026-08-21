import * as Haptics from 'expo-haptics';

/**
 * Kurzes Ticken nach erfolgreichem Speichern.
 *
 * Bewusst nicht async und ohne Rueckgabewert: Ein fehlgeschlagenes Ticken darf
 * niemals ein Speichern aufhalten oder einen Fehler nach oben reichen. Es gibt
 * auch keinen eigenen Schalter dafuer - Android und iOS haben je einen
 * systemweiten, dem expo-haptics von selbst folgt.
 */
export function saveFeedback(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Etwas kraeftigeres Ticken nach dem Ausloesen eines Loeschvorgangs. */
export function deleteFeedback(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}
