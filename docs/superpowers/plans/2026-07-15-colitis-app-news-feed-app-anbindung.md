# Phase 2, Teil B: News-Feed App-Anbindung – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein neuer Unterbereich im Wissen-Tab der Colitis-Ulcerosa-App zeigt die von Phase 2 Teil A veröffentlichten Fachmeldungen an, mit lokaler Offline-Zwischenspeicherung (Drei-Zustände-Muster wie beim Toiletten-Finder) und dauerhaftem Gelesen-Status.

**Architecture:** Neuer Feature-Ordner `src/features/newsFeed/` mit reiner Sync-Diff-Logik, einem Repository gegen die verschlüsselte lokale DB (neue Tabelle `cached_feed_items`) und einem Fetch-Client für die öffentliche Feed-Datei. Ein neuer Container-Screen `app/(tabs)/wissen/feed.tsx` verdrahtet das Ganze nach demselben Live→Cache→Fehler-Muster wie der bestehende Toiletten-Finder.

**Tech Stack:** Expo/React Native, TypeScript, Drizzle ORM (SQLite), Vitest, natives `fetch`.

## Global Constraints

- Feed-URL: `https://raw.githubusercontent.com/Kettenhund46/colitis-app-feed/main/feed.json`
- Client-Timeout: `FEED_CLIENT_TIMEOUT_MS = 15000` (identisch zum Overpass-Client-Timeout).
- Neue Tabelle `cached_feed_items`: `id` ist `text` **Primärschlüssel ohne Autoincrement** (bewusste Abweichung von der sonstigen Integer-Autoincrement-Konvention, da die Feed-Item-ID vom Server bereits global eindeutig und stabil ist).
- `isRead` wird bei einem Sync **nie** durch ein Update überschrieben, nur beim erstmaligen Insert auf `false` gesetzt.
- Bei jedem erfolgreichen Sync werden lokale Einträge gelöscht, die in der neuen Server-Antwort nicht mehr enthalten sind (Cache bleibt synchron mit dem rollierenden 6-Monats-Fenster des Servers).
- Liste ist chronologisch nach `publishedDate` absteigend sortiert, keine getrennten Abschnitte.
- Antippen einer Karte: `Linking.openURL(item.url)` **und** sofortiges optimistisches Markieren als gelesen (kein separater Schalter, kein Detail-Screen, kein manueller Aktualisieren-Button – bewusst out of scope).
- Externe Links werden über `Linking.openURL` geöffnet (React-Native-Kernmodul), **nicht** über `expo-web-browser` – das ist das bereits etablierte Muster (Wissensartikel-Quellen, Toiletten-Navigationslink).
- Alle Farben/Abstände/Radien über `tokens` aus `src/styles/tokens.ts`, keine hartkodierten Werte.
- Deutsche UI-Texte mit korrekten Umlauten (ä/ö/ü/ß); deutsche Anführungszeichen (öffnend „, schließend ") falls Zitate vorkommen.
- Reine Logik (Sync-Diff, Quellen-Label) wird mit Vitest getestet; Repository-Funktionen gegen eine echte temporäre SQLite-Test-DB (kein Mock); der Screen selbst bleibt ungetestet (bestehende Projekt-Konvention, React Native Testing Library nicht einbindbar).

---

### Task 1: DB-Schema, Migration und Typen

**Files:**
- Modify: `colitis-app/src/db/schema.ts`
- Create: `colitis-app/drizzle/0003_add_cached_feed_items.sql` (generiert, siehe Step 3)
- Modify: `colitis-app/drizzle/migrations.js`
- Create: `colitis-app/src/features/newsFeed/types.ts`

**Interfaces:**
- Produces: `cachedFeedItems` (Drizzle-Tabelle, `src/db/schema.ts`) – von Task 2 verwendet
- Produces: `RemoteFeedItem`, `RemoteFeedPublication`, `FeedItem` (Typen, `src/features/newsFeed/types.ts`) – von Task 2, 3, 4, 5 verwendet

- [ ] **Step 1: Tabelle in `src/db/schema.ts` ergänzen**

Bestehende Datei, am Ende nach `cachedToilets` ergänzen (Datei nicht neu schreiben, nur anhängen):

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

- [ ] **Step 2: Migration generieren**

Run (aus `colitis-app/`): `npx drizzle-kit generate --name=add_cached_feed_items`

Erwartet: neue Datei `drizzle/0003_add_cached_feed_items.sql`, ein neuer Eintrag in
`drizzle/meta/_journal.json` sowie eine neue `drizzle/meta/0003_snapshot.json`.

- [ ] **Step 3: Generierten Migrationsinhalt prüfen**

Der erwartete Inhalt von `drizzle/0003_add_cached_feed_items.sql`:

```sql
CREATE TABLE `cached_feed_items` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`summary_de` text NOT NULL,
	`published_date` text NOT NULL,
	`url` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL
);
```

Weicht der tatsächlich generierte Inhalt hiervon ab (z. B. andere
drizzle-kit-Version mit anderer Formatierung), die Datei **nicht** von Hand
anpassen – der generierte Inhalt ist die Wahrheit, dieser Plan-Schritt ist
nur eine Erwartungsprüfung. Bei einer inhaltlichen Abweichung (z. B. andere
Spaltentypen als oben) sofort stoppen und als Konflikt melden.

- [ ] **Step 4: `drizzle/migrations.js` um den neuen Eintrag ergänzen**

Bestehende Datei, komplett ersetzen:

```javascript
// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_remarkable_junta.sql';
import m0001 from './0001_unique_lizard.sql';
import m0002 from './0002_chubby_speed_demon.sql';
import m0003 from './0003_add_cached_feed_items.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003
    }
  }
  ```

- [ ] **Step 5: `src/features/newsFeed/types.ts` anlegen**

`RemoteFeedItem`/`RemoteFeedPublication` bilden exakt das Datenmodell aus
Phase 2 Teil A ab (Server-JSON, ohne `isRead`). `FeedItem` ist die
App-interne, um `isRead` erweiterte Repräsentation.

```typescript
export interface RemoteFeedItem {
  id: string;
  source: 'pubmed' | 'awmf' | 'fda' | 'ema';
  category: 'studie' | 'leitlinie' | 'zulassung';
  title: string;
  summaryDe: string;
  publishedDate: string; // YYYY-MM-DD
  url: string;
}

export interface RemoteFeedPublication {
  generatedAt: string;
  items: RemoteFeedItem[];
}

export interface FeedItem extends RemoteFeedItem {
  isRead: boolean;
}
```

- [ ] **Step 6: Bestehende Test-Suite und TypeScript-Check**

Run: `cd colitis-app && npm test && npx tsc --noEmit`
Expected: alle bisherigen Tests weiterhin grün (die neue Tabelle wird noch
von nichts referenziert), keine TypeScript-Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts drizzle/0003_add_cached_feed_items.sql drizzle/meta drizzle/migrations.js src/features/newsFeed/types.ts
git commit -m "feat: Datenbank-Tabelle und Typen fuer den News-Feed ergaenzen"
```

---

### Task 2: Sync-Diff-Logik und Repository

**Files:**
- Create: `colitis-app/src/features/newsFeed/db/feedSyncPlan.ts`
- Test: `colitis-app/src/features/newsFeed/db/feedSyncPlan.test.ts`
- Create: `colitis-app/src/features/newsFeed/db/testDb.ts`
- Create: `colitis-app/src/features/newsFeed/db/feedItemsRepository.ts`
- Test: `colitis-app/src/features/newsFeed/db/feedItemsRepository.test.ts`

**Interfaces:**
- Consumes: `cachedFeedItems` (Task 1, `src/db/schema.ts`); `RemoteFeedItem`, `FeedItem` (Task 1, `types.ts`)
- Produces: `FeedSyncPlan`, `computeFeedSyncPlan(existingIds: string[], incomingItems: RemoteFeedItem[]): FeedSyncPlan` (`feedSyncPlan.ts`) – von `feedItemsRepository.ts` in dieser Task verwendet
- Produces: `NewsFeedDb`, `syncFeedItems(db: NewsFeedDb, items: RemoteFeedItem[]): Promise<void>`, `listCachedFeedItems(db: NewsFeedDb): Promise<FeedItem[]>`, `markFeedItemAsRead(db: NewsFeedDb, id: string): Promise<void>` (`feedItemsRepository.ts`) – von Task 5 (Screen) verwendet

- [ ] **Step 1: Fehlschlagenden Test für `computeFeedSyncPlan` schreiben**

`colitis-app/src/features/newsFeed/db/feedSyncPlan.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeFeedSyncPlan } from './feedSyncPlan';
import type { RemoteFeedItem } from '../types';

