import { useCallback, useEffect, useState } from 'react';
import { getOnboardingSeen, setOnboardingSeen } from '../settings/settingsStorage';

/**
 * Entscheidet, ob beim Start die Einfuehrung gezeigt wird. Gebaut wie
 * `useAppLockGate`: Der Startbildschirm wartet auf `isResolved` und zeigt
 * solange seinen Ladehinweis.
 *
 * Bei einem Lesefehler gilt die Einfuehrung als gesehen. Der Ausweg ist
 * ungefaehrlich -- niemand wird ausgesperrt, und in den Einstellungen steht
 * sie weiterhin bereit.
 */
export function useOnboardingGate() {
  const [isSeen, setIsSeen] = useState(true);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    let isActive = true;

    getOnboardingSeen()
      .then((seen) => {
        if (!isActive) {
          return;
        }
        setIsSeen(seen);
        setIsResolved(true);
      })
      .catch((error: unknown) => {
        console.error('[Einführung] Status konnte nicht gelesen werden:', error);
        if (!isActive) {
          return;
        }
        setIsSeen(true);
        setIsResolved(true);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const complete = useCallback(() => {
    // Erst ausblenden, dann merken: Schlaegt das Speichern fehl, hat der
    // Nutzer trotzdem seine Ruhe -- die Einfuehrung kaeme erst beim naechsten
    // Start wieder.
    setIsSeen(true);
    setOnboardingSeen(true).catch((error: unknown) => {
      console.error('[Einführung] Status konnte nicht gespeichert werden:', error);
    });
  }, []);

  return { isResolved, isOnboardingRequired: !isSeen, complete };
}
