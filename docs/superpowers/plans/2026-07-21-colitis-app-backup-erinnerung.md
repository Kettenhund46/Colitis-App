# Backup-Erinnerung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine lokale Push-Erinnerung, die nach einem konfigurierbaren Intervall seit dem letzten erfolgreichen Backup-Export auslöst, verwaltbar über einen neuen Abschnitt im Einstellungen-Tab.

**Architecture:** Geräte-lokaler Zustand (Intervall, letzter Backup-Zeitpunkt, Ein/Aus, aktuelle Notification-ID) in `AsyncStorage` über `settingsStorage.ts`. Reine, unit-getestete Berechnungslogik (wann ist die nächste Erinnerung fällig, ist die Erinnerung aktuell effektiv aktiv) in einer neuen `reminderScheduling.ts` im Backup-Feature. Eine Orchestrierungsfunktion verbindet beides mit dem bereits vorhandenen, generischen `expo-notifications`-Wrapper (umgezogen von `features/medications/notifications/` nach `src/lib/notifications/`, da er inhaltlich kein Medikamenten-Bezug hat und jetzt von zwei Features gemeinsam genutzt wird).

**Tech Stack:** React Native (Expo SDK 57), TypeScript, `expo-notifications`, `@react-native-async-storage/async-storage`, Vitest.

## Global Constraints

- Zielverzeichnis für neue/verschobene Dateien: `D:\Claude\colitis-app` (Repo-Root ist `D:\Claude`, App liegt im Unterordner `colitis-app`)
- Alle Nutzertexte auf Deutsch, konsistent mit dem Rest der App
- Kein Cloud-/Netzwerk-Zugriff — alles bleibt lokal auf dem Gerät (siehe Grundsatz aus der Backup-Spec)
- Restore (Backup wiederherstellen) zählt **nicht** als Backup-Ereignis und darf `lastBackupAt` nicht verändern
- Tests mit `npx.cmd vitest run <pfad>` (Windows/PowerShell — `npx` allein schlägt fehl, siehe Projekt-Historie)
- Nach jeder Aufgabe: `npx.cmd tsc --noEmit --pretty false` läuft ohne neue Fehler (die vorbestehende `@react-native-async-storage/async-storage`-Typdeklarations-Warnung ist bekannt und nicht Teil dieser Aufgabe)

---

## Task 1: `notificationService` nach `src/lib/notifications/` verschieben

**Files:**
- Create: `colitis-app/src/lib/notifications/notificationService.ts` (Inhalt 1:1 aus der alten Datei, nur der relative Import angepasst)
- Create: `colitis-app/src/lib/notifications/notificationService.test.ts` (Inhalt 1:1 aus der alten Testdatei, keine Änderungen nötig)
- Delete: `colitis-app/src/features/medications/notifications/notificationService.ts`
- Delete: `colitis-app/src/features/medications/notifications/notificationService.test.ts`
- Modify: `colitis-app/src/features/medications/notifications/reminderContent.ts:1`
- Modify: `colitis-app/src/features/backup/rescheduleReminders.ts:1-7`
- Modify: `colitis-app/app/(tabs)/medikamente/index.tsx:18-24`
- Modify: `colitis-app/app/(tabs)/medikamente/neu.tsx:9-12`
- Modify: `colitis-app/app/(tabs)/medikamente/[id].tsx:11-14`

**Interfaces:**
- Produces: `configureNotificationHandling(): void`, `requestNotificationPermission(): Promise<boolean>`, `scheduleDailyReminder(time: string, content: ReminderContent): Promise<string>`, `scheduleScreeningReminder(nextDueDate: string, content: ReminderContent, now?: Date): Promise<string | null>`, `cancelScheduledReminder(id: string): Promise<void>`, `cancelAllScheduledReminders(): Promise<void>`, `interface ReminderContent { title: string; body: string }` — jetzt importierbar unter `../../lib/notifications/notificationService` (aus `app/(tabs)/medikamente/*`) bzw. `../../../lib/notifications/notificationService` (aus `src/features/medications/notifications/*` und `src/features/backup/*`)

