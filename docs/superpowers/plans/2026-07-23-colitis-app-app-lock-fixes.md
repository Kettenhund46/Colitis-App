# App-Sperre-Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zwei App-Sperre-Bugs beheben: fälschliches erneutes Sperren beim Öffnen des Toiletten-Tabs (ausgelöst durch den Standort-Berechtigungsdialog), und fehlende Bestätigung beim Deaktivieren der App-Sperre.

**Architecture:** Ein neues, minimales Guard-Modul mit einem Modul-Flag wird um die eine betroffene Berechtigungsanfrage gelegt und vom bestehenden `AppState`-Listener der App-Sperre geprüft. Die Deaktivieren-Bestätigung ist ein einfacher `Alert.alert`-Dialog nach dem bereits etablierten Lösch-Bestätigungsmuster dieser App.

**Tech Stack:** React Native / Expo, TypeScript, Vitest.

## Global Constraints

- Referenz: `docs/superpowers/specs/2026-07-23-colitis-app-app-lock-fixes-design.md`
- Keine Änderung an der generellen Sperrlogik (Sperren bei echtem App-Wechsel/Hintergrund) oder an `app/_layout.tsx` – nur das nachgewiesene Zeitfenster der Standort-Berechtigungsanfrage wird ausgenommen.
- Keine zusätzliche PIN-Abfrage beim Deaktivieren – nur ein Bestätigungsdialog.
- Windows-Testbefehl: `npx.cmd vitest run <pfad>`; Type-Check: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`).
- `AGENTS.md` beachten: Expo SDK 57 Doku unter https://docs.expo.dev/versions/v57.0.0/ ist maßgeblich, falls Expo-APIs verwendet werden (hier: `expo-location`, bereits etabliert, keine neuen APIs).

---

### Task 1: Guard-Modul für laufende Berechtigungsanfragen

**Files:**
- Create: `colitis-app/src/features/appLock/pendingPermissionGuard.ts`
- Test: `colitis-app/src/features/appLock/pendingPermissionGuard.test.ts`

**Interfaces:**
- Consumes: nichts aus vorherigen Tasks (erster Task).
- Produces (für Task 2):
  - `export function beginPendingPermissionRequest(): void`
  - `export function endPendingPermissionRequest(): void`
  - `export function isPermissionRequestPending(): boolean`

- [ ] **Step 1: Write the failing test**

Create `colitis-app/src/features/appLock/pendingPermissionGuard.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  beginPendingPermissionRequest,
  endPendingPermissionRequest,
  isPermissionRequestPending,
} from './pendingPermissionGuard';

