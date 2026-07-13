# Toiletten-Finder Teil B – Sichere Orte, Offline-Fallback & Schnellzugriff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adrian kann auf der Toiletten-Karte eigene "sichere Orte" anlegen/bearbeiten/löschen, sieht bei fehlendem Netz weiterhin die zuletzt geladenen Toiletten, und kann per Android-Homescreen-Shortcut mit einem Tap zur nächstgelegenen Toilette oder zum nächsten sicheren Ort navigieren.

**Architecture:** Erweitert das bestehende Feature-Modul `src/features/toilets/` (aus Teil A) um sichere-Orte-Domäne, ein `cached_toilets`-Tabellen-Repository und eine erweiterte Leaflet-Bridge (Long-Press, zweite Marker-Art). Der Schnellzugriff läuft über einen eigenen, lokalen Expo-Config-Plugin (`plugins/withNearestToiletShortcut.js`) plus einen neuen Standalone-Screen `app/schnellzugriff.tsx` außerhalb der Tabs.

**Tech Stack:** TypeScript, React Native/Expo Router, Drizzle ORM, Vitest, better-sqlite3 (Tests), `expo/config-plugins` (bereits über die `expo`-Abhängigkeit verfügbar, kein neues Paket), Leaflet.js (bereits vorhanden aus Teil A).

## Global Constraints

- Alle Daten bleiben 100% lokal (verschlüsselte SQLite-DB `cached_toilets`/`saved_places`), keine Cloud-Übertragung — auch reine Toiletten-Standorte nicht, da sie in Kombination mit Zeitstempeln Rückschlüsse auf Aufenthaltsorte erlauben könnten.
- Kein `AsyncStorage` oder sonstiger unverschlüsselter Gerätespeicher für den Offline-Cache — ausschließlich die bestehende verschlüsselte SQLCipher-DB über `src/db/client.ts`.
- UI-Sprache: Deutsch, durchgehend.
- Design-Ton: ruhig/warm — ausschließlich `tokens.*`-Werte aus `src/styles/tokens.ts`. Sichere-Orte-Marker nutzen `tokens.colors.primary` (`#5B8C7B`), keine neue Akzentfarbe.
- Für den Schnellzugriff **kein Drittanbieter-Paket** (`expo-quick-actions` wurde geprüft und verworfen — SDK-57-Kompatibilität unbestätigt, erfordert nativen Build). Stattdessen ein selbst geschriebener, lokaler Expo-Config-Plugin ohne neue npm-Abhängigkeit.
- Schnellzugriff-Screen führt **keinen** Live-Overpass-Abruf aus — ausschließlich `cached_toilets` (aus der letzten erfolgreichen Suche im Toiletten-Tab) plus `saved_places`, damit der Screen auch offline sofort reagiert.
- Wiederverwendung bestehender Bausteine aus Teil A statt Neubau: `haversineDistanceMeters` (`src/features/toilets/distance.ts`), `buildNavigationUrl` (`src/features/toilets/navigationLink.ts`), `SEARCH_RADIUS_METERS`/`REGION_CHANGE_THRESHOLD_METERS` (`src/features/toilets/constants.ts`).
- React Native/WebView-Bridge-Code, das Config-Plugin und natives Android-Verhalten sind wie in allen bisherigen Schritten nicht sinnvoll automatisiert testbar (bestätigte Einschränkung) — Verifikation über sorgfältiges Lesen, `tsc --noEmit`, und den späteren manuellen Alltagstest (Schritt 8), inklusive explizit: Shortcut vom Homescreen antippen und beobachten, ob die richtige Route geöffnet wird.
- Reine Logik (Kandidaten-Auswahl, Formular-Validierung) und Repository-CRUD (echte temporäre SQLite-DB, Muster aus `src/features/medications/db/testDb.ts`) werden vollständig mit Vitest getestet.
- `AGENTS.md` im Projekt weist darauf hin, dass sich Expo-APIs zwischen Versionen stark ändern. Für dieses Plan-Dokument bereits verifiziert und verbindlich zu verwenden: `Location.requestForegroundPermissionsAsync()`/`Location.getCurrentPositionAsync()` (identisch zur bestehenden Verwendung in `app/(tabs)/toiletten/index.tsx`), Leaflets eingebauter `contextmenu`-Event für Long-Press auf Touch-Geräten (kein zusätzliches Plugin nötig, liefert `e.latlng.lat`/`e.latlng.lng`), sowie die `expo/config-plugins`-Exports `withAndroidManifest`, `withStringsXml`, `withDangerousMod`, `AndroidConfig.Manifest.getMainActivityOrThrow`, `AndroidConfig.Strings.setStringItem` (alle gegen den `expo`-Paket-Quellcode auf GitHub verifiziert, Stand dieses Plans).

---

### Task 1: Domain-Typen + reine Logik (sichere Orte, Kandidaten-Auswahl, Bridge-Nachrichten)

**Files:**
- Modify: `colitis-app/src/features/toilets/types.ts`
- Create: `colitis-app/src/features/toilets/savedPlaceFormLogic.ts`
- Test: `colitis-app/src/features/toilets/savedPlaceFormLogic.test.ts`
- Create: `colitis-app/src/features/toilets/nearestCandidate.ts`
- Test: `colitis-app/src/features/toilets/nearestCandidate.test.ts`

**Interfaces:**
- Consumes: `Coordinates`, `Toilet` (bereits in `types.ts` aus Teil A), `haversineDistanceMeters(a: Coordinates, b: Coordinates): number` aus `./distance`.
- Produces: `SavedPlace`, `SavedPlaceInput` (in `types.ts`, erweitertes `WebViewToNativeMessage` mit `markerTap`-`kind`-Feld und neuem `longPress`-Typ); `CATEGORY_SUGGESTIONS`, `SavedPlaceFormState`, `INITIAL_SAVED_PLACE_FORM_STATE`, `validateSavedPlaceForm(state): string[]`, `buildSavedPlaceInput(state, coordinates): SavedPlaceInput` (in `savedPlaceFormLogic.ts`); `Candidate` (Typ mit `kind: 'toilet' | 'place'`, `id: string`, `latitude`, `longitude`), `findNearestCandidate(origin, toilets, places): Candidate | null` (in `nearestCandidate.ts`). Werden von Task 2 (Repository-Rückgabetypen), Task 3 (Bridge/`ToiletMapView`), Task 4 (Formular-/Infokarten-Komponenten) und Task 5/6 (Screens) verwendet.

- [ ] **Step 1: `types.ts` erweitern (keine Tests nötig — reine Typdeklarationen)**

Ersetze den Inhalt von `colitis-app/src/features/toilets/types.ts` mit:

```typescript
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Toilet {
  id: string;
  latitude: number;
  longitude: number;
  name: string | null;
  openingHours: string | null;
}

export interface SavedPlace {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  note: string | null;
  category: string;
}

export interface SavedPlaceInput {
  name: string;
  latitude: number;
  longitude: number;
  note: string | null;
  category: string;
}

export type WebViewToNativeMessage =
  | { type: 'ready' }
  | { type: 'regionChange'; latitude: number; longitude: number }
  | { type: 'markerTap'; id: string; kind: 'toilet' | 'place' }
  | { type: 'longPress'; latitude: number; longitude: number };
```

- [ ] **Step 2: Fehlschlagenden Test für `savedPlaceFormLogic.ts` schreiben**

