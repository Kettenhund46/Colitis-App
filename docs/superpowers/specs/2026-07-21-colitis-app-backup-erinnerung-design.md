# Colitis2Go – Design: Backup-Erinnerung

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-21*
*Grundlage: [2026-07-14-colitis-app-app-sperre-backup-design.md](2026-07-14-colitis-app-app-sperre-backup-design.md) (bestehendes Backup-Feature)*

## Kontext & Ziel

Die App hat bereits ein manuelles, verschlüsseltes Backup-Export/Import (siehe Grundlage). Es gibt aber keine Erinnerung daran, ein Backup auch tatsächlich regelmäßig zu erstellen — vergisst man es, gibt es dafür keinen Hinweis. Ziel dieses Schritts ist eine lokale Push-Erinnerung, die nach einem konfigurierbaren Intervall seit dem letzten erfolgreichen Backup-Export auslöst.

Teil einer größeren Liste offline-fähiger Erweiterungsideen (siehe Brainstorming vom 2026-07-21); dieser Schritt behandelt ausschließlich die Backup-Erinnerung.

## 1. Speicherung des Erinnerungs-Zustands

Geräte-lokal in `AsyncStorage`, analog zu den bestehenden Einstellungen in `src/features/settings/settingsStorage.ts` (Theme, Wortwitz-Schalter). Bewusst **nicht** Teil der verschlüsselten SQLite-Datenbank und **nicht** Teil des Backup-Exports selbst — der Erinnerungs-Zustand ist eine App-Einstellung dieses Geräts, kein persönlicher Gesundheitsdatensatz, und soll unabhängig von Backup-Restores funktionieren.

Neue Schlüssel (Erweiterung der bestehenden Datei):

- `backupReminderEnabled: boolean | null` — `null` bedeutet "noch nie explizit gesetzt" (weder von Adrian noch automatisch); wird beim Lesen als `true` behandelt, sobald `lastBackupAt` gesetzt ist, sonst als `false`. Sobald Adrian den Schalter einmal manuell betätigt, wird immer ein expliziter `true`/`false`-Wert gespeichert und danach nie wieder automatisch überschrieben.
- `backupReminderIntervalDays: number` — Default `30`, wählbar aus `[14, 30, 60, 90]`
- `lastBackupAt: string | null` — ISO-Zeitstempel des letzten erfolgreichen Backup-**Exports**
- `backupReminderNotificationId: string | null` — ID der aktuell geplanten Benachrichtigung, zum gezielten Stornieren

## 2. Auslöser & Ablauf

**Nach jedem erfolgreichen Backup-Export** (nicht beim Wiederherstellen — ein Restore stellt alte Daten wieder her, erzeugt aber kein neues Backup):

1. `lastBackupAt` wird auf den aktuellen Zeitpunkt gesetzt.
2. Eine eventuell noch offene geplante Erinnerung wird storniert.
3. Gilt die Erinnerung als aktiv (siehe Lese-Logik von `backupReminderEnabled` oben), wird eine neue Erinnerung für `jetzt + backupReminderIntervalDays` geplant (Datums-Trigger, gleiches Muster wie der bestehende Vorsorge-Termin-Reminder). Das deckt "standardmäßig aktiv nach dem ersten Backup" ab, ohne einen zuvor bewusst deaktivierten Schalter beim nächsten Backup wieder anzuschalten.

**Im Einstellungen-Tab**, im bestehenden Backup-Bereich, ein neuer Unterabschnitt "Backup-Erinnerung":

- Ein/Aus-Schalter (`SliderToggle`, bereits vorhandene Komponente aus dem Theme-System)
- Intervall-Auswahl (14 / 30 / 60 / 90 Tage)
- Klartext-Hinweis, wann zuletzt gesichert wurde (`lastBackupAt`, lesbar formatiert) bzw. "noch kein Backup erstellt", falls `null`

Jede Änderung von Schalter oder Intervall plant die Erinnerung sofort neu bzw. storniert sie (Schalter aus → stornieren, keine neue Planung; Schalter an oder Intervall geändert bei vorhandenem `lastBackupAt` → neu planen ab `lastBackupAt + neues Intervall`; Schalter an ohne vorheriges Backup → keine Planung, da es nichts zu erinnern gibt, bis das erste Backup existiert).

**Antippen der Benachrichtigung:** öffnet die App regulär (kein Deep-Link direkt in die Einstellungen in dieser ersten Version — bewusst einfach gehalten, siehe unten).

## 3. Code-Struktur

`src/features/medications/notifications/notificationService.ts` enthält bereits alles Nötige (`requestNotificationPermission`, `scheduleScreeningReminder`-artiges Datums-Scheduling, `cancelScheduledReminder`) und ist inhaltlich bereits generisch, nur falsch einsortiert. Als kleine Aufräumung im Zuge dieses Schritts: Verschieben nach `src/lib/notifications/notificationService.ts`, Imports in den Medikamenten-Screens entsprechend anpassen. Backup-Feature nutzt danach denselben, jetzt neutral verorteten Service, statt eines Duplikats oder eines Imports quer durch ein anderes Feature.

Neue reine Logik-Funktion (analog `buildScreeningReminderTrigger`): `buildBackupReminderTrigger(lastBackupAt: string, intervalDays: number, now: Date): { date: Date } | null` — liefert `null`, falls der berechnete Zeitpunkt bereits in der Vergangenheit liegt (dann wird nicht rückwirkend eine Erinnerung für "gestern" geplant, sondern beim nächsten Öffnen der Einstellungen kann Adrian manuell erneut sichern; kein automatisches Nachholen nötig für dieses einfache Feature).

## 4. Fehlerbehandlung

- Benachrichtigungserlaubnis verweigert: Backup-Export funktioniert trotzdem normal, die Erinnerung wird einfach nicht geplant (gleiches Verhalten wie beim bestehenden Vorsorge-Reminder) — kein blockierender Fehler.
- Stornieren einer nicht mehr existierenden Notification-ID: still ignoriert (bestehendes Verhalten von `cancelScheduledReminder`).

## 5. Testing-Ansatz

- Unit-Tests (Vitest) für `buildBackupReminderTrigger`: korrektes Zieldatum bei aktivem Intervall, `null` bei bereits vergangenem Zieldatum, Grenzfall exakt "heute".
- Unit-Tests für die erweiterten `settingsStorage`-Funktionen (Lesen/Schreiben der vier neuen Schlüssel, sinnvolle Defaults bei erstmaligem Zugriff).
- Wie beim bestehenden Backup-Feature nicht sinnvoll automatisiert testbar: der tatsächliche native Benachrichtigungs-Dialog/-Versand — Verifikation über `tsc --noEmit` und manuellen Test (Intervall kurz stellen, z. B. testweise auf Minuten statt Tage im Code, Benachrichtigung abwarten).

## Explizit nicht Teil dieses Schritts

- Deep-Link von der Benachrichtigung direkt in die Einstellungen
- Nachträgliches "Nachholen" verpasster Erinnerungen (z. B. wenn die App tagelang nicht geöffnet wurde)
- Erinnerung auch nach einem Restore zurücksetzen (Restore zählt bewusst nicht als Backup-Ereignis)
- Statistiken/Verlauf über mehrere vergangene Backups (nur der jeweils letzte Zeitpunkt wird gespeichert)

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich eine technische Erinnerungsfunktion, keine medizinischen Inhalte.*
