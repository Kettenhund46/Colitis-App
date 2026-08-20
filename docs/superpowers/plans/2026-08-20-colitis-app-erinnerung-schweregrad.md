# Tägliche Erinnerung und Schweregrad in der Liste — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Nutzer wird täglich ans Eintragen erinnert und erkennt beim Durchscrollen der Tagebuch-Liste sofort, wie die einzelnen Tage verliefen.

**Architecture:** Die Erinnerung folgt vollständig dem Vorbild der bestehenden Backup-Erinnerung: drei Einstellungsschlüssel, eine Orchestrierungsfunktion, ein eigener Bedienblock. Die Schweregrad-Kennzeichnung nutzt die bereits vorhandene Bewertungslogik und die bereits vorhandene Formensprache des Kalenders — beide werden nur zugänglich gemacht, nicht neu erfunden.

**Tech Stack:** React Native 0.86.2, Expo SDK 57, TypeScript, expo-notifications, AsyncStorage, Vitest.

**Grundlage:** `docs/superpowers/specs/2026-08-20-colitis-app-erinnerung-schweregrad-design.md`, Phase 1 aus `.planning/ROADMAP.md`.

## Global Constraints

- **Es wird immer erinnert**, auch wenn für heute bereits erfasst wurde. Der wiederkehrende Tagestrigger lässt sich nicht teilweise abbestellen; die Entscheidung ist im Entwurf begründet. Kein Versuch, erfasste Tage zu überspringen.
- **Die Bewertung gilt dem Tag, nicht dem Eintrag.** In der Liste zeigt jede Zeile die Bewertung ihres Tages. Bei geteilten Tagen tragen mehrere Zeilen dieselbe Kennzeichnung — das ist beabsichtigt.
- **Keine Änderung an der Bewertungslogik.** `rateDiaryEntry`, `rateDayEntries`, `sumDayTotals` und `rateDayTotals` in `calendarLogic.ts` bleiben unverändert. Ergänzt wird nur.
- **Keine zweite Zeiteingabe-Form.** Uhrzeiten sind Text im Format `HH:MM`, geprüft mit `isValidReminderTime` aus `src/features/medications/reminderScheduling.ts`.
- **Eine ungültige Uhrzeit darf die laufende Erinnerung nicht löschen.** Geprüft wird, bevor irgendetwas abbestellt wird.
- **Keine neuen npm-Abhängigkeiten.**
- **Expo SDK 57:** Laut `colitis-app/AGENTS.md` sind die versionierten Dokumente unter https://docs.expo.dev/versions/v57.0.0/ zu prüfen, bevor eine Expo-API verwendet wird.
- **Windows:** immer `npx.cmd`, nie `npx`. Alle Befehle aus `D:\Claude\colitis-app`.
- **Deutsche UI-Texte wörtlich** wie angegeben, Auslassungszeichen „…" als Einzelzeichen.

## Dateiübersicht

| Datei | Verantwortung |
|---|---|
| `src/features/settings/settingsStorage.ts` (ändern) | Drei neue Einstellungsschlüssel |
| `src/features/settings/settingsStorage.test.ts` (ändern) | Tests dafür |
| `src/features/diary/scheduleDiaryReminder.ts` (neu) | Planen, Umplanen und Abbestellen der Erinnerung |
| `src/features/diary/components/DiaryReminderSettings.tsx` (neu) | Bedienblock für die Erinnerung |
| `app/(tabs)/einstellungen/index.tsx` (ändern) | Bedienblock einhängen |
| `app/_layout.tsx` (ändern) | Erinnerung beim App-Start neu planen |
| `src/features/diary/components/RatingIndicator.tsx` (neu) | Formensprache der Bewertung, gemeinsam nutzbar |
| `src/features/diary/components/DiaryCalendarView.tsx` (ändern) | Nutzt die herausgezogene Komponente |
| `src/features/diary/calendarLogic.ts` (ändern) | `buildDayRatings` ergänzen |
| `src/features/diary/calendarLogic.test.ts` (ändern) | Tests dafür |
| `src/features/diary/components/DiaryHistoryList.tsx` (ändern) | Kennzeichnung in der Zeile |

---

### Task 1: Einstellungen und Planung der Erinnerung

**Files:**
- Modify: `colitis-app/src/features/settings/settingsStorage.ts`
- Test: `colitis-app/src/features/settings/settingsStorage.test.ts`
- Create: `colitis-app/src/features/diary/scheduleDiaryReminder.ts`