function makeItem(id: string): RemoteFeedItem {
  return {
    id,
    source: 'pubmed',
    category: 'studie',
    title: 'Titel',
    summaryDe: 'Zusammenfassung.',
    publishedDate: '2026-07-01',
    url: 'https://example.com',
  };
}

describe('computeFeedSyncPlan', () => {
  it('upserts all incoming items and deletes nothing when there is no existing cache', () => {
    const plan = computeFeedSyncPlan([], [makeItem('a'), makeItem('b')]);
    expect(plan.idsToDelete).toEqual([]);
    expect(plan.itemsToUpsert.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('deletes existing ids that are not present in the incoming items', () => {
    const plan = computeFeedSyncPlan(['a', 'b'], [makeItem('b')]);
    expect(plan.idsToDelete).toEqual(['a']);
  });

  it('does not delete existing ids that are still present in the incoming items', () => {
    const plan = computeFeedSyncPlan(['a'], [makeItem('a')]);
    expect(plan.idsToDelete).toEqual([]);
  });

  it('upserts every incoming item regardless of whether it already existed', () => {
    const plan = computeFeedSyncPlan(['a'], [makeItem('a'), makeItem('c')]);
    expect(plan.itemsToUpsert.map((item) => item.id)).toEqual(['a', 'c']);
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/newsFeed/db/feedSyncPlan.test.ts`
Expected: FAIL mit "Cannot find module './feedSyncPlan'"

- [ ] **Step 3: `feedSyncPlan.ts` implementieren**

```typescript
import type { RemoteFeedItem } from '../types';

export interface FeedSyncPlan {
  idsToDelete: string[];
  itemsToUpsert: RemoteFeedItem[];
}

export function computeFeedSyncPlan(existingIds: string[], incomingItems: RemoteFeedItem[]): FeedSyncPlan {
  const incomingIds = new Set(incomingItems.map((item) => item.id));
  const idsToDelete = existingIds.filter((id) => !incomingIds.has(id));
  return { idsToDelete, itemsToUpsert: incomingItems };
}
```

- [ ] **Step 4: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/newsFeed/db/feedSyncPlan.test.ts`
Expected: 4 Tests, alle grün.

- [ ] **Step 5: Test-DB-Hilfsfunktion anlegen**

Identisches Muster wie `src/features/toilets/db/testDb.ts` (wendet beim
Aufbau automatisch alle `.sql`-Dateien aus `drizzle/` an, inklusive der in
Task 1 neu hinzugekommenen):

`colitis-app/src/features/newsFeed/db/testDb.ts`:

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from '../../../db/schema';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  const migrationsDir = join(__dirname, '../../../../drizzle');
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const migrationSql = readFileSync(join(migrationsDir, file), 'utf-8');
    for (const statement of migrationSql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) {
        sqlite.exec(trimmed);
      }
    }
  }

  return drizzle(sqlite, { schema });
}
```

- [ ] **Step 6: Fehlschlagenden Test für das Repository schreiben**

`colitis-app/src/features/newsFeed/db/feedItemsRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { syncFeedItems, listCachedFeedItems, markFeedItemAsRead } from './feedItemsRepository';
import type { RemoteFeedItem } from '../types';

const itemA: RemoteFeedItem = {
  id: 'pubmed:1',
  source: 'pubmed',
  category: 'studie',
  title: 'Titel A',
  summaryDe: 'Zusammenfassung A.',
  publishedDate: '2026-07-01',
  url: 'https://pubmed.ncbi.nlm.nih.gov/1/',
};
const itemB: RemoteFeedItem = {
  id: 'awmf:021-009:v7.0',
  source: 'awmf',
  category: 'leitlinie',
  title: 'Titel B',
  summaryDe: 'Zusammenfassung B.',
  publishedDate: '2026-06-01',
  url: 'https://register.awmf.org/de/leitlinien/detail/021-009',
};

describe('news feed items repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns an empty list when nothing has been synced yet', async () => {
    expect(await listCachedFeedItems(db)).toEqual([]);
  });

  it('inserts new items as unread', async () => {
    await syncFeedItems(db, [itemA]);

    const list = await listCachedFeedItems(db);
    expect(list).toEqual([{ ...itemA, isRead: false }]);
  });

  it('removes items no longer present in a later sync', async () => {
    await syncFeedItems(db, [itemA, itemB]);
    await syncFeedItems(db, [itemB]);

    const list = await listCachedFeedItems(db);
    expect(list.map((item) => item.id)).toEqual(['awmf:021-009:v7.0']);
  });

  it('preserves the read status of an item across a sync that still includes it', async () => {
    await syncFeedItems(db, [itemA]);
    await markFeedItemAsRead(db, itemA.id);

    await syncFeedItems(db, [itemA, itemB]);

    const list = await listCachedFeedItems(db);
    const stillPresent = list.find((item) => item.id === itemA.id);
    expect(stillPresent?.isRead).toBe(true);
  });

  it('updates changed fields of an existing item without resetting isRead', async () => {
    await syncFeedItems(db, [itemA]);
    await markFeedItemAsRead(db, itemA.id);

    const updatedItemA: RemoteFeedItem = { ...itemA, title: 'Aktualisierter Titel' };
    await syncFeedItems(db, [updatedItemA]);

    const list = await listCachedFeedItems(db);
    expect(list).toEqual([{ ...updatedItemA, isRead: true }]);
  });

  it('sorts by publishedDate descending', async () => {
    await syncFeedItems(db, [itemA, itemB]);

    const list = await listCachedFeedItems(db);
    expect(list.map((item) => item.id)).toEqual(['pubmed:1', 'awmf:021-009:v7.0']);
  });

  it('marks an item as read', async () => {
    await syncFeedItems(db, [itemA]);
    await markFeedItemAsRead(db, itemA.id);

    const list = await listCachedFeedItems(db);
    expect(list[0].isRead).toBe(true);
  });
});
```

- [ ] **Step 7: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/newsFeed/db/feedItemsRepository.test.ts`
Expected: FAIL mit "Cannot find module './feedItemsRepository'"

- [ ] **Step 8: `feedItemsRepository.ts` implementieren**

```typescript
import { desc, eq, inArray } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { cachedFeedItems } from '../../../db/schema';
import * as schema from '../../../db/schema';
import { computeFeedSyncPlan } from './feedSyncPlan';
import type { FeedItem, RemoteFeedItem } from '../types';

export type NewsFeedDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function syncFeedItems(db: NewsFeedDb, items: RemoteFeedItem[]): Promise<void> {
  const existingRows = await db.select({ id: cachedFeedItems.id }).from(cachedFeedItems);
  const existingIds = existingRows.map((row) => row.id);
  const plan = computeFeedSyncPlan(existingIds, items);

  if (plan.idsToDelete.length > 0) {
    await db.delete(cachedFeedItems).where(inArray(cachedFeedItems.id, plan.idsToDelete));
  }

  for (const item of plan.itemsToUpsert) {
    await db
      .insert(cachedFeedItems)
      .values({
        id: item.id,
        source: item.source,
        category: item.category,
        title: item.title,
        summaryDe: item.summaryDe,
        publishedDate: item.publishedDate,
        url: item.url,
        isRead: false,
      })
      .onConflictDoUpdate({
        target: cachedFeedItems.id,
        set: {
          source: item.source,
          category: item.category,
          title: item.title,
          summaryDe: item.summaryDe,
          publishedDate: item.publishedDate,
          url: item.url,
        },
      });
  }
}

export async function listCachedFeedItems(db: NewsFeedDb): Promise<FeedItem[]> {
  const rows = await db.select().from(cachedFeedItems).orderBy(desc(cachedFeedItems.publishedDate));
  return rows.map(rowToFeedItem);
}

export async function markFeedItemAsRead(db: NewsFeedDb, id: string): Promise<void> {
  await db.update(cachedFeedItems).set({ isRead: true }).where(eq(cachedFeedItems.id, id));
}

function rowToFeedItem(row: typeof cachedFeedItems.$inferSelect): FeedItem {
  return {
    id: row.id,
    source: row.source,
    category: row.category,
    title: row.title,
    summaryDe: row.summaryDe,
    publishedDate: row.publishedDate,
    url: row.url,
    isRead: row.isRead,
  };
}
```

- [ ] **Step 9: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/newsFeed/db/feedItemsRepository.test.ts`
Expected: 7 Tests, alle grün.

- [ ] **Step 10: Gesamte Test-Suite und TypeScript-Check**

Run: `cd colitis-app && npm test && npx tsc --noEmit`
Expected: alle Tests grün, keine TypeScript-Fehler.

- [ ] **Step 11: Commit**

```bash
git add src/features/newsFeed/db/feedSyncPlan.ts src/features/newsFeed/db/feedSyncPlan.test.ts src/features/newsFeed/db/testDb.ts src/features/newsFeed/db/feedItemsRepository.ts src/features/newsFeed/db/feedItemsRepository.test.ts
git commit -m "feat: Sync-Diff-Logik und Repository fuer den News-Feed implementieren"
```

---

### Task 3: Fetch-Client

**Files:**
- Create: `colitis-app/src/features/newsFeed/constants.ts`
- Create: `colitis-app/src/features/newsFeed/feedClient.ts`
- Test: `colitis-app/src/features/newsFeed/feedClient.test.ts`

**Interfaces:**
- Consumes: `RemoteFeedPublication` (Task 1, `types.ts`)
- Produces: `FEED_URL: string`, `FEED_CLIENT_TIMEOUT_MS: number` (`constants.ts`) – von Task 5 (Screen, für Fehlertext-Kontext) nicht zwingend, aber von dieser Task und ihren Tests verwendet
- Produces: `fetchFeedPublication(): Promise<RemoteFeedPublication>`, `parseFeedPublication(data: unknown): RemoteFeedPublication` (`feedClient.ts`) – von Task 5 (Screen) verwendet

- [ ] **Step 1: `constants.ts` anlegen**

```typescript
export const FEED_URL = 'https://raw.githubusercontent.com/Kettenhund46/colitis-app-feed/main/feed.json';
export const FEED_CLIENT_TIMEOUT_MS = 15000;
```

- [ ] **Step 2: Fehlschlagenden Test schreiben**

`colitis-app/src/features/newsFeed/feedClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchFeedPublication, parseFeedPublication } from './feedClient';
import { FEED_URL, FEED_CLIENT_TIMEOUT_MS } from './constants';

describe('parseFeedPublication', () => {
  it('returns the publication when the shape is valid', () => {
    const data = { generatedAt: '2026-07-15T05:00:00.000Z', items: [] };
    expect(parseFeedPublication(data)).toEqual(data);
  });

  it('throws when generatedAt is missing', () => {
    expect(() => parseFeedPublication({ items: [] })).toThrow('Feed-Antwort hat ein unerwartetes Format.');
  });

  it('throws when items is not an array', () => {
    expect(() => parseFeedPublication({ generatedAt: '2026-07-15', items: 'nope' })).toThrow(
      'Feed-Antwort hat ein unerwartetes Format.'
    );
  });
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('fetchFeedPublication', () => {
  it('fetches and parses the feed', async () => {
    const publication = { generatedAt: '2026-07-15T05:00:00.000Z', items: [] };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(publication) });

    expect(await fetchFeedPublication()).toEqual(publication);
    expect(fetchMock).toHaveBeenCalledWith(FEED_URL, expect.objectContaining({}));
  });

  it('throws a German error when the response is not ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) });

    await expect(fetchFeedPublication()).rejects.toThrow('Feed-Anfrage fehlgeschlagen (Status 404)');
  });

  it('propagates a network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network unreachable'));

    await expect(fetchFeedPublication()).rejects.toThrow('network unreachable');
  });

  it('aborts the request after a client-side timeout and reports a German error', async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementationOnce((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        });
      });

      const resultPromise = fetchFeedPublication();
      const assertion = expect(resultPromise).rejects.toThrow('Feed-Anfrage abgebrochen (Zeitüberschreitung).');
      await vi.advanceTimersByTimeAsync(FEED_CLIENT_TIMEOUT_MS);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 3: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/newsFeed/feedClient.test.ts`
Expected: FAIL mit "Cannot find module './feedClient'"

- [ ] **Step 4: `feedClient.ts` implementieren**

```typescript
import { FEED_URL, FEED_CLIENT_TIMEOUT_MS } from './constants';
import type { RemoteFeedPublication } from './types';

