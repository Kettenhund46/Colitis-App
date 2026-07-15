# Polish & Testlauf (Schritt 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die bestehende Colitis-Ulcerosa-App bekommt einen App-weiten Konsistenz- und Robustheits-Durchgang: alle in der Design-Spec identifizierten Design-Inkonsistenzen und Fehlerbehandlungs-Lücken werden behoben, plus eine Alltagstest-Checkliste für den späteren Gerätetest.

**Architecture:** Sechs unabhängige, nach Codebereich gruppierte Teilaufgaben (nicht nach Design/Fehlerbehandlung getrennt), um Dateikonflikte zwischen aufeinanderfolgenden Arbeits-Agenten zu vermeiden: (1) App-Sperre, (2) Medikamente, (3) Toiletten, (4) Ladezustände, (5) Design-Tokens, (6) Dokumentation. Jede Aufgabe ist in sich abgeschlossen und produziert lauffähigen, unabhängig überprüfbaren Code. Reine Logik-Änderungen folgen TDD mit Vitest; React-Screen-/Hook-Änderungen (nicht automatisiert testbar, siehe Global Constraints) werden über `tsc --noEmit` und sorgfältiges Code-Lesen verifiziert.

**Tech Stack:** TypeScript, React Native/Expo Router (SDK 57), Drizzle ORM, Vitest, better-sqlite3 (Tests), `expo-secure-store`, `expo-sqlite`, `expo-local-authentication`, `react-native-webview`.

## Global Constraints

- Alle Datei-Pfade in diesem Plan sind relativ zu `colitis-app/` (dem Expo-Projektordner innerhalb des Repos `D:\Claude`).
- UI-Sprache: Deutsch, durchgehend, inklusive aller neuen Fehlermeldungen.
- Ausschließlich `tokens.*`-Werte aus `src/styles/tokens.ts` für Farben/Abstände/Typografie/Radius — keine neuen hartkodierten Werte.
- **Testing-Konvention (aus Schritt 2 bestätigt und in jedem Schritt seither angewendet):** React-Komponenten und React-Hooks sind unter dem aktuellen Vitest-Setup nicht sinnvoll automatisiert testbar (kein React Testing Library, `react-native`-Quellcode nutzt eine Syntax, die der Vitest-Transform nicht parsen kann). Änderungen an reinen, framework-freien Logik-/Repository-Dateien werden vollständig mit Vitest getestet (TDD: erst Test, dann Code). Änderungen an Screens/Hooks/Komponenten werden über `npx tsc --noEmit` und manuelles Code-Lesen verifiziert; die visuelle/interaktive Prüfung erfolgt beim späteren Alltagstest (Task 6 dieses Plans liefert dafür die Checkliste).
- `AGENTS.md` im Projekt weist darauf hin, dass sich Expo-APIs zwischen Versionen stark ändern — für diesen Plan werden keine neuen Expo-APIs eingeführt (nur bereits verwendete: `expo-secure-store`, `expo-sqlite`, `expo-local-authentication`) sowie Standard-`fetch`/`AbortController` (Web-Standard, kein Expo-spezifisches Verhalten) und bereits vorhandene `react-native-webview`-Props (`onError`, `onHttpError`, Teil der seit Version 13 stabilen API).
- Bei SecureStore-Fehlern rund um die App-Sperre gilt: sicherer Default ist **Sperre aktiv/erforderlich** (fail-closed), nie ein stillschweigendes Öffnen der App. Der Ausweg aus einem irregulären Zustand bleibt der bestehende "PIN vergessen"-Reset.
- Der App-Reset ("PIN vergessen") führt seine vier Schritte best-effort aus (jeder Schritt wird versucht, auch wenn ein vorheriger fehlschlägt) und wirft am Ende einen zusammenfassenden Fehler, wenn mindestens ein Schritt fehlgeschlagen ist — kein Abbruch nach dem ersten Fehler.
- Client-seitiges Timeout für Overpass-Anfragen: 15000 ms (`OVERPASS_CLIENT_TIMEOUT_MS`).
- Commit-Messages: `fix:`-Präfix für Fehlerbehebungen, `docs:`-Präfix für reine Dokumentation, deutsche Beschreibung, Umlaute als `ae`/`oe`/`ue`/`ss` transliteriert (Repo-Konvention).

## File Structure

Neu:
- `src/features/medications/dateValidation.ts` + `.test.ts` — geteilte Kalender-Validierung (Task 2)
- `docs/superpowers/colitis-app-alltagstest-checkliste.md` — Alltagstest-Checkliste (Task 6)

Geändert:
- `src/features/appLock/useAppLockGate.ts`, `src/features/appLock/components/LockScreen.tsx`, `src/lib/appReset.ts` (+ neuer Test), `app/(tabs)/einstellungen/index.tsx` (Task 1)
- `src/features/medications/formLogic.ts` (+ Test), `src/features/medications/components/ScreeningReminderCard.tsx`, `src/features/medications/reminderScheduling.ts` (+ Test), `src/features/medications/db/medicationsRepository.ts` (+ Test) (Task 2)
- `src/features/toilets/constants.ts`, `src/features/toilets/overpassClient.ts` (+ Test), `src/features/toilets/components/ToiletMapView.tsx`, `app/schnellzugriff.tsx` (Task 3)
- `app/(tabs)/tagebuch/index.tsx`, `app/(tabs)/tagebuch/auswertung.tsx`, `app/(tabs)/wissen/index.tsx`, `app/(tabs)/medikamente/index.tsx` (Task 4)
- `src/styles/tokens.ts`, `src/features/diary/components/DiaryEntryForm.tsx`, `src/features/toilets/components/SavedPlaceForm.tsx`, `src/features/medications/components/MedicationList.tsx`, `src/features/knowledge/content/articles.ts`, `src/features/appLock/components/LockScreen.tsx` (erneut, anderer Bereich), `app/+not-found.tsx`, `app/schnellzugriff.tsx` (erneut, anderer Bereich) (Task 5)

---

### Task 1: App-Sperre robuster machen

**Files:**
- Modify: `src/features/appLock/useAppLockGate.ts`
- Modify: `src/features/appLock/components/LockScreen.tsx`
- Modify: `src/lib/appReset.ts`
- Test: `src/lib/appReset.test.ts` (neu)
- Modify: `app/(tabs)/einstellungen/index.tsx`

**Interfaces:**
- Consumes: `isAppLockEnabled`, `verifyPin`, `setPin`, `disableAppLock`, `resetAppLock` aus `pinAuth.ts` (unverändert), `isBiometricsAvailable`, `authenticateWithBiometrics` aus `biometrics.ts` (unverändert), `DB_FILE_NAME`, `resetDbCache` aus `../db/client` (unverändert), `clearDbKey` aus `./encryption` (unverändert).
- Produces: `resetAppData(): Promise<void>` in `appReset.ts` — Signatur bleibt gleich, wirft jetzt einen zusammenfassenden `Error`, wenn mindestens ein interner Schritt fehlschlägt (vorher: kein Error-Handling). Kein neues öffentliches Interface für andere Tasks.

- [ ] **Step 1: Fehlschlagenden Test für `appReset.ts` schreiben**

