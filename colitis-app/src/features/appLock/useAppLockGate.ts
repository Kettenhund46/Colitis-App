import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { isAppLockEnabled } from './pinAuth';

export function useAppLockGate() {
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    let isActive = true;
    isAppLockEnabled().then((enabled) => {
      if (!isActive) {
        return;
      }
      setIsLockEnabled(enabled);
      setIsUnlocked(!enabled);
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
      isAppLockEnabled().then((enabled) => {
        setIsLockEnabled(enabled);
        if (enabled) {
          setIsUnlocked(false);
        }
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