export function parseFeedPublication(data: unknown): RemoteFeedPublication {
  const publication = data as { generatedAt?: unknown; items?: unknown };
  if (typeof publication.generatedAt !== 'string' || !Array.isArray(publication.items)) {
    throw new Error('Feed-Antwort hat ein unerwartetes Format.');
  }
  return { generatedAt: publication.generatedAt, items: publication.items as RemoteFeedPublication['items'] };
}

export async function fetchFeedPublication(): Promise<RemoteFeedPublication> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FEED_CLIENT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(FEED_URL, { signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Feed-Anfrage abgebrochen (Zeitüberschreitung).');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Feed-Anfrage fehlgeschlagen (Status ${response.status})`);
  }

  const data: unknown = await response.json();
  return parseFeedPublication(data);
}
```

- [ ] **Step 5: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/newsFeed/feedClient.test.ts`
Expected: 7 Tests, alle grün.

- [ ] **Step 6: Gesamte Test-Suite und TypeScript-Check**

Run: `cd colitis-app && npm test && npx tsc --noEmit`
Expected: alle Tests grün, keine TypeScript-Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/features/newsFeed/constants.ts src/features/newsFeed/feedClient.ts src/features/newsFeed/feedClient.test.ts
git commit -m "feat: Fetch-Client fuer den News-Feed implementieren"
```

---

### Task 4: Quellen-Label und Liste-Komponente

**Files:**
- Create: `colitis-app/src/features/newsFeed/sourceLabel.ts`
- Test: `colitis-app/src/features/newsFeed/sourceLabel.test.ts`
- Create: `colitis-app/src/features/newsFeed/components/NewsFeedList.tsx`

**Interfaces:**
- Consumes: `FeedItem` (Task 1, `types.ts`)
- Produces: `sourceLabelFor(source: FeedItem['source']): string` (`sourceLabel.ts`) – von `NewsFeedList.tsx` in dieser Task verwendet
- Produces: `NewsFeedList` React-Komponente mit Props `{ items: FeedItem[]; onSelect: (item: FeedItem) => void }` (`components/NewsFeedList.tsx`) – von Task 5 (Screen) verwendet

- [ ] **Step 1: Fehlschlagenden Test für `sourceLabelFor` schreiben**

`colitis-app/src/features/newsFeed/sourceLabel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { sourceLabelFor } from './sourceLabel';