Erstelle `colitis-app/src/features/toilets/savedPlaceFormLogic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  INITIAL_SAVED_PLACE_FORM_STATE,
  CATEGORY_SUGGESTIONS,
  validateSavedPlaceForm,
  buildSavedPlaceInput,
} from './savedPlaceFormLogic';

describe('validateSavedPlaceForm', () => {
  it('requires a name', () => {
    const errors = validateSavedPlaceForm(INITIAL_SAVED_PLACE_FORM_STATE);
    expect(errors).toContain('Bitte einen Namen eingeben.');
  });

  it('passes with a non-empty name and empty category/note', () => {
    const errors = validateSavedPlaceForm({ ...INITIAL_SAVED_PLACE_FORM_STATE, name: 'Büro' });
    expect(errors).toEqual([]);
  });

  it('rejects a name that is only whitespace', () => {
    const errors = validateSavedPlaceForm({ ...INITIAL_SAVED_PLACE_FORM_STATE, name: '   ' });
    expect(errors).toContain('Bitte einen Namen eingeben.');
  });
});

describe('CATEGORY_SUGGESTIONS', () => {
  it('offers the four agreed suggestion chips', () => {
    expect(CATEGORY_SUGGESTIONS).toEqual(['Arbeit', 'Freunde', 'Café', 'Sonstiges']);
  });
});

describe('buildSavedPlaceInput', () => {
  it('trims name/category/note and attaches the given coordinates', () => {
    const input = buildSavedPlaceInput(
      { name: '  Büro  ', category: ' Arbeit ', note: '  2. Stock  ' },
      { latitude: 52.52, longitude: 13.405 }
    );
    expect(input).toEqual({
      name: 'Büro',
      category: 'Arbeit',
      note: '2. Stock',
      latitude: 52.52,
      longitude: 13.405,
    });
  });

  it('converts an empty note to null', () => {
    const input = buildSavedPlaceInput(
      { name: 'Büro', category: 'Arbeit', note: '   ' },
      { latitude: 52.52, longitude: 13.405 }
    );
    expect(input.note).toBeNull();
  });
});
```

- [ ] **Step 3: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/toilets/savedPlaceFormLogic.test.ts`
Expected: FAIL mit "Cannot find module './savedPlaceFormLogic'"

- [ ] **Step 4: `savedPlaceFormLogic.ts` implementieren**

Erstelle `colitis-app/src/features/toilets/savedPlaceFormLogic.ts`:

```typescript
import type { Coordinates, SavedPlaceInput } from './types';

export interface SavedPlaceFormState {
  name: string;
  category: string;
  note: string;
}

export const CATEGORY_SUGGESTIONS = ['Arbeit', 'Freunde', 'Café', 'Sonstiges'] as const;

export const INITIAL_SAVED_PLACE_FORM_STATE: SavedPlaceFormState = {
  name: '',
  category: '',
  note: '',
};

export function validateSavedPlaceForm(state: SavedPlaceFormState): string[] {
  const errors: string[] = [];
  if (state.name.trim().length === 0) {
    errors.push('Bitte einen Namen eingeben.');
  }
  return errors;
}

export function buildSavedPlaceInput(state: SavedPlaceFormState, coordinates: Coordinates): SavedPlaceInput {
  const trimmedNote = state.note.trim();
  return {
    name: state.name.trim(),
    category: state.category.trim(),
    note: trimmedNote.length > 0 ? trimmedNote : null,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  };
}
```

- [ ] **Step 5: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/toilets/savedPlaceFormLogic.test.ts`
Expected: PASS (5 Tests)

- [ ] **Step 6: Fehlschlagenden Test für `nearestCandidate.ts` schreiben**

Erstelle `colitis-app/src/features/toilets/nearestCandidate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findNearestCandidate } from './nearestCandidate';
import type { Toilet, SavedPlace } from './types';

const origin = { latitude: 52.52, longitude: 13.405 };

const nearToilet: Toilet = {
  id: 'toilet-1',
  latitude: 52.521,
  longitude: 13.406,
  name: null,
  openingHours: null,
};

const farToilet: Toilet = {
  id: 'toilet-2',
  latitude: 52.6,
  longitude: 13.5,
  name: null,
  openingHours: null,
};

const nearPlace: SavedPlace = {
  id: 1,
  name: 'Büro',
  latitude: 52.5201,
  longitude: 13.4051,
  note: null,
  category: 'Arbeit',
};

describe('findNearestCandidate', () => {
  it('returns null when there are no candidates', () => {
    expect(findNearestCandidate(origin, [], [])).toBeNull();
  });

  it('picks the nearest toilet when only toilets are given', () => {
    const result = findNearestCandidate(origin, [farToilet, nearToilet], []);
    expect(result).toEqual({ kind: 'toilet', id: 'toilet-1', latitude: 52.521, longitude: 13.406 });
  });

  it('picks a saved place over a farther toilet, regardless of type', () => {
    const result = findNearestCandidate(origin, [farToilet], [nearPlace]);
    expect(result).toEqual({ kind: 'place', id: '1', latitude: 52.5201, longitude: 13.4051 });
  });

  it('picks the nearer of a close toilet and a closer saved place', () => {
    const result = findNearestCandidate(origin, [nearToilet], [nearPlace]);
    expect(result).toEqual({ kind: 'place', id: '1', latitude: 52.5201, longitude: 13.4051 });
  });
});
```

- [ ] **Step 7: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/toilets/nearestCandidate.test.ts`
Expected: FAIL mit "Cannot find module './nearestCandidate'"

- [ ] **Step 8: `nearestCandidate.ts` implementieren**

Erstelle `colitis-app/src/features/toilets/nearestCandidate.ts`:

```typescript
import { haversineDistanceMeters } from './distance';
import type { Coordinates, SavedPlace, Toilet } from './types';

export interface Candidate {
  kind: 'toilet' | 'place';
  id: string;
  latitude: number;
  longitude: number;
}