**Interfaces:**
- Consumes: `AsyncStorage` (in `settingsStorage.ts` bereits importiert); `isValidReminderTime(time: string): boolean` aus `../medications/reminderScheduling`; `requestNotificationPermission(): Promise<boolean>`, `cancelScheduledReminder(id: string): Promise<void>` und `scheduleDailyReminder(time: string, content: ReminderContent): Promise<string>` aus `../../lib/notifications/notificationService`
- Produces:
  - `getDiaryReminderEnabled(): Promise<boolean>` / `setDiaryReminderEnabled(enabled: boolean): Promise<void>`
  - `getDiaryReminderTime(): Promise<string>` / `setDiaryReminderTime(time: string): Promise<void>`
  - `getDiaryReminderNotificationId(): Promise<string | null>` / `setDiaryReminderNotificationId(id: string | null): Promise<void>`
  - `DEFAULT_DIARY_REMINDER_TIME: string` mit dem Wert `'20:00'`
  - `type DiaryReminderResult = 'scheduled' | 'disabled' | 'invalid-time' | 'permission-denied' | 'failed'`
  - `rescheduleDiaryReminder(): Promise<DiaryReminderResult>`

- [ ] **Step 1: Fehlschlagende Tests für die Einstellungen schreiben**

Am Ende von `colitis-app/src/features/settings/settingsStorage.test.ts` einfügen. Die Datei besitzt bereits einen Aufbau zum Zurücksetzen des Speichers zwischen den Tests — diesen unverändert weiterverwenden und die neuen Tests in derselben Form schreiben wie die vorhandenen.

```typescript
describe('diary reminder settings', () => {
  it('is switched off when nothing was stored', async () => {
    expect(await getDiaryReminderEnabled()).toBe(false);
  });

  it('persists the switched-on state', async () => {
    await setDiaryReminderEnabled(true);
    expect(await getDiaryReminderEnabled()).toBe(true);
  });

  it('persists the switched-off state', async () => {
    await setDiaryReminderEnabled(true);
    await setDiaryReminderEnabled(false);
    expect(await getDiaryReminderEnabled()).toBe(false);
  });

  it('falls back to eight in the evening when no time was stored', async () => {
    expect(await getDiaryReminderTime()).toBe('20:00');
  });

  it('persists a stored time', async () => {
    await setDiaryReminderTime('07:30');
    expect(await getDiaryReminderTime()).toBe('07:30');
  });

  it('reports no notification id when nothing was stored', async () => {
    expect(await getDiaryReminderNotificationId()).toBeNull();
  });

  it('persists a notification id and clears it again', async () => {
    await setDiaryReminderNotificationId('abc-123');
    expect(await getDiaryReminderNotificationId()).toBe('abc-123');

    await setDiaryReminderNotificationId(null);
    expect(await getDiaryReminderNotificationId()).toBeNull();
  });
});
```

Die Import-Zeile der Testdatei um `getDiaryReminderEnabled`, `setDiaryReminderEnabled`, `getDiaryReminderTime`, `setDiaryReminderTime`, `getDiaryReminderNotificationId` und `setDiaryReminderNotificationId` erweitern.

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Ausführen: `npx.cmd vitest run src/features/settings/settingsStorage.test.ts`

Erwartet: FEHLER — die Funktionen existieren nicht.

- [ ] **Step 3: Einstellungen umsetzen**

Am Ende von `colitis-app/src/features/settings/settingsStorage.ts` ergänzen. Der Aufbau spiegelt bewusst den Backup-Erinnerungs-Block derselben Datei, insbesondere die Behandlung von `null` bei der Kennung:

```typescript
const DIARY_REMINDER_ENABLED_KEY = 'colitis2go.settings.diaryReminderEnabled';
const DIARY_REMINDER_TIME_KEY = 'colitis2go.settings.diaryReminderTime';
const DIARY_REMINDER_NOTIFICATION_ID_KEY = 'colitis2go.settings.diaryReminderNotificationId';

export const DEFAULT_DIARY_REMINDER_TIME = '20:00';

/** Voreinstellung: ausgeschaltet, solange nichts gespeichert wurde. */
export async function getDiaryReminderEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(DIARY_REMINDER_ENABLED_KEY);
  return stored === 'true';
}

export async function setDiaryReminderEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(DIARY_REMINDER_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function getDiaryReminderTime(): Promise<string> {
  const stored = await AsyncStorage.getItem(DIARY_REMINDER_TIME_KEY);
  return stored ?? DEFAULT_DIARY_REMINDER_TIME;
}

export async function setDiaryReminderTime(time: string): Promise<void> {
  await AsyncStorage.setItem(DIARY_REMINDER_TIME_KEY, time);
}

export async function getDiaryReminderNotificationId(): Promise<string | null> {
  return AsyncStorage.getItem(DIARY_REMINDER_NOTIFICATION_ID_KEY);
}

export async function setDiaryReminderNotificationId(notificationId: string | null): Promise<void> {
  if (notificationId === null) {
    await AsyncStorage.removeItem(DIARY_REMINDER_NOTIFICATION_ID_KEY);
    return;
  }
  await AsyncStorage.setItem(DIARY_REMINDER_NOTIFICATION_ID_KEY, notificationId);
}
```

