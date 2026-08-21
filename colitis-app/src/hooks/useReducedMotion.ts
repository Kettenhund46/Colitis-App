import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Liest die Systemeinstellung fuer reduzierte Bewegung und beobachtet sie.
 * Wer sie gesetzt hat, bekommt keine Animationen - die Gesten selbst bleiben,
 * sie sind Bedienung und keine Zierde.
 *
 * ACHTUNG beim Einsatz: Der erste Rueckgabewert ist immer false, weil
 * AccessibilityInfo.isReduceMotionEnabled() nur asynchron zu haben ist - eine
 * synchrone Variante gibt es in React Native nicht. Wer reduzierte Bewegung
 * gesetzt hat, sieht in genau dem einen Render vor dem Aufloesen des
 * Versprechens noch true fuer "animieren".
 *
 * Fuer Animationen, die durch eine Geste oder einen Tipp ausgeloest werden,
 * ist das folgenlos: Bis der Nutzer etwas anfasst, steht der echte Wert laengst
 * fest. Genau so wird der Haken hier benutzt.
 *
 * Diesen Haken deshalb NICHT benutzen, um eine Animation zu unterdruecken, die
 * beim Einhaengen einer Komponente von selbst startet - die liefe bereits, bevor
 * der Wert da ist. Dafuer braucht es einen dritten Zustand ("noch unbekannt"),
 * bei dem der Aufrufer wartet statt zu animieren.
 */
export function useReducedMotion(): boolean {
  const [isReduced, setIsReduced] = useState(false);

  useEffect(() => {
    let isActive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isActive) {
          setIsReduced(enabled);
        }
      })
      .catch((error: unknown) => {
        console.error('[Bewegung] Systemeinstellung konnte nicht gelesen werden:', error);
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setIsReduced(enabled);
    });

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  return isReduced;
}
