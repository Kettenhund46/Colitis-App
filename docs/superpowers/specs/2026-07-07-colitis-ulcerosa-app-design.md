# Colitis-Ulcerosa-App – Design (Phase 1: MVP)

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-07*
*Grundlage: [Colitis_Ulcerosa_Deepsearch.md](../../../Colitis_Ulcerosa_Deepsearch.md)*

## Kontext & Ziel

App für Menschen mit Colitis Ulcerosa, die auf dem aktuellen Stand der Krankheit, Forschung und Behandlung hält. Kombiniert News-/Forschungs-Feed, Symptom-/Schub-Tagebuch mit Trigger-Erfassung, und Wissens-/Medikamentendatenbank. Persönlich wichtigstes Feature für Adrian: Toiletten-Finder für plötzlichen, dringenden Stuhldrang unterwegs.

Dieses Dokument beschreibt **Phase 1 (MVP)**: Tagebuch, Wissens-/Medikamentendatenbank und Toiletten-Finder als rein lokale Mobile-App. Die News-/Leitlinien-Feed-Automatisierung (PubMed/AWMF/FDA/EMA) ist **Phase 2** und erfordert zwangsläufig einen Server/Cronjob – wird als eigener Spec geplant, sobald Phase 1 läuft.

## Entscheidungsgrundlage (mit Adrian abgestimmt)

- **Zielgruppe v1:** Nur für Adrian persönlich (Single-User, kein Account-System, keine Server-Infrastruktur)
- **Plattform:** Mobile-first, Android (React Native / Expo – cross-platform-fähig, iOS-Option bleibt offen)
- **Datensicherung:** Nur lokal, manuelles verschlüsseltes Export/Import (kein automatisches Cloud-Backup)
- **UI-Sprache:** Deutsch
- **Design-Ton:** Ruhig, warm, beruhigend – wenig Alarmfarben/Rot, damit die App im akuten Schub nicht zusätzlichen Stress auslöst. Notfall-relevante Elemente (Toiletten-Finder) trotzdem klar und schnell auffindbar
- **Toiletten-Finder:** Offene Kartendaten (OpenStreetMap/Overpass) + eigene manuell gespeicherte "sichere Orte"

## 1. Architektur-Überblick

100% lokal, kein Backend in Phase 1. Die App läuft komplett auf dem Gerät, alle Gesundheitsdaten bleiben dort. Einzige externen Netzwerkzugriffe: anonyme, zustandslose Abfragen an die OpenStreetMap-Overpass-API (Toiletten in der Nähe) und einen offenen Kartenkachel-Server (Kartendarstellung) – beides ohne Account, ohne Übertragung von Gesundheitsdaten.

```
┌─────────────────────────────────────────────┐
│              React Native App (Expo)          │
│                                                │
│  ┌───────────┐ ┌───────────┐ ┌─────────────┐ │
│  │  Tagebuch  │ │  Wissens-/ │ │  Toiletten- │ │
│  │  & Trigger │ │  Medi-DB   │ │  Finder     │ │
│  └─────┬─────┘ └─────┬─────┘ └──────┬──────┘ │
│        │             │              │         │
│  ┌─────▼─────────────▼──────────────▼──────┐ │
│  │     Lokale, verschlüsselte SQLite-DB     │ │
│  │   (expo-sqlite + SQLCipher-Verschl.)     │ │
│  │   Schlüssel im Android Keystore          │ │
│  │        (expo-secure-store)               │ │
│  └───────────────────────────────────────────┘ │
│                                                │
│  App-Sperre: PIN/Biometrie (expo-local-auth)  │
└──────────────────┬────────────────────────────┘
                    │ (nur anonyme, unauthentifizierte Anfragen)
                    ▼
     ┌─────────────────────────────┐
     │  OpenStreetMap Overpass API  │  ← Toiletten in der Nähe
     │  + offener Kartenkachel-Server│  ← Kartendarstellung
     └─────────────────────────────┘
```

Kein Server, kein Login, keine Cloud-Datenbank für Gesundheitsdaten. Export/Import läuft über eine verschlüsselte Backup-Datei, die selbst abgelegt wird (z. B. eigene Cloud, lokal am PC) – die App lädt nichts automatisch hoch.

## 2. Technischer Stack

- **Framework:** React Native mit Expo (TypeScript)
- **Lokale DB:** expo-sqlite + SQLCipher-Verschlüsselung, Drizzle ORM für Schema/Queries
- **Verschlüsselung:** expo-secure-store (Android Keystore) für den DB-Schlüssel; separates, nutzerdefiniertes Passwort für Backup-Exporte
- **App-Sperre:** expo-local-authentication (PIN/Biometrie)
- **Standort & Karte:** expo-location, MapLibre/OSM-Kartenkacheln, OpenStreetMap Overpass API für Toiletten-Suche
- **Benachrichtigungen:** expo-notifications (lokal, Medikamenten-/Vorsorge-Erinnerungen)
- **Export:** PDF/CSV-Export für Arztgespräche

