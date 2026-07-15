# Phase 2, Teil B: News-Feed – Anbindung in der App (Design-Spec)

Stand: 2026-07-15

## 1. Ziel und Einordnung

Teil A (Server-seitige Datenquelle) ist fertig und gemergt:
`docs/superpowers/specs/2026-07-15-colitis-app-news-feed-datenquelle-design.md`.
Ein wöchentlicher Cronjob veröffentlicht eine JSON-Datei mit aktuellen
Colitis-Ulcerosa-Fachmeldungen (PubMed, AWMF-Leitlinien, FDA/EMA) unter:

```
https://raw.githubusercontent.com/Kettenhund46/colitis-app-feed/main/feed.json
```

Datenmodell der Datei (unverändert aus Teil A):

```typescript
interface FeedItem {
  id: string;            // z. B. "pubmed:38234567", global eindeutig und stabil
  source: 'pubmed' | 'awmf' | 'fda' | 'ema';
  category: 'studie' | 'leitlinie' | 'zulassung';
  title: string;
  summaryDe: string;      // deutscher Kurz-Klappentext
  publishedDate: string;  // ISO-Datum YYYY-MM-DD
  url: string;
}

interface FeedPublication {
  generatedAt: string;
  items: FeedItem[];      // rollierendes 6-Monats-Fenster, dedupliziert per id
}
```

Teil B (dieses Dokument) macht diese Daten in der App sichtbar: ein neuer
Unterbereich im Wissen-Tab, mit lokaler Offline-Zwischenspeicherung und
Gelesen-Status.

## 2. Navigation und Screen-Struktur

- Neuer Stack-Screen `app/(tabs)/wissen/feed.tsx` ("Neuigkeiten"), registriert
  in `app/(tabs)/wissen/_layout.tsx` neben den bestehenden `index`/`[slug]`.
- In `app/(tabs)/wissen/index.tsx` wird, analog zum bestehenden Link
  "Muster-Auswertung ansehen →" im Tagebuch-Tab, ein `Pressable`-Link
  "Neuigkeiten ansehen →" ergänzt, der zu `/wissen/feed` navigiert
  (`router.push('/wissen/feed')`).
- `feed.tsx` ist ein eigenständiger Container-Screen mit demselben
  `useFocusEffect`-Lade-Muster wie die bestehenden Tab-Screens.

## 3. Datenfluss (Drei-Zustände-Muster wie beim Toiletten-Finder)

Bei jedem Fokussieren des Screens:

1. **Live-Abruf**: `fetch()` gegen die oben genannte URL, mit
   Client-seitigem Timeout (`AbortController`, `FEED_CLIENT_TIMEOUT_MS =
   15000`, identisch zum bereits etablierten Timeout-Wert bei Overpass und
   im Teil-A-Cronjob).
2. **Erfolg**: Antwort als `FeedPublication` parsen (inkl. einfacher
   Formatprüfung – siehe Abschnitt 6), dann `syncFeedItems(db,
   publication.items)` aufrufen (Abschnitt 4), danach den aktualisierten
   Bestand aus der DB laden und anzeigen. Beide Banner (Fehler/Offline)
   werden geleert.
3. **Fehlschlag** (Netzwerk, Timeout, Parse-Fehler): `handleFetchFailure()`
   lädt den lokalen Cache. Ist der Cache nicht leer, wird er angezeigt plus
   ein neutraler Offline-Hinweis ("Offline – zeigt zuletzt geladene
   Neuigkeiten"). Ist der Cache leer (oder schlägt auch das Lesen des
   Caches fehl), wird eine harte deutsche Fehlermeldung angezeigt
   ("Neuigkeiten konnten nicht geladen werden.") und die Liste bleibt leer.

Ein `requestId`-Zähler (wie beim Toiletten-Finder) schützt gegen veraltete,
verzögert eintreffende Antworten, falls der Screen mehrfach schnell
hintereinander fokussiert wird.

## 4. Lokale Speicherung

### 4.1 Datenbank-Tabelle (neue Migration)

```typescript
export const cachedFeedItems = sqliteTable('cached_feed_items', {
  id: text('id').primaryKey(),
  source: text('source', { enum: ['pubmed', 'awmf', 'fda', 'ema'] }).notNull(),
  category: text('category', { enum: ['studie', 'leitlinie', 'zulassung'] }).notNull(),
  title: text('title').notNull(),
  summaryDe: text('summary_de').notNull(),
  publishedDate: text('published_date').notNull(),
  url: text('url').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
});
```

Bewusste Abweichung von der sonstigen Konvention (autoincrement-Integer als
Primärschlüssel): `FeedItem.id` ist bereits eine vom Server garantiert
global eindeutige, stabile Zeichenkette. Ein zusätzlicher künstlicher
Integer-Schlüssel wäre reiner Overhead ohne Nutzen.

### 4.2 Sync-Logik (Merge, kein reines Ersetzen)

Anders als beim Toiletten-Cache (kompletter Ersatz bei jeder Suche) muss
hier der lokale Gelesen-Status über einen Sync hinweg erhalten bleiben.
Die Sync-Entscheidung wird als reine, DB-freie Funktion umgesetzt (testbar
ohne echte Datenbank):

```typescript
interface FeedSyncPlan {
  idsToDelete: string[];
  itemsToUpsert: FeedItem[];
}

function computeFeedSyncPlan(existingIds: string[], incomingItems: FeedItem[]): FeedSyncPlan {
  const incomingIds = new Set(incomingItems.map((item) => item.id));
  const idsToDelete = existingIds.filter((id) => !incomingIds.has(id));
  return { idsToDelete, itemsToUpsert: incomingItems };
}
```

