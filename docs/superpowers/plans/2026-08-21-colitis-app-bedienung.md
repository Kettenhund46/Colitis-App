# Bedienung (Phase 3) — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Listenzeilen lassen sich durch Wischen nach links löschen, jedes Löschen ist acht Sekunden lang rückgängig zu machen, Speichern und Löschen geben ein kurzes haptisches Signal, und wer reduzierte Bewegung eingestellt hat, bekommt keine Animation.

**Architecture:** Der Zustandsautomat des aufgeschobenen Löschens und die Entscheidung „ist das ein Löschwisch" liegen als reine Funktionen in zwei Modulen — das ist alles, was in diesem Projekt prüfbar ist. Darüber liegen dünne Hüllen: ein Haken mit der Uhr, eine wischbare Zeile, ein Streifen. Die Wischgeste benutzt `PanResponder`, dasselbe Werkzeug wie die vorhandene Tab-Geste, damit beide im selben System liegen.

**Tech Stack:** React Native 0.86.2, Expo SDK 57, TypeScript, Vitest (`environment: 'node'`), neu: `expo-haptics`.

**Entwurf:** `docs/superpowers/specs/2026-08-21-colitis-app-bedienung-design.md`

## Global Constraints

- **Windows:** immer `npx.cmd`, nie `npx`.
- **Arbeitsverzeichnis für alle Befehle:** das `colitis-app`-Verzeichnis des Arbeitsbereichs.
- **Testlauf:** `npm test` (das ist `vitest run`). Typprüfung: `npx.cmd tsc --noEmit`.
- **Vitest kann keine Komponenten rendern.** `environment: 'node'`, kein jsdom, kein `@testing-library/react-native`, kein `react-test-renderer`. Es darf **keine** neue Test-Abhängigkeit hinzukommen. Getestet werden ausschließlich `pendingDeletion.ts` und `swipeDecision.ts`.
- **Kein `react-native-gesture-handler`.** Es liegt zwar transitiv im Baum, wird aber nicht benutzt. Kein `GestureHandlerRootView`, keine `Gesture`/`GestureDetector`. Die Geste wird mit `PanResponder` gebaut.
- **Einzige neue Abhängigkeit:** `expo-haptics`, installiert mit `npx.cmd expo install expo-haptics`, damit die zur SDK 57 passende Version gewählt wird. Kein `npm install`.
- **Rückgängig ersetzt den Bestätigungsdialog.** Nach dieser Phase gibt es in der App **keinen** `Alert.alert` mehr, der ein Löschen bestätigt.
- **Nichts wird gelöscht, solange die Uhr läuft.** Der Löschbefehl geht erst an die Datenbank, wenn das Fenster abläuft oder der Bildschirm verlassen wird.
- **Fenster: 8 Sekunden.** Schwelle der Wischgeste: **96 Pixel** nach links.
- **Unveränderlichkeit:** Die reinen Funktionen geben neue Objekte zurück und ändern ihre Eingaben nie.
- **Vorhandene `accessibilityLabel` und `accessibilityRole` behalten ihren Inhalt.**
- **Keine Bewegung über das Nötige hinaus.** Genau zwei bewegte Dinge: das Mitwandern der Zeile unter dem Finger und ihr Verschwinden. Kein Federn, kein Pulsieren, keine Bildschirmübergänge.
- **Haptik darf nie einen Fehler werfen.** Ein fehlgeschlagenes Ticken darf kein Speichern verhindern.
- **Deutsche Texte**, Du-Form.
- **Keine Datei über 800 Zeilen.**
- **Nicht in `colitis-app/.superpowers/` schreiben.** Zwischenberichte gehören in das vom Aufrufer genannte Verzeichnis.

## Dateistruktur

**Neu:**

| Datei | Verantwortung |
|---|---|
| `src/features/deletion/pendingDeletion.ts` | Zustandsautomat des aufgeschobenen Löschens, rein |
| `src/features/deletion/pendingDeletion.test.ts` | Tests dazu |
| `src/features/deletion/usePendingDeletion.ts` | Haken: Zustand, Uhr, Ausführung |
| `src/components/swipe/swipeDecision.ts` | Gilt diese Bewegung als Löschwisch? Rein |
| `src/components/swipe/swipeDecision.test.ts` | Tests dazu |
| `src/components/swipe/SwipeableRow.tsx` | Hülle über der Zeilengeste |
| `src/components/ui/UndoBar.tsx` | Der Rückgängig-Streifen |
| `src/hooks/useReducedMotion.ts` | Systemeinstellung lesen und beobachten |
| `src/lib/haptics.ts` | Schmale Kapsel um `expo-haptics` |

**Geändert:** `src/components/SwipeableTabScreen.tsx` (holt `EDGE_WIDTH` künftig aus `swipeDecision.ts`), die drei Listenkomponenten, die fünf Bildschirme mit Löschwegen, `ScreeningReminderCard.tsx`, sechs Speicher-Bildschirme.

---

### Task 1: Der Zustandsautomat des aufgeschobenen Löschens

**Warum:** Das ist der eigentliche Prüfgegenstand dieser Phase. Alles Weitere ist Hülle. Weil Komponenten hier nicht gerendert werden können, muss jede Entscheidung — was bei einem zweiten Löschen passiert, wann tatsächlich gelöscht wird — in dieser Datei liegen und nirgends sonst.

