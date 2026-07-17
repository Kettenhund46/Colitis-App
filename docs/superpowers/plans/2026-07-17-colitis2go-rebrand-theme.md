# Colitis2Go: Umbenennung, Theme-System und Wortwitze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App in "Colitis2Go" umbenennen (sichtbar), ein vollständiges Theme-System (Hell/Dunkel/Blau-Weiß) einführen, das app-weit greift, alle Toggles auf eine eigene `SliderToggle`-Komponente umstellen, und ein "Wortwitze des Tages"-Feature (inkl. optionalem krankheitsbezogenem Zusatzpool) ergänzen.

**Architecture:** Ein `ThemeContext` (React Context) stellt `colors` app-weit bereit, persistiert via `@react-native-async-storage/async-storage`. Alle 35 Dateien, die aktuell `tokens.colors` direkt importieren, werden auf `useTheme()` umgestellt — dafür gibt es ein exaktes, mechanisches Migrations-Rezept (siehe unten), das in Batch-Tasks pro Feature-Bereich angewendet wird. Wortwitze sind reine, TDD-getestete Funktionen (`pickJokeForDate`, `buildJokePool`) plus ein einfaches Modal, das beim App-Start eingeblendet wird.

**Tech Stack:** Expo SDK 57, React Native, TypeScript, Expo Router, Vitest (TDD für reine Logik), `@react-native-async-storage/async-storage` (neu).

**Spec:** `docs/superpowers/specs/2026-07-17-colitis-app-colitis2go-rebrand-theme-design.md`

## Global Constraints

- Projekt-Konvention: reine Logik (Repositories, Formatierung, Berechnungen) wird TDD getestet (Vitest, RED→GREEN). Screens und UI-Komponenten bleiben ungetestet.
- Alle sichtbaren Texte auf Deutsch, konsistent mit bestehender App.
- `tokens.spacing`, `tokens.typography`, `tokens.radius` bleiben unverändert und themenunabhängig — nur `tokens.colors` wird durch das Theme-System ersetzt.
- Keine neuen `console.log` in Produktionscode; Fehler werden mit `console.error('[Bereich] ...:', error)` geloggt, konsistent mit bestehendem Muster.
- Jeder Code-Task endet mit `npx tsc --noEmit` im Verzeichnis `colitis-app` (Befehl: `cd colitis-app && npx tsc --noEmit`), das muss fehlerfrei durchlaufen.
- Test-Befehl: `cd colitis-app && npx vitest run <pfad>` für einzelne Dateien, `cd colitis-app && npm test` für die volle Suite.

## Migrations-Rezept (für alle Batch-Tasks ab Task 11)

Für jede Datei, die aktuell `tokens.colors.X` verwendet:

1. Import ergänzen (gleiche Verzeichnistiefe wie der bestehende `tokens`-Import, nur `styles/tokens` durch `theme/ThemeContext` bzw. `theme/types` ersetzen):
   ```ts
   import { useTheme } from '<gleiche-tiefe>/theme/ThemeContext';
   import type { ThemeColors } from '<gleiche-tiefe>/theme/types';
   ```
2. Im obersten Hook-Block der Komponente (vor jedem `if`/`return`) ergänzen:
   ```ts
   const { colors } = useTheme();
   const styles = makeStyles(colors);
   ```
   (ersetzt die bisherige modul-weite `const styles = StyleSheet.create({...})`-Zuweisung)
3. Die bestehende `StyleSheet.create({...})`-Definition wird in eine Funktion verschoben, gleicher Objekt-Body, nur `tokens.colors.X` → `colors.X`:
   ```ts
   function makeStyles(colors: ThemeColors) {
     return StyleSheet.create({
       // ... unverändert, außer tokens.colors.X -> colors.X
     });
   }
   ```
4. Jedes `tokens.colors.X` außerhalb der `StyleSheet`-Definition (z. B. `placeholderTextColor={tokens.colors.textSecondary}`, `tabBarActiveTintColor: tokens.colors.primary`) wird ebenfalls zu `colors.X`.
5. Der `tokens`-Import bleibt bestehen, wenn die Datei noch `tokens.spacing`/`tokens.typography`/`tokens.radius` verwendet (praktisch immer der Fall) — nur `tokens.colors` verschwindet vollständig aus der Datei.
6. Verifikation pro Datei: `grep -n "tokens.colors" <datei>` liefert keine Treffer mehr.

---

### Task 1: App-Umbenennung

**Files:**
- Modify: `colitis-app/app.json:3`
- Modify: `colitis-app/src/features/appLock/components/LockScreen.tsx:32,54`

**Interfaces:**
- Produces: keine neuen Symbole, reine Textänderung.

- [ ] **Step 1: `app.json` umbenennen**

In `colitis-app/app.json` Zeile 3:
```json
    "name": "Colitis2Go",
```
(vorher `"name": "colitis-app"`)

- [ ] **Step 2: Entsperr-Text in `LockScreen.tsx` umbenennen**

In `colitis-app/src/features/appLock/components/LockScreen.tsx`, beide Vorkommen ersetzen:
- Zeile 32: `await authenticateWithBiometrics('Colitis2Go entsperren');`
- Zeile 54: `await authenticateWithBiometrics('Colitis2Go entsperren');`

- [ ] **Step 3: Verifikation**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add colitis-app/app.json colitis-app/src/features/appLock/components/LockScreen.tsx
git commit -m "feat: App zu Colitis2Go umbenennen"
```

---

### Task 2: Theme-Typen & Paletten (TDD)

**Files:**
- Create: `colitis-app/src/theme/types.ts`
- Create: `colitis-app/src/theme/palettes.ts`
- Test: `colitis-app/src/theme/palettes.test.ts`

**Interfaces:**
- Produces: `ThemeId = 'light' | 'dark' | 'light-blue'`, `ThemeColors` (interface mit `background, surface, textPrimary, textSecondary, primary, accent, danger, success, border, overlay: string`), `palettes: Record<ThemeId, ThemeColors>`, `lightColors`, `darkColors`, `lightBlueColors`.

- [ ] **Step 1: Typen anlegen**

`colitis-app/src/theme/types.ts`:
```ts
export type ThemeId = 'light' | 'dark' | 'light-blue';

export interface ThemeColors {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  accent: string;
  danger: string;
  success: string;
  border: string;
  overlay: string;
}
```

- [ ] **Step 2: Failing test für Paletten schreiben**

`colitis-app/src/theme/palettes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { palettes } from './palettes';

const COLOR_PATTERN = /^(#[0-9A-Fa-f]{6}|rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\))$/;

describe('theme palettes', () => {
  Object.entries(palettes).forEach(([themeId, colors]) => {
    describe(themeId, () => {
      it('defines a hex or rgba value for every color token', () => {
        Object.values(colors).forEach((value) => {
          expect(value).toMatch(COLOR_PATTERN);
        });
      });

      it('does not use pure alarm red as the primary or accent color', () => {
        expect(colors.primary.toUpperCase()).not.toBe('#FF0000');
        expect(colors.accent.toUpperCase()).not.toBe('#FF0000');
      });
    });
  });

  it('defines exactly the same color keys across all themes', () => {
    const [firstKeys, ...restKeys] = Object.values(palettes).map((colors) => Object.keys(colors).sort());
    restKeys.forEach((keys) => {
      expect(keys).toEqual(firstKeys);
    });
  });
});
```

- [ ] **Step 3: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/theme/palettes.test.ts`
Expected: FAIL — `Cannot find module './palettes'`

- [ ] **Step 4: Paletten implementieren**

`colitis-app/src/theme/palettes.ts`:
```ts
import type { ThemeColors, ThemeId } from './types';

export const lightColors: ThemeColors = {
  background: '#FBF6EF',
  surface: '#FFFFFF',
  textPrimary: '#2E2A26',
  textSecondary: '#6B6259',
  primary: '#5B8C7B',
  accent: '#D98E4A',
  danger: '#B5533C',
  success: '#5B8C7B',
  border: '#E4DACB',
  overlay: 'rgba(46, 42, 38, 0.4)',
};

export const darkColors: ThemeColors = {
  background: '#1C1A17',
  surface: '#262320',
  textPrimary: '#F3EDE4',
  textSecondary: '#B8AFA3',
  primary: '#7BAF9C',
  accent: '#E3A768',
  danger: '#E07A5F',
  success: '#7BAF9C',
  border: '#3A362F',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const lightBlueColors: ThemeColors = {
  background: '#F3F7FB',
  surface: '#FFFFFF',
  textPrimary: '#1D2B36',
  textSecondary: '#5B6B78',
  primary: '#3E7CB1',
  accent: '#D98E4A',
  danger: '#C1443A',
  success: '#3E7CB1',
  border: '#D7E3ED',
  overlay: 'rgba(29, 43, 54, 0.4)',
};

export const palettes: Record<ThemeId, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
  'light-blue': lightBlueColors,
};
```

- [ ] **Step 5: Test ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/theme/palettes.test.ts`
Expected: PASS (4 Tests: 3x pro Theme + 1x Key-Konsistenz)

- [ ] **Step 6: Commit**

```bash
git add colitis-app/src/theme/types.ts colitis-app/src/theme/palettes.ts colitis-app/src/theme/palettes.test.ts
git commit -m "feat: Theme-Paletten fuer Hell, Dunkel und Blau-Weiss anlegen"
```

---

### Task 3: `tokens.ts` bereinigen

**Files:**
- Modify: `colitis-app/src/styles/tokens.ts`
- Modify: `colitis-app/src/styles/tokens.test.ts`

**Interfaces:**
- Consumes: keine.
- Produces: `tokens = { spacing, typography, radius }` (ohne `colors`).

- [ ] **Step 1: `colors` aus `tokens.ts` entfernen**

`colitis-app/src/styles/tokens.ts` — komplette neue Fassung:
```ts
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

const typography = {
  fontSize: {
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 36,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    bold: '700',
  },
} as const;

const radius = {
  sm: 8,
  md: 12,
  pill: 20,
} as const;

export const tokens = { spacing, typography, radius } as const;
```

- [ ] **Step 2: `tokens.test.ts` anpassen (Farbtests entfernen, jetzt in `palettes.test.ts` abgedeckt)**

`colitis-app/src/styles/tokens.test.ts` — komplette neue Fassung:
```ts
import { describe, it, expect } from 'vitest';
import { tokens } from './tokens';

describe('design tokens', () => {
  it('defines a strictly increasing spacing scale', () => {
    const values = Object.values(tokens.spacing);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('defines a strictly increasing font size scale', () => {
    const values = Object.values(tokens.typography.fontSize);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});
```

- [ ] **Step 3: Test ausführen**

Run: `cd colitis-app && npx vitest run src/styles/tokens.test.ts`
Expected: PASS (2 Tests). Andere Tests/Dateien, die noch `tokens.colors` referenzieren, schlagen jetzt bei `tsc` fehl — das ist erwartet, wird in den folgenden Tasks behoben.

- [ ] **Step 4: Commit**

```bash
git add colitis-app/src/styles/tokens.ts colitis-app/src/styles/tokens.test.ts
git commit -m "refactor: Farben aus tokens.ts entfernen, leben jetzt in theme/palettes.ts"
```

---

### Task 4: Einstellungen-Persistenz-Modul (TDD)

**Files:**
- Create: `colitis-app/src/features/settings/settingsStorage.ts`
- Test: `colitis-app/src/features/settings/settingsStorage.test.ts`
- Modify: `colitis-app/package.json` (neue Abhängigkeit)

**Interfaces:**
- Consumes: `ThemeId` aus `../../theme/types`.
- Produces: `getThemeId(): Promise<ThemeId>`, `setThemeId(themeId: ThemeId): Promise<void>`, `getDailyJokeEnabled(): Promise<boolean>`, `setDailyJokeEnabled(enabled: boolean): Promise<void>`, `getIncludeIllnessJokes(): Promise<boolean>`, `setIncludeIllnessJokes(enabled: boolean): Promise<void>`.

- [ ] **Step 1: Abhängigkeit installieren**

Run: `cd colitis-app && npx expo install @react-native-async-storage/async-storage`
Expected: Paket wird zu `package.json`/`package-lock.json` hinzugefügt.

- [ ] **Step 2: Failing test schreiben**

`colitis-app/src/features/settings/settingsStorage.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const storeMock = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storeMock.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storeMock.set(key, value);
      return Promise.resolve();
    }),
  },
}));

