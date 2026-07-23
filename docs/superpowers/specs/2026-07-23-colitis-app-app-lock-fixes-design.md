# Colitis2Go – Design: App-Sperre-Fixes

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-23*
*Grundlage: manuelles Testen der App nach dem UI-Polish-Release; Root-Cause-Analyse per superpowers:systematic-debugging*

## Kontext & Ziel

Beim Testen wurden zwei Probleme mit der App-Sperre (PIN-Schutz) gefunden:

1. Öffnet man den Toiletten-Tab bei aktivierter App-Sperre, wird man erneut zur PIN-Eingabe aufgefordert – obwohl man die App nie wirklich verlassen hat.
2. Die App-Sperre lässt sich ohne jede Rückfrage deaktivieren.

## Root-Cause-Analyse (Problem 1)

`src/features/appLock/useAppLockGate.ts` registriert einen `AppState`-Listener, der bei **jedem** Wechsel zu `'active'` erneut sperrt, sofern die App-Sperre aktiviert ist – unabhängig davon, woher der Zustandswechsel kam. `app/(tabs)/toiletten/index.tsx` ruft in seinem `useFocusEffect` bei jedem Fokussieren `Location.requestForegroundPermissionsAsync()` auf. Ist die Berechtigung noch nicht erteilt (z. B. nach einer frischen Installation), zeigt Android einen System-Berechtigungsdialog – dieser lässt die App kurz den Fokus verlieren, was React Native als `AppState`-Wechsel meldet. Der Listener interpretiert das fälschlich als echtes Verlassen der App und sperrt sofort erneut. Der Code existiert seit einem sehr frühen Commit dieser App und ist keine Regression durch kürzlich gemergte Features.

Der zweite ursprünglich vermutete Effekt ("man landet nach dem Entsperren im Tagebuch-Tab") ist laut Nutzer **kein zu behebendes Problem** – das Verhalten ist akzeptabel, solange die unnötige Neusperrung selbst verschwindet. Dieser Punkt ist daher nicht Teil dieser Spec.

## 1. Re-Lock-Fix

Neue Datei `src/features/appLock/pendingPermissionGuard.ts` mit einem einfachen Modul-Flag:

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

`app/(tabs)/toiletten/index.tsx` umschließt den bestehenden `Location.requestForegroundPermissionsAsync()`-Aufruf mit `beginPendingPermissionRequest()` davor und `endPendingPermissionRequest()` in einem `finally`-Block danach. `src/features/appLock/useAppLockGate.ts`s `AppState`-Listener prüft zusätzlich `isPermissionRequestPending()` und überspringt das Re-Lock, solange die Anfrage läuft.

Die generelle Sperrlogik (Sperren bei echtem App-Wechsel/Hintergrund, z. B. Task-Switch oder Sperrbildschirm des Geräts) bleibt unverändert – nur das nachgewiesene Zeitfenster der eigenen Standort-Berechtigungsanfrage wird ausgenommen. Kein Eingriff in die Sperrbildschirm-/Navigations-Architektur (`app/_layout.tsx` bleibt unverändert, da Punkt 2 der ursprünglichen Beobachtung explizit kein zu behebendes Problem ist).

## 2. Bestätigungsabfrage beim Deaktivieren

In `app/(tabs)/einstellungen/index.tsx` wird `handleToggleLock` angepasst: Beim Ausschalten (`value === false`) erscheint zunächst `Alert.alert('App-Sperre deaktivieren?', 'Möchtest du die App-Sperre wirklich deaktivieren?', [...])` mit "Abbrechen" (Standard) und einer hervorgehobenen "Deaktivieren"-Aktion – gleiches Muster wie die bestehenden Lösch-Bestätigungen in der App (z. B. Medikament löschen). Erst bei Bestätigung führt eine neue `confirmDisableLock()`-Funktion `disableAppLock()` aus und setzt `isLockEnabled` auf `false`. Bricht der Nutzer ab, bleibt `isLockEnabled` unverändert `true`; da der `SliderToggle` über diesen State gesteuert wird (`value={isLockEnabled}`), zeigt er automatisch wieder "an" – kein zusätzlicher Rücksetz-Code nötig.

## 3. Fehlerbehandlung

- Keine neuen Fehlerfälle bei Punkt 1 – reine Zustandsprüfung ohne I/O.
- Bei Punkt 2 bleibt die bestehende Fehlerbehandlung von `disableAppLock()` (Anzeige von `lockActionError` bei Fehlschlag) unverändert erhalten, nur hinter der neuen Bestätigung.

## 4. Testing-Ansatz

- Unit-Test für `pendingPermissionGuard.ts` (einzige reine Funktion in diesem Fix): `isPermissionRequestPending()` gibt `false` zurück, bevor `beginPendingPermissionRequest()` aufgerufen wurde; `true` danach; `false` nach `endPendingPermissionRequest()`.
- Die restlichen Änderungen (AppState-Listener-Anpassung, Toiletten-Screen-Integration, Bestätigungsdialog) sind UI-/Native-Verhalten ohne extrahierbare reine Logik – wie bei ähnlichen Fixes in diesem Projekt nicht automatisiert testbar. Verifikation über `tsc --noEmit`, die bestehende Vitest-Suite (muss unverändert grün bleiben) und manuellen Test:
  - Frische Installation, App-Sperre aktivieren, Toiletten-Tab öffnen (Berechtigungsdialog erscheint) → keine erneute PIN-Abfrage danach.
  - App-Sperre aktivieren, App wirklich in den Hintergrund schicken (Home-Button) und zurückholen → PIN-Abfrage erscheint weiterhin wie gewollt.
  - App-Sperre ausschalten wollen → Bestätigungsdialog erscheint → "Abbrechen" → Schalter bleibt an, Sperre bleibt aktiv.
  - Erneut versuchen → "Deaktivieren" → Sperre wird deaktiviert, Schalter zeigt "aus".

## Explizit nicht Teil dieses Schritts

- Keine Änderung an der Sperrbildschirm-/Navigations-Architektur (`app/_layout.tsx`), da das "im Tagebuch-Tab landen nach Entsperren"-Verhalten laut Nutzer akzeptabel ist.
- Keine zusätzliche PIN-Abfrage beim Deaktivieren – nur ein Bestätigungsdialog, wie abgestimmt.
- Keine generelle Härtung des `AppState`-Listeners über den nachgewiesenen Berechtigungsdialog-Fall hinaus.

---

*Hinweis: Diese Änderungen betreffen ausschließlich Anzeige- und Sicherheitsverhalten der bestehenden App-Sperre, keine medizinische Bewertung oder Empfehlung.*
