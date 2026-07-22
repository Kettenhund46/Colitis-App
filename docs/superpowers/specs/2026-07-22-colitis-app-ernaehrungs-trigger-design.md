# Colitis2Go – Design: Ernährungs-Trigger im Tagebuch

*Status: Vom Nutzer (Adrian) genehmigt am 2026-07-22*
*Grundlage: bestehendes Trigger-System (`src/features/diary/constants.ts`, `formLogic.ts`, `db/diaryRepository.ts`), drittes Element aus dem Brainstorming vom 2026-07-21*

## Kontext & Ziel

Im Tagebuch-Formular lässt sich "Ernährung" bereits als eine von fünf Auslöser-Kategorien ankreuzen (neben Stress, Schlaf, Medikament, Sonstiges) — aber ohne Angabe, welches Lebensmittel konkret gemeint war. Ziel dieses Schritts: bei ausgewählter Ernährungs-Kategorie ein optionales Detail-Feld anbieten, welches Lebensmittel den Schub möglicherweise ausgelöst hat.

**Wichtiger Fund bei der Umsetzungsplanung:** Die Datenbanktabelle `triggers` hat bereits eine `note`-Spalte pro Auslöser-Zeile (`src/db/schema.ts:22`). Sie wird aktuell beim Speichern immer auf `null` gesetzt (`diaryRepository.ts:29`) und beim Lesen komplett verworfen (`diaryRepository.ts:57` extrahiert nur `.category`). Dieser Schritt verdrahtet diese bereits vorhandene Spalte nur für die Kategorie "Ernährung" — **keine Schema-Änderung nötig.**

## 1. Datenmodell

Neues Feld `foodTriggerNote: string | null` auf `NewDiaryEntryInput` und `DiaryEntryWithTriggers` (`src/features/diary/types.ts`).

**Speichern (`createDiaryEntry`):** Beim Einfügen der Auslöser-Zeilen bekommt nur die Zeile mit `category === 'ernaehrung'` den Wert aus `foodTriggerNote` in die `note`-Spalte; alle anderen Kategorien bleiben wie bisher `null`.

**Lesen (`listDiaryEntries`):** Aus den geladenen Auslöser-Zeilen eines Eintrags wird die Zeile mit `category === 'ernaehrung'` gesucht und ihr `note`-Wert als `foodTriggerNote` zurückgegeben (`null`, falls Ernährung nicht ausgewählt war oder kein Text eingegeben wurde).

## 2. Formular

Sobald `formState.triggerCategories` die Kategorie `'ernaehrung'` enthält, erscheint unterhalb der Auslöser-Auswahl ein neuer Abschnitt "Welches Lebensmittel? (optional)":

- Anklickbare Vorschlag-Chips: Kaffee, Milchprodukte, Gluten, Scharfes, Alkohol, Zucker (gleiche `choiceButton`-Optik wie die bestehenden Auswahl-Chips, aber ohne "ausgewählt"-Zustand — ein Tap fügt den Begriff nur hinzu).
- Ein Freitext-Feld darunter (gleiche Optik wie das bestehende Notiz-Feld), frei editierbar.
- Ein Chip-Tap hängt den Begriff kommagetrennt ans bestehende Feld an (`"Kaffee"` → Tap auf "Milchprodukte" → `"Kaffee, Milchprodukte"`); ist der Begriff bereits enthalten, passiert nichts (keine Duplikate).
- Wird "Ernährung" wieder abgewählt, verschwindet das Feld aus der Ansicht, der bereits eingegebene Text bleibt aber im Formular-Zustand erhalten (falls versehentlich abgewählt und wieder angewählt, geht nichts verloren). Erst beim tatsächlichen Speichern wird der Text verworfen, falls Ernährung zu dem Zeitpunkt nicht ausgewählt ist.
- Feld ist optional — ein Eintrag mit Ernährung als Auslöser lässt sich weiterhin ohne Lebensmittel-Angabe speichern.

## 3. Anzeige

Eine neue reine Funktion `buildTriggerLabels(categories: string[], foodTriggerNote: string | null): string[]` (in `src/features/diary/constants.ts`, neben dem bestehenden `labelFor`) wandelt Auslöser-Kategorien in Anzeige-Labels um und hängt bei der Kategorie "Ernährung" das Lebensmittel in Klammern an, sofern vorhanden: `"Ernährung (Kaffee, Milchprodukte)"`. Für alle anderen Kategorien identisch zu `labelFor(TRIGGER_CATEGORY_OPTIONS, category)`.

Diese eine Funktion ersetzt die bisherige `triggerCategories.map((c) => labelFor(TRIGGER_CATEGORY_OPTIONS, c))`-Zeile an den drei Stellen, die Auslöser-Labels anzeigen:

- `src/features/diary/components/DiaryHistoryList.tsx` (Verlaufsliste im Tagebuch-Tab)
- `src/features/diary/diaryPdfBuilder.ts` (PDF-Export)
- `src/features/diary/diaryCsvBuilder.ts` (CSV-Export)

## 4. Fehlerbehandlung

- Kein Lebensmittel eingegeben, Ernährung trotzdem ausgewählt → Eintrag speichert normal, `foodTriggerNote` ist `null` (wie jede andere optionale Notiz)
- Lebensmittel eingegeben, Ernährung aber nicht (mehr) ausgewählt → wird beim Speichern verworfen, nicht in der Datenbank abgelegt

## 5. Testing-Ansatz

- Unit-Tests (Vitest) für `buildTriggerLabels`: Ernährung ohne Notiz → reines Label, Ernährung mit Notiz → Label mit Klammer-Anhang, andere Kategorien unverändert, mehrere Kategorien gemischt in der richtigen Reihenfolge.
- Unit-Tests für die Chip-Anhänge-Logik (reine Funktion, z. B. `appendFoodSuggestion`): erster Chip auf leeres Feld, zweiter Chip mit Komma angehängt, Duplikat wird ignoriert, Chip auf Text mit Leerzeichen/Trailing-Komma robust.
- Erweiterung bestehender Tests für `buildDiaryEntryInput`/`createDiaryEntry`/`listDiaryEntries` (bereits vorhandene Testdateien) um Fälle mit/ohne `foodTriggerNote`, inklusive des Verwerfen-Falls (Notiz vorhanden, Kategorie aber nicht ausgewählt).
- UI-Komponente (`DiaryEntryForm.tsx`) selbst nicht automatisiert testbar in diesem Projekt (bestehendes Muster) — Verifikation über `tsc --noEmit` und manuellen Test.

## Explizit nicht Teil dieses Schritts

- Muster-Auswertung (`TriggerAnalysisView.tsx`) bleibt unverändert — sie gruppiert weiterhin nur nach Kategorie, nicht nach einzelnem Lebensmittel
- Freie Verwaltung/Bearbeitung der Vorschlagsliste durch den Nutzer (Liste ist fest im Code hinterlegt)
- Mehrere getrennte, strukturierte Lebensmittel-Einträge pro Diary-Eintrag (nur ein Freitext-Feld, das mehrere Begriffe komma-getrennt enthalten kann)

---

*Hinweis: Diese App ersetzt keine ärztliche Beratung. Diese Spec betrifft ausschließlich eine technische Erfassungs-/Anzeigefunktion, keine medizinischen Inhalte oder Ernährungsempfehlungen.*
