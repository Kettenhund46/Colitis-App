# Colitis-Ulcerosa-App – Design: Toiletten-Finder, Teil B – Sichere Orte, Offline-Fallback & Schnellzugriff (Schritt 6b)

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-13*
*Grundlage: [2026-07-07-colitis-ulcerosa-app-design.md](2026-07-07-colitis-ulcerosa-app-design.md) (Hauptspec, Abschnitt 4c), [2026-07-13-colitis-app-toiletten-karte-design.md](2026-07-13-colitis-app-toiletten-karte-design.md) (Teil A, bereits umgesetzt)*

## Kontext & Ziel

Teil A des Toiletten-Finders (Kartenansicht, Standort, Overpass-Anbindung) ist bereits fertig und gemergt. Dieses Dokument beschreibt Teil B — den Rest der Hauptspec-Anforderungen an den Toiletten-Finder:

- Eigene gespeicherte "sichere Orte", farblich hervorgehoben auf der Karte
- Offline-Fallback bei fehlendem Netz (zuletzt geladene Toiletten lokal zwischengespeichert)
- Ein Schnellzugriff-Button "möglichst 1 Tap bis zur nächsten Toilette" direkt vom App-Start

## Wichtige technische Korrektur während der Planung

Für den Schnellzugriff war ursprünglich das Drittanbieter-Paket `expo-quick-actions` angedacht. Eine Prüfung ergab: das Paket ist kein offizielles Expo-SDK-Paket, seine Kompatibilitätstabelle deckt nur bis Expo SDK 56 ab (dieses Projekt nutzt SDK 57, nicht bestätigt), und es erfordert einen nativen Build. Adrian hat sich stattdessen für einen selbst geschriebenen Expo-Config-Plugin-Ansatz entschieden (siehe Abschnitt 3), der kein Drittanbieter-Paket und kein Versions-Risiko mit sich bringt.

## 1. Sichere Orte

**Anlegen:** Langes Drücken auf die Karte (Leaflet `contextmenu`-Ereignis, löst bei Touch-Geräten bei langem Drücken aus) sendet die gedrückte Koordinate über die Bridge an React Native. Dort öffnet sich ein kleines Formular: Name (Pflichtfeld), Kategorie (Freitext mit Vorschlag-Chips: Arbeit, Freunde, Café, Sonstiges), optionale Notiz. Speichert einen neuen Eintrag in der bereits vorhandenen `saved_places`-Tabelle.

**Anzeige:** Sichere Orte werden als eigene Marker-Art auf derselben Karte wie die Toiletten-Marker angezeigt, farblich klar unterscheidbar (z. B. `tokens.colors.primary`-farbener Kreis-Marker statt des Standard-Toiletten-Pins).

**Bearbeiten/Löschen:** Tippen auf einen sicheren-Ort-Marker öffnet eine Infokarte (Name, Kategorie, Notiz) mit Buttons "Bearbeiten" (öffnet dasselbe Formular vorausgefüllt) und "Löschen" (mit kurzer Bestätigung), zusätzlich "Route dorthin" wie bei Toiletten. Die Bridge-Nachricht `markerTap` bekommt ein zusätzliches Feld, das zwischen Toiletten- und sicherer-Ort-Marker unterscheidet, damit die App weiß, welche Infokarte sie zeigen muss.

## 2. Offline-Fallback

Eine neue Tabelle `cached_toilets` in der bereits verschlüsselten SQLite-Datenbank speichert bei jeder erfolgreichen Overpass-Suche die Ergebnisse als vollständigen Ersatz (alte Cache-Einträge werden gelöscht, neue eingefügt) — **kein unverschlüsselter Gerätespeicher**, konsistent mit dem Datenschutz-Grundsatz der App (auch reine Toiletten-Standorte könnten in Kombination mit Zeitstempeln Rückschlüsse auf Adrians Aufenthaltsorte erlauben).

Schlägt eine Overpass-Anfrage fehl (kein Netz erreichbar), lädt die App stattdessen den Cache-Inhalt und zeigt die zuletzt bekannten Toiletten weiterhin auf der Karte an, mit einem Hinweistext ("Offline — zeigt zuletzt geladene Toiletten") statt einer reinen Fehlermeldung. Gibt es noch keinen Cache (allererste Nutzung, sofort offline), bleibt es bei der bisherigen ehrlichen Fehlermeldung aus Teil A.

## 3. Schnellzugriff ("Nächste Toilette")

