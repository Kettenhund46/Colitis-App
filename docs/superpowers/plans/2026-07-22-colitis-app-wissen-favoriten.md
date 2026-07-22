# Wissen-Favoriten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wissensartikel lassen sich auf der Detailseite als Favorit markieren; die Übersichtsliste bekommt einen Filter "Alle" / "Favoriten", kombinierbar mit der bestehenden Suche. Favoriten überleben ein Backup/Restore.

**Architecture:** Neue Datenbanktabelle `knowledge_favorites` (unabhängig von den geseedeten Artikel-Inhalten) mit eigenem Repository, eine reine Filterfunktion in der bestehenden `search.ts`, Erweiterung der bestehenden Detail- und Listenseiten, sowie Anschluss an das bestehende Backup/Restore-System (das Tabellen explizit auflistet, nicht automatisch alles sichert).

**Tech Stack:** React Native / Expo SDK 57, TypeScript, Drizzle ORM, Vitest.

## Global Constraints

- Referenz: `docs/superpowers/specs/2026-07-22-colitis-app-wissen-favoriten-design.md`
- Neue Tabelle erfordert eine Drizzle-Migration (`npx drizzle-kit generate`), gleicher Ablauf wie bei den vier bestehenden Migrationen in `drizzle/`.
- `knowledge_favorites` ist unabhängig von `knowledge_content` (keine Fremdschlüssel-Beziehung) – Artikel-Inhalte werden bei jedem App-Start neu geseedet, Favoriten sind reine Nutzerdaten.
- `addFavorite`/`removeFavorite` müssen idempotent sein (kein Fehler bei doppeltem Hinzufügen/Entfernen).
- Favoriten-Markierung nur auf der Artikel-Detailseite, nicht in der Übersichtsliste.
- Alle UI-Texte auf Deutsch, Themes über `useTheme()`/`ThemeColors`, keine hartkodierten Hex-Farben in Komponenten.
- Windows-Testbefehl: `npx.cmd vitest run <pfad>`; Type-Check: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`).
- `BACKUP_FORMAT_VERSION` bleibt bei `1` (reine Tabellenerweiterung); alte Sicherungsdateien ohne `knowledgeFavorites` werden von der bestehenden `REQUIRED_TABLE_KEYS`-Prüfung korrekt als ungültig zurückgewiesen – kein Sonderfall nötig.
- `AGENTS.md` beachten: Expo SDK 57 Doku unter https://docs.expo.dev/versions/v57.0.0/ ist maßgeblich, falls Expo-APIs verwendet werden (hier nicht nötig, reines React Native + Drizzle).

---

### Task 1: Datenbank-Tabelle, Migration und Repository

**Files:**
- Modify: `colitis-app/src/db/schema.ts:60-66` (neue Tabelle nach `knowledgeContent` einfügen)
- Create: (generiert durch `drizzle-kit generate`) eine neue Datei `colitis-app/drizzle/000X_<generierter-name>.sql`, aktualisierte `colitis-app/drizzle/meta/_journal.json`, neue `colitis-app/drizzle/meta/000X_snapshot.json`, aktualisierte `colitis-app/drizzle/migrations.js`
- Create: `colitis-app/src/features/knowledge/db/testDb.ts`
- Create: `colitis-app/src/features/knowledge/db/knowledgeFavoritesRepository.ts`
- Test: `colitis-app/src/features/knowledge/db/knowledgeFavoritesRepository.test.ts`

**Interfaces:**
- Consumes: nichts aus vorherigen Tasks (erster Task).
- Produces (für Task 3, 4, 5):
  - `export const knowledgeFavorites` Tabelle in `src/db/schema.ts` mit Spalten `id` (autoincrement) und `articleSlug` (`text`, `not null`, `unique`).
  - `export function listFavoriteSlugs(db: KnowledgeFavoritesDb): Promise<string[]>`
  - `export function addFavorite(db: KnowledgeFavoritesDb, articleSlug: string): Promise<void>`
  - `export function removeFavorite(db: KnowledgeFavoritesDb, articleSlug: string): Promise<void>`
  - `export function createTestDb()` in `colitis-app/src/features/knowledge/db/testDb.ts` (liest alle SQL-Migrationsdateien aus `drizzle/` ein, gleiches Muster wie `src/features/toilets/db/testDb.ts`)

- [ ] **Step 1: Neue Tabelle in `schema.ts` ergänzen**

In `colitis-app/src/db/schema.ts`, füge nach dem bestehenden `knowledgeContent`-Block (Zeile 60-66) folgenden neuen Block ein:

```typescript
export const knowledgeFavorites = sqliteTable('knowledge_favorites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  articleSlug: text('article_slug').notNull().unique(),
});
```

Die Datei sieht an dieser Stelle danach so aus:

```typescript
export const knowledgeContent = sqliteTable('knowledge_content', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  sources: text('sources').notNull(),
});

