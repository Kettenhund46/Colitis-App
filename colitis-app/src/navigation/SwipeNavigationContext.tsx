import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getSwipeNavigationEnabled,
  setSwipeNavigationEnabled as persistSwipeNavigationEnabled,
} from '../features/settings/settingsStorage';

interface SwipeNavigationContextValue {
  swipeEnabled: boolean;
  setSwipeEnabled: (enabled: boolean) => void;
}

const SwipeNavigationContext = createContext<SwipeNavigationContextValue | null>(null);

export function SwipeNavigationProvider({ children }: { children: ReactNode }) {
  const [swipeEnabled, setSwipeEnabledState] = useState(true);

  useEffect(() => {
    let isActive = true;
    getSwipeNavigationEnabled()
      .then((storedValue) => {
        if (isActive) {
          setSwipeEnabledState(storedValue);
        }
      })
      .catch((error: unknown) => {
        console.error('[SwipeNavigation] Einstellung konnte nicht geladen werden:', error);
      });
    return () => {
      isActive = false;
    };
  }, []);

  function handleSetSwipeEnabled(nextValue: boolean) {
    setSwipeEnabledState(nextValue);
    persistSwipeNavigationEnabled(nextValue).catch((error: unknown) => {
      console.error('[SwipeNavigation] Einstellung konnte nicht gespeichert werden:', error);
    });
  }

  return (
    <SwipeNavigationContext.Provider value={{ swipeEnabled, setSwipeEnabled: handleSetSwipeEnabled }}>
      {children}
    </SwipeNavigationContext.Provider>
  );
}

export function useSwipeNavigation(): SwipeNavigationContextValue {
  const context = useContext(SwipeNavigationContext);
  if (!context) {
    throw new Error('useSwipeNavigation muss innerhalb eines SwipeNavigationProvider verwendet werden.');
  }
  return context;
}