import {
  getThemeId,
  setThemeId,
  getDailyJokeEnabled,
  setDailyJokeEnabled,
  getIncludeIllnessJokes,
  setIncludeIllnessJokes,
} from './settingsStorage';

beforeEach(() => {
  storeMock.clear();
  vi.clearAllMocks();
});

describe('getThemeId', () => {
  it('returns "light" when nothing is stored', async () => {
    expect(await getThemeId()).toBe('light');
  });

  it('returns the persisted theme after setThemeId', async () => {
    await setThemeId('dark');
    expect(await getThemeId()).toBe('dark');
  });

  it('falls back to "light" for an invalid stored value', async () => {
    storeMock.set('colitis2go.settings.themeId', 'not-a-real-theme');
    expect(await getThemeId()).toBe('light');
  });
});

describe('daily joke settings', () => {
  it('defaults dailyJokeEnabled to false', async () => {
    expect(await getDailyJokeEnabled()).toBe(false);
  });

  it('persists dailyJokeEnabled', async () => {
    await setDailyJokeEnabled(true);
    expect(await getDailyJokeEnabled()).toBe(true);
  });

  it('defaults includeIllnessJokes to false', async () => {
    expect(await getIncludeIllnessJokes()).toBe(false);
  });

  it('persists includeIllnessJokes independently from dailyJokeEnabled', async () => {
    await setDailyJokeEnabled(true);
    await setIncludeIllnessJokes(true);
    expect(await getDailyJokeEnabled()).toBe(true);
    expect(await getIncludeIllnessJokes()).toBe(true);
  });
});
```

- [ ] **Step 3: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/settings/settingsStorage.test.ts`
Expected: FAIL — `Cannot find module './settingsStorage'`

- [ ] **Step 4: Implementieren**

`colitis-app/src/features/settings/settingsStorage.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeId } from '../../theme/types';

const THEME_STORAGE_KEY = 'colitis2go.settings.themeId';
const DAILY_JOKE_ENABLED_KEY = 'colitis2go.settings.dailyJokeEnabled';
const INCLUDE_ILLNESS_JOKES_KEY = 'colitis2go.settings.includeIllnessJokes';

const VALID_THEME_IDS: ThemeId[] = ['light', 'dark', 'light-blue'];

function isThemeId(value: string | null): value is ThemeId {
  return VALID_THEME_IDS.includes(value as ThemeId);
}

export async function getThemeId(): Promise<ThemeId> {
  const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
  return isThemeId(stored) ? stored : 'light';
}

export async function setThemeId(themeId: ThemeId): Promise<void> {
  await AsyncStorage.setItem(THEME_STORAGE_KEY, themeId);
}

export async function getDailyJokeEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(DAILY_JOKE_ENABLED_KEY);
  return stored === 'true';
}

export async function setDailyJokeEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(DAILY_JOKE_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function getIncludeIllnessJokes(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(INCLUDE_ILLNESS_JOKES_KEY);
  return stored === 'true';
}

export async function setIncludeIllnessJokes(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(INCLUDE_ILLNESS_JOKES_KEY, enabled ? 'true' : 'false');
}
```

- [ ] **Step 5: Test ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/settings/settingsStorage.test.ts`
Expected: PASS (7 Tests)

- [ ] **Step 6: Commit**

```bash
git add colitis-app/package.json colitis-app/package-lock.json colitis-app/src/features/settings/settingsStorage.ts colitis-app/src/features/settings/settingsStorage.test.ts
git commit -m "feat: Einstellungen-Persistenz mit AsyncStorage anlegen"
```

---

### Task 5: ThemeContext & `useTheme`-Hook

**Files:**
- Create: `colitis-app/src/theme/ThemeContext.tsx`

**Interfaces:**
- Consumes: `palettes` aus `./palettes`, `ThemeColors`/`ThemeId` aus `./types`, `getThemeId`/`setThemeId` aus `../features/settings/settingsStorage`.
- Produces: `ThemeProvider({ children }: { children: ReactNode })`, `useTheme(): { themeId: ThemeId; colors: ThemeColors; setThemeId: (themeId: ThemeId) => void }`.

- [ ] **Step 1: Implementieren (kein TDD — reiner State-Wrapper ohne eigene Logik, Projekt-Konvention: UI/Context ungetestet)**

`colitis-app/src/theme/ThemeContext.tsx`:
```tsx
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
```

- [ ] **Step 2: Verifikation**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: keine neuen Fehler durch diese Datei (bestehende Fehler wegen noch nicht migrierter `tokens.colors`-Stellen sind in diesem Stadium erwartet).

- [ ] **Step 3: Commit**

```bash
git add colitis-app/src/theme/ThemeContext.tsx
git commit -m "feat: ThemeContext und useTheme-Hook anlegen"
```

---

### Task 6: `SliderToggle`-Komponente

**Files:**
- Create: `colitis-app/src/components/SliderToggle.tsx`

**Interfaces:**
- Consumes: `useTheme()` aus `../theme/ThemeContext`.
- Produces: `SliderToggle({ value, onValueChange, accessibilityLabel, disabled? }: SliderToggleProps)`.

- [ ] **Step 1: Implementieren (UI-Komponente, ungetestet per Projekt-Konvention)**

`colitis-app/src/components/SliderToggle.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface SliderToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const THUMB_MARGIN = 3;