**Android-Homescreen-Shortcut ohne Drittanbieter-Paket:** Ein lokales Expo-Config-Plugin (`plugins/withNearestToiletShortcut.js`) trägt während des Android-Prebuilds einen statischen App-Shortcut in die native Konfiguration ein (`res/xml/shortcuts.xml` + `<meta-data android:name="android.app.shortcuts">`-Eintrag in der Haupt-Activity der `AndroidManifest.xml`). Der Shortcut-Intent zeigt auf das bereits vorhandene App-URL-Schema (`colitisapp://`), sodass Expo Router die Route direkt auflösen kann — kein natives JS-Paket, keine Versions-Abhängigkeit.

**Ziel-Screen (`app/schnellzugriff.tsx`, außerhalb der Tabs):** Beim Öffnen über den Shortcut lädt der Screen minimal:
1. Aktuellen Standort (`expo-location`, Vordergrund-Berechtigung wie in Teil A)
2. Alle gespeicherten sicheren Orte (`saved_places`)
3. Alle gecachten Toiletten (`cached_toilets`) — **kein neuer Overpass-Live-Abruf**, damit der Schnellzugriff auch bei langsamer/keiner Verbindung sofort reagiert

Berechnet die Distanz (Haversine, aus Teil A wiederverwendet) vom aktuellen Standort zu jedem Kandidaten aus beiden Listen zusammen, wählt den nächstgelegenen Punkt (sichere Orte und Toiletten gleichberechtigt — der nähere gewinnt, unabhängig vom Typ) und öffnet sofort die externe Navigations-App über den bereits vorhandenen `buildNavigationUrl`-Helfer aus Teil A.

**Fehlerfälle:** Kein Standort verfügbar/verweigert → deutscher Hinweistext mit Button "Toiletten-Tab öffnen" (fällt zurück auf die normale Kartenansicht). Keine Kandidaten bekannt (weder Cache noch sichere Orte vorhanden, z. B. bei allererster Nutzung) → deutscher Hinweistext, ebenfalls mit Rücksprung-Button.

## 4. Fehlerbehandlung (Zusammenfassung)

- Overpass-Anfrage fehlgeschlagen, Cache vorhanden → Cache anzeigen + Offline-Hinweis, keine harte Fehlermeldung
- Overpass-Anfrage fehlgeschlagen, kein Cache vorhanden → bisherige Fehlermeldung aus Teil A
- Schnellzugriff ohne Standort → Hinweistext + Rücksprung zum Toiletten-Tab
- Schnellzugriff ohne bekannte Kandidaten → Hinweistext + Rücksprung zum Toiletten-Tab
- Sicheren Ort löschen → kurze Bestätigung vor dem endgültigen Löschen (native Bestätigungs-Dialog)

## 5. Testing-Ansatz

- Unit-Tests (Vitest) für die reine Logik: Kombinieren von sicheren Orten + gecachten Toiletten zu einer gemeinsamen Kandidatenliste, Auswahl des nächstgelegenen Punkts (Haversine-Wiederverwendung aus Teil A), Formular-Validierung für sichere Orte (Name-Pflichtfeld)
- Repository-Tests (echte temporäre SQLite-DB wie in allen bisherigen Schritten) für `saved_places`-CRUD und `cached_toilets`-Ersetzungslogik (alter Cache raus, neuer rein)
- Das Config-Plugin, der Bridge-Code der Karte, alle Screens/Komponenten sowie das native Shortcut-Verhalten selbst sind wie in allen bisherigen Schritten nicht sinnvoll automatisiert testbar (React Native/Vitest-Einschränkung, zusätzlich hier: natives Android-Verhalten, das nur auf einem echten Gerät/Build beobachtbar ist) — Verifikation über sorgfältiges Lesen, `tsc --noEmit`, und den späteren manuellen Alltagstest (Schritt 8), inklusive explizit: Shortcut vom Homescreen antippen und beobachten, ob die richtige Route geöffnet wird

## Explizit nicht Teil dieses Schritts

- iOS-Pendant zum Android-Homescreen-Shortcut (App zielt zuerst auf Android, iOS-Option bleibt offen für später)
- Eine Listen-Ansicht aller sicheren Orte abseits der Karte (Verwaltung läuft ausschließlich über Marker-Tap auf der Karte)
- Feste, vorgegebene Kategorien für sichere Orte über die Vorschlag-Chips hinaus (bleibt Freitext, wie im Schema bereits angelegt)
- Automatisches Aktualisieren des Caches im Hintergrund (Cache wird nur bei einer tatsächlich ausgeführten, erfolgreichen Suche im Toiletten-Tab aktualisiert)

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich technische Standort-/Kartenfunktionen, keine medizinischen Inhalte.*
