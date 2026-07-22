# Tagebuch CSV-Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein zweiter Export-Weg für Tagebucheinträge als Semikolon-getrennte, Excel-taugliche CSV-Datei, neben dem bestehenden PDF-Export.

**Architecture:** Eine reine, unit-getestete Funktion baut den CSV-Text aus den Tagebucheinträgen (analog zu `diaryPdfBuilder.ts`). Eine zweite Funktion schreibt diesen Text in eine temporäre Datei und bietet sie über den System-Teilen-Dialog an (analog zu `backupFileService.ts`, nicht zum PDF-Weg über `expo-print`). Ein neuer Button im Tagebuch-Tab ruft das auf, neben dem bestehenden PDF-Export-Button.

**Tech Stack:** React Native (Expo SDK 57), TypeScript, `expo-file-system`, `expo-sharing`, Vitest.

## Global Constraints

- Zielverzeichnis: `D:\Claude\colitis-app`
- Alle Nutzertexte auf Deutsch
- CSV: Semikolon (`;`) als Trennzeichen, UTF-8 mit BOM (`﻿` als erstes Zeichen), CRLF (`\r\n`) als Zeilenumbruch (RFC 4180)
- Escaping generisch auf jedes Feld angewendet: enthält ein Feld `;`, `"` oder einen Zeilenumbruch, wird es in `"..."` gesetzt, enthaltene `"` verdoppelt
- Tests mit `npx.cmd vitest run <pfad>` (Windows — `npx` allein schlägt fehl)
- Nach jeder Aufgabe: `npx.cmd tsc --noEmit --pretty false` ohne neue Fehler (die vorbestehende `@react-native-async-storage/async-storage`-Warnung ist bekannt und nicht Teil dieser Aufgabe)
- Datumsformatierung in Tests niemals exakt auf einen vollen Zeitstempel-String matchen (Zeitzone des Testrechners ist nicht garantiert UTC) — immer `.toContain()` auf das Datum, wie im bestehenden `diaryPdfBuilder.test.ts`

---

## Task 1: Reine CSV-Baufunktion `diaryCsvBuilder.ts`

**Files:**
- Create: `colitis-app/src/features/diary/diaryCsvBuilder.ts`
- Create: `colitis-app/src/features/diary/diaryCsvBuilder.test.ts`