- [ ] **Step 4: Test laufen lassen und Erfolg bestätigen**

Ausführen: `npx.cmd vitest run src/features/settings/settingsStorage.test.ts`

Erwartet: BESTANDEN, einschließlich der vorher vorhandenen Tests.

- [ ] **Step 5: Planungsfunktion umsetzen**

Neue Datei `colitis-app/src/features/diary/scheduleDiaryReminder.ts`:

```typescript
import {
  getDiaryReminderEnabled,
  getDiaryReminderTime,
  getDiaryReminderNotificationId,
  setDiaryReminderNotificationId,
} from '../settings/settingsStorage';
import { isValidReminderTime } from '../medications/reminderScheduling';
import {
  requestNotificationPermission,
  cancelScheduledReminder,
  scheduleDailyReminder,
} from '../../lib/notifications/notificationService';

const DIARY_REMINDER_CONTENT = {
  title: 'Wie war dein Tag?',
  body: 'Kurz im Tagebuch festhalten.',
};

export type DiaryReminderResult =
  | 'scheduled'
  | 'disabled'
  | 'invalid-time'
  | 'permission-denied'
  | 'failed';

export async function rescheduleDiaryReminder(): Promise<DiaryReminderResult> {
  const [enabled, time] = await Promise.all([getDiaryReminderEnabled(), getDiaryReminderTime()]);

  if (enabled && !isValidReminderTime(time)) {
    return 'invalid-time';
  }

  const existingNotificationId = await getDiaryReminderNotificationId();
  if (existingNotificationId !== null) {
    await cancelScheduledReminder(existingNotificationId);
    await setDiaryReminderNotificationId(null);
  }

  if (!enabled) {
    return 'disabled';
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    return 'permission-denied';
  }

  try {
    const notificationId = await scheduleDailyReminder(time, DIARY_REMINDER_CONTENT);
    await setDiaryReminderNotificationId(notificationId);
    return 'scheduled';
  } catch (error: unknown) {
    console.error('[Tagebuch] Erinnerung konnte nicht geplant werden:', error);
    await setDiaryReminderNotificationId(null);
    return 'failed';
  }
}
```

Auf die Reihenfolge kommt es an: Die Uhrzeit wird geprüft, **bevor** die vorhandene Erinnerung abbestellt wird. Ein Zahlendreher im Speicher darf nicht dazu führen, dass eine laufende Erinnerung stillschweigend verschwindet. Das ist eine bindende Vorgabe dieses Plans.

Der Rückgabewert existiert, weil die Bedienoberfläche in Task 2 unterscheiden muss, ob nichts geplant wurde, weil ausgeschaltet ist, oder weil die Berechtigung fehlt. Die Backup-Erinnerung kehrt an denselben Stellen wortlos zurück; hier ist eine sichtbare Rückmeldung gefordert.

- [ ] **Step 6: Typprüfung und vollständiger Testlauf**

Ausführen: `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run`

Erwartet: Typprüfung ohne Ausgabe, alle Tests bestanden.

- [ ] **Step 7: Committen**

```bash
git add colitis-app/src/features/settings/settingsStorage.ts colitis-app/src/features/settings/settingsStorage.test.ts colitis-app/src/features/diary/scheduleDiaryReminder.ts
git commit -m "feat: Einstellungen und Planung fuer die taegliche Tagebuch-Erinnerung"
```

---

### Task 2: Bedienblock für die Erinnerung

**Files:**
- Create: `colitis-app/src/features/diary/components/DiaryReminderSettings.tsx`
- Modify: `colitis-app/app/(tabs)/einstellungen/index.tsx`
- Modify: `colitis-app/app/_layout.tsx`

**Interfaces:**
- Consumes aus Task 1: `getDiaryReminderEnabled`, `setDiaryReminderEnabled`, `getDiaryReminderTime`, `setDiaryReminderTime` aus `src/features/settings/settingsStorage`; `rescheduleDiaryReminder(): Promise<DiaryReminderResult>` aus `src/features/diary/scheduleDiaryReminder`
- Consumes vorhanden: `SliderToggle` aus `src/components/SliderToggle` mit den Eigenschaften `value: boolean`, `onValueChange: (value: boolean) => void`, `accessibilityLabel: string`, optional `disabled?: boolean`; `isValidReminderTime` aus `src/features/medications/reminderScheduling`; `useTheme()` aus `src/theme/ThemeContext`; `tokens` aus `src/styles/tokens`
- Produces: Komponente `DiaryReminderSettings` ohne Eigenschaften

**Warum eine eigene Komponente:** `app/(tabs)/einstellungen/index.tsx` hat bereits 636 Zeilen. Die Projektregeln sehen 800 als Obergrenze; ein weiterer Block mit eigenem Zustand, eigener Prüfung und eigener Fehlerbehandlung würde die Datei unnötig aufblähen. Der Bedienblock lebt deshalb als eigene Komponente, die der Einstellungs-Bildschirm nur noch einhängt — genau wie es bei `ScreeningReminderCard` bereits gemacht wird.

