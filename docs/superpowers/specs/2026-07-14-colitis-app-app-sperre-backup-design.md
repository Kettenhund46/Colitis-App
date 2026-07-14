# Colitis-Ulcerosa-App – Design: App-Sperre & Backup (Schritt 7)

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-14*
*Grundlage: [2026-07-07-colitis-ulcerosa-app-design.md](2026-07-07-colitis-ulcerosa-app-design.md) (Hauptspec, Abschnitte 1, 3, 4a, 6)*

## Kontext & Ziel

Umsetzungsschritt 7 der Hauptspec ist "App-Sperre & Backup". Nach Abstimmung mit Adrian ist dieser Schritt bewusst auf zwei Dinge begrenzt:

- Eine optionale PIN-/Biometrie-Sperre vor dem Inhalt der App.
- Ein manuelles, verschlüsseltes Voll-Backup (Export/Import) aller persönlichen Daten.

Der in der Hauptspec ebenfalls erwähnte PDF/CSV-Export für Arztgespräche ist **nicht** Teil dieses Schritts (siehe "Explizit nicht Teil dieses Schritts").

## 1. App-Sperre

**Aktivierung:** Standardmäßig deaktiviert (passend zum Wort "optional" in der Hauptspec). Ein Umschalter im Einstellungen-Tab aktiviert die Sperre. Beim Einschalten muss sofort ein 6-stelliger PIN vergeben und zur Bestätigung ein zweites Mal eingegeben werden.

**PIN-Speicherung:** Der PIN selbst wird nie gespeichert. Beim Setzen wird ein zufälliges Salt erzeugt (`expo-crypto`, bereits vorhandene Abhängigkeit) und `SHA-256(salt + pin)` als Hex-String zusammen mit dem Salt in `expo-secure-store` abgelegt (gleiches Muster wie der bestehende DB-Schlüssel in `src/lib/encryption.ts`). Beim Entsperren wird der eingegebene PIN mit demselben Salt gehasht und der Hash verglichen.

**Biometrie:** Ist am Gerät Biometrie eingerichtet (`expo-local-authentication`), wird auf dem Sperr-Bildschirm zusätzlich ein Biometrie-Button angeboten. Der PIN bleibt in jedem Fall als Fallback nutzbar (z. B. wenn die Biometrie fehlschlägt oder abgebrochen wird). Ist am Gerät keine Biometrie eingerichtet, wird nur die PIN-Eingabe angezeigt.

**Auslöser:** Ist die Sperre aktiviert, erscheint der Sperr-Bildschirm bei jedem App-Start sowie bei jedem Wechsel des App-Zustands von `background`/`inactive` zurück zu `active` (über `AppState` von React Native). Technisch als zusätzliche Gate-Ebene direkt im bestehenden `app/_layout.tsx`, unmittelbar nach dem vorhandenen DB-Öffnen-/Migrations-Gate — kein Tab-Inhalt wird gerendert, solange die Sperre aktiv und nicht entsperrt ist.

**PIN vergessen:** Ein deutlich abgesetzter "PIN vergessen"-Weg auf dem Sperr-Bildschirm mit unmissverständlicher Warnung, dass dabei alle App-Daten unwiderruflich gelöscht werden. Erfordert eine mehrstufige Bestätigung (z. B. Abtippen eines vorgegebenen Bestätigungstexts), damit kein versehentliches Antippen zum Datenverlust führt. Bei Bestätigung werden die komplette Datenbank, der DB-Schlüssel und der PIN-Hash/Salt gelöscht — die App verhält sich danach wie eine Neuinstallation. Ein vorher erstelltes Backup ist der einzige Weg, die Daten wiederzubekommen.

**Bewusst einfach gehalten:** kein Sperr-/Backoff-Mechanismus bei mehrfach falscher PIN-Eingabe (Einzelnutzer-App mit physischem Gerätezugriff; der "PIN vergessen"-Notfallweg deckt den Fall ab, ein Angreifer mit Gerätezugriff könnte ohnehin nur denselben Weg gehen).

## 2. Backup-Export

**Auslöser:** Ein Bereich "Backup erstellen" im Einstellungen-Tab. Adrian vergibt ein Backup-Passwort (zweimal zur Bestätigung, mindestens 8 Zeichen) — unabhängig vom App-PIN und vom geräteinternen SQLCipher-Schlüssel.

**Inhalt:** Nur die *persönlichen* Tabellen werden exportiert: `diary_entries`, `triggers`, `medications`, `medication_log`, `medication_reminder_times`, `saved_places`, `screening_reminders`. **Nicht** exportiert werden `knowledge_content` (statisch mitgeliefert, wird beim App-Start idempotent neu geseedet) und `cached_toilets` (reiner Offline-Cache, füllt sich bei der nächsten Suche automatisch neu) — beides sind keine persönlichen Daten und ihr Fehlen im Backup ist unkritisch.

**Format:** Alle Zeilen der genannten Tabellen werden über Drizzle gelesen und zu einem strukturierten JSON-Objekt zusammengefasst (`{ version: 1, exportedAt: <ISO-Zeitstempel>, tables: { diaryEntries: [...], ... } }`). Dieses JSON wird mit einem aus dem Backup-Passwort abgeleiteten Schlüssel symmetrisch verschlüsselt (Passwort-basierte Schlüsselableitung + authentifizierte Verschlüsselung, sodass ein falsches Passwort beim Entschlüsseln eindeutig erkennbar fehlschlägt statt stillschweigend Datenmüll zu liefern). Die konkrete Bibliothek dafür (kein natives Krypto-Modul in diesem Projekt vorhanden) wird beim Schreiben des Umsetzungsplans anhand der aktuellen Expo-SDK-57-Kompatibilität geprüft, bevor Code darauf aufbaut.

