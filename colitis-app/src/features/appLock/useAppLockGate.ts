import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { isAppLockEnabled } from './pinAuth';

export function useAppLockGate() {
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    let isActive = true;
    isAppLockEnabled()
      .then((enabled) => {
        if (!isActive) {
          return;
        }
        setIsLockEnabled(enabled);
        setIsUnlocked(!enabled);
        setIsResolved(true);
      })
      .catch((error: unknown) => {
        console.error('[AppLock] Sperrstatus konnte nicht gelesen werden:', error);
        if (!isActive) {
          return;
        }
        // Sicherer Default bei unsicherem Zustand: Sperre gilt als aktiv,
        // Ausweg bleibt der bestehende "PIN vergessen"-Reset in LockScreen.
        setIsLockEnabled(true);
        setIsUnlocked(false);
        setIsResolved(true);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        return;
      }
      isAppLockEnabled()
        .then((enabled) => {
          setIsLockEnabled(enabled);
          if (enabled) {
            setIsUnlocked(false);
          }
        })
        .catch((error: unknown) => {
          console.error('[AppLock] Sperrstatus konnte nicht aktualisiert werden:', error);
          setIsLockEnabled(true);
          setIsUnlocked(false);
        });
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const unlock = useCallback(() => {
    setIsUnlocked(true);
  }, []);

  return {
    isResolved,
    isLockRequired: isLockEnabled && !isUnlocked,
    unlock,
  };
}