**Files:**
- Create: `src/features/deletion/pendingDeletion.ts`
- Create: `src/features/deletion/pendingDeletion.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  ```typescript
  interface PendingDeletion<TId> { id: TId; label: string; }
  interface DeletionState<TId> { pending: PendingDeletion<TId> | null; }
  interface DeletionOutcome<TId> { state: DeletionState<TId>; commit: TId | null; }
  const EMPTY_DELETION_STATE: DeletionState<never>;
  function requestDeletion<TId>(state: DeletionState<TId>, entry: PendingDeletion<TId>): DeletionOutcome<TId>;
  function undoDeletion<TId>(state: DeletionState<TId>): DeletionOutcome<TId>;
  function commitDeletion<TId>(state: DeletionState<TId>): DeletionOutcome<TId>;
  ```
  `commit` ist die Kennung, die der Aufrufer **jetzt** in der Datenbank löschen muss — oder `null`, wenn nichts zu tun ist.

- [ ] **Step 1: Die fehlschlagenden Tests schreiben**

`src/features/deletion/pendingDeletion.test.ts` anlegen:

```typescript
import { describe, it, expect } from 'vitest';
import {
  EMPTY_DELETION_STATE,
  requestDeletion,
  undoDeletion,
  commitDeletion,
} from './pendingDeletion';
import type { DeletionState } from './pendingDeletion';

const emptyState: DeletionState<number> = EMPTY_DELETION_STATE;

describe('requestDeletion', () => {
  it('parks the entry without deleting anything yet', () => {
    const outcome = requestDeletion(emptyState, { id: 7, label: 'Eintrag' });
    expect(outcome.state.pending).toEqual({ id: 7, label: 'Eintrag' });
    expect(outcome.commit).toBeNull();
  });

  it('commits the waiting entry when a second one is deleted', () => {
    const first = requestDeletion(emptyState, { id: 7, label: 'Eintrag' });
    const second = requestDeletion(first.state, { id: 9, label: 'Eintrag' });
    expect(second.commit).toBe(7);
    expect(second.state.pending).toEqual({ id: 9, label: 'Eintrag' });
  });

  it('leaves the given state untouched', () => {
    const outcome = requestDeletion(emptyState, { id: 7, label: 'Eintrag' });
    expect(emptyState.pending).toBeNull();
    expect(outcome.state).not.toBe(emptyState);
  });
});

describe('undoDeletion', () => {
  it('drops the waiting entry without ever deleting it', () => {
    const parked = requestDeletion(emptyState, { id: 7, label: 'Eintrag' });
    const outcome = undoDeletion(parked.state);
    expect(outcome.state.pending).toBeNull();
    expect(outcome.commit).toBeNull();
  });

  it('does nothing when nothing is waiting', () => {
    const outcome = undoDeletion(emptyState);
    expect(outcome.state.pending).toBeNull();
    expect(outcome.commit).toBeNull();
  });
});

describe('commitDeletion', () => {
  it('hands back the id that must now be deleted', () => {
    const parked = requestDeletion(emptyState, { id: 7, label: 'Eintrag' });
    const outcome = commitDeletion(parked.state);
    expect(outcome.commit).toBe(7);
    expect(outcome.state.pending).toBeNull();
  });

  it('has nothing to commit when nothing is waiting', () => {
    const outcome = commitDeletion(emptyState);
    expect(outcome.commit).toBeNull();
    expect(outcome.state.pending).toBeNull();
  });
});
```

- [ ] **Step 2: Testlauf, muss fehlschlagen**

```bash
npm test -- src/features/deletion/pendingDeletion.test.ts
```

Erwartet: FAIL, „Failed to resolve import ./pendingDeletion".

- [ ] **Step 3: `pendingDeletion.ts` schreiben**

```typescript
/**
 * Ein Loeschvorgang, der angefordert, aber noch nicht ausgefuehrt wurde.
 * Solange er hier steht, ist in der Datenbank nichts passiert.
 */
export interface PendingDeletion<TId> {
  id: TId;
  /** Was im Rueckgaengig-Streifen steht, etwa "Eintrag". */
  label: string;
}

export interface DeletionState<TId> {
  pending: PendingDeletion<TId> | null;
}

export interface DeletionOutcome<TId> {
  state: DeletionState<TId>;
  /** Was der Aufrufer jetzt wirklich loeschen muss. null heisst: nichts zu tun. */
  commit: TId | null;
}

export const EMPTY_DELETION_STATE: DeletionState<never> = { pending: null };

/**
 * Ein zweites Loeschen bei laufender Uhr fuehrt das erste sofort aus. Mehrere
 * Uhren gleichzeitig zu verwalten waere ueberfluessig komplex, und der Streifen
 * kann ohnehin nur einen Vorgang zeigen.
 */
export function requestDeletion<TId>(
  state: DeletionState<TId>,
  entry: PendingDeletion<TId>
): DeletionOutcome<TId> {
  return {
    state: { pending: entry },
    commit: state.pending === null ? null : state.pending.id,
  };
}

export function undoDeletion<TId>(state: DeletionState<TId>): DeletionOutcome<TId> {
  return { state: { pending: null }, commit: null };
}

export function commitDeletion<TId>(state: DeletionState<TId>): DeletionOutcome<TId> {
  return {
    state: { pending: null },
    commit: state.pending === null ? null : state.pending.id,
  };
}
```

- [ ] **Step 4: Testlauf, muss durchlaufen**

```bash
npm test -- src/features/deletion/pendingDeletion.test.ts
```

Erwartet: PASS, 7 Tests.

- [ ] **Step 5: Typprüfung und vollständiger Testlauf**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe.

```bash
npm test
```

Erwartet: PASS, 484 Tests (477 + 7).

- [ ] **Step 6: Commit**

```bash
git add src/features/deletion/pendingDeletion.ts src/features/deletion/pendingDeletion.test.ts
git commit -m "feat: Zustandsautomat fuer aufgeschobenes Loeschen"
```

---

### Task 2: Die Wisch-Entscheidung, und ein Wert statt zweier

**Warum:** Zwei Gesten teilen sich jeden Listenbildschirm. Sie dürfen sich nur dann nie in die Quere kommen, wenn beide **denselben** Randstreifen kennen. Heute steht die 25 als lokale Konstante in `SwipeableTabScreen.tsx`; sie zu kopieren wäre der Anfang des Auseinanderdriftens.

**Files:**
- Create: `src/components/swipe/swipeDecision.ts`
- Create: `src/components/swipe/swipeDecision.test.ts`
- Modify: `src/components/SwipeableTabScreen.tsx`

**Interfaces:**
- Consumes: nichts
- Produces:
  ```typescript
  const EDGE_WIDTH: number;              // 25
  const ROW_SWIPE_THRESHOLD: number;     // 96
  interface SwipeAttempt { startX: number; dx: number; dy: number; screenWidth: number; }
  function startedInEdgeStrip(startX: number, screenWidth: number): boolean;
  function isDeleteSwipe(attempt: SwipeAttempt): boolean;
  ```

- [ ] **Step 1: Die fehlschlagenden Tests schreiben**

`src/components/swipe/swipeDecision.test.ts` anlegen:

```typescript
import { describe, it, expect } from 'vitest';
import { isDeleteSwipe, startedInEdgeStrip, EDGE_WIDTH, ROW_SWIPE_THRESHOLD } from './swipeDecision';

