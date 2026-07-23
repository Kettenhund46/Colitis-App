# UI-Polish-Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drei vom Nutzer gemeldete UI-Probleme beheben: fehlendes visuelles Feedback beim Beenden eines Medikaments, über Tab-Wechsel hinweg bestehen bleibende Fehlermeldungen, und verschachtelte Tab-Stacks, die sich ihre zuletzt besuchte Unterseite merken statt zur Startseite zurückzukehren.

**Architecture:** Drei unabhängige, kleine Änderungen an bestehendem Code – keine neue Geschäftslogik, keine neuen Dateien. Fix 1 ändert eine Bedingung in einer bestehenden Listen-Komponente. Fix 2 ergänzt `useFocusEffect`-Cleanups (bereits etabliertes Muster in der App) in drei Dateien. Fix 3 ergänzt eine React-Navigation-Option, die Expo Router bereits mitbringt.

**Tech Stack:** React Native / Expo Router, TypeScript. Keine neuen Abhängigkeiten.

## Global Constraints

- Referenz: `docs/superpowers/specs/2026-07-23-colitis-app-ui-polish-fixes-design.md`
- Keine Änderung an `isMedicationActive` (`src/features/medications/medicationStatus.ts`) oder der Aktiv/Beendet-Sektionslogik in `MedicationList.tsx` – nur der "Beenden"-Button-Bereich wird angepasst.
- "Heute genommen" muss am Beendigungstag weiterhin nutzbar bleiben.
- Fehlermeldungen werden nur beim Verlassen des jeweiligen Tabs zurückgesetzt (Blur-Cleanup via `useFocusEffect`) – Eingabefelder (bereits getippter Text) bleiben unverändert.
- `popToTopOnBlur: true` gilt für die Tabs `tagebuch`, `medikamente`, `wissen` – nicht für `toiletten` oder `einstellungen` (keine Unterseiten).
- Diese Änderungen betreffen ausschließlich Anzeige-/Navigationsverhalten – keine automatisierten Tests dafür vorgesehen (wie bei ähnlichen reinen UI-Änderungen in diesem Projekt). Verifikation über `tsc --noEmit` und die bestehende Vitest-Suite (muss unverändert grün bleiben) plus eine dokumentierte manuelle Test-Checkliste.
- Windows-Testbefehl: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`).
- `AGENTS.md` beachten: Expo SDK 57 Doku unter https://docs.expo.dev/versions/v57.0.0/ ist maßgeblich, falls Expo-APIs verwendet werden (hier: `useFocusEffect` aus `expo-router`, bereits etabliert; `popToTopOnBlur` ist eine React-Navigation-Bottom-Tabs-Option, die Expo Router intern mitbringt, kein neuer Import nötig außer der Options-Ergänzung selbst).

---

### Task 1: Medikamente – "Beenden"-Feedback

**Files:**
- Modify: `colitis-app/src/features/medications/components/MedicationList.tsx`

**Interfaces:**
- Consumes: nichts Neues – nutzt weiterhin `Medication.endDate` und `isMedicationActive` aus `../medicationStatus` (unverändert).
- Produces: nichts für weitere Tasks (unabhängiger Fix).

Dieser Task ändert eine bestehende UI-Datei – nicht automatisiert testbar (reine Anzeige-Logik ohne extrahierbare reine Funktion). Verifikation über `tsc --noEmit`, die bestehende Vitest-Suite und manuellen Test in Schritt 3.

- [ ] **Step 1: "Beenden"-Button durch bedingte Anzeige ersetzen**

In `colitis-app/src/features/medications/components/MedicationList.tsx`, ändere den bestehenden Block:

```typescript
              {isActive && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} beenden`}
                  style={styles.endButton}
                  onPress={() => onEnd(item.id)}
                >
                  <Text style={styles.endButtonText}>Beenden</Text>
                </Pressable>
              )}
```

zu:

```typescript
              {isActive &&
                (item.endDate === null ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} beenden`}
                    style={styles.endButton}
                    onPress={() => onEnd(item.id)}
                  >
                    <Text style={styles.endButtonText}>Beenden</Text>
                  </Pressable>
                ) : (
                  <View
                    accessibilityRole="text"
                    accessibilityLabel={`${item.name} beendet`}
                    style={styles.endedHintBadge}
                  >
                    <Text style={styles.endedHintBadgeText}>Beendet</Text>
                  </View>
                ))}