Erstelle `src/lib/appReset.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const deleteDatabaseAsyncMock = vi.fn();
const resetDbCacheMock = vi.fn();
const clearDbKeyMock = vi.fn();
const resetAppLockMock = vi.fn();

vi.mock('expo-sqlite', () => ({
  deleteDatabaseAsync: (...args: unknown[]) => deleteDatabaseAsyncMock(...args),
}));

vi.mock('../db/client', () => ({
  DB_FILE_NAME: 'colitis.db',
  resetDbCache: () => resetDbCacheMock(),
}));

vi.mock('./encryption', () => ({
  clearDbKey: () => clearDbKeyMock(),
}));

vi.mock('../features/appLock/pinAuth', () => ({
  resetAppLock: () => resetAppLockMock(),
}));

import { resetAppData } from './appReset';

beforeEach(() => {
  vi.clearAllMocks();
  deleteDatabaseAsyncMock.mockResolvedValue(undefined);
  resetDbCacheMock.mockReturnValue(undefined);
  clearDbKeyMock.mockResolvedValue(undefined);
  resetAppLockMock.mockResolvedValue(undefined);
});

describe('resetAppData', () => {
  it('runs all reset steps when everything succeeds', async () => {
    await expect(resetAppData()).resolves.toBeUndefined();
    expect(deleteDatabaseAsyncMock).toHaveBeenCalledWith('colitis.db');
    expect(clearDbKeyMock).toHaveBeenCalled();
    expect(resetAppLockMock).toHaveBeenCalled();
    expect(resetDbCacheMock).toHaveBeenCalled();
  });

  it('still attempts every remaining step when one step fails, then throws naming it', async () => {
    clearDbKeyMock.mockRejectedValueOnce(new Error('SecureStore kaputt'));

    await expect(resetAppData()).rejects.toThrow('Datenbank-Schlüssel löschen');

    expect(deleteDatabaseAsyncMock).toHaveBeenCalled();
    expect(clearDbKeyMock).toHaveBeenCalled();
    expect(resetAppLockMock).toHaveBeenCalled();
    expect(resetDbCacheMock).toHaveBeenCalled();
  });

  it('names every failed step when multiple steps fail', async () => {
    deleteDatabaseAsyncMock.mockRejectedValueOnce(new Error('DB gesperrt'));
    resetAppLockMock.mockRejectedValueOnce(new Error('SecureStore kaputt'));

    let caught: unknown;
    try {
      await resetAppData();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toContain('Datenbank löschen');
    expect(message).toContain('PIN zurücksetzen');
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/lib/appReset.test.ts`
Expected: FAIL (aktuelle `resetAppData` wirft nie, `resolves.toBeUndefined()` läuft zwar durch, aber der zweite und dritte Test schlagen fehl, weil `resetAppData()` nicht wirft und die restlichen Mocks bei einem Fehlschlag aktuell gar nicht erst aufgerufen werden, da die vorhandene Implementierung bei einem Fehler in Schritt 2 sofort abbricht)

- [ ] **Step 3: `appReset.ts` implementieren**

Ersetze den Inhalt von `src/lib/appReset.ts`:

```typescript
import * as SQLite from 'expo-sqlite';
import { DB_FILE_NAME, resetDbCache } from '../db/client';
import { clearDbKey } from './encryption';
import { resetAppLock } from '../features/appLock/pinAuth';

interface ResetStepFailure {
  step: string;
  error: unknown;
}

export async function resetAppData(): Promise<void> {
  const failures: ResetStepFailure[] = [];

  await runResetStep(failures, 'Datenbank löschen', () => SQLite.deleteDatabaseAsync(DB_FILE_NAME));
  await runResetStep(failures, 'Datenbank-Schlüssel löschen', () => clearDbKey());
  await runResetStep(failures, 'PIN zurücksetzen', () => resetAppLock());
  await runResetStep(failures, 'Datenbank-Cache zurücksetzen', () => Promise.resolve(resetDbCache()));

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`[AppReset] Schritt fehlgeschlagen (${failure.step}):`, failure.error);
    }
    const failedSteps = failures.map((failure) => failure.step).join(', ');
    throw new Error(`Zurücksetzen unvollständig, folgende Schritte sind fehlgeschlagen: ${failedSteps}`);
  }
}

async function runResetStep(
  failures: ResetStepFailure[],
  step: string,
  action: () => Promise<void> | void
): Promise<void> {
  try {
    await action();
  } catch (error: unknown) {
    failures.push({ step, error });
  }
}
```

- [ ] **Step 4: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/lib/appReset.test.ts`
Expected: PASS (3 Tests)

- [ ] **Step 5: `useAppLockGate.ts` gegen SecureStore-Fehler absichern**

Ersetze den Inhalt von `src/features/appLock/useAppLockGate.ts`:

```typescript
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
```

- [ ] **Step 6: `LockScreen.tsx` gegen Biometrie-/PIN-/Reset-Fehler absichern**

In `src/features/appLock/components/LockScreen.tsx`, ersetze den Block von `const [pin, setPin] = useState('');` bis zum Ende von `handleResetConfirm` (Zeilen 14–69 im aktuellen Stand) durch:

```typescript
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    isBiometricsAvailable()
      .then(async (available) => {
        if (!isActive) {
          return;
        }
        setBiometricsAvailable(available);
        if (available) {
          try {
            const success = await authenticateWithBiometrics('Colitis-App entsperren');
            if (success && isActive) {
              onUnlock();
            }
          } catch (biometricsError: unknown) {
            console.error('[AppLock] Biometrie-Prüfung fehlgeschlagen:', biometricsError);
          }
        }
      })
      .catch((availabilityError: unknown) => {
        console.error('[AppLock] Biometrie-Verfügbarkeit konnte nicht geprüft werden:', availabilityError);
        if (isActive) {
          setBiometricsAvailable(false);
        }
      });
    return () => {
      isActive = false;
    };
  }, [onUnlock]);

  async function handleBiometricsRetry() {
    try {
      const success = await authenticateWithBiometrics('Colitis-App entsperren');
      if (success) {
        onUnlock();
      }
    } catch (biometricsError: unknown) {
      console.error('[AppLock] Biometrie-Entsperrung fehlgeschlagen:', biometricsError);
      setError('Biometrie ist gerade nicht verfügbar. Bitte PIN verwenden.');
    }
  }

  async function handlePinChange(text: string) {
    const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH);
    setPin(digitsOnly);
    setError(null);
    if (digitsOnly.length === PIN_LENGTH) {
      try {
        const isValid = await verifyPin(digitsOnly);
        if (isValid) {
          onUnlock();
        } else {
          setError('Falscher PIN. Bitte erneut versuchen.');
          setPin('');
        }
      } catch (verifyError: unknown) {
        console.error('[AppLock] PIN-Prüfung fehlgeschlagen:', verifyError);
        setError('PIN konnte nicht geprüft werden. Bitte erneut versuchen.');
        setPin('');
      }
    }
  }

  async function handleResetConfirm() {
    setIsResetting(true);
    setResetError(null);
    try {
      await onReset();
    } catch (resetErrorValue: unknown) {
      console.error('[AppLock] Zurücksetzen fehlgeschlagen:', resetErrorValue);
      setResetError('Zurücksetzen konnte nicht vollständig abgeschlossen werden. Bitte erneut versuchen.');
    } finally {
      setIsResetting(false);
    }
  }