const WIDTH = 400;

describe('startedInEdgeStrip', () => {
  it('recognises both edges', () => {
    expect(startedInEdgeStrip(5, WIDTH)).toBe(true);
    expect(startedInEdgeStrip(WIDTH - 5, WIDTH)).toBe(true);
  });

  it('leaves the middle alone', () => {
    expect(startedInEdgeStrip(200, WIDTH)).toBe(false);
  });
});

describe('isDeleteSwipe', () => {
  it('accepts a long leftward drag that started in the middle', () => {
    expect(isDeleteSwipe({ startX: 200, dx: -120, dy: 5, screenWidth: WIDTH })).toBe(true);
  });

  it('refuses a drag that started in the edge strip, so the tab gesture owns it alone', () => {
    expect(isDeleteSwipe({ startX: 5, dx: -120, dy: 5, screenWidth: WIDTH })).toBe(false);
    expect(isDeleteSwipe({ startX: WIDTH - 5, dx: -120, dy: 5, screenWidth: WIDTH })).toBe(false);
  });

  it('refuses a rightward drag', () => {
    expect(isDeleteSwipe({ startX: 200, dx: 120, dy: 5, screenWidth: WIDTH })).toBe(false);
  });

  it('refuses a mostly vertical drag, so scrolling still works', () => {
    expect(isDeleteSwipe({ startX: 200, dx: -120, dy: -130, screenWidth: WIDTH })).toBe(false);
  });

  it('refuses a drag short of the threshold', () => {
    expect(isDeleteSwipe({ startX: 200, dx: -(ROW_SWIPE_THRESHOLD - 1), dy: 5, screenWidth: WIDTH })).toBe(false);
  });

  it('keeps the delete threshold above the tab gesture threshold of 60', () => {
    expect(ROW_SWIPE_THRESHOLD).toBeGreaterThan(60);
  });

  it('uses the same edge strip the tab gesture uses', () => {
    expect(EDGE_WIDTH).toBe(25);
  });
});
```

- [ ] **Step 2: Testlauf, muss fehlschlagen**

```bash
npm test -- src/components/swipe/swipeDecision.test.ts
```

Erwartet: FAIL, „Failed to resolve import ./swipeDecision".

- [ ] **Step 3: `swipeDecision.ts` schreiben**

```typescript
/**
 * Breite des Streifens an der Bildschirmkante, in dem die Tab-Wischgeste
 * beginnen muss. Einziger Ort dieses Wertes: SwipeableTabScreen holt ihn
 * ebenfalls hier. Driften die beiden auseinander, gibt es Beruehrungen, die
 * beide Gesten fuer sich beanspruchen.
 */
export const EDGE_WIDTH = 25;

/**
 * Waagerechte Mindeststrecke nach links, ab der eine Bewegung als Loeschwisch
 * gilt. Bewusst hoeher als die 60 Pixel der Tab-Geste: Diese hier ist die
 * zerstoererische von beiden und soll nicht beim Scrollen mit leicht schraeger
 * Fingerbewegung ausloesen.
 */
export const ROW_SWIPE_THRESHOLD = 96;

export interface SwipeAttempt {
  /** Waagerechte Position, an der die Beruehrung begann. */
  startX: number;
  /** Zurueckgelegte Strecke seit Beruehrungsbeginn, negativ ist nach links. */
  dx: number;
  dy: number;
  screenWidth: number;
}

export function startedInEdgeStrip(startX: number, screenWidth: number): boolean {
  return startX <= EDGE_WIDTH || startX >= screenWidth - EDGE_WIDTH;
}

export function isDeleteSwipe({ startX, dx, dy, screenWidth }: SwipeAttempt): boolean {
  if (startedInEdgeStrip(startX, screenWidth)) {
    return false;
  }
  if (dx >= 0) {
    return false;
  }
  if (Math.abs(dx) <= Math.abs(dy)) {
    return false;
  }
  return Math.abs(dx) >= ROW_SWIPE_THRESHOLD;
}
```

- [ ] **Step 4: Testlauf, muss durchlaufen**

```bash
npm test -- src/components/swipe/swipeDecision.test.ts
```

Erwartet: PASS, 8 Tests.

- [ ] **Step 5: `SwipeableTabScreen` auf den gemeinsamen Wert bringen**

In `src/components/SwipeableTabScreen.tsx` diesen Block entfernen:

```typescript
/** Breite des Streifens an der Bildschirmkante, in dem die Geste beginnen muss. */
const EDGE_WIDTH = 25;
```

und stattdessen oben bei den Imports ergänzen:

```typescript
import { EDGE_WIDTH } from './swipe/swipeDecision';
```

`MIN_HORIZONTAL_DISTANCE` bleibt, wo es ist — es gehört nur der Tab-Geste. Sonst wird an dieser Datei **nichts** geändert; die Kommentare zur Kaper-Logik bleiben unverändert stehen.

- [ ] **Step 6: Typprüfung und vollständiger Testlauf**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe.

```bash
npm test
```

Erwartet: PASS, 492 Tests (484 + 8).

- [ ] **Step 7: Commit**

```bash
git add src/components/swipe/swipeDecision.ts src/components/swipe/swipeDecision.test.ts src/components/SwipeableTabScreen.tsx
git commit -m "feat: Wisch-Entscheidung als reine Funktion, Randstreifen an einer Stelle"
```

---

### Task 3: Haptik und reduzierte Bewegung

**Warum:** Zwei kleine Kapseln, die alle folgenden Tasks benutzen. `haptics.ts` gibt es, damit kein Aufrufer direkt an `expo-haptics` hängt und damit im Namen die Absicht steht statt der Mechanik.

**Files:**
- Modify: `package.json` (durch `expo install`)
- Create: `src/lib/haptics.ts`
- Create: `src/hooks/useReducedMotion.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  ```typescript
  function saveFeedback(): void;
  function deleteFeedback(): void;
  function useReducedMotion(): boolean;
  ```
  Beide Haptik-Funktionen sind bewusst **nicht** `async` und werfen nie — der Aufrufer schreibt `saveFeedback();` ohne `await` und ohne `catch`.

