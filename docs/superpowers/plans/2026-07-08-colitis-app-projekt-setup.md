# Colitis-App – Projekt-Setup & Verschlüsselte DB (Plan 1 von 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expo/TypeScript-Projekt `colitis-app/` aufsetzen mit Ordnerstruktur, ruhig-warmen Design-Tokens, und einer vollständig verschlüsselten (SQLCipher) lokalen SQLite-Datenbank mit Drizzle-ORM-Schema für alle 7 Kern-Tabellen. Dies ist Umsetzungsschritt 1 aus der Spec und die Grundlage für alle folgenden Pläne (Tagebuch, Wissens-DB, Toiletten-Finder, ...).

**Architecture:** 100% lokale Expo-App (kein Backend). Die verschlüsselte SQLite-DB wird über `expo-sqlite` mit aktiviertem SQLCipher (`useSQLCipher`) geöffnet; der AES-256-Schlüssel wird einmalig zufällig generiert und in `expo-secure-store` (Android Keystore) abgelegt. Drizzle ORM definiert das Schema typsicher und generiert Migrationen, die beim App-Start über `useMigrations` angewendet werden.

**Tech Stack:** React Native (Expo, TypeScript), Expo Router, expo-sqlite + SQLCipher, expo-secure-store, expo-crypto, Drizzle ORM + drizzle-kit, Vitest.

## Global Constraints

- Framework: React Native mit Expo (TypeScript) — siehe Spec Abschnitt 2.
- Lokale DB: `expo-sqlite` + SQLCipher-Verschlüsselung (AES-256), Drizzle ORM für Schema/Queries — Spec Abschnitt 2/3.
- DB-Schlüssel wird im Android Keystore über `expo-secure-store` gespeichert und verlässt das Gerät nie — Spec Abschnitt 3.
- Zielplattform zunächst Android (React Native/Expo bleibt cross-platform-fähig für später) — Spec „Entscheidungsgrundlage".
- UI-Sprache: Deutsch (auch Lade-/Fehlertexte) — Spec „Entscheidungsgrundlage".
- Design-Ton: ruhig, warm, beruhigend, wenig Alarmfarben/Rot — Spec „Entscheidungsgrundlage".
- Kein Backend, keine Cloud-Übertragung von Gesundheitsdaten — Spec Abschnitt 1.
- Projektstruktur folgt exakt Spec Abschnitt 5 (`app/`, `src/features/`, `src/db/`, `src/lib/`, `src/components/ui/`, `src/styles/`).
- Testing: Vitest für Unit-Tests der Kern-Logik (kein Jest) — Spec Abschnitt 7.

---

## Vorbereitung: Projektverzeichnis

Alle folgenden Pfade sind relativ zum Git-Repo-Root `D:\Claude`. Die App lebt in einem eigenen Unterordner `colitis-app/`, damit `Colitis_Ulcerosa_Deepsearch.md` und `docs/` im Repo-Root unangetastet bleiben.

---

### Task 1: Expo-Projekt-Grundgerüst, Ordnerstruktur & Vitest-Setup

**Files:**
- Create: `colitis-app/` (gesamtes Grundgerüst via `create-expo-app`)
- Modify: `colitis-app/app/(tabs)/_layout.tsx` (Tab-Namen/-Icons anpassen)
- Delete: `colitis-app/app/(tabs)/index.tsx`, `colitis-app/app/(tabs)/explore.tsx` (Template-Platzhalter)
- Create: `colitis-app/app/(tabs)/tagebuch/index.tsx`
- Create: `colitis-app/app/(tabs)/wissen/index.tsx`
- Create: `colitis-app/app/(tabs)/toiletten/index.tsx`
- Create: `colitis-app/app/(tabs)/einstellungen/index.tsx`
- Create: `colitis-app/vitest.config.ts`
- Modify: `colitis-app/package.json` (Test-Script)

**Interfaces:**
- Produces: Ordner `colitis-app/src/{features,db,lib,components/ui,styles}/` (leer, werden in Task 2–5 sowie Folgeplänen befüllt), Vitest lauffähig über `npm test`.

