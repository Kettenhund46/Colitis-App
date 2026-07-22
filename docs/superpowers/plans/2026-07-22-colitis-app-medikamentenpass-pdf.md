# Medikamenten-Pass PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein PDF-Export ("Medikamenten-Pass") hinzufügen, der ausschließlich die aktuell aktiven Medikamente mit Name, Dosis, Einnahmeschema und Startdatum auflistet.

**Architecture:** Reine HTML-Baufunktion in einer neuen Datei (`medicationPassBuilder.ts`, testbar ohne native Module), eine dünne Export-Wrapper-Funktion (`medicationPassExport.ts`, nutzt `expo-print`/`expo-sharing` wie der bestehende Tagebuch-PDF-Export), und ein neuer Button im Medikamente-Tab.

**Tech Stack:** React Native / Expo SDK 57, TypeScript, `expo-print`, `expo-sharing` (beide bereits Projektabhängigkeiten, keine neue Installation nötig), Vitest.

## Global Constraints

- Referenz: `docs/superpowers/specs/2026-07-22-colitis-app-medikamentenpass-pdf-design.md`
- Keine neue Abhängigkeit in `package.json`.
- Keine Datenbank-/Schema-Änderung.
- Nur aktive Medikamente im Pass (über die bestehende `isMedicationActive`-Funktion aus `src/features/medications/medicationStatus.ts`), keine beendeten Medikamente.
- Keine Nebenwirkungs-Notiz, keine Erinnerungszeiten im PDF – bewusst nur Name, Dosis, Einnahmeschema, Startdatum.
- Alle UI-/PDF-Texte auf Deutsch, Themes über `useTheme()`/`ThemeColors` in der UI-Komponente, keine hartkodierten Hex-Farben dort (das PDF selbst nutzt inline-CSS mit festen Werten, gleiches Muster wie `diaryPdfBuilder.ts` – dort ist das themenunabhängig, da es ein separat gerendertes Dokument ist, kein App-Bildschirm).
- Windows-Testbefehl: `npx.cmd vitest run <pfad>`; Type-Check: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`).
- `AGENTS.md` beachten: Expo SDK 57 Doku unter https://docs.expo.dev/versions/v57.0.0/ ist maßgeblich – `expo-print`/`expo-sharing` werden hier exakt so verwendet wie im bereits bestehenden, funktionierenden `diaryPdfExport.ts`.

---

### Task 1: HTML-Baufunktion für den Medikamenten-Pass

**Files:**
- Create: `colitis-app/src/features/medications/medicationPassBuilder.ts`
- Test: `colitis-app/src/features/medications/medicationPassBuilder.test.ts`

**Interfaces:**
- Consumes: `Medication` aus `./types` (Felder: `name: string`, `dose: string`, `schedule: string`, `startDate: string`, `endDate: string | null`); `isMedicationActive(endDate: string | null, today: Date): boolean` und `formatLocalDate(date: Date): string` aus `./medicationStatus` (beide bereits vorhanden und ungeändert).
- Produces (für Task 2):
  - `export function formatMedicationStartDate(startDate: string): string` (wandelt `JJJJ-MM-TT` in `TT.MM.JJJJ` um)
  - `export function buildMedicationPassHtml(medications: Medication[], today: Date): string`

- [ ] **Step 1: Write the failing test**

Create `colitis-app/src/features/medications/medicationPassBuilder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildMedicationPassHtml, formatMedicationStartDate } from './medicationPassBuilder';
import type { Medication } from './types';

function makeMedication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 1,
    name: 'Salofalk',
    dose: '500mg',
    schedule: '1x täglich',
    startDate: '2026-01-15',
    endDate: null,
    sideEffectsNote: null,
    reminderTimes: [],
    ...overrides,
  };
}

const TODAY = new Date(2026, 6, 22); // 22. Juli 2026, lokal (Monat 0-indiziert)

describe('formatMedicationStartDate', () => {
  it('converts JJJJ-MM-TT to TT.MM.JJJJ', () => {
    expect(formatMedicationStartDate('2026-01-15')).toBe('15.01.2026');
  });
});

