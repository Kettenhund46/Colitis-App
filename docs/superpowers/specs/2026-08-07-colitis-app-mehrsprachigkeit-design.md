# Mehrsprachigkeit (i18n) für Colitis2Go — Design

**Datum:** 2026-08-07
**Status:** Genehmigt

## Ziel

Colitis2Go unterstützt aktuell ausschließlich Deutsch, mit hartcodierten deutschen UI-Texten über die gesamte Codebase verteilt. Dieses Feature führt eine manuelle Sprachumschaltung zwischen Deutsch und Englisch ein, umgesetzt als eigene, leichte Lösung ohne externe i18n-Bibliothek.

## Nicht-Ziele

- Automatische Spracherkennung anhand der Gerätesprache (bewusst ausgeschlossen — nur manuelle Auswahl).
- Übersetzung der 6 medizinischen Wissensartikel-Inhalte (`src/features/knowledge/content/articles.ts`). Diese bleiben unabhängig von der gewählten Sprache immer auf Deutsch, um das Risiko fehlerhaft übersetzter medizinischer Fachinhalte und falscher Quellenzuordnung zu vermeiden.
- Unterstützung weiterer Sprachen über Englisch hinaus (kann später als eigenes, kleines Feature ergänzt werden, da die Architektur pro Sprache nur eine neue Dictionary-Datei benötigt).
- Pluralisierungsregeln, Datums-/Zahlenformat-Lokalisierung über das hinaus, was einzelne Screens bereits heute an Formatierung tun.

## Architektur

Ein neuer `LanguageContext` (`src/i18n/LanguageContext.tsx`) wird in `app/_layout.tsx` neben `ThemeProvider` und `SwipeNavigationProvider` gemountet und folgt exakt demselben Muster wie diese beiden: Er lädt die gespeicherte Sprache beim Mount asynchron aus `AsyncStorage` (mit `isActive`-Cleanup-Flag gegen Race Conditions bei schnellem Unmount), hält sie im State, und persistiert Änderungen fire-and-forget mit `.catch`-only Fehlerprotokollierung. Der Hook `useTranslation()` wirft bei fehlendem Provider-Kontext einen deutschen Fehler, wie es `useTheme()`/`useSwipeNavigation()` bereits tun.

`useTranslation()` liefert:
- `language: 'de' | 'en'`
- `setLanguage: (language: 'de' | 'en') => void`
- `t: (key: string, vars?: Record<string, string | number>) => string`

Übersetzungstexte liegen in Dictionary-Objekten, aufgeteilt nach fachlichen Namespaces analog zu den bestehenden Feature-Ordnern: `src/i18n/translations/de/*.ts` und `src/i18n/translations/en/*.ts` (z. B. `diary.ts`, `knowledge.ts`, `medications.ts`, `toilets.ts`, `settings.ts`, `common.ts` für geteilte Begriffe wie „Speichern"/„Abbrechen"). Pro Sprache werden die Namespace-Dateien zu einem verschachtelten Gesamtobjekt zusammengeführt und in `src/i18n/translations/index.ts` exportiert.

Ein Übersetzungs-Key ist ein Punktpfad-String, z. B. `t('settings.language.title')`. Dynamische Werte werden per einfacher `{{platzhalter}}`-Interpolation eingesetzt, z. B. `t('diary.entryNumber', { n: 3 })` mit Dictionary-Eintrag `"Eintrag Nr. {{n}}"`.

## Speicherung

`settingsStorage.ts` erhält zwei neue Funktionen nach dem exakten Muster von `getSwipeNavigationEnabled`/`setSwipeNavigationEnabled`:

```typescript
const LANGUAGE_KEY = 'colitis2go.settings.language';
const VALID_LANGUAGES: Language[] = ['de', 'en'];

export async function getLanguage(): Promise<Language> {
  const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
  return isLanguage(stored) ? stored : 'de';
}

export async function setLanguage(language: Language): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
}
```