- [ ] **Step 1: Neue Datei am Zielort mit angepasstem Import anlegen**

Lies den kompletten aktuellen Inhalt von `colitis-app/src/features/medications/notifications/notificationService.ts`. Schreibe ihn unverändert nach `colitis-app/src/lib/notifications/notificationService.ts`, bis auf die erste Import-Zeile:

```typescript
import { buildDailyReminderTrigger, buildScreeningReminderTrigger } from '../../features/medications/reminderScheduling';
```

(vorher: `from '../reminderScheduling'`)

- [ ] **Step 2: Testdatei unverändert an den Zielort kopieren**

Kopiere `colitis-app/src/features/medications/notifications/notificationService.test.ts` 1:1 nach `colitis-app/src/lib/notifications/notificationService.test.ts` — diese Datei importiert nur relativ von `./notificationService`, braucht also keine Anpassung.

- [ ] **Step 3: Alte Dateien löschen**

```bash
rm "colitis-app/src/features/medications/notifications/notificationService.ts"
rm "colitis-app/src/features/medications/notifications/notificationService.test.ts"
```

- [ ] **Step 4: Importierende Dateien anpassen**

In `colitis-app/src/features/medications/notifications/reminderContent.ts:1`:
```typescript
import type { ReminderContent } from '../../../lib/notifications/notificationService';
```

In `colitis-app/src/features/backup/rescheduleReminders.ts:1-7`:
```typescript
import {
  cancelAllScheduledReminders,
  configureNotificationHandling,
  requestNotificationPermission,
  scheduleDailyReminder,
  scheduleScreeningReminder,
} from '../../lib/notifications/notificationService';
```

In `colitis-app/app/(tabs)/medikamente/index.tsx:18-24` (nur die letzte Zeile des bestehenden Mehrzeilen-Imports ändert sich):
```typescript
} from '../../../src/lib/notifications/notificationService';
```

In `colitis-app/app/(tabs)/medikamente/neu.tsx:9-12` (letzte Zeile):
```typescript
} from '../../../src/lib/notifications/notificationService';
```

In `colitis-app/app/(tabs)/medikamente/[id].tsx:11-14` (letzte Zeile):
```typescript
} from '../../../src/lib/notifications/notificationService';
```

- [ ] **Step 5: Verifikation**

```bash
cd colitis-app
npx.cmd tsc --noEmit --pretty false
npx.cmd vitest run src/lib/notifications/notificationService.test.ts src/features/medications src/features/backup
```
Erwartet: keine Typfehler außer der bekannten `@react-native-async-storage/async-storage`-Warnung; alle Tests grün (gleiche Anzahl wie vorher, nur der Dateipfad hat sich geändert).

- [ ] **Step 6: Commit**

```bash
cd D:/Claude
git add colitis-app/src/lib/notifications/notificationService.ts colitis-app/src/lib/notifications/notificationService.test.ts colitis-app/src/features/medications/notifications/reminderContent.ts colitis-app/src/features/backup/rescheduleReminders.ts "colitis-app/app/(tabs)/medikamente/index.tsx" "colitis-app/app/(tabs)/medikamente/neu.tsx" "colitis-app/app/(tabs)/medikamente/[id].tsx"
git rm colitis-app/src/features/medications/notifications/notificationService.ts colitis-app/src/features/medications/notifications/notificationService.test.ts
git commit -m "refactor: notificationService nach src/lib/notifications verschieben"
```

---

## Task 2: `settingsStorage.ts` um Backup-Erinnerungs-Einstellungen erweitern

**Files:**
- Modify: `colitis-app/src/features/settings/settingsStorage.ts`
- Modify: `colitis-app/src/features/settings/settingsStorage.test.ts`

**Interfaces:**
- Consumes: nichts Neues (nutzt weiterhin `AsyncStorage` wie der Rest der Datei)
- Produces: `getBackupReminderEnabledRaw(): Promise<boolean | null>`, `setBackupReminderEnabled(enabled: boolean): Promise<void>`, `getBackupReminderIntervalDays(): Promise<number>`, `setBackupReminderIntervalDays(days: number): Promise<void>`, `getLastBackupAt(): Promise<string | null>`, `setLastBackupAt(isoDate: string): Promise<void>`, `getBackupReminderNotificationId(): Promise<string | null>`, `setBackupReminderNotificationId(notificationId: string | null): Promise<void>`