export const knowledgeFavorites = sqliteTable('knowledge_favorites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  articleSlug: text('article_slug').notNull().unique(),
});

export const screeningReminders = sqliteTable('screening_reminders', {
```

- [ ] **Step 2: Migration generieren**

Run (aus `colitis-app/`): `npx.cmd drizzle-kit generate`

Expected: Eine neue SQL-Datei erscheint in `colitis-app/drizzle/` (Name wird von drizzle-kit automatisch vergeben, z. B. `0004_<zufälliger-name>.sql`) mit genau einem `CREATE TABLE "knowledge_favorites" (...)`-Statement. `colitis-app/drizzle/meta/_journal.json` bekommt einen neuen Eintrag, eine neue `000X_snapshot.json` erscheint in `colitis-app/drizzle/meta/`, und `colitis-app/drizzle/migrations.js` wird automatisch um den neuen Import/Eintrag erweitert (gleiche Struktur wie die vier bestehenden Einträge `m0000`–`m0003`).

Prüfe die neu generierte SQL-Datei: sie darf ausschließlich die neue Tabelle anlegen, keine bestehende Tabelle verändern.

- [ ] **Step 3: Type-Check nach der Migration**

Run: `npx.cmd tsc --noEmit --pretty false`
Expected: Keine Fehler.

- [ ] **Step 4: Gemeinsames Test-DB-Setup für das Wissen-Feature erstellen**

Create `colitis-app/src/features/knowledge/db/testDb.ts`:

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

Dies ist bewusst eine neue, eigene Datei (nicht die bestehende Inline-Hilfsfunktion in `knowledgeRepository.test.ts`, die nur Migration `0000` lädt) – die neue Tabelle liegt in einer späteren Migration, daher müssen alle Migrationsdateien dynamisch eingelesen werden, wie es `src/features/toilets/db/testDb.ts` und `src/features/backup/db/testDb.ts` bereits tun.

- [ ] **Step 5: Write the failing test for das Favoriten-Repository**

Create `colitis-app/src/features/knowledge/db/knowledgeFavoritesRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { listFavoriteSlugs, addFavorite, removeFavorite } from './knowledgeFavoritesRepository';

describe('knowledge favorites repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns an empty list when nothing is favorited', async () => {
    expect(await listFavoriteSlugs(db)).toEqual([]);
  });

  it('adds a favorite and finds it in the list', async () => {
    await addFavorite(db, 'ueberblick');
    expect(await listFavoriteSlugs(db)).toEqual(['ueberblick']);
  });

  it('adding the same favorite twice does not throw and does not duplicate', async () => {
    await addFavorite(db, 'ueberblick');
    await expect(addFavorite(db, 'ueberblick')).resolves.not.toThrow();
    expect(await listFavoriteSlugs(db)).toEqual(['ueberblick']);
  });

  it('removes a favorite', async () => {
    await addFavorite(db, 'ueberblick');
    await removeFavorite(db, 'ueberblick');
    expect(await listFavoriteSlugs(db)).toEqual([]);
  });

  it('removing a favorite that does not exist does not throw', async () => {
    await expect(removeFavorite(db, 'nicht-vorhanden')).resolves.not.toThrow();
  });

  it('lists multiple favorites', async () => {
    await addFavorite(db, 'ueberblick');
    await addFavorite(db, 'ernaehrung');
    const slugs = await listFavoriteSlugs(db);
    expect(slugs.sort()).toEqual(['ernaehrung', 'ueberblick'].sort());
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx.cmd vitest run colitis-app/src/features/knowledge/db/knowledgeFavoritesRepository.test.ts`
Expected: FAIL — `knowledgeFavoritesRepository.ts` does not exist yet (module not found).

- [ ] **Step 7: Write the implementation**

Create `colitis-app/src/features/knowledge/db/knowledgeFavoritesRepository.ts`:

```typescript
import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { knowledgeFavorites } from '../../../db/schema';
import * as schema from '../../../db/schema';

export type KnowledgeFavoritesDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function listFavoriteSlugs(db: KnowledgeFavoritesDb): Promise<string[]> {
  const rows = await db.select().from(knowledgeFavorites);
  return rows.map((row) => row.articleSlug);
}

export async function addFavorite(db: KnowledgeFavoritesDb, articleSlug: string): Promise<void> {
  await db.insert(knowledgeFavorites).values({ articleSlug }).onConflictDoNothing();
}

export async function removeFavorite(db: KnowledgeFavoritesDb, articleSlug: string): Promise<void> {
  await db.delete(knowledgeFavorites).where(eq(knowledgeFavorites.articleSlug, articleSlug));
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx.cmd vitest run colitis-app/src/features/knowledge/db/knowledgeFavoritesRepository.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 9: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün (inkl. `knowledgeRepository.test.ts`, das von dieser Migration unberührt bleibt), keine neuen Typfehler.

- [ ] **Step 10: Commit**

```bash
git add colitis-app/src/db/schema.ts colitis-app/drizzle colitis-app/src/features/knowledge/db/testDb.ts colitis-app/src/features/knowledge/db/knowledgeFavoritesRepository.ts colitis-app/src/features/knowledge/db/knowledgeFavoritesRepository.test.ts
git commit -m "feat: Schema-Migration und Repository fuer Wissen-Favoriten"
```

---

### Task 2: Filterlogik für Favoriten

**Files:**
- Modify: `colitis-app/src/features/knowledge/search.ts`
- Modify: `colitis-app/src/features/knowledge/search.test.ts`

**Interfaces:**
- Consumes: `KnowledgeArticle` aus `./types` (bereits vorhanden).
- Produces (für Task 5):
  - `export function filterFavoriteArticles(articles: KnowledgeArticle[], favoriteSlugs: Set<string>): KnowledgeArticle[]`

- [ ] **Step 1: Write the failing test**

In `colitis-app/src/features/knowledge/search.test.ts`, füge nach dem bestehenden `import`-Block (Zeile 1-3) einen weiteren Import hinzu und ergänze eine neue `describe`-Sektion am Dateiende:

```typescript
import { describe, it, expect } from 'vitest';
import { filterKnowledgeArticles, filterFavoriteArticles } from './search';
import type { KnowledgeArticle } from './types';
```

Am Ende der Datei (nach dem bestehenden `describe('filterKnowledgeArticles', ...)`-Block) ergänzen:

```typescript
describe('filterFavoriteArticles', () => {
  it('returns an empty array when no slugs are favorited', () => {
    expect(filterFavoriteArticles(articles, new Set())).toEqual([]);
  });

  it('returns only the favorited article among several', () => {
    expect(filterFavoriteArticles(articles, new Set(['b']))).toEqual([articles[1]]);
  });

  it('preserves the original article order', () => {
    expect(filterFavoriteArticles(articles, new Set(['b', 'a']))).toEqual([articles[0], articles[1]]);
  });

  it('ignores favorite slugs that do not match any article', () => {
    expect(filterFavoriteArticles(articles, new Set(['nicht-vorhanden']))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run colitis-app/src/features/knowledge/search.test.ts`
Expected: FAIL — `filterFavoriteArticles` is not exported from `./search`.

- [ ] **Step 3: Write minimal implementation**

In `colitis-app/src/features/knowledge/search.ts`, ergänze nach der bestehenden `filterKnowledgeArticles`-Funktion:

```typescript
export function filterFavoriteArticles(articles: KnowledgeArticle[], favoriteSlugs: Set<string>): KnowledgeArticle[] {
  return articles.filter((article) => favoriteSlugs.has(article.slug));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd vitest run colitis-app/src/features/knowledge/search.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün.

- [ ] **Step 6: Commit**

```bash
git add colitis-app/src/features/knowledge/search.ts colitis-app/src/features/knowledge/search.test.ts
git commit -m "feat: Filterfunktion fuer Favoriten-Artikel ergaenzen"
```

---

### Task 3: Backup-Integration

**Files:**
- Modify: `colitis-app/src/features/backup/types.ts`
- Modify: `colitis-app/src/features/backup/db/backupRepository.ts`
- Modify: `colitis-app/src/features/backup/backupSerializer.ts`
- Modify: `colitis-app/src/features/backup/db/backupRepository.test.ts`
- Modify: `colitis-app/src/features/backup/backupSerializer.test.ts`

**Interfaces:**
- Consumes: `knowledgeFavorites` Tabelle aus `../../db/schema` (Task 1).
- Produces: Nichts für weitere Tasks (Task 4/5 hängen nicht vom Backup-System ab).

Diese Aufgabe erweitert ein bestehendes, testabgedecktes System um eine achte Tabelle. Da `BackupData['tables']` als Objekt-Typ jedes Feld als Pflichtfeld führt, brechen alle bestehenden Test-Literale, die ein vollständiges `tables: {...}`-Objekt konstruieren, ohne die Ergänzung – das ist erwartet und wird in dieser Aufgabe direkt mit behoben (kein separater Nacharbeits-Schritt nötig).

- [ ] **Step 1: `BackupData`-Typ erweitern**

In `colitis-app/src/features/backup/types.ts`, ändere:

```typescript
import type { diaryEntries, medicationLog, medicationReminderTimes, medications, savedPlaces, screeningReminders, triggers } from '../../db/schema';

export const BACKUP_FORMAT_VERSION = 1;

export interface BackupData {
  version: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  tables: {
    diaryEntries: (typeof diaryEntries.$inferSelect)[];
    triggers: (typeof triggers.$inferSelect)[];
    medications: (typeof medications.$inferSelect)[];
    medicationLog: (typeof medicationLog.$inferSelect)[];
    medicationReminderTimes: (typeof medicationReminderTimes.$inferSelect)[];
    savedPlaces: (typeof savedPlaces.$inferSelect)[];
    screeningReminders: (typeof screeningReminders.$inferSelect)[];
  };
}
```

zu:

```typescript
import type { diaryEntries, knowledgeFavorites, medicationLog, medicationReminderTimes, medications, savedPlaces, screeningReminders, triggers } from '../../db/schema';

export const BACKUP_FORMAT_VERSION = 1;

export interface BackupData {
  version: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  tables: {
    diaryEntries: (typeof diaryEntries.$inferSelect)[];
    triggers: (typeof triggers.$inferSelect)[];
    medications: (typeof medications.$inferSelect)[];
    medicationLog: (typeof medicationLog.$inferSelect)[];
    medicationReminderTimes: (typeof medicationReminderTimes.$inferSelect)[];
    savedPlaces: (typeof savedPlaces.$inferSelect)[];
    screeningReminders: (typeof screeningReminders.$inferSelect)[];
    knowledgeFavorites: (typeof knowledgeFavorites.$inferSelect)[];
  };
}
```

(Die `BackupEnvelope`-Schnittstelle weiter unten in der Datei bleibt unverändert.)

- [ ] **Step 2: `backupRepository.ts` erweitern**

In `colitis-app/src/features/backup/db/backupRepository.ts`, ändere den Import (Zeile 2-10):

```typescript
import {
  diaryEntries,
  medicationLog,
  medicationReminderTimes,
  medications,
  savedPlaces,
  screeningReminders,
  triggers,
} from '../../../db/schema';
```

zu:

```typescript
import {
  diaryEntries,
  knowledgeFavorites,
  medicationLog,
  medicationReminderTimes,
  medications,
  savedPlaces,
  screeningReminders,
  triggers,
} from '../../../db/schema';
```

In `exportBackupData`, ergänze in `tables: {...}` (nach `screeningReminders`):

```typescript
      savedPlaces: await db.select().from(savedPlaces),
      screeningReminders: await db.select().from(screeningReminders),
      knowledgeFavorites: await db.select().from(knowledgeFavorites),
```

In `importBackupData`, ergänze im Lösch-Block (nach `tx.delete(screeningReminders).run();`):

```typescript
    tx.delete(savedPlaces).run();
    tx.delete(screeningReminders).run();
    tx.delete(knowledgeFavorites).run();
```

und im Einfüge-Block (nach der `screeningReminders`-Schleife, vor der `triggers`-Schleife – Reihenfolge ist unkritisch, da `knowledgeFavorites` keine Fremdschlüssel-Beziehung hat):

```typescript
    for (const row of data.tables.screeningReminders) {
      tx.insert(screeningReminders).values(row).run();
    }
    for (const row of data.tables.knowledgeFavorites) {
      tx.insert(knowledgeFavorites).values(row).run();
    }
```

- [ ] **Step 3: `backupSerializer.ts` erweitern**

In `colitis-app/src/features/backup/backupSerializer.ts`, ändere `REQUIRED_TABLE_KEYS` (Zeile 7-15):

```typescript
const REQUIRED_TABLE_KEYS = [
  'diaryEntries',
  'triggers',
  'medications',
  'medicationLog',
  'medicationReminderTimes',
  'savedPlaces',
  'screeningReminders',
] as const;
```

zu:

```typescript
const REQUIRED_TABLE_KEYS = [
  'diaryEntries',
  'triggers',
  'medications',
  'medicationLog',
  'medicationReminderTimes',
  'savedPlaces',
  'screeningReminders',
  'knowledgeFavorites',
] as const;
```

- [ ] **Step 4: Type-Check nach den Schnittstellen-Änderungen**

Run: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Fehler in `backupRepository.test.ts` und `backupSerializer.test.ts` (fehlendes `knowledgeFavorites`-Feld in bestehenden `tables: {...}`-Objekt-Literalen) – das wird in den nächsten beiden Schritten behoben.

- [ ] **Step 5: Bestehende Tests in `backupRepository.test.ts` aktualisieren und einen neuen Test ergänzen**

In `colitis-app/src/features/backup/db/backupRepository.test.ts`, ergänze in **jedem** der fünf bestehenden `tables: {...}`-Objekt-Literale (in den Tests `'exports an empty structure...'`, `'replaces all existing data...'`, `'preserves foreign key relationships...'`, `'clears all data...'`, `'does not violate foreign key constraints...'`) nach der Zeile `screeningReminders: [],` (bzw. `screeningReminders: []` im letzten Fall vor der schließenden Klammer) die Zeile:

```typescript
        knowledgeFavorites: [],
```

Beispiel für den ersten Test (Zeile 13-25), vorher:

```typescript
  it('exports an empty structure with all seven table keys when nothing exists yet', async () => {
    const data = await exportBackupData(db);
    expect(data.version).toBe(1);
    expect(data.tables).toEqual({
      diaryEntries: [],
      triggers: [],
      medications: [],
      medicationLog: [],
      medicationReminderTimes: [],
      savedPlaces: [],
      screeningReminders: [],
    });
  });
```

nachher:

```typescript
  it('exports an empty structure with all eight table keys when nothing exists yet', async () => {
    const data = await exportBackupData(db);
    expect(data.version).toBe(1);
    expect(data.tables).toEqual({
      diaryEntries: [],
      triggers: [],
      medications: [],
      medicationLog: [],
      medicationReminderTimes: [],
      savedPlaces: [],
      screeningReminders: [],
      knowledgeFavorites: [],
    });
  });
```

Wende die gleiche Ergänzung (`knowledgeFavorites: [],` nach `screeningReminders: [],`) in den vier weiteren Tests an, die jeweils ein `tables: {...}`-Literal mit denselben sieben Schlüsseln enthalten.

Ergänze außerdem am Ende der Datei (vor der letzten schließenden `});` des `describe`-Blocks) einen neuen Test:

```typescript

  it('exports and re-imports knowledge favorites, preserving original ids', async () => {
    const importedData = {
      version: 1 as const,
      exportedAt: '2026-07-22T09:00:00.000Z',
      tables: {
        diaryEntries: [],
        triggers: [],
        medications: [],
        medicationLog: [],
        medicationReminderTimes: [],
        savedPlaces: [],
        screeningReminders: [],
        knowledgeFavorites: [{ id: 3, articleSlug: 'ueberblick' }],
      },
    };

    await importBackupData(db, importedData);

    const data = await exportBackupData(db);
    expect(data.tables.knowledgeFavorites).toEqual(importedData.tables.knowledgeFavorites);
  });
```

- [ ] **Step 6: Bestehende Tests in `backupSerializer.test.ts` aktualisieren und einen neuen Test ergänzen**

In `colitis-app/src/features/backup/backupSerializer.test.ts`, ändere `sampleData` (Zeile 5-17):

```typescript
const sampleData: BackupData = {
  version: 1,
  exportedAt: '2026-07-14T10:00:00.000Z',
  tables: {
    diaryEntries: [],
    triggers: [],
    medications: [],
    medicationLog: [],
    medicationReminderTimes: [],
    savedPlaces: [],
    screeningReminders: [],
  },
};
```

zu:

```typescript
const sampleData: BackupData = {
  version: 1,
  exportedAt: '2026-07-14T10:00:00.000Z',
  tables: {
    diaryEntries: [],
    triggers: [],
    medications: [],
    medicationLog: [],
    medicationReminderTimes: [],
    savedPlaces: [],
    screeningReminders: [],
    knowledgeFavorites: [],
  },
};
```

Ergänze am Ende der Datei (vor der letzten schließenden `});` des `describe`-Blocks) einen neuen Test:

```typescript

  it('throws a German error when the knowledgeFavorites table key is missing', () => {
    const broken = JSON.parse(serializeBackupData(sampleData));
    delete broken.tables.knowledgeFavorites;
    expect(() => parseBackupData(JSON.stringify(broken))).toThrow('Sicherungsdatei ist kein gültiges Format.');
  });
```

- [ ] **Step 7: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle Tests grün, keine Typfehler.

- [ ] **Step 8: Commit**

```bash
git add colitis-app/src/features/backup/types.ts colitis-app/src/features/backup/db/backupRepository.ts colitis-app/src/features/backup/backupSerializer.ts colitis-app/src/features/backup/db/backupRepository.test.ts colitis-app/src/features/backup/backupSerializer.test.ts
git commit -m "feat: Wissen-Favoriten ins Backup/Restore-System aufnehmen"
```

---

### Task 4: Favoriten-Button auf der Artikel-Detailseite

**Files:**
- Modify: `colitis-app/src/features/knowledge/components/KnowledgeArticleDetail.tsx`
- Modify: `colitis-app/app/(tabs)/wissen/[slug].tsx`

**Interfaces:**
- Consumes: `listFavoriteSlugs`, `addFavorite`, `removeFavorite` aus `../../../src/features/knowledge/db/knowledgeFavoritesRepository` (Task 1).
- Produces: Nichts für weitere Tasks (Task 5 ist unabhängig, betrifft nur die Listenseite).

Diese Aufgabe ändert bestehende UI-Dateien (keine neue Logik) – nicht automatisiert testbar, gleiches Muster wie bisherige UI-Erweiterungen in diesem Projekt. Verifikation über `tsc --noEmit` und manuellen Test in Schritt 3.

- [ ] **Step 1: `KnowledgeArticleDetail.tsx` um Favoriten-Button erweitern**

Ersetze den vollständigen Inhalt von `colitis-app/src/features/knowledge/components/KnowledgeArticleDetail.tsx` mit:

```typescript
import { Linking, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { KnowledgeArticle } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface KnowledgeArticleDetailProps {
  article: KnowledgeArticle;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export function KnowledgeArticleDetail({ article, isFavorite, onToggleFavorite }: KnowledgeArticleDetailProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const paragraphs = article.body.split('\n\n');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
        accessibilityState={{ selected: isFavorite }}
        style={styles.favoriteButton}
        onPress={onToggleFavorite}
      >
        <Text style={styles.favoriteButtonText}>{isFavorite ? '★ Favorit' : '☆ Favorit'}</Text>
      </Pressable>
      <Text style={styles.title}>{article.title}</Text>
      {paragraphs.map((paragraph, index) => (
        <Text key={index} style={styles.paragraph}>
          {paragraph}
        </Text>
      ))}
      <View style={styles.sourcesSection}>
        <Text style={styles.sourcesHeading}>Quellen</Text>
        {article.sources.map((source) => (
          <Pressable
            key={source}
            accessibilityRole="link"
            accessibilityLabel={`Quelle öffnen: ${source}`}
            onPress={() => Linking.openURL(source)}
          >
            <Text style={styles.sourceLink}>{source}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: tokens.spacing.lg,
    },
    favoriteButton: {
      alignSelf: 'flex-start',
      marginBottom: tokens.spacing.sm,
    },
    favoriteButtonText: {
      color: colors.accent,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    title: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.xl,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.md,
    },
    paragraph: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      marginBottom: tokens.spacing.md,
      lineHeight: 24,
    },
    sourcesSection: {
      marginTop: tokens.spacing.lg,
      paddingTop: tokens.spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    sourcesHeading: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.sm,
    },
    sourceLink: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
  });
}
```

- [ ] **Step 2: `[slug].tsx` um Favoriten-Status erweitern**

Ersetze den vollständigen Inhalt von `colitis-app/app/(tabs)/wissen/[slug].tsx` mit:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { getKnowledgeArticleBySlug } from '../../../src/features/knowledge/db/knowledgeRepository';
import { listFavoriteSlugs, addFavorite, removeFavorite } from '../../../src/features/knowledge/db/knowledgeFavoritesRepository';
import { KnowledgeArticleDetail } from '../../../src/features/knowledge/components/KnowledgeArticleDetail';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { KnowledgeArticle } from '../../../src/features/knowledge/types';
import type { ThemeColors } from '../../../src/theme/types';

export default function ArtikelScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then(async (db) => {
          const [loadedArticle, favoriteSlugs] = await Promise.all([
            getKnowledgeArticleBySlug(db, slug),
            listFavoriteSlugs(db),
          ]);
          return { loadedArticle, favoriteSlugs };
        })
        .then(({ loadedArticle, favoriteSlugs }) => {
          if (isActive) {
            setArticle(loadedArticle);
            setIsFavorite(favoriteSlugs.includes(slug));
            setError(loadedArticle ? null : 'Artikel wurde nicht gefunden.');
          }
        })
        .catch((loadError: unknown) => {
          console.error('[Wissen] Laden des Artikels fehlgeschlagen:', loadError);
          if (isActive) {
            setError('Artikel konnte nicht geladen werden.');
          }
        });

      return () => {
        isActive = false;
      };
    }, [slug])
  );

  async function handleToggleFavorite() {
    const db = await createEncryptedDb();
    if (isFavorite) {
      await removeFavorite(db, slug);
      setIsFavorite(false);
    } else {
      await addFavorite(db, slug);
      setIsFavorite(true);
    }
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Artikel wird geladen …</Text>
      </View>
    );
  }

  return <KnowledgeArticleDetail article={article} isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} />;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.md,
      textAlign: 'center',
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
    },
  });
}
```

- [ ] **Step 3: Type-Check und volle Test-Suite**

Run: `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run` (aus `colitis-app/`)
Expected: Keine Fehler, alle bestehenden Tests weiterhin grün.

- [ ] **Step 4: Commit**

```bash
git add colitis-app/src/features/knowledge/components/KnowledgeArticleDetail.tsx "colitis-app/app/(tabs)/wissen/[slug].tsx"
git commit -m "feat: Favoriten-Button auf Artikel-Detailseite ergaenzen"
```

---

### Task 5: Filter-Umschalter "Alle"/"Favoriten" in der Übersichtsliste

**Files:**
- Modify: `colitis-app/src/features/knowledge/components/KnowledgeArticleList.tsx`
- Modify: `colitis-app/app/(tabs)/wissen/index.tsx`

**Interfaces:**
- Consumes: `listFavoriteSlugs` aus `../../../src/features/knowledge/db/knowledgeFavoritesRepository` (Task 1), `filterFavoriteArticles` aus `../../../src/features/knowledge/search` (Task 2).
- Produces: Nichts für weitere Tasks — letzte Aufgabe dieses Plans.

Diese Aufgabe ändert bestehende UI-Dateien (keine neue Logik) – nicht automatisiert testbar. Verifikation über `tsc --noEmit` und manuellen Test.

- [ ] **Step 1: `KnowledgeArticleList.tsx` um `emptyMessage`-Prop erweitern**

Ersetze den vollständigen Inhalt von `colitis-app/src/features/knowledge/components/KnowledgeArticleList.tsx` mit:

```typescript
import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';
import { tokens } from '../../../styles/tokens';
import type { KnowledgeArticle } from '../types';
import type { ThemeColors } from '../../../theme/types';

interface KnowledgeArticleListProps {
  articles: KnowledgeArticle[];
  onSelect: (slug: string) => void;
  emptyMessage?: string;
}

const DEFAULT_EMPTY_MESSAGE = 'Keine Artikel gefunden.';

function teaserFor(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > 100 ? `${trimmed.slice(0, 100)}…` : trimmed;
}

export function KnowledgeArticleList({ articles, onSelect, emptyMessage = DEFAULT_EMPTY_MESSAGE }: KnowledgeArticleListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  if (articles.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={articles}
      keyExtractor={(article) => article.slug}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Artikel: ${item.title}`}
          style={styles.card}
          onPress={() => onSelect(item.slug)}
        >
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardTeaser}>{teaserFor(item.body)}</Text>
        </Pressable>
      )}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      padding: tokens.spacing.lg,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: tokens.spacing.md,
      marginBottom: tokens.spacing.md,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      marginBottom: tokens.spacing.xs,
    },
    cardTeaser: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
    },
  });
}
```

- [ ] **Step 2: `wissen/index.tsx` um Favoriten-Filter erweitern**

Ersetze den vollständigen Inhalt von `colitis-app/app/(tabs)/wissen/index.tsx` mit:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { seedKnowledgeArticles, listKnowledgeArticles } from '../../../src/features/knowledge/db/knowledgeRepository';
import { listFavoriteSlugs } from '../../../src/features/knowledge/db/knowledgeFavoritesRepository';
import { filterKnowledgeArticles, filterFavoriteArticles } from '../../../src/features/knowledge/search';
import { KnowledgeArticleList } from '../../../src/features/knowledge/components/KnowledgeArticleList';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { KnowledgeArticle } from '../../../src/features/knowledge/types';
import type { ThemeColors } from '../../../src/theme/types';

type ViewFilter = 'all' | 'favorites';

export default function WissenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [favoriteSlugs, setFavoriteSlugs] = useState<Set<string>>(new Set());
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
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
          const [loadedArticles, loadedFavoriteSlugs] = await Promise.all([
            listKnowledgeArticles(db),
            listFavoriteSlugs(db),
          ]);
          return { loadedArticles, loadedFavoriteSlugs };
        })
        .then(({ loadedArticles, loadedFavoriteSlugs }) => {
          if (isActive) {
            setArticles(loadedArticles);
            setFavoriteSlugs(new Set(loadedFavoriteSlugs));
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

  const searchedArticles = filterKnowledgeArticles(articles, query);
  const visibleArticles =
    viewFilter === 'favorites' ? filterFavoriteArticles(searchedArticles, favoriteSlugs) : searchedArticles;

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
      <View style={styles.viewToggleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: viewFilter === 'all' }}
          style={[styles.viewToggleButton, viewFilter === 'all' && styles.viewToggleButtonActive]}
          onPress={() => setViewFilter('all')}
        >
          <Text style={[styles.viewToggleButtonText, viewFilter === 'all' && styles.viewToggleButtonTextActive]}>
            Alle
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: viewFilter === 'favorites' }}
          style={[styles.viewToggleButton, viewFilter === 'favorites' && styles.viewToggleButtonActive]}
          onPress={() => setViewFilter('favorites')}
        >
          <Text
            style={[styles.viewToggleButtonText, viewFilter === 'favorites' && styles.viewToggleButtonTextActive]}
          >
            Favoriten
          </Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.searchInput}
        placeholder="Artikel durchsuchen …"
        placeholderTextColor={colors.textSecondary}
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
          emptyMessage={viewFilter === 'favorites' ? 'Noch keine Favoriten markiert.' : undefined}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    errorBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.danger,
      padding: tokens.spacing.sm,
    },
    errorText: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
    },
    newsLink: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: tokens.spacing.md,
    },
    newsLinkText: {
      color: colors.primary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
    viewToggleRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    viewToggleButton: {
      flex: 1,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    viewToggleButtonActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    viewToggleButtonText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
    viewToggleButtonTextActive: {
      color: colors.primary,
    },
    searchInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      margin: tokens.spacing.md,
      padding: tokens.spacing.sm,
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.md,
    },
  });
}
```