- [ ] **Step 1: Expo-Projekt scaffolden**

Im Repo-Root ausführen:

```bash
cd D:/Claude
npx create-expo-app@latest colitis-app
```

Bei Rückfrage nach dem Template die Standard-Auswahl (TypeScript, mit Expo Router und `(tabs)`-Gruppe) bestätigen.

- [ ] **Step 2: Verifizieren, dass das Grundgerüst typsicher ist**

```bash
cd D:/Claude/colitis-app
npx tsc --noEmit
```

Erwartet: keine Fehlerausgabe (Exit-Code 0).

- [ ] **Step 3: Tab-Platzhalter durch die 4 Spec-Tabs ersetzen**

Lösche `app/(tabs)/index.tsx` und `app/(tabs)/explore.tsx`.

Erstelle `app/(tabs)/tagebuch/index.tsx`:

```tsx
import { Text, View } from 'react-native';

export default function TagebuchScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Tagebuch</Text>
    </View>
  );
}
```

Erstelle `app/(tabs)/wissen/index.tsx`:

```tsx
import { Text, View } from 'react-native';

export default function WissenScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Wissen</Text>
    </View>
  );
}
```

Erstelle `app/(tabs)/toiletten/index.tsx`:

```tsx
import { Text, View } from 'react-native';

export default function ToilettenScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Toiletten-Finder</Text>
    </View>
  );
}
```

Erstelle `app/(tabs)/einstellungen/index.tsx`:

```tsx
import { Text, View } from 'react-native';

export default function EinstellungenScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Einstellungen</Text>
    </View>
  );
}
```

Passe `app/(tabs)/_layout.tsx` an, sodass die vier Tabs mit deutschen Labels registriert sind:

```tsx
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="tagebuch/index" options={{ title: 'Tagebuch' }} />
      <Tabs.Screen name="wissen/index" options={{ title: 'Wissen' }} />
      <Tabs.Screen name="toiletten/index" options={{ title: 'Toiletten' }} />
      <Tabs.Screen name="einstellungen/index" options={{ title: 'Einstellungen' }} />
    </Tabs>
  );
}
```

- [ ] **Step 4: Verifizieren, dass die App weiterhin typsicher ist**

```bash
npx tsc --noEmit
```

Erwartet: keine Fehlerausgabe.

- [ ] **Step 5: `src/`-Ordnerstruktur anlegen**

```bash
mkdir -p src/features src/db src/lib src/components/ui src/styles
```

- [ ] **Step 6: Vitest installieren und konfigurieren**

```bash
npm install -D vitest
```

Erstelle `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
  },
});
```

Füge in `package.json` unter `"scripts"` hinzu:

```json
"test": "vitest run"
```

- [ ] **Step 7: Vitest-Setup verifizieren**

```bash
npx vitest run
```

Erwartet: Exit-Code 0, Meldung dass keine Testdateien gefunden wurden (noch keine Tests vorhanden — das ist an dieser Stelle korrekt).

- [ ] **Step 8: Commit**

```bash
cd D:/Claude
git add colitis-app
git commit -m "feat: Expo-Projektgrundgerüst mit Ordnerstruktur und Vitest-Setup"
```

---

### Task 2: Design-Tokens (ruhige/warme Farbpalette)

**Files:**
- Create: `colitis-app/src/styles/tokens.ts`
- Test: `colitis-app/src/styles/tokens.test.ts`

**Interfaces:**
- Produces: `tokens.colors`, `tokens.spacing`, `tokens.typography` — von allen späteren UI-Komponenten importiert (`import { tokens } from '@/src/styles/tokens'` bzw. relativer Pfad).

- [ ] **Step 1: Failing Test schreiben**