**Interfaces:**
- Consumes: `STOOL_CONSISTENCY_OPTIONS`, `TRIGGER_CATEGORY_OPTIONS`, `SYMPTOM_OPTIONS`, `labelFor` (aus `./constants`), `formatOccurredAt` (aus `./formatting`), `DiaryEntryWithTriggers` (aus `./types`)
- Produces: `buildDiaryCsv(entries: DiaryEntryWithTriggers[]): string`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Erstelle `colitis-app/src/features/diary/diaryCsvBuilder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildDiaryCsv } from './diaryCsvBuilder';
import type { DiaryEntryWithTriggers } from './types';

function makeEntry(overrides: Partial<DiaryEntryWithTriggers> = {}): DiaryEntryWithTriggers {
  return {
    id: 1,
    occurredAt: '2026-07-08T10:00:00.000Z',
    stoolFrequency: 3,
    hasBlood: false,
    stoolConsistency: 'weich',
    painLevel: 4,
    symptoms: [],
    note: null,
    triggerCategories: [],
    ...overrides,
  };
}

describe('buildDiaryCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    const csv = buildDiaryCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('includes the German header row, semicolon-separated', () => {
    const csv = buildDiaryCsv([]);
    const firstLine = csv.slice(1).split('\r\n')[0];
    expect(firstLine).toBe(
      'Datum;Stuhlgang-Häufigkeit;Konsistenz;Schmerzlevel;Blut im Stuhl;Auslöser;Symptome;Notiz'
    );
  });

  it('contains only the header when there are no entries', () => {
    const csv = buildDiaryCsv([]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toHaveLength(1);
  });

  it('writes one row per entry with frequency, consistency label, pain level, and blood flag', () => {
    const csv = buildDiaryCsv([makeEntry({ stoolFrequency: 5, stoolConsistency: 'waessrig', painLevel: 8 })]);
    const row = csv.slice(1).split('\r\n')[1];
    expect(row).toContain('08.07.2026');
    expect(row).toContain(';5;Wässrig;8;Nein;;;');
  });

  it('renders "Ja" or "Nein" for blood in stool', () => {
    const withBlood = buildDiaryCsv([makeEntry({ hasBlood: true })]);
    expect(withBlood.slice(1).split('\r\n')[1]).toContain(';Ja;');

    const withoutBlood = buildDiaryCsv([makeEntry({ hasBlood: false })]);
    expect(withoutBlood.slice(1).split('\r\n')[1]).toContain(';Nein;');
  });

  it('joins multiple trigger and symptom labels with commas inside one cell', () => {
    const csv = buildDiaryCsv([
      makeEntry({ triggerCategories: ['stress', 'ernaehrung'], symptoms: ['fieber', 'muedigkeit'] }),
    ]);
    const row = csv.slice(1).split('\r\n')[1];
    expect(row).toContain('Stress, Ernährung');
    expect(row).toContain('Fieber, Müdigkeit');
  });

  it('leaves the note column empty when there is no note', () => {
    const csv = buildDiaryCsv([makeEntry({ note: null })]);
    const row = csv.slice(1).split('\r\n')[1];
    expect(row.endsWith(';')).toBe(true);
  });

  it('writes a plain note as-is', () => {
    const csv = buildDiaryCsv([makeEntry({ note: 'Nach dem Frühstück' })]);
    expect(csv).toContain('Nach dem Frühstück');
  });

  it('quotes a note containing a semicolon', () => {
    const csv = buildDiaryCsv([makeEntry({ note: 'Stress; viel Kaffee' })]);
    expect(csv).toContain('"Stress; viel Kaffee"');
  });

  it('doubles embedded double quotes and wraps the field in quotes', () => {
    const csv = buildDiaryCsv([makeEntry({ note: 'Arzt sagte "alles gut"' })]);
    expect(csv).toContain('"Arzt sagte ""alles gut"""');
  });

  it('quotes a note containing a line break', () => {
    const csv = buildDiaryCsv([makeEntry({ note: 'Zeile eins\nZeile zwei' })]);
    expect(csv).toContain('"Zeile eins\nZeile zwei"');
  });

  it('writes multiple entries as multiple rows in the given order', () => {
    const csv = buildDiaryCsv([
      makeEntry({ id: 1, occurredAt: '2026-07-08T10:00:00.000Z' }),
      makeEntry({ id: 2, occurredAt: '2026-07-06T10:00:00.000Z' }),
    ]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('08.07.2026');
    expect(lines[2]).toContain('06.07.2026');
  });
});
```

- [ ] **Step 2: Testlauf zur Bestätigung des Fehlschlags**

```bash
cd colitis-app
npx.cmd vitest run src/features/diary/diaryCsvBuilder.test.ts
```
Erwartet: FAIL — Modul `./diaryCsvBuilder` existiert nicht.

- [ ] **Step 3: Implementierung**

Erstelle `colitis-app/src/features/diary/diaryCsvBuilder.ts`:

```typescript
import { STOOL_CONSISTENCY_OPTIONS, SYMPTOM_OPTIONS, TRIGGER_CATEGORY_OPTIONS, labelFor } from './constants';
import { formatOccurredAt } from './formatting';
import type { DiaryEntryWithTriggers } from './types';

const CSV_DELIMITER = ';';
const CSV_LINE_BREAK = '\r\n';
const CSV_BOM = '﻿';

const CSV_HEADER = [
  'Datum',
  'Stuhlgang-Häufigkeit',
  'Konsistenz',
  'Schmerzlevel',
  'Blut im Stuhl',
  'Auslöser',
  'Symptome',
  'Notiz',
];

function escapeCsvField(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildEntryRow(entry: DiaryEntryWithTriggers): string {
  const consistencyLabel = labelFor(STOOL_CONSISTENCY_OPTIONS, entry.stoolConsistency);
  const triggerLabels = entry.triggerCategories.map((category) => labelFor(TRIGGER_CATEGORY_OPTIONS, category));
  const symptomLabels = entry.symptoms.map((symptom) => labelFor(SYMPTOM_OPTIONS, symptom));

  const fields = [
    formatOccurredAt(entry.occurredAt),
    String(entry.stoolFrequency),
    consistencyLabel,
    String(entry.painLevel),
    entry.hasBlood ? 'Ja' : 'Nein',
    triggerLabels.join(', '),
    symptomLabels.join(', '),
    entry.note ?? '',
  ];

  return fields.map(escapeCsvField).join(CSV_DELIMITER);
}

export function buildDiaryCsv(entries: DiaryEntryWithTriggers[]): string {
  const rows = [CSV_HEADER.join(CSV_DELIMITER), ...entries.map(buildEntryRow)];
  return CSV_BOM + rows.join(CSV_LINE_BREAK);
}
```

- [ ] **Step 4: Testlauf zur Bestätigung des Erfolgs**

```bash
cd colitis-app
npx.cmd vitest run src/features/diary/diaryCsvBuilder.test.ts
```
Erwartet: PASS, alle 11 Tests grün.

- [ ] **Step 5: Commit**

```bash
cd D:/Claude
git add colitis-app/src/features/diary/diaryCsvBuilder.ts colitis-app/src/features/diary/diaryCsvBuilder.test.ts
git commit -m "feat: reine CSV-Baufunktion fuer Tagebuch-Export ergaenzen"
```

---

## Task 2: Datei schreiben & teilen — `diaryCsvExport.ts`

**Files:**
- Create: `colitis-app/src/features/diary/diaryCsvExport.ts`

**Interfaces:**
- Consumes: `buildDiaryCsv` (aus `./diaryCsvBuilder`, Task 1), `DiaryEntryWithTriggers` (aus `./types`)
- Produces: `exportDiaryEntriesAsCsv(entries: DiaryEntryWithTriggers[]): Promise<void>`

Kein dediziertes Unit-Test für diese Datei — analog zum bestehenden, ebenfalls ungetesteten `diaryPdfExport.ts` (nativer Datei-/Teilen-Zugriff, nicht sinnvoll mockbar in diesem Projekt). Verifikation über `tsc --noEmit` und den späteren manuellen Test in Task 3.

- [ ] **Step 1: Implementierung**

Erstelle `colitis-app/src/features/diary/diaryCsvExport.ts`:

```typescript
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildDiaryCsv } from './diaryCsvBuilder';
import type { DiaryEntryWithTriggers } from './types';

const EXPORT_DIRECTORY_NAME = 'colitis-exports';

export async function exportDiaryEntriesAsCsv(entries: DiaryEntryWithTriggers[]): Promise<void> {
  const csv = buildDiaryCsv(entries);

  const directory = new Directory(Paths.cache, EXPORT_DIRECTORY_NAME);
  directory.create({ idempotent: true });

  const fileName = `tagebuch-export-${new Date().toISOString().slice(0, 10)}.csv`;
  const file = new File(directory, fileName);
  file.create({ overwrite: true });
  file.write(csv);

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  }
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  } finally {
    file.delete();
  }
}
```

- [ ] **Step 2: Verifikation**

```bash
cd colitis-app
npx.cmd tsc --noEmit --pretty false
```
Erwartet: keine neuen Typfehler.

- [ ] **Step 3: Commit**

```bash
cd D:/Claude
git add colitis-app/src/features/diary/diaryCsvExport.ts
git commit -m "feat: Tagebuch-CSV in Datei schreiben und teilen"
```

---

## Task 3: Button im Tagebuch-Tab verdrahten

**Files:**
- Modify: `colitis-app/app/(tabs)/tagebuch/index.tsx`