```

- [ ] **Step 2: Neue Stile für den "Beendet"-Hinweis ergänzen**

In derselben Datei, ergänze in `makeStyles` (nach `endButtonText`, vor `deleteButton`):

```typescript
    endedHintBadge: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.border,
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.md,
    },
    endedHintBadgeText: { color: colors.textSecondary, fontSize: tokens.typography.fontSize.sm },
```

- [ ] **Step 3: Type-Check, volle Test-Suite und manueller Test**

Run (aus `colitis-app/`): `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run`
Expected: Keine Fehler, alle bestehenden Tests weiterhin grün (dieser Task ändert keine getestete Logik).

Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build):
- Ein neues Medikament ohne Enddatum anlegen → "Beenden"-Button sichtbar.
- "Beenden" antippen und bestätigen → Button wird sofort durch einen deaktiviert aussehenden "Beendet"-Hinweis ersetzt, das Medikament bleibt für den heutigen Tag im oberen (aktiven) Bereich der Liste.
- "Heute genommen" für dasselbe Medikament antippen → funktioniert weiterhin wie gewohnt.
- App-Datum simulieren/warten bis zum Folgetag (oder ein Medikament mit einem Enddatum in der Vergangenheit betrachten) → Medikament erscheint im "Beendet"-Bereich mit "Beendet am …"-Text, wie bisher.

- [ ] **Step 4: Commit**

```bash
git add colitis-app/src/features/medications/components/MedicationList.tsx
git commit -m "fix: Sofortiges Beendet-Feedback im Medikamente-Tab ergaenzen"
```

---

### Task 2: Fehlermeldungen zurücksetzen bei Tab-Wechsel

**Files:**
- Modify: `colitis-app/src/features/medications/components/ScreeningReminderCard.tsx`
- Modify: `colitis-app/src/features/backup/components/BackupPasswordForm.tsx`
- Modify: `colitis-app/app/(tabs)/einstellungen/index.tsx`

**Interfaces:**
- Consumes: `useFocusEffect` aus `expo-router` (bereits im Projekt verwendet, z. B. in `einstellungen/index.tsx` selbst).
- Produces: nichts für weitere Tasks (unabhängiger Fix).

Dieser Task ändert drei bestehende UI-Dateien – nicht automatisiert testbar. Verifikation über `tsc --noEmit`, die bestehende Vitest-Suite und manuellen Test in Schritt 4.

- [ ] **Step 1: `ScreeningReminderCard.tsx` um Blur-Reset ergänzen**

In `colitis-app/src/features/medications/components/ScreeningReminderCard.tsx`, ändere den Import-Block:

```typescript
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
```

zu:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
```

Ergänze direkt nach der bestehenden Zeile `const [isSaving, setIsSaving] = useState(false);`:

```typescript
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      return () => setError(null);
    }, [])
  );
```

- [ ] **Step 2: `BackupPasswordForm.tsx` um Blur-Reset ergänzen**

In `colitis-app/src/features/backup/components/BackupPasswordForm.tsx`, ändere die erste Zeile:

```typescript
import { useState } from 'react';
```

zu:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
```

Ergänze direkt nach der bestehenden Zeile `const [isSubmitting, setIsSubmitting] = useState(false);`:

```typescript
  const [isSubmitting, setIsSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      return () => setError(null);
    }, [])
  );
```

- [ ] **Step 3: `einstellungen/index.tsx` – bestehenden Cleanup um `backupMessage` erweitern**

In `colitis-app/app/(tabs)/einstellungen/index.tsx`, ändere im bestehenden `useFocusEffect`-Block (innerhalb der `useCallback`-Funktion, aktuell endend mit `return () => { isActive = false; };`):

```typescript
      return () => {
        isActive = false;
      };
    }, [])
  );
```

zu:

```typescript
      return () => {
        isActive = false;
        setBackupMessage(null);
      };
    }, [])
  );
