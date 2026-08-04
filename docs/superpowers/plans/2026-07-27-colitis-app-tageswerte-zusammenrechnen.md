# Tageswerte zusammenrechnen — Nachbesserungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Tag wird anhand seiner zusammengerechneten Werte bewertet, nicht anhand des schlimmsten Einzeleintrags — damit ein auf mehrere Einträge verteilter Tag nicht harmloser aussieht als er war.

**Anlass:** Die Schlussdurchsicht des Zweigs `worktree-schnell-eintrag` fand eine Lücke in der genehmigten Spezifikation. Sie wurde dem Nutzer vorgelegt, der sich für das Zusammenrechnen entschieden hat.

**Architecture:** Die Schwellenwertlogik wird einmal auf Tagessummen umgestellt (`rateDayTotals`) und von der Einzeleintrags- wie der Tagesbewertung gemeinsam genutzt. Der Verlaufschart wechselt von Durchschnitten auf Tagessumme beziehungsweise schlimmsten Wert. Der Schnell-Eintrag zeigt den Tageswert über alle Einträge statt nur den des jüngsten.

**Tech Stack:** React Native 0.86.2, Expo SDK 57, TypeScript, Vitest.

## Das Problem in einem Ablauf

1. Morgens fünf Tipps im Schnell-Eintrag → Eintrag A, Häufigkeit 5, Schmerz 0.
2. Mittags Schmerzen nachtragen. Der einzige Weg dorthin ist „Ausführlichen Eintrag anlegen" — das legt Eintrag B an, Häufigkeit startet bei 0.
3. Abends vier weitere Tipps → B steht auf 4.

Tatsächlich neun Stuhlgänge, also ein schlechter Tag (Schwelle 8). Gespeichert 5 und 4. `rateDayEntries` nahm bisher das Maximum der Einzelbewertungen: „mittel" und „gut" ergeben „mittel". Die Schub-Frühwarnung zählte diesen Tag nicht. Der Verlaufschart mittelte auf 4,5.

Die Verzerrung ging immer in Richtung beschönigend.

## Global Constraints

- **Schwellenwerte bleiben unverändert:** Blut → schlecht; Schmerz ≥ 7 oder Häufigkeit ≥ 8 → schlecht; Schmerz ≥ 4 oder Häufigkeit ≥ 5 → mittel; sonst gut.
- **Zusammenrechnung eines Tages:** Häufigkeit wird **summiert**, Schmerz ist der **höchste** Wert des Tages, Blut gilt, sobald **irgendein** Eintrag des Tages es vermerkt.
- **Ein Tag ohne Einträge bleibt „gut"** — wie bisher.
- **Keine neuen npm-Abhängigkeiten.**
- **Windows:** immer `npx.cmd`, nie `npx`. Befehle aus `colitis-app`.
- **Deutsche UI-Texte wörtlich** wie angegeben, Auslassungszeichen „…" als Einzelzeichen.
- **Namen dürfen nicht lügen:** Wo ab jetzt summiert statt gemittelt wird, wird auch der Bezeichner geändert.

## Dateiübersicht

| Datei | Änderung |
|---|---|
| `src/features/diary/calendarLogic.ts` | Schwellenwertlogik auf Tagessummen umstellen |
| `src/features/diary/calendarLogic.test.ts` | Bestehende Erwartungen prüfen, Fälle für geteilte Tage ergänzen |
| `src/features/diary/trendLogic.ts` | Durchschnitt → Summe bzw. höchster Wert, samt Umbenennung |
| `src/features/diary/trendLogic.test.ts` | Erwartungen anpassen |
| `src/features/diary/components/DiaryTrendChart.tsx` | An die neuen Namen anpassen |
| `src/features/diary/quickEntryLogic.ts` | `summarizeToday` ergänzen |
| `src/features/diary/quickEntryLogic.test.ts` | Tests dafür |
| `app/(tabs)/tagebuch/schnell.tsx` | Tageswert über alle Einträge anzeigen, zwei Kleinigkeiten |
| `app/(tabs)/tagebuch/index.tsx` | Rückmeldung während des Exports, zwei Kleinigkeiten |

