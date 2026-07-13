# Colitis-Ulcerosa-App – Design: Toiletten-Finder, Teil A – Kartenansicht, Standort & Overpass-Anbindung (Schritt 6a)

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-13*
*Grundlage: [2026-07-07-colitis-ulcerosa-app-design.md](2026-07-07-colitis-ulcerosa-app-design.md) (Hauptspec, Abschnitt 4c)*

## Kontext & Ziel

Umsetzungsschritt 6 der Hauptspec ist der Toiletten-Finder — laut Adrian persönlich die wichtigste Funktion der App. Der Schritt wurde wegen seines Umfangs (neue Karten-/Standort-Abhängigkeiten, externe Netzwerk-API, Offline-Caching) bewusst in zwei Pläne aufgeteilt:

- **Teil A (dieses Dokument):** Kartenansicht mit Standort und öffentlichen Toiletten aus OpenStreetMap/Overpass in der Nähe — die eigentliche "Toiletten finden"-Kernfunktion.
- **Teil B (später, eigene Spec):** Eigene gespeicherte "sichere Orte", Schnellzugriff-Button vom App-Start, Offline-Fallback bei fehlendem Netz.

Teil B baut auf Teil A auf (nutzt dieselbe Karten-Komponente), ist aber nicht Gegenstand dieses Dokuments.

## Wichtige technische Korrektur während der Planung

Ursprünglich war `react-native-maps` mit OpenStreetMap-Kacheln angedacht ("kein Google-Account nötig"). Eine Prüfung der offiziellen Dokumentation ergab: `react-native-maps` benötigt auf Android **zwingend** einen Google-Maps-API-Key (Google-Cloud-Konto), unabhängig davon, ob eigene Kacheln überlagert werden. Das widerspricht dem Projekt-Grundsatz "kein Account-System, keine unnötigen externen Abhängigkeiten". Adrian hat sich daraufhin für die Alternative entschieden (siehe unten).

## 1. Kartenrendering: WebView + Leaflet.js

Eine `react-native-webview`-Komponente lädt eine lokal im App-Bundle mitgelieferte HTML-Datei, die Leaflet.js einbindet. **Leaflet.js und Leaflet-CSS werden als lokale Assets mitgeliefert, nicht von einem CDN geladen** — die App ist damit zur Laufzeit nur für die eigentlichen Kartenkacheln (OSM-Tile-Server) und die Overpass-Anfrage auf Netz angewiesen, nicht zusätzlich noch für die Bibliothek selbst.

**Kommunikation React Native ↔ WebView** über die Standard-Message-Bridge (`postMessage`/`onMessage`):
- RN → WebView: aktueller Kartenmittelpunkt (bei erster Standortermittlung), Liste der anzuzeigenden Toiletten-Marker (Koordinaten + IDs)
- WebView → RN: `regionChange` (neuer Kartenmittelpunkt nach Verschieben/Zoomen), `markerTap` (ID des angetippten Markers)

Kein Google-Konto, kein natives Karten-SDK, identisches Verhalten auf Android/iOS.

## 2. Standort

`expo-location`, ausschließlich **Vordergrund-Berechtigung** ("Bei App-Nutzung") — keine Hintergrund-Standortabfrage, passend zum aktiven Nutzungsmuster ("Karte öffnen, wenn gebraucht") statt proaktiver Hintergrundfunktion.

- Berechtigung wird angefragt, sobald der Toiletten-Tab geöffnet wird (lazy, nicht global beim App-Start — konsistent mit dem in Schritt 4/5 etablierten Muster).
- **Berechtigung erteilt:** Karte zentriert sich auf die aktuelle Position, Toiletten-Suche startet automatisch.
- **Berechtigung verweigert/nicht verfügbar:** Karte wird trotzdem angezeigt (neutraler Standard-Kartenausschnitt, z. B. Mitte Deutschlands), mit einem deutschen Hinweisbanner zur fehlenden Standortberechtigung (inkl. Link zu den Geräteeinstellungen). Keine Toiletten-Suche ohne bekannten Mittelpunkt — kein Absturz, kein leerer/kaputter Bildschirm.

## 3. Toiletten-Suche (Overpass-API)