describe('sourceLabelFor', () => {
  it('maps pubmed to PubMed', () => {
    expect(sourceLabelFor('pubmed')).toBe('PubMed');
  });

  it('maps awmf to AWMF-Leitlinie', () => {
    expect(sourceLabelFor('awmf')).toBe('AWMF-Leitlinie');
  });

  it('maps fda to FDA', () => {
    expect(sourceLabelFor('fda')).toBe('FDA');
  });

  it('maps ema to EMA', () => {
    expect(sourceLabelFor('ema')).toBe('EMA');
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/newsFeed/sourceLabel.test.ts`
Expected: FAIL mit "Cannot find module './sourceLabel'"

- [ ] **Step 3: `sourceLabel.ts` implementieren**

```typescript
import type { FeedItem } from './types';

const SOURCE_LABELS: Record<FeedItem['source'], string> = {
  pubmed: 'PubMed',
  awmf: 'AWMF-Leitlinie',
  fda: 'FDA',
  ema: 'EMA',
};

export function sourceLabelFor(source: FeedItem['source']): string {
  return SOURCE_LABELS[source];
}
```

- [ ] **Step 4: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/newsFeed/sourceLabel.test.ts`
Expected: 4 Tests, alle grün.

- [ ] **Step 5: `NewsFeedList.tsx` implementieren**

Kein Test für diese Datei (bestehende Projekt-Konvention – React-Native-
Komponenten bleiben ungetestet).

```tsx
import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import { sourceLabelFor } from '../sourceLabel';
import type { FeedItem } from '../types';

interface NewsFeedListProps {
  items: FeedItem[];
  onSelect: (item: FeedItem) => void;
}

export function NewsFeedList({ items, onSelect }: NewsFeedListProps) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Noch keine Neuigkeiten vorhanden.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Neuigkeit: ${item.title}${item.isRead ? ' (bereits gelesen)' : ''}`}
          style={[styles.card, item.isRead && styles.cardRead]}
          onPress={() => onSelect(item)}
        >
          <Text style={[styles.cardTitle, item.isRead && styles.textRead]}>{item.title}</Text>
          <Text style={[styles.cardSummary, item.isRead && styles.textRead]}>{item.summaryDe}</Text>
          <Text style={styles.cardMeta}>
            {sourceLabelFor(item.source)} · {item.publishedDate}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  listContent: {
    padding: tokens.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  emptyText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
    textAlign: 'center',
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  cardRead: {
    opacity: 0.6,
  },
  cardTitle: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
  },
  cardSummary: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.xs,
  },
  textRead: {
    color: tokens.colors.textSecondary,
  },
  cardMeta: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
  },
});
```

- [ ] **Step 6: Gesamte Test-Suite und TypeScript-Check**

Run: `cd colitis-app && npm test && npx tsc --noEmit`
Expected: alle Tests grün, keine TypeScript-Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/features/newsFeed/sourceLabel.ts src/features/newsFeed/sourceLabel.test.ts src/features/newsFeed/components/NewsFeedList.tsx
git commit -m "feat: Quellen-Label und Liste-Komponente fuer den News-Feed implementieren"
```