**Vor der Umsetzung:** Gemäß `colitis-app/AGENTS.md` die Dokumentation zu `useFocusEffect` aus expo-router unter https://docs.expo.dev/versions/v57.0.0/ prüfen.

Exakte deutsche Texte für diese Aufgabe:

| Stelle | Text |
|---|---|
| Überschrift des Blocks | `Tägliche Erinnerung` |
| Beschriftung des Schalters | `Ans Eintragen erinnern` |
| Screenreader-Beschriftung des Schalters | `Tägliche Erinnerung ans Eintragen` |
| Beschriftung des Zeitfelds | `Uhrzeit (HH:MM)` |
| Erklärung unter dem Block | `Die Erinnerung kommt jeden Tag, auch wenn du schon etwas erfasst hast.` |
| Fehler: ungültige Zeit | `Bitte eine Uhrzeit im Format HH:MM angeben, zum Beispiel 20:00.` |
| Fehler: Berechtigung fehlt | `Ohne Benachrichtigungsberechtigung ist die Erinnerung nicht möglich.` |
| Fehler: Planung gescheitert | `Erinnerung konnte nicht eingerichtet werden.` |

- [ ] **Step 1: Komponente anlegen**

Neue Datei `colitis-app/src/features/diary/components/DiaryReminderSettings.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { SliderToggle } from '../../../components/SliderToggle';
import {
  getDiaryReminderEnabled,
  setDiaryReminderEnabled,
  getDiaryReminderTime,
  setDiaryReminderTime,
  DEFAULT_DIARY_REMINDER_TIME,
} from '../../settings/settingsStorage';
import { isValidReminderTime } from '../../medications/reminderScheduling';
import { rescheduleDiaryReminder } from '../scheduleDiaryReminder';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { DiaryReminderResult } from '../scheduleDiaryReminder';
import type { ThemeColors } from '../../../theme/types';

const ERROR_MESSAGES: Partial<Record<DiaryReminderResult, string>> = {
  'permission-denied': 'Ohne Benachrichtigungsberechtigung ist die Erinnerung nicht möglich.',
  'invalid-time': 'Bitte eine Uhrzeit im Format HH:MM angeben, zum Beispiel 20:00.',
  failed: 'Erinnerung konnte nicht eingerichtet werden.',
};

export function DiaryReminderSettings() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [isEnabled, setIsEnabled] = useState(false);
  const [timeText, setTimeText] = useState(DEFAULT_DIARY_REMINDER_TIME);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      Promise.all([getDiaryReminderEnabled(), getDiaryReminderTime()])
        .then(([enabled, time]) => {
          if (isActive) {
            setIsEnabled(enabled);
            setTimeText(time);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Tagebuch] Erinnerungs-Einstellungen konnten nicht gelesen werden:', loadError);
        });

      return () => {
        isActive = false;
        setError(null);
      };
    }, [])
  );

  async function applyAndReport(): Promise<void> {
    const result = await rescheduleDiaryReminder();
    if (result === 'scheduled' || result === 'disabled') {
      setError(null);
      return;
    }
    setError(ERROR_MESSAGES[result] ?? null);
    setIsEnabled(await getDiaryReminderEnabled());
  }

  async function handleToggle(value: boolean) {
    setIsEnabled(value);
    try {
      await setDiaryReminderEnabled(value);
      const result = await rescheduleDiaryReminder();

      if (result === 'permission-denied' || result === 'failed') {
        await setDiaryReminderEnabled(false);
        setIsEnabled(false);
        setError(ERROR_MESSAGES[result] ?? null);
        return;
      }

      setError(result === 'invalid-time' ? ERROR_MESSAGES['invalid-time'] ?? null : null);
    } catch (toggleError: unknown) {
      console.error('[Tagebuch] Erinnerung konnte nicht umgeschaltet werden:', toggleError);
      setIsEnabled(await getDiaryReminderEnabled());
      setError('Erinnerung konnte nicht eingerichtet werden.');
    }
  }

  async function handleCommitTime() {
    const trimmed = timeText.trim();

    if (!isValidReminderTime(trimmed)) {
      setError('Bitte eine Uhrzeit im Format HH:MM angeben, zum Beispiel 20:00.');
      setTimeText(await getDiaryReminderTime());
      return;
    }

    try {
      await setDiaryReminderTime(trimmed);
      await applyAndReport();
    } catch (timeError: unknown) {
      console.error('[Tagebuch] Erinnerungszeit konnte nicht gespeichert werden:', timeError);
      setError('Erinnerung konnte nicht eingerichtet werden.');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Tägliche Erinnerung</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Ans Eintragen erinnern</Text>
        <SliderToggle
          value={isEnabled}
          onValueChange={(value) => void handleToggle(value)}
          accessibilityLabel="Tägliche Erinnerung ans Eintragen"
        />
      </View>

      {isEnabled && (
        <View style={styles.timeRow}>
          <Text style={styles.rowLabel}>Uhrzeit (HH:MM)</Text>
          <TextInput
            accessibilityLabel="Uhrzeit der täglichen Erinnerung"
            style={styles.timeInput}
            value={timeText}
            onChangeText={setTimeText}
            onEndEditing={() => void handleCommitTime()}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            placeholder="20:00"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      )}

      <Text style={styles.hint}>
        Die Erinnerung kommt jeden Tag, auch wenn du schon etwas erfasst hast.
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: tokens.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: tokens.spacing.md,
      marginBottom: tokens.spacing.md,
    },
    heading: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.sm,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.sm,
    },
    rowLabel: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.sm,
    },
    timeInput: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: tokens.radius.sm,
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.xs,
      minWidth: 88,
      textAlign: 'center',
    },
    hint: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
  });
}
```

