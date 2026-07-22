# Colitis2Go – Design: Verlaufs-Diagramm im Tagebuch

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-22*
*Grundlage: bestehendes Tagebuch-Feature (`src/features/diary/`) und Kalenderübersicht (`calendarLogic.ts`), fünftes Element der Offline-Feature-Roadmap*

## Kontext & Ziel

Die "Muster-Auswertung" (`app/(tabs)/tagebuch/auswertung.tsx`) zeigt aktuell nur Text-Karten mit dem durchschnittlichen Schmerzlevel pro Auslöser-Kategorie (`TriggerAnalysisView`). Ziel dieses Schritts: ein visuelles Balkendiagramm auf derselben Seite, das den zeitlichen Verlauf von Schmerzlevel und Stuhlgang-Häufigkeit über die letzten 7, 30 oder 90 Tage zeigt – damit Trends (Verschlechterung, Verbesserung) auf einen Blick sichtbar werden, statt nur Kategorien-Durchschnitte.

Keine neue Abhängigkeit: Das Diagramm wird als einfaches Balkendiagramm mit normalen React-Native-`View`-Elementen gebaut (Balkenhöhe proportional zum Wert), wie schon das Kalenderraster zuvor ohne externe Chart-Bibliothek umgesetzt wurde.

## 1. Tages-Aggregation

Neue reine Funktionen in `src/features/diary/trendLogic.ts`.

```typescript
export type TrendRangeDays = 7 | 30 | 90;

export interface DailyAverage {
  date: string; // YYYY-MM-DD, lokale Zeitzone
  averagePainLevel: number | null;
  averageStoolFrequency: number | null;
}

export function buildDailyAverages(
  entries: DiaryEntryWithTriggers[],
  rangeDays: TrendRangeDays,
  referenceDate?: Date
): DailyAverage[]
```

- Erzeugt genau `rangeDays` Einträge, für jeden Kalendertag von `referenceDate` (Standard: `new Date()`) rückwärts bis `rangeDays - 1` Tage davor, aufsteigend sortiert (ältester Tag zuerst).
- Gruppiert die übergebenen Einträge mit der bereits vorhandenen `groupEntriesByDay`-Funktion aus `src/features/diary/calendarLogic.ts` (DRY – keine zweite Implementierung der Tages-Gruppierung).
- Pro Tag: `averagePainLevel` = arithmetisches Mittel von `painLevel` aller Einträge dieses Tages, gerundet auf eine Nachkommastelle; `null`, falls keine Einträge an diesem Tag. Analog für `averageStoolFrequency` mit `stoolFrequency`.
- Ein Tag ganz ohne Eintrag ergibt `{ averagePainLevel: null, averageStoolFrequency: null }` – bewusst `null` statt `0`, damit ein "kein Eintrag"-Tag im Diagramm nicht wie ein "Schmerzlevel 0"-Tag aussieht.

## 2. Balkendiagramm-Komponente

Neue Komponente `src/features/diary/components/DiaryTrendChart.tsx`.

**Props:**
```typescript
interface DiaryTrendChartProps {
  entries: DiaryEntryWithTriggers[];
}
```

**Aufbau:**
- Eigener lokaler State für den gewählten Zeitraum (`useState<TrendRangeDays>(7)`), mit drei Umschalter-Buttons "7 Tage" / "30 Tage" / "90 Tage" (gleiche Optik wie der bestehende Liste/Kalender-Umschalter im Tagebuch-Tab).
- Berechnet `buildDailyAverages(entries, rangeDays)` bei jedem Render (reine, günstige Berechnung, kein `useMemo` nötig für diese Datenmengen).
- Zwei übereinander angeordnete Diagramm-Blöcke, je mit eigener Überschrift:
  1. **"Schmerzlevel"** – feste Skala 0–10 (bekannte Formular-Skala), y-Achsen-Maximum bleibt immer 10.
  2. **"Stuhlgang-Häufigkeit"** – dynamische Skala: Maximum ist der höchste `averageStoolFrequency`-Wert im sichtbaren Zeitraum, mindestens aber 5 (verhindert winzige Balken bei durchgehend niedrigen Werten).