- [ ] **Step 1: `expo-haptics` installieren**

```bash
npx.cmd expo install expo-haptics
```

Erwartet: `expo-haptics` erscheint in `package.json` unter `dependencies` mit einer `~57.x`-Version. **Nicht** `npm install expo-haptics` benutzen — das würde eine zur SDK unpassende Version ziehen.

- [ ] **Step 2: `haptics.ts` schreiben**

```typescript
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
```

- [ ] **Step 3: `useReducedMotion.ts` schreiben**

```typescript
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
```

- [ ] **Step 4: Typprüfung und Testlauf**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe.

```bash
npm test
```

Erwartet: PASS, 492 Tests unverändert. Diese beiden Dateien bekommen keine Tests — `expo-haptics` und `AccessibilityInfo` sind Laufzeitschnittstellen des Geräts.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/haptics.ts src/hooks/useReducedMotion.ts
git commit -m "feat: Haptik-Kapsel und Haken fuer reduzierte Bewegung"
```

---

### Task 4: Die drei Hüllen

**Warum:** Der Haken mit der Uhr, die wischbare Zeile und der Streifen. Alle drei enthalten bewusst keine Entscheidung — die liegen in Task 1 und 2.

**Files:**
- Create: `src/features/deletion/usePendingDeletion.ts`
- Create: `src/components/swipe/SwipeableRow.tsx`
- Create: `src/components/ui/UndoBar.tsx`

**Interfaces:**
- Consumes: `EMPTY_DELETION_STATE`, `requestDeletion`, `undoDeletion`, `commitDeletion`, `PendingDeletion` aus `../deletion/pendingDeletion`; `isDeleteSwipe`, `startedInEdgeStrip` aus `./swipeDecision`; `deleteFeedback` aus `../../lib/haptics` (nur in `usePendingDeletion`, **nicht** in `SwipeableRow`); `useReducedMotion`
- Produces:
  ```typescript
  function usePendingDeletion<TId>(onCommit: (id: TId) => Promise<void>): {
    pending: PendingDeletion<TId> | null;
    requestDelete: (entry: PendingDeletion<TId>) => void;
    undo: () => void;
  };

  function SwipeableRow(props: { children: ReactNode; onDelete: () => void }): JSX.Element;

  function UndoBar(props: { label: string; onUndo: () => void }): JSX.Element;
  ```

- [ ] **Step 1: `usePendingDeletion.ts` schreiben**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EMPTY_DELETION_STATE,
  requestDeletion,
  undoDeletion,
  commitDeletion,
} from './pendingDeletion';
import { deleteFeedback } from '../../lib/haptics';
import type { DeletionState, PendingDeletion } from './pendingDeletion';

/** Wie lange ein Loeschvorgang rueckgaengig gemacht werden kann. */
const UNDO_WINDOW_MS = 8000;

export function usePendingDeletion<TId>(onCommit: (id: TId) => Promise<void>) {
  const [state, setState] = useState<DeletionState<TId>>(EMPTY_DELETION_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<DeletionState<TId>>(EMPTY_DELETION_STATE);
  const onCommitRef = useRef(onCommit);

  onCommitRef.current = onCommit;
  stateRef.current = state;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runCommit = useCallback((id: TId | null) => {
    if (id === null) {
      return;
    }
    onCommitRef.current(id).catch((error: unknown) => {
      console.error('[Loeschen] Vorgang konnte nicht ausgefuehrt werden:', error);
    });
  }, []);

  const requestDelete = useCallback(
    (entry: PendingDeletion<TId>) => {
      // Das Ticken gehoert hierher und nicht in die Wischgeste: Geloescht wird
      // auch ueber den Knopf in der Karte, und beide Wege sollen sich gleich
      // anfuehlen.
      deleteFeedback();
      clearTimer();
      const outcome = requestDeletion(stateRef.current, entry);
      stateRef.current = outcome.state;
      setState(outcome.state);
      runCommit(outcome.commit);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const expired = commitDeletion(stateRef.current);
        stateRef.current = expired.state;
        setState(expired.state);
        runCommit(expired.commit);
      }, UNDO_WINDOW_MS);
    },
    [clearTimer, runCommit]
  );

  const undo = useCallback(() => {
    clearTimer();
    const outcome = undoDeletion(stateRef.current);
    stateRef.current = outcome.state;
    setState(outcome.state);
  }, [clearTimer]);

  // Beim Verlassen des Bildschirms wird ausgefuehrt, nicht zurueckgenommen: Die
  // Zeile ist aus der Liste verschwunden, sie unbemerkt zurueckzuholen waere
  // schlimmer als das Loeschen zu vollziehen.
  useEffect(
    () => () => {
      clearTimer();
      const outcome = commitDeletion(stateRef.current);
      stateRef.current = outcome.state;
      runCommit(outcome.commit);
    },
    [clearTimer, runCommit]
  );

  return { pending: state.pending, requestDelete, undo };
}
```

- [ ] **Step 2: `SwipeableRow.tsx` schreiben**