describe('pendingPermissionGuard', () => {
  beforeEach(() => {
    endPendingPermissionRequest();
  });

  it('reports not pending before any request begins', () => {
    expect(isPermissionRequestPending()).toBe(false);
  });

  it('reports pending after a request begins', () => {
    beginPendingPermissionRequest();
    expect(isPermissionRequestPending()).toBe(true);
  });

  it('reports not pending again after a request ends', () => {
    beginPendingPermissionRequest();
    endPendingPermissionRequest();
    expect(isPermissionRequestPending()).toBe(false);
  });

  it('ending without a matching begin does not throw and stays not pending', () => {
    expect(() => endPendingPermissionRequest()).not.toThrow();
    expect(isPermissionRequestPending()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run colitis-app/src/features/appLock/pendingPermissionGuard.test.ts`
Expected: FAIL — `pendingPermissionGuard.ts` does not exist yet (module not found).

- [ ] **Step 3: Write the implementation**

Create `colitis-app/src/features/appLock/pendingPermissionGuard.ts`:

```typescript
let isPending = false;

export function beginPendingPermissionRequest(): void {
  isPending = true;
}

export function endPendingPermissionRequest(): void {
  isPending = false;
}

export function isPermissionRequestPending(): boolean {
  return isPending;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run colitis-app/src/features/appLock/pendingPermissionGuard.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün, keine neuen Typfehler.

- [ ] **Step 6: Commit**

```bash
git add colitis-app/src/features/appLock/pendingPermissionGuard.ts colitis-app/src/features/appLock/pendingPermissionGuard.test.ts
git commit -m "feat: Guard-Modul fuer laufende Berechtigungsanfragen ergaenzen"
```

---

### Task 2: Guard in Toiletten-Tab und App-Sperre verdrahten

**Files:**
- Modify: `colitis-app/app/(tabs)/toiletten/index.tsx`
- Modify: `colitis-app/src/features/appLock/useAppLockGate.ts`

**Interfaces:**
- Consumes: `beginPendingPermissionRequest`, `endPendingPermissionRequest`, `isPermissionRequestPending` aus `../../src/features/appLock/pendingPermissionGuard` bzw. `./pendingPermissionGuard` (Task 1).
- Produces: nichts für weitere Tasks (Task 3 ist unabhängig).

Diese Aufgabe ändert bestehende UI-/Hook-Dateien (keine neue reine Logik außer der bereits in Task 1 getesteten) – nicht automatisiert testbar. Verifikation über `tsc --noEmit`, die bestehende Vitest-Suite und manuellen Test in Schritt 3.

- [ ] **Step 1: Berechtigungsanfrage im Toiletten-Tab umschließen**

In `colitis-app/app/(tabs)/toiletten/index.tsx`, ändere den Import-Block (nach dem bestehenden `import * as Location from 'expo-location';`):

```typescript
import * as Location from 'expo-location';
import { ToiletMapView } from '../../../src/features/toilets/components/ToiletMapView';
```

zu:

```typescript
import * as Location from 'expo-location';
import {
  beginPendingPermissionRequest,
  endPendingPermissionRequest,
} from '../../../src/features/appLock/pendingPermissionGuard';
import { ToiletMapView } from '../../../src/features/toilets/components/ToiletMapView';
```

Ändere den bestehenden Block:

```typescript
      Location.requestForegroundPermissionsAsync()
        .then(async (permission) => {
          if (!isActive) {
            return;
          }
          if (permission.status !== 'granted') {
            setLocationDenied(true);
            setIsLocationResolved(true);
            return;
          }
          setLocationDenied(false);
          try {
            const position = await withTimeout(
              Location.getCurrentPositionAsync({}),
              LOCATION_TIMEOUT_MS,
              'Standortabfrage abgebrochen (Zeitüberschreitung).'
            );
            if (!isActive) {
              return;
            }
            const coords: Coordinates = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setUserLocation(coords);
            setMapCenter(coords);
            setLocationError(null);
            setIsLocationResolved(true);
            await searchAround(coords);
          } catch (error: unknown) {
            console.error('[Toiletten] Standort konnte nicht ermittelt werden:', error);
            if (isActive) {
              setLocationError(
                error instanceof TimeoutError ? error.message : 'Standort konnte nicht ermittelt werden.'
              );
              setIsLocationResolved(true);
            }
          }
        })
        .catch((error: unknown) => {
          console.error('[Toiletten] Standortberechtigung konnte nicht abgefragt werden:', error);
          if (isActive) {
            setLocationDenied(true);
            setIsLocationResolved(true);
          }
        });
```

zu:

```typescript
      beginPendingPermissionRequest();
      Location.requestForegroundPermissionsAsync()
        .then(async (permission) => {
          endPendingPermissionRequest();
          if (!isActive) {
            return;
          }
          if (permission.status !== 'granted') {
            setLocationDenied(true);
            setIsLocationResolved(true);
            return;
          }
          setLocationDenied(false);
          try {
            const position = await withTimeout(
              Location.getCurrentPositionAsync({}),
              LOCATION_TIMEOUT_MS,
              'Standortabfrage abgebrochen (Zeitüberschreitung).'
            );
            if (!isActive) {
              return;
            }
            const coords: Coordinates = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setUserLocation(coords);
            setMapCenter(coords);
            setLocationError(null);
            setIsLocationResolved(true);
            await searchAround(coords);
          } catch (error: unknown) {
            console.error('[Toiletten] Standort konnte nicht ermittelt werden:', error);
            if (isActive) {
              setLocationError(
                error instanceof TimeoutError ? error.message : 'Standort konnte nicht ermittelt werden.'
              );
              setIsLocationResolved(true);
            }
          }
        })
        .catch((error: unknown) => {
          endPendingPermissionRequest();
          console.error('[Toiletten] Standortberechtigung konnte nicht abgefragt werden:', error);
          if (isActive) {
            setLocationDenied(true);
            setIsLocationResolved(true);
          }
        });
```

`beginPendingPermissionRequest()` wird unmittelbar vor dem Aufruf gesetzt; `endPendingPermissionRequest()` steht als erste Zeile in **beiden** Zweigen (`.then`/`.catch`), da der native Berechtigungsdialog spätestens beim Settle dieses Promise vollständig geschlossen ist – die nachfolgende `getCurrentPositionAsync`-Abfrage zeigt keinen weiteren Dialog und muss nicht mehr geschützt werden.

- [ ] **Step 2: `useAppLockGate.ts` um die Guard-Prüfung erweitern**

In `colitis-app/src/features/appLock/useAppLockGate.ts`, ändere den Import:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { isAppLockEnabled } from './pinAuth';
```

zu:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { isAppLockEnabled } from './pinAuth';
import { isPermissionRequestPending } from './pendingPermissionGuard';
```

Ändere den bestehenden `AppState`-Listener-Block:

```typescript
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        return;
      }
      isAppLockEnabled()
```

zu:

```typescript
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        return;
      }
      if (isPermissionRequestPending()) {
        return;
      }
      isAppLockEnabled()
```

- [ ] **Step 3: Type-Check, volle Test-Suite und manueller Test**

Run (aus `colitis-app/`): `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run`
Expected: Keine Fehler, alle bestehenden Tests weiterhin grün.

Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build, idealerweise auf einem Gerät, auf dem die Standortberechtigung für diese App noch nicht erteilt wurde):
- App-Sperre in den Einstellungen aktivieren, App neu starten, PIN eingeben.
- Toiletten-Tab öffnen → Standort-Berechtigungsdialog erscheint → Berechtigung erteilen → keine erneute PIN-Abfrage.
- App wirklich in den Hintergrund schicken (Home-Taste) und zurückholen → PIN-Abfrage erscheint weiterhin wie gewollt (echtes Verlassen sperrt nach wie vor).

- [ ] **Step 4: Commit**

```bash
git add "colitis-app/app/(tabs)/toiletten/index.tsx" colitis-app/src/features/appLock/useAppLockGate.ts
git commit -m "fix: Faelschliches Re-Lock durch Standort-Berechtigungsdialog verhindern"
```

---

### Task 3: Bestätigungsabfrage beim Deaktivieren der App-Sperre

**Files:**
- Modify: `colitis-app/app/(tabs)/einstellungen/index.tsx`

**Interfaces:**
- Consumes: nichts aus vorherigen Tasks (unabhängige Aufgabe).
- Produces: nichts für weitere Tasks – letzte Aufgabe dieses Plans.

`Alert` ist in dieser Datei bereits importiert (`import { Alert, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';`) – keine Import-Änderung nötig. Diese Aufgabe ändert eine bestehende UI-Datei – nicht automatisiert testbar. Verifikation über `tsc --noEmit`, die bestehende Vitest-Suite und manuellen Test in Schritt 2.

- [ ] **Step 1: `handleToggleLock` um Bestätigungsdialog erweitern**

In `colitis-app/app/(tabs)/einstellungen/index.tsx`, ändere:

```typescript
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
```

zu:

```typescript
  function handleToggleLock(value: boolean) {
    setLockActionError(null);
    if (value) {
      setIsSettingPin(true);
      return;
    }
    Alert.alert('App-Sperre deaktivieren?', 'Möchtest du die App-Sperre wirklich deaktivieren?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Deaktivieren',
        style: 'destructive',
        onPress: () => void confirmDisableLock(),
      },
    ]);
  }

  async function confirmDisableLock() {
    try {
      await disableAppLock();
      setIsLockEnabled(false);
    } catch (error: unknown) {
      console.error('[Einstellungen] Sperre konnte nicht deaktiviert werden:', error);
      setLockActionError('Sperre konnte nicht deaktiviert werden. Bitte erneut versuchen.');
    }
  }
```

(Beachte: `handleToggleLock` ist jetzt synchron statt `async` – der bestehende Aufrufer `<SliderToggle onValueChange={handleToggleLock} />` erwartet `(value: boolean) => void`, was weiterhin exakt passt, da eine `async function`, die kein `await` mehr enthält, ebenfalls kompatibel wäre, hier aber bewusst zu einer einfachen synchronen Funktion vereinfacht wird, da sie selbst keine asynchrone Arbeit mehr direkt ausführt.)

- [ ] **Step 2: Type-Check, volle Test-Suite und manueller Test**

Run (aus `colitis-app/`): `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run`
Expected: Keine Fehler, alle bestehenden Tests weiterhin grün.

Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build):
- App-Sperre aktivieren (PIN setzen).
- Einstellungen-Tab → Schalter "App-Sperre" ausschalten wollen → Bestätigungsdialog erscheint.
- "Abbrechen" antippen → Schalter bleibt an, Sperre bleibt aktiv (App beim nächsten Start fragt weiterhin nach PIN).
- Erneut ausschalten wollen → "Deaktivieren" antippen → Schalter zeigt "aus", Sperre ist deaktiviert (App beim nächsten Start fragt nicht mehr nach PIN).

- [ ] **Step 3: Commit**

```bash
git add "colitis-app/app/(tabs)/einstellungen/index.tsx"
git commit -m "fix: Bestaetigungsabfrage vor Deaktivieren der App-Sperre ergaenzen"
```