- [ ] **Step 1: Fehlschlagende Tests schreiben**

Ergänze am Ende von `colitis-app/src/features/settings/settingsStorage.test.ts` (vor der letzten schließenden Klammer der Datei bzw. als neuer `describe`-Block):

```typescript
describe('backup reminder settings', () => {
  it('returns null for backupReminderEnabledRaw when never set', async () => {
    expect(await getBackupReminderEnabledRaw()).toBeNull();
  });

  it('persists an explicit backupReminderEnabled value', async () => {
    await setBackupReminderEnabled(false);
    expect(await getBackupReminderEnabledRaw()).toBe(false);
    await setBackupReminderEnabled(true);
    expect(await getBackupReminderEnabledRaw()).toBe(true);
  });

  it('defaults backupReminderIntervalDays to 30', async () => {
    expect(await getBackupReminderIntervalDays()).toBe(30);
  });

  it('persists backupReminderIntervalDays', async () => {
    await setBackupReminderIntervalDays(60);
    expect(await getBackupReminderIntervalDays()).toBe(60);
  });

  it('defaults lastBackupAt to null', async () => {
    expect(await getLastBackupAt()).toBeNull();
  });

  it('persists lastBackupAt', async () => {
    await setLastBackupAt('2026-07-21T10:00:00.000Z');
    expect(await getLastBackupAt()).toBe('2026-07-21T10:00:00.000Z');
  });

  it('defaults backupReminderNotificationId to null', async () => {
    expect(await getBackupReminderNotificationId()).toBeNull();
  });

  it('persists and clears backupReminderNotificationId', async () => {
    await setBackupReminderNotificationId('notif-abc');
    expect(await getBackupReminderNotificationId()).toBe('notif-abc');
    await setBackupReminderNotificationId(null);
    expect(await getBackupReminderNotificationId()).toBeNull();
  });
});
```

Erweitere den Import-Block oben in derselben Datei um die neuen Funktionsnamen:

```typescript
import {
  getThemeId,
  setThemeId,
  getDailyJokeEnabled,
  setDailyJokeEnabled,
  getIncludeIllnessJokes,
  setIncludeIllnessJokes,
  getBackupReminderEnabledRaw,
  setBackupReminderEnabled,
  getBackupReminderIntervalDays,
  setBackupReminderIntervalDays,
  getLastBackupAt,
  setLastBackupAt,
  getBackupReminderNotificationId,
  setBackupReminderNotificationId,
} from './settingsStorage';
```

Erweitere außerdem den `vi.mock('@react-native-async-storage/async-storage', ...)`-Block ganz oben in der Datei um `removeItem`, da `setBackupReminderNotificationId(null)` das braucht:

```typescript
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storeMock.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storeMock.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      storeMock.delete(key);
      return Promise.resolve();
    }),
  },
}));
```

- [ ] **Step 2: Testlauf zur Bestätigung des Fehlschlags**

```bash
cd colitis-app
npx.cmd vitest run src/features/settings/settingsStorage.test.ts
```
Erwartet: FAIL — `getBackupReminderEnabledRaw is not a function` (oder ähnlich für die anderen neuen Funktionen).

- [ ] **Step 3: Implementierung in `settingsStorage.ts`**

Füge am Ende von `colitis-app/src/features/settings/settingsStorage.ts` hinzu (nach den bestehenden Konstanten die neuen Storage-Keys ergänzen, dann die Funktionen):