```tsx
import { useMemo, useRef } from 'react';
import { Animated, PanResponder, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { isDeleteSwipe, startedInEdgeStrip } from './swipeDecision';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { ReactNode } from 'react';

const EXIT_DURATION_MS = 180;

interface SwipeableRowProps {
  children: ReactNode;
  onDelete: () => void;
}

export function SwipeableRow({ children, onDelete }: SwipeableRowProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isReducedMotion = useReducedMotion();
  const translateX = useRef(new Animated.Value(0)).current;
  const startXRef = useRef(0);
  const rowWidthRef = useRef(screenWidth);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Bubble-Phase, nicht Capture: Tippen muss weiterhin bei Knoepfen
        // innerhalb der Zeile ankommen.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (event, gestureState) => {
          startXRef.current = event.nativeEvent.pageX - gestureState.dx;
          if (startedInEdgeStrip(startXRef.current, screenWidth)) {
            return false;
          }
          if (gestureState.dx >= 0) {
            return false;
          }
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        },
        onPanResponderMove: (_event, gestureState) => {
          if (gestureState.dx < 0) {
            translateX.setValue(gestureState.dx);
          }
        },
        onPanResponderRelease: (_event, gestureState) => {
          const shouldDelete = isDeleteSwipe({
            startX: startXRef.current,
            dx: gestureState.dx,
            dy: gestureState.dy,
            screenWidth,
          });

          if (!shouldDelete) {
            Animated.timing(translateX, {
              toValue: 0,
              duration: isReducedMotion ? 0 : EXIT_DURATION_MS,
              useNativeDriver: true,
            }).start();
            return;
          }

          if (isReducedMotion) {
            translateX.setValue(0);
            onDelete();
            return;
          }

          Animated.timing(translateX, {
            toValue: -rowWidthRef.current,
            duration: EXIT_DURATION_MS,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            onDelete();
          });
        },
        onPanResponderTerminate: () => {
          translateX.setValue(0);
        },
      }),
    [screenWidth, isReducedMotion, translateX, onDelete]
  );

  function handleLayout(event: LayoutChangeEvent) {
    rowWidthRef.current = event.nativeEvent.layout.width;
  }

  return (
    <Animated.View
      onLayout={handleLayout}
      style={{ transform: [{ translateX }] }}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}
```

- [ ] **Step 3: `UndoBar.tsx` schreiben**