Begründung: Ein TypeScript-Codebase deckt alle benötigten Features (DB, Karte, Standort, Notifications, Verschlüsselung, Biometrie) über reife Bibliotheken ab, ist schnell mit Claude Code iterierbar und hält die Tür zu iOS offen, ohne dass natives Kotlin hier einen spürbaren Vorteil böte (Alternative verworfen, siehe Abschnitt "Verworfene Alternativen").

### Verworfene Alternativen

- **Natives Android (Kotlin/Jetpack Compose):** maximale native Tiefe/Performance, aber kein einfacher iOS-Weg später und kein klarer Mehrwert für die hier benötigten Features.
- **Web-App/PWA:** schneller zu bauen, aber Standort im Hintergrund, Push-Zuverlässigkeit und Offline-Verhalten sind eingeschränkter als bei einer echten mobilen App – schlecht geeignet gerade für den Toiletten-Finder als Kernfunktion.

## 3. Datenmodell & Datenschutz

**Verschlüsselung:**
- Komplette lokale DB verschlüsselt mit SQLCipher (AES-256); Schlüssel wird beim ersten Start zufällig generiert und im Android Keystore gespeichert (verlässt das Gerät nie)
- Optionale App-Sperre per PIN oder Biometrie vor jeglicher Inhaltsanzeige
- Backup-Exporte zusätzlich mit einem selbst gewählten Passwort verschlüsselt, unabhängig vom Geräte-Schlüssel

**Kern-Tabellen:**

| Tabelle | Inhalt |
|---|---|
| `diary_entries` | Datum/Uhrzeit, Stuhlgang (Häufigkeit, Blut ja/nein, Konsistenz), Schmerzlevel, Symptome, Freitext-Notiz |
| `triggers` | Verknüpft mit Eintrag: Kategorie (Ernährung/Stress/Schlaf/Medikament/Sonstiges) + Freitext |
| `medications` | Eigene Medikamentenliste: Name, Dosis, Einnahmeschema, Start-/Enddatum |
| `medication_log` | Tatsächliche Einnahmen (Erinnerungen/Historie) |
| `saved_places` | Eigene "sichere Orte" (Name, Koordinaten, Notiz, Kategorie z. B. Arbeit/Freunde/Café) |
| `knowledge_content` | Statisch mitgelieferte Wissensartikel (aus der Recherche-Datei strukturiert) |
| `screening_reminders` | Vorsorge-Koloskopie-Intervalle, nächste fällige Termine |

**Datenschutz-Grundsatz:** Da alles lokal bleibt und Adrian Einzelnutzer ist, entfallen die meisten DSGVO-Pflichten, die bei Mehrnutzer-/Cloud-Apps anfallen. Die technischen Schutzmaßnahmen (Verschlüsselung, Zugriffssperre) werden trotzdem umgesetzt, sowohl wegen der Sensibilität der Daten als auch damit die App später einfacher für weitere Nutzer geöffnet werden könnte.

## 4. Feature-Module (MVP-Umfang, Phase 1)

### a) Symptom-/Schub-Tagebuch
- Schneller Tages-Eintrag: Stuhlgang-Häufigkeit, Blut (ja/nein), Schmerzlevel (Skala), Symptome (Mehrfachauswahl), Freitext
- Trigger-Erfassung pro Eintrag: Ernährung, Stress, Schlaf, Medikamenten-Änderung
- Verlaufsansicht (Kalender/Liste) + einfache Muster-Auswertung (z. B. Schmerzlevel-Durchschnitt an Tagen mit Trigger X) – bewusst einfach gehalten, keine komplexe Statistik in Phase 1
- Export als PDF/CSV für Arztgespräche

### b) Wissens- & Medikamentendatenbank
- Strukturierte Artikel aus der Recherche-Datei (Ursachen, Behandlung, Komplikationen, Ernährung), mit Quellenangaben
- Medikamenten-Übersicht (Wirkmechanismus, Zulassungsstatus, Wirkstoffklassen-Vergleich) – statisch mitgeliefert, Update nur über App-Update bis Phase 2
- Eigene Medikamentenliste mit Einnahme-Erinnerungen (lokale Push-Notifications)
- Vorsorge-Koloskopie-Erinnerung basierend auf Krankheitsdauer/Ausdehnung

### c) Toiletten-Finder (Kernfunktion, nicht optional)
- Kartenansicht mit öffentlichen Toiletten in der Nähe (OpenStreetMap/Overpass, Umkreissuche)
- Eigene gespeicherte "sichere Orte" farblich hervorgehoben
- Großer, schneller Zugriffs-Button direkt vom App-Start (möglichst 1 Tap bis zur nächsten Toilette)
- Offline-Fallback: zuletzt geladene Toiletten in der Umgebung werden lokal zwischengespeichert

**Explizit nicht in Phase 1:** News-/Forschungs-Feed-Automatisierung, Community-Funktion (beide Phase 2 bzw. später).

## 5. Projektstruktur