```

Ergänze außerdem im `isResetMode`-Zweig der JSX (direkt nach dem `<Text style={styles.warning}>...</Text>`-Block, vor dem `<Text style={styles.label}>`) folgendes Element:

```tsx
        {resetError && <Text style={styles.warning}>{resetError}</Text>}
```

- [ ] **Step 7: `einstellungen/index.tsx` gegen fehlgeschlagene Sperr-Aktionen absichern**

In `app/(tabs)/einstellungen/index.tsx`, ersetze `handleToggleLock` und `handleSetPin`:

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
```

Füge direkt nach der Zeile `const [pinError, setPinError] = useState<string | null>(null);` eine neue State-Deklaration hinzu:

```typescript
  const [lockActionError, setLockActionError] = useState<string | null>(null);
```

Und rendere den Fehler direkt nach dem schließenden `</View>` der `row`-Zeile (nach dem `<Switch .../>`-Block, vor `{isSettingPin && (`):

```tsx
      {lockActionError && <Text style={styles.error}>{lockActionError}</Text>}
```

- [ ] **Step 8: Typprüfung ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 9: Gesamte Testsuite ausführen**

Run: `cd colitis-app && npx vitest run`
Expected: alle Tests grün (bestehende 178 + 3 neue aus Step 1)

- [ ] **Step 10: Commit**

```bash
git add src/features/appLock/useAppLockGate.ts src/features/appLock/components/LockScreen.tsx src/lib/appReset.ts src/lib/appReset.test.ts "app/(tabs)/einstellungen/index.tsx"
git commit -m "fix: App-Sperre robuster gegen SecureStore- und Reset-Fehler machen"
```

---

### Task 2: Medikamente-Validierung & Robustheit

**Files:**
- Create: `src/features/medications/dateValidation.ts`
- Test: `src/features/medications/dateValidation.test.ts` (neu)
- Modify: `src/features/medications/formLogic.ts`
- Modify: `src/features/medications/formLogic.test.ts`
- Modify: `src/features/medications/components/ScreeningReminderCard.tsx`
- Modify: `src/features/medications/reminderScheduling.ts`
- Modify: `src/features/medications/reminderScheduling.test.ts`
- Modify: `src/features/medications/db/medicationsRepository.ts`
- Modify: `src/features/medications/db/medicationsRepository.test.ts`

**Interfaces:**
- Consumes: `MedicationInput`, `MedicationFormState` aus `types.ts`/`formLogic.ts` (unverändert), `MedicationsDb` aus `medicationsRepository.ts` (unverändert).
- Produces: `isValidCalendarDate(value: string): boolean` in `dateValidation.ts` — wird von `formLogic.ts`, `ScreeningReminderCard.tsx` und `reminderScheduling.ts` innerhalb dieses Tasks konsumiert. Kein Task außerhalb dieses Tasks braucht diese Funktion.

- [ ] **Step 1: Fehlschlagenden Test für `dateValidation.ts` schreiben**

Erstelle `src/features/medications/dateValidation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isValidCalendarDate } from './dateValidation';

describe('isValidCalendarDate', () => {
  it('accepts a valid date', () => {
    expect(isValidCalendarDate('2026-07-12')).toBe(true);
  });

  it('accepts a valid leap day', () => {
    expect(isValidCalendarDate('2024-02-29')).toBe(true);
  });

  it('rejects a non-existent leap day', () => {
    expect(isValidCalendarDate('2026-02-29')).toBe(false);
  });

  it('rejects an out-of-range month', () => {
    expect(isValidCalendarDate('2026-13-01')).toBe(false);
  });

  it('rejects an out-of-range day', () => {
    expect(isValidCalendarDate('2026-01-45')).toBe(false);
  });

  it('rejects values that do not match the JJJJ-MM-TT format', () => {
    expect(isValidCalendarDate('12.07.2026')).toBe(false);
    expect(isValidCalendarDate('2026-7-12')).toBe(false);
    expect(isValidCalendarDate('')).toBe(false);
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/medications/dateValidation.test.ts`
Expected: FAIL mit "Cannot find module './dateValidation'"

- [ ] **Step 3: `dateValidation.ts` implementieren**

Erstelle `src/features/medications/dateValidation.ts`:

```typescript
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
```

- [ ] **Step 4: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/medications/dateValidation.test.ts`
Expected: PASS (6 Tests)

- [ ] **Step 5: Fehlschlagende Tests für `validateMedicationForm` ergänzen**

Füge in `src/features/medications/formLogic.test.ts` am Ende von `describe('validateMedicationForm', ...)` (vor der schließenden `});`) zwei neue Tests ein:

```typescript
  it('rejects a start date that does not exist on the calendar', () => {
    const errors = validateMedicationForm({
      ...INITIAL_MEDICATION_FORM_STATE,
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-13-45',
    });
    expect(errors).toContain('Bitte ein gültiges Startdatum eingeben (JJJJ-MM-TT).');
  });

  it('rejects an end date before the start date', () => {
    const errors = validateMedicationForm({
      ...INITIAL_MEDICATION_FORM_STATE,
      name: 'Salofalk',
      dose: '500mg',
      schedule: '1x täglich',
      startDate: '2026-07-12',
      endDate: '2026-07-01',
    });
    expect(errors).toContain('Das Enddatum darf nicht vor dem Startdatum liegen.');
  });
```

- [ ] **Step 6: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/medications/formLogic.test.ts`
Expected: FAIL (2 neue Tests schlagen fehl — `'2026-13-45'` besteht das reine Format-Regex, und es gibt noch keine Enddatum-vor-Startdatum-Prüfung)

- [ ] **Step 7: `formLogic.ts` implementieren**

Ersetze den gesamten Inhalt von `src/features/medications/formLogic.ts`:

```typescript
import { isValidCalendarDate } from './dateValidation';
import type { MedicationInput } from './types';

export interface MedicationFormState {
  name: string;
  dose: string;
  schedule: string;
  startDate: string;
  endDate: string;
  reminderTimes: string[];
}

export const INITIAL_MEDICATION_FORM_STATE: MedicationFormState = {
  name: '',
  dose: '',
  schedule: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  reminderTimes: [],
};

const REMINDER_TIME_PATTERN = /^([0-1]\d|2[0-3]):([0-5]\d)$/;

export function validateMedicationForm(state: MedicationFormState): string[] {
  const errors: string[] = [];

  if (state.name.trim().length === 0) {
    errors.push('Bitte einen Namen eingeben.');
  }
  if (state.dose.trim().length === 0) {
    errors.push('Bitte eine Dosis eingeben.');
  }
  if (state.schedule.trim().length === 0) {
    errors.push('Bitte ein Einnahmeschema eingeben.');
  }
  if (!isValidCalendarDate(state.startDate)) {
    errors.push('Bitte ein gültiges Startdatum eingeben (JJJJ-MM-TT).');
  }
  if (state.endDate.length > 0 && !isValidCalendarDate(state.endDate)) {
    errors.push('Bitte ein gültiges Enddatum eingeben (JJJJ-MM-TT) oder leer lassen.');
  }
  if (
    state.endDate.length > 0 &&
    isValidCalendarDate(state.startDate) &&
    isValidCalendarDate(state.endDate) &&
    state.endDate < state.startDate
  ) {
    errors.push('Das Enddatum darf nicht vor dem Startdatum liegen.');
  }
  for (const time of state.reminderTimes) {
    if (!REMINDER_TIME_PATTERN.test(time)) {
      errors.push(`Ungültige Erinnerungszeit: "${time}" (erwartet HH:mm).`);
    }
  }

  return errors;
}

export function buildMedicationInput(state: MedicationFormState): MedicationInput {
  return {
    name: state.name.trim(),
    dose: state.dose.trim(),
    schedule: state.schedule.trim(),
    startDate: state.startDate,
    endDate: state.endDate.length > 0 ? state.endDate : null,
    reminderTimes: state.reminderTimes,
  };
}

export function addReminderTime(times: string[], time: string): string[] {
  return [...times, time];
}

export function removeReminderTime(times: string[], index: number): string[] {
  return times.filter((_, i) => i !== index);
}
```