```tsx
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import type { ThemeColors } from '../../theme/types';

interface UndoBarProps {
  /** Was geloescht wurde, etwa "Eintrag" oder "Medikament". */
  label: string;
  onUndo: () => void;
}

export function UndoBar({ label, onUndo }: UndoBarProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Text style={styles.text}>{label} gelöscht</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} wiederherstellen`}
        style={styles.button}
        onPress={onUndo}
      >
        <Text style={styles.buttonText}>Rückgängig</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.textPrimary,
      borderRadius: tokens.radius.md,
      margin: tokens.spacing.md,
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.md,
    },
    text: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.sm,
      flexShrink: 1,
    },
    button: {
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.sm,
    },
    buttonText: {
      color: colors.accent,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
```

Der Streifen benutzt bewusst **nicht** `Card`: Er liegt nicht auf dem Hintergrund, sondern darüber, und trägt deshalb die umgekehrte Farbgebung.

- [ ] **Step 4: Typprüfung und Testlauf**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe.

```bash
npm test
```

Erwartet: PASS, 492 Tests unverändert. Diese drei Dateien bekommen keine Tests — das Prüfbare liegt in Task 1 und 2.

- [ ] **Step 5: Commit**

```bash
git add src/features/deletion/usePendingDeletion.ts src/components/swipe/SwipeableRow.tsx src/components/ui/UndoBar.tsx
git commit -m "feat: Haken mit Uhr, wischbare Zeile und Rueckgaengig-Streifen"
```

---

### Task 5: Tagebuch umstellen

**Warum:** Der erste echte Aufrufer und der Bildschirm mit dem häufigsten Löschen. Was hier funktioniert, wird in Task 6 und 7 wiederholt.

**Files:**
- Modify: `src/features/diary/components/DiaryHistoryList.tsx`
- Modify: `app/(tabs)/tagebuch/index.tsx`

**Interfaces:**
- Consumes: `SwipeableRow`, `UndoBar`, `usePendingDeletion`
- Produces: `DiaryHistoryList` bekommt eine zusätzliche Pflicht-Prop `hiddenId: number | null`. Kein anderer Task ruft diese Komponente auf — **doch, `DiaryCalendarView.tsx` tut es ebenfalls**, siehe Step 3.

- [ ] **Step 1: `DiaryHistoryList` um die Wischgeste erweitern**

Imports ergänzen:
```tsx
import { SwipeableRow } from '../../../components/swipe/SwipeableRow';
```

Props erweitern:
```tsx
interface DiaryHistoryListProps {
  entries: DiaryEntryWithTriggers[];
  onDelete: (entryId: number) => void;
  onCreate: () => void;
  /** Kennung des Eintrags, dessen Loeschen noch rueckgaengig gemacht werden kann. */
  hiddenId: number | null;
}
```
und in der Signatur aufnehmen.

Direkt nach `const dayRatings = buildDayRatings(entries);` einfügen:
```tsx
  const visibleEntries = entries.filter((entry) => entry.id !== hiddenId);
```

Danach **alle** weiteren Verwendungen von `entries` in dieser Komponente durch `visibleEntries` ersetzen — sowohl die Prüfung `entries.length === 0` als auch `data={entries}` in der `FlatList`. `buildDayRatings` bleibt bei `entries`: Die Tagesbewertung soll sich nicht ändern, nur weil eine Zeile gerade ausgeblendet ist.

Im `renderItem` die `<Card>` in `SwipeableRow` fassen:
```tsx
        return (
          <SwipeableRow onDelete={() => onDelete(item.id)}>
            <Card accent={accentForRating(rating)}>
```
und vor dem schließenden `</Card>` beziehungsweise danach:
```tsx
            </Card>
          </SwipeableRow>
        );
```

Der vorhandene „Löschen"-Knopf in der Karte bleibt unverändert stehen und ruft weiter `onDelete(item.id)`.

- [ ] **Step 2: Den Bildschirm auf aufgeschobenes Löschen umstellen**

In `app/(tabs)/tagebuch/index.tsx`:

Imports ergänzen:
```tsx
import { usePendingDeletion } from '../../../src/features/deletion/usePendingDeletion';
import { UndoBar } from '../../../src/components/ui/UndoBar';
```
(relative Pfade an die vorhandenen Imports der Datei anpassen)

Die beiden Funktionen `handleDelete` und `confirmDelete` **ersetzen** durch:
```tsx
  const { pending, requestDelete, undo } = usePendingDeletion<number>(async (entryId) => {
    const db = await createEncryptedDb();
    await deleteDiaryEntry(db, entryId);
    setEntries(await listDiaryEntries(db));
  });

  function handleDelete(entryId: number) {
    requestDelete({ id: entryId, label: 'Eintrag' });
  }
```

Der `Alert`-Import wird dadurch möglicherweise unbenutzt. Prüfe mit
```bash
grep -n "Alert" "app/(tabs)/tagebuch/index.tsx"
```
und entferne ihn nur, wenn kein Treffer mehr übrig ist — in dieser Datei gibt es einen weiteren `Alert.alert` für den Export („Noch keine Einträge zum Exportieren."), der bleiben muss.

Die Fehlerbehandlung des alten `confirmDelete` entfällt hier: `usePendingDeletion` protokolliert einen fehlgeschlagenen Löschvorgang selbst.

An `DiaryHistoryList` die neue Prop durchreichen:
```tsx
        <DiaryHistoryList
          entries={entries}
          onDelete={handleDelete}
          onCreate={() => router.push('/tagebuch/neu')}
          hiddenId={pending === null ? null : pending.id}
        />
```

Und **unmittelbar vor** dem schließenden Tag des äußeren `SwipeableTabScreen` den Streifen einfügen:
```tsx
      {pending !== null && <UndoBar label={pending.label} onUndo={undo} />}
```

- [ ] **Step 3: Den zweiten Aufrufer bedienen**

`src/features/diary/components/DiaryCalendarView.tsx` ruft `DiaryHistoryList` ebenfalls auf (etwa Zeile 119). Die neue Pflicht-Prop bricht dort die Typprüfung. Ergänze dort:
```tsx
          <DiaryHistoryList
            entries={selectedEntries}
            onDelete={onDeleteEntry}
            onCreate={() => {}}
            hiddenId={null}
          />
```
Der Kalender kennt keinen wartenden Vorgang, also `null`.

- [ ] **Step 4: Typprüfung und vollständiger Testlauf**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe.

```bash
npm test
```

Erwartet: PASS, 492 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/diary "app/(tabs)/tagebuch/index.tsx"
git commit -m "feat: Tagebuch mit Wischgeste und Rueckgaengig"
```

---

### Task 6: Medikamente und Arztbesuche umstellen

**Warum:** Dieselbe Umstellung, zwei weitere Listen. Beim Medikament hängt mehr am Löschen als bei den anderen — siehe Step 1.

**Files:**
- Modify: `src/features/medications/components/MedicationList.tsx`
- Modify: `src/features/doctorVisits/components/DoctorVisitList.tsx`
- Modify: `app/(tabs)/medikamente/index.tsx`
- Modify: `app/(tabs)/tagebuch/arztbesuche/index.tsx`

**Interfaces:**
- Consumes: `SwipeableRow`, `UndoBar`, `usePendingDeletion`
- Produces: beide Listenkomponenten bekommen `hiddenId: number | null`.

- [ ] **Step 1: Der Medikamente-Bildschirm**

**Achtung, das Löschen eines Medikaments tut mehr als eine Zeile zu entfernen.** Das vorhandene `confirmDelete` bestellt auch die geplanten Erinnerungen ab. Dieser ganze Ablauf muss in den aufgeschobenen Vorgang wandern, nicht nur der Datenbankaufruf.

In `app/(tabs)/medikamente/index.tsx` `handleDelete` und `confirmDelete` ersetzen durch:
```tsx
  const { pending, requestDelete, undo } = usePendingDeletion<number>(async (medicationId) => {
    const db = await createEncryptedDb();
    const reminderTimes = await deleteMedication(db, medicationId);
    for (const reminderTime of reminderTimes) {
      if (reminderTime.notificationId) {
        await cancelScheduledReminder(reminderTime.notificationId);
      }
    }
    setMedications(await listMedications(db));
  });

  function handleDelete(medicationId: number) {
    const medication = medications.find((entry) => entry.id === medicationId);
    if (!medication) {
      return;
    }
    requestDelete({ id: medicationId, label: medication.name });
  }
```

`listMedications` ist die vorhandene Ladefunktion; sie wird in dieser Datei bereits an zwei Stellen so aufgerufen und ist schon importiert.

Imports für `usePendingDeletion` und `UndoBar` ergänzen, den Streifen vor dem schließenden Tag einfügen:
```tsx
      {pending !== null && <UndoBar label={pending.label} onUndo={undo} />}
```
und `hiddenId={pending === null ? null : pending.id}` an `MedicationList` durchreichen.

- [ ] **Step 2: Der Arztbesuche-Bildschirm**

In `app/(tabs)/tagebuch/arztbesuche/index.tsx` `handleDelete` und `confirmDelete` ersetzen durch:
```tsx
  const { pending, requestDelete, undo } = usePendingDeletion<number>(async (visitId) => {
    const db = await createEncryptedDb();
    await deleteDoctorVisit(db, visitId);
    setVisits(await listDoctorVisits(db));
  });

  function handleDelete(visitId: number) {
    requestDelete({ id: visitId, label: 'Arztbesuch' });
  }
```
Imports ergänzen, Streifen einfügen, `hiddenId` durchreichen — wie in Step 1.

- [ ] **Step 3: Die beiden Listenkomponenten**

In `src/features/medications/components/MedicationList.tsx`:

Props um `hiddenId: number | null;` erweitern und in der Signatur aufnehmen. Nach den vorhandenen Zeilen
```tsx
  const activeMedications = medications.filter((medication) => isMedicationActive(medication.endDate, today));
  const endedMedications = medications.filter((medication) => !isMedicationActive(medication.endDate, today));
```
die `data`-Prop der `FlatList` ändern zu:
```tsx
      data={[...activeMedications, ...endedMedications].filter((medication) => medication.id !== hiddenId)}
```
und die Leerzustandsprüfung ganz oben auf
```tsx
  if (medications.filter((medication) => medication.id !== hiddenId).length === 0) {
```

Im `renderItem` die `<Card>` in `SwipeableRow` fassen:
```tsx
          <SwipeableRow onDelete={() => onDelete(item.id)}>
            <Card accent={isActive ? 'good' : 'neutral'} isMuted={!isActive}>
```
mit dem passenden schließenden Paar.

In `src/features/doctorVisits/components/DoctorVisitList.tsx` dasselbe: `hiddenId: number | null;` in die Props, `data={visits.filter((visit) => visit.id !== hiddenId)}`, Leerzustandsprüfung entsprechend, und das äußere `Pressable` in `SwipeableRow` fassen:
```tsx
        <SwipeableRow onDelete={() => onDelete(item.id)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Arztbesuch vom ${formatGermanDate(item.visitDate)} bearbeiten`}
            onPress={() => onEdit(item.id)}
          >
            <Card accent="neutral">
