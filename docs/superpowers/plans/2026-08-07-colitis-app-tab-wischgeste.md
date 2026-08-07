# Wischgeste zum Tab-Wechsel – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auf den fünf Tab-Startseiten wechselt eine Wischgeste vom linken bzw. rechten Bildschirmrand zum Nachbar-Tab; in den Einstellungen lässt sich die Geste abschalten.

**Architecture:** Eine reine Funktion (`tabOrder.ts`) kennt die Tab-Reihenfolge und liefert den Nachbar-Tab. Ein React-Kontext (`SwipeNavigationContext.tsx`) hält den Ein-/Aus-Zustand app-weit, nach dem Vorbild des bestehenden `ThemeContext`. Eine Hüll-Komponente (`SwipeableTabScreen.tsx`) erkennt die Randgeste mit `PanResponder` und navigiert. Die fünf Tab-Startseiten tauschen ihr äußerstes Layout-Element gegen diese Hülle.

**Tech Stack:** TypeScript, React Native 0.86 (`PanResponder` aus dem Kern), Expo Router v57, AsyncStorage, Vitest (bestehendes Projekt-Setup).

## Global Constraints

- **Keine neue Abhängigkeit.** `PanResponder` stammt aus dem React-Native-Kern. `react-native-gesture-handler` darf **nicht** importiert werden: installiert ist 3.0.2 (indirekt über `expo-router`), Expo SDK 57 erwartet für direkte Abhängigkeiten aber `~2.32.0` – ein direkter Import würde einen Versionskonflikt bzw. einen nativen Umbau erzwingen.
- Tab-Reihenfolge, exakt und ausschließlich: `tagebuch`, `wissen`, `medikamente`, `toiletten`, `einstellungen`. Die Bezeichner sind zugleich die Navigationspfade (`/tagebuch` usw.).
- Randstreifen für den Gestenstart: **exakt 25 Pixel** an der jeweiligen Kante.
- Waagerechte Mindeststrecke: **exakt 60 Pixel**, und der Betrag der waagerechten Bewegung muss größer sein als der der senkrechten.
- Ziehen vom **linken** Rand nach rechts → **vorheriger** Tab. Ziehen vom **rechten** Rand nach links → **nächster** Tab. Andere Kombinationen lösen nichts aus.
- Kein Rundlauf: am ersten bzw. letzten Tab passiert nichts – ohne Meldung, ohne Protokolleintrag.
- Nur auf den fünf Tab-Startseiten. Unterseiten verwenden die Hülle nicht.
- **`app/(tabs)/_layout.tsx` darf nicht verändert werden.** Nur `app/_layout.tsx` (eine Ebene darüber) wird um den Kontext-Anbieter ergänzt.
- Voreinstellung des Schalters: **eingeschaltet** (`true`), auch wenn noch nichts gespeichert wurde.
- Speicherschlüssel: `colitis2go.settings.swipeNavigationEnabled`.
- UI-Sprache Deutsch; ausschließlich Farben/Abstände aus dem bestehenden Theme (`useTheme()`/`tokens`), keine hartkodierten Farbwerte.
- React Native lässt sich unter Vitest nicht parsen oder rendern (bestätigte Projekt-Einschränkung). Nur framework-freie Logik wird automatisiert getestet; Komponenten/Screens werden manuell auf dem Gerät geprüft.

---

### Task 1: Tab-Reihenfolge als reine Logik