Änderungen gegenüber dem bisherigen Stand: neuer Import von `isValidCalendarDate`, das alte lokale `const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;` entfällt (ersetzt durch `isValidCalendarDate`), `validateMedicationForm` nutzt jetzt `isValidCalendarDate` statt `DATE_PATTERN.test(...)` und hat eine zusätzliche Enddatum-vor-Startdatum-Prüfung. Alle anderen Exporte (`INITIAL_MEDICATION_FORM_STATE`, `buildMedicationInput`, `addReminderTime`, `removeReminderTime`) bleiben inhaltlich unverändert.

- [ ] **Step 8: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/medications/formLogic.test.ts`
Expected: PASS (alle Tests, inkl. der 2 neuen)

- [ ] **Step 9: Fehlschlagenden Test für `buildScreeningReminderTrigger` mit ungültigem Datum schreiben**

Füge in `src/features/medications/reminderScheduling.test.ts` am Ende von `describe('buildScreeningReminderTrigger', ...)` einen neuen Test ein:

```typescript
  it('throws a German error for a calendar-invalid due date instead of silently rolling it over', () => {
    const now = new Date(2026, 0, 1, 8, 0, 0, 0);
    expect(() => buildScreeningReminderTrigger('2026-13-45', now)).toThrow('Ungültiges Vorsorge-Datum');
  });
```

- [ ] **Step 10: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/medications/reminderScheduling.test.ts`
Expected: FAIL (aktuell rollt `new Date(2027, 0, 15, ...)` das ungültige Datum still um, statt zu werfen)

- [ ] **Step 11: `reminderScheduling.ts` implementieren**

Ersetze den gesamten Inhalt von `src/features/medications/reminderScheduling.ts`:

```typescript
import { isValidCalendarDate } from './dateValidation';

export interface DailyTrigger {
  type: 'daily';
  hour: number;
  minute: number;
}

export interface DateTrigger {
  type: 'date';
  date: Date;
}

const REMINDER_TIME_PATTERN = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
const SCREENING_REMINDER_HOUR = 9;
const SCREENING_REMINDER_MINUTE = 0;

export function isValidReminderTime(time: string): boolean {
  return REMINDER_TIME_PATTERN.test(time);
}

export function buildDailyReminderTrigger(time: string): DailyTrigger {
  const match = REMINDER_TIME_PATTERN.exec(time);
  if (!match) {
    throw new Error(`Ungültige Erinnerungszeit: "${time}" (erwartet HH:mm)`);
  }
  return { type: 'daily', hour: Number(match[1]), minute: Number(match[2]) };
}

export function buildScreeningReminderTrigger(nextDueDate: string, now: Date): DateTrigger | null {
  if (!isValidCalendarDate(nextDueDate)) {
    throw new Error(`Ungültiges Vorsorge-Datum: "${nextDueDate}" (erwartet JJJJ-MM-TT)`);
  }
  const [year, month, day] = nextDueDate.split('-').map(Number);
  const dueDate = new Date(year, month - 1, day, SCREENING_REMINDER_HOUR, SCREENING_REMINDER_MINUTE, 0, 0);
  if (dueDate.getTime() <= now.getTime()) {
    return null;
  }
  return { type: 'date', date: dueDate };
}
```

Änderungen gegenüber dem bisherigen Stand: neuer Import von `isValidCalendarDate`, `buildScreeningReminderTrigger` wirft jetzt einen Fehler für ein kalendarisch ungültiges Datum statt es still umzurechnen. `DailyTrigger`, `DateTrigger`, `REMINDER_TIME_PATTERN`, `SCREENING_REMINDER_HOUR`/`SCREENING_REMINDER_MINUTE`, `isValidReminderTime` und `buildDailyReminderTrigger` bleiben inhaltlich unverändert.

- [ ] **Step 12: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/medications/reminderScheduling.test.ts`
Expected: PASS (alle Tests, inkl. dem neuen)

- [ ] **Step 13: `ScreeningReminderCard.tsx` auf `isValidCalendarDate` umstellen**

In `src/features/medications/components/ScreeningReminderCard.tsx`: ersetze die Zeile `import type { ScreeningReminder, NewScreeningReminderInput } from '../types';` durch:

```typescript
import { isValidCalendarDate } from '../dateValidation';
import type { ScreeningReminder, NewScreeningReminderInput } from '../types';
```

Entferne die Zeile `const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;` und ersetze in `handleSave` die Zeile `if (!DATE_PATTERN.test(nextDueDate)) {` durch:

```typescript
    if (!isValidCalendarDate(nextDueDate)) {
```

- [ ] **Step 14: Fehlschlagende Tests für Existenzprüfungen in `medicationsRepository.ts` schreiben**

Füge in `src/features/medications/db/medicationsRepository.test.ts` am Ende von `describe('medications repository', ...)` (vor der schließenden `});`) drei neue Tests ein:

```typescript
  it('throws when updating a medication that does not exist', async () => {
    await expect(
      updateMedication(db, 999999, {
        name: 'Ghost',
        dose: '1mg',
        schedule: '1x täglich',
        startDate: '2026-07-12',
        endDate: null,
        reminderTimes: [],
      })
    ).rejects.toThrow('Medikament mit ID 999999 wurde nicht gefunden.');
  });

  it('throws when logging a taken dose for a medication that does not exist', async () => {
    await expect(logMedicationTaken(db, 999999, '2026-07-12T08:00:00.000Z')).rejects.toThrow(
      'Medikament mit ID 999999 wurde nicht gefunden.'
    );
  });

  it('throws when ending a medication that does not exist', async () => {
    await expect(endMedication(db, 999999, '2026-08-01')).rejects.toThrow(
      'Medikament mit ID 999999 wurde nicht gefunden.'
    );
  });
```

- [ ] **Step 15: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/medications/db/medicationsRepository.test.ts`
Expected: FAIL (3 neue Tests — aktuell werfen `updateMedication`/`logMedicationTaken`/`endMedication` bei ungültiger ID keinen eigenen Fehler)

- [ ] **Step 16: `medicationsRepository.ts` implementieren**

Ersetze den gesamten Inhalt von `src/features/medications/db/medicationsRepository.ts`:

