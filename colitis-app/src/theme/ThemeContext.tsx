import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { palettes } from './palettes';
import type { ThemeColors, ThemeId } from './types';
import { getThemeId, setThemeId as persistThemeId } from '../features/settings/settingsStorage';

interface ThemeContextValue {
  themeId: ThemeId;
  colors: ThemeColors;
  setThemeId: (themeId: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>('light');

  useEffect(() => {
    let isActive = true;
    getThemeId()
      .then((storedThemeId) => {
        if (isActive) {
          setThemeIdState(storedThemeId);
        }
      })
      .catch((error: unknown) => {
        console.error('[Theme] Gespeichertes Theme konnte nicht geladen werden:', error);
      });
    return () => {
      isActive = false;
    };
  }, []);

  function handleSetThemeId(nextThemeId: ThemeId) {
    setThemeIdState(nextThemeId);
    persistThemeId(nextThemeId).catch((error: unknown) => {
      console.error('[Theme] Theme konnte nicht gespeichert werden:', error);
    });
  }

  return (
    <ThemeContext.Provider value={{ themeId, colors: palettes[themeId], setThemeId: handleSetThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme muss innerhalb eines ThemeProvider verwendet werden.');
  }
  return context;
}