---

### Task 5: Screen, Navigation und Verdrahtung

**Files:**
- Create: `colitis-app/app/(tabs)/wissen/feed.tsx`
- Modify: `colitis-app/app/(tabs)/wissen/_layout.tsx`
- Modify: `colitis-app/app/(tabs)/wissen/index.tsx`

**Interfaces:**
- Consumes: `fetchFeedPublication` (Task 3, `feedClient.ts`); `syncFeedItems`, `listCachedFeedItems`, `markFeedItemAsRead` (Task 2, `feedItemsRepository.ts`); `NewsFeedList` (Task 4, `components/NewsFeedList.tsx`); `FeedItem` (Task 1, `types.ts`); `createEncryptedDb` (bestehend, `src/db/client.ts`)
- Produces: Screen `app/(tabs)/wissen/feed.tsx`, erreichbar über `/wissen/feed` – keine weiteren Konsumenten in diesem Plan

- [ ] **Step 1: `_layout.tsx` um den neuen Screen ergänzen**

`colitis-app/app/(tabs)/wissen/_layout.tsx` – bestehende Datei, komplett ersetzen:

```tsx
import { Stack } from 'expo-router';
import { tokens } from '../../../src/styles/tokens';

export default function WissenLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.colors.background },
        headerTintColor: tokens.colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Wissen' }} />
      <Stack.Screen name="[slug]" options={{ title: 'Artikel' }} />
      <Stack.Screen name="feed" options={{ title: 'Neuigkeiten' }} />
    </Stack>
  );
}
```