```typescript
import { asc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { medications, medicationReminderTimes, medicationLog } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { Medication, MedicationInput, MedicationReminderTime } from '../types';

export type MedicationsDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function createMedication(db: MedicationsDb, input: MedicationInput): Promise<Medication> {
  const [insertedMedication] = await db
    .insert(medications)
    .values({
      name: input.name,
      dose: input.dose,
      schedule: input.schedule,
      startDate: input.startDate,
      endDate: input.endDate,
    })
    .returning({ id: medications.id });

  const reminderTimes = await insertReminderTimes(db, insertedMedication.id, input.reminderTimes);

  return {
    id: insertedMedication.id,
    name: input.name,
    dose: input.dose,
    schedule: input.schedule,
    startDate: input.startDate,
    endDate: input.endDate,
    reminderTimes,
  };
}

async function insertReminderTimes(
  db: MedicationsDb,
  medicationId: number,
  times: string[]
): Promise<MedicationReminderTime[]> {
  const result: MedicationReminderTime[] = [];
  for (const time of times) {
    const [inserted] = await db
      .insert(medicationReminderTimes)
      .values({ medicationId, time, notificationId: null })
      .returning({ id: medicationReminderTimes.id });
    result.push({ id: inserted.id, time, notificationId: null });
  }
  return result;
}

async function loadReminderTimes(db: MedicationsDb, medicationId: number): Promise<MedicationReminderTime[]> {
  const rows = await db
    .select()
    .from(medicationReminderTimes)
    .where(eq(medicationReminderTimes.medicationId, medicationId));
  return rows.map((row) => ({ id: row.id, time: row.time, notificationId: row.notificationId }));
}

async function assertMedicationExists(db: MedicationsDb, medicationId: number): Promise<void> {
  const rows = await db.select({ id: medications.id }).from(medications).where(eq(medications.id, medicationId));
  if (rows.length === 0) {
    throw new Error(`Medikament mit ID ${medicationId} wurde nicht gefunden.`);
  }
}

export async function listMedications(db: MedicationsDb): Promise<Medication[]> {
  const medicationRows = await db.select().from(medications).orderBy(asc(medications.name));

  const result: Medication[] = [];
  for (const medication of medicationRows) {
    result.push({
      id: medication.id,
      name: medication.name,
      dose: medication.dose,
      schedule: medication.schedule,
      startDate: medication.startDate,
      endDate: medication.endDate,
      reminderTimes: await loadReminderTimes(db, medication.id),
    });
  }
  return result;
}

export async function getMedicationById(db: MedicationsDb, medicationId: number): Promise<Medication | null> {
  const rows = await db.select().from(medications).where(eq(medications.id, medicationId));
  if (rows.length === 0) {
    return null;
  }
  const medication = rows[0];
  return {
    id: medication.id,
    name: medication.name,
    dose: medication.dose,
    schedule: medication.schedule,
    startDate: medication.startDate,
    endDate: medication.endDate,
    reminderTimes: await loadReminderTimes(db, medication.id),
  };
}

export interface ReminderTimesReplaceResult {
  removed: MedicationReminderTime[];
  inserted: MedicationReminderTime[];
}

export async function updateMedication(
  db: MedicationsDb,
  medicationId: number,
  input: MedicationInput
): Promise<ReminderTimesReplaceResult> {
  await assertMedicationExists(db, medicationId);

  await db
    .update(medications)
    .set({
      name: input.name,
      dose: input.dose,
      schedule: input.schedule,
      startDate: input.startDate,
      endDate: input.endDate,
    })
    .where(eq(medications.id, medicationId));

  const removed = await loadReminderTimes(db, medicationId);

  await db.delete(medicationReminderTimes).where(eq(medicationReminderTimes.medicationId, medicationId));

  const inserted = await insertReminderTimes(db, medicationId, input.reminderTimes);

  return { removed, inserted };
}

export async function endMedication(
  db: MedicationsDb,
  medicationId: number,
  endDate: string
): Promise<MedicationReminderTime[]> {
  await assertMedicationExists(db, medicationId);
  await db.update(medications).set({ endDate }).where(eq(medications.id, medicationId));
  return loadReminderTimes(db, medicationId);
}

export async function setReminderTimeNotificationId(
  db: MedicationsDb,
  reminderTimeId: number,
  notificationId: string | null
): Promise<void> {
  await db
    .update(medicationReminderTimes)
    .set({ notificationId })
    .where(eq(medicationReminderTimes.id, reminderTimeId));
}

export async function logMedicationTaken(db: MedicationsDb, medicationId: number, takenAt: string): Promise<void> {
  await assertMedicationExists(db, medicationId);
  await db.insert(medicationLog).values({ medicationId, takenAt });
}
```

Änderungen gegenüber dem bisherigen Stand: neue private Hilfsfunktion `assertMedicationExists` (direkt nach `loadReminderTimes` eingefügt), aufgerufen als erste Zeile in `updateMedication`, `endMedication` und `logMedicationTaken`. `createMedication`, `listMedications`, `getMedicationById` und `setReminderTimeNotificationId` bleiben inhaltlich unverändert.

- [ ] **Step 17: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/medications/db/medicationsRepository.test.ts`
Expected: PASS (alle Tests, inkl. der 3 neuen)

- [ ] **Step 18: Typprüfung ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 19: Gesamte Testsuite ausführen**

Run: `cd colitis-app && npx vitest run`
Expected: alle Tests grün

- [ ] **Step 20: Commit**

```bash
git add src/features/medications/dateValidation.ts src/features/medications/dateValidation.test.ts src/features/medications/formLogic.ts src/features/medications/formLogic.test.ts src/features/medications/components/ScreeningReminderCard.tsx src/features/medications/reminderScheduling.ts src/features/medications/reminderScheduling.test.ts src/features/medications/db/medicationsRepository.ts src/features/medications/db/medicationsRepository.test.ts
git commit -m "fix: Kalender-Validierung und Existenzpruefungen fuer Medikamente ergaenzen"
```

---

### Task 3: Toiletten-Fehlerbehandlung

**Files:**
- Modify: `src/features/toilets/constants.ts`
- Modify: `src/features/toilets/overpassClient.ts`
- Modify: `src/features/toilets/overpassClient.test.ts`
- Modify: `src/features/toilets/components/ToiletMapView.tsx`
- Modify: `app/schnellzugriff.tsx`

**Interfaces:**
- Consumes: `buildOverpassToiletsQuery`, `parseOverpassResponse` aus `overpassClient.ts`-Nachbardateien (unverändert).
- Produces: `OVERPASS_CLIENT_TIMEOUT_MS: number` in `constants.ts` (neu, nur von `overpassClient.ts` und dessen Test konsumiert). `fetchNearbyToilets` behält seine Signatur `(center: Coordinates, radiusMeters: number) => Promise<Toilet[]>`.

- [ ] **Step 1: Timeout-Konstante ergänzen**

Ersetze den Inhalt von `src/features/toilets/constants.ts`:

```typescript
export const SEARCH_RADIUS_METERS = 1500;
export const REGION_CHANGE_THRESHOLD_METERS = 300;
export const OVERPASS_CLIENT_TIMEOUT_MS = 15000;
```

- [ ] **Step 2: Fehlschlagenden Test für das Client-Timeout schreiben**

Füge in `src/features/toilets/overpassClient.test.ts` am Anfang den Import der neuen Konstante hinzu (ersetze die bestehende Import-Zeile):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchNearbyToilets } from './overpassClient';
import { OVERPASS_CLIENT_TIMEOUT_MS } from './constants';
```

Füge am Ende von `describe('fetchNearbyToilets', ...)` (vor der schließenden `});`) einen neuen Test ein:

