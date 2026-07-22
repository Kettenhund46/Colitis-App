# Colitis2Go – Design: Tagebuch-Kalenderübersicht

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-22*
*Grundlage: bestehendes Tagebuch-Feature (`src/features/diary/`), viertes Element der Offline-Feature-Roadmap*

## Kontext & Ziel

Das Tagebuch zeigt Einträge aktuell nur als chronologische Liste (`DiaryHistoryList`). Ziel dieses Schritts: eine Kalenderübersicht, die auf einen Blick zeigt, an welchen Tagen es gut, mittel oder schlecht lief – auf Basis der bereits erfassten Werte (Schmerzlevel, Blut im Stuhl, Stuhlgang-Häufigkeit). Keine neue Dateneingabe, keine Schema-Änderung – reine Auswertung bestehender `DiaryEntryWithTriggers`-Daten.

## 1. Farblogik

Neue reine Funktionen in `src/features/diary/calendarLogic.ts`.

**Einzel-Eintrag-Bewertung** `rateDiaryEntry(entry: DiaryEntryWithTriggers): 'good' | 'medium' | 'bad'`:

- `entry.hasBlood === true` → `'bad'`, unabhängig von allen anderen Werten
- sonst `entry.painLevel >= 7` ODER `entry.stoolFrequency >= 8` → `'bad'`
- sonst `entry.painLevel >= 4` ODER `entry.stoolFrequency >= 5` → `'medium'`
- sonst → `'good'`

Diese Schwellenwerte basieren auf den bestehenden Formular-Skalen (Schmerzlevel 0–10, Stuhlgang-Häufigkeit 0–20 pro Tag, siehe `DiaryEntryForm.tsx`).

**Tages-Aggregation** `groupEntriesByDay(entries: DiaryEntryWithTriggers[]): Map<string, DiaryEntryWithTriggers[]>`:

- Gruppiert Einträge nach lokalem Kalendertag, Schlüssel im Format `YYYY-MM-DD`, abgeleitet aus `entry.occurredAt` (lokale Zeitzone, nicht UTC).

**Tagesfarbe** `rateDayEntries(entries: DiaryEntryWithTriggers[]): 'good' | 'medium' | 'bad'`:

- Wendet `rateDiaryEntry` auf jeden Eintrag des Tages an und gibt den schlechtesten Wert zurück (Rangfolge: `'bad'` > `'medium'` > `'good'`).
- Erwartet mindestens einen Eintrag (wird nur für Tage mit Einträgen aufgerufen); Tage ganz ohne Eintrag werden von der aufrufenden Kalender-Komponente separat als neutral behandelt, nicht von dieser Funktion.

## 2. Monatsraster

Neue reine Funktion `buildCalendarGrid(year: number, month: number): CalendarCell[]` in `src/features/diary/calendarLogic.ts` (Monat 0-indiziert wie `Date`).

```typescript
export interface CalendarCell {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  isCurrentMonth: boolean;
}
```

- Erzeugt exakt 42 Zellen (6 Wochen × 7 Tage), Wochenstart Montag.
- Tage vor dem 1. des Monats und nach dem letzten Tag werden mit `isCurrentMonth: false` aus dem Vor-/Folgemonat aufgefüllt, damit das Raster immer vollständige Wochenreihen zeigt.

## 3. Kalender-Komponente

Neue Komponente `src/features/diary/components/DiaryCalendarView.tsx`.

**Props:**
```typescript
interface DiaryCalendarViewProps {
  entries: DiaryEntryWithTriggers[];
  onDeleteEntry: (entryId: number) => void;
}
```

**Aufbau:**
- Eigener State für den aktuell angezeigten Monat (`useState<{ year: number; month: number }>`, initial: aktueller Monat).
- Kopfzeile: "◀" Button, Monatsname + Jahr (deutsch, z. B. "Juli 2026"), "▶" Button. Beide Buttons verschieben den angezeigten Monat um ±1 (Jahreswechsel inklusive).
- Wochentags-Kopfzeile (Mo–So, deutsche Kurzformen).
- 7-spaltiges Raster aus `buildCalendarGrid(year, month)`. Pro Zelle:
  - Tageszahl
  - Farbiger Punkt/Hintergrund: `rateDayEntries(...)` der Einträge dieses Tages, sofern vorhanden (grün/gelb/rot); ohne Einträge neutral (Theme-`border`-Farbe, kein Akzent).
  - Zellen aus Vor-/Folgemonat (`isCurrentMonth: false`) werden abgeblendet dargestellt (reduzierte Opazität), bleiben aber antippbar, falls sie Einträge haben.
