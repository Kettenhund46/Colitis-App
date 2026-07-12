# Colitis-Ulcerosa-App – Design: Eigene Medikamentenliste & Erinnerungen (Schritt 5)

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-12*
*Grundlage: [2026-07-07-colitis-ulcerosa-app-design.md](2026-07-07-colitis-ulcerosa-app-design.md) (Hauptspec, Abschnitt 4b/8), [2026-07-09-colitis-app-wissens-db-design.md](2026-07-09-colitis-app-wissens-db-design.md) (Schritt 4, grenzt den allgemeinen Medikamenten-Artikel bewusst von diesem Schritt ab)*

## Kontext & Ziel

Umsetzungsschritt 5 der Hauptspec: Adrian pflegt seine eigenen Medikamente (Name, Dosis, Einnahmeschema), trackt tatsächliche Einnahmen und bekommt lokale Erinnerungen dafür sowie für die fällige Vorsorge-Koloskopie. Die Tabellen `medications`, `medication_log` und `screening_reminders` existieren bereits im Schema (Schritt 1), sind aber noch ungenutzt.

## 1. Navigation

Neuer, 5. Tab **"Medikamente"** (gleichrangig neben Tagebuch, Wissen, Toiletten, Einstellungen) — Adrian entschied sich bewusst gegen eine Unterordnung im Wissen-Tab, da tägliches Einnahme-Tracking und die Vorsorge-Erinnerung leicht auffindbar sein sollen.

- `app/(tabs)/medikamente/index.tsx` — Liste aller Medikamente + Vorsorge-Reminder-Bereich
- `app/(tabs)/medikamente/neu.tsx` — Formular zum Anlegen; dieselbe Formular-Komponente wird auch für "Bearbeiten" wiederverwendet (`app/(tabs)/medikamente/[id]/bearbeiten.tsx`)

## 2. Datenmodell (Migration auf bestehendem Schema)

**Neue Tabelle `medication_reminder_times`:**

| Spalte | Typ | Bedeutung |
|---|---|---|
| `id` | integer, PK | |
| `medicationId` | integer, FK → `medications.id` | |
| `time` | text `HH:mm` | Uhrzeit der täglichen Erinnerung |
| `notificationId` | text, nullable | ID der bei `expo-notifications` geplanten Benachrichtigung, zum gezielten Canceln bei Änderung/Löschung |

Ein Medikament kann 0..n Erinnerungszeiten haben. 0 Erinnerungszeiten (z. B. bei "bei Bedarf"-Medikamenten) bedeutet: kein Push, nur Eintrag in der Liste.

**`screening_reminders` erhält eine neue Spalte** `notificationId` (text, nullable), gleicher Zweck wie oben. Genau ein aktiver Vorsorge-Reminder wird in der UI verwaltet (die Tabelle erlaubt technisch mehrere Zeilen, die UI zeigt/bearbeitet aber nur den einen aktuell nächsten fälligen Termin — kein Bedarf für mehrere parallele Vorsorge-Arten in Phase 1).

**`medications.schedule` bleibt unverändert** (Freitext wie bisher, z. B. "1x täglich morgens"): rein beschreibend für die Anzeige. Die tatsächlichen Erinnerungszeiten kommen ausschließlich aus `medication_reminder_times`. `medications.endDate` (existiert bereits) markiert ein beendetes Medikament — es gibt kein hartes Löschen, um die Fremdschlüssel-Historie in `medication_log` nicht zu gefährden.

## 3. Medikamente-Tab

- **Liste:** aktive Medikamente (kein `endDate` oder `endDate` in der Zukunft) oben, beendete darunter abgesetzt/eingeklappt dargestellt
- Pro aktivem Medikament: Name, Dosis, Schema-Text, gesetzte Erinnerungszeiten, ein **"Heute genommen"**-Button — ein Tap schreibt sofort einen `medication_log`-Eintrag mit dem aktuellen Zeitstempel (kein Bezug zu einer bestimmten Erinnerungszeit nötig, siehe Abschnitt 5)
- Aktion **"Beenden"** pro aktivem Medikament setzt `endDate = heute` und cancelt alle noch geplanten Erinnerungen dieses Medikaments
- **Formular** (Anlegen/Bearbeiten, eine Komponente für beide Fälle): Name, Dosis, Schema-Freitext, Startdatum, optionales Enddatum, 0..n Erinnerungszeiten (hinzufügen/entfernen einzelner `HH:mm`-Einträge)
- **Vorsorge-Koloskopie-Bereich:** eigene Karte mit Intervall (Monate), nächstem fälligem Datum, optionaler Notiz — Adrian trägt Intervall und Datum manuell ein (keine automatische Ableitung aus Krankheitsdauer/-ausdehnung, das wäre medizinisch individuell und ärztlich abzustimmen); Ändern von Intervall/Datum cancelt die alte geplante Benachrichtigung und plant die neue

## 4. Erinnerungs-Logik (`expo-notifications`, neue Abhängigkeit)