```
colitis-app/
├── app/                          # Expo Router: Screens & Navigation
│   ├── (tabs)/
│   │   ├── tagebuch/
│   │   ├── wissen/
│   │   ├── toiletten/
│   │   └── einstellungen/
│   └── _layout.tsx
├── src/
│   ├── features/
│   │   ├── diary/                # Tagebuch: Komponenten, Hooks, Logik
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── db/                # Queries für diary_entries, triggers
│   │   ├── knowledge/             # Wissens-/Medikamentendatenbank
│   │   │   ├── components/
│   │   │   └── content/           # Strukturierte Artikel (aus Deepsearch.md generiert)
│   │   ├── medications/           # Eigene Medi-Liste, Erinnerungen
│   │   ├── toilet-finder/         # Karte, Overpass-Client, saved_places
│   │   └── screening/             # Vorsorge-Erinnerungen
│   ├── db/
│   │   ├── schema.ts              # SQLite-Schema (Drizzle ORM)
│   │   ├── client.ts              # SQLCipher-Init, Verschlüsselung
│   │   └── migrations/
│   ├── lib/
│   │   ├── encryption.ts          # Keystore-Zugriff, Backup-Verschlüsselung
│   │   ├── notifications.ts       # Lokale Push-Erinnerungen
│   │   └── export.ts              # PDF/CSV-Export, Backup-Export/Import
│   ├── components/ui/             # Wiederverwendbare UI-Bausteine (Button, Card, ...)
│   └── styles/                    # Design-Tokens (Farben, Typografie – ruhig/warm)
├── assets/
└── docs/superpowers/specs/        # Diese Spec + zukünftige Specs (Phase 2 etc.)
```

Jedes Feature-Modul ist in sich geschlossen (eigene Komponenten, Hooks, DB-Queries) und kommuniziert nur über klar definierte Funktionen/Typen.

## 6. Fehlerbehandlung

- DB-Zugriffsfehler (z. B. Verschlüsselungsfehler nach OS-Update): verständliche Fehlermeldung, kein stiller Datenverlust, Rohdaten bleiben unangetastet, nur lokales Logging
- Kein Netz beim Toiletten-Finder: automatischer Rückgriff auf zwischengespeicherte Ergebnisse + klare "Offline"-Anzeige
- Standort nicht verfügbar/verweigert: Karte zeigt weiterhin eigene gespeicherte Orte, mit Hinweis zur Standort-Berechtigung
- Backup-Import mit falschem Passwort: klare Fehlermeldung, kein Teil-Import fehlerhafter Daten

## 7. Testing-Ansatz

- Unit-Tests für Kern-Logik: Verschlüsselung/Entschlüsselung, Trigger-Musteranalyse, Vorsorge-Intervall-Berechnung (Vitest)
- Komponenten-/Screen-Tests für Tagebuch-Eingabe und Toiletten-Finder (React Native Testing Library)
- Manuelles Testen auf echtem Android-Gerät für: Standortberechtigung, Benachrichtigungen, Offline-Verhalten, Biometrie-Sperre
- Kein E2E-Test-Overkill in Phase 1 (Einzelnutzer-App ohne Server-Abhängigkeiten)

## 8. Umsetzungsplan (Reihenfolge)

1. **Projekt-Setup:** Expo-Projekt, TypeScript, Ordnerstruktur, Design-Tokens (ruhige/warme Farbpalette), verschlüsselte SQLite-DB mit Drizzle-Schema
2. **Tagebuch-Kern:** Eingabe-Screen, lokale Speicherung, Verlaufsansicht
3. **Trigger-Erfassung & einfache Auswertung:** Trigger-Kategorien, Verlauf mit Muster-Hinweisen
4. **Wissens-/Medikamentendatenbank:** Inhalte aus der Recherche-Datei strukturiert einpflegen, durchsuchbare Artikel-Ansicht, Medikamenten-Übersicht
5. **Eigene Medikamentenliste & Erinnerungen:** Einnahme-Tracking, lokale Push-Erinnerungen, Vorsorge-Koloskopie-Reminder
6. **Toiletten-Finder:** Karte, Overpass-Anbindung, eigene "sichere Orte", Schnellzugriff-Button, Offline-Fallback
7. **App-Sperre & Backup:** PIN/Biometrie-Sperre, verschlüsselter Export/Import
8. **Polish & Testlauf:** Design-Feinschliff, echter Alltagstest, Fehlerbehandlung schärfen

Phase 2 (News-/Leitlinien-Feed-Automatisierung) wird danach als eigener Spec geplant.

## Offene Punkte für Phase 2 (nicht Teil dieser Spec)

- Automatisierte Quellenanbindung (PubMed E-utilities, AWMF-Leitlinien-Register, FDA/EMA-Meldungen)
- Leichtgewichtiger Curation-Mechanismus (z. B. periodisch generierte JSON-Datei, die die App abruft)
- Ggf. manuelle Kuration/Review-Schritt vor Veröffentlichung neuer Feed-Einträge in der App

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Medizinische Inhalte basieren auf [Colitis_Ulcerosa_Deepsearch.md](../../../Colitis_Ulcerosa_Deepsearch.md) und sollten vor Veröffentlichung/Weitergabe fachärztlich geprüft werden.*