`Language` ist ein neuer exportierter Typ `'de' | 'en'`, definiert in `src/i18n/types.ts` (analog zu `ThemeId` in `src/theme/types.ts`).

## UI: Sprachauswahl in den Einstellungen

In `app/(tabs)/einstellungen/index.tsx` kommt ein neuer Abschnitt „Sprache" hinzu (Reihenfolge: nach dem bestehenden „Navigation"-Abschnitt mit dem Swipe-Schalter). Da es sich um eine Auswahl aus mehr als zwei möglichen Werten handeln kann (auch wenn aktuell nur 2 Sprachen existieren), wird kein `SliderToggle` verwendet, sondern zwei nebeneinander angeordnete auswählbare Buttons („Deutsch" / „English"), von denen der aktive farblich hervorgehoben ist (gleiche Button-Optik wie bereits für die Theme-Auswahl im selben Screen verwendet — dort existiert bereits ein Muster für "mehrere auswählbare Optionen, eine aktiv" für `ThemeId`).

## Umfang der Umsetzung

Alle Dateien im Projekt, die zum Zeitpunkt der Umsetzung sichtbaren, hartcodierten deutschen UI-Text enthalten (Tab-Namen, Screen-Titel, Buttons, Labels, Platzhaltertexte, Fehlermeldungen, Bestätigungsdialoge, Zugänglichkeits-Labels), werden auf `t('...')`-Aufrufe umgestellt — mit alleiniger Ausnahme der Wissensartikel-Inhalte (siehe Nicht-Ziele). Die exakte Dateiliste wird zu Beginn der Implementierungsplanung per Suche neu ermittelt (der Codebestand wächst laufend), nicht aus einer im Voraus fixierten Liste übernommen.

## Fehlerbehandlung

- Fehlt ein Key in der aktuell aktiven Sprache, aber existiert er in der deutschen Dictionary, wird der deutsche Text als Fallback zurückgegeben (kein englischer Nutzer sieht einen rohen Schlüssel wegen einer vergessenen Übersetzung).
- Fehlt ein Key in beiden Dictionaries (Tippfehler im Aufruf), gibt `t()` den Key selbst als String zurück, statt zu werfen — sichtbar genug zum Debuggen während der Entwicklung, aber nie ein Absturz zur Laufzeit.
- Ein ungültiger/beschädigter Wert in `AsyncStorage` unter dem Sprach-Key wird wie bei `getThemeId` behandelt: Fällt still auf den Standardwert `'de'` zurück.

## Testing

Wie im Projekt üblich (React Native kann unter dem bestehenden Vitest-Setup nicht gerendert werden) werden ausschließlich framework-freie Logikteile automatisiert getestet:
- `t()`-Funktion: Key-Auflösung über verschachtelte Namespaces, Interpolation mit einem und mehreren Platzhaltern, Fallback von fehlendem Key in `en` auf `de`, Fallback von komplett fehlendem Key auf den Rohkey.
- `getLanguage`/`setLanguage` in `settingsStorage.ts`: Speichern, Lesen, Fallback auf `'de'` bei fehlendem/ungültigem gespeicherten Wert.

Die eigentliche UI-Umschaltung (wird beim Sprachwechsel wirklich überall englischer statt deutscher Text angezeigt?) wird manuell geprüft. `docs/superpowers/colitis-app-alltagstest-checkliste.md` erhält einen neuen Abschnitt „Sprachumschaltung" mit Stichproben-Checkpunkten über mehrere Screens (Tab-Namen, Tagebuch, Wissen, Medikamente, Toiletten, Einstellungen), inklusive der Prüfung, dass die Wissensartikel-Inhalte bei Englisch weiterhin auf Deutsch angezeigt werden (bewusstes, kein versehentliches Verhalten).

## Reihenfolge / Abhängigkeiten

Dieses Feature ist unabhängig von der zuvor umgesetzten Wischgeste-Funktion und hat keine Berührungspunkte mit deren Code außer der gemeinsamen Provider-Verschachtelung in `app/_layout.tsx`.
