# Colitis2Go: Umbenennung, Theme-System und Wortwitze des Tages

Datum: 2026-07-17

## Kontext

Die App heißt aktuell "Colitis-App" (`app.json` name, Android-Label, Splashscreen sowie der Text im PIN-/Biometrie-Entsperr-Dialog). Der Nutzer möchte die App in "Colitis2Go" umbenennen und die Einstellungen um ein Theme-System sowie ein optionales "Wortwitze des Tages"-Feature erweitern. Aktuell hat die App nur ein einziges, fest verdrahtetes Farbschema (`src/styles/tokens.ts`), keinen Theme-Context, und Toggles nutzen die native React-Native-`Switch`-Komponente.

## 1. App-Umbenennung

Nur sichtbare Stellen werden umbenannt:

- `app.json`: `"name": "Colitis2Go"` → wirkt sich auf Android-App-Label und Splashscreen-Titel aus.
- [`src/features/appLock/components/LockScreen.tsx`](../../../colitis-app/src/features/appLock/components/LockScreen.tsx): `"Colitis-App entsperren"` → `"Colitis2Go entsperren"` (zwei Vorkommen, Biometrie-Prompt-Text).

**Bewusst NICHT umbenannt** (technische IDs, Änderung wäre riskant/unnötig):

- Android-Package `com.anonymous.colitisapp`
- EAS-Projektname/Slug `colitis-app`
- Ordnername `colitis-app/`
- News-Feed-Repo-Referenz `colitis-app-feed` in [`src/features/newsFeed/constants.ts`](../../../colitis-app/src/features/newsFeed/constants.ts) (`FEED_URL` zeigt auf ein real existierendes GitHub-Repo mit diesem Namen — Umbenennung würde den Feed brechen)
- `package.json` `"name"` (npm-Paketname, nicht nutzersichtbar)

## 2. Theme-System

### Architektur

- Neuer `ThemeContext` in `src/theme/ThemeContext.tsx`: React Context, hält `themeId: 'light' | 'dark' | 'light-blue'` und leitet daraus das aktive `colors`-Objekt ab. `tokens.spacing`, `tokens.typography`, `tokens.radius` bleiben themenunabhängig und unverändert.
- `src/theme/palettes.ts`: die drei Farbpaletten als reine Datenobjekte (siehe Tabelle unten), gleiche Schlüssel wie das bestehende `colors`-Objekt in `src/styles/tokens.ts`.
- `useTheme()`-Hook liefert `{ themeId, colors, setThemeId }`.
- **Persistenz:** `@react-native-async-storage/async-storage` (neue Abhängigkeit, via `npx expo install`). Begründung: SecureStore ist für Secrets (PIN) gedacht; AsyncStorage ist das Standardwerkzeug für einfache, nicht-sensible UI-Präferenzen und vermeidet eine semantisch falsche Wiederverwendung.
- Migration bestehender Screens: Screens, die aktuell `tokens.colors.xyz` direkt importieren, lesen künftig `colors` aus `useTheme()`. Das ist nötig, damit Dark Mode / Blau-Weiß-Theme tatsächlich app-weit greifen, nicht nur im Einstellungen-Screen selbst.
- Default beim ersten Start (kein gespeicherter Wert): `'light'` — identisch zum aktuellen, einzigen Farbschema. Keine Verhaltensänderung für bestehende Installationen ohne explizite Nutzeraktion.

### Farbpaletten

| Token | Hell (bestehend, unverändert) | Dunkel (neu) | Hell Blau-Weiß (neu) |
|---|---|---|---|
| background | `#FBF6EF` | `#1C1A17` | `#F3F7FB` |
| surface | `#FFFFFF` | `#262320` | `#FFFFFF` |
| textPrimary | `#2E2A26` | `#F3EDE4` | `#1D2B36` |
| textSecondary | `#6B6259` | `#B8AFA3` | `#5B6B78` |
| primary | `#5B8C7B` | `#7BAF9C` | `#3E7CB1` |
| accent | `#D98E4A` | `#E3A768` | `#D98E4A` |
| danger | `#B5533C` | `#E07A5F` | `#C1443A` |
| success | = primary | = primary | = primary |
| border | `#E4DACB` | `#3A362F` | `#D7E3ED` |
| overlay | `rgba(46, 42, 38, 0.4)` | `rgba(0, 0, 0, 0.6)` | `rgba(29, 43, 54, 0.4)` |