**Files:**
- Create: `colitis-app/src/navigation/tabOrder.ts`
- Test: `colitis-app/src/navigation/tabOrder.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: `TAB_ORDER` (readonly Tupel der fünf Tab-Namen), Typ `TabName`, Typ `SwipeDirection = 'previous' | 'next'`, `getNeighbourTab(current: string, direction: SwipeDirection): TabName | null`, ``tabPath(tab: TabName): `/${TabName}` ``. Wird von Task 4 (`SwipeableTabScreen`) verwendet.

**Wichtig zum Rückgabetyp von `tabPath`:** Das Projekt hat in `app.json` `"experiments": { "typedRoutes": true }` aktiviert. `router.navigate()` akzeptiert deshalb keinen beliebigen `string`. Der Rückgabetyp muss das genaue Template-Literal `` `/${TabName}` `` sein (also die Vereinigung `'/tagebuch' | '/wissen' | '/medikamente' | '/toiletten' | '/einstellungen'`) – mit `string` schlägt `npx tsc --noEmit` in Task 4 fehl.

- [ ] **Step 1: Write the failing test**

Create `colitis-app/src/navigation/tabOrder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TAB_ORDER, getNeighbourTab, tabPath } from './tabOrder';

describe('TAB_ORDER', () => {
  it('lists the five tabs in tab-bar order', () => {
    expect(TAB_ORDER).toEqual(['tagebuch', 'wissen', 'medikamente', 'toiletten', 'einstellungen']);
  });
});

describe('getNeighbourTab', () => {
  it('returns the following tab for direction "next"', () => {
    expect(getNeighbourTab('tagebuch', 'next')).toBe('wissen');
    expect(getNeighbourTab('medikamente', 'next')).toBe('toiletten');
  });

  it('returns the preceding tab for direction "previous"', () => {
    expect(getNeighbourTab('wissen', 'previous')).toBe('tagebuch');
    expect(getNeighbourTab('einstellungen', 'previous')).toBe('toiletten');
  });

  it('returns null before the first tab', () => {
    expect(getNeighbourTab('tagebuch', 'previous')).toBeNull();
  });

  it('returns null after the last tab', () => {
    expect(getNeighbourTab('einstellungen', 'next')).toBeNull();
  });

  it('returns null for an unknown tab name in either direction', () => {
    expect(getNeighbourTab('gibtesnicht', 'next')).toBeNull();
    expect(getNeighbourTab('gibtesnicht', 'previous')).toBeNull();
  });

  it('returns null for an empty tab name', () => {
    expect(getNeighbourTab('', 'next')).toBeNull();
  });
});