export function findNearestCandidate(origin: Coordinates, toilets: Toilet[], places: SavedPlace[]): Candidate | null {
  const candidates: Candidate[] = [
    ...toilets.map((toilet) => ({
      kind: 'toilet' as const,
      id: toilet.id,
      latitude: toilet.latitude,
      longitude: toilet.longitude,
    })),
    ...places.map((place) => ({
      kind: 'place' as const,
      id: String(place.id),
      latitude: place.latitude,
      longitude: place.longitude,
    })),
  ];

  if (candidates.length === 0) {
    return null;
  }

  let nearest = candidates[0];
  let nearestDistance = haversineDistanceMeters(origin, nearest);

  for (const candidate of candidates.slice(1)) {
    const distance = haversineDistanceMeters(origin, candidate);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}
```

- [ ] **Step 9: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/toilets/nearestCandidate.test.ts`
Expected: PASS (4 Tests)

- [ ] **Step 10: Gesamte Toiletten-Test-Suite laufen lassen (Regressionscheck für Teil A)**

Run: `cd colitis-app && npx vitest run src/features/toilets`
Expected: PASS (alle bestehenden Teil-A-Tests plus die neuen aus diesem Task)

- [ ] **Step 11: Commit**

```bash
git add src/features/toilets/types.ts src/features/toilets/savedPlaceFormLogic.ts src/features/toilets/savedPlaceFormLogic.test.ts src/features/toilets/nearestCandidate.ts src/features/toilets/nearestCandidate.test.ts
git commit -m "feat: Domain-Typen und reine Logik fuer sichere Orte und Kandidaten-Auswahl"
```

---

### Task 2: Schema-Migration + Repositories (saved_places CRUD, cached_toilets)

**Files:**
- Modify: `colitis-app/src/db/schema.ts`
- Create: `colitis-app/drizzle/0002_<generierter-name>.sql` (automatisch von `drizzle-kit generate`)
- Create: `colitis-app/src/features/toilets/db/testDb.ts`
- Create: `colitis-app/src/features/toilets/db/savedPlacesRepository.ts`
- Test: `colitis-app/src/features/toilets/db/savedPlacesRepository.test.ts`
- Create: `colitis-app/src/features/toilets/db/cachedToiletsRepository.ts`
- Test: `colitis-app/src/features/toilets/db/cachedToiletsRepository.test.ts`

**Interfaces:**
- Consumes: `SavedPlace`, `SavedPlaceInput`, `Toilet` aus `../types` (Task 1). `savedPlaces`-Tabelle existiert bereits in `schema.ts` (aus dem initialen 7-Tabellen-Schema, Migration `0000_remarkable_junta.sql`) — dieser Task fügt ausschließlich `cached_toilets` neu hinzu.
- Produces: `SavedPlacesDb`, `createSavedPlace(db, input): Promise<SavedPlace>`, `listSavedPlaces(db): Promise<SavedPlace[]>`, `updateSavedPlace(db, id, input): Promise<SavedPlace>`, `deleteSavedPlace(db, id): Promise<void>` (in `savedPlacesRepository.ts`); `ToiletsCacheDb`, `replaceCachedToilets(db, toilets: Toilet[]): Promise<void>`, `listCachedToilets(db): Promise<Toilet[]>` (in `cachedToiletsRepository.ts`). Werden von Task 5 (Toiletten-Screen) und Task 6 (Schnellzugriff-Screen) verwendet.

- [ ] **Step 1: `cached_toilets`-Tabelle zum Schema hinzufügen**

Füge in `colitis-app/src/db/schema.ts` am Ende der Datei an:

```typescript

export const cachedToilets = sqliteTable('cached_toilets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  osmId: text('osm_id').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  name: text('name'),
  openingHours: text('opening_hours'),
});
```

- [ ] **Step 2: Migration generieren**

Run: `cd colitis-app && npx drizzle-kit generate`
Expected: Neue Datei `drizzle/0002_<zwei-zufaellige-woerter>.sql` wird erstellt (enthält `CREATE TABLE cached_toilets` mit den fünf Spalten aus Step 1), zusätzlich `drizzle/meta/0002_snapshot.json`; `drizzle/meta/_journal.json` bekommt einen dritten Eintrag, `drizzle/migrations.js` wird aktualisiert.

- [ ] **Step 3: Generierte Migration verifizieren**

Öffne die neu erzeugte `drizzle/0002_*.sql` und bestätige, dass sie ausschließlich `CREATE TABLE cached_toilets (...)` enthält (keine unerwarteten `DROP`/`ALTER`-Anweisungen an bestehenden Tabellen — falls doch, ist das Schema versehentlich falsch bearbeitet worden und Step 1 muss korrigiert werden, bevor fortgefahren wird).

- [ ] **Step 4: Feature-lokale Test-DB anlegen**

Erstelle `colitis-app/src/features/toilets/db/testDb.ts` (identisches Muster zu `src/features/medications/db/testDb.ts`, liest alle Migrationen im `drizzle/`-Ordner sortiert ein):

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

- [ ] **Step 5: Fehlschlagenden Test für `savedPlacesRepository.ts` schreiben**

Erstelle `colitis-app/src/features/toilets/db/savedPlacesRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { createSavedPlace, listSavedPlaces, updateSavedPlace, deleteSavedPlace } from './savedPlacesRepository';

describe('saved places repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a saved place and returns it with an id', async () => {
    const created = await createSavedPlace(db, {
      name: 'Büro',
      latitude: 52.52,
      longitude: 13.405,
      note: '2. Stock',
      category: 'Arbeit',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe('Büro');
    expect(created.note).toBe('2. Stock');
  });

  it('lists all saved places', async () => {
    await createSavedPlace(db, {
      name: 'Büro',
      latitude: 52.52,
      longitude: 13.405,
      note: null,
      category: 'Arbeit',
    });
    await createSavedPlace(db, {
      name: 'Lieblingscafé',
      latitude: 52.53,
      longitude: 13.41,
      note: null,
      category: 'Café',
    });

    const list = await listSavedPlaces(db);
    expect(list.map((place) => place.name)).toEqual(['Büro', 'Lieblingscafé']);
  });

  it('updates an existing saved place', async () => {
    const created = await createSavedPlace(db, {
      name: 'Büro',
      latitude: 52.52,
      longitude: 13.405,
      note: null,
      category: 'Arbeit',
    });

    const updated = await updateSavedPlace(db, created.id, {
      name: 'Büro (neu)',
      latitude: 52.521,
      longitude: 13.406,
      note: 'Umgezogen',
      category: 'Arbeit',
    });

    expect(updated).toEqual({
      id: created.id,
      name: 'Büro (neu)',
      latitude: 52.521,
      longitude: 13.406,
      note: 'Umgezogen',
      category: 'Arbeit',
    });
  });

  it('deletes a saved place', async () => {
    const created = await createSavedPlace(db, {
      name: 'Büro',
      latitude: 52.52,
      longitude: 13.405,
      note: null,
      category: 'Arbeit',
    });

    await deleteSavedPlace(db, created.id);

    expect(await listSavedPlaces(db)).toEqual([]);
  });
});
```

- [ ] **Step 6: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/toilets/db/savedPlacesRepository.test.ts`
Expected: FAIL mit "Cannot find module './savedPlacesRepository'"

- [ ] **Step 7: `savedPlacesRepository.ts` implementieren**

Erstelle `colitis-app/src/features/toilets/db/savedPlacesRepository.ts`:

```typescript
import { eq, asc } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { savedPlaces } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { SavedPlace, SavedPlaceInput } from '../types';

export type SavedPlacesDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function createSavedPlace(db: SavedPlacesDb, input: SavedPlaceInput): Promise<SavedPlace> {
  const [inserted] = await db
    .insert(savedPlaces)
    .values({
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      note: input.note,
      category: input.category,
    })
    .returning({ id: savedPlaces.id });

  return { id: inserted.id, ...input };
}

export async function listSavedPlaces(db: SavedPlacesDb): Promise<SavedPlace[]> {
  const rows = await db.select().from(savedPlaces).orderBy(asc(savedPlaces.id));
  return rows.map(rowToSavedPlace);
}

export async function updateSavedPlace(
  db: SavedPlacesDb,
  id: number,
  input: SavedPlaceInput
): Promise<SavedPlace> {
  await db
    .update(savedPlaces)
    .set({
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      note: input.note,
      category: input.category,
    })
    .where(eq(savedPlaces.id, id));

  return { id, ...input };
}

export async function deleteSavedPlace(db: SavedPlacesDb, id: number): Promise<void> {
  await db.delete(savedPlaces).where(eq(savedPlaces.id, id));
}

function rowToSavedPlace(row: typeof savedPlaces.$inferSelect): SavedPlace {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    note: row.note,
    category: row.category,
  };
}
```

- [ ] **Step 8: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/toilets/db/savedPlacesRepository.test.ts`
Expected: PASS (4 Tests)

- [ ] **Step 9: Fehlschlagenden Test für `cachedToiletsRepository.ts` schreiben**

Erstelle `colitis-app/src/features/toilets/db/cachedToiletsRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import { replaceCachedToilets, listCachedToilets } from './cachedToiletsRepository';
import type { Toilet } from '../types';

const toiletA: Toilet = { id: 'osm-1', latitude: 52.52, longitude: 13.405, name: 'Bahnhof', openingHours: '24/7' };
const toiletB: Toilet = { id: 'osm-2', latitude: 52.53, longitude: 13.41, name: null, openingHours: null };

describe('cached toilets repository', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns an empty list when nothing has been cached yet', async () => {
    expect(await listCachedToilets(db)).toEqual([]);
  });

  it('stores and returns cached toilets', async () => {
    await replaceCachedToilets(db, [toiletA, toiletB]);

    const list = await listCachedToilets(db);
    expect(list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'osm-1', name: 'Bahnhof', openingHours: '24/7' }),
        expect.objectContaining({ id: 'osm-2', name: null, openingHours: null }),
      ])
    );
    expect(list).toHaveLength(2);
  });

  it('fully replaces the previous cache on the next call', async () => {
    await replaceCachedToilets(db, [toiletA]);
    await replaceCachedToilets(db, [toiletB]);

    const list = await listCachedToilets(db);
    expect(list.map((toilet) => toilet.id)).toEqual(['osm-2']);
  });

  it('clears the cache when replaced with an empty list', async () => {
    await replaceCachedToilets(db, [toiletA]);
    await replaceCachedToilets(db, []);

    expect(await listCachedToilets(db)).toEqual([]);
  });
});
```