- **Reine Berechnungslogik** (framework-frei, vollständig automatisiert testbar): aus einer `HH:mm`-Zeit den nächsten Auslösezeitpunkt berechnen (heute, falls Uhrzeit noch nicht vorbei, sonst morgen); für den Vorsorge-Reminder den Auslösezeitpunkt aus dem gespeicherten `nextDueDate` ableiten.
- **Notification-Service** kapselt die eigentliche `expo-notifications`-Anbindung:
  - Berechtigung wird lazy angefragt — erst wenn Adrian die erste Erinnerungszeit für ein Medikament oder den Vorsorge-Reminder setzt, nicht global beim App-Start
  - Tägliche, wiederkehrende lokale Benachrichtigung je Erinnerungszeit planen (`trigger: {type: 'daily', hour, minute}`); die zurückgegebene `notificationId` wird in `medication_reminder_times.notificationId` gespeichert
  - Einmalige lokale Benachrichtigung für das Vorsorge-Datum planen, `notificationId` in `screening_reminders.notificationId`
  - Canceln über die gespeicherte `notificationId`, wenn eine Erinnerungszeit gelöscht, ein Medikament beendet, oder der Vorsorge-Termin geändert wird
- **Wird die Berechtigung verweigert:** die Erinnerungszeit/der Vorsorge-Termin wird trotzdem gespeichert und in der Liste angezeigt, nur ohne echte Push-Benachrichtigung. Deutscher Hinweistext im Formular-Bereich: "Benachrichtigungen sind deaktiviert — Erinnerungszeiten werden nur angezeigt, aber nicht als Push gesendet."
- **100% lokal:** keine Server-/Cloud-Push-Infrastruktur, ausschließlich lokale, auf dem Gerät geplante Benachrichtigungen (passend zum Datenschutz-Grundsatz der App)

## 5. Einnahme-Tracking (UX-Entscheidung)

Kein Interaktions-Button direkt in der Push-Benachrichtigung (Verhalten von Notification-Action-Buttons unterscheidet sich zwischen Android/iOS und ist zusätzlicher Komplexitätsaufwand ohne klaren Mehrwert). Stattdessen: ein einfacher **"Heute genommen"**-Button direkt in der Medikamenten-Liste, jederzeit tippbar, unabhängig davon, ob gerade eine Erinnerung ausstehen war. Bei mehreren Einnahmen pro Tag (z. B. 2x täglich) kann der Button mehrfach getippt werden — jeder Tap erzeugt einen eigenen `medication_log`-Eintrag mit Zeitstempel.

## 6. Fehlerbehandlung

- DB-Fehler beim Speichern/Lesen von Medikamenten, Erinnerungszeiten oder Log-Einträgen: verständliche deutsche Fehlermeldung, lokales Logging, kein stiller Datenverlust (gleiches Muster wie Tagebuch- und Wissens-Modul)
- Scheitert das Planen einer Benachrichtigung bei `expo-notifications` (z. B. Berechtigung nachträglich entzogen), wird das lokal geloggt; die Erinnerungszeit bleibt in der DB und wird als "Push evtl. nicht aktiv" markiert, statt die gesamte Speicherung abzubrechen
- Ungültige Uhrzeit-Eingabe im Formular: Validierung vor dem Speichern, klare deutsche Fehlermeldung statt stillem Fehlschlag

## 7. Testing-Ansatz

- Unit-Tests (Vitest) für die reine Auslösezeitpunkt-Berechnung: Uhrzeit heute noch nicht erreicht → heute; Uhrzeit heute schon vorbei → morgen; Vorsorge-Datum in der Zukunft/Vergangenheit
- Unit-Tests (echte temporäre SQLite-DB wie in Plan 2/4) für Repository-Funktionen: Medikament anlegen/bearbeiten/beenden, Erinnerungszeiten hinzufügen/entfernen, Einnahme-Log schreiben, Vorsorge-Reminder lesen/aktualisieren
- Der Notification-Service wird nach demselben Muster wie `src/lib/encryption.ts` getestet: `expo-notifications` wird per `vi.mock` ersetzt, und die Aufruf-Logik (welche Werte an welche Funktion übergeben werden, welcher Trigger berechnet wird) wird vollständig automatisiert geprüft. Nur das tatsächliche Anzeigen einer Benachrichtigung auf einem echten Gerät bleibt ungeprüft und wird beim späteren Alltagstest mitgeprüft
- Component-/Screen-Tests entfallen wie bei allen bisherigen Schritten (React Native lässt sich unter Vitest nicht einbinden) — manuelles Testen der Darstellung beim Alltagstest (Schritt 8)

## Explizit nicht Teil dieses Schritts

- Automatische Ableitung des Vorsorge-Intervalls aus Krankheitsdauer/-ausdehnung (Adrian trägt es manuell ein)
- Checkliste pro einzelnem geplanten Erinnerungszeitpunkt (nur ein einfacher "Heute genommen"-Button)
- Interaktions-Buttons direkt in der Push-Benachrichtigung
- Hartes Löschen von Medikamenten (nur "Beenden" über `endDate`)
- Mehrere parallele Vorsorge-Reminder-Arten (nur ein Koloskopie-Reminder)
- PDF/CSV-Export der Einnahme-Historie (das ist Schritt 7, Backup/Export)

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Medizinische Entscheidungen (Vorsorge-Intervalle, Medikamentendosierung) trifft Adrian in Rücksprache mit seinem Arzt.*
