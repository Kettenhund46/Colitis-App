# Phase 2, Teil A: News-/Leitlinien-Feed – Datenquelle (Design-Spec)

Stand: 2026-07-15

## 1. Ziel und Einordnung

Phase 1 (MVP) der Colitis-Ulcerosa-App ist vollständig umgesetzt (siehe
`Projekt-Zusammenfassung.txt`). Phase 2 bringt die in der ursprünglichen
Projektidee vorgesehene News-/Forschungs-Funktion: aktuelle Studien,
Leitlinien-Updates und Medikamentenzulassungen rund um Colitis Ulcerosa.

Wegen des Umfangs wird Phase 2 – wie schon Schritt 6 (Toiletten-Finder) in
Teil A/B – in zwei unabhängig umsetzbare Teile aufgeteilt:

- **Teil A (dieses Dokument):** die Datenquelle – ein wöchentlicher
  Cronjob, der PubMed, AWMF-Leitlinien und FDA/EMA-Meldungen abfragt,
  neue Treffer auf Deutsch zusammenfasst und als JSON-Datei veröffentlicht.
- **Teil B (separate, spätere Spec):** die Anbindung in der App – ein
  neuer Unterbereich im Wissen-Tab, der die veröffentlichte JSON-Datei
  abruft, lokal zwischenspeichert und mit Gelesen-Status anzeigt.

Teil A liefert ausschließlich die veröffentlichte JSON-Datei als
Schnittstelle. Es gibt in Teil A keine App-seitigen Änderungen.

## 2. Bewusster Bruch mit einem Phase-1-Grundsatz

Die ursprüngliche Spec legte für Phase 1 fest: "kein Account-System, keine
Server-Infrastruktur" (reines lokales Single-User-Modell). Ein Cronjob, der
externe medizinische Quellen abfragt, lässt sich nicht sinnvoll direkt vom
Smartphone aus umsetzen (unterschiedliche APIs, Rate-Limits, unzuverlässiger
Hintergrund-Fetch auf Android). Deshalb wird für Phase 2 bewusst eine
minimale, kostenlose Server-Komponente eingeführt (GitHub Actions), die
ausschließlich öffentliche Fachinformationen verarbeitet – keine
persönlichen Gesundheitsdaten von Adrian verlassen jemals das Gerät oder
das private App-Repo. Diese Abweichung wurde mit Adrian besprochen und
freigegeben.

## 3. Architektur

### 3.1 Repo-Aufbau

- Neuer Ordner `feed-service/` im bestehenden privaten Repo
  (`Kettenhund46/Colitis-App`), TypeScript, ausgeführt über `tsx` (kein
  Kompilierschritt nötig).
- Neues **öffentliches** Mini-Repo (Vorschlag: `colitis-app-feed`), enthält
  ausschließlich die generierte `feed.json` sowie eine kurze README, die
  erklärt, dass es sich um automatisch aggregierte, öffentliche
  Fach-/Studienmeldungen handelt (keine persönlichen Daten). Der Grund für
  ein separates Repo statt GitHub Pages im privaten Repo: GitHub Pages auf
  privaten Repositories setzt einen GitHub Pro/Team/Enterprise-Plan voraus;
  Adrians Account ist auf dem Free-Plan. Ein öffentliches Mini-Repo
  funktioniert auf jedem Plan und erlaubt der App, die Datei ganz ohne
  Authentifizierung über eine `raw.githubusercontent.com`-URL zu laden.

### 3.2 GitHub-Actions-Workflow

- Datei: `.github/workflows/feed-update.yml` im privaten Repo.
- Zeitplan: wöchentlich, Montag 05:00 UTC (`cron: '0 5 * * 1'`).
- Zusätzlich manuell auslösbar über `workflow_dispatch` (für Tests).
- Schritte: Repo auschecken → Node/`tsx` installieren →
  `feed-service/src/index.ts` ausführen → Ergebnis-Datei ins öffentliche
  Mini-Repo committen/pushen (über ein feingranulares Personal Access
  Token mit `contents:write`-Berechtigung, beschränkt auf das
  Mini-Repo).

### 3.3 Benötigte GitHub-Secrets (im privaten Repo)

- `ANTHROPIC_API_KEY` – für die deutschen Kurzzusammenfassungen.
- `FEED_PUBLISH_TOKEN` – feingranulares PAT, Schreibzugriff ausschließlich
  auf das öffentliche Mini-Repo (kein Zugriff auf das private App-Repo
  oder andere Repos).

Beide Werte werden ausschließlich als GitHub-Actions-Secrets hinterlegt,
nie im Code oder in Logs ausgegeben.

