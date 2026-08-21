import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Liest die Systemeinstellung fuer reduzierte Bewegung und beobachtet sie.
 * Wer sie gesetzt hat, bekommt keine Animationen - die Gesten selbst bleiben,
 * sie sind Bedienung und keine Zierde.
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