- [ ] **Step 10: Test ausführen, Fehlschlag bestätigen**

Run: `cd colitis-app && npx vitest run src/features/toilets/db/cachedToiletsRepository.test.ts`
Expected: FAIL mit "Cannot find module './cachedToiletsRepository'"

- [ ] **Step 11: `cachedToiletsRepository.ts` implementieren**

Erstelle `colitis-app/src/features/toilets/db/cachedToiletsRepository.ts`:

```typescript
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { cachedToilets } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { Toilet } from '../types';

export type ToiletsCacheDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function replaceCachedToilets(db: ToiletsCacheDb, toilets: Toilet[]): Promise<void> {
  await db.delete(cachedToilets);
  for (const toilet of toilets) {
    await db.insert(cachedToilets).values({
      osmId: toilet.id,
      latitude: toilet.latitude,
      longitude: toilet.longitude,
      name: toilet.name,
      openingHours: toilet.openingHours,
    });
  }
}

export async function listCachedToilets(db: ToiletsCacheDb): Promise<Toilet[]> {
  const rows = await db.select().from(cachedToilets);
  return rows.map((row) => ({
    id: row.osmId,
    latitude: row.latitude,
    longitude: row.longitude,
    name: row.name,
    openingHours: row.openingHours,
  }));
}
```

- [ ] **Step 12: Test erneut ausführen, Erfolg bestätigen**

Run: `cd colitis-app && npx vitest run src/features/toilets/db/cachedToiletsRepository.test.ts`
Expected: PASS (4 Tests)

- [ ] **Step 13: Gesamte Test-Suite laufen lassen (Regressionscheck)**

Run: `cd colitis-app && npx vitest run`
Expected: PASS (alle Tests aus allen bisherigen Schritten plus die neuen aus diesem Task)

- [ ] **Step 14: Commit**

```bash
git add src/db/schema.ts drizzle/ src/features/toilets/db/testDb.ts src/features/toilets/db/savedPlacesRepository.ts src/features/toilets/db/savedPlacesRepository.test.ts src/features/toilets/db/cachedToiletsRepository.ts src/features/toilets/db/cachedToiletsRepository.test.ts
git commit -m "feat: Schema-Migration und Repositories fuer sichere Orte und Toiletten-Cache"
```

---

### Task 3: Karten-Bridge-Erweiterung (Leaflet Long-Press + sichere-Orte-Marker)

**Files:**
- Modify: `colitis-app/scripts/generate-map-html.js`
- Modify (regeneriert): `colitis-app/src/features/toilets/mapHtml.generated.ts`
- Modify: `colitis-app/src/features/toilets/components/ToiletMapView.tsx`

**Interfaces:**
- Consumes: `Coordinates`, `SavedPlace`, `Toilet`, `WebViewToNativeMessage` aus `../types` (Task 1, bereits mit `longPress` und `markerTap.kind` erweitert).
- Produces: `ToiletMapView`-Props erweitert um `savedPlaces: SavedPlace[]` und `onLongPress: (coordinates: Coordinates) => void`; `onMarkerTap`-Prop-Signatur ändert sich zu `(id: string, kind: 'toilet' | 'place') => void`. Wird von Task 5 (Toiletten-Screen) konsumiert.

- [ ] **Step 1: Bridge-Skript in `generate-map-html.js` erweitern**

Ersetze in `colitis-app/scripts/generate-map-html.js` die Konstante `bridgeScript` (Zeilen 13-47) mit:

```javascript
const bridgeScript = `
  var map = L.map('map', { zoomControl: false }).setView([51.1657, 10.4515], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap-Mitwirkende'
  }).addTo(map);

  var markers = {};
  var placeMarkers = {};

  window.setCenter = function(lat, lon) {
    map.setView([lat, lon], 15);
  };

  window.setToilets = function(toiletsJson) {
    var toilets = JSON.parse(toiletsJson);
    Object.keys(markers).forEach(function(id) {
      map.removeLayer(markers[id]);
      delete markers[id];
    });
    toilets.forEach(function(toilet) {
      var marker = L.marker([toilet.latitude, toilet.longitude]).addTo(map);
      marker.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerTap', id: toilet.id, kind: 'toilet' }));
      });
      markers[toilet.id] = marker;
    });
  };

  window.setSavedPlaces = function(placesJson) {
    var places = JSON.parse(placesJson);
    Object.keys(placeMarkers).forEach(function(id) {
      map.removeLayer(placeMarkers[id]);
      delete placeMarkers[id];
    });
    places.forEach(function(place) {
      var marker = L.circleMarker([place.latitude, place.longitude], {
        radius: 10,
        color: '#5B8C7B',
        fillColor: '#5B8C7B',
        fillOpacity: 0.9,
        weight: 2
      }).addTo(map);
      marker.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerTap', id: String(place.id), kind: 'place' }));
      });
      placeMarkers[place.id] = marker;
    });
  };

  map.on('moveend', function() {
    var center = map.getCenter();
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'regionChange', latitude: center.lat, longitude: center.lng }));
  });

  map.on('contextmenu', function(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'longPress', latitude: e.latlng.lat, longitude: e.latlng.lng }));
  });

  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
`;
```

Hinweis: Leaflets `contextmenu`-Event feuert auf Touch-Geräten automatisch bei einem einsekündigen Long-Press (eingebauter `tapHold`-Handler, kein zusätzliches Plugin nötig — siehe Global Constraints) und liefert `e.latlng` mit `lat`/`lng`.

- [ ] **Step 2: HTML neu generieren**

Run: `cd colitis-app && node scripts/generate-map-html.js`
Expected: Ausgabe `Wrote src/features/toilets/mapHtml.generated.ts`, Datei wächst geringfügig (neuer Bridge-Code).

- [ ] **Step 3: `ToiletMapView.tsx` um sichere Orte, Long-Press und `markerTap`-`kind` erweitern**

Ersetze den Inhalt von `colitis-app/src/features/toilets/components/ToiletMapView.tsx` mit:

```typescript
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { MAP_HTML } from '../mapHtml.generated';
import type { Coordinates, SavedPlace, Toilet, WebViewToNativeMessage } from '../types';

interface ToiletMapViewProps {
  center: Coordinates;
  toilets: Toilet[];
  savedPlaces: SavedPlace[];
  onRegionChange: (center: Coordinates) => void;
  onMarkerTap: (id: string, kind: 'toilet' | 'place') => void;
  onLongPress: (coordinates: Coordinates) => void;
}

export function ToiletMapView({
  center,
  toilets,
  savedPlaces,
  onRegionChange,
  onMarkerTap,
  onLongPress,
}: ToiletMapViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const isRegionChangeEchoRef = useRef(false);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (isRegionChangeEchoRef.current) {
      isRegionChangeEchoRef.current = false;
      return;
    }
    webViewRef.current?.injectJavaScript(`window.setCenter(${center.latitude}, ${center.longitude}); true;`);
  }, [isReady, center]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    webViewRef.current?.injectJavaScript(`window.setToilets(${JSON.stringify(JSON.stringify(toilets))}); true;`);
  }, [isReady, toilets]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    webViewRef.current?.injectJavaScript(`window.setSavedPlaces(${JSON.stringify(JSON.stringify(savedPlaces))}); true;`);
  }, [isReady, savedPlaces]);

  function handleMessage(event: { nativeEvent: { data: string } }) {
    let message: WebViewToNativeMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as WebViewToNativeMessage;
    } catch {
      return;
    }

    if (message.type === 'ready') {
      setIsReady(true);
    } else if (message.type === 'regionChange') {
      isRegionChangeEchoRef.current = true;
      onRegionChange({ latitude: message.latitude, longitude: message.longitude });
    } else if (message.type === 'markerTap') {
      onMarkerTap(message.id, message.kind);
    } else if (message.type === 'longPress') {
      onLongPress({ latitude: message.latitude, longitude: message.longitude });
    }
  }

  return (
    <WebView
      ref={webViewRef}
      style={styles.webview}
      source={{ html: MAP_HTML }}
      onMessage={handleMessage}
      originWhitelist={['*']}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
  },
});
```