**Ablage:** Das verschlüsselte Ergebnis wird als Datei (Dateiname mit Datum) über den normalen Betriebssystem-Teilen-Dialog angeboten. Adrian wählt selbst das Ziel (eigene Cloud, lokaler Ordner, E-Mail an sich selbst) — die App lädt nichts automatisch hoch, passend zum Grundsatz "kein automatisches Cloud-Backup". Bricht Adrian den Teilen-Dialog ab, ist das kein Fehler, es wird einfach kein Backup abgelegt; eine dabei angelegte temporäre Datei wird aufgeräumt.

## 3. Backup-Import

**Auslöser:** Ein Bereich "Backup wiederherstellen" im Einstellungen-Tab. Adrian wählt über den System-Dateiauswahl-Dialog eine Backup-Datei aus und gibt das Backup-Passwort ein.

**Validierung:** Schlägt die Entschlüsselung fehl (falsches Passwort oder beschädigte/fremde Datei) oder ist die entschlüsselte Struktur nicht das erwartete, bekannte Format (fehlendes/unbekanntes `version`-Feld, fehlende Tabellen-Schlüssel), zeigt die App eine klare deutsche Fehlermeldung und importiert nichts — kein Teil-Import fehlerhafter Daten.

**Bestätigung:** Vor dem eigentlichen Import erscheint eine deutliche Warnung, dass alle vorhandenen lokalen Daten unwiderruflich ersetzt werden.

**Durchführung:** Kompletter Ersatz in einer einzigen Datenbank-Transaktion: alle sieben persönlichen Tabellen werden geleert, danach werden die importierten Zeilen eingefügt. Alles-oder-nichts — schlägt ein Schritt mitten im Vorgang fehl, wird die Transaktion zurückgerollt und die vorherigen Daten bleiben unangetastet.

**Erinnerungen nach dem Import:** Die im Backup enthaltenen Erinnerungszeiten und Vorsorge-Termine haben alte, im neuen Kontext ungültige `notification_id`-Werte (sie verweisen auf möglicherweise nicht mehr existierende, geplante System-Benachrichtigungen). Nach einem erfolgreichen Import werden deshalb zunächst alle aktuell geplanten Benachrichtigungen verworfen und anschließend für alle importierten Erinnerungszeiten und den importierten Vorsorge-Termin neue Benachrichtigungen geplant (Wiederverwendung der bestehenden Funktionen aus Schritt 5, `src/features/medications/notifications/notificationService.ts`).

## 4. Fehlerbehandlung (Zusammenfassung)

- Falsches Backup-Passwort oder beschädigte/fremde Datei → klare deutsche Fehlermeldung, kein Teil-Import
- Unbekannte/inkompatible Backup-Version → klare deutsche Fehlermeldung, kein Import
- Teilen-Dialog beim Export abgebrochen → kein Fehler, kein Backup erstellt, temporäre Datei wird aufgeräumt
- Datenbankfehler während des Imports → Transaktions-Rollback, vorherige Daten bleiben unangetastet
- Falscher PIN beim Entsperren → Hinweistext, erneute Eingabe möglich, kein Backoff/Sperr-Timer
- PIN vergessen (bestätigter Reset) → vollständiges Löschen von DB, DB-Schlüssel und PIN-Hash, App verhält sich wie eine Neuinstallation

## 5. Testing-Ansatz

- Unit-Tests (Vitest) für die reine Logik: PIN-Hashing und -Verifikation (inkl. Salt), Zusammenstellung des Backup-JSON aus Tabellen-Zeilen und zurück, Verschlüsselung/Entschlüsselung des Backup-Blobs mit einem bekannten Test-Passwort (Rundtrip-Test, plus Test, dass ein falsches Passwort eindeutig als Fehler erkannt wird statt stillen Datenmülls), Struktur-Validierung einer Backup-Datei (Versions-Check, fehlende Felder)
- Repository-/Integrationstest (echte temporäre SQLite-DB, Muster aus allen bisherigen Schritten): voller Export-dann-Import-Rundtrip gegen eine echte Datenbank, der bestätigt, dass nach dem Import exakt die vorher exportierten Daten wieder in der DB stehen, inklusive des Verhaltens "vorhandene Daten werden vollständig ersetzt"
- Wie in allen bisherigen Schritten nicht sinnvoll automatisiert testbar: der Sperr-Bildschirm selbst, `expo-local-authentication`-Aufrufe (nativer Biometrie-Dialog), `expo-secure-store`-Zugriffe, `expo-file-system`/Teilen-Dialog/Dateiauswahl-Dialog (native Datei-/Share-UI) — Verifikation über sorgfältiges Lesen, `tsc --noEmit`, und den späteren manuellen Alltagstest (Schritt 8), inklusive explizit: PIN setzen und wieder entsperren, Biometrie-Entsperrung, ein echtes Backup erstellen und auf demselben Gerät wieder einspielen

## Explizit nicht Teil dieses Schritts

- PDF/CSV-Export für Arztgespräche (bleibt für einen späteren Schritt vorgemerkt)
- Zusammenführen/Merge beim Import (nur kompletter Ersatz)
- Automatische, geplante oder Cloud-hochgeladene Backups (nur manuell, nur lokal erzeugt)
- Mehrere Nutzerprofile / Multi-User
- Sperr-/Backoff-Mechanismus oder Fehlversuch-Zähler bei falscher PIN-Eingabe
- Passwort-Stärke-Prüfung für das Backup-Passwort über die reine Mindestlänge hinaus

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich technische Sicherheits- und Datensicherungsfunktionen, keine medizinischen Inhalte.*