```typescript
  it('aborts the request after a client-side timeout and reports a German error', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce((_url: string, options: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const abortError = new Error('The operation was aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });

    const resultPromise = fetchNearbyToilets({ latitude: 0, longitude: 0 }, 1500);
    const assertion = expect(resultPromise).rejects.toThrow('Overpass-Anfrage abgebrochen (Zeitüberschreitung).');
    await vi.advanceTimersByTimeAsync(OVERPASS_CLIENT_TIMEOUT_MS);
    await assertion;

    vi.useRealTimers();
  });
```

- [ ] **Step 3: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/toilets/overpassClient.test.ts`
Expected: FAIL (der neue Test timet aus bzw. schlägt fehl, da `fetch` aktuell kein `signal` erhält und nie abgebrochen wird)

- [ ] **Step 4: `overpassClient.ts` implementieren**

Ersetze den Inhalt von `src/features/toilets/overpassClient.ts`:

```typescript
import { buildOverpassToiletsQuery } from './buildOverpassToiletsQuery';
import { parseOverpassResponse } from './parseOverpassResponse';
import { OVERPASS_CLIENT_TIMEOUT_MS } from './constants';
import type { Coordinates, Toilet } from './types';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

export async function fetchNearbyToilets(center: Coordinates, radiusMeters: number): Promise<Toilet[]> {
  const query = buildOverpassToiletsQuery(center, radiusMeters);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OVERPASS_CLIENT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Overpass-Anfrage abgebrochen (Zeitüberschreitung).');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Overpass-Anfrage fehlgeschlagen (Status ${response.status})`);
  }

  const data: unknown = await response.json();
  return parseOverpassResponse(data);
}
```

- [ ] **Step 5: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/toilets/overpassClient.test.ts`
Expected: PASS (alle Tests, inkl. dem neuen)

- [ ] **Step 6: `ToiletMapView.tsx` gegen WebView-Ladefehler absichern**

Ersetze den Inhalt von `src/features/toilets/components/ToiletMapView.tsx`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { MAP_HTML } from '../mapHtml.generated';
import { tokens } from '../../../styles/tokens';
import type { Coordinates, SavedPlace, Toilet, WebViewToNativeMessage } from '../types';

interface ToiletMapViewProps {
  center: Coordinates;
  toilets: Toilet[];
  savedPlaces: SavedPlace[];
  onRegionChange: (center: Coordinates) => void;
  onMarkerTap: (id: string, kind: 'toilet' | 'place') => void;
  onLongPress: (coordinates: Coordinates) => void;
}

export function ToiletMapView({
  center,
  toilets,
  savedPlaces,
  onRegionChange,
  onMarkerTap,
  onLongPress,
}: ToiletMapViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const isRegionChangeEchoRef = useRef(false);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (isRegionChangeEchoRef.current) {
      isRegionChangeEchoRef.current = false;
      return;
    }
    webViewRef.current?.injectJavaScript(`window.setCenter(${center.latitude}, ${center.longitude}); true;`);
  }, [isReady, center]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    webViewRef.current?.injectJavaScript(`window.setToilets(${JSON.stringify(JSON.stringify(toilets))}); true;`);
  }, [isReady, toilets]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    webViewRef.current?.injectJavaScript(`window.setSavedPlaces(${JSON.stringify(JSON.stringify(savedPlaces))}); true;`);
  }, [isReady, savedPlaces]);

  function handleMessage(event: { nativeEvent: { data: string } }) {
    let message: WebViewToNativeMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as WebViewToNativeMessage;
    } catch {
      return;
    }

    if (message.type === 'ready') {
      setIsReady(true);
    } else if (message.type === 'regionChange') {
      isRegionChangeEchoRef.current = true;
      onRegionChange({ latitude: message.latitude, longitude: message.longitude });
    } else if (message.type === 'markerTap') {
      onMarkerTap(message.id, message.kind);
    } else if (message.type === 'longPress') {
      onLongPress({ latitude: message.latitude, longitude: message.longitude });
    }
  }

  function handleLoadError() {
    setHasLoadError(true);
  }

  if (hasLoadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Karte konnte nicht geladen werden.</Text>
      </View>
    );
  }

  return (
    <WebView
      ref={webViewRef}
      style={styles.webview}
      source={{ html: MAP_HTML }}
      onMessage={handleMessage}
      onError={handleLoadError}
      onHttpError={handleLoadError}
      originWhitelist={['*']}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.md,
    textAlign: 'center',
  },
});
```

- [ ] **Step 7: `schnellzugriff.tsx` — echten Fehler von "keine Kandidaten" unterscheiden**

In `app/schnellzugriff.tsx`: ersetze die Zeile `type Status = 'loading' | 'no-location' | 'no-candidates' | 'done';` durch:

```typescript
type Status = 'loading' | 'no-location' | 'no-candidates' | 'error' | 'done';
```

Ersetze den `run().catch(...)`-Block:

```typescript
    run().catch((error: unknown) => {
      console.error('[Schnellzugriff] Fehler:', error);
      if (isActive) {
        setStatus('error');
      }
    });
```

Ersetze die `message`-Berechnung:

```typescript
  const message =
    status === 'no-location'
      ? 'Standort nicht verfügbar. Bitte Standortberechtigung erteilen.'
      : status === 'error'
      ? 'Es ist ein Fehler aufgetreten. Bitte versuche es erneut.'
      : 'Es sind noch keine Toiletten oder sicheren Orte bekannt.';
```

- [ ] **Step 8: Typprüfung ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 9: Gesamte Testsuite ausführen**

Run: `cd colitis-app && npx vitest run`
Expected: alle Tests grün

- [ ] **Step 10: Commit**

```bash
git add src/features/toilets/constants.ts src/features/toilets/overpassClient.ts src/features/toilets/overpassClient.test.ts src/features/toilets/components/ToiletMapView.tsx app/schnellzugriff.tsx
git commit -m "fix: Fehlerbehandlung im Toiletten-Feature haerten"
```

---

### Task 4: Ladezustände ergänzen

**Files:**
- Modify: `app/(tabs)/tagebuch/index.tsx`
- Modify: `app/(tabs)/tagebuch/auswertung.tsx`
- Modify: `app/(tabs)/wissen/index.tsx`
- Modify: `app/(tabs)/medikamente/index.tsx`

**Interfaces:**
- Consumes: unverändert (`listDiaryEntries`, `computeTriggerPatterns`, `listKnowledgeArticles`, `listMedications`, `getScreeningReminder`).
- Produces: kein neues Interface — reine UI-Zustandsergänzung innerhalb der jeweiligen Screen-Komponente.

Keine automatisierten Tests für diesen Task (React-Screen-Komponenten, siehe Global Constraints). Verifikation über `tsc --noEmit` und manuelles Lesen.

- [ ] **Step 1: `tagebuch/index.tsx` — Ladezustand ergänzen**

Ersetze den Inhalt von `app/(tabs)/tagebuch/index.tsx`:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { listDiaryEntries } from '../../../src/features/diary/db/diaryRepository';
import { DiaryHistoryList } from '../../../src/features/diary/components/DiaryHistoryList';
import { tokens } from '../../../src/styles/tokens';
import type { DiaryEntryWithTriggers } from '../../../src/features/diary/types';

export default function TagebuchScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryEntryWithTriggers[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Einträge werden geladen …</Text>
        </View>
      ) : (
        <DiaryHistoryList entries={entries} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
  },
  analysisLink: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    padding: tokens.spacing.md,
  },
  analysisLinkText: {
    color: tokens.colors.primary,
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
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
  },
  addButton: {
    position: 'absolute',
    right: tokens.spacing.lg,
    bottom: tokens.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  addButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
```