```typescript
const BACKUP_REMINDER_ENABLED_KEY = 'colitis2go.settings.backupReminderEnabled';
const BACKUP_REMINDER_INTERVAL_DAYS_KEY = 'colitis2go.settings.backupReminderIntervalDays';
const LAST_BACKUP_AT_KEY = 'colitis2go.settings.lastBackupAt';
const BACKUP_REMINDER_NOTIFICATION_ID_KEY = 'colitis2go.settings.backupReminderNotificationId';

const DEFAULT_BACKUP_REMINDER_INTERVAL_DAYS = 30;

export async function getBackupReminderEnabledRaw(): Promise<boolean | null> {
  const stored = await AsyncStorage.getItem(BACKUP_REMINDER_ENABLED_KEY);
  if (stored === null) {
    return null;
  }
  return stored === 'true';
}

export async function setBackupReminderEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BACKUP_REMINDER_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function getBackupReminderIntervalDays(): Promise<number> {
  const stored = await AsyncStorage.getItem(BACKUP_REMINDER_INTERVAL_DAYS_KEY);
  const parsed = stored === null ? NaN : Number(stored);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_BACKUP_REMINDER_INTERVAL_DAYS;
}

export async function setBackupReminderIntervalDays(days: number): Promise<void> {
  await AsyncStorage.setItem(BACKUP_REMINDER_INTERVAL_DAYS_KEY, String(days));
}

export async function getLastBackupAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_BACKUP_AT_KEY);
}

export async function setLastBackupAt(isoDate: string): Promise<void> {
  await AsyncStorage.setItem(LAST_BACKUP_AT_KEY, isoDate);
}

export async function getBackupReminderNotificationId(): Promise<string | null> {
  return AsyncStorage.getItem(BACKUP_REMINDER_NOTIFICATION_ID_KEY);
}

export async function setBackupReminderNotificationId(notificationId: string | null): Promise<void> {
  if (notificationId === null) {
    await AsyncStorage.removeItem(BACKUP_REMINDER_NOTIFICATION_ID_KEY);
    return;
  }
  await AsyncStorage.setItem(BACKUP_REMINDER_NOTIFICATION_ID_KEY, notificationId);
}
```

- [ ] **Step 4: Testlauf zur Bestätigung des Erfolgs**

```bash
cd colitis-app
npx.cmd vitest run src/features/settings/settingsStorage.test.ts
```
Erwartet: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
cd D:/Claude
git add colitis-app/src/features/settings/settingsStorage.ts colitis-app/src/features/settings/settingsStorage.test.ts
git commit -m "feat: Backup-Erinnerungs-Einstellungen in settingsStorage ergaenzen"
```

---

## Task 3: Reine Berechnungslogik `reminderScheduling.ts` im Backup-Feature

**Files:**
- Create: `colitis-app/src/features/backup/reminderScheduling.ts`
- Create: `colitis-app/src/features/backup/reminderScheduling.test.ts`

**Interfaces:**
- Consumes: nichts (reine Funktionen, keine Abhängigkeiten)
- Produces: `resolveBackupReminderEnabled(rawEnabled: boolean | null, lastBackupAt: string | null): boolean`, `buildBackupReminderTrigger(lastBackupAt: string, intervalDays: number, now: Date): Date | null`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Erstelle `colitis-app/src/features/backup/reminderScheduling.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveBackupReminderEnabled, buildBackupReminderTrigger } from './reminderScheduling';

describe('resolveBackupReminderEnabled', () => {
  it('returns the explicit raw value when set to true', () => {
    expect(resolveBackupReminderEnabled(true, null)).toBe(true);
  });

  it('returns the explicit raw value when set to false, even with a backup present', () => {
    expect(resolveBackupReminderEnabled(false, '2026-07-01T09:00:00.000Z')).toBe(false);
  });

  it('defaults to true when never explicitly set and a backup exists', () => {
    expect(resolveBackupReminderEnabled(null, '2026-07-01T09:00:00.000Z')).toBe(true);
  });

  it('defaults to false when never explicitly set and no backup exists yet', () => {
    expect(resolveBackupReminderEnabled(null, null)).toBe(false);
  });
});