- [ ] **Step 2: Link in `index.tsx` ergänzen**

`colitis-app/app/(tabs)/wissen/index.tsx` – bestehende Datei, komplett ersetzen:

```tsx
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { seedKnowledgeArticles, listKnowledgeArticles } from '../../../src/features/knowledge/db/knowledgeRepository';
import { filterKnowledgeArticles } from '../../../src/features/knowledge/search';
import { KnowledgeArticleList } from '../../../src/features/knowledge/components/KnowledgeArticleList';
import { tokens } from '../../../src/styles/tokens';
import type { KnowledgeArticle } from '../../../src/features/knowledge/types';

export default function WissenScreen() {
  const router = useRouter();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);

      createEncryptedDb()
        .then(async (db) => {
          await seedKnowledgeArticles(db);
          return listKnowledgeArticles(db);
        })
        .then((loadedArticles) => {
          if (isActive) {
            setArticles(loadedArticles);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Wissen] Laden der Artikel fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Inhalte konnten nicht geladen werden.');
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  const visibleArticles = filterKnowledgeArticles(articles, query);

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Neuigkeiten ansehen"
        style={styles.newsLink}
        onPress={() => router.push('/wissen/feed')}
      >
        <Text style={styles.newsLinkText}>Neuigkeiten ansehen →</Text>
      </Pressable>
      <TextInput
        style={styles.searchInput}
        placeholder="Artikel durchsuchen …"
        placeholderTextColor={tokens.colors.textSecondary}
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Wissensartikel durchsuchen"
      />
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Artikel werden geladen …</Text>
        </View>
      ) : (
        <KnowledgeArticleList
          articles={visibleArticles}
          onSelect={(slug) => router.push(`/wissen/${slug}`)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
  },
  newsLink: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    padding: tokens.spacing.md,
  },
  newsLinkText: {
    color: tokens.colors.primary,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    margin: tokens.spacing.md,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  loadingText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
  },
});
```