Zwei Feinheiten, die nicht wegvereinfacht werden dürfen:

Bei verweigerter Berechtigung wird die Einstellung **aktiv wieder auf aus gesetzt**, nicht nur die Anzeige. Sonst stünde beim nächsten Öffnen ein eingeschalteter Schalter ohne Erinnerung dahinter.

Bei ungültiger Uhrzeit wird das Textfeld auf den gespeicherten Wert zurückgesetzt. Der Nutzer sieht damit, welche Zeit weiterhin gilt, statt eine ungültige Eingabe stehen zu lassen, die nirgends wirksam ist.

- [ ] **Step 2: Block in den Einstellungen einhängen**

In `colitis-app/app/(tabs)/einstellungen/index.tsx` den Import ergänzen:

```tsx
import { DiaryReminderSettings } from '../../../src/features/diary/components/DiaryReminderSettings';
```

Und im JSX unmittelbar **vor** dem vorhandenen Backup-Erinnerungs-Block einfügen:

```tsx
      <DiaryReminderSettings />
```

Den Backup-Block selbst und alles andere in dieser Datei unverändert lassen.

- [ ] **Step 3: Erinnerung beim App-Start neu planen**

In `colitis-app/app/_layout.tsx` den Import ergänzen:

```tsx
import { rescheduleDiaryReminder } from '../src/features/diary/scheduleDiaryReminder';
```

Und in `RootLayoutInner` unterhalb des vorhandenen `useEffect`, der die Datenbank aufbaut, einen zweiten einfügen:

```tsx
  useEffect(() => {
    rescheduleDiaryReminder().catch((error: unknown) => {
      console.error('[Tagebuch] Erinnerung konnte beim Start nicht geplant werden:', error);
    });
  }, []);
```

Dieser Aufruf sorgt dafür, dass die Erinnerung eine Wiederherstellung aus einer Sicherung übersteht: Die Einstellung liegt dann im Speicher, die geplante Benachrichtigung des alten Geräts aber nicht.

- [ ] **Step 4: Typprüfung und vollständiger Testlauf**

Ausführen: `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run`

Erwartet: Typprüfung ohne Ausgabe, alle Tests bestanden. Der Bedienblock selbst hat keine automatisierten Tests — native Module sind im Testlauf nicht nachgebildet. Der vollständige Lauf weist nach, dass nichts Bestehendes bricht.

- [ ] **Step 5: Committen**

```bash
git add colitis-app/src/features/diary/components/DiaryReminderSettings.tsx colitis-app/app/\(tabs\)/einstellungen/index.tsx colitis-app/app/_layout.tsx
git commit -m "feat: Bedienblock fuer die taegliche Tagebuch-Erinnerung ergaenzen"
```

---

### Task 3: Formensprache der Bewertung herausziehen

**Files:**
- Create: `colitis-app/src/features/diary/components/RatingIndicator.tsx`
- Modify: `colitis-app/src/features/diary/components/DiaryCalendarView.tsx`

**Interfaces:**
- Consumes: `DayRating` aus `../calendarLogic`; `useTheme()` aus `../../../theme/ThemeContext`; `ThemeColors` aus `../../../theme/types`
- Produces:
  - `RATING_LABELS: Record<DayRating, string>` mit den Werten `gut`, `mittel`, `schub-verdächtig`
  - Komponente `RatingIndicator` mit der Eigenschaft `rating: DayRating`

**Das ist ein reines Verschieben.** Am sichtbaren Verhalten des Kalenders darf sich nichts ändern: dieselben Formen, dieselben Farben, dieselben Größen, dieselbe Beschriftung. Wer hier „bei der Gelegenheit" etwas verbessert, macht die Änderung unprüfbar.

- [ ] **Step 1: Komponente anlegen**