export function SliderToggle({ value, onValueChange, accessibilityLabel, disabled = false }: SliderToggleProps) {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: value ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [value, translateX]);

  const thumbTranslateX = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRACK_WIDTH - THUMB_SIZE - THUMB_MARGIN * 2],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.track, { backgroundColor: value ? colors.primary : colors.border }, disabled && styles.disabled]}
    >
      <Animated.View
        style={[styles.thumb, { backgroundColor: colors.surface, transform: [{ translateX: thumbTranslateX }] }]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    padding: THUMB_MARGIN,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
```

- [ ] **Step 2: Verifikation**

Run: `cd colitis-app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add colitis-app/src/components/SliderToggle.tsx
git commit -m "feat: SliderToggle-Komponente im App-Design anlegen"
```

---

### Task 7: Wortwitze-Inhalte & Logik (TDD)

**Files:**
- Create: `colitis-app/src/features/dailyJoke/jokes.ts`
- Create: `colitis-app/src/features/dailyJoke/illnessJokes.ts`
- Create: `colitis-app/src/features/dailyJoke/pickJokeForDate.ts`
- Test: `colitis-app/src/features/dailyJoke/pickJokeForDate.test.ts`
- Create: `colitis-app/src/features/dailyJoke/buildJokePool.ts`
- Test: `colitis-app/src/features/dailyJoke/buildJokePool.test.ts`

**Interfaces:**
- Produces: `jokes: string[]`, `illnessJokes: string[]`, `pickJokeForDate(date: Date, jokes: readonly string[]): string`, `buildJokePool(includeIllnessJokes: boolean): string[]`.

- [ ] **Step 1: Witz-Listen anlegen**

`colitis-app/src/features/dailyJoke/jokes.ts`:
```ts
export const jokes: string[] = [
  'Was macht ein Keks unter einem Baum? Krümel.',
  'Wie nennt man einen Boomerang, der nicht zurückkommt? Einen Stock.',
  'Warum können Geister so schlecht lügen? Man sieht durch sie hindurch.',
  'Was ist grün und steht vor der Tür? Ein Klopfsalat.',
  'Warum weinen Bienen? Weil ihre Mutter Wespe ist.',
  'Was sitzt auf einer Tanne und ärgert sich? Ein Kuckuck, der keine Uhr findet.',
  'Wie nennt man einen Bumerang, der zurückkommt, obwohl man ihn nicht geworfen hat? Stock.',
  'Was ist orange und läuft durch den Wald? Eine Wanderine.',
  'Zwei Kekse fallen in eine Fritteuse. Sagt der eine: „Heiß hier, oder?“',
  'Was ist braun, klebrig und läuft durch die Wüste? Ein Karamel.',
  'Wie nennt man einen Pinguin in der Wüste? Verirrt.',
  'Was sagt eine Kuh, wenn sie schweigt? Nichts, Muuh.',
  'Warum tragen Fische keine Wasserstoffbomben? Zu schwer.',
  'Was ist weiß und stört beim Skifahren? Eine Lawine.',
  'Wie heißt der Nachbar von Herrn Igel? Herr Nachbarhecke.',
  'Treffen sich zwei Jäger. Beide tot.',
  'Was macht ein Clown im Büro? Faxen.',
  'Wie nennt man einen dicken Vegetarier? Biotonne.',
  'Was ist gelb und kann nicht schwimmen? Ein Bagger.',
  'Kommt ein Pferd in die Bar. Fragt der Barkeeper: „Warum so ein langes Gesicht?“',
  'Warum gehen Skelette nicht gerne auf Partys? Sie haben keinen Körper zum Tanzen.',
  'Was sagt der Elektriker zu seiner Frau? Ich liebe dich unendlich, aber lass uns kurz erden.',
  'Was ist rot und schlecht für die Zähne? Ein Backstein.',
  'Wie nennt man einen Bauern ohne Traktor? Zu Fuß gehend, denke ich.',
  'Warum können Frösche jederzeit sterben? Sie kroaken einfach ab.',
  'Was liegt auf dem Meeresgrund und zittert? Ein Nervenwrack.',
  'Wie heißt der beste Tänzer unter den Fischen? Michael Flunder.',
  'Was ist klein, grün und lässt sich nicht verjagen? Eine hartnäckige Erbse.',
  'Warum ging der Mathematiker nicht in den Wald? Zu viele Wurzeln.',
  'Was sagt ein Buchstabe zum anderen? Wir sehen uns im Alphabet.',
  'Wie nennt man einen Kaktus in der Wüste? Unauffällig.',
  'Was ist grau, hat vier Beine und einen Rüssel? Eine Maus auf Dienstreise nach Afrika.',
  'Warum hat der Bäcker keine Zeit? Er hat alle Hände voll Teig.',
  'Was sagt ein Vulkan zum anderen? Ich hab dich zum Fressen gern.',
  'Wie nennt man ein Croissant in Frankreich? Ganz normal.',
  'Was ist schwarz-weiß und liest gern Zeitung? Ein Zebra in der U-Bahn.',
  'Warum sind Kalender so beliebt? Sie haben immer ein Datum.',
  'Was ist der Unterschied zwischen einem Fisch und einem Klavier? Man kann keinen Fisch stimmen.',
  'Wie nennt man einen Bumerang, der nicht funktioniert? Einen sehr geraden Stock.',
  'Was sagt der Blinddarm zum Gehirn? Wart mal, ich hab da noch was im Sinn.',
];
```

`colitis-app/src/features/dailyJoke/illnessJokes.ts`:
```ts
export const illnessJokes: string[] = [
  'Warum ging der Darm zur Paartherapie? Zu viele Verdauungsprobleme in der Beziehung.',
  'Was sagt der Gastroenterologe zum Patienten? Wir kommen der Sache jetzt näher.',
  'Warum nahm der Patient ein Buch mit ins Wartezimmer? Für den Fall einer längeren Sitzung.',
  'Was ist die Lieblingsmusik vom Verdauungstrakt? Darm-bient.',
  'Warum hat der Darm so viele Freunde? Er hört immer aufmerksam zu, was drin passiert.',
  'Was sagt die Kolonoskopie zum Patienten? Ich schau nur kurz vorbei.',
  'Warum war der Bauch so entspannt? Er hatte gerade eine Verdauungspause eingelegt.',
  'Was ist das Lieblingsspiel im Wartezimmer? Wer zuerst aufgerufen wird, gewinnt.',
  'Warum bringt man dem Darm keine schlechten Nachrichten bei? Er nimmt sich ohnehin alles zu Herzen.',
  'Was sagt der Arzt zum gestressten Darm? Entspann dich, das geht vorbei.',
  'Warum hat der Toilettengang Vorfahrt? Weil manche Dinge einfach nicht warten können.',
  'Was ist der Lieblingsort vom Darm im Urlaub? Ganz in der Nähe einer Toilette.',
  'Warum lacht der Bauch so gern? Weil Humor bekanntlich die beste Medizin ist — neben der echten.',
  'Was sagt der Patient zur Krankenschwester? Sie nehmen mir wirklich jede Sorge ab.',
];
```

- [ ] **Step 2: Failing test für `pickJokeForDate` schreiben**

`colitis-app/src/features/dailyJoke/pickJokeForDate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pickJokeForDate } from './pickJokeForDate';

const SAMPLE_JOKES = ['Witz A', 'Witz B', 'Witz C'];

describe('pickJokeForDate', () => {
  it('returns the same joke for the same calendar date', () => {
    const first = pickJokeForDate(new Date(2026, 6, 17, 8, 0), SAMPLE_JOKES);
    const second = pickJokeForDate(new Date(2026, 6, 17, 22, 30), SAMPLE_JOKES);
    expect(first).toBe(second);
  });

  it('returns a joke that is part of the given pool', () => {
    const joke = pickJokeForDate(new Date(2026, 6, 17), SAMPLE_JOKES);
    expect(SAMPLE_JOKES).toContain(joke);
  });

  it('always returns the only joke in a single-element pool', () => {
    expect(pickJokeForDate(new Date(2026, 6, 17), ['Einziger Witz'])).toBe('Einziger Witz');
  });

  it('throws when the pool is empty', () => {
    expect(() => pickJokeForDate(new Date(2026, 6, 17), [])).toThrow('Kein Wortwitz verfügbar.');
  });
});
```

- [ ] **Step 3: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/dailyJoke/pickJokeForDate.test.ts`
Expected: FAIL — `Cannot find module './pickJokeForDate'`

- [ ] **Step 4: `pickJokeForDate` implementieren**

`colitis-app/src/features/dailyJoke/pickJokeForDate.ts`:
```ts
export function pickJokeForDate(date: Date, jokes: readonly string[]): string {
  if (jokes.length === 0) {
    throw new Error('Kein Wortwitz verfügbar.');
  }
  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let hash = 0;
  for (let i = 0; i < dateKey.length; i += 1) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return jokes[hash % jokes.length];
}
```

- [ ] **Step 5: Test ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/dailyJoke/pickJokeForDate.test.ts`
Expected: PASS (4 Tests)

- [ ] **Step 6: Failing test für `buildJokePool` schreiben**

`colitis-app/src/features/dailyJoke/buildJokePool.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildJokePool } from './buildJokePool';
import { jokes } from './jokes';
import { illnessJokes } from './illnessJokes';

describe('buildJokePool', () => {
  it('returns only the general jokes when illness jokes are excluded', () => {
    expect(buildJokePool(false)).toEqual(jokes);
  });

  it('mixes in the illness jokes when included', () => {
    const pool = buildJokePool(true);
    expect(pool).toHaveLength(jokes.length + illnessJokes.length);
    jokes.forEach((joke) => expect(pool).toContain(joke));
    illnessJokes.forEach((joke) => expect(pool).toContain(joke));
  });
});
```

- [ ] **Step 7: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/dailyJoke/buildJokePool.test.ts`
Expected: FAIL — `Cannot find module './buildJokePool'`

- [ ] **Step 8: `buildJokePool` implementieren**

`colitis-app/src/features/dailyJoke/buildJokePool.ts`:
```ts
import { jokes } from './jokes';
import { illnessJokes } from './illnessJokes';

export function buildJokePool(includeIllnessJokes: boolean): string[] {
  return includeIllnessJokes ? [...jokes, ...illnessJokes] : [...jokes];
}
```

- [ ] **Step 9: Test ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/dailyJoke/buildJokePool.test.ts`
Expected: PASS (2 Tests)

- [ ] **Step 10: Commit**

```bash
git add colitis-app/src/features/dailyJoke/jokes.ts colitis-app/src/features/dailyJoke/illnessJokes.ts colitis-app/src/features/dailyJoke/pickJokeForDate.ts colitis-app/src/features/dailyJoke/pickJokeForDate.test.ts colitis-app/src/features/dailyJoke/buildJokePool.ts colitis-app/src/features/dailyJoke/buildJokePool.test.ts
git commit -m "feat: Wortwitz-Inhalte und Auswahl-Logik anlegen"
```

---

### Task 8: `DailyJokeModal`-Komponente

**Files:**
- Create: `colitis-app/src/features/dailyJoke/components/DailyJokeModal.tsx`

**Interfaces:**
- Consumes: `useTheme()` aus `../../../theme/ThemeContext`, `getDailyJokeEnabled`/`getIncludeIllnessJokes` aus `../../settings/settingsStorage`, `buildJokePool` aus `../buildJokePool`, `pickJokeForDate` aus `../pickJokeForDate`, `tokens` aus `../../../styles/tokens`.
- Produces: `DailyJokeModal()` — rendert `null` oder ein `Modal` mit dem Tageswitz.

- [ ] **Step 1: Implementieren (UI-Komponente, ungetestet per Projekt-Konvention)**

`colitis-app/src/features/dailyJoke/components/DailyJokeModal.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { getDailyJokeEnabled, getIncludeIllnessJokes } from '../../settings/settingsStorage';
import { buildJokePool } from '../buildJokePool';
import { pickJokeForDate } from '../pickJokeForDate';
import { tokens } from '../../../styles/tokens';
import type { ThemeColors } from '../../../theme/types';