describe('tabPath', () => {
  it('maps a tab name to its route path', () => {
    expect(tabPath('wissen')).toBe('/wissen');
    expect(tabPath('einstellungen')).toBe('/einstellungen');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `colitis-app/`: `npx vitest run src/navigation/tabOrder.test.ts`
Expected: FAIL – `Cannot find module './tabOrder'` (module does not exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `colitis-app/src/navigation/tabOrder.ts`:

```typescript
export const TAB_ORDER = ['tagebuch', 'wissen', 'medikamente', 'toiletten', 'einstellungen'] as const;

export type TabName = (typeof TAB_ORDER)[number];

export type SwipeDirection = 'previous' | 'next';

/**
 * Liefert den Nachbar-Tab in der angegebenen Richtung.
 * Gibt null zurück, wenn kein Nachbar existiert (Anfang/Ende der Reihe)
 * oder der übergebene Name kein bekannter Tab ist.
 */
export function getNeighbourTab(current: string, direction: SwipeDirection): TabName | null {
  const currentIndex = (TAB_ORDER as readonly string[]).indexOf(current);
  if (currentIndex === -1) {
    return null;
  }

  const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
  if (targetIndex < 0 || targetIndex >= TAB_ORDER.length) {
    return null;
  }

  return TAB_ORDER[targetIndex];
}

/**
 * Die Tab-Bezeichner sind zugleich die Navigationspfade.
 * Der genaue Template-Literal-Rückgabetyp ist nötig, weil das Projekt
 * `typedRoutes` aktiviert hat und `router.navigate()` keinen beliebigen
 * string annimmt.
 */
export function tabPath(tab: TabName): `/${TabName}` {
  return `/${tab}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `colitis-app/`: `npx vitest run src/navigation/tabOrder.test.ts`
Expected: PASS (9/9 tests)

- [ ] **Step 5: Commit**

```bash
git add colitis-app/src/navigation/tabOrder.ts colitis-app/src/navigation/tabOrder.test.ts
git commit -m "feat: Tab-Reihenfolge und Nachbar-Ermittlung als reine Logik"
```

---

### Task 2: Einstellung speichern und lesen

**Files:**
- Modify: `colitis-app/src/features/settings/settingsStorage.ts` (am Dateiende anhängen)
- Test: `colitis-app/src/features/settings/settingsStorage.test.ts` (bestehende Datei erweitern)

**Interfaces:**
- Consumes: `AsyncStorage` aus `@react-native-async-storage/async-storage` (in der Datei bereits importiert).
- Produces: `getSwipeNavigationEnabled(): Promise<boolean>` (Voreinstellung `true`, wenn nichts gespeichert ist) und `setSwipeNavigationEnabled(enabled: boolean): Promise<void>`. Wird von Task 3 (`SwipeNavigationContext`) verwendet.

**Achtung:** Die Voreinstellung ist `true` und unterscheidet sich damit vom Muster von `getDailyJokeEnabled`, das ohne gespeicherten Wert `false` liefert. Der Fall „noch nie gesetzt" (`null`) muss deshalb ausdrücklich behandelt werden.

- [ ] **Step 1: Write the failing test**

Append to `colitis-app/src/features/settings/settingsStorage.test.ts`:

Zuerst die beiden neuen Funktionen zur bestehenden Import-Liste am Kopf der Datei hinzufügen (die Liste beginnt mit `import {` und endet mit `} from './settingsStorage';`):

```typescript
  getSwipeNavigationEnabled,
  setSwipeNavigationEnabled,
```

Dann diesen Block ans Dateiende anhängen:

```typescript
describe('swipe navigation setting', () => {
  it('defaults to true when nothing has been stored yet', async () => {
    await expect(getSwipeNavigationEnabled()).resolves.toBe(true);
  });

  it('reads back a stored false value', async () => {
    await setSwipeNavigationEnabled(false);
    await expect(getSwipeNavigationEnabled()).resolves.toBe(false);
  });

  it('reads back a stored true value', async () => {
    await setSwipeNavigationEnabled(false);
    await setSwipeNavigationEnabled(true);
    await expect(getSwipeNavigationEnabled()).resolves.toBe(true);
  });
});
```

Hinweis: Die Testdatei mockt `@react-native-async-storage/async-storage` bereits über eine `Map` und leert diese in einem `beforeEach` (Zeilen 38–41: `storeMock.clear()` und `vi.clearAllMocks()`). Es ist also nichts weiter einzurichten – der Test für die Voreinstellung startet garantiert mit leerem Speicher.

- [ ] **Step 2: Run test to verify it fails**

Run from `colitis-app/`: `npx vitest run src/features/settings/settingsStorage.test.ts`
Expected: FAIL – `getSwipeNavigationEnabled is not a function` bzw. ein Import-Fehler, weil die Funktionen noch nicht existieren

- [ ] **Step 3: Write minimal implementation**

Append to `colitis-app/src/features/settings/settingsStorage.ts`:

```typescript
const SWIPE_NAVIGATION_ENABLED_KEY = 'colitis2go.settings.swipeNavigationEnabled';

/** Voreinstellung: eingeschaltet, solange nichts gespeichert wurde. */
export async function getSwipeNavigationEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(SWIPE_NAVIGATION_ENABLED_KEY);
  if (stored === null) {
    return true;
  }
  return stored === 'true';
}

export async function setSwipeNavigationEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(SWIPE_NAVIGATION_ENABLED_KEY, enabled ? 'true' : 'false');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `colitis-app/`: `npx vitest run src/features/settings/settingsStorage.test.ts`
Expected: PASS (alle bisherigen Tests der Datei plus die 3 neuen)

- [ ] **Step 5: Commit**

```bash
git add colitis-app/src/features/settings/settingsStorage.ts colitis-app/src/features/settings/settingsStorage.test.ts
git commit -m "feat: Einstellung fuer die Tab-Wischgeste speichern und lesen"
```

---

### Task 3: Kontext für den Ein-/Aus-Zustand

**Files:**
- Create: `colitis-app/src/navigation/SwipeNavigationContext.tsx`
- Modify: `colitis-app/app/_layout.tsx` (Zeilen 20–26, die `RootLayout`-Funktion)

**Interfaces:**
- Consumes: `getSwipeNavigationEnabled` / `setSwipeNavigationEnabled` aus Task 2 (`colitis-app/src/features/settings/settingsStorage.ts`).
- Produces: `SwipeNavigationProvider({ children }: { children: ReactNode })` und `useSwipeNavigation(): { swipeEnabled: boolean; setSwipeEnabled: (enabled: boolean) => void }`. Wird von Task 4 (`SwipeableTabScreen`) und Task 6 (Einstellungen-Screen) verwendet.

Kein automatisierter Test für diese Dateien (React/React Native ist unter Vitest nicht ausführbar – siehe Global Constraints). Absicherung über den vollen Testlauf (Regressionsschutz) und den TypeScript-Check.

- [ ] **Step 1: Create the context**

Create `colitis-app/src/navigation/SwipeNavigationContext.tsx`:

```typescript
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
```

- [ ] **Step 2: Mount the provider in the root layout**

In `colitis-app/app/_layout.tsx` den neuen Import bei den übrigen `src/`-Importen ergänzen:

```typescript
import { SwipeNavigationProvider } from '../src/navigation/SwipeNavigationContext';
```

Und die `RootLayout`-Funktion ersetzen. Vorher:

```typescript
export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}
```

Nachher:

```typescript
export default function RootLayout() {
  return (
    <ThemeProvider>
      <SwipeNavigationProvider>
        <RootLayoutInner />
      </SwipeNavigationProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 3: Run the full test suite and TypeScript check**

Run from `colitis-app/`: `npx vitest run`
Expected: PASS (alle bestehenden Tests plus die neuen aus Task 1 und 2, keine Fehler)

Run from `colitis-app/`: `npx tsc --noEmit`
Expected: keine Ausgabe (keine Fehler)

- [ ] **Step 4: Commit**

```bash
git add colitis-app/src/navigation/SwipeNavigationContext.tsx colitis-app/app/_layout.tsx
git commit -m "feat: Kontext fuer den Ein-/Aus-Zustand der Tab-Wischgeste"
```

---

### Task 4: Gesten-Hülle SwipeableTabScreen

**Files:**
- Create: `colitis-app/src/components/SwipeableTabScreen.tsx`

**Interfaces:**
- Consumes: `getNeighbourTab`, `tabPath`, Typ `TabName` (Task 1, `colitis-app/src/navigation/tabOrder.ts`); `useSwipeNavigation` (Task 3, `colitis-app/src/navigation/SwipeNavigationContext.tsx`); `useRouter` aus `expo-router`.
- Produces: `SwipeableTabScreen({ tab, style, children }: { tab: TabName; style?: StyleProp<ViewStyle>; children: ReactNode })`. Wird von Task 5 (die fünf Tab-Startseiten) verwendet.

Kein automatisierter Test (React Native ist unter Vitest nicht ausführbar – siehe Global Constraints). Absicherung über vollen Testlauf und TypeScript-Check; das tatsächliche Wischverhalten wird in Task 6 in die Alltagstest-Checkliste aufgenommen.

- [ ] **Step 1: Implement the component**

Create `colitis-app/src/components/SwipeableTabScreen.tsx`:

```typescript
import { useMemo, useRef, type ReactNode } from 'react';
import {
  PanResponder,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getNeighbourTab, tabPath, type TabName } from '../navigation/tabOrder';
import { useSwipeNavigation } from '../navigation/SwipeNavigationContext';

/** Breite des Streifens an der Bildschirmkante, in dem die Geste beginnen muss. */
const EDGE_WIDTH = 25;
/** Waagerechte Mindeststrecke, ab der die Geste als Wischen gilt. */
const MIN_HORIZONTAL_DISTANCE = 60;

interface SwipeableTabScreenProps {
  tab: TabName;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function SwipeableTabScreen({ tab, style, children }: SwipeableTabScreenProps) {
  const router = useRouter();
  const { swipeEnabled } = useSwipeNavigation();
  const widthRef = useRef(0);
  const startEdgeRef = useRef<'left' | 'right' | null>(null);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Merkt sich nur, ob die Berührung am Rand begann. Gibt bewusst immer
        // false zurück, damit Tippen weiterhin bei den Kind-Elementen ankommt.
        onStartShouldSetPanResponderCapture: (event) => {
          const startX = event.nativeEvent.pageX;
          const width = widthRef.current;
          if (startX <= EDGE_WIDTH) {
            startEdgeRef.current = 'left';
          } else if (width > 0 && startX >= width - EDGE_WIDTH) {
            startEdgeRef.current = 'right';
          } else {
            startEdgeRef.current = null;
          }
          return false;
        },
        // Übernimmt die Geste erst, wenn sie am Rand begann, deutlich waagerecht
        // verläuft und die Mindeststrecke überschritten hat.
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
          if (!swipeEnabled || startEdgeRef.current === null) {
            return false;
          }
          if (Math.abs(gestureState.dx) <= Math.abs(gestureState.dy)) {
            return false;
          }
          return Math.abs(gestureState.dx) >= MIN_HORIZONTAL_DISTANCE;
        },
        onPanResponderRelease: (_event, gestureState) => {
          const startEdge = startEdgeRef.current;
          startEdgeRef.current = null;
          if (startEdge === null) {
            return;
          }

          const direction = gestureState.dx > 0 ? 'previous' : 'next';
          // Linker Rand darf nur nach rechts, rechter Rand nur nach links wischen.
          if (startEdge === 'left' && direction !== 'previous') {
            return;
          }
          if (startEdge === 'right' && direction !== 'next') {
            return;
          }

          const target = getNeighbourTab(tab, direction);
          if (target !== null) {
            router.navigate(tabPath(target));
          }
        },
        onPanResponderTerminate: () => {
          startEdgeRef.current = null;
        },
      }),
    [swipeEnabled, tab, router]
  );

  function handleLayout(event: LayoutChangeEvent) {
    widthRef.current = event.nativeEvent.layout.width;
  }

  return (
    <View style={style} onLayout={handleLayout} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
```

Hinweis zur Umsetzung: `pageX` ist eine Bildschirmkoordinate, `widthRef` die Breite dieser Hülle. Das passt zusammen, weil die Hülle in allen fünf Tabs die volle Bildschirmbreite einnimmt und am linken Rand beginnt.

- [ ] **Step 2: Run the full test suite and TypeScript check**

Run from `colitis-app/`: `npx vitest run`
Expected: PASS (keine Fehler; diese Task fügt keine Tests hinzu)

Run from `colitis-app/`: `npx tsc --noEmit`
Expected: keine Ausgabe (keine Fehler)

- [ ] **Step 3: Commit**

```bash
git add colitis-app/src/components/SwipeableTabScreen.tsx
git commit -m "feat: SwipeableTabScreen erkennt Randgeste und wechselt den Tab"
```

---

### Task 5: Die fünf Tab-Startseiten umschließen

**Files:**
- Modify: `colitis-app/app/(tabs)/tagebuch/index.tsx`
- Modify: `colitis-app/app/(tabs)/wissen/index.tsx`
- Modify: `colitis-app/app/(tabs)/medikamente/index.tsx`
- Modify: `colitis-app/app/(tabs)/toiletten/index.tsx`
- Modify: `colitis-app/app/(tabs)/einstellungen/index.tsx`

**Interfaces:**
- Consumes: `SwipeableTabScreen` (Task 4, `colitis-app/src/components/SwipeableTabScreen.tsx`).
- Produces: nichts für spätere Tasks.

Kein automatisierter Test (React Native ist unter Vitest nicht ausführbar). Absicherung über vollen Testlauf und TypeScript-Check.

**`app/(tabs)/_layout.tsx` wird nicht angefasst.**

- [ ] **Step 1: Wrap the four View-based screens**

In `colitis-app/app/(tabs)/tagebuch/index.tsx`, `colitis-app/app/(tabs)/wissen/index.tsx`, `colitis-app/app/(tabs)/medikamente/index.tsx` und `colitis-app/app/(tabs)/toiletten/index.tsx` jeweils diesen Import bei den übrigen `src/`-Importen ergänzen:

```typescript
import { SwipeableTabScreen } from '../../../src/components/SwipeableTabScreen';
```

Dann in jeder der vier Dateien das äußerste Element des `return`-Blocks austauschen. Öffnendes Tag – vorher:

```typescript
    <View style={styles.container}>
```

nachher (`TAB` ersetzen durch `tagebuch`, `wissen`, `medikamente` bzw. `toiletten`):

```typescript
    <SwipeableTabScreen tab="TAB" style={styles.container}>
```

Zugehöriges schließendes Tag – vorher:

```typescript
    </View>
  );
```

nachher:

```typescript
    </SwipeableTabScreen>
  );
```

Es handelt sich jeweils um das **letzte** `</View>` vor dem abschließenden `);` der Komponente (tagebuch Zeile 209, wissen Zeile 172, medikamente Zeile 261, toiletten Zeile 324 – Zeilennummern vor dieser Änderung). Alle inneren `<View>`-Elemente bleiben unverändert.

- [ ] **Step 2: Wrap the settings screen (ScrollView-based)**

`colitis-app/app/(tabs)/einstellungen/index.tsx` verwendet als äußerstes Element eine `ScrollView` und wird deshalb anders behandelt: Die Hülle bekommt `styles.container`, die `ScrollView` behält nur `contentContainerStyle`.

Import bei den übrigen `src/`-Importen ergänzen:

```typescript
import { SwipeableTabScreen } from '../../../src/components/SwipeableTabScreen';
```

Öffnendes Tag – vorher:

```typescript
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
```

nachher:

```typescript
    <SwipeableTabScreen tab="einstellungen" style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
```

Schließendes Tag – vorher:

```typescript
    </ScrollView>
  );
```

nachher:

```typescript
      </ScrollView>
    </SwipeableTabScreen>
  );
```

- [ ] **Step 3: Run the full test suite and TypeScript check**

Run from `colitis-app/`: `npx vitest run`
Expected: PASS (keine Fehler)

Run from `colitis-app/`: `npx tsc --noEmit`
Expected: keine Ausgabe (keine Fehler)

- [ ] **Step 4: Commit**

```bash
git add "colitis-app/app/(tabs)/tagebuch/index.tsx" "colitis-app/app/(tabs)/wissen/index.tsx" "colitis-app/app/(tabs)/medikamente/index.tsx" "colitis-app/app/(tabs)/toiletten/index.tsx" "colitis-app/app/(tabs)/einstellungen/index.tsx"
git commit -m "feat: Wischgeste auf den fuenf Tab-Startseiten aktivieren"
```

---

### Task 6: Ein-/Ausschalter in den Einstellungen

**Files:**
- Modify: `colitis-app/app/(tabs)/einstellungen/index.tsx`
- Modify: `docs/superpowers/colitis-app-alltagstest-checkliste.md`

**Interfaces:**
- Consumes: `useSwipeNavigation` (Task 3, `colitis-app/src/navigation/SwipeNavigationContext.tsx`); die bereits in der Datei importierte `SliderToggle`-Komponente sowie die vorhandenen Stile `styles.sectionTitle`, `styles.row`, `styles.rowLabel`.
- Produces: nichts für spätere Tasks.

Kein automatisierter Test (React Native ist unter Vitest nicht ausführbar). Absicherung über vollen Testlauf und TypeScript-Check.

- [ ] **Step 1: Read the setting from the context**

In `colitis-app/app/(tabs)/einstellungen/index.tsx` diesen Import bei den übrigen `src/`-Importen ergänzen:

```typescript
import { useSwipeNavigation } from '../../../src/navigation/SwipeNavigationContext';
```

Und im Rumpf der Bildschirm-Komponente – direkt neben den bereits vorhandenen Hook-Aufrufen wie `useTheme()` – ergänzen:

```typescript
  const { swipeEnabled, setSwipeEnabled } = useSwipeNavigation();
```

- [ ] **Step 2: Add the "Navigation" section**

Im `return`-Block der Datei den neuen Abschnitt einfügen: direkt **nach** dem schließenden `</View>` des `styles.themeRow`-Blocks (Ende des Abschnitts „Darstellung") und **vor** der Zeile `<Text style={styles.sectionTitle}>App-Sperre</Text>`:

```typescript
      <Text style={styles.sectionTitle}>Navigation</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Zwischen Tabs wischen</Text>
        <SliderToggle
          value={swipeEnabled}
          onValueChange={setSwipeEnabled}
          accessibilityLabel="Wischen zwischen Tabs aktivieren"
        />
      </View>
```

- [ ] **Step 3: Add the manual test items to the checklist**

An `docs/superpowers/colitis-app-alltagstest-checkliste.md` einen neuen Abschnitt anhängen:

```markdown
## Wischgeste zum Tab-Wechsel

- [ ] Auf der Tagebuch-Übersicht vom rechten Bildschirmrand nach links wischen → Wissen-Tab erscheint
- [ ] Auf der Wissen-Liste vom linken Bildschirmrand nach rechts wischen → Tagebuch-Tab erscheint
- [ ] Auf der Tagebuch-Übersicht vom linken Rand nach rechts wischen → nichts passiert (erster Tab)
- [ ] Auf den Einstellungen vom rechten Rand nach links wischen → nichts passiert (letzter Tab)
- [ ] Im Toiletten-Tab die Karte in der Bildschirmmitte waagerecht verschieben → Karte bewegt sich, kein Tab-Wechsel
- [ ] Im Toiletten-Tab vom äußersten linken Rand nach rechts wischen → Medikamente-Tab erscheint
- [ ] Auf einer Unterseite (z. B. „Neuer Eintrag") vom Rand wischen → kein Tab-Wechsel, Formulareingaben bleiben erhalten
- [ ] Kurz auf eine Karte/Schaltfläche am Bildschirmrand tippen → normale Aktion wird ausgelöst, kein Tab-Wechsel
- [ ] Senkrecht scrollen (Wissen-Liste, Einstellungen) → kein Tab-Wechsel
- [ ] Einstellungen → Navigation → „Zwischen Tabs wischen" ausschalten → auf allen Tabs löst Wischen nichts mehr aus
- [ ] App vollständig schließen und neu öffnen → Schalter steht weiterhin auf „aus"
- [ ] Schalter wieder einschalten → Wischen funktioniert sofort wieder, ohne Neustart
```

- [ ] **Step 4: Run the full test suite and TypeScript check**

Run from `colitis-app/`: `npx vitest run`
Expected: PASS (keine Fehler)

Run from `colitis-app/`: `npx tsc --noEmit`
Expected: keine Ausgabe (keine Fehler)

- [ ] **Step 5: Commit**

```bash
git add "colitis-app/app/(tabs)/einstellungen/index.tsx" docs/superpowers/colitis-app-alltagstest-checkliste.md
git commit -m "feat: Ein-/Ausschalter fuer die Tab-Wischgeste in den Einstellungen"
```