```

- [ ] **Step 4: Type-Check, volle Test-Suite und manueller Test**

Run (aus `colitis-app/`): `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run`
Expected: Keine Fehler, alle bestehenden Tests weiterhin grün.

Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build):
- Medikamente-Tab → Vorsorge-Koloskopie bearbeiten → ungültiges Intervall (z. B. `0` oder Text) eingeben und speichern → Fehlermeldung erscheint.
- Zu einem anderen Tab wechseln und zurück zu Medikamente → Fehlermeldung ist verschwunden, Formular zeigt wieder den Ausgangszustand.
- Einstellungen-Tab → "Backup erstellen" → zu kurzes Passwort eingeben und bestätigen → Fehlermeldung erscheint.
- Zu einem anderen Tab wechseln und zurück zu Einstellungen → Fehlermeldung ist verschwunden.
- Einstellungen-Tab → "Backup wiederherstellen" → ungültige Datei auswählen (oder Vorgang abbrechen und erneut versuchen mit falschem Passwort) → Fehlermeldung erscheint.
- Zu einem anderen Tab wechseln und zurück zu Einstellungen → Fehlermeldung ist verschwunden.

- [ ] **Step 5: Commit**

```bash
git add colitis-app/src/features/medications/components/ScreeningReminderCard.tsx colitis-app/src/features/backup/components/BackupPasswordForm.tsx "colitis-app/app/(tabs)/einstellungen/index.tsx"
git commit -m "fix: Fehlermeldungen bei Tab-Wechsel zuruecksetzen"
```

---

### Task 3: Tab-Stack-Reset (popToTopOnBlur)

**Files:**
- Modify: `colitis-app/app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: nichts Neues – `popToTopOnBlur` ist eine bereits von Expo Router mitgelieferte Option der Bottom-Tabs-Navigator-Options (`node_modules/expo-router/build/react-navigation/bottom-tabs/types.d.ts`), kein neuer Import nötig.
- Produces: nichts für weitere Tasks (letzter Task dieses Plans).

Dieser Task ändert eine bestehende UI-Datei – nicht automatisiert testbar. Verifikation über `tsc --noEmit`, die bestehende Vitest-Suite und manuellen Test in Schritt 2.

- [ ] **Step 1: `popToTopOnBlur` für die drei betroffenen Tabs ergänzen**

In `colitis-app/app/(tabs)/_layout.tsx`, ändere:

```typescript
      <Tabs.Screen
        name="tagebuch"
        options={{
          title: 'Tagebuch',
          tabBarIcon: ({ color, size }) => <Ionicons name="journal-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wissen"
        options={{
          title: 'Wissen',
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="medikamente"
        options={{
          title: 'Medikamente',
          tabBarIcon: ({ color, size }) => <Ionicons name="medical-outline" size={size} color={color} />,
        }}
      />
```

zu:

```typescript
      <Tabs.Screen
        name="tagebuch"
        options={{
          title: 'Tagebuch',
          popToTopOnBlur: true,
          tabBarIcon: ({ color, size }) => <Ionicons name="journal-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wissen"
        options={{
          title: 'Wissen',
          popToTopOnBlur: true,
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="medikamente"
        options={{
          title: 'Medikamente',
          popToTopOnBlur: true,
          tabBarIcon: ({ color, size }) => <Ionicons name="medical-outline" size={size} color={color} />,
        }}
      />
```

(`toiletten/index` und `einstellungen/index` bleiben unverändert – keine Unterseiten.)

- [ ] **Step 2: Type-Check, volle Test-Suite und manueller Test**

Run (aus `colitis-app/`): `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run`
Expected: Keine Fehler, alle bestehenden Tests weiterhin grün.

Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build):
- Tagebuch-Tab öffnen → "Muster-Auswertung ansehen" oder "Arztbesuche verwalten" antippen → zu einem anderen Tab wechseln → zurück zu Tagebuch → Tagebuch-Startseite (Liste/Kalender) wird angezeigt, nicht die zuvor besuchte Unterseite.
- Medikamente-Tab öffnen → ein Medikament zum Bearbeiten öffnen → zu einem anderen Tab wechseln → zurück zu Medikamente → Medikamenten-Liste wird angezeigt, nicht der Bearbeiten-Screen.
- Wissen-Tab öffnen → einen Artikel oder "Neuigkeiten ansehen" öffnen → zu einem anderen Tab wechseln → zurück zu Wissen → Artikel-Übersicht wird angezeigt, nicht die zuvor besuchte Unterseite.
- Toiletten- und Einstellungen-Tab weiterhin normal nutzbar (keine Regressionen, da unverändert).

- [ ] **Step 3: Commit**

```bash
git add "colitis-app/app/(tabs)/_layout.tsx"
git commit -m "fix: Tab-Stacks bei Tab-Wechsel auf Startseite zuruecksetzen"
```