Erstelle `src/styles/tokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tokens } from './tokens';

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

describe('design tokens', () => {
  it('defines a hex value for every color token', () => {
    Object.values(tokens.colors).forEach((value) => {
      expect(value).toMatch(HEX_COLOR_PATTERN);
    });
  });

  it('does not use pure alarm red as the primary or accent color', () => {
    expect(tokens.colors.primary.toUpperCase()).not.toBe('#FF0000');
    expect(tokens.colors.accent.toUpperCase()).not.toBe('#FF0000');
  });

  it('defines a strictly increasing spacing scale', () => {
    const values = Object.values(tokens.spacing);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('defines a strictly increasing font size scale', () => {
    const values = Object.values(tokens.typography.fontSize);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});
```

- [ ] **Step 2: Test ausführen, muss fehlschlagen**

```bash
npx vitest run src/styles/tokens.test.ts
```

Erwartet: FEHLER — `tokens.ts` existiert nicht.

- [ ] **Step 3: Tokens implementieren**

Erstelle `src/styles/tokens.ts`:

```ts
const colors = {
  background: '#FBF6EF',
  surface: '#FFFFFF',
  textPrimary: '#2E2A26',
  textSecondary: '#6B6259',
  primary: '#5B8C7B',
  accent: '#D98E4A',
  danger: '#B5533C',
  success: '#5B8C7B',
  border: '#E4DACB',
} as const;

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

const typography = {
  fontSize: {
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 36,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    bold: '700',
  },
} as const;

export const tokens = { colors, spacing, typography } as const;
```

- [ ] **Step 4: Test ausführen, muss bestehen**

```bash
npx vitest run src/styles/tokens.test.ts
```

Erwartet: 4 Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add colitis-app/src/styles
git commit -m "feat: ruhig-warme Design-Tokens (Farben, Spacing, Typografie)"
```

---

### Task 3: Drizzle-Schema für alle 7 Kern-Tabellen

**Files:**
- Create: `colitis-app/src/db/schema.ts`
- Test: `colitis-app/src/db/schema.test.ts`
- Create: `colitis-app/drizzle.config.ts`
- Create: `colitis-app/drizzle/` (generierte Migrationen)

**Interfaces:**
- Consumes: nichts (reines Schema-Modul).
- Produces: benannte Exporte `diaryEntries`, `triggers`, `medications`, `medicationLog`, `savedPlaces`, `knowledgeContent`, `screeningReminders` (jeweils `sqliteTable`-Instanzen) — von `db/client.ts` (Task 5) und allen Feature-Modulen der Folgepläne importiert.

- [ ] **Step 1: Dependencies installieren**

```bash
cd D:/Claude/colitis-app
npm install drizzle-orm
npm install -D drizzle-kit
```

- [ ] **Step 2: Failing Test schreiben**

Erstelle `src/db/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as schema from './schema';

describe('database schema', () => {
  it('defines all seven core tables from the design spec', () => {
    expect(Object.keys(schema)).toEqual(
      expect.arrayContaining([
        'diaryEntries',
        'triggers',
        'medications',
        'medicationLog',
        'savedPlaces',
        'knowledgeContent',
        'screeningReminders',
      ])
    );
  });

  it('diaryEntries has the columns required for a diary entry', () => {
    const columns = Object.keys(schema.diaryEntries);
    expect(columns).toEqual(
      expect.arrayContaining([
        'id',
        'occurredAt',
        'stoolFrequency',
        'hasBlood',
        'stoolConsistency',
        'painLevel',
        'symptoms',
        'note',
      ])
    );
  });

  it('triggers references a diary entry via diaryEntryId', () => {
    const columns = Object.keys(schema.triggers);
    expect(columns).toContain('diaryEntryId');
  });

  it('medicationLog references a medication via medicationId', () => {
    const columns = Object.keys(schema.medicationLog);
    expect(columns).toContain('medicationId');
  });

  it('knowledgeContent has a unique slug column', () => {
    const columns = Object.keys(schema.knowledgeContent);
    expect(columns).toEqual(expect.arrayContaining(['slug', 'title', 'body', 'sources']));
  });
});
```

- [ ] **Step 3: Test ausführen, muss fehlschlagen**

```bash
npx vitest run src/db/schema.test.ts
```

Erwartet: FEHLER — `schema.ts` existiert nicht.

- [ ] **Step 4: Schema implementieren**

Erstelle `src/db/schema.ts`:

```ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const diaryEntries = sqliteTable('diary_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  occurredAt: text('occurred_at').notNull(),
  stoolFrequency: integer('stool_frequency').notNull(),
  hasBlood: integer('has_blood', { mode: 'boolean' }).notNull(),
  stoolConsistency: text('stool_consistency').notNull(),
  painLevel: integer('pain_level').notNull(),
  symptoms: text('symptoms').notNull(),
  note: text('note'),
});