(`success` folgt der bestehenden Konvention in `tokens.ts`, wo `success === primary`.)

### UI in den Einstellungen

Neue Sektion "Darstellung" im Einstellungen-Screen, oberhalb von "App-Sperre":

- Drei Karten/Segmente nebeneinander (Hell / Dunkel / Blau-Weiß), aktives Theme farblich hervorgehoben (Rahmen/Hintergrund in `colors.primary`). Exklusive Auswahl (Radio-Verhalten), kein Slider-Toggle — die drei Optionen schließen sich gegenseitig aus.
- Auswahl ruft `setThemeId(id)` auf, das sofort in AsyncStorage persistiert und den Context aktualisiert (kein expliziter Speichern-Button nötig).

## 3. `SliderToggle`-Komponente

Neue Komponente `src/components/SliderToggle.tsx`, ersetzt den nativen `<Switch>` überall in der App:

- Eigener Track (Pill-Form, `tokens.radius.pill`) mit rundem Knopf, der animiert von links (aus) nach rechts (an) slidet.
- Track-Farbe an: `colors.primary`, aus: `colors.border`. Knopf: `colors.surface`.
- Props: `{ value: boolean; onValueChange: (value: boolean) => void; accessibilityLabel: string }` — gleiche Schnittstelle wie `Switch`, damit der Austausch an bestehenden Stellen minimal-invasiv ist.
- Ersetzt den bestehenden App-Sperre-Switch im Einstellungen-Screen (Konsistenz: alle Toggles sehen einheitlich aus, kein Mix aus nativem OS-Switch und custom Komponente).
- Wird auch für den neuen "Wortwitze des Tages"-Toggle verwendet.

## 4. Wortwitze des Tages

- `src/features/dailyJoke/jokes.ts`: statische Liste von ca. 60 harmlosen, allgemeinen deutschen Wortwitzen (kein Gesundheits-/Krankheitsbezug — reiner Wortwitz-Humor als kleiner Stimmungsaufheller).
- `src/features/dailyJoke/pickJokeForDate.ts`: reine Funktion `pickJokeForDate(date: Date, jokes: string[]): string`, wählt deterministisch einen Witz pro Kalendertag (Datums-Hash Modulo Listenlänge) — am selben Tag erscheint bei mehrfachem App-Start immer derselbe Witz.
- Einstellung "Wortwitze des Tages an/aus" wird ebenfalls über AsyncStorage persistiert (eigener Key, unabhängig vom Theme).
- In `app/_layout.tsx`: nach den bestehenden Lade-Gates (Font-Preload, DB-Init) wird bei aktivierter Einstellung ein Modal mit dem Tageswitz eingeblendet — bei jedem App-Start (nicht auf "einmal pro Tag" limitiert), zeigt aber wegen der Datums-Deterministik am selben Tag denselben Witz.

## 5. Fehlerbehandlung

- AsyncStorage-Lesefehler beim Start (z.B. korrupter Speicher): Fallback auf Default-Theme `'light'` und Wortwitze-Einstellung `false` (aus), Fehler wird geloggt (`console.error`), aber blockiert den App-Start nicht.
- AsyncStorage-Schreibfehler beim Ändern einer Einstellung: Änderung wird trotzdem sofort im Context/State übernommen (optimistisches UI), Fehler wird geloggt; kein Blocking-Alert, da nicht kritisch (Einstellung geht im schlimmsten Fall beim nächsten Start verloren).

## 6. Testing

Konsistent mit bestehender Projekt-Konvention:

- TDD-getestet (Vitest): `pickJokeForDate` (Determinismus pro Datum, Modulo-Verhalten bei Listenlänge), Palette-Auflösung/`getColorsForTheme(themeId)`-Helper.
- Nicht getestet (Projekt-Konvention für UI): `SliderToggle`, Einstellungen-Screen-Sektion, Modal-Komponente, `ThemeContext`/`useTheme`-Hook selbst (reiner State-Wrapper ohne eigene Logik).

## Scope-Abgrenzung

- Keine Migration bestehender AsyncStorage-freier Daten nötig (neues Feature, keine Altdaten).
- Keine Server-/Feed-Anbindung für Wortwitze (rein lokal, siehe Brainstorming-Entscheidung).
- Kein "einmal pro Tag"-Tracking für das Modal — bewusst einfach gehalten (YAGNI), Anzeige bei jedem App-Start ist die vereinbarte Variante.