Die Repository-Funktion `syncFeedItems(db, items: FeedItem[])`:
1. Liest die aktuell im Cache vorhandenen IDs.
2. Berechnet den Plan über `computeFeedSyncPlan`.
3. Löscht die Zeilen aus `idsToDelete` (Einträge, die der Server nicht mehr
   liefert, z. B. weil sie aus dem 6-Monats-Fenster gefallen sind).
4. Upsertet jedes Item aus `itemsToUpsert` per
   `onConflictDoUpdate({ target: cachedFeedItems.id, set: { source, category,
   title, summaryDe, publishedDate, url } })` – **`isRead` wird beim Update
   bewusst nicht überschrieben**, nur beim erstmaligen Insert auf `false`
   gesetzt. Damit bleibt der Gelesen-Status über Wochen hinweg erhalten,
   auch wenn sich Titel/Zusammenfassung eines Eintrags ändern sollten.

### 4.3 Weitere Repository-Funktionen

- `listCachedFeedItems(db): Promise<FeedItem[]>` – alle Einträge inkl.
  `isRead`, sortiert nach `publishedDate` absteigend.
- `markFeedItemAsRead(db, id: string): Promise<void>` – setzt `isRead =
  true` für die gegebene ID.

## 5. UI

- Eine einzige Liste, chronologisch neueste zuerst (kein Trennen in
  Abschnitte, keine Sortierung springt beim Lesen).
- Jede Karte zeigt: Titel (fett), deutsche Kurzzusammenfassung, eine kleine
  Metazeile mit übersetztem Quellen-Label und dem Datum. Das Label ergibt
  sich eindeutig aus `source` (Kategorie wird nicht zusätzlich im Label
  verwendet, sie ist bereits implizit über die Zusammenfassung erkennbar):
  `pubmed` → "PubMed", `awmf` → "AWMF-Leitlinie", `fda` → "FDA", `ema` →
  "EMA". Feste Zuordnungstabelle, keine dynamische Übersetzung.
- Gelesene Einträge werden optisch abgesetzt (reduzierte Deckkraft /
  gedämpfte Textfarbe über bestehende Design-Tokens), bleiben aber normal
  antippbar.
- Antippen einer Karte: öffnet `url` über `expo-web-browser`
  (`WebBrowser.openBrowserAsync`, identisch zum bestehenden Muster bei
  Wissensartikel-Quellenangaben) UND ruft optimistisch sofort
  `markFeedItemAsRead` auf (lokaler State wird sofort aktualisiert, der
  DB-Schreibvorgang läuft im Hintergrund; schlägt er fehl, wird das
  geloggt, aber weder das Öffnen des Links noch die UI blockiert).
- Ladezustand: "wird geladen …"-Text, identisch zum in Schritt 8 (Polish)
  eingeführten Muster der anderen Listen-Screens.
- Leerer Zustand (Feed erfolgreich geladen, aber keine Einträge – z. B.
  unmittelbar nach dem ersten Server-Lauf): ruhiger deutscher Hinweistext,
  kein Fehler.
- Kein Detail-Screen, kein manueller "Aktualisieren"-Button (bewusste
  Scope-Entscheidungen, siehe Brainstorming).

## 6. Fehlerbehandlung

- Netzwerkfehler, Timeout: fallen in den Offline-/Fehler-Pfad (Abschnitt 3).
- Unerwartetes/kaputtes JSON: `JSON.parse`-Fehler sowie eine einfache
  Formatprüfung (`Array.isArray(publication.items)`, sonst Fehler werfen)
  laufen in denselben Fehlerpfad wie ein Netzwerkfehler – kein Unterschied
  in der Behandlung.
- Fehler beim Lesen/Schreiben des lokalen Caches werden separat geloggt und
  überschreiben nie den primären Anzeige-Zustand (gleiches Prinzip wie beim
  Toiletten-Cache: ein Cache-Schreibfehler nach erfolgreichem Live-Abruf
  verhindert nicht die Anzeige der frischen Daten).

## 7. Migration

Neue Drizzle-Migration für `cached_feed_items` wird über
`npx drizzle-kit generate` erzeugt (Schema-Änderung in `src/db/schema.ts`)
und der neue Migrationsindex-Eintrag manuell in `drizzle/migrations.js`
ergänzt (bestehendes, in der Projekt-Zusammenfassung dokumentiertes
Verfahren, da diese Datei bei Expo/SQLite nicht automatisch von
drizzle-kit gepflegt wird). Rein additiv, keine bestehende Tabelle wird
verändert.

## 8. Testing-Ansatz

- `computeFeedSyncPlan` (reine Funktion): vollständig mit Vitest getestet,
  keine Datenbank nötig.
- Repository-Funktionen (`syncFeedItems`, `listCachedFeedItems`,
  `markFeedItemAsRead`): getestet gegen eine echte temporäre SQLite-DB
  (bestehende Projekt-Konvention, kein Mock).
- Fetch-/Parse-Logik: `fetch` gemockt, inkl. Timeout-Test nach demselben
  Muster wie beim Overpass-Client.
- Screen-Komponente (`feed.tsx`) bleibt ungetestet – bestehende, bereits
  mehrfach dokumentierte Projekt-Konvention (React Native Testing Library
  technisch nicht einbindbar unter Vitest in diesem Projekt).

## 9. Out of Scope

- Push-Benachrichtigungen bei neuen Einträgen (bewusst passiver Feed, siehe
  Brainstorming-Entscheidung in Teil A).
- Detail-Screen pro Eintrag.
- Manueller "Jetzt aktualisieren"-Button.
- Filterung/Suche innerhalb des Feeds.
- Erneutes Aktivieren der AWMF-Quelle (das ist eine Teil-A-Angelegenheit,
  siehe dortige Spec Abschnitt zum Live-Format-Befund).