export const triggers = sqliteTable('triggers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  diaryEntryId: integer('diary_entry_id')
    .notNull()
    .references(() => diaryEntries.id),
  category: text('category', {
    enum: ['ernaehrung', 'stress', 'schlaf', 'medikament', 'sonstiges'],
  }).notNull(),
  note: text('note'),
});

export const medications = sqliteTable('medications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  dose: text('dose').notNull(),
  schedule: text('schedule').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
});

export const medicationLog = sqliteTable('medication_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  medicationId: integer('medication_id')
    .notNull()
    .references(() => medications.id),
  takenAt: text('taken_at').notNull(),
});

export const savedPlaces = sqliteTable('saved_places', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  note: text('note'),
  category: text('category').notNull(),
});

export const knowledgeContent = sqliteTable('knowledge_content', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  sources: text('sources').notNull(),
});

export const screeningReminders = sqliteTable('screening_reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  intervalMonths: integer('interval_months').notNull(),
  nextDueDate: text('next_due_date').notNull(),
  note: text('note'),
});
```

- [ ] **Step 5: Test ausführen, muss bestehen**

```bash
npx vitest run src/db/schema.test.ts
```

Erwartet: 5 Tests PASS.

- [ ] **Step 6: drizzle-kit konfigurieren**

Erstelle `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
});
```

- [ ] **Step 7: Migrationen generieren**

```bash
npx drizzle-kit generate
```

Erwartet: Ordner `drizzle/` wird erstellt mit einer `.sql`-Migrationsdatei (7 `CREATE TABLE`-Statements) sowie `drizzle/migrations.js` und `drizzle/meta/`.

- [ ] **Step 8: Commit**

```bash
cd D:/Claude
git add colitis-app/src/db colitis-app/drizzle.config.ts colitis-app/drizzle
git commit -m "feat: Drizzle-Schema für alle 7 Kern-Tabellen + generierte Migrationen"
```

---

### Task 4: SQLCipher-Konfiguration & Verschlüsselungs-Key-Management

**Files:**
- Modify: `colitis-app/app.json`
- Create: `colitis-app/src/lib/encryption.ts`
- Test: `colitis-app/src/lib/encryption.test.ts`

**Interfaces:**
- Produces: `generateOrGetDbKey(): Promise<string>` (64-stelliger Hex-String, 256-bit) — von `db/client.ts` (Task 5) konsumiert.

- [ ] **Step 1: Dependencies installieren**

```bash
cd D:/Claude/colitis-app
npx expo install expo-sqlite expo-secure-store expo-crypto expo-dev-client
```

`expo-dev-client` wird benötigt, weil SQLCipher nicht in Expo Go läuft, sondern einen eigenen Dev-Client-Build voraussetzt.

- [ ] **Step 2: SQLCipher in app.json aktivieren**

Öffne `app.json` und ergänze im `"expo"`-Objekt den `"plugins"`-Eintrag um den `expo-sqlite`-Plugin (falls `"plugins"` bereits existiert, den Eintrag ergänzen statt das Array zu ersetzen):

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      [
        "expo-sqlite",
        {
          "useSQLCipher": true
        }
      ]
    ]
  }
}
```

- [ ] **Step 3: Android-Projekt mit SQLCipher generieren**

```bash
npx expo prebuild --platform android
```