## 4. Datenquellen

Jede Quelle wird in einem eigenen Modul mit eigenem Try/Catch abgefragt.
Schlägt eine Quelle fehl, werden die anderen trotzdem verarbeitet und
veröffentlicht (siehe Abschnitt 6).

### 4.1 PubMed

- NCBI E-Utilities (`esearch` + `esummary`), kein API-Key zwingend nötig
  (öffentliche Nutzung mit moderatem Rate-Limit).
- Suchfilter (eng gefiltert, wie mit Adrian abgestimmt): Publikationstyp
  `Clinical Trial[pt] OR Guideline[pt] OR Systematic Review[pt] OR
  Meta-Analysis[pt]`, kombiniert mit `"ulcerative colitis"[Title/Abstract]`.
- Zeitraum: seit dem Datum des letzten erfolgreichen Laufs
  (`generatedAt` aus der zuletzt veröffentlichten `feed.json`), mit 10
  Tagen Sicherheitsüberlappung für den Fall eines ausgefallenen Laufs.
  Existiert noch keine veröffentlichte `feed.json` (allererster Lauf),
  wird stattdessen ein Zeitraum der letzten 6 Monate verwendet – identisch
  zum rollierenden Fenster aus Abschnitt 5.3, damit der erste Lauf sofort
  einen sinnvoll gefüllten Feed erzeugt.
- Pro Treffer: PMID, Titel, Publikationsdatum, Link
  (`https://pubmed.ncbi.nlm.nih.gov/<PMID>/`).

### 4.2 AWMF-Leitlinien

- Gezielt (wie abgestimmt), nicht das ganze Register: nur die zwei bereits
  in der Wissens-DB referenzierten Leitlinien.
  - S3 Colitis ulcerosa (Register-Nr. 021-009)
  - S3 Klinische Ernährung bei chronisch-entzündlichen Darmerkrankungen
    (Register-Nr. 073-027)
- Abfrage der jeweiligen AWMF-Register-Detailseite, Vergleich von Version/
  Veröffentlichungsdatum gegen den zuletzt bekannten Stand (aus der
  vorherigen `feed.json` ableitbar über die gespeicherte `id`, die die
  Versionsnummer enthält, z. B. `awmf:021-009:v7.0`).
- Ändert sich die Struktur der Seite und lässt sich die Version nicht
  mehr auslesen: Fehler loggen, alten Stand beibehalten, nicht abstürzen.

### 4.3 FDA/EMA

- Gezielt (wie abgestimmt): feste, gepflegte Liste der in der Wissens-DB
  gelisteten CU-Wirkstoffe (Infliximab, Adalimumab, Golimumab, Vedolizumab,
  Ustekinumab, Mirikizumab, Guselkumab, Tofacitinib, Filgotinib,
  Upadacitinib, Ozanimod, Etrasimod, Mesalazin, Budesonid, Azathioprin,
  Methotrexat) – Liste lebt als einfaches Array in
  `feed-service/src/drugWatchlist.ts`, künftig manuell erweiterbar.
- FDA: openFDA-API (Zulassungen/Label-Änderungen), gefiltert auf die Liste.
- EMA: EMA-News-/Medicines-Updates-Feed, gefiltert auf die gleiche Liste.
- Pro Treffer: Wirkstoffname, Meldungsart (Neuzulassung/Label-Änderung),
  Datum, Link zur Original-Meldung.

## 5. Zusammenfassung und Veröffentlichung

### 5.1 Deutsche Kurzzusammenfassung

- Für jeden **neuen** Treffer (noch nicht in der bisherigen `feed.json`
  enthalten) wird die Claude API aufgerufen (Modell: Haiku, ausreichend
  für kurze Zusammenfassungen, kosteneffizient).
- Prompt-Vorgabe: 2–3 Sätze, laienverständliches Deutsch, ruhiger Ton
  passend zum restlichen App-Design (keine Alarmierung, keine
  reißerische Sprache), keine medizinische Handlungsempfehlung.
- Schlägt der Claude-Aufruf für ein einzelnes Item fehl: Item wird in
  diesem Lauf übersprungen (nicht veröffentlicht), Fehler geloggt, der
  restliche Lauf läuft weiter. Das Item erscheint automatisch im nächsten
  Lauf erneut als "neu" und bekommt eine neue Chance auf eine
  Zusammenfassung.

### 5.2 Datenmodell

