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

## News-Feed (Wissen-Tab)

- [ ] Wissen-Tab öffnen, "Neuigkeiten ansehen" antippen — Liste lädt (oder zeigt bei noch fehlender Teil-A-Einrichtung erwartungsgemäß den Offline-/Fehler-Zustand statt eines Absturzes)
- [ ] Einen Eintrag antippen — externer Link öffnet sich im Browser, Eintrag wird sofort sichtbar als gelesen markiert (abgeblasste Darstellung)
- [ ] Neuigkeiten-Screen verlassen und wieder öffnen — Gelesen-Status des angetippten Eintrags bleibt erhalten
- [ ] Flugmodus aktivieren, Neuigkeiten-Screen öffnen — zuletzt geladene Liste bleibt mit Offline-Hinweistext sichtbar statt leer/Fehler
- [ ] Flugmodus deaktivieren, Screen erneut fokussieren — Liste bleibt während des Hintergrund-Refreshs durchgehend sichtbar (kein Ausblenden hinter einer Ladeanzeige)

## Allgemeiner Alltagseindruck

- [ ] Ladezeiten beim App-Start und beim Wechseln zwischen Tabs fühlen sich nicht zu lang an
- [ ] Lesbarkeit und Kontrast bei Tageslicht auf dem echten Bildschirm prüfen
- [ ] Bedienbarkeit unter Stress/im (simulierten) akuten Schub-Zustand: sind die wichtigsten Aktionen (Toiletten-Finder, Tagebuch-Eintrag) mit wenigen Tipps erreichbar?
- [ ] Schriftgröße bei aktivierten System-Bedienungshilfen (größere Schrift) prüfen — kein abgeschnittener Text