export function DailyJokeModal() {
  const { colors } = useTheme();
  const [joke, setJoke] = useState<string | null>(null);
  const styles = makeStyles(colors);

  useEffect(() => {
    let isActive = true;
    getDailyJokeEnabled()
      .then(async (enabled) => {
        if (!enabled || !isActive) {
          return;
        }
        const includeIllnessJokes = await getIncludeIllnessJokes();
        const pool = buildJokePool(includeIllnessJokes);
        if (isActive) {
          setJoke(pickJokeForDate(new Date(), pool));
        }
      })
      .catch((error: unknown) => {
        console.error('[DailyJoke] Wortwitz konnte nicht geladen werden:', error);
      });
    return () => {
      isActive = false;
    };
  }, []);

  if (!joke) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => setJoke(null)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Wortwitz des Tages</Text>
          <Text style={styles.joke}>{joke}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Schließen"
            style={styles.closeButton}
            onPress={() => setJoke(null)}
          >
            <Text style={styles.closeButtonText}>Schließen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.overlay,
    },
    card: {
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.lg,
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
    },
    title: {
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.md,
      textAlign: 'center',
      color: colors.textPrimary,
    },
    joke: {
      fontSize: tokens.typography.fontSize.md,
      textAlign: 'center',
      marginBottom: tokens.spacing.lg,
      color: colors.textPrimary,
    },
    closeButton: {
      borderRadius: 8,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    closeButtonText: {
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.surface,
    },
  });
}
```

- [ ] **Step 2: Verifikation**

Run: `cd colitis-app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add colitis-app/src/features/dailyJoke/components/DailyJokeModal.tsx
git commit -m "feat: DailyJokeModal-Komponente anlegen"
```

---

### Task 9: Root-Layout verdrahten

**Files:**
- Modify: `colitis-app/app/_layout.tsx` (komplett, siehe unten)

**Interfaces:**
- Consumes: `ThemeProvider`/`useTheme` aus `../src/theme/ThemeContext`, `DailyJokeModal` aus `../src/features/dailyJoke/components/DailyJokeModal`, `ThemeColors` aus `../src/theme/types`.

- [ ] **Step 1: Datei komplett ersetzen**

`colitis-app/app/_layout.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { createEncryptedDb } from '../src/db/client';
import { resetAppData } from '../src/lib/appReset';
import { LockScreen } from '../src/features/appLock/components/LockScreen';
import { useAppLockGate } from '../src/features/appLock/useAppLockGate';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { DailyJokeModal } from '../src/features/dailyJoke/components/DailyJokeModal';
import * as schema from '../src/db/schema';
import { tokens } from '../src/styles/tokens';
import type { ThemeColors } from '../src/theme/types';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

function RootLayoutInner() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [fontsLoaded, fontError] = useFonts(MaterialCommunityIcons.font);
  const [db, setDb] = useState<ExpoSQLiteDatabase<typeof schema> | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [dbGeneration, setDbGeneration] = useState(0);

  useEffect(() => {
    let isMounted = true;
    createEncryptedDb()
      .then((createdDb) => {
        if (isMounted) {
          setDb(createdDb);
          setInitError(null);
        }
      })
      .catch((error: unknown) => {
        console.error('[DB] Initialisierung fehlgeschlagen:', error);
        if (isMounted) {
          setInitError(error instanceof Error ? error.message : 'Unbekannter Datenbankfehler');
        }
      });
    return () => {
      isMounted = false;
    };
  }, [dbGeneration]);

  async function handleReset() {
    await resetAppData();
    setDb(null);
    setDbGeneration((generation) => generation + 1);
  }

  if (fontError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Fehler beim Laden der Symbole: {fontError.message}</Text>
      </View>
    );
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Wird vorbereitet …</Text>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Fehler beim Öffnen der Datenbank: {initError}</Text>
      </View>
    );
  }

  if (!db) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Datenbank wird geladen …</Text>
      </View>
    );
  }

  return <MigratedLayout db={db} onReset={handleReset} />;
}

function MigratedLayout({
  db,
  onReset,
}: {
  db: ExpoSQLiteDatabase<typeof schema>;
  onReset: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { success, error } = useMigrations(db, migrations);
  const { isResolved, isLockRequired, unlock } = useAppLockGate();

  if (error) {
    console.error('[DB] Migration fehlgeschlagen:', error);
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Datenbank-Migration fehlgeschlagen: {error.message}</Text>
      </View>
    );
  }

  if (!success || !isResolved) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Datenbank wird vorbereitet …</Text>
      </View>
    );
  }

  if (isLockRequired) {
    return <LockScreen onUnlock={unlock} onReset={onReset} />;
  }

  return (
    <>
      <DailyJokeModal />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    text: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
  });
}
```

- [ ] **Step 2: Verifikation**

Run: `cd colitis-app && npx tsc --noEmit` und `grep -n "tokens.colors" colitis-app/app/_layout.tsx` (kein Treffer mehr, vorher 2).

- [ ] **Step 3: Commit**

```bash
git add colitis-app/app/_layout.tsx
git commit -m "feat: ThemeProvider und DailyJokeModal im Root-Layout verdrahten"
```

---

### Task 10: Einstellungen-Screen umbauen

**Files:**
- Modify: `colitis-app/app/(tabs)/einstellungen/index.tsx` (komplett)

**Interfaces:**
- Consumes: `useTheme()` aus `../../../src/theme/ThemeContext`, `SliderToggle` aus `../../../src/components/SliderToggle`, `getDailyJokeEnabled`/`setDailyJokeEnabled`/`getIncludeIllnessJokes`/`setIncludeIllnessJokes` aus `../../../src/features/settings/settingsStorage`, `ThemeId`/`ThemeColors` aus `../../../src/theme/types`.

- [ ] **Step 1: Neue Sektion "Darstellung" + Wortwitz-Schalter ergänzen, App-Sperre-Switch durch SliderToggle ersetzen, restliche Farben migrieren**

Diff-Beschreibung gegenüber der aktuellen Datei (vollständiger Inhalt unten):

1. Neue Imports: `useTheme`, `SliderToggle`, `ThemeId`, `ThemeColors`, `getDailyJokeEnabled`, `setDailyJokeEnabled`, `getIncludeIllnessJokes`, `setIncludeIllnessJokes`.
2. Neuer State: `themeId`/`colors`/`setThemeId` aus `useTheme()`; `dailyJokeEnabled`, `includeIllnessJokes` (lokaler State, in `useFocusEffect` geladen wie `isLockEnabled`).
3. Neue Handler: `handleSelectTheme(nextThemeId: ThemeId)` ruft `setThemeId` aus dem Context auf. `handleToggleDailyJoke(value: boolean)` und `handleToggleIllnessJokes(value: boolean)` persistieren via `settingsStorage` und aktualisieren lokalen State.
4. JSX: neue Sektion "Darstellung" (3 Pressable-Karten für Hell/Dunkel/Blau-Weiß, aktives Theme farblich hervorgehoben via `colors.primary`-Rahmen) ganz oben, vor "App-Sperre". Der bestehende `<Switch value={isLockEnabled} onValueChange={handleToggleLock} />` wird durch `<SliderToggle value={isLockEnabled} onValueChange={handleToggleLock} accessibilityLabel="PIN-/Biometrie-Sperre aktivieren" />` ersetzt. Neue Sektion "Wortwitze" mit zwei Zeilen: Master-Schalter (`SliderToggle`) und abhängiger Schalter "Auch krankheitsbedingte Witze" (`SliderToggle` mit `disabled={!dailyJokeEnabled}`).
5. `styles` wird zu `makeStyles(colors: ThemeColors)`, alle `tokens.colors.X` → `colors.X` (17 Vorkommen), der `Switch`-Import aus `react-native` entfällt.

Vollständige neue Datei `colitis-app/app/(tabs)/einstellungen/index.tsx`:
```tsx
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import * as Crypto from 'expo-crypto';
import { createEncryptedDb } from '../../../src/db/client';
import { isAppLockEnabled, setPin, disableAppLock } from '../../../src/features/appLock/pinAuth';
import { isValidPinFormat, PIN_LENGTH } from '../../../src/features/appLock/pinFormLogic';
import { exportBackupData, importBackupData } from '../../../src/features/backup/db/backupRepository';
import { serializeBackupData, parseBackupData } from '../../../src/features/backup/backupSerializer';
import {
  deriveKeyFromPassword,
  encryptWithKey,
  decryptWithKey,
  bytesToHex,
  hexToBytes,
  PBKDF2_SALT_LENGTH_BYTES,
  GCM_NONCE_LENGTH_BYTES,
} from '../../../src/features/backup/backupCrypto';
import { writeAndShareBackup, pickBackupFileContent } from '../../../src/features/backup/backupFileService';
import { BackupPasswordForm } from '../../../src/features/backup/components/BackupPasswordForm';
import { rescheduleAllReminders } from '../../../src/features/backup/rescheduleReminders';
import { BACKUP_FORMAT_VERSION, type BackupData, type BackupEnvelope } from '../../../src/features/backup/types';
import { useTheme } from '../../../src/theme/ThemeContext';
import { SliderToggle } from '../../../src/components/SliderToggle';
import {
  getDailyJokeEnabled,
  setDailyJokeEnabled,
  getIncludeIllnessJokes,
  setIncludeIllnessJokes,
} from '../../../src/features/settings/settingsStorage';
import { tokens } from '../../../src/styles/tokens';
import type { ThemeId, ThemeColors } from '../../../src/theme/types';

type BackupFormMode = 'export' | 'import' | null;

const THEME_OPTIONS: { id: ThemeId; label: string }[] = [
  { id: 'light', label: 'Hell' },
  { id: 'dark', label: 'Dunkel' },
  { id: 'light-blue', label: 'Hell (Blau-Weiß)' },
];

function isBackupEnvelopeShape(value: unknown): value is BackupEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    'version' in candidate &&
    typeof candidate.saltHex === 'string' &&
    typeof candidate.nonceHex === 'string' &&
    typeof candidate.ciphertextHex === 'string'
  );
}