- [ ] **Step 4: TypeScript-Check ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: Keine Fehler bezogen auf `ToiletMapView.tsx` oder `mapHtml.generated.ts`. (Es sind noch Fehler in `app/(tabs)/toiletten/index.tsx` zu erwarten, da diese Datei erst in Task 5 an die neue `ToiletMapView`-Prop-Signatur angepasst wird — das ist an dieser Stelle erwartet und kein Grund zum Anhalten.)

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-map-html.js src/features/toilets/mapHtml.generated.ts src/features/toilets/components/ToiletMapView.tsx
git commit -m "feat: Karten-Bridge um Long-Press und sichere-Orte-Marker erweitern"
```

---

### Task 4: Formular- und Infokarten-Komponenten für sichere Orte

**Files:**
- Create: `colitis-app/src/features/toilets/components/SavedPlaceForm.tsx`
- Create: `colitis-app/src/features/toilets/components/SavedPlaceInfoCard.tsx`

**Interfaces:**
- Consumes: `SavedPlaceFormState`, `INITIAL_SAVED_PLACE_FORM_STATE`, `CATEGORY_SUGGESTIONS`, `validateSavedPlaceForm`, `buildSavedPlaceInput` aus `../savedPlaceFormLogic` (Task 1); `SavedPlace`, `SavedPlaceInput`, `Coordinates` aus `../types` (Task 1); `tokens` aus `../../../styles/tokens`.
- Produces: `SavedPlaceForm` (Props: `coordinates: Coordinates`, `initialState?: SavedPlaceFormState`, `onSubmit: (input: SavedPlaceInput) => void | Promise<void>`, `onCancel: () => void`, `submitLabel: string`); `SavedPlaceInfoCard` (Props: `place: SavedPlace`, `onNavigate: () => void`, `onEdit: () => void`, `onDelete: () => void`, `onClose: () => void`). Werden von Task 5 (Toiletten-Screen) verwendet.

- [ ] **Step 1: `SavedPlaceForm.tsx` erstellen**

Erstelle `colitis-app/src/features/toilets/components/SavedPlaceForm.tsx`:

```typescript
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import {
  INITIAL_SAVED_PLACE_FORM_STATE,
  CATEGORY_SUGGESTIONS,
  validateSavedPlaceForm,
  buildSavedPlaceInput,
  type SavedPlaceFormState,
} from '../savedPlaceFormLogic';
import type { Coordinates, SavedPlaceInput } from '../types';

interface SavedPlaceFormProps {
  coordinates: Coordinates;
  initialState?: SavedPlaceFormState;
  onSubmit: (input: SavedPlaceInput) => void | Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

export function SavedPlaceForm({ coordinates, initialState, onSubmit, onCancel, submitLabel }: SavedPlaceFormProps) {
  const [formState, setFormState] = useState<SavedPlaceFormState>(initialState ?? INITIAL_SAVED_PLACE_FORM_STATE);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const validationErrors = validateSavedPlaceForm(formState);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSubmit(buildSavedPlaceInput(formState, coordinates)));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <ScrollView style={styles.card} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Sicherer Ort</Text>

        <Text style={styles.sectionLabel}>Name</Text>
        <TextInput
          style={styles.textInput}
          placeholder="z. B. Büro"
          placeholderTextColor={tokens.colors.textSecondary}
          value={formState.name}
          onChangeText={(text) => setFormState({ ...formState, name: text })}
        />