Neue Datei `colitis-app/src/features/diary/components/RatingIndicator.tsx`. Die Formen werden wörtlich aus `DiaryCalendarView.tsx` übernommen:

```tsx
import { View } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import type { DayRating } from '../calendarLogic';
import type { ThemeColors } from '../../../theme/types';

export const RATING_LABELS: Record<DayRating, string> = {
  good: 'gut',
  medium: 'mittel',
  bad: 'schub-verdächtig',
};

function ratingIndicatorStyle(colors: ThemeColors, rating: DayRating) {
  if (rating === 'bad') {
    return {
      width: 0,
      height: 0,
      marginTop: 2,
      borderLeftWidth: 4,
      borderRightWidth: 4,
      borderBottomWidth: 7,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: colors.danger,
    } as const;
  }
  if (rating === 'medium') {
    return {
      width: 6,
      height: 6,
      marginTop: 2,
      borderRadius: 1,
      backgroundColor: colors.warning,
    } as const;
  }
  return {
    width: 6,
    height: 6,
    marginTop: 2,
    borderRadius: 3,
    backgroundColor: colors.success,
  } as const;
}

interface RatingIndicatorProps {
  rating: DayRating;
}

export function RatingIndicator({ rating }: RatingIndicatorProps) {
  const { colors } = useTheme();
  return <View style={ratingIndicatorStyle(colors, rating)} />;
}
```

- [ ] **Step 2: Kalender auf die Komponente umstellen**

In `colitis-app/src/features/diary/components/DiaryCalendarView.tsx`:

Die Konstante `RATING_LABELS` und die Funktion `ratingIndicatorStyle` **ersatzlos löschen** und stattdessen importieren:

```tsx
import { RatingIndicator, RATING_LABELS } from './RatingIndicator';
```

Die Verwendungsstelle im JSX ersetzen:

```tsx
              {rating && <RatingIndicator rating={rating} />}
```

Die Zeile mit `accessibilityLabel`, die `RATING_LABELS` nutzt, bleibt unverändert — sie greift jetzt auf die importierte Konstante zu.

Wird `ThemeColors` in `DiaryCalendarView.tsx` dadurch nicht mehr gebraucht, den Typ-Import entfernen. Die Typprüfung meldet ungenutzte Importe nicht — selbst nachsehen.

- [ ] **Step 3: Typprüfung und vollständiger Testlauf**

Ausführen: `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run`

Erwartet: Typprüfung ohne Ausgabe, alle Tests bestanden.

- [ ] **Step 4: Committen**

```bash
git add colitis-app/src/features/diary/components/RatingIndicator.tsx colitis-app/src/features/diary/components/DiaryCalendarView.tsx
git commit -m "refactor: Formensprache der Tagesbewertung in eigene Komponente ziehen"
```

---

### Task 4: Kennzeichnung in der Tagebuch-Liste

**Files:**
- Modify: `colitis-app/src/features/diary/calendarLogic.ts`
- Test: `colitis-app/src/features/diary/calendarLogic.test.ts`
- Modify: `colitis-app/src/features/diary/components/DiaryHistoryList.tsx`

**Interfaces:**
- Consumes aus Task 3: `RatingIndicator` und `RATING_LABELS` aus `./RatingIndicator`
- Consumes vorhanden: `groupEntriesByDay`, `rateDayEntries`, `formatDateKey` und `DayRating` aus `../calendarLogic`; `formatOccurredAt` aus `../formatting`
- Produces: `buildDayRatings(entries: DiaryEntryWithTriggers[]): Map<string, DayRating>`

- [ ] **Step 1: Fehlschlagende Tests für `buildDayRatings` schreiben**

Am Ende von `colitis-app/src/features/diary/calendarLogic.test.ts` einfügen. Die Datei besitzt bereits eine Hilfsfunktion `makeEntry` — diese weiterverwenden und ihre vorhandene Aufrufform übernehmen.

Die Zeitstempel werden als ortszeitliche Zeichenketten ohne `Z`-Suffix geschrieben, weil `formatDateKey` mit lokaler Zeit rechnet. Ein Zeitstempel mit `Z` würde in weit östlichen oder westlichen Zeitzonen auf einen anderen Tag fallen und den Test vom Rechner abhängig machen.