- Legende unterhalb des Rasters: "🟢 Gut · 🟡 Mittel · 🔴 Schub-verdächtig".
- Tap auf eine Zelle mit mindestens einem Eintrag setzt `selectedDate` (lokaler State); darunter erscheint eine Liste der Einträge dieses Tages (wiederverwendet `DiaryHistoryList` mit den gefilterten Einträgen und `onDelete={onDeleteEntry}`). Tap auf eine leere Zelle hat keine Wirkung. Erneuter Tap auf die bereits ausgewählte Zelle blendet die Liste wieder aus.
- Farben und Abstände nutzen `useTheme()`/`tokens` wie die bestehenden Diary-Komponenten (funktioniert in allen drei Themes inkl. Blau-Weiß).

## 4. Einbindung im Tagebuch-Tab

`app/(tabs)/tagebuch/index.tsx`:

- Neuer lokaler State `viewMode: 'list' | 'calendar'` (initial `'list'`).
- Zwei neue Pressables oberhalb der bestehenden Muster-Auswertung/Export-Buttons: "Liste" / "Kalender", gleiche Optik wie die bestehenden Export-Links (`styles.exportLink`-Muster, aktiver Zustand hervorgehoben wie bei den Auslöser-Chips in `DiaryEntryForm.tsx`).
- Je nach `viewMode` wird entweder die bestehende `DiaryHistoryList` oder die neue `DiaryCalendarView` gerendert; Lade-/Fehlerzustand, Muster-Auswertung-Link und Export-Buttons (PDF/CSV) bleiben in beiden Ansichten unverändert sichtbar, da sie auf denselben `entries`-State zugreifen.
- `DiaryCalendarView` bekommt `onDeleteEntry={handleDelete}` (bestehende Funktion, unverändert – zeigt weiterhin den Bestätigungsdialog vor dem Löschen).

## 5. Fehlerbehandlung

- Keine Einträge insgesamt → Kalender zeigt einen leeren, neutral eingefärbten Monat (kein Sonderfall nötig, `rateDayEntries` wird für Tage ohne Einträge nicht aufgerufen).
- Monat ohne Einträge → alle Tage neutral, Navigation (◀/▶) bleibt unverändert nutzbar.
- Löschen des letzten sichtbaren Eintrags eines ausgewählten Tages → Mini-Liste wird leer, Zelle verliert beim nächsten Rendern ihre Farbe (da `entries`-Prop nach `handleDelete` neu geladen wird, wie im bestehenden Lösch-Flow).

## 6. Testing-Ansatz

- Unit-Tests (Vitest) für `rateDiaryEntry`: alle Grenzfälle (genau an der Schwelle, darüber, darunter, Blut-Override auch bei niedrigem Schmerzlevel/Häufigkeit).
- Unit-Tests für `rateDayEntries`: ein Eintrag, mehrere Einträge gemischter Bewertung (worst-of-day), Reihenfolge-Unabhängigkeit.
- Unit-Tests für `groupEntriesByDay`: mehrere Einträge am selben Tag, Einträge an Tagesgrenzen (z. B. kurz vor/nach Mitternacht lokal), leere Eingabe.
- Unit-Tests für `buildCalendarGrid`: exakt 42 Zellen, korrekte `isCurrentMonth`-Flags, Monats-/Jahresübergänge (Dezember→Januar, Februar in Schaltjahren).
- UI-Komponenten (`DiaryCalendarView.tsx`, Umschalter im Tagebuch-Tab) wie bisher nicht automatisiert testbar – Verifikation über `tsc --noEmit` und manuellen Test.

## Explizit nicht Teil dieses Schritts

- Keine neuen Eingabefelder oder Schema-Änderungen.
- Keine Wochen- oder Jahresansicht, nur Monatsraster.
- Keine Änderung an der bestehenden `DiaryHistoryList`-Darstellung selbst (wird nur wiederverwendet, nicht verändert).
- Keine Anpassung der Schwellenwerte durch den Nutzer (fest im Code hinterlegt, wie bei den Ernährungs-Trigger-Vorschlägen).

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich eine technische Auswertungs-/Anzeigefunktion auf Basis bereits erfasster Daten, keine medizinischen Bewertungen oder Empfehlungen.*