```
**`SwipeableRow` liegt außen, das `Pressable` innen.** Umgekehrt würde die Wischgeste den Tippbereich verlassen.

Imports für `SwipeableRow` in beiden Dateien ergänzen.

- [ ] **Step 4: Typprüfung und vollständiger Testlauf**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe.

```bash
npm test
```

Erwartet: PASS, 492 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/medications src/features/doctorVisits "app/(tabs)/medikamente/index.tsx" "app/(tabs)/tagebuch/arztbesuche/index.tsx"
git commit -m "feat: Medikamente und Arztbesuche mit Wischgeste und Rueckgaengig"
```

---

### Task 7: Die zwei Einzelkarten, das haptische Speichern, und der letzte Dialog

**Warum:** Der Abschluss. Danach gibt es in der ganzen App keinen Bestätigungsdialog fürs Löschen mehr, und jedes Speichern tickt.

**Files:**
- Modify: `app/(tabs)/toiletten/index.tsx`
- Modify: `src/features/medications/components/ScreeningReminderCard.tsx`
- Modify: `app/(tabs)/tagebuch/neu.tsx`
- Modify: `app/(tabs)/tagebuch/schnell.tsx`
- Modify: `app/(tabs)/medikamente/neu.tsx`
- Modify: `app/(tabs)/medikamente/[id].tsx`
- Modify: `app/(tabs)/tagebuch/arztbesuche/neu.tsx`
- Modify: `app/(tabs)/tagebuch/arztbesuche/[id].tsx`

**Interfaces:**
- Consumes: `usePendingDeletion`, `UndoBar`, `saveFeedback`
- Produces: nichts

- [ ] **Step 1: Der sichere Ort im Toiletten-Tab**

In `app/(tabs)/toiletten/index.tsx` steht der Löschablauf heute **inline im Dialog**, es gibt keine eigene Funktion dafür. Ersetze `handleDeletePlace` vollständig durch:

```tsx
  const { pending, requestDelete, undo } = usePendingDeletion<number>(async (placeId) => {
    try {
      const db = await createEncryptedDb();
      await deleteSavedPlace(db, placeId);
      setPlaceError(null);
      setSelectedMarker(null);
      await reloadSavedPlaces();
    } catch (error: unknown) {
      console.error('[Toiletten] Sicheren Ort löschen fehlgeschlagen:', error);
      setPlaceError('Sicherer Ort konnte nicht gelöscht werden.');
    }
  });

  function handleDeletePlace(place: SavedPlace) {
    requestDelete({ id: place.id, label: place.name });
  }
```

Das `try`/`catch` bleibt hier drin, weil dieser Ablauf eine sichtbare Fehlermeldung setzt (`setPlaceError`) — das kann `usePendingDeletion` nicht für ihn tun.

Dazu Imports für `usePendingDeletion` und `UndoBar` ergänzen und vor dem schließenden Tag des äußeren Elements einfügen:

```tsx
      {pending !== null && <UndoBar label={pending.label} onUndo={undo} />}
```

**Hier gibt es keine Wischgeste** — der sichere Ort ist eine Einblendung über der Landkarte, keine Listenzeile. Der vorhandene „Löschen"-Knopf ist der einzige Weg. `SwipeableRow` wird in dieser Datei **nicht** benutzt.

Prüfe anschließend mit `grep -n "Alert" "app/(tabs)/toiletten/index.tsx"`, welche `Alert`-Aufrufe übrig sind, und entferne den Import nur bei null Treffern.

- [ ] **Step 2: Der Vorsorge-Termin**

`src/features/medications/components/ScreeningReminderCard.tsx` ist eine Komponente, kein Bildschirm — der Streifen gehört nicht hierher. Es gibt dort auch keine eigene Löschfunktion; der Ablauf steckt inline im Dialog. Ersetze `handleDelete` vollständig durch:

```tsx
  function handleDelete() {
    deleteFeedback();
    void Promise.resolve(onDelete()).then(() => setIsEditing(true));
  }
```

Das ist genau der `onPress`-Rumpf aus dem bisherigen Dialog, plus das haptische Signal — hier von Hand, weil dieser Weg nicht über `usePendingDeletion` läuft.

Import ergänzen: `import { deleteFeedback } from '../../../lib/haptics';`

Den `Alert`-Import entfernen, sofern `grep -n "Alert" src/features/medications/components/ScreeningReminderCard.tsx` keine weiteren Treffer zeigt.

