# Fix-Bericht: Tagebuch-Erinnerung gegen stille Ausfaelle absichern

Datum: 2026-08-20

## Rote-Faden-Regel

"Jeder Misserfolg beim Planen setzt die gespeicherte Einstellung auf aus." Die Regel wurde
zentral in `rescheduleDiaryReminder` (Aenderung 1) verankert. Alle Aufrufer (Bedienung im
Einstellungen-Screen, App-Start, Wiederherstellung einer Sicherung) profitieren automatisch,
ohne die Regel an mehreren Stellen zu duplizieren.

## Umgesetzte Aenderungen

1. **Kritisch** — `src/features/diary/scheduleDiaryReminder.ts`: Bei verweigerter Berechtigung
   und bei fehlgeschlagenem Planen wird jetzt zusaetzlich `setDiaryReminderEnabled(false)`
   aufgerufen, bevor die Funktion zurueckkehrt.
2. `src/features/diary/scheduleDiaryReminder.test.ts`: Beide betroffenen Tests pruefen nun
   zusaetzlich `expect(await getDiaryReminderEnabled()).toBe(false)`.
3. **Kritisch** — `app/(tabs)/einstellungen/index.tsx`: Nach dem Wiederherstellen einer
   Sicherung wird `rescheduleDiaryReminder()` zusaetzlich zu `rescheduleAllReminders` und
   `rescheduleBackupReminder` aufgerufen, damit die Tagebuch-Erinnerung nicht tot bleibt,
   waehrend der Schalter weiterhin "an" zeigt.
4. **Wichtig** — `app/_layout.tsx`: `configureNotificationHandling()` wird jetzt auch beim
   App-Start aufgerufen (vor `rescheduleDiaryReminder()`), damit faellige Benachrichtigungen
   auch im Vordergrund angezeigt werden.
5. **Wichtig** — `src/features/diary/components/DiaryReminderSettings.tsx`:
   - `isMountedRef` wird beim Aufsetzen wieder auf `true` gesetzt (StrictMode-sicher).
   - Neuer `isBusy`-Zustand sperrt Schalter und Uhrzeit-Eingabe waehrend eines laufenden
     Planungsvorgangs, um doppeltes Antippen und nebenlaeufige Planungen zu verhindern.
   - `applyResult` wurde durch `runReschedule` ersetzt: Bei `permission-denied`/`failed`
     schreibt die Komponente nicht mehr selbst in den Speicher (das erledigt jetzt
     `rescheduleDiaryReminder`), sondern spiegelt nur die Anzeige. Bei einer geworfenen
     Ausnahme setzt sie zusaetzlich zurueck, da dort unklar ist, wie weit die Planungsfunktion
     gekommen ist.

## Ausgefuehrte Befehle (aus dem Ordner colitis-app)

### 1. `npx.cmd vitest run src/features/diary/scheduleDiaryReminder.test.ts`

```
 RUN  v4.1.10 D:/Claude/.claude/worktrees/erinnerung-schweregrad/colitis-app

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  18:14:45
   Duration  365ms (transform 65ms, setup 0ms, import 101ms, tests 10ms, environment 0ms)
```

### 2. `npx.cmd tsc --noEmit --pretty false`

Keine Ausgabe — sauberer Durchlauf ohne Fehler.

### 3. `npx.cmd vitest run`

```
 RUN  v4.1.10 D:/Claude/.claude/worktrees/erinnerung-schweregrad/colitis-app

 Test Files  60 passed (60)
      Tests  463 passed (463)
   Start at  18:15:05
   Duration  7.75s (transform 8.89s, setup 0ms, import 33.42s, tests 5.29s, environment 9ms)
```

## Status

Alle drei Befehle liefen sauber durch. Keine Testerwartungen wurden angepasst, um die Umsetzung
kuenstlich passend zu machen.

## Commit

Siehe Commit-Hash in der finalen Antwort an den Nutzer.