- [ ] **Step 3: `feed.tsx` implementieren**

Container-Screen mit dem Drei-Zustände-Muster (Live → Cache+Offline-Hinweis
→ harter Fehler), analog zu `app/(tabs)/toiletten/index.tsx`. Ein
`requestId`-Zähler schützt gegen veraltete, verzögert eintreffende
Antworten bei mehrfachem schnellen Fokuswechsel.

`colitis-app/app/(tabs)/wissen/feed.tsx`:

```tsx
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { fetchFeedPublication } from '../../../src/features/newsFeed/feedClient';
import {
  syncFeedItems,
  listCachedFeedItems,
  markFeedItemAsRead,
} from '../../../src/features/newsFeed/db/feedItemsRepository';
import { NewsFeedList } from '../../../src/features/newsFeed/components/NewsFeedList';
import { tokens } from '../../../src/styles/tokens';
import type { FeedItem } from '../../../src/features/newsFeed/types';

export default function NewsFeedScreen() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offlineHint, setOfflineHint] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const requestId = ++loadRequestIdRef.current;
      setIsLoading(true);
      loadFeed(requestId).finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });
      return () => {
        isActive = false;
      };
    }, [])
  );

  async function loadFeed(requestId: number) {
    try {
      const publication = await fetchFeedPublication();
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      const db = await createEncryptedDb();
      await syncFeedItems(db, publication.items);
      const cached = await listCachedFeedItems(db);
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      setItems(cached);
      setLoadError(null);
      setOfflineHint(null);
    } catch (error: unknown) {
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      console.error('[NewsFeed] Laden der Neuigkeiten fehlgeschlagen:', error);
      await handleLoadFailure(requestId);
    }
  }

  async function handleLoadFailure(requestId: number) {
    try {
      const db = await createEncryptedDb();
      const cached = await listCachedFeedItems(db);
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      if (cached.length > 0) {
        setItems(cached);
        setOfflineHint('Offline — zeigt zuletzt geladene Neuigkeiten');
        setLoadError(null);
        return;
      }
    } catch (cacheError: unknown) {
      console.error('[NewsFeed] Cache konnte nicht gelesen werden:', cacheError);
    }
    if (requestId !== loadRequestIdRef.current) {
      return;
    }
    setLoadError('Neuigkeiten konnten nicht geladen werden.');
    setOfflineHint(null);
  }

  async function handleSelect(item: FeedItem) {
    Linking.openURL(item.url);
    if (item.isRead) {
      return;
    }
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
    try {
      const db = await createEncryptedDb();
      await markFeedItemAsRead(db, item.id);
    } catch (error: unknown) {
      console.error('[NewsFeed] Gelesen-Status konnte nicht gespeichert werden:', error);
    }
  }

  return (
    <View style={styles.container}>
      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      )}
      {offlineHint && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>{offlineHint}</Text>
        </View>
      )}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Neuigkeiten werden geladen …</Text>
        </View>
      ) : (
        <NewsFeedList items={items} onSelect={handleSelect} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  errorBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.danger,
    padding: tokens.spacing.sm,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
  },
  offlineBanner: {
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    padding: tokens.spacing.sm,
  },
  offlineText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  loadingText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.md,
  },
});
```

- [ ] **Step 4: Gesamte Test-Suite und TypeScript-Check**

Run: `cd colitis-app && npm test && npx tsc --noEmit`
Expected: alle Tests grün (Screen selbst ist ungetestet, aber muss
typprüfen), keine TypeScript-Fehler.

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/wissen/feed.tsx app/(tabs)/wissen/_layout.tsx app/(tabs)/wissen/index.tsx
git commit -m "feat: News-Feed-Screen und Navigation im Wissen-Tab verdrahten"
```

---

## Nach der Umsetzung

Ein echter Testlauf auf einem Gerät (Anzeige, Antippen öffnet den externen
Link, Offline-Verhalten) ist in dieser Entwicklungsumgebung nicht möglich
(wie bei allen anderen Phase-1/2-Schritten) – wird Teil des bereits
bestehenden Alltagstest-Checkliste-Dokuments
(`docs/superpowers/colitis-app-alltagstest-checkliste.md`), das dafür um
einen Abschnitt "News-Feed" ergänzt werden sollte, sobald Adrian das
möchte (nicht Teil dieses Plans).