```typescript
describe('buildDayRatings', () => {
  it('returns an empty map for no entries', () => {
    expect(buildDayRatings([]).size).toBe(0);
  });

  it('rates a day with a single entry', () => {
    const entries = [
      makeEntry({ occurredAt: '2026-08-18T09:00:00', stoolFrequency: 1, painLevel: 0, hasBlood: false }),
    ];
    expect(buildDayRatings(entries).get('2026-08-18')).toBe('good');
  });

  it('rates a split day by its combined values, not by a single entry', () => {
    const entries = [
      makeEntry({ occurredAt: '2026-08-18T09:00:00', stoolFrequency: 5, painLevel: 0, hasBlood: false }),
      makeEntry({ occurredAt: '2026-08-18T20:00:00', stoolFrequency: 4, painLevel: 0, hasBlood: false }),
    ];
    expect(buildDayRatings(entries).get('2026-08-18')).toBe('bad');
  });

  it('keeps days apart from one another', () => {
    const entries = [
      makeEntry({ occurredAt: '2026-08-17T09:00:00', stoolFrequency: 1, painLevel: 0, hasBlood: false }),
      makeEntry({ occurredAt: '2026-08-18T09:00:00', stoolFrequency: 1, painLevel: 0, hasBlood: true }),
    ];
    const ratings = buildDayRatings(entries);

    expect(ratings.get('2026-08-17')).toBe('good');
    expect(ratings.get('2026-08-18')).toBe('bad');
    expect(ratings.size).toBe(2);
  });

  it('agrees with rateDayEntries for the same day', () => {
    const entries = [
      makeEntry({ occurredAt: '2026-08-18T09:00:00', stoolFrequency: 3, painLevel: 5, hasBlood: false }),
      makeEntry({ occurredAt: '2026-08-18T20:00:00', stoolFrequency: 2, painLevel: 1, hasBlood: false }),
    ];
    expect(buildDayRatings(entries).get('2026-08-18')).toBe(rateDayEntries(entries));
  });
});
```

Der letzte Test ist der wichtigste: Er verankert, dass Liste und Kalender dieselbe Aussage treffen. Bräche das auseinander, würde derselbe Tag an zwei Stellen der App verschieden bewertet.

Die Import-Zeile der Testdatei um `buildDayRatings` erweitern.

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Ausführen: `npx.cmd vitest run src/features/diary/calendarLogic.test.ts`

Erwartet: FEHLER — `buildDayRatings is not a function`.

- [ ] **Step 3: `buildDayRatings` umsetzen**

Am Ende von `colitis-app/src/features/diary/calendarLogic.ts` ergänzen:

```typescript
export function buildDayRatings(entries: DiaryEntryWithTriggers[]): Map<string, DayRating> {
  const ratings = new Map<string, DayRating>();
  for (const [dateKey, dayEntries] of groupEntriesByDay(entries)) {
    ratings.set(dateKey, rateDayEntries(dayEntries));
  }
  return ratings;
}
```

Nichts anderes in dieser Datei anfassen. `rateDiaryEntry`, `rateDayEntries`, `sumDayTotals`, `rateDayTotals`, `groupEntriesByDay`, `formatDateKey` und `buildCalendarGrid` bleiben unverändert.

- [ ] **Step 4: Test laufen lassen und Erfolg bestätigen**

Ausführen: `npx.cmd vitest run src/features/diary/calendarLogic.test.ts`

Erwartet: BESTANDEN.

- [ ] **Step 5: Kennzeichnung in die Liste einbauen**

In `colitis-app/src/features/diary/components/DiaryHistoryList.tsx`:

Importe ergänzen:

```tsx
import { buildDayRatings, formatDateKey } from '../calendarLogic';
import { RatingIndicator, RATING_LABELS } from './RatingIndicator';
```

Innerhalb der Komponente, oberhalb des `return`, die Nachschlagetabelle einmal aufbauen:

```tsx
  const dayRatings = buildDayRatings(entries);
```

Die vorhandene `renderItem`-Eigenschaft der `FlatList` vollständig durch diese Fassung ersetzen. Sie bekommt einen Block-Körper, damit die Bewertung einmal berechnet und benannt werden kann — Ablauflogik gehört in diesem Projekt nicht in geschweifte Klammern mitten ins JSX:

```tsx
      renderItem={({ item }) => {
        const rating = dayRatings.get(formatDateKey(new Date(item.occurredAt)));

        return (
          <View
            style={styles.card}
            accessibilityRole="text"
            accessibilityLabel={buildCardAccessibilityLabel(item, rating)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>{formatOccurredAt(item.occurredAt)}</Text>
              {rating !== undefined && (
                <View style={styles.ratingBadge}>
                  <RatingIndicator rating={rating} />
                  <Text style={styles.ratingText}>Tag: {RATING_LABELS[rating]}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardDetail}>
              Stuhlgang: {item.stoolFrequency}× · {labelFor(STOOL_CONSISTENCY_OPTIONS, item.stoolConsistency)}
            </Text>
            <Text style={styles.cardDetail}>Schmerzlevel: {item.painLevel}/10</Text>
            {item.hasBlood && <Text style={styles.cardWarning}>Blut im Stuhl</Text>}
            {item.triggerCategories.length > 0 && (
              <Text style={styles.cardDetail}>
                Auslöser: {buildTriggerLabels(item.triggerCategories, item.foodTriggerNote).join(', ')}
              </Text>
            )}
            {item.symptoms.length > 0 && (
              <Text style={styles.cardDetail}>
                Symptome: {item.symptoms.map((symptomKey) => labelFor(SYMPTOM_OPTIONS, symptomKey)).join(', ')}
              </Text>
            )}
            {item.note && <Text style={styles.cardNote}>{item.note}</Text>}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Eintrag vom ${formatOccurredAt(item.occurredAt)} löschen`}
              style={styles.deleteButton}
              onPress={() => onDelete(item.id)}
            >
              <Text style={styles.deleteButtonText}>Löschen</Text>
            </Pressable>
          </View>
        );
      }}