---

### Task 1: Tagesbewertung auf Summen umstellen

**Files:**
- Modify: `colitis-app/src/features/diary/calendarLogic.ts`
- Test: `colitis-app/src/features/diary/calendarLogic.test.ts`

**Interfaces:**
- Consumes: `DiaryEntryWithTriggers` aus `./types`
- Produces (von `flareWarning.ts` und `DiaryCalendarView.tsx` bereits genutzt, Signaturen bleiben):
  - `rateDayEntries(entries: DiaryEntryWithTriggers[]): DayRating` — Verhalten ändert sich
  - `rateDiaryEntry(entry: DiaryEntryWithTriggers): DayRating` — Verhalten bleibt gleich
  - neu: `interface DayTotals { totalStoolFrequency: number; worstPainLevel: number; hasBlood: boolean; }`
  - neu: `sumDayTotals(entries: DiaryEntryWithTriggers[]): DayTotals`
  - neu: `rateDayTotals(totals: DayTotals): DayRating`

`groupEntriesByDay`, `formatDateKey`, `buildCalendarGrid` und `RATING_SEVERITY` bleiben unverändert. **`flareWarning.ts` wird nicht angefasst** — es ruft `rateDayEntries` auf und profitiert automatisch.

- [ ] **Step 1: Bestehende Tests durchsehen und Erwartungen prüfen**

Öffne `colitis-app/src/features/diary/calendarLogic.test.ts` und lies den Block `describe('rateDayEntries', …)`.

Für **jeden** dieser Tests: Entscheide, ob die erwartete Bewertung unter der neuen Regel (Häufigkeiten summieren, Schmerz höchster Wert, Blut sobald irgendwo) noch stimmt. Rechne es von Hand nach.

Passe nur die Erwartungen an, die sich durch die neue Regel tatsächlich ändern, und notiere **jede** Änderung mit Rechenweg im Bericht. Ändere keinen Test, der auch unter der neuen Regel unverändert gilt. Der Block `describe('rateDiaryEntry', …)` bleibt vollständig unverändert — Einzeleinträge werden weiterhin genauso bewertet.

- [ ] **Step 2: Fehlschlagende Tests für geteilte Tage ergänzen**

Am Ende des Blocks `describe('rateDayEntries', …)` einfügen. Falls die vorhandene Testdatei bereits eine Hilfsfunktion `makeEntry` besitzt, verwende diese und übernimm ihre Aufrufform; andernfalls lege die Objekte vollständig an.

```typescript
  it('adds up the frequencies of a day split across entries', () => {
    const entries = [
      makeEntry({ stoolFrequency: 5, painLevel: 0, hasBlood: false }),
      makeEntry({ stoolFrequency: 4, painLevel: 0, hasBlood: false }),
    ];
    expect(rateDayEntries(entries)).toBe('bad');
  });

  it('rates a split day as medium once the sum reaches five', () => {
    const entries = [
      makeEntry({ stoolFrequency: 3, painLevel: 0, hasBlood: false }),
      makeEntry({ stoolFrequency: 2, painLevel: 0, hasBlood: false }),
    ];
    expect(rateDayEntries(entries)).toBe('medium');
  });

  it('keeps a quiet split day good', () => {
    const entries = [
      makeEntry({ stoolFrequency: 2, painLevel: 1, hasBlood: false }),
      makeEntry({ stoolFrequency: 2, painLevel: 2, hasBlood: false }),
    ];
    expect(rateDayEntries(entries)).toBe('good');
  });

  it('takes the highest pain level of the day, not the sum', () => {
    const entries = [
      makeEntry({ stoolFrequency: 0, painLevel: 3, hasBlood: false }),
      makeEntry({ stoolFrequency: 0, painLevel: 3, hasBlood: false }),
    ];
    expect(rateDayEntries(entries)).toBe('good');
  });

  it('flags the day as bad when any entry recorded blood', () => {
    const entries = [
      makeEntry({ stoolFrequency: 1, painLevel: 0, hasBlood: true }),
      makeEntry({ stoolFrequency: 1, painLevel: 0, hasBlood: false }),
    ];
    expect(rateDayEntries(entries)).toBe('bad');
  });

  it('rates a day without entries as good', () => {
    expect(rateDayEntries([])).toBe('good');
  });
```