- [ ] **Step 3: Type-Check und volle Test-Suite**

Run: `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run` (aus `colitis-app/`)
Expected: Keine Fehler, alle bestehenden Tests weiterhin grün.

- [ ] **Step 4: Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build)**

- Wissen-Tab öffnen, Artikel antippen → Stern-Button "☆ Favorit" oben sichtbar.
- Stern antippen → wechselt zu "★ Favorit", zurück zur Liste navigieren.
- Filter-Umschalter "Favoriten" antippen → nur der markierte Artikel erscheint.
- Denselben Artikel erneut öffnen, Favorit wieder entfernen → Filter "Favoriten" zeigt "Noch keine Favoriten markiert."
- Filter "Favoriten" mit der Suche kombinieren (z. B. mehrere Favoriten markieren, dann nach einem Begriff suchen, der nur in einem davon vorkommt) → nur Treffer, die beide Kriterien erfüllen.
- Backup exportieren, Favoriten ändern, Backup wieder importieren → ursprünglicher Favoriten-Stand ist wiederhergestellt.
- Alle drei Themes (Standard, Dunkel, Blau-Weiß) durchschalten und Stern-Button sowie Umschalter auf Lesbarkeit prüfen.

- [ ] **Step 5: Commit**

```bash
git add colitis-app/src/features/knowledge/components/KnowledgeArticleList.tsx "colitis-app/app/(tabs)/wissen/index.tsx"
git commit -m "feat: Favoriten-Filter in Wissen-Uebersichtsliste verdrahten"
```