```

Bis auf den neuen Kopfbereich, die beiden Barrierefreiheits-Eigenschaften an der Karte und den Block-Körper ist das der bisherige Inhalt unverändert. Das `accessibilityLabel` des Löschen-Knopfes bleibt wie es war.

Oberhalb von `makeStyles` die zugehörige Hilfsfunktion ergänzen:

```tsx
function buildCardAccessibilityLabel(
  entry: DiaryEntryWithTriggers,
  rating: DayRating | undefined
): string {
  const ratingPart = rating === undefined ? '' : `, Tag: ${RATING_LABELS[rating]}`;
  return `Eintrag vom ${formatOccurredAt(entry.occurredAt)}${ratingPart}`;
}
```

Dafür wird zusätzlich der Typ importiert:

```tsx
import type { DayRating } from '../calendarLogic';
```

In `makeStyles` ergänzen:

```tsx
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.xs,
    },
    ratingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.xs,
    },
    ratingText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
```

Und aus dem vorhandenen Stil `cardDate` die Zeile `marginBottom: tokens.spacing.xs,` entfernen — der Abstand sitzt jetzt an `cardHeader`, sonst summieren sich beide.

Am Rest der Karte ändert sich nichts: Angaben, Notiz und Löschen-Knopf bleiben wie sie sind.

- [ ] **Step 6: Typprüfung und vollständiger Testlauf**

Ausführen: `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run`

Erwartet: Typprüfung ohne Ausgabe, alle Tests bestanden.

- [ ] **Step 7: Committen**

```bash
git add colitis-app/src/features/diary/calendarLogic.ts colitis-app/src/features/diary/calendarLogic.test.ts colitis-app/src/features/diary/components/DiaryHistoryList.tsx
git commit -m "feat: Schweregrad des Tages in der Tagebuch-Liste anzeigen"
```

---

## Manuelle Abnahme nach allen Aufgaben

Nicht automatisiert prüfbar, weil native Module im Testlauf nicht nachgebildet sind:

1. Schalter einschalten, Berechtigung erteilen — Erinnerung erscheint zur eingestellten Zeit
2. Berechtigung verweigern — Schalter fällt auf aus zurück, Hinweis erscheint
3. Ungültige Uhrzeit eingeben, etwa `25:00` — Fehlermeldung, Feld springt auf den gespeicherten Wert zurück, die vorherige Erinnerung läuft weiter
4. Schalter ausschalten — keine Erinnerung mehr
5. App beenden und neu starten — Einstellung und Erinnerung bestehen weiter
6. Ein Tag mit einem harmlosen und einem schweren Eintrag — beide Zeilen tragen dieselbe Kennzeichnung, und sie stimmt mit der Form desselben Tages im Kalender überein
7. Alle drei Themes — Kreis, Quadrat und Dreieck sind in jedem erkennbar
8. Der Kalender sieht unverändert aus wie vor dieser Phase

Punkt 8 ist die Gegenprobe zu Task 3: Das Herausziehen der Formensprache durfte am Kalender nichts ändern.

### Nachtrag nach der Schlussdurchsicht

Die Durchsicht fand zwei Wege, auf denen die Erinnerung still verschwand. Beide sind behoben, beide müssen auf dem Gerät gegengeprüft werden — sie sind nicht automatisiert prüfbar:

9. Erinnerung einschalten, dann eine Sicherung wiederherstellen. Danach prüfen, ob die Erinnerung noch kommt. Vor der Behebung wurde sie beim Wiederherstellen mit abbestellt, während der Schalter weiter „an" zeigte.
10. Erinnerung einschalten, dann die Benachrichtigungsberechtigung in den Systemeinstellungen entziehen und die App öffnen. Der Schalter muss auf aus stehen. Vorher blieb er dauerhaft auf „an", ohne dass eine Erinnerung geplant war.
11. Während die App im Vordergrund läuft, die Erinnerungszeit auf wenige Minuten später stellen und warten. Die Benachrichtigung muss erscheinen, ohne dass zuvor der Medikamente-Tab geöffnet wurde.

Punkt 11 ist der einzige Befund der Durchsicht, der sich nicht am Code belegen ließ, sondern nur aus dem dokumentierten Verhalten von expo-notifications abgeleitet wurde. Der Gerätetest ist hier die eigentliche Bestätigung.