        <Text style={styles.sectionLabel}>Kategorie</Text>
        <View style={styles.chipRow}>
          {CATEGORY_SUGGESTIONS.map((suggestion) => (
            <Pressable
              key={suggestion}
              accessibilityRole="button"
              accessibilityLabel={`Kategorie ${suggestion} wählen`}
              style={[styles.chip, formState.category === suggestion && styles.chipSelected]}
              onPress={() => setFormState({ ...formState, category: suggestion })}
            >
              <Text style={[styles.chipText, formState.category === suggestion && styles.chipTextSelected]}>
                {suggestion}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.textInput}
          placeholder="Eigene Kategorie"
          placeholderTextColor={tokens.colors.textSecondary}
          value={formState.category}
          onChangeText={(text) => setFormState({ ...formState, category: text })}
        />

        <Text style={styles.sectionLabel}>Notiz (optional)</Text>
        <TextInput
          style={[styles.textInput, styles.noteInput]}
          placeholder="z. B. Toilette im 2. Stock"
          placeholderTextColor={tokens.colors.textSecondary}
          value={formState.note}
          onChangeText={(text) => setFormState({ ...formState, note: text })}
          multiline
        />

        {errors.length > 0 && (
          <View style={styles.errorBox}>
            {errors.map((error) => (
              <Text key={error} style={styles.errorText}>
                {error}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.buttonRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Abbrechen" style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Abbrechen</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting }}
            disabled={isSubmitting}
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>{submitLabel}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(46, 42, 38, 0.4)',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '80%',
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  content: {
    padding: tokens.spacing.lg,
  },
  title: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.md,
  },
  sectionLabel: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.medium,
    marginBottom: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    color: tokens.colors.textPrimary,
    backgroundColor: tokens.colors.surface,
    marginBottom: tokens.spacing.md,
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
  },
  chip: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  chipSelected: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  chipText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.sm,
  },
  chipTextSelected: {
    color: tokens.colors.surface,
  },
  errorBox: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.danger,
    borderWidth: 1,
    borderRadius: 8,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
  },
  submitButton: {
    flex: 1,
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: tokens.colors.border,
  },
  submitButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
```

- [ ] **Step 2: `SavedPlaceInfoCard.tsx` erstellen**

Erstelle `colitis-app/src/features/toilets/components/SavedPlaceInfoCard.tsx`:

```typescript
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import type { SavedPlace } from '../types';

interface SavedPlaceInfoCardProps {
  place: SavedPlace;
  onNavigate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function SavedPlaceInfoCard({ place, onNavigate, onEdit, onDelete, onClose }: SavedPlaceInfoCardProps) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Infokarte schließen"
        style={styles.closeButton}
        onPress={onClose}
      >
        <Text style={styles.closeButtonText}>×</Text>
      </Pressable>
      <Text style={styles.name}>{place.name}</Text>
      {place.category.length > 0 && <Text style={styles.detail}>{place.category}</Text>}
      {place.note && <Text style={styles.detail}>{place.note}</Text>}
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bearbeiten"
          style={styles.secondaryButton}
          onPress={onEdit}
        >
          <Text style={styles.secondaryButtonText}>Bearbeiten</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Löschen" style={styles.dangerButton} onPress={onDelete}>
          <Text style={styles.dangerButtonText}>Löschen</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Route dorthin"
        style={styles.navigateButton}
        onPress={onNavigate}
      >
        <Text style={styles.navigateButtonText}>Route dorthin</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: tokens.spacing.md,
    right: tokens.spacing.md,
    bottom: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
  },
  closeButton: {
    position: 'absolute',
    right: tokens.spacing.sm,
    top: tokens.spacing.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: tokens.typography.fontSize.lg,
    color: tokens.colors.textSecondary,
  },
  name: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
    paddingRight: tokens.spacing.lg,
  },
  detail: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.sm,
  },
  dangerButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.danger,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSize.sm,
  },
  navigateButton: {
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
    marginTop: tokens.spacing.sm,
  },
  navigateButtonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
```

- [ ] **Step 3: TypeScript-Check ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: Keine Fehler bezogen auf `SavedPlaceForm.tsx` oder `SavedPlaceInfoCard.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/features/toilets/components/SavedPlaceForm.tsx src/features/toilets/components/SavedPlaceInfoCard.tsx
git commit -m "feat: Formular- und Infokarten-Komponenten fuer sichere Orte"
```

---

### Task 5: Screen-Wiring (sichere Orte + Offline-Fallback im Toiletten-Tab)

**Files:**
- Modify: `colitis-app/app/(tabs)/toiletten/index.tsx`

**Interfaces:**
- Consumes: `createEncryptedDb` aus `../../../src/db/client`; `createSavedPlace`, `listSavedPlaces`, `updateSavedPlace`, `deleteSavedPlace` aus `../../../src/features/toilets/db/savedPlacesRepository`; `replaceCachedToilets`, `listCachedToilets` aus `../../../src/features/toilets/db/cachedToiletsRepository`; `SavedPlaceForm`, `SavedPlaceInfoCard` aus Task 4; `ToiletMapView` (neue Props aus Task 3); alles Bestehende aus Teil A (`ToiletInfoCard`, `LocationPermissionBanner`, `fetchNearbyToilets`, `haversineDistanceMeters`, `hasMovedSignificantly`, `buildNavigationUrl`, `SEARCH_RADIUS_METERS`, `REGION_CHANGE_THRESHOLD_METERS`).
- Produces: Vollständig verdrahteter `ToilettenScreen` (kein Export, der von späteren Tasks konsumiert wird — dies ist der Endpunkt des Toiletten-Tabs für Teil B).

- [ ] **Step 1: `app/(tabs)/toiletten/index.tsx` vollständig ersetzen**

Ersetze den gesamten Inhalt von `colitis-app/app/(tabs)/toiletten/index.tsx` mit:

```typescript
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Linking, Text, View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { ToiletMapView } from '../../../src/features/toilets/components/ToiletMapView';
import { ToiletInfoCard } from '../../../src/features/toilets/components/ToiletInfoCard';
import { SavedPlaceInfoCard } from '../../../src/features/toilets/components/SavedPlaceInfoCard';
import { SavedPlaceForm } from '../../../src/features/toilets/components/SavedPlaceForm';
import { LocationPermissionBanner } from '../../../src/features/toilets/components/LocationPermissionBanner';
import { fetchNearbyToilets } from '../../../src/features/toilets/overpassClient';
import { haversineDistanceMeters } from '../../../src/features/toilets/distance';
import { hasMovedSignificantly } from '../../../src/features/toilets/regionChange';
import { buildNavigationUrl } from '../../../src/features/toilets/navigationLink';
import { SEARCH_RADIUS_METERS, REGION_CHANGE_THRESHOLD_METERS } from '../../../src/features/toilets/constants';
import { createEncryptedDb } from '../../../src/db/client';
import {
  createSavedPlace,
  listSavedPlaces,
  updateSavedPlace,
  deleteSavedPlace,
} from '../../../src/features/toilets/db/savedPlacesRepository';
import { replaceCachedToilets, listCachedToilets } from '../../../src/features/toilets/db/cachedToiletsRepository';
import { tokens } from '../../../src/styles/tokens';
import type { Coordinates, SavedPlace, SavedPlaceInput, Toilet } from '../../../src/features/toilets/types';
import type { SavedPlaceFormState } from '../../../src/features/toilets/savedPlaceFormLogic';

const DEFAULT_CENTER: Coordinates = { latitude: 51.1657, longitude: 10.4515 };

type SelectedMarker = { id: string; kind: 'toilet' | 'place' };
type FormMode = { mode: 'create'; coordinates: Coordinates } | { mode: 'edit'; place: SavedPlace } | null;

export default function ToilettenScreen() {
  const [mapCenter, setMapCenter] = useState<Coordinates>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [lastSearchedCenter, setLastSearchedCenter] = useState<Coordinates | null>(null);
  const [toilets, setToilets] = useState<Toilet[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<SelectedMarker | null>(null);
  const [formState, setFormState] = useState<FormMode>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offlineHint, setOfflineHint] = useState<string | null>(null);
  const [isLocationResolved, setIsLocationResolved] = useState(false);
  const searchRequestIdRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      createEncryptedDb()
        .then(async (db) => {
          const places = await listSavedPlaces(db);
          if (isActive) {
            setSavedPlaces(places);
          }
        })
        .catch((error: unknown) => {
          console.error('[Toiletten] Sichere Orte konnten nicht geladen werden:', error);
        });

      Location.requestForegroundPermissionsAsync()
        .then(async (permission) => {
          if (!isActive) {
            return;
          }
          if (permission.status !== 'granted') {
            setLocationDenied(true);
            setIsLocationResolved(true);
            return;
          }
          setLocationDenied(false);
          const position = await Location.getCurrentPositionAsync({});
          if (!isActive) {
            return;
          }
          const coords: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setUserLocation(coords);
          setMapCenter(coords);
          setIsLocationResolved(true);
          await searchAround(coords);
        })
        .catch((error: unknown) => {
          console.error('[Toiletten] Standort konnte nicht ermittelt werden:', error);
          if (isActive) {
            setLocationDenied(true);
            setIsLocationResolved(true);
          }
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  async function reloadSavedPlaces() {
    const db = await createEncryptedDb();
    setSavedPlaces(await listSavedPlaces(db));
  }

  async function searchAround(center: Coordinates) {
    const requestId = ++searchRequestIdRef.current;
    try {
      const results = await fetchNearbyToilets(center, SEARCH_RADIUS_METERS);
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      setToilets(results);
      setLastSearchedCenter(center);
      setLoadError(null);
      setOfflineHint(null);
      try {
        const db = await createEncryptedDb();
        await replaceCachedToilets(db, results);
      } catch (cacheError: unknown) {
        console.error('[Toiletten] Cache konnte nicht aktualisiert werden:', cacheError);
      }
    } catch (error: unknown) {
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      console.error('[Toiletten] Toiletten konnten nicht geladen werden:', error);
      await handleSearchFailure();
    }
  }

  async function handleSearchFailure() {
    try {
      const db = await createEncryptedDb();
      const cached = await listCachedToilets(db);
      if (cached.length > 0) {
        setToilets(cached);
        setOfflineHint('Offline — zeigt zuletzt geladene Toiletten');
        setLoadError(null);
        return;
      }
    } catch (cacheError: unknown) {
      console.error('[Toiletten] Cache konnte nicht gelesen werden:', cacheError);
    }
    setLoadError('Toiletten konnten nicht geladen werden.');
    setOfflineHint(null);
  }

  function handleRegionChange(center: Coordinates) {
    setMapCenter(center);
    if (!isLocationResolved) {
      return;
    }
    if (!lastSearchedCenter || hasMovedSignificantly(lastSearchedCenter, center, REGION_CHANGE_THRESHOLD_METERS)) {
      searchAround(center);
    }
  }

  function handleMarkerTap(id: string, kind: 'toilet' | 'place') {
    setSelectedMarker({ id, kind });
  }

  function handleLongPress(coordinates: Coordinates) {
    setSelectedMarker(null);
    setFormState({ mode: 'create', coordinates });
  }

  function handleEditPlace(place: SavedPlace) {
    setSelectedMarker(null);
    setFormState({ mode: 'edit', place });
  }

  async function handleSubmitForm(input: SavedPlaceInput) {
    const db = await createEncryptedDb();
    if (formState?.mode === 'edit') {
      await updateSavedPlace(db, formState.place.id, input);
    } else {
      await createSavedPlace(db, input);
    }
    setFormState(null);
    await reloadSavedPlaces();
  }

  function handleDeletePlace(place: SavedPlace) {
    Alert.alert('Sicheren Ort löschen?', `"${place.name}" wird endgültig gelöscht.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          const db = await createEncryptedDb();
          await deleteSavedPlace(db, place.id);
          setSelectedMarker(null);
          await reloadSavedPlaces();
        },
      },
    ]);
  }

  function handleNavigate(destination: Coordinates) {
    Linking.openURL(buildNavigationUrl(destination));
  }

  const selectedToilet =
    selectedMarker?.kind === 'toilet' ? toilets.find((toilet) => toilet.id === selectedMarker.id) ?? null : null;
  const selectedPlace =
    selectedMarker?.kind === 'place'
      ? savedPlaces.find((place) => String(place.id) === selectedMarker.id) ?? null
      : null;

  const formInitialState: SavedPlaceFormState | undefined =
    formState?.mode === 'edit'
      ? { name: formState.place.name, category: formState.place.category, note: formState.place.note ?? '' }
      : undefined;
  const formCoordinates: Coordinates | null =
    formState?.mode === 'create' ? formState.coordinates : formState?.mode === 'edit' ? formState.place : null;

  return (
    <View style={styles.container}>
      {locationDenied && <LocationPermissionBanner />}
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
      <ToiletMapView
        center={mapCenter}
        toilets={toilets}
        savedPlaces={savedPlaces}
        onRegionChange={handleRegionChange}
        onMarkerTap={handleMarkerTap}
        onLongPress={handleLongPress}
      />
      {selectedToilet && (
        <ToiletInfoCard
          toilet={selectedToilet}
          distanceMeters={haversineDistanceMeters(userLocation ?? mapCenter, selectedToilet)}
          onNavigate={() => handleNavigate(selectedToilet)}
          onClose={() => setSelectedMarker(null)}
        />
      )}
      {selectedPlace && (
        <SavedPlaceInfoCard
          place={selectedPlace}
          onNavigate={() => handleNavigate(selectedPlace)}
          onEdit={() => handleEditPlace(selectedPlace)}
          onDelete={() => handleDeletePlace(selectedPlace)}
          onClose={() => setSelectedMarker(null)}
        />
      )}
      {formState && formCoordinates && (
        <SavedPlaceForm
          coordinates={formCoordinates}
          initialState={formInitialState}
          submitLabel={formState.mode === 'edit' ? 'Speichern' : 'Anlegen'}
          onSubmit={handleSubmitForm}
          onCancel={() => setFormState(null)}
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
});
```

Hinweise zur Umsetzung:
- `handleSearchFailure` ist bewusst von `searchAround`'s `catch`-Block getrennt (eigene Funktion), damit die Fallback-Logik (Cache lesen → entweder Offline-Hinweis oder harte Fehlermeldung) klar isoliert und lesbar bleibt.
- Der Cache-Schreibvorgang nach einer erfolgreichen Suche (`replaceCachedToilets`) läuft in einem eigenen inneren `try/catch` als Best-Effort — ein Cache-Schreibfehler darf die erfolgreich angezeigte Live-Suche nicht als Fehler erscheinen lassen (gleiches Muster wie die bestehende Best-Effort-Behandlung der Erinnerungs-Planung in `src/features/medications`).
- `formCoordinates` wird für den Bearbeiten-Fall aus `formState.place` abgeleitet (ein `SavedPlace` erfüllt strukturell bereits `Coordinates`), damit beim Bearbeiten dieselbe Koordinate wie beim ursprünglichen Anlegen erhalten bleibt, sofern der Name/die Kategorie/Notiz geändert werden, aber nicht die Position.

- [ ] **Step 2: TypeScript-Check ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 3: Vollständige Test-Suite laufen lassen (Regressionscheck)**

Run: `cd colitis-app && npx vitest run`
Expected: PASS (alle Tests, keine Regression durch die Screen-Änderung — Screens selbst sind wie in allen bisherigen Schritten nicht automatisiert testbar).

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/toiletten/index.tsx
git commit -m "feat: sichere Orte und Offline-Fallback im Toiletten-Tab verdrahten"
```

---

### Task 6: Schnellzugriff (Config-Plugin + Ziel-Screen)

**Files:**
- Create: `colitis-app/plugins/withNearestToiletShortcut.js`
- Modify: `colitis-app/app.json`
- Create: `colitis-app/app/schnellzugriff.tsx`

**Interfaces:**
- Consumes: `findNearestCandidate` aus `../src/features/toilets/nearestCandidate` (Task 1); `listSavedPlaces` aus `../src/features/toilets/db/savedPlacesRepository` (Task 2); `listCachedToilets` aus `../src/features/toilets/db/cachedToiletsRepository` (Task 2); `buildNavigationUrl` aus `../src/features/toilets/navigationLink` (Teil A); `createEncryptedDb` aus `../src/db/client`.
- Produces: Android-Homescreen-Shortcut "Nächste Toilette", der `colitisapp://schnellzugriff` öffnet; `SchnellzugriffScreen` als eigenständige Route außerhalb der Tabs. Letzter Task dieses Plans — keine nachfolgenden Konsumenten.

- [ ] **Step 1: Config-Plugin erstellen**

Erstelle `colitis-app/plugins/withNearestToiletShortcut.js`:

```javascript
const { withAndroidManifest, withStringsXml, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SHORT_LABEL_NAME = 'nearest_toilet_shortcut_short_label';
const LONG_LABEL_NAME = 'nearest_toilet_shortcut_long_label';

function withNearestToiletShortcutStrings(config) {
  return withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [
        { $: { name: SHORT_LABEL_NAME }, _: 'Nächste Toilette' },
        { $: { name: LONG_LABEL_NAME }, _: 'Nächste Toilette finden' },
      ],
      config.modResults
    );
    return config;
  });
}

function withNearestToiletShortcutXml(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const packageName = config.android && config.android.package;
      if (!packageName) {
        throw new Error('withNearestToiletShortcut: android.package ist in app.json nicht gesetzt.');
      }

      const shortcutsXml = `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut
      android:shortcutId="nearest_toilet"
      android:enabled="true"
      android:icon="@android:drawable/ic_menu_mylocation"
      android:shortcutShortLabel="@string/${SHORT_LABEL_NAME}"
      android:shortcutLongLabel="@string/${LONG_LABEL_NAME}">
    <intent
        android:action="android.intent.action.VIEW"
        android:targetPackage="${packageName}"
        android:targetClass="${packageName}.MainActivity"
        android:data="colitisapp://schnellzugriff" />
  </shortcut>
</shortcuts>
`;

      const xmlDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'shortcuts.xml'), shortcutsXml, 'utf-8');

      return config;
    },
  ]);
}

function withNearestToiletShortcutManifest(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(androidManifest);

    mainActivity['meta-data'] = mainActivity['meta-data'] || [];
    const alreadyPresent = mainActivity['meta-data'].some(
      (item) => item.$ && item.$['android:name'] === 'android.app.shortcuts'
    );
    if (!alreadyPresent) {
      mainActivity['meta-data'].push({
        $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' },
      });
    }

    return config;
  });
}

module.exports = function withNearestToiletShortcut(config) {
  config = withNearestToiletShortcutStrings(config);
  config = withNearestToiletShortcutXml(config);
  config = withNearestToiletShortcutManifest(config);
  return config;
};
```

Hinweis zur Herkunft dieser API: `withAndroidManifest`, `withStringsXml`, `withDangerousMod`, `AndroidConfig.Manifest.getMainActivityOrThrow` und `AndroidConfig.Strings.setStringItem` wurden für diesen Plan gegen den `expo`-Paket-Quellcode (`packages/@expo/config-plugins/src/plugins/android-plugins.ts`, `.../src/android/Manifest.ts`, `.../src/android/Strings.ts`, `.../src/plugins/withDangerousMod.ts`) verifiziert. Die drei `<meta-data>`/`<intent>`-Anforderungen (Platzierung innerhalb der `<activity>` mit `MAIN`/`LAUNCHER`-Intent-Filter, `res/xml/shortcuts.xml`-Format, verpflichtende `@string/`-Referenz für `shortcutShortLabel`/`shortcutLongLabel`) stammen aus der offiziellen Android-Plattform-Dokumentation (plattform-, nicht Expo-Versions-abhängig).

- [ ] **Step 2: Plugin in `app.json` registrieren**

Füge in `colitis-app/app.json` im `plugins`-Array (nach dem bestehenden `"expo-notifications"`-Eintrag) hinzu:

```json
      "expo-notifications",
      "./plugins/withNearestToiletShortcut"
```

Die vollständige `plugins`-Sektion sieht danach so aus:

```json
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "resizeMode": "contain",
          "backgroundColor": "#ffffff"
        }
      ],
      [
        "expo-sqlite",
        {
          "useSQLCipher": true
        }
      ],
      "expo-secure-store",
      "expo-notifications",
      "./plugins/withNearestToiletShortcut"
    ],
```

- [ ] **Step 3: Ziel-Screen `app/schnellzugriff.tsx` erstellen**

Erstelle `colitis-app/app/schnellzugriff.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Linking, Pressable, Text, View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { createEncryptedDb } from '../src/db/client';
import { listSavedPlaces } from '../src/features/toilets/db/savedPlacesRepository';
import { listCachedToilets } from '../src/features/toilets/db/cachedToiletsRepository';
import { findNearestCandidate } from '../src/features/toilets/nearestCandidate';
import { buildNavigationUrl } from '../src/features/toilets/navigationLink';
import { tokens } from '../src/styles/tokens';
import type { Coordinates } from '../src/features/toilets/types';

type Status = 'loading' | 'no-location' | 'no-candidates' | 'done';

export default function SchnellzugriffScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let isActive = true;

    async function run() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        if (isActive) {
          setStatus('no-location');
        }
        return;
      }

      let origin: Coordinates;
      try {
        const position = await Location.getCurrentPositionAsync({});
        origin = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      } catch (error: unknown) {
        console.error('[Schnellzugriff] Standort konnte nicht ermittelt werden:', error);
        if (isActive) {
          setStatus('no-location');
        }
        return;
      }

      const db = await createEncryptedDb();
      const [places, cachedToilets] = await Promise.all([listSavedPlaces(db), listCachedToilets(db)]);

      const nearest = findNearestCandidate(origin, cachedToilets, places);
      if (!nearest) {
        if (isActive) {
          setStatus('no-candidates');
        }
        return;
      }

      if (isActive) {
        setStatus('done');
      }
      await Linking.openURL(buildNavigationUrl(nearest));
    }

    run().catch((error: unknown) => {
      console.error('[Schnellzugriff] Fehler:', error);
      if (isActive) {
        setStatus('no-candidates');
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  if (status === 'loading' || status === 'done') {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Nächste Toilette wird gesucht …</Text>
      </View>
    );
  }

  const message =
    status === 'no-location'
      ? 'Standort nicht verfügbar. Bitte Standortberechtigung erteilen.'
      : 'Es sind noch keine Toiletten oder sicheren Orte bekannt.';

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Toiletten-Tab öffnen"
        style={styles.button}
        onPress={() => router.replace('/toiletten')}
      >
        <Text style={styles.buttonText}>Toiletten-Tab öffnen</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
  text: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.fontSize.md,
    textAlign: 'center',
    marginBottom: tokens.spacing.md,
  },
  button: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 8,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
  },
  buttonText: {
    color: tokens.colors.surface,
    fontSize: tokens.typography.fontSize.md,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
```

Hinweis: `findNearestCandidate` erwartet `Toilet[]` als zweites Argument — `listCachedToilets` liefert exakt diesen Typ (siehe Task 2), es findet also bewusst **kein** Live-Overpass-Abruf statt, nur ein Lesezugriff auf die bereits zwischengespeicherten Toiletten.

- [ ] **Step 4: TypeScript-Check ausführen**

Run: `cd colitis-app && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 5: Vollständige Test-Suite laufen lassen (Regressionscheck, letzter Task)**

Run: `cd colitis-app && npx vitest run`
Expected: PASS (alle Tests aus allen bisherigen Schritten und diesem Plan).

- [ ] **Step 6: Commit**

```bash
git add plugins/withNearestToiletShortcut.js app.json app/schnellzugriff.tsx
git commit -m "feat: Android-Schnellzugriff-Shortcut fuer die naechste Toilette"
```

---

## Self-Review (durchgeführt beim Schreiben dieses Plans)

**Spec-Abdeckung:**
- Abschnitt 1 (Sichere Orte: Anlegen per Long-Press, farblich abgesetzte Marker, Bearbeiten/Löschen, `markerTap`-Unterscheidung) → Tasks 1, 3, 4, 5.
- Abschnitt 2 (Offline-Fallback: `cached_toilets`-Tabelle, Full-Replace, Lese-Fallback mit Hinweistext, harte Fehlermeldung nur ohne Cache) → Tasks 2, 5.
- Abschnitt 3 (Schnellzugriff: Config-Plugin ohne Drittanbieter-Paket, Ziel-Screen mit Standort + gespeicherten Orten + Cache ohne Live-Abruf, Haversine-Wiederverwendung, `buildNavigationUrl`-Wiederverwendung) → Tasks 1, 2, 6.
- Abschnitt 4 (Fehlerbehandlung: alle fünf Fälle) → abgedeckt in Task 5 (`handleSearchFailure`, `offlineHint`/`loadError`) und Task 6 (`no-location`/`no-candidates`-Status mit Rücksprung-Button); Löschen-Bestätigung in Task 5 (`Alert.alert`).
- Abschnitt 5 (Testing-Ansatz) → reine Logik in Task 1 vollständig getestet, Repository-CRUD in Task 2 vollständig getestet, native/Bridge/Screen-Teile bewusst ungetestet mit Verweis auf Schritt 8 (konsistent mit Global Constraints).
- "Explizit nicht Teil dieses Schritts" (iOS-Pendant, Listen-Ansicht, feste Kategorien, automatisches Hintergrund-Refresh) → keiner dieser Punkte taucht in einem Task auf; bewusst ausgelassen.

**Platzhalter-Scan:** Keine "TBD"/"TODO" gefunden; jeder Schritt enthält vollständigen, direkt einsetzbaren Code oder einen exakten Befehl mit erwarteter Ausgabe.

**Typ-Konsistenz geprüft:**
- `onMarkerTap`-Signatur `(id: string, kind: 'toilet' | 'place') => void` ist in Task 3 (`ToiletMapView`-Props) und Task 5 (`handleMarkerTap`) identisch.
- `Candidate`-Feldnamen (`kind`, `id`, `latitude`, `longitude`) aus Task 1 stimmen mit der Verwendung in Task 6 (`buildNavigationUrl(nearest)`, das strukturell nur `latitude`/`longitude` benötigt) überein.
- `SavedPlaceInput`/`SavedPlace`-Feldnamen sind über Task 1 (Typ), Task 2 (Repository), Task 4 (Formular) und Task 5 (Screen) hinweg identisch (`name`, `latitude`, `longitude`, `note`, `category`).
- `Toilet`-Feldnamen (`id`, `latitude`, `longitude`, `name`, `openingHours`) sind zwischen Teil A (`overpassClient`/`parseOverpassResponse`) und dem neuen `cachedToiletsRepository` (Task 2) identisch übernommen.