Der Test `takes the highest pain level of the day, not the sum` ist der wichtigste der Gruppe: Er stellt sicher, dass beim Schmerz gerade **nicht** summiert wird. Ohne ihn würde eine Umsetzung, die alles summiert, unbemerkt durchgehen und zwei ruhige Einträge mit Schmerz 3 fälschlich als schlechten Tag ausweisen.

- [ ] **Step 3: Tests laufen lassen und Fehlschlag bestätigen**

Ausführen: `npx.cmd vitest run src/features/diary/calendarLogic.test.ts`

Erwartet: FEHLER — mindestens `adds up the frequencies of a day split across entries` schlägt fehl, weil die alte Umsetzung das Maximum der Einzelbewertungen nimmt und daher `medium` liefert.

- [ ] **Step 4: Umsetzen**

In `colitis-app/src/features/diary/calendarLogic.ts` die Funktionen `rateDiaryEntry` und `rateDayEntries` durch diesen Block ersetzen. `DayRating`, `RATING_SEVERITY`, `formatDateKey`, `groupEntriesByDay`, `CalendarCell` und `buildCalendarGrid` bleiben unangetastet.

```typescript
export interface DayTotals {
  totalStoolFrequency: number;
  worstPainLevel: number;
  hasBlood: boolean;
}

export function sumDayTotals(entries: DiaryEntryWithTriggers[]): DayTotals {
  return {
    totalStoolFrequency: entries.reduce((total, entry) => total + entry.stoolFrequency, 0),
    worstPainLevel: entries.reduce((worst, entry) => Math.max(worst, entry.painLevel), 0),
    hasBlood: entries.some((entry) => entry.hasBlood),
  };
}

export function rateDayTotals(totals: DayTotals): DayRating {
  if (totals.hasBlood) {
    return 'bad';
  }
  if (totals.worstPainLevel >= 7 || totals.totalStoolFrequency >= 8) {
    return 'bad';
  }
  if (totals.worstPainLevel >= 4 || totals.totalStoolFrequency >= 5) {
    return 'medium';
  }
  return 'good';
}

export function rateDiaryEntry(entry: DiaryEntryWithTriggers): DayRating {
  return rateDayTotals({
    totalStoolFrequency: entry.stoolFrequency,
    worstPainLevel: entry.painLevel,
    hasBlood: entry.hasBlood,
  });
}

export function rateDayEntries(entries: DiaryEntryWithTriggers[]): DayRating {
  return rateDayTotals(sumDayTotals(entries));
}
```

Falls `RATING_SEVERITY` dadurch nirgends mehr verwendet wird, entferne die Konstante. Die Typprüfung meldet ungenutzte Konstanten nicht — sieh selbst nach.

- [ ] **Step 5: Tests laufen lassen und Erfolg bestätigen**

Ausführen: `npx.cmd vitest run src/features/diary/calendarLogic.test.ts`

Erwartet: BESTANDEN.

- [ ] **Step 6: Vollständigen Testlauf und Typprüfung**