- [ ] **Step 2: `tagebuch/auswertung.tsx` — Ladezustand ergänzen**

Ersetze den Inhalt von `app/(tabs)/tagebuch/auswertung.tsx`:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { listDiaryEntries } from '../../../src/features/diary/db/diaryRepository';
import { computeTriggerPatterns } from '../../../src/features/diary/analysis';
import { TriggerAnalysisView } from '../../../src/features/diary/components/TriggerAnalysisView';
import { tokens } from '../../../src/styles/tokens';
import type { TriggerPatternStat } from '../../../src/features/diary/analysis';

export default function AuswertungScreen() {
  const [patterns, setPatterns] = useState<TriggerPatternStat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then((db) => listDiaryEntries(db))
        .then((entries) => {
          if (isActive) {
            setPatterns(computeTriggerPatterns(entries));
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Auswertung] Laden der Auswertung fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Auswertung konnte nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Auswertung wird geladen …</Text>
        </View>
      ) : (
        <TriggerAnalysisView patterns={patterns} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  loadingText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
  },
});
```

- [ ] **Step 3: `wissen/index.tsx` — Ladezustand ergänzen**

Ersetze den Inhalt von `app/(tabs)/wissen/index.tsx`:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { seedKnowledgeArticles, listKnowledgeArticles } from '../../../src/features/knowledge/db/knowledgeRepository';
import { filterKnowledgeArticles } from '../../../src/features/knowledge/search';
import { KnowledgeArticleList } from '../../../src/features/knowledge/components/KnowledgeArticleList';
import { tokens } from '../../../src/styles/tokens';
import type { KnowledgeArticle } from '../../../src/features/knowledge/types';

export default function WissenScreen() {
  const router = useRouter();
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
      <TextInput
        style={styles.searchInput}
        placeholder="Artikel durchsuchen …"
        placeholderTextColor={tokens.colors.textSecondary}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    margin: tokens.spacing.md,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  loadingText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
  },
});
```

- [ ] **Step 4: `medikamente/index.tsx` — Ladezustand ergänzen**

In `app/(tabs)/medikamente/index.tsx`: füge nach `const [error, setError] = useState<string | null>(null);` eine neue State-Deklaration hinzu:

```typescript
  const [isLoading, setIsLoading] = useState(true);
```

Ersetze den `useFocusEffect`-Block:

```typescript
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then(async (db) => {
          const [loadedMedications, loadedScreening] = await Promise.all([
            listMedications(db),
            getScreeningReminder(db),
          ]);
          if (isActive) {
            setMedications(loadedMedications);
            setScreeningReminder(loadedScreening);
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
```

Ersetze im JSX den `<MedicationList .../>`-Aufruf:

```tsx
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Medikamente werden geladen …</Text>
        </View>
      ) : (
        <MedicationList
          medications={medications}
          today={new Date()}
          onTakenToday={handleTakenToday}
          onEnd={handleEnd}
          onEdit={(medicationId) => router.push(`/medikamente/${medicationId}`)}
        />
      )}
```

Ergänze im `StyleSheet.create`-Objekt (nach `errorText`) zwei neue Style-Einträge:

```typescript
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  loadingText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
  },
```

- [ ] **Step 5: Typprüfung ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 6: Gesamte Testsuite ausführen (Regressionscheck)**

Run: `cd colitis-app && npx vitest run`
Expected: alle Tests grün (dieser Task ändert keine getestete Logik)

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/tagebuch/index.tsx" "app/(tabs)/tagebuch/auswertung.tsx" "app/(tabs)/wissen/index.tsx" "app/(tabs)/medikamente/index.tsx"
git commit -m "fix: Ladezustaende in den Listen-Screens ergaenzen"
```

---

### Task 5: Design-Token-Konsistenz

**Files:**
- Modify: `src/styles/tokens.ts`
- Modify: `src/features/diary/components/DiaryEntryForm.tsx`
- Modify: `src/features/toilets/components/SavedPlaceForm.tsx`
- Modify: `src/features/medications/components/MedicationList.tsx`
- Modify: `src/features/knowledge/content/articles.ts`
- Modify: `src/features/appLock/components/LockScreen.tsx`
- Modify: `app/+not-found.tsx`
- Modify: `app/schnellzugriff.tsx`

**Interfaces:**
- Produces: `tokens.radius: { sm: 8, md: 12, pill: 20 }` in `src/styles/tokens.ts` — additiv, bestehende `tokens.colors`/`tokens.spacing`/`tokens.typography`-Nutzung bleibt unverändert.

Keine automatisierten Tests für die Komponenten-/Text-Änderungen in diesem Task (reine Stil-/Text-Konsistenz, kein neues Verhalten). Verifikation über `tsc --noEmit` und manuelles Lesen.

- [ ] **Step 1: `radius`-Token ergänzen**

Ersetze den Inhalt von `src/styles/tokens.ts`:

```typescript
const colors = {
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
} as const;

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

export const tokens = { colors, spacing, typography, radius } as const;
```

- [ ] **Step 2: Chip-Radius in `DiaryEntryForm.tsx` vereinheitlichen**

In `src/features/diary/components/DiaryEntryForm.tsx`, im `choiceButton`-Style-Eintrag: ersetze

```typescript
    borderRadius: 20,
```

durch

```typescript
    borderRadius: tokens.radius.pill,
```

- [ ] **Step 3: Chip-Radius in `SavedPlaceForm.tsx` vereinheitlichen**

In `src/features/toilets/components/SavedPlaceForm.tsx`, im `chip`-Style-Eintrag: ersetze

```typescript
    borderRadius: 16,
```

durch

```typescript
    borderRadius: tokens.radius.pill,
```

- [ ] **Step 4: Anführungszeichen in `MedicationList.tsx` korrigieren**

In `src/features/medications/components/MedicationList.tsx`, Zeile 19: ersetze

```
          Noch keine Medikamente. Tippe auf „+", um dein erstes Medikament anzulegen.
```

durch

```
          Noch keine Medikamente. Tippe auf „+“, um dein erstes Medikament anzulegen.
```

(schließendes Anführungszeichen von geradem `"` auf `“` U+201C geändert, passend zum Referenzmuster in `DiaryHistoryList.tsx:30`)

- [ ] **Step 5: Anführungszeichen in `LockScreen.tsx` korrigieren**

In `src/features/appLock/components/LockScreen.tsx`: ersetze

```
        <Text style={styles.label}>Tippe zur Bestätigung "{RESET_CONFIRMATION_PHRASE}" ein:</Text>
```

durch

```
        <Text style={styles.label}>Tippe zur Bestätigung „{RESET_CONFIRMATION_PHRASE}“ ein:</Text>
```

- [ ] **Step 6: Anführungszeichen in `articles.ts` korrigieren (10 Stellen)**

In `src/features/knowledge/content/articles.ts`, ersetze jedes der folgenden schließenden geraden Anführungszeichen (`"`, U+0022) durch das deutsche schließende Anführungszeichen `“` (U+201C) — die öffnenden `„` (U+201E) bleiben unverändert:

1. Zeile 7: `„Skip-Läsionen".` → `„Skip-Läsionen“.`
2. Zeile 26: `„Leaky Gut")` → `„Leaky Gut“)`
3. Zeile 44: `„Treat-to-Target"` → `„Treat-to-Target“`
4. Zeile 48: `„Advanced Therapies"` → `„Advanced Therapies“`
5. Zeile 52 (erstes Vorkommen): `„Colitis-Ulcerosa-Diät"` → `„Colitis-Ulcerosa-Diät“`
6. Zeile 52 (zweites Vorkommen): `„Klinische Ernährung bei CED"` → `„Klinische Ernährung bei CED“`
7. Zeile 95: `„Trial-and-Error"-Ansatz` → `„Trial-and-Error“-Ansatz`
8. Zeile 97: `„atypischer"` → `„atypischer“`
9. Zeile 101: `„auf Rezept")` → `„auf Rezept“)`
10. Zeile 128: `„Small Molecules"` → `„Small Molecules“`

- [ ] **Step 7: `+not-found.tsx` an Design-Tokens anschließen**

Ersetze den Inhalt von `app/+not-found.tsx`:

```typescript
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../src/styles/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Nicht gefunden' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Diese Seite existiert nicht.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Zur Startseite</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  title: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.textPrimary,
  },
  link: {
    marginTop: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  linkText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.accent,
  },
});
```

- [ ] **Step 8: Button-Farbkonvention in `schnellzugriff.tsx` angleichen**

In `app/schnellzugriff.tsx`, im `button`-Style-Eintrag (im `StyleSheet.create`-Objekt): ersetze

```typescript
    backgroundColor: tokens.colors.primary,
```

durch

```typescript
    backgroundColor: tokens.colors.accent,
```

- [ ] **Step 9: Typprüfung ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 10: Gesamte Testsuite ausführen (Regressionscheck)**

Run: `cd colitis-app && npx vitest run`
Expected: alle Tests grün (dieser Task ändert keine getestete Logik)

- [ ] **Step 11: Commit**

```bash
git add src/styles/tokens.ts src/features/diary/components/DiaryEntryForm.tsx src/features/toilets/components/SavedPlaceForm.tsx src/features/medications/components/MedicationList.tsx src/features/knowledge/content/articles.ts src/features/appLock/components/LockScreen.tsx app/+not-found.tsx app/schnellzugriff.tsx
git commit -m "fix: Design-Token-Konsistenz herstellen (Radius, Anfuehrungszeichen, Scaffold-Screen, Button-Farbe)"
```

---

### Task 6: Alltagstest-Checkliste erstellen

**Files:**
- Create: `docs/superpowers/colitis-app-alltagstest-checkliste.md` (Pfad relativ zum Repo-Root `D:\Claude`, **nicht** `colitis-app/`)

**Interfaces:**
- Keine — reines Dokument, keine Code-Abhängigkeiten.

- [ ] **Step 1: Checkliste erstellen**

Erstelle `docs/superpowers/colitis-app-alltagstest-checkliste.md` (Pfad relativ zu `D:\Claude`):

```markdown
# Colitis-App – Alltagstest-Checkliste

Für den späteren Test auf einem echten Android-Gerät bzw. Emulator (in der
Entwicklungsumgebung nicht möglich — kein Android-Gerät verfügbar). Diese
Checkliste wird nicht in dieser Sitzung abgehakt, sondern dient als Vorlage,
sobald ein Testgerät zur Verfügung steht.

## Standort-Berechtigung

- [ ] Standortberechtigung beim ersten Öffnen des Toiletten-Tabs erteilen — Karte zentriert auf den eigenen Standort
- [ ] Standortberechtigung verweigern — Karte bleibt mit Standard-Ausschnitt und deutschem Hinweisbanner nutzbar
- [ ] Standortberechtigung nachträglich in den Systemeinstellungen erteilen, App neu öffnen — Karte zentriert danach korrekt

## Benachrichtigungen

- [ ] Erinnerungszeit für ein Medikament anlegen — Benachrichtigungserlaubnis wird angefragt
- [ ] Erlaubnis erteilen — tägliche Erinnerung löst zur eingestellten Uhrzeit tatsächlich aus
- [ ] Erlaubnis verweigern — Erinnerungszeit wird trotzdem gespeichert und angezeigt, nur ohne Push
- [ ] Vorsorge-Koloskopie-Reminder mit nahem Datum anlegen — einmalige Benachrichtigung löst zum Termin aus
- [ ] Medikament beenden — zugehörige Erinnerungen werden storniert (keine Benachrichtigung mehr danach)

## PIN-/Biometrie-Sperre

- [ ] PIN-Sperre in den Einstellungen aktivieren — App verlangt PIN beim nächsten Start
- [ ] App in den Hintergrund schicken und zurückholen — Sperrbildschirm erscheint erneut
- [ ] Falschen PIN eingeben — verständliche deutsche Fehlermeldung, kein Absturz
- [ ] Biometrie einrichten (falls Gerät es unterstützt) — Schnellzugriff funktioniert, PIN bleibt als Rückfallebene nutzbar
- [ ] "PIN vergessen" durchlaufen (auf einem Testgerät mit vorher erstelltem Backup!) — App verhält sich wie eine Neuinstallation
- [ ] PIN-Sperre wieder deaktivieren — kein Sperrbildschirm mehr beim nächsten Start

## Backup/Restore

- [ ] Backup über "Backup erstellen" exportieren — System-Teilen-Dialog öffnet sich mit der Sicherungsdatei
- [ ] Backup mit falschem Passwort importieren — verständliche deutsche Fehlermeldung ("Falsches Passwort …")
- [ ] Echten Restore-Durchlauf mit korrektem Passwort durchführen — alle Daten (Tagebuch, Medikamente, sichere Orte, Vorsorge-Termin) sind danach wieder vorhanden
- [ ] Nach einem Restore prüfen, dass Medikamenten-Erinnerungen neu geplant wurden (z. B. über die Systembenachrichtigungs-Einstellungen)

## Offline-Verhalten

- [ ] Flugmodus aktivieren, Toiletten-Tab öffnen und Karte verschieben — zuletzt geladene Toiletten erscheinen mit Offline-Hinweistext statt Fehler
- [ ] Flugmodus aktivieren, Homescreen-Schnellzugriff "Nächste Toilette" antippen — findet ohne Netzabfrage den nächstgelegenen gecachten Punkt und öffnet die Navigations-App
- [ ] Flugmodus deaktivieren, Karte erneut verschieben — Live-Suche funktioniert wieder normal

## Allgemeiner Alltagseindruck

- [ ] Ladezeiten beim App-Start und beim Wechseln zwischen Tabs fühlen sich nicht zu lang an
- [ ] Lesbarkeit und Kontrast bei Tageslicht auf dem echten Bildschirm prüfen
- [ ] Bedienbarkeit unter Stress/im (simulierten) akuten Schub-Zustand: sind die wichtigsten Aktionen (Toiletten-Finder, Tagebuch-Eintrag) mit wenigen Tipps erreichbar?
- [ ] Schriftgröße bei aktivierten System-Bedienungshilfen (größere Schrift) prüfen — kein abgeschnittener Text
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/colitis-app-alltagstest-checkliste.md
git commit -m "docs: Alltagstest-Checkliste fuer Schritt 8 anlegen"
```