describe('buildMedicationPassHtml', () => {
  it('includes the title and the creation date', () => {
    const html = buildMedicationPassHtml([], TODAY);
    expect(html).toContain('Medikamenten-Pass');
    expect(html).toContain('22.07.2026');
  });

  it('renders a message when there are no active medications', () => {
    const html = buildMedicationPassHtml([], TODAY);
    expect(html).toContain('Keine aktiven Medikamente vorhanden.');
  });

  it('includes name, dose, schedule, and start date for an active medication', () => {
    const html = buildMedicationPassHtml([makeMedication()], TODAY);
    expect(html).toContain('Salofalk');
    expect(html).toContain('500mg');
    expect(html).toContain('1x täglich');
    expect(html).toContain('Seit 15.01.2026');
  });

  it('excludes a medication that ended before today', () => {
    const html = buildMedicationPassHtml([makeMedication({ name: 'Beendet', endDate: '2026-01-01' })], TODAY);
    expect(html).not.toContain('Beendet');
    expect(html).toContain('Keine aktiven Medikamente vorhanden.');
  });

  it('includes a medication ending today or in the future', () => {
    const html = buildMedicationPassHtml([makeMedication({ name: 'Noch aktiv', endDate: '2026-07-22' })], TODAY);
    expect(html).toContain('Noch aktiv');
  });

  it('excludes ended medications while including active ones in a mixed list', () => {
    const html = buildMedicationPassHtml(
      [
        makeMedication({ name: 'Aktiv', endDate: null }),
        makeMedication({ id: 2, name: 'Beendet', endDate: '2026-01-01' }),
      ],
      TODAY
    );
    expect(html).toContain('Aktiv');
    expect(html).not.toContain('Beendet');
  });

  it('does not include the side effects note or reminder times', () => {
    const html = buildMedicationPassHtml(
      [
        makeMedication({
          sideEffectsNote: 'Übelkeit',
          reminderTimes: [{ id: 1, time: '08:00', notificationId: null }],
        }),
      ],
      TODAY
    );
    expect(html).not.toContain('Übelkeit');
    expect(html).not.toContain('08:00');
  });

  it('escapes HTML special characters in the medication name', () => {
    const html = buildMedicationPassHtml([makeMedication({ name: '<script>alert(1)</script>' })], TODAY);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run colitis-app/src/features/medications/medicationPassBuilder.test.ts`
Expected: FAIL — `medicationPassBuilder.ts` does not exist yet (module not found).

- [ ] **Step 3: Write the implementation**

Create `colitis-app/src/features/medications/medicationPassBuilder.ts`:

```typescript
import { isMedicationActive, formatLocalDate } from './medicationStatus';
import type { Medication } from './types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMedicationStartDate(startDate: string): string {
  const [year, month, day] = startDate.split('-');
  return `${day}.${month}.${year}`;
}

function buildMedicationSection(medication: Medication): string {
  return `
    <section class="medication">
      <h2>${escapeHtml(medication.name)}</h2>
      <p>${escapeHtml(medication.dose)} &middot; ${escapeHtml(medication.schedule)}</p>
      <p>Seit ${formatMedicationStartDate(medication.startDate)}</p>
    </section>
  `;
}

export function buildMedicationPassHtml(medications: Medication[], today: Date): string {
  const activeMedications = medications.filter((medication) => isMedicationActive(medication.endDate, today));
  const body =
    activeMedications.length > 0
      ? activeMedications.map(buildMedicationSection).join('\n')
      : '<p>Keine aktiven Medikamente vorhanden.</p>';

  return `
    <!DOCTYPE html>
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, sans-serif; color: #2E2A26; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .generated { color: #6B6259; font-size: 12px; margin-bottom: 24px; }
          .medication { border-bottom: 1px solid #E4DACB; padding: 12px 0; }
          .medication h2 { font-size: 14px; margin: 0 0 6px; }
          .medication p { font-size: 12px; margin: 2px 0; }
        </style>
      </head>
      <body>
        <h1>Medikamenten-Pass</h1>
        <p class="generated">Erstellt am ${formatMedicationStartDate(formatLocalDate(today))}</p>
        ${body}
      </body>
    </html>
  `;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run colitis-app/src/features/medications/medicationPassBuilder.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün, keine neuen Typfehler.

- [ ] **Step 6: Commit**

```bash
git add colitis-app/src/features/medications/medicationPassBuilder.ts colitis-app/src/features/medications/medicationPassBuilder.test.ts
git commit -m "feat: HTML-Baufunktion fuer Medikamenten-Pass ergaenzen"
```

---

### Task 2: Export-Funktion (Datei schreiben & teilen)

**Files:**
- Create: `colitis-app/src/features/medications/medicationPassExport.ts`

**Interfaces:**
- Consumes: `buildMedicationPassHtml` aus `./medicationPassBuilder` (Task 1); `Medication` aus `./types`.
- Produces (für Task 3):
  - `export async function exportMedicationPass(medications: Medication[]): Promise<void>`

Diese Datei ist – wie das bestehende Vorbild `src/features/diary/diaryPdfExport.ts` – nicht automatisiert testbar (nutzt native Module `expo-print`/`expo-sharing`, die im Projekt-Testsetup nicht gemockt werden; es existiert auch keine Testdatei für `diaryPdfExport.ts`). Verifikation über `tsc --noEmit` in Schritt 2.

- [ ] **Step 1: Export-Funktion erstellen**

Create `colitis-app/src/features/medications/medicationPassExport.ts`:

```typescript
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildMedicationPassHtml } from './medicationPassBuilder';
import type { Medication } from './types';

export async function exportMedicationPass(medications: Medication[]): Promise<void> {
  const html = buildMedicationPassHtml(medications, new Date());
  const { uri } = await Print.printToFileAsync({ html });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
```

- [ ] **Step 2: Type-Check und volle Test-Suite**

Run: `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run` (aus `colitis-app/`)
Expected: Keine Fehler, alle bestehenden Tests weiterhin grün (diese Aufgabe fügt keine neuen Tests hinzu).

- [ ] **Step 3: Commit**

```bash
git add colitis-app/src/features/medications/medicationPassExport.ts
git commit -m "feat: Medikamenten-Pass als PDF schreiben und teilen"
```

---

### Task 3: Button im Medikamente-Tab verdrahten

**Files:**
- Modify: `colitis-app/app/(tabs)/medikamente/index.tsx`

**Interfaces:**
- Consumes: `exportMedicationPass` aus `../../../src/features/medications/medicationPassExport` (Task 2).
- Produces: Nichts für weitere Tasks — letzte Aufgabe dieses Plans.

Diese Aufgabe ändert nur eine bestehende Screen-Datei (UI-Verdrahtung), keine neue Logik — nicht automatisiert testbar, gleiches Muster wie der bestehende PDF-Export-Button im Tagebuch-Tab. Verifikation über `tsc --noEmit` und manuellen Test.

- [ ] **Step 1: Datei komplett ersetzen**

Ersetze den vollständigen Inhalt von `colitis-app/app/(tabs)/medikamente/index.tsx` mit:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import {
  listMedications,
  logMedicationTaken,
  listMedicationIdsTakenOn,
  endMedication,
  deleteMedication,
} from '../../../src/features/medications/db/medicationsRepository';
import { formatLocalDate } from '../../../src/features/medications/medicationStatus';
import {
  getScreeningReminder,
  upsertScreeningReminder,
  setScreeningReminderNotificationId,
  deleteScreeningReminder,
} from '../../../src/features/medications/db/screeningRepository';
import {
  configureNotificationHandling,
  requestNotificationPermission,
  cancelScheduledReminder,
  scheduleScreeningReminder,
} from '../../../src/lib/notifications/notificationService';
import { buildScreeningReminderContent } from '../../../src/features/medications/notifications/reminderContent';
import { exportMedicationPass } from '../../../src/features/medications/medicationPassExport';
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
  const [isExporting, setIsExporting] = useState(false);

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
    Alert.alert('Medikament beenden?', `„${medication.name}“ wird als beendet markiert, bleibt aber in der Liste.`, [
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
      const reminderTimes = await endMedication(db, medicationId, formatLocalDate(new Date()));
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

  function handleDelete(medicationId: number) {
    const medication = medications.find((entry) => entry.id === medicationId);
    if (!medication) {
      return;
    }
    Alert.alert('Medikament löschen?', `„${medication.name}“ wird endgültig gelöscht.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => void confirmDelete(medicationId),
      },
    ]);
  }

  async function confirmDelete(medicationId: number) {
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
    } catch (deleteError: unknown) {
      console.error('[Medikamente] Löschen fehlgeschlagen:', deleteError);
      setError('Medikament konnte nicht gelöscht werden.');
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

  async function handleDeleteScreeningReminder() {
    try {
      const db = await createEncryptedDb();
      const deleted = await deleteScreeningReminder(db);
      if (deleted?.notificationId) {
        await cancelScheduledReminder(deleted.notificationId);
      }
      setScreeningReminder(null);
      setError(null);
    } catch (deleteError: unknown) {
      console.error('[Medikamente] Vorsorge-Erinnerung löschen fehlgeschlagen:', deleteError);
      setError('Vorsorge-Erinnerung konnte nicht gelöscht werden.');
    }
  }

  async function handleExportPass() {
    setIsExporting(true);
    try {
      await exportMedicationPass(medications);
      setError(null);
    } catch (exportError: unknown) {
      console.error('[Medikamente] Medikamenten-Pass-Export fehlgeschlagen:', exportError);
      setError('Medikamenten-Pass konnte nicht exportiert werden.');
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
      <ScreeningReminderCard
        reminder={screeningReminder}
        onSave={handleSaveScreeningReminder}
        onDelete={handleDeleteScreeningReminder}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isExporting || medications.length === 0 }}
        accessibilityLabel="Medikamenten-Pass als PDF exportieren"
        disabled={isExporting || medications.length === 0}
        style={[styles.exportLink, (isExporting || medications.length === 0) && styles.exportLinkDisabled]}
        onPress={handleExportPass}
      >
        <Text style={styles.exportLinkText}>
          {isExporting ? 'PDF wird erstellt …' : 'Medikamenten-Pass als PDF exportieren'}
        </Text>
      </Pressable>
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
          onDelete={handleDelete}
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

Änderungen gegenüber der bisherigen Datei: neuer Import von `exportMedicationPass`, neuer `isExporting`-State, neue `handleExportPass`-Funktion, neuer Export-Button zwischen `ScreeningReminderCard` und der Medikamentenliste, drei neue Styles (`exportLink`, `exportLinkDisabled`, `exportLinkText`). Alle bestehenden Handler, State-Variablen und der `MedicationList`/`addButton`-Teil bleiben inhaltlich unverändert.

- [ ] **Step 2: Type-Check**

Run: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Keine Fehler.

- [ ] **Step 3: Vollständige Test-Suite laufen lassen**

Run: `npx.cmd vitest run` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün.

- [ ] **Step 4: Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build)**

- Medikamente-Tab öffnen, mindestens ein aktives Medikament anlegen → Button "Medikamenten-Pass als PDF exportieren" ist aktiv.
- Export antippen → PDF wird erstellt und der Teilen-Dialog öffnet sich, PDF enthält Name/Dosis/Schema/Startdatum des Medikaments.
- Ein Medikament beenden, dann exportieren → das beendete Medikament erscheint nicht mehr im PDF.
- Alle Medikamente löschen (Liste komplett leer) → Button ist deaktiviert.
- Nur beendete Medikamente vorhanden (keine aktiven) → Button bleibt aktiv, PDF zeigt "Keine aktiven Medikamente vorhanden."
- Alle drei Themes (Standard, Dunkel, Blau-Weiß) durchschalten und den neuen Button auf Lesbarkeit prüfen.

- [ ] **Step 5: Commit**

```bash
git add "colitis-app/app/(tabs)/medikamente/index.tsx"
git commit -m "feat: Medikamenten-Pass-Export-Button im Medikamente-Tab verdrahten"
```