**Interfaces:**
- Consumes: `exportDiaryEntriesAsCsv` (aus `../../../src/features/diary/diaryCsvExport`, Task 2)
- Produces: nichts (Blattkomponente, UI-Endpunkt)

Kein automatisiertes Test für React-Native-UI-Screens in diesem Projekt (bestehendes Muster). Verifikation über `tsc --noEmit`, volle Testsuite, und manuellen Test.

- [ ] **Step 1: Import ergänzen**

In `colitis-app/app/(tabs)/tagebuch/index.tsx`, nach der bestehenden Zeile `import { exportDiaryEntriesAsPdf } from '../../../src/features/diary/diaryPdfExport';` ergänzen:

```typescript
import { exportDiaryEntriesAsCsv } from '../../../src/features/diary/diaryCsvExport';
```

- [ ] **Step 2: Handler ergänzen**

Nach der bestehenden Funktion `handleExportPdf` (endet mit der schließenden `}` nach dem `finally`-Block) ergänzen:

```typescript
async function handleExportCsv() {
  setIsExporting(true);
  try {
    await exportDiaryEntriesAsCsv(entries);
    setError(null);
  } catch (exportError: unknown) {
    console.error('[Tagebuch] CSV-Export fehlgeschlagen:', exportError);
    setError('CSV-Export fehlgeschlagen.');
  } finally {
    setIsExporting(false);
  }
}
```

- [ ] **Step 3: Button in der JSX ergänzen**

Direkt nach dem bestehenden PDF-Export-`Pressable`-Block (schließt mit `</Pressable>` nach `{isExporting ? 'PDF wird erstellt …' : 'Als PDF exportieren'}`), vor dem `{isLoading ? (...) : (...)}`-Block, einfügen:

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityState={{ disabled: isExporting || entries.length === 0 }}
  accessibilityLabel="Tagebuch als CSV exportieren"
  disabled={isExporting || entries.length === 0}
  style={[styles.exportLink, (isExporting || entries.length === 0) && styles.exportLinkDisabled]}
  onPress={handleExportCsv}
>
  <Text style={styles.exportLinkText}>{isExporting ? 'CSV wird erstellt …' : 'Als CSV exportieren'}</Text>
</Pressable>
```

Kein neues Styling nötig — beide Export-Buttons teilen sich `styles.exportLink`/`exportLinkDisabled`/`exportLinkText`.

- [ ] **Step 4: Verifikation**

```bash
cd colitis-app
npx.cmd tsc --noEmit --pretty false
npx.cmd vitest run
```
Erwartet: keine neuen Typfehler, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
cd D:/Claude
git add "colitis-app/app/(tabs)/tagebuch/index.tsx"
git commit -m "feat: CSV-Export-Button im Tagebuch-Tab verdrahten"
```

- [ ] **Step 6: Manueller Testhinweis**

Kein automatisierter Test möglich für: den tatsächlichen Teilen-Dialog und das Öffnen der Datei in Excel/einer Tabellen-App. Beim nächsten Alltagstest: CSV exportieren, Datei in Excel (oder einer anderen Tabellenkalkulation) öffnen, prüfen dass Spalten korrekt getrennt sind und Umlaute (ä/ö/ü) korrekt angezeigt werden, nicht als Sonderzeichen-Kauderwelsch.

---

## Plan-Selbstprüfung (bereits durchgeführt)

- **Spec-Abdeckung:** CSV-Format inkl. Trennzeichen/BOM/Escaping (Task 1), Datei-Erzeugung & Teilen (Task 2), UI-Button (Task 3) — alle Abschnitte der Spec abgedeckt.
- **Platzhalter-Scan:** keine TBD/TODO, jeder Schritt enthält vollständigen Code.
- **Typ-Konsistenz:** `DiaryEntryWithTriggers` durchgängig aus `./types`; `buildDiaryCsv`/`exportDiaryEntriesAsCsv`-Signaturen zwischen Definition (Task 1/2) und Verwendung (Task 2/3) konsistent.