- Pro Diagramm: horizontale Reihe von Balken, ein Balken pro Tag im Zeitraum. Balkenhöhe proportional zu `Wert / Maximum`. Tage mit `null`-Wert zeigen keinen Balken (Lücke), keine 0-Höhe-Sonderbehandlung nötig, da `null` einfach nichts rendert.
- Bei `rangeDays` 30 oder 90: die Balkenreihe liegt in einer horizontalen `ScrollView` mit fester Balkenbreite, damit alle Balken lesbar bleiben. Bei 7 Tagen passt die Reihe ohne Scrollen auf den Bildschirm.
- Datumsbeschriftung (Format `TT.MM.`) nur unterhalb des ersten und letzten Balkens des Zeitraums, um die Achse bei 90 Balken nicht zu überladen.
- Sind für den gesamten gewählten Zeitraum alle Werte `null` (keine Einträge), wird statt der Balken ein Hinweistext angezeigt: "Keine Daten in diesem Zeitraum."
- Farben ausschließlich über `useTheme()`/`ThemeColors` (Schmerzlevel-Balken z. B. `colors.danger`, Stuhlgang-Balken z. B. `colors.primary`), funktioniert in allen drei Themes.

## 3. Einbindung

`app/(tabs)/tagebuch/auswertung.tsx`:

- Rendert `<DiaryTrendChart entries={entries} />` direkt oberhalb der bestehenden `{isLoading ? ... : <TriggerAnalysisView patterns={patterns} />}`-Stelle, sobald `entries` geladen sind (gleicher Ladezustand, keine zusätzliche Datenbankabfrage – `entries` wird bereits geladen, um `patterns` zu berechnen).
- Die bestehende `TriggerAnalysisView`-Darstellung bleibt unverändert darunter bestehen.

## 4. Fehlerbehandlung

- Keine Tagebucheinträge insgesamt → Diagramm zeigt für jeden gewählten Zeitraum "Keine Daten in diesem Zeitraum." (kein Sonderfall in `buildDailyAverages` nötig, ergibt sich automatisch aus lauter `null`-Werten).
- Einträge vorhanden, aber alle außerhalb des gewählten Zeitraums (z. B. nur 90-Tage-Altdaten, aber "7 Tage" ausgewählt) → gleicher Hinweistext für diesen Zeitraum, andere Zeiträume können trotzdem Daten zeigen.
- Wechsel des Zeitraums während des Ladens der Muster-Auswertung → unkritisch, da `DiaryTrendChart` nur von `entries` abhängt, nicht vom Ladezustand der Trigger-Muster.

## 5. Testing-Ansatz

- Unit-Tests (Vitest) für `buildDailyAverages`: korrekte Anzahl Tage für 7/30/90, korrekte Rundung des Durchschnitts, Tag mit mehreren Einträgen (Mittelwert korrekt), Tag ohne Eintrag (`null`), aufsteigende Sortierung (ältester zuerst), Einträge außerhalb des Zeitraums werden ignoriert, `referenceDate`-Parameter wird respektiert (deterministisch testbar ohne von "heute" abzuhängen).
- UI-Komponente (`DiaryTrendChart.tsx`) wie bei den bisherigen Features nicht automatisiert testbar – Verifikation über `tsc --noEmit` und manuellen Test (inkl. Umschalten zwischen 7/30/90 Tagen, Scroll-Verhalten bei 30/90 Tagen, leerer Zustand, alle drei Themes).

## Explizit nicht Teil dieses Schritts

- Keine Änderung an `TriggerAnalysisView` oder `computeTriggerPatterns` selbst.
- Keine Liniendiagramme oder externe Chart-Bibliothek (`react-native-svg` o. Ä.).
- Keine benutzerdefinierten Zeiträume (nur die drei festen Stufen 7/30/90).
- Keine Anzeige weiterer Metriken (z. B. Blut im Stuhl, Symptome) im Diagramm – nur Schmerzlevel und Stuhlgang-Häufigkeit, wie abgestimmt.

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich eine technische Auswertungs-/Anzeigefunktion auf Basis bereits erfasster Daten, keine medizinischen Bewertungen oder Empfehlungen.*