Ausführen: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false`

Erwartet: Alle Tests bestanden, Typprüfung ohne Ausgabe. Schlagen Tests in `flareWarning.test.ts` fehl, prüfe für jeden von Hand nach, ob die neue Erwartung unter der Summenregel korrekt ist, passe sie an und notiere den Rechenweg im Bericht.

- [ ] **Step 7: Committen**

```bash
git add colitis-app/src/features/diary/calendarLogic.ts colitis-app/src/features/diary/calendarLogic.test.ts
git commit -m "fix: Tag anhand zusammengerechneter Werte statt des schlimmsten Eintrags bewerten"
```

Falls `flareWarning.test.ts` angepasst werden musste, gehört sie mit in denselben Commit.

---

### Task 2: Verlaufschart auf Tagessummen umstellen

**Files:**
- Modify: `colitis-app/src/features/diary/trendLogic.ts`
- Modify: `colitis-app/src/features/diary/components/DiaryTrendChart.tsx`
- Test: `colitis-app/src/features/diary/trendLogic.test.ts`

**Interfaces:**
- Consumes aus Task 1: nichts unmittelbar; die Zusammenrechnungsregel ist dieselbe (Häufigkeit summieren, Schmerz höchster Wert)
- Produces:
  - `interface DailyTrendPoint { date: string; worstPainLevel: number | null; totalStoolFrequency: number | null; }` — ersetzt `DailyAverage`
  - `buildDailyTrend(entries: DiaryEntryWithTriggers[], rangeDays: TrendRangeDays, referenceDate?: Date): DailyTrendPoint[]` — ersetzt `buildDailyAverages`
  - `TrendRangeDays` bleibt unverändert

Ein Tag ohne Einträge behält `null` in beiden Werten — daran hängt die Leerdarstellung des Charts.

Die Umbenennung ist Teil des Auftrags, nicht optional: Felder, die eine Summe enthalten, dürfen nicht `average…` heißen.

**Nicht verwechseln:** In `src/features/diary/analysis.ts` gibt es ebenfalls ein Feld `averagePainLevel`. Das gehört zur Auslöser-Auswertung, mittelt weiterhin zu Recht und wird **nicht** angefasst.

- [ ] **Step 1: Tests anpassen**

In `colitis-app/src/features/diary/trendLogic.test.ts` den Import ändern:

```typescript
import { buildDailyTrend } from './trendLogic';
```

Ersetze im gesamten Testblock jeden Aufruf `buildDailyAverages(` durch `buildDailyTrend(`, jedes `.averagePainLevel` durch `.worstPainLevel` und jedes `.averageStoolFrequency` durch `.totalStoolFrequency`. Benenne den `describe`-Block zu `describe('buildDailyTrend', …)` um.

Danach die Erwartungen der Tests korrigieren, die tatsächlich Zahlen prüfen. Rechne jeden von Hand nach und notiere den Rechenweg im Bericht. Zur Orientierung: Ein Test, der bislang bei zwei Einträgen mit Schmerz 2 und 5 den Durchschnitt 3,5 erwartete, erwartet jetzt den höchsten Wert 5; erwartete er bei Häufigkeiten 2 und 3 den Durchschnitt 2,5, erwartet er jetzt die Summe 5. Tests, die nur Länge, Reihenfolge oder `null` bei leeren Tagen prüfen, bleiben unverändert.

Ergänze am Ende des Blocks:

```typescript
  it('adds up the frequencies of a day split across entries', () => {
    const entries = [
      makeEntry({ occurredAt: '2026-07-20T08:00:00.000Z', stoolFrequency: 5, painLevel: 0 }),
      makeEntry({ occurredAt: '2026-07-20T20:00:00.000Z', stoolFrequency: 4, painLevel: 0 }),
    ];
    const days = buildDailyTrend(entries, 7, REFERENCE_DATE);
    const day = days.find((candidate) => candidate.date === '2026-07-20');
    expect(day?.totalStoolFrequency).toBe(9);
  });

  it('takes the highest pain level of a split day, not the average', () => {
    const entries = [
      makeEntry({ occurredAt: '2026-07-20T08:00:00.000Z', stoolFrequency: 0, painLevel: 0 }),
      makeEntry({ occurredAt: '2026-07-20T20:00:00.000Z', stoolFrequency: 0, painLevel: 8 }),
    ];
    const days = buildDailyTrend(entries, 7, REFERENCE_DATE);
    const day = days.find((candidate) => candidate.date === '2026-07-20');
    expect(day?.worstPainLevel).toBe(8);
  });
```

Die vorhandene Testdatei besitzt bereits eine Konstante `REFERENCE_DATE` und eine Hilfsfunktion zum Anlegen von Einträgen. Verwende beide in ihrer vorhandenen Form; heißt die Hilfsfunktion anders als `makeEntry`, passe die beiden neuen Tests entsprechend an, statt eine zweite Hilfsfunktion anzulegen. Stimmt `REFERENCE_DATE` nicht mit dem 20. Juli 2026 überein, wähle in beiden neuen Tests ein Datum, das innerhalb der letzten sieben Tage vor `REFERENCE_DATE` liegt, und passe die erwartete Datumszeichenkette an.

- [ ] **Step 2: Tests laufen lassen und Fehlschlag bestätigen**

Ausführen: `npx.cmd vitest run src/features/diary/trendLogic.test.ts`

Erwartet: FEHLER — `buildDailyTrend` existiert noch nicht.

- [ ] **Step 3: trendLogic.ts umsetzen**

Datei `colitis-app/src/features/diary/trendLogic.ts` vollständig ersetzen:

```typescript
import { groupEntriesByDay, formatDateKey } from './calendarLogic';
import type { DiaryEntryWithTriggers } from './types';

export type TrendRangeDays = 7 | 30 | 90;

export interface DailyTrendPoint {
  date: string;
  worstPainLevel: number | null;
  totalStoolFrequency: number | null;
}

export function buildDailyTrend(
  entries: DiaryEntryWithTriggers[],
  rangeDays: TrendRangeDays,
  referenceDate: Date = new Date()
): DailyTrendPoint[] {
  const entriesByDay = groupEntriesByDay(entries);
  const days: DailyTrendPoint[] = [];

  for (let offset = rangeDays - 1; offset >= 0; offset--) {
    const day = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - offset);
    const dateKey = formatDateKey(day);
    const dayEntries = entriesByDay.get(dateKey) ?? [];

    days.push({
      date: dateKey,
      worstPainLevel:
        dayEntries.length === 0
          ? null
          : dayEntries.reduce((worst, entry) => Math.max(worst, entry.painLevel), 0),
      totalStoolFrequency:
        dayEntries.length === 0
          ? null
          : dayEntries.reduce((total, entry) => total + entry.stoolFrequency, 0),
    });
  }

  return days;
}
```

Die bisherigen Hilfsfunktionen `roundToOneDecimal` und `averageOf` entfallen ersatzlos — Summen und Höchstwerte ganzer Zahlen sind wieder ganze Zahlen.

- [ ] **Step 4: DiaryTrendChart.tsx anpassen**

In `colitis-app/src/features/diary/components/DiaryTrendChart.tsx` sechs Stellen ändern:

Import:
```tsx
import { buildDailyTrend } from '../trendLogic';
import type { DailyTrendPoint, TrendRangeDays } from '../trendLogic';
```

`resolveStoolFrequencyMax`:
```tsx
function resolveStoolFrequencyMax(days: DailyTrendPoint[]): number {
  const values = days
    .map((day) => day.totalStoolFrequency)
    .filter((value): value is number => value !== null);
  if (values.length === 0) {
    return MIN_STOOL_FREQUENCY_SCALE;
  }
  return Math.max(MIN_STOOL_FREQUENCY_SCALE, ...values);
}
```

`hasAnyData`:
```tsx
function hasAnyData(days: DailyTrendPoint[]): boolean {
  return days.some((day) => day.worstPainLevel !== null || day.totalStoolFrequency !== null);
}
```

`BarRowProps`:
```tsx
interface BarRowProps {
  days: DailyTrendPoint[];
  valueKey: 'worstPainLevel' | 'totalStoolFrequency';
  maxValue: number;
  barColor: string;
}
```

Aufbau der Tagesliste:
```tsx
  const days = buildDailyTrend(entries, rangeDays);
```

Die beiden `BarRow`-Aufrufe:
```tsx
          <BarRow days={days} valueKey="worstPainLevel" maxValue={PAIN_LEVEL_SCALE} barColor={colors.danger} />
```
und
```tsx
          <BarRow days={days} valueKey="totalStoolFrequency" maxValue={stoolFrequencyMax} barColor={colors.primary} />
```

Die Überschriften „Schmerzlevel" und „Stuhlgang-Häufigkeit" bleiben unverändert, ebenso alle Stile und Konstanten.

- [ ] **Step 5: Tests laufen lassen und Erfolg bestätigen**

Ausführen: `npx.cmd vitest run src/features/diary/trendLogic.test.ts`

Erwartet: BESTANDEN.

- [ ] **Step 6: Vollständigen Testlauf und Typprüfung**

Ausführen: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false`

Erwartet: Alle Tests bestanden, Typprüfung ohne Ausgabe. Meldet die Typprüfung noch `averagePainLevel` oder `averageStoolFrequency`, ist eine Fundstelle im Chart übersehen worden.

- [ ] **Step 7: Committen**

```bash
git add colitis-app/src/features/diary/trendLogic.ts colitis-app/src/features/diary/trendLogic.test.ts colitis-app/src/features/diary/components/DiaryTrendChart.tsx
git commit -m "fix: Verlaufschart auf Tagessumme und hoechsten Schmerzwert umstellen"
```

---

### Task 3: Anzeige und kleine Nachbesserungen

**Files:**
- Modify: `colitis-app/src/features/diary/quickEntryLogic.ts`
- Test: `colitis-app/src/features/diary/quickEntryLogic.test.ts`
- Modify: `colitis-app/app/(tabs)/tagebuch/schnell.tsx`
- Modify: `colitis-app/app/(tabs)/tagebuch/index.tsx`

**Interfaces:**
- Consumes: vorhandene `findTodaysEntry(entries, now)` aus derselben Datei; `formatDateKey` aus `./calendarLogic`
- Produces:
  - `interface TodaySummary { entryCount: number; totalStoolFrequency: number; hasBlood: boolean; }`
  - `summarizeToday(entries: DiaryEntryWithTriggers[], now: Date): TodaySummary`

`findTodaysEntry`, `worseConsistency`, `buildQuickEntryInput`, `buildQuickEntryUpdate` und `STOOL_CONSISTENCY_SEVERITY` bleiben unverändert. **Wichtig:** `findTodaysEntry` bleibt die Grundlage der Entscheidung zwischen Anlegen und Hochzählen. `summarizeToday` dient ausschließlich der Anzeige. Diese Trennung darf nicht aufgeweicht werden — sie ist der Grund, warum der Schnell-Eintrag zuverlässig nur einen Eintrag pro Tag erzeugt.

Exakte deutsche Texte für diese Aufgabe:

| Stelle | Text |
|---|---|
| Zähler mit Einträgen | `Heute: {Summe} erfasst` |
| Zusatzzeile bei mehreren Einträgen | `verteilt auf {Anzahl} Einträge` |
| Statusbanner während des Exports | `Export wird erstellt …` |
| Schaltfläche im Hinweisdialog ohne Einträge | `OK` |
| Screenreader-Beschriftung des Plus-Knopfes | `Schnell-Eintrag öffnen` |

- [ ] **Step 1: Fehlschlagende Tests für summarizeToday schreiben**

Am Ende von `colitis-app/src/features/diary/quickEntryLogic.test.ts` einfügen. Die Datei besitzt bereits die Hilfsfunktionen `localIso` und `makeEntry` — beide weiterverwenden.

```typescript
describe('summarizeToday', () => {
  const now = new Date(2026, 6, 27, 18, 0, 0);

  it('reports an empty day', () => {
    expect(summarizeToday([], now)).toEqual({
      entryCount: 0,
      totalStoolFrequency: 0,
      hasBlood: false,
    });
  });

  it('adds up the frequencies of every entry from today', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: localIso(2026, 6, 27, 8), stoolFrequency: 5 }),
      makeEntry({ id: 2, occurredAt: localIso(2026, 6, 27, 20), stoolFrequency: 4 }),
    ];
    const summary = summarizeToday(entries, now);
    expect(summary.entryCount).toBe(2);
    expect(summary.totalStoolFrequency).toBe(9);
  });

  it('ignores entries from other days', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: localIso(2026, 6, 26, 8), stoolFrequency: 7 }),
      makeEntry({ id: 2, occurredAt: localIso(2026, 6, 27, 9), stoolFrequency: 2 }),
    ];
    const summary = summarizeToday(entries, now);
    expect(summary.entryCount).toBe(1);
    expect(summary.totalStoolFrequency).toBe(2);
  });

  it('reports blood when any entry of the day recorded it', () => {
    const entries = [
      makeEntry({ id: 1, occurredAt: localIso(2026, 6, 27, 8), hasBlood: true }),
      makeEntry({ id: 2, occurredAt: localIso(2026, 6, 27, 20), hasBlood: false }),
    ];
    expect(summarizeToday(entries, now).hasBlood).toBe(true);
  });

  it('does not report blood when no entry of the day recorded it', () => {
    const entries = [makeEntry({ id: 1, occurredAt: localIso(2026, 6, 27, 8), hasBlood: false })];
    expect(summarizeToday(entries, now).hasBlood).toBe(false);
  });
});
```

Ergänze `summarizeToday` in der Import-Zeile der Testdatei.

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Ausführen: `npx.cmd vitest run src/features/diary/quickEntryLogic.test.ts`

Erwartet: FEHLER — `summarizeToday is not a function`.

- [ ] **Step 3: summarizeToday umsetzen**

Am Ende von `colitis-app/src/features/diary/quickEntryLogic.ts` ergänzen:

```typescript
export interface TodaySummary {
  entryCount: number;
  totalStoolFrequency: number;
  hasBlood: boolean;
}

export function summarizeToday(entries: DiaryEntryWithTriggers[], now: Date): TodaySummary {
  const todayKey = formatDateKey(now);
  const todaysEntries = entries.filter(
    (entry) => formatDateKey(new Date(entry.occurredAt)) === todayKey
  );

  return {
    entryCount: todaysEntries.length,
    totalStoolFrequency: todaysEntries.reduce((total, entry) => total + entry.stoolFrequency, 0),
    hasBlood: todaysEntries.some((entry) => entry.hasBlood),
  };
}
```

- [ ] **Step 4: Test laufen lassen und Erfolg bestätigen**

Ausführen: `npx.cmd vitest run src/features/diary/quickEntryLogic.test.ts`

Erwartet: BESTANDEN.

- [ ] **Step 5: Schnell-Eintrag auf die Tageszusammenfassung umstellen**

In `colitis-app/app/(tabs)/tagebuch/schnell.tsx`:

Import erweitern — `summarizeToday` und der Typ `TodaySummary` kommen hinzu, `findTodaysEntry`, `buildQuickEntryInput` und `buildQuickEntryUpdate` bleiben:

```tsx
import {
  findTodaysEntry,
  summarizeToday,
  buildQuickEntryInput,
  buildQuickEntryUpdate,
} from '../../../src/features/diary/quickEntryLogic';
```
```tsx
import type { TodaySummary } from '../../../src/features/diary/quickEntryLogic';
```

Die Zustandsvariable `todaysEntry` wird durch `summary` ersetzt. Die Zeile

```tsx
  const [todaysEntry, setTodaysEntry] = useState<DiaryEntryWithTriggers | null>(null);
```

wird zu:

```tsx
  const [summary, setSummary] = useState<TodaySummary>({
    entryCount: 0,
    totalStoolFrequency: 0,
    hasBlood: false,
  });
```

Der Import von `DiaryEntryWithTriggers` wird dadurch möglicherweise unnötig — entferne ihn dann.

Im Ladevorgang innerhalb von `useFocusEffect` wird
```tsx
            setTodaysEntry(findTodaysEntry(entries, new Date()));
```
zu
```tsx
            setSummary(summarizeToday(entries, new Date()));
```

In `handleSelectConsistency` wird
```tsx
        setTodaysEntry(findTodaysEntry(entries, new Date()));
```
zu
```tsx
        setSummary(summarizeToday(entries, new Date()));
```

Die Entscheidung zwischen Anlegen und Hochzählen bleibt unverändert bei `findTodaysEntry(await listDiaryEntries(db), new Date())` — daran wird nichts geändert.

Zusätzlich in derselben Funktion die Zeile `setIsSaving(true);` **in** den `try`-Block verschieben, direkt hinter die öffnende Klammer. `isSavingRef.current = true;` bleibt davor stehen. Grund: Würde `setIsSaving` je werfen, bliebe der Ref-Wächter sonst dauerhaft gesetzt und der Bildschirm für alle weiteren Tipps tot.

Zähler und Blut-Hinweis:

```tsx
  const countLabel = isLoading
    ? 'wird geladen …'
    : summary.entryCount === 0
    ? 'Heute noch nichts erfasst'
    : `Heute: ${summary.totalStoolFrequency} erfasst`;

  const isBloodAlreadyRecorded = summary.hasBlood;
  const areButtonsDisabled = isLoading || isSaving;
```

Und im JSX direkt unter der Zeile mit `styles.countText` einfügen:

```tsx
      {!isLoading && summary.entryCount > 1 && (
        <Text style={styles.splitNote}>verteilt auf {summary.entryCount} Einträge</Text>
      )}
```

Dazu in `makeStyles` ergänzen:

```tsx
    splitNote: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginTop: -tokens.spacing.md,
      marginBottom: tokens.spacing.lg,
    },
```

- [ ] **Step 6: Rückmeldung während des Exports und zwei Kleinigkeiten**

In `colitis-app/app/(tabs)/tagebuch/index.tsx`:

Im JSX direkt unterhalb des vorhandenen Fehlerbanner-Blocks (`{error && ( … )}`) einfügen:

```tsx
      {isExporting && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>Export wird erstellt …</Text>
        </View>
      )}
```

In `makeStyles` ergänzen:

```tsx
    statusBanner: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.primary,
      padding: tokens.spacing.sm,
    },
    statusText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
    },
```

Im Hinweisdialog ohne Einträge die Schaltfläche von `Abbrechen` auf `OK` ändern — es gibt dort nichts abzubrechen:

```tsx
      Alert.alert('Tagebuch exportieren', 'Noch keine Einträge zum Exportieren.', [
        { text: 'OK', style: 'cancel' },
      ]);
```

Beim Plus-Knopf die Screenreader-Beschriftung an das neue Ziel anpassen:

```tsx
        accessibilityLabel="Schnell-Eintrag öffnen"
```

- [ ] **Step 7: Typprüfung und vollständiger Testlauf**

Ausführen: `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run`

Erwartet: Typprüfung ohne Ausgabe, alle Tests bestanden.

- [ ] **Step 8: Committen**

```bash
git add colitis-app/src/features/diary/quickEntryLogic.ts colitis-app/src/features/diary/quickEntryLogic.test.ts colitis-app/app/\(tabs\)/tagebuch/schnell.tsx colitis-app/app/\(tabs\)/tagebuch/index.tsx
git commit -m "fix: Tageswert im Schnell-Eintrag ueber alle Eintraege zeigen und Export-Rueckmeldung ergaenzen"
```

---

## Nachtrag zur manuellen Abnahme

Zusätzlich zu den bereits notierten zehn Punkten:

11. Am selben Tag über den Schnell-Eintrag und über das ausführliche Formular je einen Eintrag anlegen. Der Zähler im Schnell-Eintrag zeigt die Summe beider und darunter „verteilt auf 2 Einträge".
12. Ein so geteilter Tag mit zusammen mindestens acht Stuhlgängen wird im Kalender rot dargestellt, nicht gelb.
13. Während ein PDF- oder CSV-Export läuft, erscheint „Export wird erstellt …" über der Liste.