**Bewusste Ausnahme:** Der Vorsorge-Termin bekommt kein Rückgängig. Er ist ein einzelnes gespeichertes Datum ohne Nebenwirkungen, das sich in derselben Karte in Sekunden neu eintragen lässt — ein Streifen samt Uhr in einer eingebetteten Komponente wäre mehr Maschinerie als der Fall trägt. Der Dialog entfällt trotzdem, damit die Regel „kein Bestätigungsdialog" hält.

- [ ] **Step 3: Haptik beim Speichern**

In diesen sechs Dateien nach jedem erfolgreichen Speichern, unmittelbar vor dem `router.back()` beziehungsweise vor dem Neuladen, `saveFeedback();` einfügen:

`app/(tabs)/tagebuch/neu.tsx`, `app/(tabs)/tagebuch/schnell.tsx`, `app/(tabs)/medikamente/neu.tsx`, `app/(tabs)/medikamente/[id].tsx`, `app/(tabs)/tagebuch/arztbesuche/neu.tsx`, `app/(tabs)/tagebuch/arztbesuche/[id].tsx`

Import in jeder Datei: `import { saveFeedback } from '../../../src/lib/haptics';` — relativen Pfad an die Datei anpassen.

`saveFeedback()` wird ohne `await` und ohne `catch` aufgerufen; es wirft nie.

**Nur im Erfolgsfall.** Nicht im `catch`-Zweig, nicht bei Prüffehlern im Formular.

- [ ] **Step 4: Prüfen, dass kein Löschdialog übrig ist**

```bash
grep -rn "Alert.alert" --include=*.tsx app src
```

Erwartet: Es darf **kein** Treffer mehr dabei sein, dessen Text ein Löschen bestätigt („löschen?", „wird endgültig gelöscht"). Andere `Alert.alert` — etwa „Noch keine Einträge zum Exportieren." — bleiben stehen und sind in Ordnung.

- [ ] **Step 5: Typprüfung und vollständiger Testlauf**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe. Meldet TypeScript einen unbenutzten Import, prüfe erst mit `grep`, ob er wirklich nirgends mehr vorkommt.

```bash
npm test
```

Erwartet: PASS, 492 Tests.

- [ ] **Step 6: Abschlussgrep auf unbenutzte Importe**

`tsc` meldet unbenutzte Importe in diesem Projekt **nicht** — `tsconfig.json` setzt kein `noUnusedLocals`. Prüfe deshalb jede in dieser Phase angefasste Datei von Hand:

```bash
git diff --name-only main...HEAD -- "*.tsx" "*.ts"
```

Für jede Datei aus der Liste: die Import-Zeilen lesen und für jeden Namen mit `grep -c` im Rest der Datei bestätigen, dass er noch benutzt wird. Fundstellen entfernen.

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)" src/features/medications/components/ScreeningReminderCard.tsx
git commit -m "feat: letzte Loeschdialoge ersetzt, haptisches Signal beim Speichern"
```

---

## Abnahme auf dem Gerät

Im Testlauf nicht nachbildbar. Nach dem Merge und einem Build zu prüfen:

1. **Wischen löscht:** Im Tagebuch eine Zeile mitten auf dem Bildschirm nach links über etwa ein Viertel der Breite ziehen. Die Zeile wandert mit, verschwindet, der Streifen erscheint.
2. **Kurzes Wischen schnappt zurück:** Dieselbe Bewegung über nur wenige Zentimeter. Die Zeile kehrt zurück, nichts wird gelöscht.
3. **Rückgängig stellt wieder her:** Löschen, dann „Rückgängig" tippen. Der Eintrag ist wieder da.
4. **Warten löscht wirklich:** Löschen, acht Sekunden warten, App neu starten. Der Eintrag ist weg.
5. **App-Ende rettet:** Löschen und die App innerhalb der acht Sekunden schließen. Nach dem Neustart ist der Eintrag noch da.
6. **Bildschirmwechsel löscht:** Löschen und innerhalb der acht Sekunden den Tab wechseln. Zurückkommen — der Eintrag ist weg.
7. **Zweites Löschen:** Zwei Einträge kurz nacheinander löschen. Der erste ist endgültig weg, der Streifen zeigt den zweiten.
8. **Die Tab-Wischgeste lebt noch:** Vom linken und vom rechten Bildschirmrand wischen. Der Tab wechselt wie bisher.
9. **Die Karte im Toiletten-Tab lebt noch:** Die Leaflet-Karte verschieben und zoomen, auch mit Bewegungen, die am Rand beginnen.
10. **Randstreifen löscht nicht:** Eine Zeile ganz vom linken Bildschirmrand aus nach links wischen. Es wird nicht gelöscht — stattdessen greift die Tab-Geste oder es passiert nichts.
11. **Scrollen geht noch:** In einer langen Tagebuchliste mit leicht schräger Fingerbewegung scrollen. Es wird nichts gelöscht.
12. **Kein Dialog mehr:** In allen fünf Bereichen löschen. Nirgends erscheint eine Rückfrage.
13. **Haptik:** Ein Speichern und ein Löschen — je ein kurzes Ticken. Dann die systemweite Haptik ausschalten und beides wiederholen: kein Ticken, sonst alles gleich.
14. **Reduzierte Bewegung:** Die Systemeinstellung setzen. Die Zeile verschwindet ohne Wandern, die Geste funktioniert weiter.
15. **Löschen-Knopf:** In einer Karte den vorhandenen „Löschen"-Knopf tippen. Dasselbe Verhalten wie beim Wischen.
16. **Offene Punkte aus Phase 1 und 2** im selben Durchgang miterledigen.

## Was dieser Plan nicht anfasst

- Wischen in die andere Richtung für eine zweite Aktion
- Wischen auf den beiden Einzelkarten
- Ein Schalter für die Haptik in den Einstellungen
- Bewegung über die zwei genannten Stellen hinaus
- Haptik an anderen Stellen als Speichern und Löschen
- Rückgängig für den Vorsorge-Termin (siehe Task 7 Step 2)