- **Anfrage:** Eine reine, testbare Funktion baut eine Overpass-QL-Anfrage für `amenity=toilets` in einem festen Radius von **1500 Metern** um den aktuellen Kartenmittelpunkt.
- **Client:** Schickt die Anfrage per HTTP POST an die öffentliche Overpass-API (`https://overpass-api.de/api/interpreter`), parst die JSON-Antwort in eine Liste von Toiletten (Koordinaten, Name falls vorhanden, Öffnungszeiten-Tag falls vorhanden, OSM-ID).
- **Distanz:** Haversine-Formel als reine Funktion, berechnet die Entfernung jeder Toilette zum aktuellen Nutzer-Standort (nicht zum Kartenmittelpunkt) für die Anzeige in der Infokarte.
- **Automatische Neusuche:** Bei Verschieben/Zoomen der Karte wird automatisch neu gesucht, aber nur wenn sich der Kartenmittelpunkt um mehr als einen Schwellwert (z. B. 300 Meter) verändert hat — verhindert übermäßig viele Anfragen bei minimalen Kartenbewegungen. Kein manueller "Suchen"-Button.
- **Fehlerfall:** Schlägt die Overpass-Anfrage fehl (kein Netz, Server nicht erreichbar), zeigt die App einen deutschen Hinweistext ("Toiletten konnten nicht geladen werden") statt eines stillen leeren Zustands. Echtes Offline-Caching mit zuletzt geladenen Ergebnissen ist bewusst Teil B vorbehalten — hier nur eine ehrliche Fehlermeldung.

## 4. Marker-Interaktion

Tippen auf einen Toiletten-Marker zeigt eine kompakte Infokarte am unteren Bildschirmrand:
- Name (falls in OSM vorhanden, sonst "Öffentliche Toilette")
- Distanz vom aktuellen Standort (z. B. "320 m entfernt")
- Öffnungszeiten (falls im OSM-Tag `opening_hours` vorhanden)
- Button **"Route dorthin"**: öffnet die auf dem Gerät bereits installierte Karten-/Navigations-App über einen plattformübergreifenden Navigations-Link (Ziel-Koordinaten), kein eigenes Navigationssystem

## 5. Fehlerbehandlung (Zusammenfassung)

- Standort verweigert/nicht verfügbar → Karte bleibt nutzbar (Standardausschnitt), Hinweisbanner, keine Toiletten-Suche
- Overpass-Anfrage fehlgeschlagen → deutsche Fehlermeldung statt leerer Karte, Karte selbst bleibt bedienbar
- Kein Netz beim ersten Laden der Kartenkacheln → das ist ein Fall, den Leaflet/der Browser-Engine der WebView selbst behandelt (graue/leere Kachelbereiche); kein zusätzlicher Sonderfall in dieser Phase nötig, echtes Offline-Kachel-Caching ist ebenfalls Teil B

## 6. Testing-Ansatz

- Unit-Tests (Vitest) für die reine Logik: Overpass-Query-Erstellung (korrekter Radius/Filter), Antwort-Parsing (OSM-Elemente → Toiletten-Objekte, fehlende Tags werden korrekt zu `null`/Default), Haversine-Distanzberechnung (bekannte Koordinatenpaare mit bekannter Distanz), Schwellwert-Logik für die automatische Neusuche (kleine Verschiebung → keine neue Suche, große Verschiebung → neue Suche)
- Die WebView/Leaflet-Karte selbst sowie der native Standort-Zugriff (`expo-location`) sind wie bei vorherigen Schritten (Standort, Benachrichtigungen) nicht sinnvoll automatisiert testbar — Verifikation über sorgfältiges Lesen + `tsc --noEmit`, echte Prüfung (Kartendarstellung, Standort-Dialog, Marker-Tap, externe Navigation) beim späteren Alltagstest auf einem echten Gerät (Schritt 8)
- Component-/Screen-Tests entfallen wie bei allen bisherigen Schritten (React Native lässt sich unter Vitest nicht einbinden)

## Explizit nicht Teil dieses Schritts (Teil A)

- Eigene gespeicherte "sichere Orte" (Teil B)
- Schnellzugriff-Button vom App-Start (Teil B)
- Offline-Fallback/Caching zuletzt geladener Toiletten bei fehlendem Netz (Teil B)
- Hintergrund-Standortabfrage / proaktive Erinnerungen
- Eigenes, in die App integriertes Turn-by-Turn-Navigationssystem (nutzt stattdessen die bereits installierte externe Karten-App)

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich die technische Standort-/Kartenfunktion, keine medizinischen Inhalte.*