describe('buildBackupReminderTrigger', () => {
  it('returns a date intervalDays after the last backup', () => {
    const lastBackupAt = '2026-01-01T09:00:00.000Z';
    const now = new Date('2026-01-01T10:00:00.000Z');
    const trigger = buildBackupReminderTrigger(lastBackupAt, 30, now);
    expect(trigger).toEqual(new Date('2026-01-31T09:00:00.000Z'));
  });

  it('returns null when the computed date has already passed', () => {
    const lastBackupAt = '2026-01-01T09:00:00.000Z';
    const now = new Date('2026-03-01T09:00:00.000Z');
    expect(buildBackupReminderTrigger(lastBackupAt, 30, now)).toBeNull();
  });

  it('returns null when the computed date equals now exactly', () => {
    const lastBackupAt = '2026-01-01T09:00:00.000Z';
    const now = new Date('2026-01-31T09:00:00.000Z');
    expect(buildBackupReminderTrigger(lastBackupAt, 30, now)).toBeNull();
  });
});
```

- [ ] **Step 2: Testlauf zur Bestätigung des Fehlschlags**

```bash
cd colitis-app
npx.cmd vitest run src/features/backup/reminderScheduling.test.ts
```
Erwartet: FAIL — Modul `./reminderScheduling` existiert nicht.

- [ ] **Step 3: Implementierung**

Erstelle `colitis-app/src/features/backup/reminderScheduling.ts`:

```typescript
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function resolveBackupReminderEnabled(rawEnabled: boolean | null, lastBackupAt: string | null): boolean {
  if (rawEnabled !== null) {
    return rawEnabled;
  }
  return lastBackupAt !== null;
}

export function buildBackupReminderTrigger(lastBackupAt: string, intervalDays: number, now: Date): Date | null {
  const dueDate = new Date(new Date(lastBackupAt).getTime() + intervalDays * MILLISECONDS_PER_DAY);
  if (dueDate.getTime() <= now.getTime()) {
    return null;
  }
  return dueDate;
}
```

- [ ] **Step 4: Testlauf zur Bestätigung des Erfolgs**

```bash
cd colitis-app
npx.cmd vitest run src/features/backup/reminderScheduling.test.ts
```
Erwartet: PASS, alle 7 Tests grün.

- [ ] **Step 5: Commit**

```bash
cd D:/Claude
git add colitis-app/src/features/backup/reminderScheduling.ts colitis-app/src/features/backup/reminderScheduling.test.ts
git commit -m "feat: reine Backup-Erinnerungs-Berechnungslogik ergaenzen"
```

---

## Task 4: Generischen Datums-Reminder in `notificationService.ts` ergänzen

**Files:**
- Modify: `colitis-app/src/lib/notifications/notificationService.ts`
- Modify: `colitis-app/src/lib/notifications/notificationService.test.ts`

**Interfaces:**
- Consumes: `ReminderContent` (bereits vorhanden in derselben Datei)
- Produces: `scheduleDateReminder(date: Date, content: ReminderContent): Promise<string>`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Ergänze in `colitis-app/src/lib/notifications/notificationService.test.ts` den Import um `scheduleDateReminder`:

```typescript
import {
  configureNotificationHandling,
  requestNotificationPermission,
  scheduleDailyReminder,
  scheduleScreeningReminder,
  scheduleDateReminder,
  cancelScheduledReminder,
} from './notificationService';
```

Und ergänze einen neuen `describe`-Block (z. B. nach `describe('scheduleScreeningReminder', ...)`):

```typescript
describe('scheduleDateReminder', () => {
  it('schedules a date trigger for the given date and returns the identifier', async () => {
    const date = new Date(2026, 7, 20, 9, 0, 0, 0);
    const id = await scheduleDateReminder(date, { title: 'Backup-Erinnerung', body: 'Zeit für ein neues Backup' });

    expect(id).toBe('notif-id-123');
    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Backup-Erinnerung', body: 'Zeit für ein neues Backup' },
      trigger: { type: 'date', date },
    });
  });
});
```

- [ ] **Step 2: Testlauf zur Bestätigung des Fehlschlags**

```bash
cd colitis-app
npx.cmd vitest run src/lib/notifications/notificationService.test.ts
```
Erwartet: FAIL — `scheduleDateReminder is not a function`.

- [ ] **Step 3: Implementierung**

Füge in `colitis-app/src/lib/notifications/notificationService.ts` nach `scheduleScreeningReminder` hinzu:

```typescript
export async function scheduleDateReminder(date: Date, content: ReminderContent): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}
```

- [ ] **Step 4: Testlauf zur Bestätigung des Erfolgs**

```bash
cd colitis-app
npx.cmd vitest run src/lib/notifications/notificationService.test.ts
```
Erwartet: PASS, alle Tests grün (bisherige Anzahl + 1).

- [ ] **Step 5: Commit**

```bash
cd D:/Claude
git add colitis-app/src/lib/notifications/notificationService.ts colitis-app/src/lib/notifications/notificationService.test.ts
git commit -m "feat: generischen Datums-Reminder scheduleDateReminder ergaenzen"
```

---

## Task 5: Orchestrierung `rescheduleBackupReminder`

**Files:**
- Create: `colitis-app/src/features/backup/scheduleBackupReminder.ts`

**Interfaces:**
- Consumes: `getBackupReminderEnabledRaw`, `getBackupReminderIntervalDays`, `getLastBackupAt`, `getBackupReminderNotificationId`, `setBackupReminderNotificationId` (aus Task 2, `../settings/settingsStorage`), `resolveBackupReminderEnabled`, `buildBackupReminderTrigger` (aus Task 3, `./reminderScheduling`), `requestNotificationPermission`, `cancelScheduledReminder`, `scheduleDateReminder` (aus Task 1+4, `../../lib/notifications/notificationService`)
- Produces: `rescheduleBackupReminder(now?: Date): Promise<void>`

Kein dediziertes Unit-Test für diese Datei — reine Orchestrierung bereits vollständig getesteter Bausteine, gleiches Muster wie das bestehende, ebenfalls ungetestete `src/features/backup/rescheduleReminders.ts`. Verifikation über `tsc --noEmit` und den späteren manuellen Test in Task 6.

- [ ] **Step 1: Implementierung**

Erstelle `colitis-app/src/features/backup/scheduleBackupReminder.ts`:

```typescript
import {
  getBackupReminderEnabledRaw,
  getBackupReminderIntervalDays,
  getLastBackupAt,
  getBackupReminderNotificationId,
  setBackupReminderNotificationId,
} from '../settings/settingsStorage';
import { resolveBackupReminderEnabled, buildBackupReminderTrigger } from './reminderScheduling';
import {
  requestNotificationPermission,
  cancelScheduledReminder,
  scheduleDateReminder,
} from '../../lib/notifications/notificationService';