- [ ] **Step 4: Verifizieren, dass SQLCipher eingebunden ist**

```bash
grep -ri "sqlcipher" android/app/build.gradle android/build.gradle
```

Erwartet: mindestens ein Treffer in einer der beiden Dateien.

Hinweis: `expo prebuild` benötigt eine funktionierende Android-Toolchain (Android Studio/SDK). Falls das auf diesem Rechner noch nicht eingerichtet ist, ist das ein Umgebungs-Setup außerhalb dieses Plans — bitte kurz Bescheid geben, dann klären wir das separat.

- [ ] **Step 5: Failing Test für Key-Generierung schreiben**

Erstelle `src/lib/encryption.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const storeMock = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(storeMock.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    storeMock.set(key, value);
    return Promise.resolve();
  }),
}));

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn((length: number) =>
    Promise.resolve(new Uint8Array(length).map((_, i) => i % 256))
  ),
}));

import { generateOrGetDbKey } from './encryption';

beforeEach(() => {
  storeMock.clear();
  vi.clearAllMocks();
});

describe('generateOrGetDbKey', () => {
  it('generates a 64-character hex key on first call', async () => {
    const key = await generateOrGetDbKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('persists the generated key in SecureStore', async () => {
    const key = await generateOrGetDbKey();
    expect(storeMock.get('colitis_db_encryption_key')).toBe(key);
  });

  it('returns the same key on subsequent calls without generating a new one', async () => {
    const Crypto = await import('expo-crypto');
    const first = await generateOrGetDbKey();
    const second = await generateOrGetDbKey();
    expect(second).toBe(first);
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Test ausführen, muss fehlschlagen**

```bash
npx vitest run src/lib/encryption.test.ts
```

Erwartet: FEHLER — `encryption.ts` existiert nicht.

- [ ] **Step 7: Key-Management implementieren**

Erstelle `src/lib/encryption.ts`:

```ts
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DB_KEY_STORAGE_KEY = 'colitis_db_encryption_key';
const KEY_BYTE_LENGTH = 32;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function generateOrGetDbKey(): Promise<string> {
  const existingKey = await SecureStore.getItemAsync(DB_KEY_STORAGE_KEY);
  if (existingKey) {
    return existingKey;
  }

  const randomBytes = await Crypto.getRandomBytesAsync(KEY_BYTE_LENGTH);
  const newKey = bytesToHex(randomBytes);
  await SecureStore.setItemAsync(DB_KEY_STORAGE_KEY, newKey);
  return newKey;
}
```

- [ ] **Step 8: Test ausführen, muss bestehen**

```bash
npx vitest run src/lib/encryption.test.ts
```

Erwartet: 3 Tests PASS.

- [ ] **Step 9: Commit**

```bash
cd D:/Claude
git add colitis-app/app.json colitis-app/src/lib colitis-app/android
git commit -m "feat: SQLCipher aktivieren und Verschlüsselungs-Key-Management"
```

---

### Task 5: Verschlüsselter DB-Client & Root-Layout-Wiring

**Files:**
- Create: `colitis-app/src/db/client.ts`
- Modify: `colitis-app/metro.config.js`
- Modify: `colitis-app/babel.config.js`
- Modify: `colitis-app/app/_layout.tsx`

**Interfaces:**
- Consumes: `generateOrGetDbKey()` aus `src/lib/encryption.ts` (Task 4), `schema` aus `src/db/schema.ts` (Task 3), generierte Migrationen aus `drizzle/migrations.js` (Task 3).
- Produces: `createEncryptedDb(): Promise<ExpoSQLiteDatabase<typeof schema>>` — wird von allen Feature-Modulen der Folgepläne (Tagebuch, Wissens-DB, ...) zum DB-Zugriff verwendet.

- [ ] **Step 1: SQL-Import für Metro/Babel konfigurieren**

```bash
cd D:/Claude/colitis-app
npm install -D babel-plugin-inline-import
```

Modifiziere `metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql');

