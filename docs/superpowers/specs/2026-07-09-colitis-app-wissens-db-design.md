# Colitis-Ulcerosa-App – Design: Wissens-/Medikamentendatenbank (Schritt 4)

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-09*
*Grundlage: [Colitis_Ulcerosa_Deepsearch.md](../../../Colitis_Ulcerosa_Deepsearch.md), [2026-07-07-colitis-ulcerosa-app-design.md](2026-07-07-colitis-ulcerosa-app-design.md) (Hauptspec, Abschnitt 4b)*

## Kontext & Ziel

Umsetzungsschritt 4 der Hauptspec: die Wissens-/Medikamentendatenbank. Liefert Adrian strukturiertes, verlässliches Nachschlagewissen zu Colitis Ulcerosa direkt in der App, aus der bereits vorliegenden Recherche-Datei destilliert. Nicht Teil dieses Schritts: die eigene Medikamentenliste mit Einnahme-Erinnerungen (das ist Schritt 5, `medications`-Tabelle existiert bereits separat).

## 1. Inhalt & Struktur

Aus `Colitis_Ulcerosa_Deepsearch.md` werden 6 statische Artikel destilliert:

| Slug | Titel | Quelle (Deepsearch-Kapitel) |
|---|---|---|
| `ueberblick` | Was ist Colitis Ulcerosa | Kapitel 1 |
| `ursachen` | Ursachen und Auslöser | Kapitel 2 |
| `behandlung` | Behandlungsmöglichkeiten | Kapitel 3 (inkl. 3.7 Ernährungstherapie) |
| `folgen` | Folgen und Komplikationen | Kapitel 4 |
| `forschung` | Aktuelle Forschung 2025/2026 | Kapitel 5 |
| `medikamente` | Medikamente & Wirkstoffklassen | Zusammenfassung aus 3.4, allgemein gehalten |

Jeder Artikel besteht aus `slug`, `title`, `body` (Fließtext mit Zwischenüberschriften) und `sources` (Liste der Original-Quellenlinks aus der Deepsearch-Datei).

**Bewusst ausgeschlossen:** Kapitel 6 (Kurzfazit), 7 (Adrians persönliches Profil) und 8 (Projekt-Entscheidungen) aus der Deepsearch-Datei — das ist Meta-/Projektkontext für die Entwicklung, kein Nachschlage-Wissen für die App.

**Medikamenten-Artikel bleibt allgemein:** Der Artikel `medikamente` beschreibt Wirkstoffklassen (5-ASA, Kortikosteroide, Immunsuppressiva, Biologika, JAK-Inhibitoren, S1P-Modulatoren) neutral, ohne Bezug zu Adrians eigener Medikamentenhistorie (Salofalk, Azathioprin, Entyvio, Tremfya). Eine Verknüpfung zur persönlichen Medikamentenliste ist bewusst Schritt 5 vorbehalten, wo sie inhaltlich besser passt.

## 2. Datenhaltung & Seeding

Die 6 Artikel werden als TypeScript-Konstante in `src/features/knowledge/content/articles.ts` hinterlegt (statisch, Aktualisierung nur über App-Update, wie in der Hauptspec für Phase 1 vorgesehen).

Beim App-Start prüft eine Seed-Funktion (eingehängt in die bestehende DB-Init-Logik in `src/db/client.ts`, wo bereits die Migrationen laufen), ob die `knowledge_content`-Tabelle die aktuellen Artikel enthält. Insert/Update erfolgt idempotent per `slug` (Upsert): fehlt ein Artikel, wird er eingefügt; existiert er mit geändertem Inhalt (z. B. nach einer Textkorrektur in einem künftigen App-Update), wird er aktualisiert statt dupliziert.

Die App liest `knowledge_content` ausschließlich aus der DB (konsistent mit allen anderen Feature-Modulen), nicht direkt aus dem statischen Modul.

## 3. Screens, Navigation & Suche

- `app/(tabs)/wissen/index.tsx` (bestehender Platzhalter) wird zur **Artikel-Liste**: Suchfeld oben, darunter alle Artikel als Karten (Titel + kurzer Teaser aus den ersten ca. 100 Zeichen von `body`).
- Tippen auf eine Karte navigiert zu `app/(tabs)/wissen/[slug].tsx` — **Detailansicht** mit vollem Artikeltext und einer Quellen-Sektion am Ende (Links öffnen im externen Browser).
- Suche: einfacher, client-seitiger Substring-Filter über `title` + `body` (case-insensitive), filtert die Karten-Liste live beim Tippen. Kein Server, keine Volltextsuch-Engine nötig bei 6 Artikeln.
- Kein Suchtreffer: freundlicher deutscher Hinweistext ("Keine Artikel gefunden"), kein technischer Fehlerzustand.

## 4. Fehlerbehandlung

- Scheitert das Seeding beim App-Start (z. B. DB-Schreibfehler), blockiert das nicht den App-Start. Fehler wird lokal geloggt (gleiches Muster wie bestehende DB-Fehlerbehandlung aus Schritt 1); der Wissens-Tab zeigt dann "Inhalte konnten nicht geladen werden" statt leer oder kaputt zu wirken.
- Ungültiger `slug` beim Öffnen der Detailansicht (praktisch nur über die Liste erreichbar): einfache Rücksprung-Meldung statt Absturz.

## 5. Testing-Ansatz

- Unit-Tests (Vitest, echte temporäre SQLite-DB wie in Plan 2) für die Seed-Logik: leere DB → alle Artikel werden eingefügt; erneuter Lauf mit geändertem Text → Update statt Duplikat.
- Unit-Tests für die Such-/Filterlogik: Groß-/Kleinschreibung, Treffer in Titel vs. Body, kein Treffer.
- Manuelles Testen von Darstellung (Liste, Detail, externe Quellen-Links) beim späteren Alltagstest — Component-Tests entfallen wie bei Plan 2 vereinbart, da React Native unter dem aktuellen Test-Runner (Vitest) nicht einbindbar ist.

## Explizit nicht Teil dieses Schritts

- Eigene Medikamentenliste, Einnahme-Erinnerungen, Vorsorge-Koloskopie-Reminder (Schritt 5)
- Personalisierte Hervorhebung eigener Medikamente im Übersichtsartikel
- Kategorie-Filter/Tags über die reine Textsuche hinaus
- Automatisierte Inhalts-Aktualisierung (PubMed/AWMF/FDA/EMA) – das ist Phase 2

---

*Hinweis: Medizinische Inhalte basieren auf [Colitis_Ulcerosa_Deepsearch.md](../../../Colitis_Ulcerosa_Deepsearch.md) und sollten vor Veröffentlichung/Weitergabe fachärztlich geprüft werden.*