```typescript
interface FeedItem {
  id: string; // z. B. "pubmed:38234567", "awmf:021-009:v7.0", "fda:upadacitinib:2026-03-01"
  source: 'pubmed' | 'awmf' | 'fda' | 'ema';
  category: 'studie' | 'leitlinie' | 'zulassung';
  title: string; // Original-Titel (meist Englisch bei PubMed/FDA)
  summaryDe: string; // deutscher Kurz-Klappentext
  publishedDate: string; // ISO-Datum (YYYY-MM-DD)
  url: string; // Link zur Original-Quelle
}

interface FeedPublication {
  generatedAt: string; // ISO-Zeitstempel des letzten erfolgreichen Laufs
  items: FeedItem[]; // rollierendes 6-Monats-Fenster, neueste zuerst, dedupliziert per id
}
```

### 5.3 Merge- und Fenster-Logik

- Vor jedem Lauf wird die aktuell veröffentlichte `feed.json` aus dem
  öffentlichen Mini-Repo gelesen (Ausgangsbasis).
- Neue Treffer werden per `id` dedupliziert hinzugefügt.
- Einträge mit `publishedDate` älter als 6 Monate ab dem aktuellen
  Lauf-Datum werden entfernt.
- Ergebnis wird nach `publishedDate` absteigend sortiert und als neue
  `feed.json` auf den `main`-Branch des öffentlichen Mini-Repos
  committet/gepusht (nur bei tatsächlicher Änderung – ein Lauf ohne neue
  oder abgelaufene Einträge erzeugt keinen leeren Commit). Das Mini-Repo
  wird vor dem ersten Lauf leer (nur mit README) angelegt; der erste
  Workflow-Lauf legt `feed.json` erstmalig an.

## 6. Fehlerbehandlung

- Jede Quelle (PubMed, AWMF, FDA, EMA) hat ein eigenes Try/Catch; ein
  Ausfall einer Quelle verhindert nicht die Verarbeitung der anderen.
- Fehlgeschlagene Quellen werden im Workflow-Log vermerkt (Schritt-Zusammenfassung).
- Schlagen **alle** Quellen fehl, beendet sich das Skript mit einem
  Fehlercode ungleich null, wodurch der GitHub-Actions-Workflow als
  fehlgeschlagen markiert wird – GitHub verschickt dafür automatisch
  eine E-Mail an Adrian (Standardverhalten, kein Zusatzaufwand nötig).
- Schlägt nur die Veröffentlichung (Push ins Mini-Repo) fehl, obwohl die
  Datenermittlung erfolgreich war: Workflow schlägt ebenfalls fehl
  (gleiche automatische Fehler-Mail), nichts wird halb veröffentlicht.

## 7. Testing-Ansatz

- Automatisiert mit Vitest (gleiches Test-Setup wie `colitis-app/`):
  - Parsing/Normalisierung der PubMed-/FDA-/EMA-Antworten in `FeedItem`
  - Dedupe-Logik (per `id`)
  - 6-Monats-Fenster-Logik (Grenzfälle: genau 6 Monate alt, 1 Tag drüber)
  - Merge-Logik (neue Items hinzufügen, ohne bestehende zu verlieren)
- Alle Netzwerk-Aufrufe (PubMed, AWMF, openFDA, EMA, Claude API) werden in
  Tests gemockt – kein echter Netzwerkzugriff in der Test-Suite.
- Ein echter Cronjob-Lauf (inkl. echtem API-Zugriff und Veröffentlichung)
  lässt sich in dieser Entwicklungsumgebung nicht automatisiert testen
  (gleiche Einschränkung wie bei Standort/Benachrichtigungen in Phase 1).
  Ein erster manueller Testlauf über `workflow_dispatch` nach der
  Umsetzung wird empfohlen, ist aber kein Teil des automatisierten Plans.

## 8. Out of Scope (Teil A)

- Jegliche Änderung an der App selbst (`colitis-app/`) – das ist Teil B.
- Gelesen-Status, Anzeige, Offline-Cache in der App – Teil B.
- Breiteres AWMF-Register-Monitoring oder wirkstoffunabhängige FDA/EMA-
  Suche (bewusst auf die "gezielt/eng"-Variante beschränkt).
- Automatische Erweiterung der Wirkstoffliste – sie wird manuell gepflegt.
- PDF/CSV-Export dieses Feeds (kein Anwendungsfall genannt).

## 9. Namensfestlegung

- Das öffentliche Mini-Repo heißt `colitis-app-feed`
  (`Kettenhund46/colitis-app-feed`). Die veröffentlichte Datei ist damit
  erreichbar unter:
  `https://raw.githubusercontent.com/Kettenhund46/colitis-app-feed/main/feed.json`
  Diese URL ist die feste Schnittstelle, die Teil B (App-Anbindung)
  später konsumiert.