module.exports = config;
```

Modifiziere `babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
```

- [ ] **Step 2: Verschlüsselten DB-Client implementieren**

Erstelle `src/db/client.ts`:

```ts
import { openDatabaseSync } from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { generateOrGetDbKey } from '../lib/encryption';
import * as schema from './schema';

const DB_FILE_NAME = 'colitis.db';

export async function createEncryptedDb(): Promise<ExpoSQLiteDatabase<typeof schema>> {
  const dbKey = await generateOrGetDbKey();
  const sqliteDb = openDatabaseSync(DB_FILE_NAME);
  await sqliteDb.execAsync(`PRAGMA key = "x'${dbKey}'";`);
  return drizzle(sqliteDb, { schema });
}
```

- [ ] **Step 3: Root-Layout mit Migrations-Wiring aktualisieren**

Ersetze den Inhalt von `app/_layout.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { createEncryptedDb } from '../src/db/client';
import * as schema from '../src/db/schema';
import { tokens } from '../src/styles/tokens';

export default function RootLayout() {
  const [db, setDb] = useState<ExpoSQLiteDatabase<typeof schema> | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    createEncryptedDb()
      .then((createdDb) => {
        if (isMounted) {
          setDb(createdDb);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setInitError(error instanceof Error ? error.message : 'Unbekannter Datenbankfehler');
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (initError) {
    return (
      <View style={styles.centered}>
        <Text>Fehler beim Öffnen der Datenbank: {initError}</Text>
      </View>
    );
  }

  if (!db) {
    return (
      <View style={styles.centered}>
        <Text>Datenbank wird geladen …</Text>
      </View>
    );
  }

  return <MigratedLayout db={db} />;
}

function MigratedLayout({ db }: { db: ExpoSQLiteDatabase<typeof schema> }) {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text>Datenbank-Migration fehlgeschlagen: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={styles.centered}>
        <Text>Datenbank wird vorbereitet …</Text>
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = {
  centered: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
};
```

- [ ] **Step 4: Typsicherheit verifizieren**

```bash
npx tsc --noEmit
```

Erwartet: keine Fehlerausgabe.

- [ ] **Step 5: Alle bisherigen Unit-Tests verifizieren**

```bash
npx vitest run
```

Erwartet: alle Tests aus Task 2, 3 und 4 PASS (12 Tests insgesamt), keine neuen Fehler.

- [ ] **Step 6: Manueller Gerätetest (nicht automatisierbar)**

Auf einem echten Android-Gerät oder Emulator mit Dev-Client-Build (`npx expo run:android`) prüfen:
- App startet ohne Absturz, zeigt kurz "Datenbank wird geladen …" / "Datenbank wird vorbereitet …" und dann die vier Tabs.
- Nach Neustart der App wird kein neuer Schlüssel generiert (bestehende DB öffnet sich weiterhin) — dies bestätigt, dass der Schlüssel korrekt aus dem Keystore gelesen wird.

Dieser Schritt ist laut Spec-Testing-Ansatz manuell auf echtem Gerät durchzuführen und nicht Teil der automatisierten Test-Suite.

- [ ] **Step 7: Commit**

```bash
cd D:/Claude
git add colitis-app/src/db/client.ts colitis-app/metro.config.js colitis-app/babel.config.js "colitis-app/app/_layout.tsx" colitis-app/package.json colitis-app/package-lock.json
git commit -m "feat: verschlüsselten DB-Client mit Migrations-Wiring in Root-Layout integrieren"
```

---

## Nach Abschluss dieses Plans

Damit ist Umsetzungsschritt 1 der Spec vollständig: lauffähiges Expo-Projekt, Design-Tokens, vollständiges Drizzle-Schema, aktives SQLCipher mit sicherem Schlüssel-Management, und ein Root-Layout, das die DB verschlüsselt öffnet und Migrationen anwendet. Plan 2 (Tagebuch-Kern: Eingabe-Screen, Speicherung, Verlaufsansicht) baut direkt auf `createEncryptedDb()` und `schema.diaryEntries` auf.