export default function EinstellungenScreen() {
  const { themeId, colors, setThemeId } = useTheme();
  const styles = makeStyles(colors);
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [lockActionError, setLockActionError] = useState<string | null>(null);
  const [backupFormMode, setBackupFormMode] = useState<BackupFormMode>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [pendingImportContent, setPendingImportContent] = useState<string | null>(null);
  const [dailyJokeEnabled, setDailyJokeEnabledState] = useState(false);
  const [includeIllnessJokes, setIncludeIllnessJokesState] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      isAppLockEnabled()
        .then((enabled) => {
          if (isActive) {
            setIsLockEnabled(enabled);
          }
        })
        .catch((error: unknown) => {
          console.error('[Einstellungen] Sperrstatus konnte nicht gelesen werden:', error);
        });
      Promise.all([getDailyJokeEnabled(), getIncludeIllnessJokes()])
        .then(([jokeEnabled, illnessJokes]) => {
          if (isActive) {
            setDailyJokeEnabledState(jokeEnabled);
            setIncludeIllnessJokesState(illnessJokes);
          }
        })
        .catch((error: unknown) => {
          console.error('[Einstellungen] Wortwitz-Einstellungen konnten nicht gelesen werden:', error);
        });
      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleToggleLock(value: boolean) {
    setLockActionError(null);
    if (value) {
      setIsSettingPin(true);
      return;
    }
    try {
      await disableAppLock();
      setIsLockEnabled(false);
    } catch (error: unknown) {
      console.error('[Einstellungen] Sperre konnte nicht deaktiviert werden:', error);
      setLockActionError('Sperre konnte nicht deaktiviert werden. Bitte erneut versuchen.');
    }
  }

  async function handleSetPin() {
    if (!isValidPinFormat(newPin)) {
      setPinError(`Der PIN muss genau ${PIN_LENGTH} Ziffern haben.`);
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Die beiden PINs stimmen nicht überein.');
      return;
    }
    try {
      await setPin(newPin);
      setIsLockEnabled(true);
      setIsSettingPin(false);
      setNewPin('');
      setConfirmPin('');
      setPinError(null);
    } catch (error: unknown) {
      console.error('[Einstellungen] PIN konnte nicht gespeichert werden:', error);
      setPinError('PIN konnte nicht gespeichert werden. Bitte erneut versuchen.');
    }
  }

  async function handleExport(password: string) {
    try {
      const db = await createEncryptedDb();
      const data = await exportBackupData(db);
      const plaintext = serializeBackupData(data);
      const saltBytes = await Crypto.getRandomBytesAsync(PBKDF2_SALT_LENGTH_BYTES);
      const nonceBytes = await Crypto.getRandomBytesAsync(GCM_NONCE_LENGTH_BYTES);
      const key = deriveKeyFromPassword(password, saltBytes);
      const ciphertextBytes = encryptWithKey(new TextEncoder().encode(plaintext), key, nonceBytes);
      const envelope: BackupEnvelope = {
        version: BACKUP_FORMAT_VERSION,
        saltHex: bytesToHex(saltBytes),
        nonceHex: bytesToHex(nonceBytes),
        ciphertextHex: bytesToHex(ciphertextBytes),
      };
      await writeAndShareBackup(JSON.stringify(envelope));
      setBackupFormMode(null);
      setBackupMessage(null);
    } catch (error: unknown) {
      console.error('[Einstellungen] Backup-Export fehlgeschlagen:', error);
      setBackupMessage(error instanceof Error ? error.message : 'Backup konnte nicht erstellt werden.');
    }
  }

  async function handlePickImportFile() {
    try {
      const content = await pickBackupFileContent();
      if (content === null) {
        return;
      }
      setPendingImportContent(content);
      setBackupFormMode('import');
      setBackupMessage(null);
    } catch (error: unknown) {
      console.error('[Einstellungen] Sicherungsdatei konnte nicht gelesen werden:', error);
      setBackupMessage('Sicherungsdatei konnte nicht gelesen werden.');
    }
  }

  async function handleImport(password: string) {
    if (!pendingImportContent) {
      return;
    }

    let parsedEnvelope: unknown;
    try {
      parsedEnvelope = JSON.parse(pendingImportContent);
    } catch {
      setBackupMessage('Sicherungsdatei ist kein gültiges Format.');
      return;
    }
    if (!isBackupEnvelopeShape(parsedEnvelope)) {
      setBackupMessage('Sicherungsdatei ist kein gültiges Format.');
      return;
    }
    const envelope = parsedEnvelope;
    if (envelope.version !== BACKUP_FORMAT_VERSION) {
      setBackupMessage('Sicherungsdatei hat eine unbekannte oder nicht unterstützte Version.');
      return;
    }

    let plaintextBytes: Uint8Array;
    try {
      const key = deriveKeyFromPassword(password, hexToBytes(envelope.saltHex));
      plaintextBytes = decryptWithKey(hexToBytes(envelope.ciphertextHex), key, hexToBytes(envelope.nonceHex));
    } catch (error: unknown) {
      console.error('[Einstellungen] Backup-Entschlüsselung fehlgeschlagen:', error);
      setBackupMessage('Falsches Passwort oder beschädigte Sicherungsdatei.');
      return;
    }

    let data: BackupData;
    try {
      data = parseBackupData(new TextDecoder().decode(plaintextBytes));
    } catch (error: unknown) {
      setBackupMessage(error instanceof Error ? error.message : 'Sicherungsdatei ist kein gültiges Format.');
      return;
    }

    Alert.alert('Backup wiederherstellen?', 'Alle vorhandenen Daten werden unwiderruflich ersetzt.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Wiederherstellen',
        style: 'destructive',
        onPress: async () => {
          let db: Awaited<ReturnType<typeof createEncryptedDb>>;
          try {
            db = await createEncryptedDb();
            await importBackupData(db, data);
          } catch (error: unknown) {
            console.error('[Einstellungen] Backup-Import fehlgeschlagen:', error);
            setBackupMessage('Backup konnte nicht wiederhergestellt werden.');
            return;
          }

          setBackupFormMode(null);
          setPendingImportContent(null);

          try {
            await rescheduleAllReminders(db, data);
            setBackupMessage('Backup erfolgreich wiederhergestellt.');
          } catch (error: unknown) {
            console.error('[Einstellungen] Erinnerungen konnten nicht neu geplant werden:', error);
            setBackupMessage('Daten wiederhergestellt. Erinnerungen konnten nicht neu geplant werden.');
          }
        },
      },
    ]);
  }

  async function handleToggleDailyJoke(value: boolean) {
    setDailyJokeEnabledState(value);
    try {
      await setDailyJokeEnabled(value);
    } catch (error: unknown) {
      console.error('[Einstellungen] Wortwitz-Einstellung konnte nicht gespeichert werden:', error);
    }
  }

  async function handleToggleIllnessJokes(value: boolean) {
    setIncludeIllnessJokesState(value);
    try {
      await setIncludeIllnessJokes(value);
    } catch (error: unknown) {
      console.error('[Einstellungen] Wortwitz-Einstellung konnte nicht gespeichert werden:', error);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Darstellung</Text>
      <View style={styles.themeRow}>
        {THEME_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={`Theme ${option.label} auswählen`}
            accessibilityState={{ selected: themeId === option.id }}
            style={[styles.themeCard, themeId === option.id && styles.themeCardActive]}
            onPress={() => setThemeId(option.id)}
          >
            <Text style={[styles.themeCardText, themeId === option.id && styles.themeCardTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>App-Sperre</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>PIN-/Biometrie-Sperre aktivieren</Text>
        <SliderToggle
          value={isLockEnabled}
          onValueChange={handleToggleLock}
          accessibilityLabel="PIN-/Biometrie-Sperre aktivieren"
        />
      </View>
      {lockActionError && <Text style={styles.error}>{lockActionError}</Text>}

      {isSettingPin && (
        <View style={styles.card}>
          <Text style={styles.label}>Neuer PIN ({PIN_LENGTH} Ziffern)</Text>
          <TextInput
            style={styles.textInput}
            placeholderTextColor={colors.textSecondary}
            value={newPin}
            onChangeText={(text) => setNewPin(text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={PIN_LENGTH}
          />
          <Text style={styles.label}>PIN bestätigen</Text>
          <TextInput
            style={styles.textInput}
            placeholderTextColor={colors.textSecondary}
            value={confirmPin}
            onChangeText={(text) => setConfirmPin(text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={PIN_LENGTH}
          />
          {pinError && <Text style={styles.error}>{pinError}</Text>}
          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abbrechen"
              style={styles.cancelButton}
              onPress={() => {
                setIsSettingPin(false);
                setNewPin('');
                setConfirmPin('');
                setPinError(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="PIN speichern"
              style={styles.submitButton}
              onPress={handleSetPin}
            >
              <Text style={styles.submitButtonText}>PIN speichern</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Wortwitze</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Wortwitze des Tages</Text>
        <SliderToggle
          value={dailyJokeEnabled}
          onValueChange={handleToggleDailyJoke}
          accessibilityLabel="Wortwitze des Tages aktivieren"
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Auch krankheitsbedingte Witze</Text>
        <SliderToggle
          value={includeIllnessJokes}
          onValueChange={handleToggleIllnessJokes}
          accessibilityLabel="Auch krankheitsbedingte Witze anzeigen"
          disabled={!dailyJokeEnabled}
        />
      </View>

      <Text style={styles.sectionTitle}>Backup</Text>
      {backupMessage && <Text style={styles.backupMessage}>{backupMessage}</Text>}

      {backupFormMode === 'export' && (
        <BackupPasswordForm
          requireConfirmation
          submitLabel="Backup erstellen"
          onSubmit={handleExport}
          onCancel={() => setBackupFormMode(null)}
        />
      )}

      {backupFormMode === 'import' && (
        <BackupPasswordForm
          requireConfirmation={false}
          submitLabel="Wiederherstellen"
          onSubmit={handleImport}
          onCancel={() => {
            setBackupFormMode(null);
            setPendingImportContent(null);
          }}
        />
      )}

      {backupFormMode === null && (
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Backup erstellen"
            style={styles.submitButton}
            onPress={() => {
              setBackupMessage(null);
              setBackupFormMode('export');
            }}
          >
            <Text style={styles.submitButtonText}>Backup erstellen</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Backup wiederherstellen"
            style={styles.cancelButton}
            onPress={handlePickImportFile}
          >
            <Text style={styles.cancelButtonText}>Backup wiederherstellen</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: tokens.spacing.lg,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      marginTop: tokens.spacing.lg,
      marginBottom: tokens.spacing.sm,
    },
    themeRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
    },
    themeCard: {
      flex: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    themeCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    themeCardText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
    themeCardTextActive: {
      color: colors.primary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: tokens.spacing.sm,
    },
    rowLabel: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
    card: {
      padding: tokens.spacing.md,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: tokens.spacing.sm,
    },
    label: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.medium,
      marginBottom: tokens.spacing.xs,
      marginTop: tokens.spacing.sm,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: tokens.spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      marginBottom: tokens.spacing.sm,
    },
    error: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
    backupMessage: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
    },
    cancelButton: {
      flex: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
    submitButton: {
      flex: 1,
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    submitButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
```

- [ ] **Step 2: Verifikation**

Run: `cd colitis-app && npx tsc --noEmit` und `grep -n "tokens.colors" "colitis-app/app/(tabs)/einstellungen/index.tsx"` (kein Treffer mehr, vorher 17).

- [ ] **Step 3: Commit**

```bash
git add "colitis-app/app/(tabs)/einstellungen/index.tsx"
git commit -m "feat: Einstellungen-Screen um Theme-Auswahl und Wortwitz-Schalter erweitern"
```

---

### Task 11: Navigation & Tab-Layouts migrieren

**Files:**
- Modify: `colitis-app/app/(tabs)/_layout.tsx` (2 Vorkommen)
- Modify: `colitis-app/app/(tabs)/tagebuch/_layout.tsx` (2 Vorkommen)
- Modify: `colitis-app/app/(tabs)/medikamente/_layout.tsx` (2 Vorkommen)
- Modify: `colitis-app/app/(tabs)/wissen/_layout.tsx` (2 Vorkommen)

**Interfaces:**
- Consumes: Migrations-Rezept (siehe oben).

- [ ] **Step 1: `app/(tabs)/_layout.tsx` migrieren (vollständiges Beispiel)**

Vorher/Nachher — komplette neue Datei:
```tsx
import { Tabs } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../src/theme/ThemeContext';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="tagebuch/index"
        options={{
          title: 'Tagebuch',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="notebook-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wissen/index"
        options={{
          title: 'Wissen',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="book-open-page-variant-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="medikamente/index"
        options={{
          title: 'Medikamente',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="pill" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="toiletten/index"
        options={{
          title: 'Toiletten',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="toilet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="einstellungen/index"
        options={{
          title: 'Einstellungen',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
```
Hinweis: Diese Datei hatte kein `StyleSheet.create` — hier entfällt Schritt 3 des Rezepts, nur Schritt 1, 2 (als Hook direkt in der Komponente) und 4 gelten.

- [ ] **Step 2: `app/(tabs)/tagebuch/_layout.tsx`, `app/(tabs)/medikamente/_layout.tsx`, `app/(tabs)/wissen/_layout.tsx` lesen und nach Rezept migrieren**

Jede Datei öffnen, die 2 Vorkommen von `tokens.colors` identifizieren und nach dem Migrations-Rezept ersetzen (gleiches Muster wie oben, falls sie ebenfalls Tab-/Stack-Optionen mit Farben setzen, oder `StyleSheet.create`, falls sie Layout-Wrapper mit eigenen Styles sind — je nach tatsächlichem Dateiinhalt Schritt 3 des Rezepts anwenden oder direkt in `screenOptions` ersetzen).

- [ ] **Step 3: Verifikation**

Run: `cd colitis-app && npx tsc --noEmit`
Run: `grep -rn "tokens.colors" "colitis-app/app/(tabs)/_layout.tsx" "colitis-app/app/(tabs)/tagebuch/_layout.tsx" "colitis-app/app/(tabs)/medikamente/_layout.tsx" "colitis-app/app/(tabs)/wissen/_layout.tsx"`
Expected: keine Treffer (vorher 2+2+2+2 = 8).

- [ ] **Step 4: Commit**

```bash
git add "colitis-app/app/(tabs)/_layout.tsx" "colitis-app/app/(tabs)/tagebuch/_layout.tsx" "colitis-app/app/(tabs)/medikamente/_layout.tsx" "colitis-app/app/(tabs)/wissen/_layout.tsx"
git commit -m "refactor: Tab- und Stack-Layouts auf Theme-Farben umstellen"
```

---

### Task 12: Tagebuch-Bereich migrieren

**Files:**
- Modify: `colitis-app/app/(tabs)/tagebuch/index.tsx` (13 Vorkommen)
- Modify: `colitis-app/app/(tabs)/tagebuch/auswertung.tsx` (5 Vorkommen)
- Modify: `colitis-app/app/(tabs)/tagebuch/neu.tsx` (4 Vorkommen)
- Modify: `colitis-app/src/features/diary/components/DiaryHistoryList.tsx` (11 Vorkommen)
- Modify: `colitis-app/src/features/diary/components/DiaryEntryForm.tsx` (19 Vorkommen)
- Modify: `colitis-app/src/features/diary/components/TriggerAnalysisView.tsx` (6 Vorkommen)

**Interfaces:**
- Consumes: Migrations-Rezept (siehe oben).

- [ ] **Step 1: `app/(tabs)/tagebuch/index.tsx` migrieren (vollständiges Beispiel)**

Komplette neue Datei:
```tsx
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { listDiaryEntries, deleteDiaryEntry } from '../../../src/features/diary/db/diaryRepository';
import { exportDiaryEntriesAsPdf } from '../../../src/features/diary/diaryPdfExport';
import { DiaryHistoryList } from '../../../src/features/diary/components/DiaryHistoryList';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { DiaryEntryWithTriggers } from '../../../src/features/diary/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function TagebuchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [entries, setEntries] = useState<DiaryEntryWithTriggers[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then((db) => listDiaryEntries(db))
        .then((loadedEntries) => {
          if (isActive) {
            setEntries(loadedEntries);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Tagebuch] Laden der Einträge fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Einträge konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  function handleDelete(entryId: number) {
    Alert.alert('Eintrag löschen?', 'Dieser Tagebucheintrag wird endgültig gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => void confirmDelete(entryId),
      },
    ]);
  }

  async function confirmDelete(entryId: number) {
    try {
      const db = await createEncryptedDb();
      await deleteDiaryEntry(db, entryId);
      setEntries(await listDiaryEntries(db));
      setError(null);
    } catch (deleteError: unknown) {
      console.error('[Tagebuch] Löschen fehlgeschlagen:', deleteError);
      setError('Eintrag konnte nicht gelöscht werden.');
    }
  }

  async function handleExportPdf() {
    setIsExporting(true);
    try {
      await exportDiaryEntriesAsPdf(entries);
      setError(null);
    } catch (exportError: unknown) {
      console.error('[Tagebuch] PDF-Export fehlgeschlagen:', exportError);
      setError('PDF-Export fehlgeschlagen.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Muster-Auswertung ansehen"
        style={styles.analysisLink}
        onPress={() => router.push('/tagebuch/auswertung')}
      >
        <Text style={styles.analysisLinkText}>Muster-Auswertung ansehen →</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isExporting || entries.length === 0 }}
        accessibilityLabel="Tagebuch als PDF exportieren"
        disabled={isExporting || entries.length === 0}
        style={[styles.exportLink, (isExporting || entries.length === 0) && styles.exportLinkDisabled]}
        onPress={handleExportPdf}
      >
        <Text style={styles.exportLinkText}>{isExporting ? 'PDF wird erstellt …' : 'Als PDF exportieren'}</Text>
      </Pressable>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Einträge werden geladen …</Text>
        </View>
      ) : (
        <DiaryHistoryList entries={entries} onDelete={handleDelete} />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Neuen Eintrag anlegen"
        style={styles.addButton}
        onPress={() => router.push('/tagebuch/neu')}
      >
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
    },
    analysisLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
    analysisLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
    exportLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
    exportLinkDisabled: {
      opacity: 0.5,
    },
    exportLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
    },
    addButton: {
      position: 'absolute',
      right: tokens.spacing.lg,
      bottom: tokens.spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
    },
    addButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.xl,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
```

- [ ] **Step 2: Restliche 5 Dateien lesen und nach Rezept migrieren**

`app/(tabs)/tagebuch/auswertung.tsx`, `app/(tabs)/tagebuch/neu.tsx`, `src/features/diary/components/DiaryHistoryList.tsx`, `src/features/diary/components/DiaryEntryForm.tsx`, `src/features/diary/components/TriggerAnalysisView.tsx` — jede Datei öffnen und das Migrations-Rezept anwenden.

- [ ] **Step 3: Verifikation**

Run: `cd colitis-app && npx tsc --noEmit`
Run: `grep -rln "tokens.colors" colitis-app/app/(tabs)/tagebuch colitis-app/src/features/diary/components`
Expected: keine Ausgabe (vorher 58 Vorkommen über 6 Dateien).

- [ ] **Step 4: Commit**

```bash
git add "colitis-app/app/(tabs)/tagebuch" colitis-app/src/features/diary/components
git commit -m "refactor: Tagebuch-Bereich auf Theme-Farben umstellen"
```

---

### Task 13: Medikamente-Bereich migrieren

**Files:**
- Modify: `colitis-app/app/(tabs)/medikamente/index.tsx` (7 Vorkommen)
- Modify: `colitis-app/app/(tabs)/medikamente/neu.tsx` (4 Vorkommen)
- Modify: `colitis-app/app/(tabs)/medikamente/[id].tsx` (5 Vorkommen)
- Modify: `colitis-app/src/features/medications/components/MedicationList.tsx` (16 Vorkommen)
- Modify: `colitis-app/src/features/medications/components/MedicationForm.tsx` (23 Vorkommen)
- Modify: `colitis-app/src/features/medications/components/ScreeningReminderCard.tsx` (15 Vorkommen)

**Interfaces:**
- Consumes: Migrations-Rezept (siehe oben).

- [ ] **Step 1: `app/(tabs)/medikamente/index.tsx` migrieren (vollständiges Beispiel)**

Komplette neue Datei (Änderungen ggü. aktuellem Stand: Import `useTheme` + `ThemeColors`, `const { colors } = useTheme();` im Komponentenkörper, `styles` wird `makeStyles(colors)`, alle 7 `tokens.colors.X` → `colors.X`):
```tsx
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import {
  listMedications,
  logMedicationTaken,
  listMedicationIdsTakenOn,
  deleteMedication,
} from '../../../src/features/medications/db/medicationsRepository';
import { formatLocalDate } from '../../../src/features/medications/medicationStatus';
import {
  getScreeningReminder,
  upsertScreeningReminder,
  setScreeningReminderNotificationId,
} from '../../../src/features/medications/db/screeningRepository';
import {
  configureNotificationHandling,
  requestNotificationPermission,
  cancelScheduledReminder,
  scheduleScreeningReminder,
} from '../../../src/features/medications/notifications/notificationService';
import { buildScreeningReminderContent } from '../../../src/features/medications/notifications/reminderContent';
import { MedicationList } from '../../../src/features/medications/components/MedicationList';
import { ScreeningReminderCard } from '../../../src/features/medications/components/ScreeningReminderCard';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type {
  Medication,
  ScreeningReminder,
  NewScreeningReminderInput,
} from '../../../src/features/medications/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function MedikamenteScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [takenTodayIds, setTakenTodayIds] = useState<Set<number>>(new Set());
  const [screeningReminder, setScreeningReminder] = useState<ScreeningReminder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    configureNotificationHandling();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then(async (db) => {
          const [loadedMedications, loadedScreening, loadedTakenTodayIds] = await Promise.all([
            listMedications(db),
            getScreeningReminder(db),
            listMedicationIdsTakenOn(db, formatLocalDate(new Date())),
          ]);
          if (isActive) {
            setMedications(loadedMedications);
            setScreeningReminder(loadedScreening);
            setTakenTodayIds(new Set(loadedTakenTodayIds));
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Medikamente] Laden fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Medikamente konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleTakenToday(medicationId: number) {
    try {
      const db = await createEncryptedDb();
      await logMedicationTaken(db, medicationId, new Date().toISOString());
      setTakenTodayIds((current) => new Set(current).add(medicationId));
    } catch (takenError: unknown) {
      console.error('[Medikamente] Eintragen der Einnahme fehlgeschlagen:', takenError);
      setError('Einnahme konnte nicht gespeichert werden.');
    }
  }

  function handleEnd(medicationId: number) {
    const medication = medications.find((entry) => entry.id === medicationId);
    if (!medication) {
      return;
    }
    Alert.alert('Medikament beenden?', `„${medication.name}“ wird aus der Liste gelöscht.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Beenden',
        style: 'destructive',
        onPress: () => void confirmEnd(medicationId),
      },
    ]);
  }

  async function confirmEnd(medicationId: number) {
    try {
      const db = await createEncryptedDb();
      const reminderTimes = await deleteMedication(db, medicationId);
      for (const reminderTime of reminderTimes) {
        if (reminderTime.notificationId) {
          await cancelScheduledReminder(reminderTime.notificationId);
        }
      }
      setMedications(await listMedications(db));
      setError(null);
    } catch (endError: unknown) {
      console.error('[Medikamente] Beenden fehlgeschlagen:', endError);
      setError('Medikament konnte nicht beendet werden.');
    }
  }

  async function handleSaveScreeningReminder(input: NewScreeningReminderInput) {
    try {
      const db = await createEncryptedDb();
      const { previous, current } = await upsertScreeningReminder(db, input);

      if (previous?.notificationId) {
        await cancelScheduledReminder(previous.notificationId);
      }

      let notificationId: string | null = null;
      const granted = await requestNotificationPermission();
      if (granted) {
        notificationId = await scheduleScreeningReminder(input.nextDueDate, buildScreeningReminderContent(input));
      }

      await setScreeningReminderNotificationId(db, current.id, notificationId);
      setScreeningReminder({ ...current, notificationId });
      setError(null);
    } catch (saveError: unknown) {
      console.error('[Medikamente] Vorsorge-Reminder speichern fehlgeschlagen:', saveError);
      setError('Vorsorge-Erinnerung konnte nicht gespeichert werden.');
    }
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <ScreeningReminderCard reminder={screeningReminder} onSave={handleSaveScreeningReminder} />
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Medikamente werden geladen …</Text>
        </View>
      ) : (
        <MedicationList
          medications={medications}
          today={new Date()}
          takenTodayIds={takenTodayIds}
          onTakenToday={handleTakenToday}
          onEnd={handleEnd}
          onEdit={(medicationId) => router.push(`/medikamente/${medicationId}`)}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Neues Medikament anlegen"
        style={styles.addButton}
        onPress={() => router.push('/medikamente/neu')}
      >
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
    },
    errorText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm, textAlign: 'center' },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
    },
    addButton: {
      position: 'absolute',
      right: tokens.spacing.lg,
      bottom: tokens.spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
    },
    addButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.xl,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
```

- [ ] **Step 2: Restliche 5 Dateien lesen und nach Rezept migrieren**

`app/(tabs)/medikamente/neu.tsx`, `app/(tabs)/medikamente/[id].tsx`, `src/features/medications/components/MedicationList.tsx`, `src/features/medications/components/MedicationForm.tsx`, `src/features/medications/components/ScreeningReminderCard.tsx` — jede Datei öffnen und das Migrations-Rezept anwenden.

- [ ] **Step 3: Verifikation**

Run: `cd colitis-app && npx tsc --noEmit`
Run: `grep -rln "tokens.colors" "colitis-app/app/(tabs)/medikamente" colitis-app/src/features/medications/components`
Expected: keine Ausgabe (vorher 70 Vorkommen über 6 Dateien).

- [ ] **Step 4: Commit**

```bash
git add "colitis-app/app/(tabs)/medikamente" colitis-app/src/features/medications/components
git commit -m "refactor: Medikamente-Bereich auf Theme-Farben umstellen"
```

---

### Task 14: Toiletten-Bereich migrieren

**Files:**
- Modify: `colitis-app/app/(tabs)/toiletten/index.tsx` (7 Vorkommen)
- Modify: `colitis-app/src/features/toilets/components/SavedPlaceForm.tsx` (23 Vorkommen)
- Modify: `colitis-app/src/features/toilets/components/ToiletMapView.tsx` (2 Vorkommen)
- Modify: `colitis-app/src/features/toilets/components/SavedPlaceInfoCard.tsx` (11 Vorkommen)
- Modify: `colitis-app/src/features/toilets/components/ToiletInfoCard.tsx` (7 Vorkommen)
- Modify: `colitis-app/src/features/toilets/components/LocationPermissionBanner.tsx` (5 Vorkommen)

**Interfaces:**
- Consumes: Migrations-Rezept (siehe oben).

- [ ] **Step 1: `app/(tabs)/toiletten/index.tsx` migrieren (vollständiges Beispiel)**

Änderungen ggü. aktuellem Stand: Import `useTheme` (ersetzt `tokens`-only-Nutzung für Farben) + `ThemeColors`, `const { colors } = useTheme();` im Komponentenkörper direkt nach den bestehenden `useState`-Aufrufen, `const styles = makeStyles(colors);`, `styles`-Definition wird zu `function makeStyles(colors: ThemeColors) { return StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background }, errorBanner: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.danger, padding: tokens.spacing.sm }, errorText: { color: colors.danger, fontSize: tokens.typography.fontSize.sm, textAlign: 'center' }, offlineBanner: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, padding: tokens.spacing.sm }, offlineText: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.sm, textAlign: 'center' } }); }` (die restliche Logik der Datei — Standortabfrage, Handler, JSX — bleibt exakt wie im bestehenden Code unverändert, nur die Style-Definition und der neue Hook-Aufruf werden ergänzt).

- [ ] **Step 2: Restliche 5 Dateien lesen und nach Rezept migrieren**

`src/features/toilets/components/SavedPlaceForm.tsx`, `src/features/toilets/components/ToiletMapView.tsx`, `src/features/toilets/components/SavedPlaceInfoCard.tsx`, `src/features/toilets/components/ToiletInfoCard.tsx`, `src/features/toilets/components/LocationPermissionBanner.tsx` — jede Datei öffnen und das Migrations-Rezept anwenden.

- [ ] **Step 3: Verifikation**

Run: `cd colitis-app && npx tsc --noEmit`
Run: `grep -rln "tokens.colors" "colitis-app/app/(tabs)/toiletten" colitis-app/src/features/toilets/components`
Expected: keine Ausgabe (vorher 55 Vorkommen über 6 Dateien).

- [ ] **Step 4: Commit**

```bash
git add "colitis-app/app/(tabs)/toiletten" colitis-app/src/features/toilets/components
git commit -m "refactor: Toiletten-Bereich auf Theme-Farben umstellen"
```

---

### Task 15: Wissen & News-Feed migrieren

**Files:**
- Modify: `colitis-app/app/(tabs)/wissen/index.tsx` (12 Vorkommen)
- Modify: `colitis-app/app/(tabs)/wissen/feed.tsx` (8 Vorkommen)
- Modify: `colitis-app/app/(tabs)/wissen/[slug].tsx` (3 Vorkommen)
- Modify: `colitis-app/src/features/newsFeed/components/NewsFeedList.tsx` (9 Vorkommen)
- Modify: `colitis-app/src/features/knowledge/components/KnowledgeArticleList.tsx` (7 Vorkommen)
- Modify: `colitis-app/src/features/knowledge/components/KnowledgeArticleDetail.tsx` (6 Vorkommen)

**Interfaces:**
- Consumes: Migrations-Rezept (siehe oben).

- [ ] **Step 1: `app/(tabs)/wissen/index.tsx` migrieren (vollständiges Beispiel)**

Komplette neue Datei:
```tsx
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { seedKnowledgeArticles, listKnowledgeArticles } from '../../../src/features/knowledge/db/knowledgeRepository';
import { filterKnowledgeArticles } from '../../../src/features/knowledge/search';
import { KnowledgeArticleList } from '../../../src/features/knowledge/components/KnowledgeArticleList';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { KnowledgeArticle } from '../../../src/features/knowledge/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function WissenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then(async (db) => {
          await seedKnowledgeArticles(db);
          return listKnowledgeArticles(db);
        })
        .then((loadedArticles) => {
          if (isActive) {
            setArticles(loadedArticles);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Wissen] Laden der Artikel fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Inhalte konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  const visibleArticles = filterKnowledgeArticles(articles, query);

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Neuigkeiten ansehen"
        style={styles.newsLink}
        onPress={() => router.push('/wissen/feed')}
      >
        <Text style={styles.newsLinkText}>Neuigkeiten ansehen →</Text>
      </Pressable>
      <TextInput
        style={styles.searchInput}
        placeholder="Artikel durchsuchen …"
        placeholderTextColor={colors.textSecondary}
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Wissensartikel durchsuchen"
      />
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Artikel werden geladen …</Text>
        </View>
      ) : (
        <KnowledgeArticleList
          articles={visibleArticles}
          onSelect={(slug) => router.push(`/wissen/${slug}`)}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
    },
    newsLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
    newsLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
    searchInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      margin: tokens.spacing.md,
      padding: tokens.spacing.sm,
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
    },
  });
}
```

- [ ] **Step 2: Restliche 5 Dateien lesen und nach Rezept migrieren**

`app/(tabs)/wissen/feed.tsx`, `app/(tabs)/wissen/[slug].tsx`, `src/features/newsFeed/components/NewsFeedList.tsx`, `src/features/knowledge/components/KnowledgeArticleList.tsx`, `src/features/knowledge/components/KnowledgeArticleDetail.tsx` — jede Datei öffnen und das Migrations-Rezept anwenden.

- [ ] **Step 3: Verifikation**

Run: `cd colitis-app && npx tsc --noEmit`
Run: `grep -rln "tokens.colors" "colitis-app/app/(tabs)/wissen" colitis-app/src/features/newsFeed/components colitis-app/src/features/knowledge/components`
Expected: keine Ausgabe (vorher 45 Vorkommen über 6 Dateien).

- [ ] **Step 4: Commit**

```bash
git add "colitis-app/app/(tabs)/wissen" colitis-app/src/features/newsFeed/components colitis-app/src/features/knowledge/components
git commit -m "refactor: Wissen- und News-Feed-Bereich auf Theme-Farben umstellen"
```

---

### Task 16: Verbleibende geteilte Komponenten migrieren

**Files:**
- Modify: `colitis-app/src/components/ui/NumberStepper.tsx` (6 Vorkommen)
- Modify: `colitis-app/src/features/appLock/components/LockScreen.tsx` (19 Vorkommen, Text bereits in Task 1 umbenannt)
- Modify: `colitis-app/src/features/backup/components/BackupPasswordForm.tsx` (14 Vorkommen)
- Modify: `colitis-app/app/schnellzugriff.tsx` (4 Vorkommen)
- Modify: `colitis-app/app/+not-found.tsx` (3 Vorkommen)

**Interfaces:**
- Consumes: Migrations-Rezept (siehe oben).

- [ ] **Step 1: `src/components/ui/NumberStepper.tsx` migrieren (vollständiges Beispiel)**

Komplette neue Datei:
```tsx
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import type { ThemeColors } from '../../theme/types';

interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}

export function NumberStepper({ label, value, onChange, min = 0, max = 20 }: NumberStepperProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} verringern`}
          disabled={!canDecrement}
          onPress={() => onChange(value - 1)}
          style={[styles.button, !canDecrement && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>−</Text>
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} erhöhen`}
          disabled={!canIncrement}
          onPress={() => onChange(value + 1)}
          style={[styles.button, !canIncrement && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: tokens.spacing.md,
    },
    label: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      marginBottom: tokens.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    button: {
      width: 40,
      height: 40,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: {
      backgroundColor: colors.border,
    },
    buttonText: {
      fontSize: tokens.typography.fontSize.lg,
      color: colors.textPrimary,
    },
    value: {
      minWidth: 40,
      textAlign: 'center',
      fontSize: tokens.typography.fontSize.lg,
      color: colors.textPrimary,
      marginHorizontal: tokens.spacing.sm,
    },
  });
}
```

- [ ] **Step 2: `LockScreen.tsx` migrieren (vollständiges Beispiel — Text-Umbenennung aus Task 1 bleibt erhalten)**

Änderungen ggü. dem in Task 1 umbenannten Stand: Import `useTheme` statt `tokens` für Farben (analog Rezept), `const { colors } = useTheme();` als erste Zeile im Komponentenkörper, `const styles = makeStyles(colors);`, alle drei `placeholderTextColor={tokens.colors.textSecondary}`-Stellen → `colors.textSecondary`, komplette `StyleSheet.create`-Definition wird zu `function makeStyles(colors: ThemeColors) { return StyleSheet.create({ ...gleicher Body, jedes tokens.colors.X -> colors.X... }); }`. Die Business-Logik (PIN-Verifikation, Biometrie, Reset-Flow) bleibt exakt unverändert.

- [ ] **Step 3: Restliche 3 Dateien lesen und nach Rezept migrieren**

`src/features/backup/components/BackupPasswordForm.tsx`, `app/schnellzugriff.tsx`, `app/+not-found.tsx` — jede Datei öffnen und das Migrations-Rezept anwenden.

- [ ] **Step 4: Verifikation**

Run: `cd colitis-app && npx tsc --noEmit`
Run: `grep -rln "tokens.colors" colitis-app/src/components/ui colitis-app/src/features/appLock/components colitis-app/src/features/backup/components colitis-app/app/schnellzugriff.tsx "colitis-app/app/+not-found.tsx"`
Expected: keine Ausgabe (vorher 46 Vorkommen über 5 Dateien).

- [ ] **Step 5: Commit**

```bash
git add colitis-app/src/components/ui colitis-app/src/features/appLock/components colitis-app/src/features/backup/components colitis-app/app/schnellzugriff.tsx "colitis-app/app/+not-found.tsx"
git commit -m "refactor: verbleibende geteilte Komponenten auf Theme-Farben umstellen"
```

---

### Task 17: Abschlussverifikation

**Files:**
- Keine neuen Dateien — reine Verifikation.

**Interfaces:**
- Keine.

- [ ] **Step 1: Vollständige Testsuite ausführen**

Run: `cd colitis-app && npm test`
Expected: alle Tests grün (bestehende Suite + neue Tests aus Task 2, 4, 7).

- [ ] **Step 2: Vollständigen Typecheck ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 3: App-weiten Grep-Check auf verbleibende `tokens.colors`-Referenzen**

Run: `grep -rn "tokens.colors" colitis-app/app colitis-app/src`
Expected: keine Treffer außerhalb von `colitis-app/src/theme/palettes.ts` (dort ist `tokens.colors` gar nicht mehr referenziert — die Palette-Werte sind eigenständig definiert). Bei Treffern: entsprechende Datei wurde in einem vorherigen Task übersehen, nach Rezept nachziehen.

- [ ] **Step 4: Manueller Hinweis für den nächsten EAS-Build**

Kein Codeschritt — Notiz für die Session-Zusammenfassung: Diese Änderungen sind rein clientseitig (kein natives Modul außer der bereits vorhandenen Abhängigkeitsart), sollten aber vor dem nächsten Release-Build einmal auf dem Testgerät durchgeklickt werden (alle 3 Themes, beide Wortwitz-Schalter, SliderToggle-Optik, App-Name auf dem Homescreen).

- [ ] **Step 5: Commit (falls durch Verifikation noch Restarbeiten anfielen)**

```bash
git add -A
git commit -m "chore: Abschlussverifikation Colitis2Go-Umbenennung und Theme-System"
```

(Falls Step 1-3 bereits sauber durchliefen ohne Änderungen, entfällt dieser Commit.)

---

## Self-Review-Notizen (bereits eingearbeitet)

- Spec-Abdeckung geprüft: Umbenennung (Task 1), Theme-Paletten (Task 2-3, 5), Persistenz (Task 4), SliderToggle (Task 6), Wortwitze inkl. krankheitsbezogenem Zusatz-Pool (Task 7-8), Root-Wiring (Task 9), Einstellungen-UI (Task 10), vollständige App-weite Migration (Task 11-16), Abschlussverifikation (Task 17) — alle Spec-Abschnitte sind abgedeckt.
- Typkonsistenz geprüft: `ThemeColors` (Task 2) wird durchgängig in Task 5, 6, 8, 9, 10, 11-16 identisch verwendet; `ThemeId` durchgängig `'light' | 'dark' | 'light-blue'`; `useTheme()`-Rückgabeform `{ themeId, colors, setThemeId }` konsistent in allen Verbrauchern.
- Datei-Zähler geprüft: 4 (Nav) + 6 (Tagebuch) + 6 (Medikamente) + 6 (Toiletten) + 6 (Wissen) + 5 (Shared) + 1 (Root, Task 9) + 1 (Einstellungen, Task 10) = 35 Dateien — entspricht der vollständigen Liste aller `tokens.colors`-Importe im Projekt.