const BACKUP_REMINDER_CONTENT = {
  title: 'Backup-Erinnerung',
  body: 'Es ist Zeit, ein neues Backup deiner Daten zu erstellen.',
};

export async function rescheduleBackupReminder(now: Date = new Date()): Promise<void> {
  const existingNotificationId = await getBackupReminderNotificationId();
  if (existingNotificationId !== null) {
    await cancelScheduledReminder(existingNotificationId);
    await setBackupReminderNotificationId(null);
  }

  const [rawEnabled, intervalDays, lastBackupAt] = await Promise.all([
    getBackupReminderEnabledRaw(),
    getBackupReminderIntervalDays(),
    getLastBackupAt(),
  ]);

  if (lastBackupAt === null || !resolveBackupReminderEnabled(rawEnabled, lastBackupAt)) {
    return;
  }

  const triggerDate = buildBackupReminderTrigger(lastBackupAt, intervalDays, now);
  if (triggerDate === null) {
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    return;
  }

  const notificationId = await scheduleDateReminder(triggerDate, BACKUP_REMINDER_CONTENT);
  await setBackupReminderNotificationId(notificationId);
}
```

- [ ] **Step 2: Verifikation**

```bash
cd colitis-app
npx.cmd tsc --noEmit --pretty false
```
Erwartet: keine neuen Typfehler.

- [ ] **Step 3: Commit**

```bash
cd D:/Claude
git add colitis-app/src/features/backup/scheduleBackupReminder.ts
git commit -m "feat: rescheduleBackupReminder Orchestrierung ergaenzen"
```

---

## Task 6: UI im Einstellungen-Tab verdrahten

**Files:**
- Modify: `colitis-app/app/(tabs)/einstellungen/index.tsx`

**Interfaces:**
- Consumes: alles aus Task 2, 3, 5 (`getBackupReminderEnabledRaw`, `setBackupReminderEnabled`, `getBackupReminderIntervalDays`, `setBackupReminderIntervalDays`, `getLastBackupAt`, `setLastBackupAt` aus `settingsStorage`; `resolveBackupReminderEnabled` aus `backup/reminderScheduling`; `rescheduleBackupReminder` aus `backup/scheduleBackupReminder`)
- Produces: nichts (Blattkomponente, UI-Endpunkt)

Kein automatisiertes Test für React-Native-UI-Screens in diesem Projekt (bestehendes Muster — siehe alle anderen `app/(tabs)/*/index.tsx`). Verifikation über `tsc --noEmit` und manuellen Test.

- [ ] **Step 1: Imports ergänzen**

Füge in `colitis-app/app/(tabs)/einstellungen/index.tsx` nach dem bestehenden `settingsStorage`-Import hinzu:

```typescript
import {
  getDailyJokeEnabled,
  setDailyJokeEnabled,
  getIncludeIllnessJokes,
  setIncludeIllnessJokes,
  getBackupReminderEnabledRaw,
  setBackupReminderEnabled,
  getBackupReminderIntervalDays,
  setBackupReminderIntervalDays,
  getLastBackupAt,
  setLastBackupAt,
} from '../../../src/features/settings/settingsStorage';
import { resolveBackupReminderEnabled } from '../../../src/features/backup/reminderScheduling';
import { rescheduleBackupReminder } from '../../../src/features/backup/scheduleBackupReminder';
```

Füge nach der bestehenden `THEME_OPTIONS`-Konstante hinzu:

```typescript
const BACKUP_REMINDER_INTERVAL_OPTIONS = [14, 30, 60, 90] as const;
```

- [ ] **Step 2: State ergänzen**

Nach der bestehenden Zeile `const [includeIllnessJokes, setIncludeIllnessJokesState] = useState(false);` ergänzen:

```typescript
const [backupReminderEnabled, setBackupReminderEnabledState] = useState(false);
const [backupReminderIntervalDays, setBackupReminderIntervalDaysState] = useState(30);
const [lastBackupAt, setLastBackupAtState] = useState<string | null>(null);
```

- [ ] **Step 3: Laden der Einstellungen beim Fokussieren**

Ergänze im bestehenden `useFocusEffect`-Block, direkt nach dem vorhandenen `Promise.all([getDailyJokeEnabled(), getIncludeIllnessJokes()])...`-Aufruf, einen weiteren:

```typescript
Promise.all([getBackupReminderEnabledRaw(), getBackupReminderIntervalDays(), getLastBackupAt()])
  .then(([rawEnabled, intervalDays, lastBackup]) => {
    if (isActive) {
      setBackupReminderEnabledState(resolveBackupReminderEnabled(rawEnabled, lastBackup));
      setBackupReminderIntervalDaysState(intervalDays);
      setLastBackupAtState(lastBackup);
    }
  })
  .catch((error: unknown) => {
    console.error('[Einstellungen] Backup-Erinnerungs-Einstellungen konnten nicht gelesen werden:', error);
  });
```

- [ ] **Step 4: Handler ergänzen**

Nach der bestehenden Funktion `handleToggleIllnessJokes` ergänzen:

```typescript
async function handleToggleBackupReminder(value: boolean) {
  setBackupReminderEnabledState(value);
  try {
    await setBackupReminderEnabled(value);
    await rescheduleBackupReminder();
  } catch (error: unknown) {
    console.error('[Einstellungen] Backup-Erinnerung konnte nicht aktualisiert werden:', error);
  }
}

async function handleChangeBackupReminderInterval(days: number) {
  setBackupReminderIntervalDaysState(days);
  try {
    await setBackupReminderIntervalDays(days);
    await rescheduleBackupReminder();
  } catch (error: unknown) {
    console.error('[Einstellungen] Backup-Erinnerungsintervall konnte nicht aktualisiert werden:', error);
  }
}
```

- [ ] **Step 5: `handleExport` um Zeitstempel-Aktualisierung erweitern**

In der bestehenden Funktion `handleExport`, direkt nach der Zeile `await writeAndShareBackup(JSON.stringify(envelope));` und vor `setBackupFormMode(null);` einfügen:

```typescript
const nowIso = new Date().toISOString();
await setLastBackupAt(nowIso);
setLastBackupAtState(nowIso);
await rescheduleBackupReminder();
setBackupReminderEnabledState(resolveBackupReminderEnabled(await getBackupReminderEnabledRaw(), nowIso));
```

- [ ] **Step 6: Neuen UI-Abschnitt ergänzen**

Füge direkt nach dem schließenden `)}` des bestehenden `{backupFormMode === null && (...)}`-Blocks (also nach dem "Backup"-Abschnitt, vor dem schließenden `</ScrollView>`) ein:

```tsx
<Text style={styles.sectionTitle}>Backup-Erinnerung</Text>
<View style={styles.row}>
  <Text style={styles.rowLabel}>Erinnerung aktivieren</Text>
  <SliderToggle
    value={backupReminderEnabled}
    onValueChange={handleToggleBackupReminder}
    accessibilityLabel="Backup-Erinnerung aktivieren"
  />
</View>
<View style={styles.themeRow}>
  {BACKUP_REMINDER_INTERVAL_OPTIONS.map((days) => (
    <Pressable
      key={days}
      accessibilityRole="button"
      accessibilityLabel={`Erinnerung alle ${days} Tage`}
      accessibilityState={{ selected: backupReminderIntervalDays === days }}
      style={[styles.themeCard, backupReminderIntervalDays === days && styles.themeCardActive]}
      onPress={() => handleChangeBackupReminderInterval(days)}
    >
      <Text style={[styles.themeCardText, backupReminderIntervalDays === days && styles.themeCardTextActive]}>
        {days} Tage
      </Text>
    </Pressable>
  ))}
</View>
<Text style={styles.backupMessage}>
  {lastBackupAt
    ? `Letztes Backup: ${new Date(lastBackupAt).toLocaleDateString('de-DE')}`
    : 'Noch kein Backup erstellt.'}
</Text>
```

- [ ] **Step 7: Verifikation**

```bash
cd colitis-app
npx.cmd tsc --noEmit --pretty false
npx.cmd vitest run
```
Erwartet: keine neuen Typfehler, alle Tests grün.

- [ ] **Step 8: Commit**

```bash
cd D:/Claude
git add "colitis-app/app/(tabs)/einstellungen/index.tsx"
git commit -m "feat: Backup-Erinnerung im Einstellungen-Tab verdrahten"
```

- [ ] **Step 9: Manueller Testhinweis für den nächsten Alltagstest**

Kein automatisierter Test möglich für: den tatsächlichen Erhalt der Push-Benachrichtigung. Beim nächsten Testlauf auf dem Gerät: Backup erstellen, prüfen dass "Letztes Backup: [heutiges Datum]" erscheint, Intervall testweise im Code kurzzeitig auf einen sehr kurzen Zeitraum stellen (z. B. `intervalDays` durch Minuten ersetzen) um die Benachrichtigung zeitnah zu erhalten, danach zurücksetzen.

---

## Plan-Selbstprüfung (bereits durchgeführt)

- **Spec-Abdeckung:** Speicherung (Task 2), Ablauf nach Export (Task 5+6 Step 5), UI mit Schalter/Intervall/letztem-Backup-Anzeige (Task 6), Code-Aufräumung `notificationService` (Task 1) — alle Abschnitte der Spec sind abgedeckt.
- **Platzhalter-Scan:** keine TBD/TODO, jeder Schritt enthält vollständigen Code.
- **Typ-Konsistenz geprüft:** `boolean | null` für `backupReminderEnabledRaw` durchgängig; `Date | null` für `buildBackupReminderTrigger`-Rückgabe durchgängig; Funktionsnamen zwischen Definition (Task 2/3/4) und Verwendung (Task 5/6) stimmen überein.
