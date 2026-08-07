# Mehrsprachigkeit (i18n) für Colitis2Go Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deutsch/Englisch-Sprachumschaltung für Colitis2Go einführen, mit einer eigenen leichten `t()`-Übersetzungslösung (kein externes i18n-Paket) und vollständiger Umstellung aller sichtbaren deutschen UI-Texte außer den 6 medizinischen Wissensartikeln.

**Architecture:** Ein `LanguageContext` (Muster identisch zu `ThemeContext`/`SwipeNavigationContext`) hält die aktuelle Sprache, persistiert sie über `settingsStorage.ts` in AsyncStorage, und liefert eine `t(key, vars?)`-Funktion, die verschachtelte Dictionary-Objekte (`de`/`en`, aufgeteilt in Namespace-Dateien pro Feature) auflöst. Framework-freie Logikdateien (Formular-Validierung, CSV/PDF-Builder, Benachrichtigungsinhalte), die aktuell direkt deutschen Text zurückgeben, bekommen `t` als zusätzlichen Funktionsparameter — sie bleiben dadurch weiterhin ohne React-Abhängigkeit testbar.

**Tech Stack:** React Native/Expo (TypeScript), keine neue Abhängigkeit. AsyncStorage für Persistenz (bereits vorhanden). Vitest für die automatisierten Tests der Logikteile.

## Global Constraints

- Referenz-Spec: `docs/superpowers/specs/2026-08-07-colitis-app-mehrsprachigkeit-design.md`.
- Unterstützte Sprachen: `'de' | 'en'`. Standard: `'de'`. Auswahl ausschließlich manuell in den Einstellungen — keine automatische Geräte-Spracherkennung.
- Die 6 Wissensartikel-Inhalte in `src/features/knowledge/content/articles.ts` werden **nicht angefasst** — sie bleiben immer Deutsch, unabhängig von der UI-Sprache. Diese Datei wird in keinem Task geöffnet oder verändert.
- Fehlt ein Key in der aktiven Sprache, aber existiert er in `de`, liefert `t()` den deutschen Text als Fallback. Fehlt er in beiden, liefert `t()` den rohen Key-String zurück (nie einen Absturz).
- **Architektur-Ergänzung gegenüber der Spec** (Implementierungsdetail, das die Spec offenlässt): Framework-freie `.ts`-Dateien ohne React-Zugriff (z. B. `formLogic.ts`, `diaryCsvBuilder.ts`, `medicationPassBuilder.ts`, `reminderContent.ts`, `sourceLabel.ts`) bekommen `t: (key: string, vars?: Record<string, string | number>) => string` als **zusätzlichen letzten Funktionsparameter** — sie rufen `useTranslation()` NICHT selbst auf (das ist ein Hook, nur in Komponenten gültig). Die aufrufende Komponente holt sich `t` per `useTranslation()` und reicht es durch. Bestehende Tests dieser Dateien werden so angepasst, dass sie einen lokalen Test-Translator `createTranslator(translations.de, translations.de)` übergeben — die erwarteten Textwerte in den Assertions bleiben dadurch identisch zu vorher (deutscher Text), nur der Funktionsaufruf bekommt ein zusätzliches Argument.
- HTML-Dokumente für PDF-Export (`diaryPdfBuilder.ts`, `medicationPassBuilder.ts`, `doctorVisitPassBuilder.ts`) bekommen zusätzlich einen `language: Language`-Parameter, ausschließlich um das `lang="de"`-Attribut durch `lang="${language}"` zu ersetzen.
- Sprachnamen im Sprachumschalter selbst (z. B. Button-Beschriftungen "Deutsch"/"English") werden **nicht** über `t()` übersetzt, sondern bleiben feste, sprachunabhängige Eigennamen (jede Sprache zeigt immer ihren eigenen nativen Namen).
- `CATEGORY_SUGGESTIONS` (`src/features/toilets/savedPlaceFormLogic.ts`: `'Arbeit', 'Freunde', 'Café', 'Sonstiges'`) bleiben unübersetzt — es sind freie Textvorschläge für ein Datenfeld (der Nutzer kann ohnehin per „Eigene Kategorie" jeden Text eingeben), keine feste UI-Vokabel. Eine Übersetzung würde dazu führen, dass in Deutsch und Englisch angelegte Orte unterschiedliche, nicht zusammengehörige Kategorie-Werte in der Datenbank hätten.
- Literale Datums-Platzhalterbeispiele in Formularen (z. B. `"2026-07-20"`, `"2027-01-15"`) sind keine deutschen Wörter und bleiben unverändert.
- Jede Task, die eine Namespace-Dictionary-Datei zum ersten Mal anlegt, gibt deren **vollständigen** Inhalt (alle Keys, die diese Datei je über alle Tasks hinweg braucht) — spätere Tasks, die dieselbe Feature-Namespace-Datei nur konsumieren, ändern sie nicht mehr. Ausnahme: `misc.ts` wird in Task 3 (Root-Layout-Keys) angelegt und in Task 12 um zwei weitere Blöcke ergänzt (explizit vermerkt in Task 12).
- Jede Task, die eine `.tsx`/`.ts`-Datei mit UI-Text migriert, muss `npx tsc --noEmit` (aus `colitis-app/colitis-app`) und die bestehende Test-Suite (`npm test`) fehlerfrei durchlaufen lassen, bevor sie committet.
- Nach Abschluss aller Tasks darf `git grep` nach den migrierten Original-Strings (außerhalb von `articles.ts`, Kommentaren und Git-History) keine Treffer mehr liefern (siehe Task 13).

---

## Task 1: i18n-Kern (Types, Übersetzungsfunktion, `common`-Namespace)

**Files:**
- Create: `src/i18n/types.ts`
- Create: `src/i18n/translate.ts`
- Create: `src/i18n/translate.test.ts`
- Create: `src/i18n/translations/de/common.ts`
- Create: `src/i18n/translations/en/common.ts`
- Create: `src/i18n/translations/de/index.ts`
- Create: `src/i18n/translations/en/index.ts`
- Create: `src/i18n/translations/index.ts`

**Interfaces:**
- Produces: `Language = 'de' | 'en'` (in `types.ts`), `TranslationDictionary` type, `createTranslator(active, fallback)` returning `(key, vars?) => string` (in `translate.ts`), `translations: { de: TranslationDictionary; en: TranslationDictionary }` (in `translations/index.ts`), each namespace's `common` object.

- [ ] **Step 1: Types**

`src/i18n/types.ts`:
```typescript
export type Language = 'de' | 'en';

export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}
```

- [ ] **Step 2: Write the failing tests for the translator**

`src/i18n/translate.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createTranslator } from './translate';
import type { TranslationDictionary } from './types';

describe('createTranslator', () => {
  const de: TranslationDictionary = {
    common: { save: 'Speichern', greeting: 'Hallo {{name}}' },
    onlyDe: { text: 'Nur Deutsch' },
  };
  const en: TranslationDictionary = {
    common: { save: 'Save', greeting: 'Hello {{name}}' },
  };

  it('resolves a nested key from the active dictionary', () => {
    const t = createTranslator(en, de);
    expect(t('common.save')).toBe('Save');
  });

  it('interpolates a single placeholder', () => {
    const t = createTranslator(en, de);
    expect(t('common.greeting', { name: 'Adrian' })).toBe('Hello Adrian');
  });

  it('interpolates multiple occurrences of the same placeholder', () => {
    const dictionary: TranslationDictionary = { msg: '{{n}} von {{n}}' };
    const t = createTranslator(dictionary, dictionary);
    expect(t('msg', { n: 3 })).toBe('3 von 3');
  });

  it('leaves an unmatched placeholder untouched', () => {
    const dictionary: TranslationDictionary = { msg: 'Wert: {{missing}}' };
    const t = createTranslator(dictionary, dictionary);
    expect(t('msg', { other: 1 })).toBe('Wert: {{missing}}');
  });

  it('falls back to the fallback dictionary when the key is missing in the active one', () => {
    const t = createTranslator(en, de);
    expect(t('onlyDe.text')).toBe('Nur Deutsch');
  });

  it('returns the raw key when missing in both dictionaries', () => {
    const t = createTranslator(en, de);
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('returns the raw key when the resolved value is not a string', () => {
    const t = createTranslator(de, de);
    expect(t('common')).toBe('common');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run (from `colitis-app/colitis-app`): `npx vitest run src/i18n/translate.test.ts`
Expected: FAIL with "Cannot find module './translate'"

- [ ] **Step 4: Implement the translator**

`src/i18n/translate.ts`:
```typescript
import type { TranslationDictionary } from './types';

function resolveKey(dictionary: TranslationDictionary, key: string): string | undefined {
  const parts = key.split('.');
  let current: string | TranslationDictionary | undefined = dictionary;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    return name in vars ? String(vars[name]) : match;
  });
}

export function createTranslator(
  activeDictionary: TranslationDictionary,
  fallbackDictionary: TranslationDictionary
): (key: string, vars?: Record<string, string | number>) => string {
  return function t(key: string, vars?: Record<string, string | number>): string {
    const resolved = resolveKey(activeDictionary, key) ?? resolveKey(fallbackDictionary, key) ?? key;
    return interpolate(resolved, vars);
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/i18n/translate.test.ts`
Expected: PASS, 7/7 tests.

- [ ] **Step 6: `common`-Namespace anlegen**

`src/i18n/translations/de/common.ts`:
```typescript
export const common = {
  cancel: 'Abbrechen',
  delete: 'Löschen',
  save: 'Speichern',
  edit: 'Bearbeiten',
  yes: 'Ja',
  no: 'Nein',
  ok: 'OK',
  close: 'Schließen',
  add: 'Hinzufügen',
  remove: 'Entfernen',
  route: 'Route dorthin',
  sharingUnavailable: 'Teilen ist auf diesem Gerät nicht verfügbar.',
};
```

`src/i18n/translations/en/common.ts`:
```typescript
export const common = {
  cancel: 'Cancel',
  delete: 'Delete',
  save: 'Save',
  edit: 'Edit',
  yes: 'Yes',
  no: 'No',
  ok: 'OK',
  close: 'Close',
  add: 'Add',
  remove: 'Remove',
  route: 'Directions',
  sharingUnavailable: 'Sharing is not available on this device.',
};
```

- [ ] **Step 7: Namespace-Merge pro Sprache und Gesamt-Export**

`src/i18n/translations/de/index.ts`:
```typescript
import { common } from './common';

export const de = { common };
```

`src/i18n/translations/en/index.ts`:
```typescript
import { common } from './common';

export const en = { common };
```

`src/i18n/translations/index.ts`:
```typescript
import { de } from './de';
import { en } from './en';

export const translations = { de, en };
```

- [ ] **Step 8: Typprüfung**

Run: `npx tsc --noEmit`
Expected: keine neuen Fehler.

- [ ] **Step 9: Commit**

```bash
git add src/i18n
git commit -m "feat: i18n-Kernfunktion (Types, Uebersetzer, common-Namespace)"
```

---

## Task 2: Sprache in `settingsStorage.ts` speichern/lesen

**Files:**
- Modify: `src/features/settings/settingsStorage.ts`
- Modify: `src/features/settings/settingsStorage.test.ts`

**Interfaces:**
- Consumes: `Language` type from `src/i18n/types.ts` (Task 1).
- Produces: `getLanguage(): Promise<Language>`, `setLanguage(language: Language): Promise<void>`.

- [ ] **Step 1: Failing tests**

Am Ende von `src/features/settings/settingsStorage.test.ts` (Datei existiert bereits — an bestehenden `describe`-Block-Stil anhängen, `AsyncStorage`-Mock ist bereits im Testfile konfiguriert, siehe bestehende Tests für `getThemeId`/`setThemeId` als Vorbild) diesen Block ergänzen:

```typescript
import { getLanguage, setLanguage } from './settingsStorage';

describe('getLanguage / setLanguage', () => {
  it('defaults to "de" when nothing is stored', async () => {
    expect(await getLanguage()).toBe('de');
  });

  it('returns the stored language', async () => {
    await setLanguage('en');
    expect(await getLanguage()).toBe('en');
  });

  it('falls back to "de" for an invalid stored value', async () => {
    await AsyncStorage.setItem('colitis2go.settings.language', 'fr');
    expect(await getLanguage()).toBe('de');
  });
});
```

(Falls die Testdatei `AsyncStorage` nicht bereits importiert, den vorhandenen Import am Dateianfang wiederverwenden — nicht doppelt importieren.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/settings/settingsStorage.test.ts`
Expected: FAIL — `getLanguage`/`setLanguage` not exported.

- [ ] **Step 3: Implementierung**

In `src/features/settings/settingsStorage.ts` den Import am Dateianfang erweitern und die Funktionen ans Dateiende anfügen:

```typescript
import type { Language } from '../../i18n/types';
```

```typescript
const LANGUAGE_KEY = 'colitis2go.settings.language';
const VALID_LANGUAGES: Language[] = ['de', 'en'];

function isLanguage(value: string | null): value is Language {
  return VALID_LANGUAGES.includes(value as Language);
}

export async function getLanguage(): Promise<Language> {
  const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
  return isLanguage(stored) ? stored : 'de';
}

export async function setLanguage(language: Language): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/features/settings/settingsStorage.test.ts`
Expected: PASS.

- [ ] **Step 5: Typprüfung**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/settingsStorage.ts src/features/settings/settingsStorage.test.ts
git commit -m "feat: Sprache in settingsStorage speichern und lesen"
```

---

## Task 3: `LanguageContext` + Mount in `app/_layout.tsx`

**Files:**
- Create: `src/i18n/LanguageContext.tsx`
- Create: `src/i18n/translations/de/misc.ts`
- Create: `src/i18n/translations/en/misc.ts`
- Modify: `src/i18n/translations/de/index.ts`
- Modify: `src/i18n/translations/en/index.ts`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `getLanguage`/`setLanguage` (Task 2), `translations`/`createTranslator` (Task 1).
- Produces: `LanguageProvider` (React component), `useTranslation(): { language: Language; setLanguage: (l: Language) => void; t: (key: string, vars?: Record<string, string | number>) => string }`.

- [ ] **Step 1: `misc`-Namespace für die Root-Layout-Ladezustände**

`src/i18n/translations/de/misc.ts`:
```typescript
export const misc = {
  rootLayout: {
    fontError: 'Fehler beim Laden der Symbole: {{message}}',
    preparing: 'Wird vorbereitet …',
    dbOpenError: 'Fehler beim Öffnen der Datenbank: {{message}}',
    dbLoading: 'Datenbank wird geladen …',
    migrationError: 'Datenbank-Migration fehlgeschlagen: {{message}}',
    dbPreparing: 'Datenbank wird vorbereitet …',
  },
};
```

`src/i18n/translations/en/misc.ts`:
```typescript
export const misc = {
  rootLayout: {
    fontError: 'Error loading icons: {{message}}',
    preparing: 'Preparing …',
    dbOpenError: 'Error opening the database: {{message}}',
    dbLoading: 'Loading database …',
    migrationError: 'Database migration failed: {{message}}',
    dbPreparing: 'Preparing database …',
  },
};
```

- [ ] **Step 2: In die Sprach-Indexe einhängen**

`src/i18n/translations/de/index.ts` (ersetzen):
```typescript
import { common } from './common';
import { misc } from './misc';

export const de = { common, misc };
```

`src/i18n/translations/en/index.ts` (ersetzen):
```typescript
import { common } from './common';
import { misc } from './misc';

export const en = { common, misc };
```

- [ ] **Step 3: `LanguageContext.tsx` (exaktes Muster von `src/theme/ThemeContext.tsx`)**

`src/i18n/LanguageContext.tsx`:
```typescript
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getLanguage, setLanguage as persistLanguage } from '../features/settings/settingsStorage';
import { translations } from './translations';
import { createTranslator } from './translate';
import type { Language } from './types';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('de');

  useEffect(() => {
    let isActive = true;
    getLanguage()
      .then((storedLanguage) => {
        if (isActive) {
          setLanguageState(storedLanguage);
        }
      })
      .catch((error: unknown) => {
        console.error('[Language] Gespeicherte Sprache konnte nicht geladen werden:', error);
      });
    return () => {
      isActive = false;
    };
  }, []);

  function handleSetLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage);
    persistLanguage(nextLanguage).catch((error: unknown) => {
      console.error('[Language] Sprache konnte nicht gespeichert werden:', error);
    });
  }

  const t = useMemo(
    () => createTranslator(translations[language], translations.de),
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation muss innerhalb eines LanguageProvider verwendet werden.');
  }
  return context;
}
```

- [ ] **Step 4: In `app/_layout.tsx` mounten und die Root-Layout-Ladetexte übersetzen**

In `app/_layout.tsx` den Import-Block erweitern (nach der `SwipeNavigationContext`-Zeile):
```typescript
import { LanguageProvider, useTranslation } from '../src/i18n/LanguageContext';
```

`RootLayout` ändern (Zeilen 21-29 ersetzen):
```typescript
export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SwipeNavigationProvider>
          <RootLayoutInner />
        </SwipeNavigationProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
```

`RootLayoutInner` anpassen: `const { colors } = useTheme();` bleibt, direkt darunter `const { t } = useTranslation();` ergänzen. Dann die vier hartcodierten Texte ersetzen:
- `Fehler beim Laden der Symbole: {fontError.message}` → `{t('misc.rootLayout.fontError', { message: fontError.message })}`
- `Wird vorbereitet …` → `{t('misc.rootLayout.preparing')}`
- `Fehler beim Öffnen der Datenbank: {initError}` → `{t('misc.rootLayout.dbOpenError', { message: initError })}`
- `Datenbank wird geladen …` → `{t('misc.rootLayout.dbLoading')}`

`MigratedLayout` anpassen: nach `const { colors } = useTheme();` ebenfalls `const { t } = useTranslation();` ergänzen, dann:
- `Datenbank-Migration fehlgeschlagen: {error.message}` → `{t('misc.rootLayout.migrationError', { message: error.message })}`
- `Datenbank wird vorbereitet …` → `{t('misc.rootLayout.dbPreparing')}`

- [ ] **Step 5: Typprüfung**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Bestehende Test-Suite laufen lassen**

Run: `npm test`
Expected: alle bisherigen Tests weiterhin grün (dieser Task ändert keine testbare Logik, nur JSX/Provider-Verschachtelung).

- [ ] **Step 7: Commit**

```bash
git add src/i18n app/_layout.tsx
git commit -m "feat: LanguageContext einfuehren und in RootLayout einhaengen"
```

---

## Task 4: Sprachumschalter + vollständige Migration des Einstellungen-Screens

**Files:**
- Create: `src/i18n/translations/de/settings.ts`
- Create: `src/i18n/translations/en/settings.ts`
- Create: `src/i18n/translations/de/appLock.ts`
- Create: `src/i18n/translations/en/appLock.ts`
- Create: `src/i18n/translations/de/backup.ts`
- Create: `src/i18n/translations/en/backup.ts`
- Modify: `src/i18n/translations/de/index.ts`
- Modify: `src/i18n/translations/en/index.ts`
- Modify: `app/(tabs)/einstellungen/index.tsx`

**Interfaces:**
- Consumes: `useTranslation()` (Task 3), `Language` type (Task 1).
- Produces: `settings.*`, `appLock.*` (vollständig, auch für Task 12 gedacht), `backup.*` (vollständig, auch für Task 12 gedacht) Dictionary-Keys.

**Wichtig:** `appLock.ts` und `backup.ts` bekommen hier bereits ALLE Keys, die auch `LockScreen.tsx`, `pinFormLogic.ts`, `src/lib/appReset.ts`, `BackupPasswordForm.tsx`, `backupFileService.ts` und `scheduleBackupReminder.ts` in Task 12 brauchen — Task 12 fügt diesen beiden Dateien keine weiteren Keys hinzu, sondern konsumiert sie nur.

- [ ] **Step 1: `settings`-Namespace**

`src/i18n/translations/de/settings.ts`:
```typescript
export const settings = {
  appearanceTitle: 'Darstellung',
  themeLight: 'Hell',
  themeDark: 'Dunkel',
  themeLightBlue: 'Hell (Blau-Weiß)',
  themeSelectA11y: 'Theme {{label}} auswählen',
  navigationTitle: 'Navigation',
  swipeRowLabel: 'Zwischen Tabs wischen',
  swipeA11y: 'Wischen zwischen Tabs aktivieren',
  languageTitle: 'Sprache',
  languageSelectA11y: 'Sprache {{name}} auswählen',
  jokesTitle: 'Wortwitze',
  dailyJokeRowLabel: 'Wortwitze des Tages',
  dailyJokeA11y: 'Wortwitze des Tages aktivieren',
  illnessJokesRowLabel: 'Auch krankheitsbedingte Witze',
  illnessJokesA11y: 'Auch krankheitsbedingte Witze anzeigen',
};
```

`src/i18n/translations/en/settings.ts`:
```typescript
export const settings = {
  appearanceTitle: 'Appearance',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeLightBlue: 'Light (Blue-White)',
  themeSelectA11y: 'Select {{label}} theme',
  navigationTitle: 'Navigation',
  swipeRowLabel: 'Swipe between tabs',
  swipeA11y: 'Enable swiping between tabs',
  languageTitle: 'Language',
  languageSelectA11y: 'Select {{name}} language',
  jokesTitle: 'Jokes',
  dailyJokeRowLabel: 'Daily joke',
  dailyJokeA11y: 'Enable daily joke',
  illnessJokesRowLabel: 'Also include illness-related jokes',
  illnessJokesA11y: 'Show illness-related jokes too',
};
```

- [ ] **Step 2: `appLock`-Namespace (vollständig, für diese und für Task 12)**

`src/i18n/translations/de/appLock.ts`:
```typescript
export const appLock = {
  sectionTitle: 'App-Sperre',
  enableRowLabel: 'PIN-/Biometrie-Sperre aktivieren',
  disableConfirmTitle: 'App-Sperre deaktivieren?',
  disableConfirmMessage: 'Möchtest du die App-Sperre wirklich deaktivieren?',
  disableConfirmConfirm: 'Deaktivieren',
  disableFailure: 'Sperre konnte nicht deaktiviert werden. Bitte erneut versuchen.',
  pinLengthError: 'Der PIN muss genau {{length}} Ziffern haben.',
  pinMismatch: 'Die beiden PINs stimmen nicht überein.',
  pinSaveFailure: 'PIN konnte nicht gespeichert werden. Bitte erneut versuchen.',
  newPinLabel: 'Neuer PIN ({{length}} Ziffern)',
  confirmPinLabel: 'PIN bestätigen',
  savePinButton: 'PIN speichern',
  unlockPromptReason: 'Colitis2Go entsperren',
  biometricsUnavailable: 'Biometrie ist gerade nicht verfügbar. Bitte PIN verwenden.',
  wrongPin: 'Falscher PIN. Bitte erneut versuchen.',
  pinCheckFailure: 'PIN konnte nicht geprüft werden. Bitte erneut versuchen.',
  resetFailure: 'Zurücksetzen konnte nicht vollständig abgeschlossen werden. Bitte erneut versuchen.',
  resetTitle: 'PIN zurücksetzen',
  resetWarning:
    'Das Zurücksetzen löscht alle App-Daten unwiderruflich. Ein vorher erstelltes Backup ist danach der einzige Weg, die Daten wiederzubekommen.',
  resetConfirmInstruction: 'Tippe zur Bestätigung „{{phrase}}“ ein:',
  resetConfirmButtonA11y: 'Alle Daten endgültig löschen',
  resetConfirmButton: 'Endgültig löschen',
  lockedTitle: 'App gesperrt',
  pinInputLabel: 'PIN eingeben',
  biometricsRetryButton: 'Mit Biometrie entsperren',
  forgotPinButton: 'PIN vergessen',
  resetConfirmationPhrase: 'LÖSCHEN',
  stepDeleteDatabase: 'Datenbank löschen',
  stepDeleteDbKey: 'Datenbank-Schlüssel löschen',
  stepResetPin: 'PIN zurücksetzen',
  stepResetDbCache: 'Datenbank-Cache zurücksetzen',
  resetComposedFailure: 'Zurücksetzen unvollständig, folgende Schritte sind fehlgeschlagen: {{steps}}',
};
```

`src/i18n/translations/en/appLock.ts`:
```typescript
export const appLock = {
  sectionTitle: 'App Lock',
  enableRowLabel: 'Enable PIN/biometric lock',
  disableConfirmTitle: 'Disable app lock?',
  disableConfirmMessage: 'Do you really want to disable the app lock?',
  disableConfirmConfirm: 'Disable',
  disableFailure: 'The lock could not be disabled. Please try again.',
  pinLengthError: 'The PIN must be exactly {{length}} digits long.',
  pinMismatch: 'The two PINs do not match.',
  pinSaveFailure: 'The PIN could not be saved. Please try again.',
  newPinLabel: 'New PIN ({{length}} digits)',
  confirmPinLabel: 'Confirm PIN',
  savePinButton: 'Save PIN',
  unlockPromptReason: 'Unlock Colitis2Go',
  biometricsUnavailable: 'Biometrics is currently unavailable. Please use your PIN.',
  wrongPin: 'Incorrect PIN. Please try again.',
  pinCheckFailure: 'The PIN could not be verified. Please try again.',
  resetFailure: 'The reset could not be completed fully. Please try again.',
  resetTitle: 'Reset PIN',
  resetWarning:
    'Resetting permanently deletes all app data. A previously created backup is then the only way to get the data back.',
  resetConfirmInstruction: 'Type "{{phrase}}" to confirm:',
  resetConfirmButtonA11y: 'Permanently delete all data',
  resetConfirmButton: 'Delete permanently',
  lockedTitle: 'App locked',
  pinInputLabel: 'Enter PIN',
  biometricsRetryButton: 'Unlock with biometrics',
  forgotPinButton: 'Forgot PIN',
  resetConfirmationPhrase: 'DELETE',
  stepDeleteDatabase: 'Delete database',
  stepDeleteDbKey: 'Delete database key',
  stepResetPin: 'Reset PIN',
  stepResetDbCache: 'Reset database cache',
  resetComposedFailure: 'Reset incomplete, the following steps failed: {{steps}}',
};
```

- [ ] **Step 3: `backup`-Namespace (vollständig, für diese und für Task 12)**

`src/i18n/translations/de/backup.ts`:
```typescript
export const backup = {
  sectionTitle: 'Backup',
  createButton: 'Backup erstellen',
  restoreButton: 'Backup wiederherstellen',
  restoreFormSubmit: 'Wiederherstellen',
  createFailure: 'Backup konnte nicht erstellt werden.',
  fileReadFailure: 'Sicherungsdatei konnte nicht gelesen werden.',
  invalidFormat: 'Sicherungsdatei ist kein gültiges Format.',
  unsupportedVersion: 'Sicherungsdatei hat eine unbekannte oder nicht unterstützte Version.',
  wrongPassword: 'Falsches Passwort oder beschädigte Sicherungsdatei.',
  restoreFailure: 'Backup konnte nicht wiederhergestellt werden.',
  restoreSuccess: 'Backup erfolgreich wiederhergestellt.',
  partialRestore: 'Daten wiederhergestellt. Erinnerungen konnten nicht neu geplant werden.',
  restoreConfirmTitle: 'Backup wiederherstellen?',
  restoreConfirmMessage: 'Alle vorhandenen Daten werden unwiderruflich ersetzt.',
  restoreConfirmConfirm: 'Wiederherstellen',
  reminderSectionTitle: 'Backup-Erinnerung',
  reminderRowLabel: 'Erinnerung aktivieren',
  reminderA11y: 'Backup-Erinnerung aktivieren',
  reminderIntervalOption: '{{days}} Tage',
  reminderIntervalA11y: 'Erinnerung alle {{days}} Tage',
  lastBackupLabel: 'Letztes Backup: {{date}}',
  noBackupYet: 'Noch kein Backup erstellt.',
  passwordFieldLabel: 'Backup-Passwort',
  confirmPasswordLabel: 'Passwort bestätigen',
  passwordLengthError: 'Das Passwort muss mindestens {{minLength}} Zeichen lang sein.',
  passwordMismatch: 'Die beiden Passwörter stimmen nicht überein.',
  reminderNotificationTitle: 'Backup-Erinnerung',
  reminderNotificationBody: 'Es ist Zeit, ein neues Backup deiner Daten zu erstellen.',
};
```

`src/i18n/translations/en/backup.ts`:
```typescript
export const backup = {
  sectionTitle: 'Backup',
  createButton: 'Create backup',
  restoreButton: 'Restore backup',
  restoreFormSubmit: 'Restore',
  createFailure: 'The backup could not be created.',
  fileReadFailure: 'The backup file could not be read.',
  invalidFormat: 'The backup file is not a valid format.',
  unsupportedVersion: 'The backup file has an unknown or unsupported version.',
  wrongPassword: 'Incorrect password or corrupted backup file.',
  restoreFailure: 'The backup could not be restored.',
  restoreSuccess: 'Backup restored successfully.',
  partialRestore: 'Data restored. Reminders could not be rescheduled.',
  restoreConfirmTitle: 'Restore backup?',
  restoreConfirmMessage: 'All existing data will be permanently replaced.',
  restoreConfirmConfirm: 'Restore',
  reminderSectionTitle: 'Backup reminder',
  reminderRowLabel: 'Enable reminder',
  reminderA11y: 'Enable backup reminder',
  reminderIntervalOption: '{{days}} days',
  reminderIntervalA11y: 'Reminder every {{days}} days',
  lastBackupLabel: 'Last backup: {{date}}',
  noBackupYet: 'No backup created yet.',
  passwordFieldLabel: 'Backup password',
  confirmPasswordLabel: 'Confirm password',
  passwordLengthError: 'The password must be at least {{minLength}} characters long.',
  passwordMismatch: 'The two passwords do not match.',
  reminderNotificationTitle: 'Backup reminder',
  reminderNotificationBody: "It's time to create a new backup of your data.",
};
```

- [ ] **Step 4: Namespaces einhängen**

`src/i18n/translations/de/index.ts` (ersetzen):
```typescript
import { common } from './common';
import { misc } from './misc';
import { settings } from './settings';
import { appLock } from './appLock';
import { backup } from './backup';

export const de = { common, misc, settings, appLock, backup };
```

`src/i18n/translations/en/index.ts` (ersetzen):
```typescript
import { common } from './common';
import { misc } from './misc';
import { settings } from './settings';
import { appLock } from './appLock';
import { backup } from './backup';

export const en = { common, misc, settings, appLock, backup };
```

- [ ] **Step 5: `app/(tabs)/einstellungen/index.tsx` vollständig ersetzen**

Die Datei hat aktuell 637 Zeilen. Ersetze die komplette Datei durch folgenden Inhalt (Logik unverändert, nur Text-Strings durch `t(...)`-Aufrufe ersetzt, Import-Block und THEME_OPTIONS angepasst, neuer Sprachauswahl-Block nach dem Navigation-Abschnitt eingefügt):

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import * as Crypto from 'expo-crypto';
import { createEncryptedDb } from '../../../src/db/client';
import { isAppLockEnabled, setPin, disableAppLock } from '../../../src/features/appLock/pinAuth';
import { isValidPinFormat, PIN_LENGTH } from '../../../src/features/appLock/pinFormLogic';
import { exportBackupData, importBackupData } from '../../../src/features/backup/db/backupRepository';
import { serializeBackupData, parseBackupData } from '../../../src/features/backup/backupSerializer';
import {
  deriveKeyFromPassword,
  encryptWithKey,
  decryptWithKey,
  bytesToHex,
  hexToBytes,
  PBKDF2_SALT_LENGTH_BYTES,
  GCM_NONCE_LENGTH_BYTES,
} from '../../../src/features/backup/backupCrypto';
import { writeAndShareBackup, pickBackupFileContent } from '../../../src/features/backup/backupFileService';
import { BackupPasswordForm } from '../../../src/features/backup/components/BackupPasswordForm';
import { rescheduleAllReminders } from '../../../src/features/backup/rescheduleReminders';
import { BACKUP_FORMAT_VERSION, type BackupData, type BackupEnvelope } from '../../../src/features/backup/types';
import { useTheme } from '../../../src/theme/ThemeContext';
import { useTranslation } from '../../../src/i18n/LanguageContext';
import { SliderToggle } from '../../../src/components/SliderToggle';
import { SwipeableTabScreen } from '../../../src/components/SwipeableTabScreen';
import { useSwipeNavigation } from '../../../src/navigation/SwipeNavigationContext';
import {
  getDailyJokeEnabled,
  setDailyJokeEnabled,
  getIncludeIllnessJokes,
  setIncludeIllnessJokes,
  getBackupReminderEnabledRaw,
  setBackupReminderEnabled,
  getBackupReminderIntervalDays,
  setBackupReminderIntervalDays,
  getLastBackupAt,
  setLastBackupAt,
} from '../../../src/features/settings/settingsStorage';
import { resolveBackupReminderEnabled } from '../../../src/features/backup/reminderScheduling';
import { rescheduleBackupReminder } from '../../../src/features/backup/scheduleBackupReminder';
import { tokens } from '../../../src/styles/tokens';
import type { ThemeId, ThemeColors } from '../../../src/theme/types';
import type { Language } from '../../../src/i18n/types';

type BackupFormMode = 'export' | 'import' | null;

const THEME_OPTIONS: { id: ThemeId; labelKey: string }[] = [
  { id: 'light', labelKey: 'settings.themeLight' },
  { id: 'dark', labelKey: 'settings.themeDark' },
  { id: 'light-blue', labelKey: 'settings.themeLightBlue' },
];

const LANGUAGE_OPTIONS: { id: Language; nativeName: string }[] = [
  { id: 'de', nativeName: 'Deutsch' },
  { id: 'en', nativeName: 'English' },
];

const BACKUP_REMINDER_INTERVAL_OPTIONS = [14, 30, 60, 90] as const;

function isBackupEnvelopeShape(value: unknown): value is BackupEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    'version' in candidate &&
    typeof candidate.saltHex === 'string' &&
    typeof candidate.nonceHex === 'string' &&
    typeof candidate.ciphertextHex === 'string'
  );
}

export default function EinstellungenScreen() {
  const { themeId, colors, setThemeId } = useTheme();
  const { swipeEnabled, setSwipeEnabled } = useSwipeNavigation();
  const { language, setLanguage, t } = useTranslation();
  const styles = makeStyles(colors);
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [lockActionError, setLockActionError] = useState<string | null>(null);
  const [backupFormMode, setBackupFormMode] = useState<BackupFormMode>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [pendingImportContent, setPendingImportContent] = useState<string | null>(null);
  const [dailyJokeEnabled, setDailyJokeEnabledState] = useState(false);
  const [includeIllnessJokes, setIncludeIllnessJokesState] = useState(false);
  const [backupReminderEnabled, setBackupReminderEnabledState] = useState(false);
  const [backupReminderIntervalDays, setBackupReminderIntervalDaysState] = useState(30);
  const [lastBackupAt, setLastBackupAtState] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      isAppLockEnabled()
        .then((enabled) => {
          if (isActive) {
            setIsLockEnabled(enabled);
          }
        })
        .catch((error: unknown) => {
          console.error('[Einstellungen] Sperrstatus konnte nicht gelesen werden:', error);
        });
      Promise.all([getDailyJokeEnabled(), getIncludeIllnessJokes()])
        .then(([jokeEnabled, illnessJokes]) => {
          if (isActive) {
            setDailyJokeEnabledState(jokeEnabled);
            setIncludeIllnessJokesState(illnessJokes);
          }
        })
        .catch((error: unknown) => {
          console.error('[Einstellungen] Wortwitz-Einstellungen konnten nicht gelesen werden:', error);
        });
      Promise.all([getBackupReminderEnabledRaw(), getBackupReminderIntervalDays(), getLastBackupAt()])
        .then(([rawEnabled, intervalDays, lastBackup]) => {
          if (isActive) {
            setBackupReminderEnabledState(resolveBackupReminderEnabled(rawEnabled, lastBackup));
            setBackupReminderIntervalDaysState(intervalDays);
            setLastBackupAtState(lastBackup);
          }
        })
        .catch((error: unknown) => {
          console.error('[Einstellungen] Backup-Erinnerungs-Einstellungen konnten nicht gelesen werden:', error);
        });
      return () => {
        isActive = false;
        setBackupMessage(null);
      };
    }, [])
  );

  function handleToggleLock(value: boolean) {
    setLockActionError(null);
    if (value) {
      setIsSettingPin(true);
      return;
    }
    Alert.alert(t('appLock.disableConfirmTitle'), t('appLock.disableConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('appLock.disableConfirmConfirm'),
        style: 'destructive',
        onPress: () => void confirmDisableLock(),
      },
    ]);
  }

  async function confirmDisableLock() {
    try {
      await disableAppLock();
      setIsLockEnabled(false);
    } catch (error: unknown) {
      console.error('[Einstellungen] Sperre konnte nicht deaktiviert werden:', error);
      setLockActionError(t('appLock.disableFailure'));
    }
  }

  async function handleSetPin() {
    if (!isValidPinFormat(newPin)) {
      setPinError(t('appLock.pinLengthError', { length: PIN_LENGTH }));
      return;
    }
    if (newPin !== confirmPin) {
      setPinError(t('appLock.pinMismatch'));
      return;
    }
    try {
      await setPin(newPin);
      setIsLockEnabled(true);
      setIsSettingPin(false);
      setNewPin('');
      setConfirmPin('');
      setPinError(null);
    } catch (error: unknown) {
      console.error('[Einstellungen] PIN konnte nicht gespeichert werden:', error);
      setPinError(t('appLock.pinSaveFailure'));
    }
  }

  async function handleExport(password: string) {
    try {
      const db = await createEncryptedDb();
      const data = await exportBackupData(db);
      const plaintext = serializeBackupData(data);
      const saltBytes = await Crypto.getRandomBytesAsync(PBKDF2_SALT_LENGTH_BYTES);
      const nonceBytes = await Crypto.getRandomBytesAsync(GCM_NONCE_LENGTH_BYTES);
      const key = deriveKeyFromPassword(password, saltBytes);
      const ciphertextBytes = encryptWithKey(new TextEncoder().encode(plaintext), key, nonceBytes);
      const envelope: BackupEnvelope = {
        version: BACKUP_FORMAT_VERSION,
        saltHex: bytesToHex(saltBytes),
        nonceHex: bytesToHex(nonceBytes),
        ciphertextHex: bytesToHex(ciphertextBytes),
      };
      await writeAndShareBackup(JSON.stringify(envelope));
      const nowIso = new Date().toISOString();
      await setLastBackupAt(nowIso);
      setLastBackupAtState(nowIso);
      await rescheduleBackupReminder();
      setBackupReminderEnabledState(resolveBackupReminderEnabled(await getBackupReminderEnabledRaw(), nowIso));
      setBackupFormMode(null);
      setBackupMessage(null);
    } catch (error: unknown) {
      console.error('[Einstellungen] Backup-Export fehlgeschlagen:', error);
      setBackupMessage(error instanceof Error ? error.message : t('backup.createFailure'));
    }
  }

  async function handlePickImportFile() {
    try {
      const content = await pickBackupFileContent();
      if (content === null) {
        return;
      }
      setPendingImportContent(content);
      setBackupFormMode('import');
      setBackupMessage(null);
    } catch (error: unknown) {
      console.error('[Einstellungen] Sicherungsdatei konnte nicht gelesen werden:', error);
      setBackupMessage(t('backup.fileReadFailure'));
    }
  }

  async function handleImport(password: string) {
    if (!pendingImportContent) {
      return;
    }

    let parsedEnvelope: unknown;
    try {
      parsedEnvelope = JSON.parse(pendingImportContent);
    } catch {
      setBackupMessage(t('backup.invalidFormat'));
      return;
    }
    if (!isBackupEnvelopeShape(parsedEnvelope)) {
      setBackupMessage(t('backup.invalidFormat'));
      return;
    }
    const envelope = parsedEnvelope;
    if (envelope.version !== BACKUP_FORMAT_VERSION) {
      setBackupMessage(t('backup.unsupportedVersion'));
      return;
    }

    let plaintextBytes: Uint8Array;
    try {
      const key = deriveKeyFromPassword(password, hexToBytes(envelope.saltHex));
      plaintextBytes = decryptWithKey(hexToBytes(envelope.ciphertextHex), key, hexToBytes(envelope.nonceHex));
    } catch (error: unknown) {
      console.error('[Einstellungen] Backup-Entschlüsselung fehlgeschlagen:', error);
      setBackupMessage(t('backup.wrongPassword'));
      return;
    }

    let data: BackupData;
    try {
      data = parseBackupData(new TextDecoder().decode(plaintextBytes));
    } catch (error: unknown) {
      setBackupMessage(error instanceof Error ? error.message : t('backup.invalidFormat'));
      return;
    }

    Alert.alert(t('backup.restoreConfirmTitle'), t('backup.restoreConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backup.restoreConfirmConfirm'),
        style: 'destructive',
        onPress: async () => {
          let db: Awaited<ReturnType<typeof createEncryptedDb>>;
          try {
            db = await createEncryptedDb();
            await importBackupData(db, data);
          } catch (error: unknown) {
            console.error('[Einstellungen] Backup-Import fehlgeschlagen:', error);
            setBackupMessage(t('backup.restoreFailure'));
            return;
          }

          setBackupFormMode(null);
          setPendingImportContent(null);

          try {
            await rescheduleAllReminders(db, data);
            await rescheduleBackupReminder();
            setBackupMessage(t('backup.restoreSuccess'));
          } catch (error: unknown) {
            console.error('[Einstellungen] Erinnerungen konnten nicht neu geplant werden:', error);
            setBackupMessage(t('backup.partialRestore'));
          }
        },
      },
    ]);
  }

  async function handleToggleDailyJoke(value: boolean) {
    setDailyJokeEnabledState(value);
    try {
      await setDailyJokeEnabled(value);
    } catch (error: unknown) {
      console.error('[Einstellungen] Wortwitz-Einstellung konnte nicht gespeichert werden:', error);
    }
  }

  async function handleToggleIllnessJokes(value: boolean) {
    setIncludeIllnessJokesState(value);
    try {
      await setIncludeIllnessJokes(value);
    } catch (error: unknown) {
      console.error('[Einstellungen] Wortwitz-Einstellung konnte nicht gespeichert werden:', error);
    }
  }

  async function handleToggleBackupReminder(value: boolean) {
    setBackupReminderEnabledState(value);
    try {
      await setBackupReminderEnabled(value);
      await rescheduleBackupReminder();
    } catch (error: unknown) {
      console.error('[Einstellungen] Backup-Erinnerung konnte nicht aktualisiert werden:', error);
    }
  }

  async function handleChangeBackupReminderInterval(days: number) {
    setBackupReminderIntervalDaysState(days);
    try {
      await setBackupReminderIntervalDays(days);
      await rescheduleBackupReminder();
    } catch (error: unknown) {
      console.error('[Einstellungen] Backup-Erinnerungsintervall konnte nicht aktualisiert werden:', error);
    }
  }

  return (
    <SwipeableTabScreen tab="einstellungen" style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{t('settings.appearanceTitle')}</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={t('settings.themeSelectA11y', { label: t(option.labelKey) })}
              accessibilityState={{ selected: themeId === option.id }}
              style={[styles.themeCard, themeId === option.id && styles.themeCardActive]}
              onPress={() => setThemeId(option.id)}
            >
              <Text style={[styles.themeCardText, themeId === option.id && styles.themeCardTextActive]}>
                {t(option.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('settings.navigationTitle')}</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.swipeRowLabel')}</Text>
          <SliderToggle
            value={swipeEnabled}
            onValueChange={setSwipeEnabled}
            accessibilityLabel={t('settings.swipeA11y')}
          />
        </View>

        <Text style={styles.sectionTitle}>{t('settings.languageTitle')}</Text>
        <View style={styles.themeRow}>
          {LANGUAGE_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={t('settings.languageSelectA11y', { name: option.nativeName })}
              accessibilityState={{ selected: language === option.id }}
              style={[styles.themeCard, language === option.id && styles.themeCardActive]}
              onPress={() => setLanguage(option.id)}
            >
              <Text style={[styles.themeCardText, language === option.id && styles.themeCardTextActive]}>
                {option.nativeName}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('appLock.sectionTitle')}</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('appLock.enableRowLabel')}</Text>
          <SliderToggle
            value={isLockEnabled}
            onValueChange={handleToggleLock}
            accessibilityLabel={t('appLock.enableRowLabel')}
          />
        </View>
        {lockActionError && <Text style={styles.error}>{lockActionError}</Text>}

        {isSettingPin && (
          <View style={styles.card}>
            <Text style={styles.label}>{t('appLock.newPinLabel', { length: PIN_LENGTH })}</Text>
            <TextInput
              style={styles.textInput}
              placeholderTextColor={colors.textSecondary}
              value={newPin}
              onChangeText={(text) => setNewPin(text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={PIN_LENGTH}
            />
            <Text style={styles.label}>{t('appLock.confirmPinLabel')}</Text>
            <TextInput
              style={styles.textInput}
              placeholderTextColor={colors.textSecondary}
              value={confirmPin}
              onChangeText={(text) => setConfirmPin(text.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={PIN_LENGTH}
            />
            {pinError && <Text style={styles.error}>{pinError}</Text>}
            <View style={styles.buttonRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                style={styles.cancelButton}
                onPress={() => {
                  setIsSettingPin(false);
                  setNewPin('');
                  setConfirmPin('');
                  setPinError(null);
                }}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('appLock.savePinButton')}
                style={styles.submitButton}
                onPress={handleSetPin}
              >
                <Text style={styles.submitButtonText}>{t('appLock.savePinButton')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('settings.jokesTitle')}</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.dailyJokeRowLabel')}</Text>
          <SliderToggle
            value={dailyJokeEnabled}
            onValueChange={handleToggleDailyJoke}
            accessibilityLabel={t('settings.dailyJokeA11y')}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.illnessJokesRowLabel')}</Text>
          <SliderToggle
            value={includeIllnessJokes}
            onValueChange={handleToggleIllnessJokes}
            accessibilityLabel={t('settings.illnessJokesA11y')}
            disabled={!dailyJokeEnabled}
          />
        </View>

        <Text style={styles.sectionTitle}>{t('backup.sectionTitle')}</Text>
        {backupMessage && <Text style={styles.backupMessage}>{backupMessage}</Text>}

        {backupFormMode === 'export' && (
          <BackupPasswordForm
            requireConfirmation
            submitLabel={t('backup.createButton')}
            onSubmit={handleExport}
            onCancel={() => setBackupFormMode(null)}
          />
        )}

        {backupFormMode === 'import' && (
          <BackupPasswordForm
            requireConfirmation={false}
            submitLabel={t('backup.restoreFormSubmit')}
            onSubmit={handleImport}
            onCancel={() => {
              setBackupFormMode(null);
              setPendingImportContent(null);
            }}
          />
        )}

        {backupFormMode === null && (
          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('backup.createButton')}
              style={styles.submitButton}
              onPress={() => {
                setBackupMessage(null);
                setBackupFormMode('export');
              }}
            >
              <Text style={styles.submitButtonText}>{t('backup.createButton')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('backup.restoreButton')}
              style={styles.cancelButton}
              onPress={handlePickImportFile}
            >
              <Text style={styles.cancelButtonText}>{t('backup.restoreButton')}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('backup.reminderSectionTitle')}</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('backup.reminderRowLabel')}</Text>
          <SliderToggle
            value={backupReminderEnabled}
            onValueChange={handleToggleBackupReminder}
            accessibilityLabel={t('backup.reminderA11y')}
          />
        </View>
        <View style={styles.themeRow}>
          {BACKUP_REMINDER_INTERVAL_OPTIONS.map((days) => (
            <Pressable
              key={days}
              accessibilityRole="button"
              accessibilityLabel={t('backup.reminderIntervalA11y', { days })}
              accessibilityState={{ selected: backupReminderIntervalDays === days }}
              style={[styles.themeCard, backupReminderIntervalDays === days && styles.themeCardActive]}
              onPress={() => handleChangeBackupReminderInterval(days)}
            >
              <Text style={[styles.themeCardText, backupReminderIntervalDays === days && styles.themeCardTextActive]}>
                {t('backup.reminderIntervalOption', { days })}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.backupMessage}>
          {lastBackupAt
            ? t('backup.lastBackupLabel', { date: new Date(lastBackupAt).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US') })
            : t('backup.noBackupYet')}
        </Text>
      </ScrollView>
    </SwipeableTabScreen>
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
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      marginTop: tokens.spacing.lg,
      marginBottom: tokens.spacing.sm,
    },
    themeRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
    },
    themeCard: {
      flex: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    themeCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    themeCardText: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      textAlign: 'center',
    },
    themeCardTextActive: {
      color: colors.primary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: tokens.spacing.sm,
    },
    rowLabel: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
    card: {
      padding: tokens.spacing.md,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: tokens.spacing.sm,
    },
    label: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.medium,
      marginBottom: tokens.spacing.xs,
      marginTop: tokens.spacing.sm,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: tokens.spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      marginBottom: tokens.spacing.sm,
    },
    error: {
      color: colors.danger,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
    backupMessage: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      marginBottom: tokens.spacing.sm,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
    },
    cancelButton: {
      flex: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
    },
    submitButton: {
      flex: 1,
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
    submitButtonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
    },
  });
}
```

- [ ] **Step 6: Typprüfung**

Run: `npx tsc --noEmit`

- [ ] **Step 7: Bestehende Test-Suite laufen lassen**

Run: `npm test`
Expected: alle Tests weiterhin grün (dieser Screen hat keine eigene Testdatei — reine UI).

- [ ] **Step 8: Manuell verifizieren**

Metro-Bundler starten (`npx expo start`), Einstellungen-Screen öffnen, Sprache auf „English" umschalten, prüfen dass die sichtbaren Texte auf diesem Screen sofort auf Englisch wechseln, zurück auf „Deutsch" umschalten.

- [ ] **Step 9: Commit**

```bash
git add app/\(tabs\)/einstellungen/index.tsx src/i18n
git commit -m "feat: Sprachumschalter in Einstellungen, Einstellungen-Screen vollstaendig uebersetzt"
```

---

## Task 5: Navigation-Labels (Tab-Leiste + Stack-Header-Titel)

**Files:**
- Create: `src/i18n/translations/de/navigation.ts`
- Create: `src/i18n/translations/en/navigation.ts`
- Modify: `src/i18n/translations/de/index.ts`
- Modify: `src/i18n/translations/en/index.ts`
- Modify: `app/(tabs)/_layout.tsx`
- Modify: `app/(tabs)/tagebuch/_layout.tsx`
- Modify: `app/(tabs)/medikamente/_layout.tsx`
- Modify: `app/(tabs)/wissen/_layout.tsx`

**Interfaces:**
- Consumes: `useTranslation()` (Task 3).
- Produces: `navigation.*` Keys.

- [ ] **Step 1: `navigation`-Namespace**

`src/i18n/translations/de/navigation.ts`:
```typescript
export const navigation = {
  tabs: {
    tagebuch: 'Tagebuch',
    wissen: 'Wissen',
    medikamente: 'Medikamente',
    toiletten: 'Toiletten',
    einstellungen: 'Einstellungen',
  },
  tagebuchLayout: {
    index: 'Tagebuch',
    neu: 'Neuer Eintrag',
    schnell: 'Schnell-Eintrag',
    auswertung: 'Auswertung',
    arztbesucheIndex: 'Arztbesuche',
    arztbesucheNeu: 'Neuer Arztbesuch',
    arztbesucheEdit: 'Arztbesuch bearbeiten',
  },
  medikamenteLayout: {
    index: 'Medikamente',
    neu: 'Neues Medikament',
    edit: 'Medikament bearbeiten',
  },
  wissenLayout: {
    index: 'Wissen',
    slug: 'Artikel',
    feed: 'Neuigkeiten',
  },
};
```

`src/i18n/translations/en/navigation.ts`:
```typescript
export const navigation = {
  tabs: {
    tagebuch: 'Diary',
    wissen: 'Knowledge',
    medikamente: 'Medications',
    toiletten: 'Restrooms',
    einstellungen: 'Settings',
  },
  tagebuchLayout: {
    index: 'Diary',
    neu: 'New Entry',
    schnell: 'Quick Entry',
    auswertung: 'Analysis',
    arztbesucheIndex: 'Doctor Visits',
    arztbesucheNeu: 'New Doctor Visit',
    arztbesucheEdit: 'Edit Doctor Visit',
  },
  medikamenteLayout: {
    index: 'Medications',
    neu: 'New Medication',
    edit: 'Edit Medication',
  },
  wissenLayout: {
    index: 'Knowledge',
    slug: 'Article',
    feed: 'News',
  },
};
```

- [ ] **Step 2: Einhängen**

In `src/i18n/translations/de/index.ts` und `en/index.ts` jeweils `import { navigation } from './navigation';` ergänzen und im Export-Objekt `navigation` hinzufügen (z. B. `export const de = { common, misc, settings, appLock, backup, navigation };`).

- [ ] **Step 3: `app/(tabs)/_layout.tsx` — Tab-Leiste**

Datei öffnen. Ganz oben `useTranslation` importieren:
```typescript
import { useTranslation } from '../../src/i18n/LanguageContext';
```
In der Layout-Komponente (dort wo bereits `useTheme()` o. Ä. aufgerufen wird) `const { t } = useTranslation();` ergänzen. Jedes `title: 'Tagebuch'` / `'Wissen'` / `'Medikamente'` / `'Toiletten'` / `'Einstellungen'` in den fünf `Tabs.Screen`-`options`-Objekten ersetzen durch `title: t('navigation.tabs.tagebuch')` / `t('navigation.tabs.wissen')` / `t('navigation.tabs.medikamente')` / `t('navigation.tabs.toiletten')` / `t('navigation.tabs.einstellungen')` (jeweils passend zur Route).

- [ ] **Step 4: `app/(tabs)/tagebuch/_layout.tsx`**

`useTranslation` importieren, `const { t } = useTranslation();` in der Layout-Komponente ergänzen. Die sieben `Stack.Screen`-Titel ersetzen:
- `'Tagebuch'` (index) → `t('navigation.tagebuchLayout.index')`
- `'Neuer Eintrag'` (neu) → `t('navigation.tagebuchLayout.neu')`
- `'Schnell-Eintrag'` (schnell) → `t('navigation.tagebuchLayout.schnell')`
- `'Auswertung'` (auswertung) → `t('navigation.tagebuchLayout.auswertung')`
- `'Arztbesuche'` (arztbesuche/index) → `t('navigation.tagebuchLayout.arztbesucheIndex')`
- `'Neuer Arztbesuch'` (arztbesuche/neu) → `t('navigation.tagebuchLayout.arztbesucheNeu')`
- `'Arztbesuch bearbeiten'` (arztbesuche/[id]) → `t('navigation.tagebuchLayout.arztbesucheEdit')`

- [ ] **Step 5: `app/(tabs)/medikamente/_layout.tsx`**

Gleiches Muster. Drei Titel:
- `'Medikamente'` (index) → `t('navigation.medikamenteLayout.index')`
- `'Neues Medikament'` (neu) → `t('navigation.medikamenteLayout.neu')`
- `'Medikament bearbeiten'` ([id]) → `t('navigation.medikamenteLayout.edit')`

- [ ] **Step 6: `app/(tabs)/wissen/_layout.tsx`**

Gleiches Muster. Drei Titel:
- `'Wissen'` (index) → `t('navigation.wissenLayout.index')`
- `'Artikel'` ([slug]) → `t('navigation.wissenLayout.slug')`
- `'Neuigkeiten'` (feed) → `t('navigation.wissenLayout.feed')`

- [ ] **Step 7: Typprüfung und Tests**

Run: `npx tsc --noEmit`
Run: `npm test`

- [ ] **Step 8: Commit**

```bash
git add src/i18n "app/(tabs)/_layout.tsx" "app/(tabs)/tagebuch/_layout.tsx" "app/(tabs)/medikamente/_layout.tsx" "app/(tabs)/wissen/_layout.tsx"
git commit -m "feat: Tab- und Stack-Header-Titel uebersetzen"
```

---

## Task 6: Tagebuch — Haupt-UI (Screens, Komponenten, Validierung)

**Files:**
- Create: `src/i18n/translations/de/diary.ts`
- Create: `src/i18n/translations/en/diary.ts`
- Modify: `src/i18n/translations/de/index.ts`, `src/i18n/translations/en/index.ts`
- Modify: `app/(tabs)/tagebuch/index.tsx`
- Modify: `app/(tabs)/tagebuch/neu.tsx`
- Modify: `app/(tabs)/tagebuch/schnell.tsx`
- Modify: `app/(tabs)/tagebuch/auswertung.tsx`
- Modify: `src/features/diary/components/DiaryCalendarView.tsx`
- Modify: `src/features/diary/components/DiaryEntryForm.tsx`
- Modify: `src/features/diary/components/DiaryHistoryList.tsx`
- Modify: `src/features/diary/components/DiaryTrendChart.tsx`
- Modify: `src/features/diary/components/FlareWarningBanner.tsx`
- Modify: `src/features/diary/components/TriggerAnalysisView.tsx`
- Modify: `src/features/diary/formLogic.ts`
- Modify: `src/features/diary/formLogic.test.ts`

**Interfaces:**
- Consumes: `useTranslation()` (Task 3).
- Produces: `diary.*` Keys (vollständig, inkl. der von Task 7 benötigten `diary.csv.*`/`diary.pdf.*` Keys — Task 7 fügt `diary.ts` keine weiteren Keys hinzu). `validateEntryForm(state, t)` neue Signatur.

**Wichtig:** `formLogic.ts` ist framework-frei — `t` wird als zusätzlicher Parameter übergeben (siehe Global Constraints).

- [ ] **Step 1: `diary`-Namespace (vollständig)**

`src/i18n/translations/de/diary.ts`:
```typescript
export const diary = {
  loadFailure: 'Einträge konnten nicht geladen werden.',
  deleteConfirmTitle: 'Eintrag löschen?',
  deleteConfirmMessage: 'Dieser Tagebucheintrag wird endgültig gelöscht.',
  deleteFailure: 'Eintrag konnte nicht gelöscht werden.',
  saveFailure: 'Eintrag konnte nicht gespeichert werden.',
  pdfExportFailure: 'PDF-Export fehlgeschlagen.',
  csvExportFailure: 'CSV-Export fehlgeschlagen.',
  exportMenuTitle: 'Tagebuch exportieren',
  exportEmptyMessage: 'Noch keine Einträge zum Exportieren.',
  exportAsPdf: 'Als PDF exportieren',
  exportAsCsv: 'Als CSV exportieren',
  exportMenuA11y: 'Export-Menü öffnen',
  exportingStatus: 'Export wird erstellt …',
  viewList: 'Liste',
  viewCalendar: 'Kalender',
  analysisChipA11y: 'Muster-Auswertung ansehen',
  analysisChip: 'Auswertung',
  doctorVisitsChipA11y: 'Arztbesuche verwalten',
  doctorVisitsChip: 'Arztbesuche',
  entriesLoading: 'Einträge werden geladen …',
  quickEntryA11y: 'Schnell-Eintrag öffnen',

  todaySummaryLoadFailure: 'Heutiger Stand konnte nicht geladen werden.',
  countLoading: 'wird geladen …',
  noEntriesToday: 'Heute noch nichts erfasst',
  countToday: 'Heute: {{count}} erfasst',
  splitNote: 'verteilt auf {{count}} Einträge',
  bloodTodayNotice: 'Für heute ist Blut vermerkt',
  bloodSwitchLabel: 'mit Blut',
  bloodSwitchA11y: 'Mit Blut erfassen',
  consistencyHint: 'Konsistenz wählen — das speichert:',
  consistencyOptionA11ySuffix: '{{label}} erfassen',
  fullEntryLinkA11y: 'Ausführlichen Eintrag anlegen',
  fullEntryLinkText: 'Ausführlichen Eintrag anlegen →',

  analysisLoadFailure: 'Auswertung konnte nicht geladen werden.',
  analysisLoading: 'Auswertung wird geladen …',

  weekdayMo: 'Mo',
  weekdayDi: 'Di',
  weekdayMi: 'Mi',
  weekdayDo: 'Do',
  weekdayFr: 'Fr',
  weekdaySa: 'Sa',
  weekdaySo: 'So',
  ratingGood: 'gut',
  ratingMedium: 'mittel',
  ratingBad: 'schub-verdächtig',
  prevMonthA11y: 'Vorheriger Monat',
  nextMonthA11y: 'Nächster Monat',
  legendGood: 'Gut ·',
  legendMedium: 'Mittel ·',
  legendBad: 'Schub-verdächtig',
  dayCellA11yPlain: 'Tag {{day}}',
  dayCellA11yWithRating: 'Tag {{day}}, Bewertung: {{rating}}',

  stoolFrequencyLabel: 'Stuhlgang-Häufigkeit (dieser Eintrag)',
  bloodSectionLabel: 'Blut im Stuhl',
  consistencyLabel: 'Stuhlgang-Konsistenz',
  painLevelLabel: 'Schmerzlevel (0-10)',
  symptomsLabel: 'Symptome',
  triggersLabel: 'Mögliche Auslöser',
  foodTriggerNoteLabel: 'Welches Lebensmittel? (optional)',
  foodSuggestionA11y: '{{suggestion}} hinzufügen',
  foodTriggerPlaceholder: 'z. B. Kaffee, Milchprodukte …',
  noteLabel: 'Notiz',
  notePlaceholder: 'Zusätzliche Beobachtungen …',
  submitButton: 'Eintrag speichern',

  emptyState: 'Noch keine Einträge. Tippe auf „+“, um deinen ersten Eintrag anzulegen.',
  stoolPrefixLine: 'Stuhlgang: {{count}}× · {{label}}',
  painPrefixLine: 'Schmerzlevel: {{level}}/10',
  triggersLine: 'Auslöser: {{labels}}',
  symptomsLine: 'Symptome: {{labels}}',
  deleteA11y: 'Eintrag vom {{date}} löschen',

  range7: '7 Tage',
  range30: '30 Tage',
  range90: '90 Tage',
  chartPainTitle: 'Schmerzlevel',
  chartStoolTitle: 'Stuhlgang-Häufigkeit',
  noDataInRange: 'Keine Daten in diesem Zeitraum.',

  flareCloseA11y: 'Warnung schließen',
  flareMessage:
    'Mehrere schub-verdächtige Tage in der letzten Woche – ziehe in Erwägung, deinen Arzt zu kontaktieren.',

  triggerEmptyState:
    'Noch keine Auswertung möglich. Erfasse Einträge mit Auslösern im Tagebuch, um hier Muster zu sehen.',
  entrySingular: 'Eintrag',
  entryPlural: 'Einträge',
  averagePain: 'Ø Schmerzlevel: {{level}}/10',

  errorMissingConsistency: 'Bitte eine Stuhlgang-Konsistenz auswählen.',
  errorNegativeFrequency: 'Die Häufigkeit darf nicht negativ sein.',
  errorPainRange: 'Das Schmerzlevel muss zwischen 0 und 10 liegen.',
  internalMissingConsistency: 'Formular ist nicht gültig: Stuhlgang-Konsistenz fehlt.',

  csv: {
    headerDate: 'Datum',
    headerFrequency: 'Stuhlgang-Häufigkeit',
    headerConsistency: 'Konsistenz',
    headerPain: 'Schmerzlevel',
    headerBlood: 'Blut im Stuhl',
    headerTriggers: 'Auslöser',
    headerSymptoms: 'Symptome',
    headerNote: 'Notiz',
  },
  pdf: {
    emptyState: 'Keine Einträge vorhanden.',
    title: 'Tagebuch',
    generatedOn: 'Erstellt am {{date}}',
  },
};
```

`src/i18n/translations/en/diary.ts`:
```typescript
export const diary = {
  loadFailure: 'Entries could not be loaded.',
  deleteConfirmTitle: 'Delete entry?',
  deleteConfirmMessage: 'This diary entry will be permanently deleted.',
  deleteFailure: 'The entry could not be deleted.',
  saveFailure: 'The entry could not be saved.',
  pdfExportFailure: 'PDF export failed.',
  csvExportFailure: 'CSV export failed.',
  exportMenuTitle: 'Export diary',
  exportEmptyMessage: 'No entries to export yet.',
  exportAsPdf: 'Export as PDF',
  exportAsCsv: 'Export as CSV',
  exportMenuA11y: 'Open export menu',
  exportingStatus: 'Export in progress …',
  viewList: 'List',
  viewCalendar: 'Calendar',
  analysisChipA11y: 'View pattern analysis',
  analysisChip: 'Analysis',
  doctorVisitsChipA11y: 'Manage doctor visits',
  doctorVisitsChip: 'Doctor visits',
  entriesLoading: 'Loading entries …',
  quickEntryA11y: 'Open quick entry',

  todaySummaryLoadFailure: "Today's summary could not be loaded.",
  countLoading: 'loading …',
  noEntriesToday: 'Nothing recorded today yet',
  countToday: 'Today: {{count}} recorded',
  splitNote: 'spread across {{count}} entries',
  bloodTodayNotice: 'Blood recorded for today',
  bloodSwitchLabel: 'with blood',
  bloodSwitchA11y: 'Record with blood',
  consistencyHint: 'Choose consistency — this saves:',
  consistencyOptionA11ySuffix: 'Record {{label}}',
  fullEntryLinkA11y: 'Create detailed entry',
  fullEntryLinkText: 'Create detailed entry →',

  analysisLoadFailure: 'The analysis could not be loaded.',
  analysisLoading: 'Loading analysis …',

  weekdayMo: 'Mon',
  weekdayDi: 'Tue',
  weekdayMi: 'Wed',
  weekdayDo: 'Thu',
  weekdayFr: 'Fri',
  weekdaySa: 'Sat',
  weekdaySo: 'Sun',
  ratingGood: 'good',
  ratingMedium: 'medium',
  ratingBad: 'flare-suspected',
  prevMonthA11y: 'Previous month',
  nextMonthA11y: 'Next month',
  legendGood: 'Good ·',
  legendMedium: 'Medium ·',
  legendBad: 'Flare-suspected',
  dayCellA11yPlain: 'Day {{day}}',
  dayCellA11yWithRating: 'Day {{day}}, rating: {{rating}}',

  stoolFrequencyLabel: 'Stool frequency (this entry)',
  bloodSectionLabel: 'Blood in stool',
  consistencyLabel: 'Stool consistency',
  painLevelLabel: 'Pain level (0-10)',
  symptomsLabel: 'Symptoms',
  triggersLabel: 'Possible triggers',
  foodTriggerNoteLabel: 'Which food? (optional)',
  foodSuggestionA11y: 'Add {{suggestion}}',
  foodTriggerPlaceholder: 'e.g. coffee, dairy products …',
  noteLabel: 'Note',
  notePlaceholder: 'Additional observations …',
  submitButton: 'Save entry',

  emptyState: 'No entries yet. Tap "+" to create your first entry.',
  stoolPrefixLine: 'Stool: {{count}}× · {{label}}',
  painPrefixLine: 'Pain level: {{level}}/10',
  triggersLine: 'Triggers: {{labels}}',
  symptomsLine: 'Symptoms: {{labels}}',
  deleteA11y: 'Delete entry from {{date}}',

  range7: '7 days',
  range30: '30 days',
  range90: '90 days',
  chartPainTitle: 'Pain level',
  chartStoolTitle: 'Stool frequency',
  noDataInRange: 'No data in this period.',

  flareCloseA11y: 'Dismiss warning',
  flareMessage: 'Several flare-suspected days in the past week — consider contacting your doctor.',

  triggerEmptyState: 'No analysis possible yet. Record entries with triggers in your diary to see patterns here.',
  entrySingular: 'entry',
  entryPlural: 'entries',
  averagePain: 'Avg. pain level: {{level}}/10',

  errorMissingConsistency: 'Please select a stool consistency.',
  errorNegativeFrequency: 'The frequency must not be negative.',
  errorPainRange: 'The pain level must be between 0 and 10.',
  internalMissingConsistency: 'Form is not valid: stool consistency is missing.',

  csv: {
    headerDate: 'Date',
    headerFrequency: 'Stool frequency',
    headerConsistency: 'Consistency',
    headerPain: 'Pain level',
    headerBlood: 'Blood in stool',
    headerTriggers: 'Triggers',
    headerSymptoms: 'Symptoms',
    headerNote: 'Note',
  },
  pdf: {
    emptyState: 'No entries available.',
    title: 'Diary',
    generatedOn: 'Generated on {{date}}',
  },
};
```

- [ ] **Step 2: Einhängen**

`de/index.ts`/`en/index.ts`: `import { diary } from './diary';` ergänzen, `diary` zum Export-Objekt hinzufügen.

- [ ] **Step 3: `formLogic.ts` — `t` als Parameter**

`src/features/diary/formLogic.ts` — `validateDiaryEntryForm` und `buildDiaryEntryInput` ändern (übrige Funktionen `toggleListValue`/`appendFoodSuggestion` bleiben unverändert):

```typescript
export function validateDiaryEntryForm(
  state: DiaryEntryFormState,
  t: (key: string, vars?: Record<string, string | number>) => string
): string[] {
  const errors: string[] = [];

  if (state.stoolConsistency === null) {
    errors.push(t('diary.errorMissingConsistency'));
  }
  if (state.stoolFrequency < 0) {
    errors.push(t('diary.errorNegativeFrequency'));
  }
  if (state.painLevel < 0 || state.painLevel > 10) {
    errors.push(t('diary.errorPainRange'));
  }

  return errors;
}

export function buildDiaryEntryInput(
  state: DiaryEntryFormState,
  occurredAt: string,
  t: (key: string, vars?: Record<string, string | number>) => string
): NewDiaryEntryInput {
  if (state.stoolConsistency === null) {
    throw new Error(t('diary.internalMissingConsistency'));
  }

  const trimmedNote = state.note.trim();
  const trimmedFoodTriggerNote = state.foodTriggerNote.trim();
  const hasFoodTrigger = state.triggerCategories.includes('ernaehrung') && trimmedFoodTriggerNote.length > 0;

  return {
    occurredAt,
    stoolFrequency: state.stoolFrequency,
    hasBlood: state.hasBlood,
    stoolConsistency: state.stoolConsistency,
    painLevel: state.painLevel,
    symptoms: state.symptoms,
    note: trimmedNote.length > 0 ? trimmedNote : null,
    triggerCategories: state.triggerCategories,
    foodTriggerNote: hasFoodTrigger ? trimmedFoodTriggerNote : null,
  };
}
```

- [ ] **Step 4: `formLogic.test.ts` anpassen**

Am Dateianfang ergänzen:
```typescript
import { createTranslator } from '../../i18n/translate';
import { translations } from '../../i18n/translations';

const t = createTranslator(translations.de, translations.de);
```
Jeden Aufruf `validateDiaryEntryForm(state)` zu `validateDiaryEntryForm(state, t)` und jeden Aufruf `buildDiaryEntryInput(state, occurredAt)` zu `buildDiaryEntryInput(state, occurredAt, t)` ändern (Assertions bleiben unverändert, da `t()` mit dem deutschen Dictionary exakt den bisherigen deutschen Text liefert).

- [ ] **Step 5: Alle Aufrufer von `validateDiaryEntryForm`/`buildDiaryEntryInput` anpassen**

Grep nach `validateDiaryEntryForm(` und `buildDiaryEntryInput(` in `app/(tabs)/tagebuch/` und `src/features/diary/components/` (voraussichtlich `DiaryEntryForm.tsx` und/oder `app/(tabs)/tagebuch/neu.tsx`/`schnell.tsx`). An jeder Aufrufstelle `const { t } = useTranslation();` ergänzen (falls in der Komponente noch nicht vorhanden) und `t` als zusätzliches Argument an den jeweiligen Aufruf anhängen.

- [ ] **Step 6: `app/(tabs)/tagebuch/index.tsx` migrieren**

`useTranslation` importieren, `const { t } = useTranslation();` in der Komponente ergänzen. Ersetzungen (alte Zeichenkette → neuer Code):

| Alt | Neu |
|---|---|
| `'Einträge konnten nicht geladen werden.'` | `t('diary.loadFailure')` |
| `'Eintrag löschen?'` | `t('diary.deleteConfirmTitle')` |
| `'Dieser Tagebucheintrag wird endgültig gelöscht.'` | `t('diary.deleteConfirmMessage')` |
| `'Abbrechen'` (Alert) | `t('common.cancel')` |
| `'Löschen'` (Alert) | `t('common.delete')` |
| `'Eintrag konnte nicht gelöscht werden.'` | `t('diary.deleteFailure')` |
| `'PDF-Export fehlgeschlagen.'` | `t('diary.pdfExportFailure')` |
| `'CSV-Export fehlgeschlagen.'` | `t('diary.csvExportFailure')` |
| `'Tagebuch exportieren'` (beide Vorkommen) | `t('diary.exportMenuTitle')` |
| `'Noch keine Einträge zum Exportieren.'` | `t('diary.exportEmptyMessage')` |
| `'OK'` | `t('common.ok')` |
| `'Als PDF exportieren'` | `t('diary.exportAsPdf')` |
| `'Als CSV exportieren'` | `t('diary.exportAsCsv')` |
| `'Export-Menü öffnen'` | `t('diary.exportMenuA11y')` |
| `'Export wird erstellt …'` | `t('diary.exportingStatus')` |
| `'Liste'` | `t('diary.viewList')` |
| `'Kalender'` | `t('diary.viewCalendar')` |
| `'Muster-Auswertung ansehen'` | `t('diary.analysisChipA11y')` |
| `'Auswertung'` (Chip-Text) | `t('diary.analysisChip')` |
| `'Arztbesuche verwalten'` | `t('diary.doctorVisitsChipA11y')` |
| `'Arztbesuche'` (Chip-Text) | `t('diary.doctorVisitsChip')` |
| `'Einträge werden geladen …'` | `t('diary.entriesLoading')` |
| `'Schnell-Eintrag öffnen'` | `t('diary.quickEntryA11y')` |

- [ ] **Step 7: `app/(tabs)/tagebuch/neu.tsx` migrieren**

`useTranslation` importieren, `t` holen. `'Eintrag konnte nicht gespeichert werden.'` → `t('diary.saveFailure')`.

- [ ] **Step 8: `app/(tabs)/tagebuch/schnell.tsx` migrieren**

`useTranslation` importieren, `t` holen. Ersetzungen:

| Alt | Neu |
|---|---|
| `'Heutiger Stand konnte nicht geladen werden.'` | `t('diary.todaySummaryLoadFailure')` |
| `'Eintrag konnte nicht gespeichert werden.'` | `t('diary.saveFailure')` |
| `'wird geladen …'` | `t('diary.countLoading')` |
| `'Heute noch nichts erfasst'` | `t('diary.noEntriesToday')` |
| `` `Heute: ${summary.totalStoolFrequency} erfasst` `` | `t('diary.countToday', { count: summary.totalStoolFrequency })` |
| `` `verteilt auf ${summary.entryCount} Einträge` `` | `t('diary.splitNote', { count: summary.entryCount })` |
| `'Für heute ist Blut vermerkt'` | `t('diary.bloodTodayNotice')` |
| `'mit Blut'` | `t('diary.bloodSwitchLabel')` |
| `'Mit Blut erfassen'` | `t('diary.bloodSwitchA11y')` |
| `'Konsistenz wählen — das speichert:'` | `t('diary.consistencyHint')` |
| `` `${option.label} erfassen` `` | `t('diary.consistencyOptionA11ySuffix', { label: option.label })` |
| `'Ausführlichen Eintrag anlegen'` (a11y) | `t('diary.fullEntryLinkA11y')` |
| `'Ausführlichen Eintrag anlegen →'` | `t('diary.fullEntryLinkText')` |

- [ ] **Step 9: `app/(tabs)/tagebuch/auswertung.tsx` migrieren**

`'Auswertung konnte nicht geladen werden.'` → `t('diary.analysisLoadFailure')`; `'Auswertung wird geladen …'` → `t('diary.analysisLoading')`.

- [ ] **Step 10: `DiaryCalendarView.tsx` migrieren**

`useTranslation` importieren, `t` holen. Wochentag-Array `['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']` durch `[t('diary.weekdayMo'), t('diary.weekdayDi'), t('diary.weekdayMi'), t('diary.weekdayDo'), t('diary.weekdayFr'), t('diary.weekdaySa'), t('diary.weekdaySo')]` ersetzen (innerhalb der Komponente berechnen, nicht mehr als Modul-Konstante). `RATING_LABELS`-Objekt (`gut`/`mittel`/`schub-verdächtig`) analog durch `t('diary.ratingGood')` / `t('diary.ratingMedium')` / `t('diary.ratingBad')` ersetzen — falls `RATING_LABELS` aktuell als Modul-Konstante definiert ist, in eine Funktion `getRatingLabel(rating, t)` umwandeln, die innerhalb der Komponente mit dem lokalen `t` aufgerufen wird. `'Vorheriger Monat'` → `t('diary.prevMonthA11y')`, `'Nächster Monat'` → `t('diary.nextMonthA11y')`. Legende: `'Gut ·'` → `t('diary.legendGood')`, `'Mittel ·'` → `t('diary.legendMedium')`, `'Schub-verdächtig'` → `t('diary.legendBad')`. Tages-Accessibility-Label: ohne Bewertung `t('diary.dayCellA11yPlain', { day: cell.dayOfMonth })`, mit Bewertung `t('diary.dayCellA11yWithRating', { day: cell.dayOfMonth, rating: getRatingLabel(rating, t) })`.

- [ ] **Step 11: `DiaryEntryForm.tsx` migrieren**

`useTranslation` importieren, `t` holen. Ersetzungen:

| Alt | Neu |
|---|---|
| `'Stuhlgang-Häufigkeit (dieser Eintrag)'` | `t('diary.stoolFrequencyLabel')` |
| `'Blut im Stuhl'` (Sektionslabel) | `t('diary.bloodSectionLabel')` |
| `'Nein'` (Button) | `t('common.no')` |
| `'Ja'` (Button) | `t('common.yes')` |
| `'Stuhlgang-Konsistenz'` | `t('diary.consistencyLabel')` |
| `'Schmerzlevel (0-10)'` | `t('diary.painLevelLabel')` |
| `'Symptome'` | `t('diary.symptomsLabel')` |
| `'Mögliche Auslöser'` | `t('diary.triggersLabel')` |
| `'Welches Lebensmittel? (optional)'` | `t('diary.foodTriggerNoteLabel')` |
| `` `${suggestion} hinzufügen` `` | `t('diary.foodSuggestionA11y', { suggestion })` |
| `'z. B. Kaffee, Milchprodukte …'` | `t('diary.foodTriggerPlaceholder')` |
| `'Notiz'` | `t('diary.noteLabel')` |
| `'Zusätzliche Beobachtungen …'` | `t('diary.notePlaceholder')` |
| `'Eintrag speichern'` | `t('diary.submitButton')` |

- [ ] **Step 12: `DiaryHistoryList.tsx` migrieren**

`useTranslation` importieren, `t` holen. Ersetzungen:

| Alt | Neu |
|---|---|
| `'Noch keine Einträge. Tippe auf „+“, um deinen ersten Eintrag anzulegen.'` | `t('diary.emptyState')` |
| `` `Stuhlgang: ${item.stoolFrequency}× · ${consistencyLabel}` `` | `t('diary.stoolPrefixLine', { count: item.stoolFrequency, label: consistencyLabel })` |
| `` `Schmerzlevel: ${item.painLevel}/10` `` | `t('diary.painPrefixLine', { level: item.painLevel })` |
| `'Blut im Stuhl'` | `t('diary.bloodSectionLabel')` |
| `` `Auslöser: ${triggerLabels.join(', ')}` `` | `t('diary.triggersLine', { labels: triggerLabels.join(', ') })` |
| `` `Symptome: ${symptomLabels.join(', ')}` `` | `t('diary.symptomsLine', { labels: symptomLabels.join(', ') })` |
| `'Löschen'` | `t('common.delete')` |
| `` `Eintrag vom ${formatOccurredAt(item.occurredAt)} löschen` `` | `t('diary.deleteA11y', { date: formatOccurredAt(item.occurredAt) })` |

- [ ] **Step 13: `DiaryTrendChart.tsx` migrieren**

`'7 Tage'` → `t('diary.range7')`, `'30 Tage'` → `t('diary.range30')`, `'90 Tage'` → `t('diary.range90')`, `'Schmerzlevel'` (Chart-Titel) → `t('diary.chartPainTitle')`, `'Stuhlgang-Häufigkeit'` (Chart-Titel) → `t('diary.chartStoolTitle')`, `'Keine Daten in diesem Zeitraum.'` → `t('diary.noDataInRange')`.

- [ ] **Step 14: `FlareWarningBanner.tsx` migrieren**

`'Warnung schließen'` → `t('diary.flareCloseA11y')`. Die zweizeilige Warnmeldung → `t('diary.flareMessage')`.

- [ ] **Step 15: `TriggerAnalysisView.tsx` migrieren**

`'Noch keine Auswertung möglich. Erfasse Einträge mit Auslösern im Tagebuch, um hier Muster zu sehen.'` → `t('diary.triggerEmptyState')`. Pluralisierung `` `${pattern.entryCount} ${pattern.entryCount === 1 ? 'Eintrag' : 'Einträge'}` `` → `` `${pattern.entryCount} ${pattern.entryCount === 1 ? t('diary.entrySingular') : t('diary.entryPlural')}` ``. `` `Ø Schmerzlevel: ${pattern.averagePainLevel}/10` `` → `t('diary.averagePain', { level: pattern.averagePainLevel })`.

- [ ] **Step 16: Typprüfung und Tests**

Run: `npx tsc --noEmit`
Run: `npm test`
Expected: `formLogic.test.ts` weiterhin grün (Assertions unverändert, nur zusätzliches `t`-Argument).

- [ ] **Step 17: Commit**

```bash
git add src/i18n src/features/diary "app/(tabs)/tagebuch"
git commit -m "feat: Tagebuch-Haupt-UI vollstaendig uebersetzen"
```

---

## Task 7: Tagebuch-Export (CSV + PDF)

**Files:**
- Modify: `src/features/diary/diaryCsvBuilder.ts`
- Modify: `src/features/diary/diaryPdfBuilder.ts`
- Modify: `src/features/diary/diaryCsvExport.ts`
- Modify: `src/features/diary/diaryPdfExport.ts`
- Modify: `app/(tabs)/tagebuch/index.tsx` (Aufrufstellen der Export-Funktionen)

**Interfaces:**
- Consumes: `diary.csv.*`, `diary.pdf.*`, `common.sharingUnavailable` (Task 6/1).
- Produces: `buildDiaryCsv(entries, t)`, `buildDiaryPdfHtml(entries, t, language)`, `exportDiaryEntriesAsCsv(entries, t)`, `exportDiaryEntriesAsPdf(entries, t, language)`.

- [ ] **Step 1: `diaryCsvBuilder.ts` anpassen**

Signatur von `buildDiaryCsv` und der internen `buildEntryRow`-Hilfsfunktion um `t` erweitern:
```typescript
function buildEntryRow(
  entry: DiaryEntryWithTriggers,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  const consistencyLabel = labelFor(STOOL_CONSISTENCY_OPTIONS, entry.stoolConsistency);
  const triggerLabels = buildTriggerLabels(entry.triggerCategories, entry.foodTriggerNote);
  const symptomLabels = entry.symptoms.map((symptom) => labelFor(SYMPTOM_OPTIONS, symptom));

  const fields = [
    formatOccurredAt(entry.occurredAt),
    String(entry.stoolFrequency),
    consistencyLabel,
    String(entry.painLevel),
    entry.hasBlood ? t('common.yes') : t('common.no'),
    triggerLabels.join(', '),
    symptomLabels.join(', '),
    entry.note ?? '',
  ];

  return fields.map(escapeCsvField).join(CSV_DELIMITER);
}

export function buildDiaryCsv(
  entries: DiaryEntryWithTriggers[],
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  const header = [
    t('diary.csv.headerDate'),
    t('diary.csv.headerFrequency'),
    t('diary.csv.headerConsistency'),
    t('diary.csv.headerPain'),
    t('diary.csv.headerBlood'),
    t('diary.csv.headerTriggers'),
    t('diary.csv.headerSymptoms'),
    t('diary.csv.headerNote'),
  ];
  const rows = [header.join(CSV_DELIMITER), ...entries.map((entry) => buildEntryRow(entry, t))];
  return CSV_BOM + rows.join(CSV_LINE_BREAK);
}
```
Die Modul-Konstante `CSV_HEADER` entfernen (durch die dynamische `header`-Variable oben ersetzt).

- [ ] **Step 2: `diaryPdfBuilder.ts` anpassen**

Signatur von `buildEntrySection` und `buildDiaryPdfHtml` um `t` (und bei `buildDiaryPdfHtml` zusätzlich `language`) erweitern:
```typescript
function buildEntrySection(
  entry: DiaryEntryWithTriggers,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  const consistencyLabel = labelFor(STOOL_CONSISTENCY_OPTIONS, entry.stoolConsistency);
  const triggerLabels = buildTriggerLabels(entry.triggerCategories, entry.foodTriggerNote);
  const symptomLabels = entry.symptoms.map((symptom) => labelFor(SYMPTOM_OPTIONS, symptom));

  return `
    <section class="entry">
      <h2>${escapeHtml(formatOccurredAt(entry.occurredAt))}</h2>
      <p>${escapeHtml(t('diary.stoolPrefixLine', { count: entry.stoolFrequency, label: consistencyLabel }))}</p>
      <p>${escapeHtml(t('diary.painPrefixLine', { level: entry.painLevel }))}</p>
      ${entry.hasBlood ? `<p class="warning">${escapeHtml(t('diary.bloodSectionLabel'))}</p>` : ''}
      ${triggerLabels.length > 0 ? `<p>${escapeHtml(t('diary.triggersLine', { labels: triggerLabels.join(', ') }))}</p>` : ''}
      ${symptomLabels.length > 0 ? `<p>${escapeHtml(t('diary.symptomsLine', { labels: symptomLabels.join(', ') }))}</p>` : ''}
      ${entry.note ? `<p class="note">${escapeHtml(entry.note)}</p>` : ''}
    </section>
  `;
}

export function buildDiaryPdfHtml(
  entries: DiaryEntryWithTriggers[],
  t: (key: string, vars?: Record<string, string | number>) => string,
  language: Language
): string {
  const body =
    entries.length > 0
      ? entries.map((entry) => buildEntrySection(entry, t)).join('\n')
      : `<p>${escapeHtml(t('diary.pdf.emptyState'))}</p>`;

  return `
    <!DOCTYPE html>
    <html lang="${language}">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, sans-serif; color: #2E2A26; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .generated { color: #6B6259; font-size: 12px; margin-bottom: 24px; }
          .entry { border-bottom: 1px solid #E4DACB; padding: 12px 0; }
          .entry h2 { font-size: 14px; margin: 0 0 6px; }
          .entry p { font-size: 12px; margin: 2px 0; }
          .warning { color: #B5533C; font-weight: 600; }
          .note { font-style: italic; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(t('diary.pdf.title'))}</h1>
        <p class="generated">${escapeHtml(t('diary.pdf.generatedOn', { date: formatOccurredAt(new Date().toISOString()) }))}</p>
        ${body}
      </body>
    </html>
  `;
}
```
Import ergänzen: `import type { Language } from '../../i18n/types';`

Hinweis: Die `${entry.stoolFrequency}&times; &middot;` HTML-Entities aus der Original-Zeile 21 sind bereits Teil des `diary.stoolPrefixLine`-Templates (`{{count}}× · {{label}}` — das reale `×`/`·`-Unicode-Zeichen statt HTML-Entity), das über `escapeHtml` läuft. Da `escapeHtml` nur `&`, `<`, `>`, `"` ersetzt, bleiben `×`/`·` unverändert im HTML-Output erhalten — funktional identisch zu den bisherigen Entities.

- [ ] **Step 3: `diaryCsvExport.ts` anpassen**

```typescript
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildDiaryCsv } from './diaryCsvBuilder';
import type { DiaryEntryWithTriggers } from './types';

const EXPORT_DIRECTORY_NAME = 'colitis-exports';

export async function exportDiaryEntriesAsCsv(
  entries: DiaryEntryWithTriggers[],
  t: (key: string, vars?: Record<string, string | number>) => string
): Promise<void> {
  const csv = buildDiaryCsv(entries, t);

  const directory = new Directory(Paths.cache, EXPORT_DIRECTORY_NAME);
  directory.create({ idempotent: true });

  const fileName = `tagebuch-export-${new Date().toISOString().slice(0, 10)}.csv`;
  const file = new File(directory, fileName);
  file.create({ overwrite: true });
  file.write(csv);

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error(t('common.sharingUnavailable'));
  }
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  } finally {
    file.delete();
  }
}
```

- [ ] **Step 4: `diaryPdfExport.ts` anpassen**

```typescript
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildDiaryPdfHtml } from './diaryPdfBuilder';
import type { DiaryEntryWithTriggers } from './types';
import type { Language } from '../../i18n/types';

export async function exportDiaryEntriesAsPdf(
  entries: DiaryEntryWithTriggers[],
  t: (key: string, vars?: Record<string, string | number>) => string,
  language: Language
): Promise<void> {
  const html = buildDiaryPdfHtml(entries, t, language);
  const { uri } = await Print.printToFileAsync({ html });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error(t('common.sharingUnavailable'));
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
```

- [ ] **Step 5: Aufrufstellen in `app/(tabs)/tagebuch/index.tsx` anpassen**

`t` und `language` stehen dort bereits aus Task 6 (`useTranslation()`) zur Verfügung. Jeden Aufruf `exportDiaryEntriesAsCsv(entries)` → `exportDiaryEntriesAsCsv(entries, t)`, `exportDiaryEntriesAsPdf(entries)` → `exportDiaryEntriesAsPdf(entries, t, language)`.

- [ ] **Step 6: Typprüfung und Tests**

Run: `npx tsc --noEmit`
Run: `npm test`
(Diese Builder-Dateien haben laut bisheriger Erkundung keine eigenen `.test.ts`-Dateien — falls doch vorhanden, deren Aufrufe analog zu Task 6 Step 4 um einen Test-`t` erweitern.)

- [ ] **Step 7: Commit**

```bash
git add src/features/diary/diaryCsvBuilder.ts src/features/diary/diaryPdfBuilder.ts src/features/diary/diaryCsvExport.ts src/features/diary/diaryPdfExport.ts "app/(tabs)/tagebuch/index.tsx"
git commit -m "feat: Tagebuch-CSV-/PDF-Export uebersetzen"
```

---

## Task 8: Arztbesuche (Screens, Komponenten, Validierung, PDF-Export)

**Files:**
- Create: `src/i18n/translations/de/doctorVisits.ts`
- Create: `src/i18n/translations/en/doctorVisits.ts`
- Modify: `src/i18n/translations/de/index.ts`, `src/i18n/translations/en/index.ts`
- Modify: `app/(tabs)/tagebuch/arztbesuche/index.tsx`
- Modify: `app/(tabs)/tagebuch/arztbesuche/neu.tsx`
- Modify: `app/(tabs)/tagebuch/arztbesuche/[id].tsx`
- Modify: `src/features/doctorVisits/components/DoctorVisitForm.tsx`
- Modify: `src/features/doctorVisits/components/DoctorVisitList.tsx`
- Modify: `src/features/doctorVisits/formLogic.ts`
- Modify: `src/features/doctorVisits/formLogic.test.ts`
- Modify: `src/features/doctorVisits/doctorVisitPassBuilder.ts`
- Modify: `src/features/doctorVisits/doctorVisitPassExport.ts`

**Interfaces:**
- Consumes: `useTranslation()`, `common.*`.
- Produces: `doctorVisits.*` Keys (vollständig). `buildDoctorVisitPassHtml(visits, today, t, language)`, `exportDoctorVisitPass(visits, t, language)`.

- [ ] **Step 1: `doctorVisits`-Namespace**

`src/i18n/translations/de/doctorVisits.ts`:
```typescript
export const doctorVisits = {
  loadFailure: 'Arztbesuche konnten nicht geladen werden.',
  deleteConfirmTitle: 'Arztbesuch löschen?',
  deleteConfirmMessage: 'Dieser Arztbesuch wird endgültig gelöscht.',
  deleteFailure: 'Arztbesuch konnte nicht gelöscht werden.',
  saveFailure: 'Arztbesuch konnte nicht gespeichert werden.',
  updateFailure: 'Änderungen konnten nicht gespeichert werden.',
  notFound: 'Arztbesuch wurde nicht gefunden.',
  loadForEditFailure: 'Arztbesuch konnte nicht geladen werden.',
  exportFailure: 'Arztbesuch-Übersicht konnte nicht exportiert werden.',
  exportA11y: 'Arztbesuch-Übersicht als PDF exportieren',
  exportingButton: 'PDF wird erstellt …',
  loading: 'Arztbesuche werden geladen …',
  loadingSingle: 'Arztbesuch wird geladen …',
  addA11y: 'Neuen Arztbesuch anlegen',
  submitLabelCreate: 'Arztbesuch speichern',
  submitLabelEdit: 'Änderungen speichern',

  dateLabel: 'Datum (JJJJ-MM-TT)',
  doctorLabel: 'Arzt/Fachrichtung (optional)',
  doctorPlaceholder: 'z. B. Dr. Müller, Gastroenterologie',
  reasonLabel: 'Anlass/Grund (optional)',
  reasonPlaceholder: 'z. B. Kontrolle, akuter Schub',
  noteLabel: 'Notizen/Ergebnis (optional)',
  notePlaceholder: 'z. B. Befund, Besprochenes, Medikamentenänderungen',
  nextAppointmentLabel: 'Nächster Termin (optional, JJJJ-MM-TT)',
  nextAppointmentPlaceholder: 'Leer lassen, falls noch kein Folgetermin bekannt',

  emptyState: 'Noch keine Arztbesuche. Tippe auf „+“, um deinen ersten Besuch anzulegen.',
  nextAppointmentLine: 'Nächster Termin: {{date}}',
  editA11y: 'Arztbesuch vom {{date}} bearbeiten',
  deleteA11y: 'Arztbesuch vom {{date}} löschen',

  invalidVisitDate: 'Bitte ein gültiges Datum eingeben (JJJJ-MM-TT).',
  invalidNextAppointment: 'Bitte ein gültiges Datum für den nächsten Termin eingeben (JJJJ-MM-TT) oder leer lassen.',

  pdfEmpty: 'Keine Arztbesuche erfasst.',
  pdfTitle: 'Arztbesuch-Übersicht',
  pdfGeneratedOn: 'Erstellt am {{date}}',
};
```

`src/i18n/translations/en/doctorVisits.ts`:
```typescript
export const doctorVisits = {
  loadFailure: 'Doctor visits could not be loaded.',
  deleteConfirmTitle: 'Delete doctor visit?',
  deleteConfirmMessage: 'This doctor visit will be permanently deleted.',
  deleteFailure: 'The doctor visit could not be deleted.',
  saveFailure: 'The doctor visit could not be saved.',
  updateFailure: 'The changes could not be saved.',
  notFound: 'Doctor visit not found.',
  loadForEditFailure: 'The doctor visit could not be loaded.',
  exportFailure: 'The doctor visit overview could not be exported.',
  exportA11y: 'Export doctor visit overview as PDF',
  exportingButton: 'Generating PDF …',
  loading: 'Loading doctor visits …',
  loadingSingle: 'Loading doctor visit …',
  addA11y: 'Add new doctor visit',
  submitLabelCreate: 'Save doctor visit',
  submitLabelEdit: 'Save changes',

  dateLabel: 'Date (YYYY-MM-DD)',
  doctorLabel: 'Doctor/specialty (optional)',
  doctorPlaceholder: 'e.g. Dr. Miller, gastroenterology',
  reasonLabel: 'Reason (optional)',
  reasonPlaceholder: 'e.g. check-up, acute flare',
  noteLabel: 'Notes/result (optional)',
  notePlaceholder: 'e.g. findings, discussion, medication changes',
  nextAppointmentLabel: 'Next appointment (optional, YYYY-MM-DD)',
  nextAppointmentPlaceholder: 'Leave blank if no follow-up appointment is known yet',

  emptyState: 'No doctor visits yet. Tap "+" to add your first visit.',
  nextAppointmentLine: 'Next appointment: {{date}}',
  editA11y: 'Edit doctor visit from {{date}}',
  deleteA11y: 'Delete doctor visit from {{date}}',

  invalidVisitDate: 'Please enter a valid date (YYYY-MM-DD).',
  invalidNextAppointment: 'Please enter a valid date for the next appointment (YYYY-MM-DD) or leave it blank.',

  pdfEmpty: 'No doctor visits recorded.',
  pdfTitle: 'Doctor visit overview',
  pdfGeneratedOn: 'Generated on {{date}}',
};
```

- [ ] **Step 2: Einhängen**

`de/index.ts`/`en/index.ts`: `doctorVisits` importieren und exportieren.

- [ ] **Step 3: `app/(tabs)/tagebuch/arztbesuche/index.tsx` migrieren**

`useTranslation` importieren, `const { t, language } = useTranslation();` ergänzen. Ersetzungen:

| Alt | Neu |
|---|---|
| `'Arztbesuche konnten nicht geladen werden.'` | `t('doctorVisits.loadFailure')` |
| `'Arztbesuch löschen?'` | `t('doctorVisits.deleteConfirmTitle')` |
| `'Dieser Arztbesuch wird endgültig gelöscht.'` | `t('doctorVisits.deleteConfirmMessage')` |
| `'Abbrechen'` | `t('common.cancel')` |
| `'Löschen'` | `t('common.delete')` |
| `'Arztbesuch konnte nicht gelöscht werden.'` | `t('doctorVisits.deleteFailure')` |
| `'Arztbesuch-Übersicht konnte nicht exportiert werden.'` | `t('doctorVisits.exportFailure')` |
| `'Arztbesuch-Übersicht als PDF exportieren'` (a11y + Button-Text, 2 Vorkommen) | `t('doctorVisits.exportA11y')` |
| `'PDF wird erstellt …'` | `t('doctorVisits.exportingButton')` |
| `'Arztbesuche werden geladen …'` | `t('doctorVisits.loading')` |
| `'Neuen Arztbesuch anlegen'` | `t('doctorVisits.addA11y')` |

Aufruf von `exportDoctorVisitPass(visits)` → `exportDoctorVisitPass(visits, t, language)`.

- [ ] **Step 4: `app/(tabs)/tagebuch/arztbesuche/neu.tsx` migrieren**

`'Arztbesuch konnte nicht gespeichert werden.'` → `t('doctorVisits.saveFailure')`. `submitLabel="Arztbesuch speichern"` → `submitLabel={t('doctorVisits.submitLabelCreate')}`.

- [ ] **Step 5: `app/(tabs)/tagebuch/arztbesuche/[id].tsx` migrieren**

| Alt | Neu |
|---|---|
| `'Arztbesuch wurde nicht gefunden.'` | `t('doctorVisits.notFound')` |
| `'Arztbesuch konnte nicht geladen werden.'` | `t('doctorVisits.loadForEditFailure')` |
| `'Änderungen konnten nicht gespeichert werden.'` | `t('doctorVisits.updateFailure')` |
| `'Arztbesuch wird geladen …'` | `t('doctorVisits.loadingSingle')` |
| `submitLabel="Änderungen speichern"` | `submitLabel={t('doctorVisits.submitLabelEdit')}` |

- [ ] **Step 6: `DoctorVisitForm.tsx` migrieren**

| Alt | Neu |
|---|---|
| `'Datum (JJJJ-MM-TT)'` | `t('doctorVisits.dateLabel')` |
| `'Arzt/Fachrichtung (optional)'` | `t('doctorVisits.doctorLabel')` |
| `'z. B. Dr. Müller, Gastroenterologie'` | `t('doctorVisits.doctorPlaceholder')` |
| `'Anlass/Grund (optional)'` | `t('doctorVisits.reasonLabel')` |
| `'z. B. Kontrolle, akuter Schub'` | `t('doctorVisits.reasonPlaceholder')` |
| `'Notizen/Ergebnis (optional)'` | `t('doctorVisits.noteLabel')` |
| `'z. B. Befund, Besprochenes, Medikamentenänderungen'` | `t('doctorVisits.notePlaceholder')` |
| `'Nächster Termin (optional, JJJJ-MM-TT)'` | `t('doctorVisits.nextAppointmentLabel')` |
| `'Leer lassen, falls noch kein Folgetermin bekannt'` | `t('doctorVisits.nextAppointmentPlaceholder')` |

Das literale Datumsbeispiel `'2026-07-20'` (Placeholder-Prop) bleibt unverändert (siehe Global Constraints).

- [ ] **Step 7: `DoctorVisitList.tsx` migrieren**

| Alt | Neu |
|---|---|
| `'Noch keine Arztbesuche. Tippe auf „+“, um deinen ersten Besuch anzulegen.'` | `t('doctorVisits.emptyState')` |
| `` `Nächster Termin: ${formatGermanDate(item.nextAppointmentDate)}` `` | `t('doctorVisits.nextAppointmentLine', { date: formatGermanDate(item.nextAppointmentDate) })` |
| `'Löschen'` | `t('common.delete')` |
| `` `Arztbesuch vom ${formatGermanDate(item.visitDate)} bearbeiten` `` | `t('doctorVisits.editA11y', { date: formatGermanDate(item.visitDate) })` |
| `` `Arztbesuch vom ${formatGermanDate(item.visitDate)} löschen` `` | `t('doctorVisits.deleteA11y', { date: formatGermanDate(item.visitDate) })` |

- [ ] **Step 8: `formLogic.ts` + `formLogic.test.ts` anpassen**

`src/features/doctorVisits/formLogic.ts` — `validateDoctorVisitForm` ändern (`buildDoctorVisitInput` bleibt unverändert, sie enthält keinen Text):
```typescript
export function validateDoctorVisitForm(
  state: DoctorVisitFormState,
  t: (key: string, vars?: Record<string, string | number>) => string
): string[] {
  const errors: string[] = [];

  if (!isValidCalendarDate(state.visitDate)) {
    errors.push(t('doctorVisits.invalidVisitDate'));
  }
  if (state.nextAppointmentDate.length > 0 && !isValidCalendarDate(state.nextAppointmentDate)) {
    errors.push(t('doctorVisits.invalidNextAppointment'));
  }

  return errors;
}
```
`formLogic.test.ts`: wie in Task 6 Step 4 `createTranslator`/`translations` importieren, `const t = createTranslator(translations.de, translations.de);` anlegen, jeden Aufruf `validateDoctorVisitForm(state)` zu `validateDoctorVisitForm(state, t)` ändern. Aufrufstelle(n) in `DoctorVisitForm.tsx`/`app/(tabs)/tagebuch/arztbesuche/neu.tsx`/`[id].tsx` (grep nach `validateDoctorVisitForm(`) um `t` aus `useTranslation()` ergänzen.

- [ ] **Step 9: `doctorVisitPassBuilder.ts` anpassen**

```typescript
import type { DoctorVisit } from './types';
import type { Language } from '../../i18n/types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatGermanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

function buildVisitSection(
  visit: DoctorVisit,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  return `
    <section class="visit">
      <h2>${escapeHtml(formatGermanDate(visit.visitDate))}</h2>
      ${visit.doctorName ? `<p>${escapeHtml(visit.doctorName)}</p>` : ''}
      ${visit.reason ? `<p>${escapeHtml(visit.reason)}</p>` : ''}
      ${visit.note ? `<p class="note">${escapeHtml(visit.note)}</p>` : ''}
      ${
        visit.nextAppointmentDate
          ? `<p>${escapeHtml(t('doctorVisits.nextAppointmentLine', { date: formatGermanDate(visit.nextAppointmentDate) }))}</p>`
          : ''
      }
    </section>
  `;
}

export function buildDoctorVisitPassHtml(
  visits: DoctorVisit[],
  today: Date,
  t: (key: string, vars?: Record<string, string | number>) => string,
  language: Language
): string {
  const body =
    visits.length > 0
      ? visits.map((visit) => buildVisitSection(visit, t)).join('\n')
      : `<p>${escapeHtml(t('doctorVisits.pdfEmpty'))}</p>`;

  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();

  return `
    <!DOCTYPE html>
    <html lang="${language}">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, sans-serif; color: #2E2A26; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .generated { color: #6B6259; font-size: 12px; margin-bottom: 24px; }
          .visit { border-bottom: 1px solid #E4DACB; padding: 12px 0; }
          .visit h2 { font-size: 14px; margin: 0 0 6px; }
          .visit p { font-size: 12px; margin: 2px 0; }
          .note { font-style: italic; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(t('doctorVisits.pdfTitle'))}</h1>
        <p class="generated">${escapeHtml(t('doctorVisits.pdfGeneratedOn', { date: `${day}.${month}.${year}` }))}</p>
        ${body}
      </body>
    </html>
  `;
}
```

- [ ] **Step 10: `doctorVisitPassExport.ts` anpassen**

```typescript
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildDoctorVisitPassHtml } from './doctorVisitPassBuilder';
import type { DoctorVisit } from './types';
import type { Language } from '../../i18n/types';

export async function exportDoctorVisitPass(
  visits: DoctorVisit[],
  t: (key: string, vars?: Record<string, string | number>) => string,
  language: Language
): Promise<void> {
  const html = buildDoctorVisitPassHtml(visits, new Date(), t, language);
  const { uri } = await Print.printToFileAsync({ html });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error(t('common.sharingUnavailable'));
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
```

- [ ] **Step 11: Typprüfung und Tests**

Run: `npx tsc --noEmit`
Run: `npm test`

- [ ] **Step 12: Commit**

```bash
git add src/i18n src/features/doctorVisits "app/(tabs)/tagebuch/arztbesuche"
git commit -m "feat: Arztbesuche vollstaendig uebersetzen"
```

---

## Task 9: Medikamente (Screens, Komponenten, Validierung, Benachrichtigungen, PDF-Export)

**Files:**
- Create: `src/i18n/translations/de/medications.ts`
- Create: `src/i18n/translations/en/medications.ts`
- Modify: `src/i18n/translations/de/index.ts`, `src/i18n/translations/en/index.ts`
- Modify: `app/(tabs)/medikamente/index.tsx`
- Modify: `app/(tabs)/medikamente/[id].tsx`
- Modify: `app/(tabs)/medikamente/neu.tsx`
- Modify: `src/features/medications/components/MedicationForm.tsx`
- Modify: `src/features/medications/components/MedicationList.tsx`
- Modify: `src/features/medications/components/ScreeningReminderCard.tsx`
- Modify: `src/features/medications/formLogic.ts`
- Modify: `src/features/medications/formLogic.test.ts`
- Modify: `src/features/medications/reminderScheduling.ts`
- Modify: `src/features/medications/notifications/reminderContent.ts`
- Modify: `src/features/medications/medicationPassBuilder.ts`
- Modify: `src/features/medications/medicationPassExport.ts`

**Interfaces:**
- Consumes: `useTranslation()`, `common.*`.
- Produces: `medications.*` Keys (vollständig).

- [ ] **Step 1: `medications`-Namespace**

`src/i18n/translations/de/medications.ts`:
```typescript
export const medications = {
  loadFailure: 'Medikamente konnten nicht geladen werden.',
  markTakenFailure: 'Einnahme konnte nicht gespeichert werden.',
  endConfirmTitle: 'Medikament beenden?',
  endConfirmMessage: '„{{name}}“ wird als beendet markiert, bleibt aber in der Liste.',
  endConfirmConfirm: 'Beenden',
  endFailure: 'Medikament konnte nicht beendet werden.',
  deleteConfirmTitle: 'Medikament löschen?',
  deleteConfirmMessage: '„{{name}}“ wird endgültig gelöscht.',
  deleteFailure: 'Medikament konnte nicht gelöscht werden.',
  screeningSaveFailure: 'Vorsorge-Erinnerung konnte nicht gespeichert werden.',
  screeningDeleteFailure: 'Vorsorge-Erinnerung konnte nicht gelöscht werden.',
  passExportFailure: 'Medikamenten-Pass konnte nicht exportiert werden.',
  passExportA11y: 'Medikamenten-Pass als PDF exportieren',
  passExportingButton: 'PDF wird erstellt …',
  loading: 'Medikamente werden geladen …',
  addA11y: 'Neues Medikament anlegen',

  notFound: 'Medikament wurde nicht gefunden.',
  loadFailureSingle: 'Medikament konnte nicht geladen werden.',
  updateFailure: 'Änderungen konnten nicht gespeichert werden.',
  loadingSingle: 'Medikament wird geladen …',
  submitLabelEdit: 'Änderungen speichern',
  saveFailure: 'Medikament konnte nicht gespeichert werden.',
  submitLabelCreate: 'Medikament speichern',

  nameLabel: 'Name',
  namePlaceholder: 'z. B. Salofalk',
  doseLabel: 'Dosis',
  dosePlaceholder: 'z. B. 500mg',
  scheduleLabel: 'Einnahmeschema',
  schedulePlaceholder: 'z. B. 1x täglich morgens',
  startDateLabel: 'Startdatum (JJJJ-MM-TT)',
  endDateLabel: 'Enddatum (optional, JJJJ-MM-TT)',
  endDatePlaceholder: 'Leer lassen, falls noch aktiv',
  remindersLabel: 'Erinnerungszeiten',
  remindersHint:
    'Für Erinnerungen wird beim Speichern die Benachrichtigungserlaubnis angefragt. Bei Ablehnung werden die Zeiten trotzdem gespeichert, aber ohne Push-Erinnerung.',
  removeReminderA11y: 'Erinnerungszeit {{time}} entfernen',
  reminderTimePlaceholder: 'HH:mm, z. B. 08:00',
  sideEffectsLabel: 'Nebenwirkungen (optional)',
  sideEffectsPlaceholder: 'z. B. Verursacht gelegentlich Übelkeit',

  emptyState: 'Noch keine Medikamente. Tippe auf „+“, um dein erstes Medikament anzulegen.',
  takenTodayDone: 'Heute genommen ✓',
  takenTodayPending: 'Heute genommen',
  endButton: 'Beenden',
  endedBadge: 'Beendet',
  remindersPrefix: 'Erinnerungen: {{times}}',
  sideEffectsPrefix: 'Nebenwirkungen: {{note}}',
  endedOnPrefix: 'Beendet am {{date}}',
  takenA11yDone: '{{name}} heute bereits genommen',
  takenA11yPending: '{{name}} heute genommen',
  editA11y: '{{name}} bearbeiten',
  endA11y: '{{name}} beenden',
  endedA11y: '{{name}} beendet',
  deleteA11y: '{{name}} löschen',

  invalidInterval: 'Bitte ein gültiges Intervall in Monaten eingeben (ganze Zahl größer 0).',
  invalidDate: 'Bitte ein gültiges Datum eingeben (JJJJ-MM-TT).',
  screeningDeleteConfirmTitle: 'Vorsorge-Termin löschen?',
  screeningDeleteConfirmMessage: 'Der gespeicherte Koloskopie-Termin wird endgültig gelöscht.',
  screeningTitle: 'Vorsorge-Koloskopie',
  nextDueLabel: 'Nächstes fälliges Datum',
  intervalLabel: 'Intervall',
  intervalValue: 'Alle {{months}} Monate',
  screeningNoteLabel: 'Notiz',
  screeningHint:
    'Für die Erinnerung wird beim Speichern die Benachrichtigungserlaubnis angefragt. Bei Ablehnung wird der Termin trotzdem gespeichert, aber ohne Push-Erinnerung.',
  intervalFieldLabel: 'Intervall (Monate)',
  intervalPlaceholder: 'z. B. 12',
  nextDueFieldLabel: 'Nächstes fälliges Datum (JJJJ-MM-TT)',
  screeningNotePlaceholder: 'z. B. Rücksprache mit Dr. …',

  missingName: 'Bitte einen Namen eingeben.',
  missingDose: 'Bitte eine Dosis eingeben.',
  missingSchedule: 'Bitte ein Einnahmeschema eingeben.',
  invalidStartDate: 'Bitte ein gültiges Startdatum eingeben (JJJJ-MM-TT).',
  invalidEndDate: 'Bitte ein gültiges Enddatum eingeben (JJJJ-MM-TT) oder leer lassen.',
  endBeforeStart: 'Das Enddatum darf nicht vor dem Startdatum liegen.',
  invalidReminderTime: 'Ungültige Erinnerungszeit: "{{time}}" (erwartet HH:mm).',
  invalidScreeningDateInternal: 'Ungültiges Vorsorge-Datum: "{{date}}" (erwartet JJJJ-MM-TT)',

  reminderNotificationTitle: 'Medikamenten-Erinnerung',
  reminderNotificationBody: '{{name}} – {{dose}}',
  screeningReminderNotificationTitle: 'Vorsorge-Koloskopie',
  screeningReminderNotificationBody: 'Deine Vorsorge-Koloskopie ist fällig.',

  pdfSinceLabel: 'Seit {{date}}',
  pdfEmpty: 'Keine aktiven Medikamente vorhanden.',
  pdfTitle: 'Medikamenten-Pass',
  pdfGeneratedOn: 'Erstellt am {{date}}',
};
```

`src/i18n/translations/en/medications.ts`:
```typescript
export const medications = {
  loadFailure: 'Medications could not be loaded.',
  markTakenFailure: 'Taking the dose could not be saved.',
  endConfirmTitle: 'End medication?',
  endConfirmMessage: '"{{name}}" will be marked as ended but stays in the list.',
  endConfirmConfirm: 'End',
  endFailure: 'The medication could not be ended.',
  deleteConfirmTitle: 'Delete medication?',
  deleteConfirmMessage: '"{{name}}" will be permanently deleted.',
  deleteFailure: 'The medication could not be deleted.',
  screeningSaveFailure: 'The screening reminder could not be saved.',
  screeningDeleteFailure: 'The screening reminder could not be deleted.',
  passExportFailure: 'The medication pass could not be exported.',
  passExportA11y: 'Export medication pass as PDF',
  passExportingButton: 'Generating PDF …',
  loading: 'Loading medications …',
  addA11y: 'Add new medication',

  notFound: 'Medication not found.',
  loadFailureSingle: 'The medication could not be loaded.',
  updateFailure: 'The changes could not be saved.',
  loadingSingle: 'Loading medication …',
  submitLabelEdit: 'Save changes',
  saveFailure: 'The medication could not be saved.',
  submitLabelCreate: 'Save medication',

  nameLabel: 'Name',
  namePlaceholder: 'e.g. Salofalk',
  doseLabel: 'Dose',
  dosePlaceholder: 'e.g. 500mg',
  scheduleLabel: 'Dosage schedule',
  schedulePlaceholder: 'e.g. once daily in the morning',
  startDateLabel: 'Start date (YYYY-MM-DD)',
  endDateLabel: 'End date (optional, YYYY-MM-DD)',
  endDatePlaceholder: 'Leave blank if still active',
  remindersLabel: 'Reminder times',
  remindersHint:
    'Saving reminders will request notification permission. If declined, the times are still saved but without a push reminder.',
  removeReminderA11y: 'Remove reminder time {{time}}',
  reminderTimePlaceholder: 'HH:mm, e.g. 08:00',
  sideEffectsLabel: 'Side effects (optional)',
  sideEffectsPlaceholder: 'e.g. occasionally causes nausea',

  emptyState: 'No medications yet. Tap "+" to add your first medication.',
  takenTodayDone: 'Taken today ✓',
  takenTodayPending: 'Taken today',
  endButton: 'End',
  endedBadge: 'Ended',
  remindersPrefix: 'Reminders: {{times}}',
  sideEffectsPrefix: 'Side effects: {{note}}',
  endedOnPrefix: 'Ended on {{date}}',
  takenA11yDone: '{{name}} already taken today',
  takenA11yPending: '{{name}} taken today',
  editA11y: 'Edit {{name}}',
  endA11y: 'End {{name}}',
  endedA11y: '{{name}} ended',
  deleteA11y: 'Delete {{name}}',

  invalidInterval: 'Please enter a valid interval in months (a whole number greater than 0).',
  invalidDate: 'Please enter a valid date (YYYY-MM-DD).',
  screeningDeleteConfirmTitle: 'Delete screening appointment?',
  screeningDeleteConfirmMessage: 'The saved colonoscopy appointment will be permanently deleted.',
  screeningTitle: 'Screening colonoscopy',
  nextDueLabel: 'Next due date',
  intervalLabel: 'Interval',
  intervalValue: 'Every {{months}} months',
  screeningNoteLabel: 'Note',
  screeningHint:
    'Saving the reminder will request notification permission. If declined, the appointment is still saved but without a push reminder.',
  intervalFieldLabel: 'Interval (months)',
  intervalPlaceholder: 'e.g. 12',
  nextDueFieldLabel: 'Next due date (YYYY-MM-DD)',
  screeningNotePlaceholder: 'e.g. discussion with Dr. …',

  missingName: 'Please enter a name.',
  missingDose: 'Please enter a dose.',
  missingSchedule: 'Please enter a dosage schedule.',
  invalidStartDate: 'Please enter a valid start date (YYYY-MM-DD).',
  invalidEndDate: 'Please enter a valid end date (YYYY-MM-DD) or leave it blank.',
  endBeforeStart: 'The end date must not be before the start date.',
  invalidReminderTime: 'Invalid reminder time: "{{time}}" (expected HH:mm).',
  invalidScreeningDateInternal: 'Invalid screening date: "{{date}}" (expected YYYY-MM-DD)',

  reminderNotificationTitle: 'Medication reminder',
  reminderNotificationBody: '{{name}} – {{dose}}',
  screeningReminderNotificationTitle: 'Screening colonoscopy',
  screeningReminderNotificationBody: 'Your screening colonoscopy is due.',

  pdfSinceLabel: 'Since {{date}}',
  pdfEmpty: 'No active medications.',
  pdfTitle: 'Medication pass',
  pdfGeneratedOn: 'Generated on {{date}}',
};
```

- [ ] **Step 2: Einhängen**

`de/index.ts`/`en/index.ts`: `medications` importieren und exportieren.

- [ ] **Step 3: `app/(tabs)/medikamente/index.tsx` migrieren**

`useTranslation` importieren, `const { t, language } = useTranslation();` ergänzen. Ersetzungen:

| Alt | Neu |
|---|---|
| `'Medikamente konnten nicht geladen werden.'` | `t('medications.loadFailure')` |
| `'Einnahme konnte nicht gespeichert werden.'` | `t('medications.markTakenFailure')` |
| `'Medikament beenden?'` | `t('medications.endConfirmTitle')` |
| `` `„${medication.name}“ wird als beendet markiert, bleibt aber in der Liste.` `` | `t('medications.endConfirmMessage', { name: medication.name })` |
| `'Abbrechen'` | `t('common.cancel')` |
| `'Beenden'` | `t('medications.endConfirmConfirm')` |
| `'Medikament konnte nicht beendet werden.'` | `t('medications.endFailure')` |
| `'Medikament löschen?'` | `t('medications.deleteConfirmTitle')` |
| `` `„${medication.name}“ wird endgültig gelöscht.` `` | `t('medications.deleteConfirmMessage', { name: medication.name })` |
| `'Löschen'` | `t('common.delete')` |
| `'Medikament konnte nicht gelöscht werden.'` | `t('medications.deleteFailure')` |
| `'Vorsorge-Erinnerung konnte nicht gespeichert werden.'` | `t('medications.screeningSaveFailure')` |
| `'Vorsorge-Erinnerung konnte nicht gelöscht werden.'` | `t('medications.screeningDeleteFailure')` |
| `'Medikamenten-Pass konnte nicht exportiert werden.'` | `t('medications.passExportFailure')` |
| `'Medikamenten-Pass als PDF exportieren'` (a11y + Button-Text) | `t('medications.passExportA11y')` |
| `'PDF wird erstellt …'` | `t('medications.passExportingButton')` |
| `'Medikamente werden geladen …'` | `t('medications.loading')` |
| `'Neues Medikament anlegen'` | `t('medications.addA11y')` |

Aufruf von `exportMedicationPass(medications)` → `exportMedicationPass(medications, t, language)`.

- [ ] **Step 4: `app/(tabs)/medikamente/[id].tsx` migrieren**

| Alt | Neu |
|---|---|
| `'Medikament wurde nicht gefunden.'` | `t('medications.notFound')` |
| `'Medikament konnte nicht geladen werden.'` | `t('medications.loadFailureSingle')` |
| `'Änderungen konnten nicht gespeichert werden.'` | `t('medications.updateFailure')` |
| `'Medikament wird geladen …'` | `t('medications.loadingSingle')` |
| `submitLabel="Änderungen speichern"` | `submitLabel={t('medications.submitLabelEdit')}` |

- [ ] **Step 5: `app/(tabs)/medikamente/neu.tsx` migrieren**

`'Medikament konnte nicht gespeichert werden.'` → `t('medications.saveFailure')`. `submitLabel="Medikament speichern"` → `submitLabel={t('medications.submitLabelCreate')}`.

- [ ] **Step 6: `MedicationForm.tsx` migrieren**

| Alt | Neu |
|---|---|
| `'Name'` | `t('medications.nameLabel')` |
| `'z. B. Salofalk'` | `t('medications.namePlaceholder')` |
| `'Dosis'` | `t('medications.doseLabel')` |
| `'z. B. 500mg'` | `t('medications.dosePlaceholder')` |
| `'Einnahmeschema'` | `t('medications.scheduleLabel')` |
| `'z. B. 1x täglich morgens'` | `t('medications.schedulePlaceholder')` |
| `'Startdatum (JJJJ-MM-TT)'` | `t('medications.startDateLabel')` |
| `'Enddatum (optional, JJJJ-MM-TT)'` | `t('medications.endDateLabel')` |
| `'Leer lassen, falls noch aktiv'` | `t('medications.endDatePlaceholder')` |
| `'Erinnerungszeiten'` | `t('medications.remindersLabel')` |
| Hinweistext (Zeilen 102-105) | `t('medications.remindersHint')` |
| `'Entfernen'` | `t('common.remove')` |
| `` `Erinnerungszeit ${time} entfernen` `` | `t('medications.removeReminderA11y', { time })` |
| `'HH:mm, z. B. 08:00'` | `t('medications.reminderTimePlaceholder')` |
| `'Hinzufügen'` | `t('common.add')` |
| `'Nebenwirkungen (optional)'` | `t('medications.sideEffectsLabel')` |
| `'z. B. Verursacht gelegentlich Übelkeit'` | `t('medications.sideEffectsPlaceholder')` |

Das literale Datumsbeispiel `'2026-07-12'` (Placeholder-Prop) bleibt unverändert.

- [ ] **Step 7: `MedicationList.tsx` migrieren**

| Alt | Neu |
|---|---|
| `'Noch keine Medikamente. Tippe auf „+“, um dein erstes Medikament anzulegen.'` | `t('medications.emptyState')` |
| `'Heute genommen ✓'` | `t('medications.takenTodayDone')` |
| `'Heute genommen'` | `t('medications.takenTodayPending')` |
| `'Bearbeiten'` | `t('common.edit')` |
| `'Beenden'` | `t('medications.endButton')` |
| `'Beendet'` | `t('medications.endedBadge')` |
| `'Löschen'` | `t('common.delete')` |
| `` `Erinnerungen: ${item.reminderTimes.map(...).join(', ')}` `` | `t('medications.remindersPrefix', { times: item.reminderTimes.map(...).join(', ') })` |
| `` `Nebenwirkungen: ${item.sideEffectsNote}` `` | `t('medications.sideEffectsPrefix', { note: item.sideEffectsNote })` |
| `` `Beendet am ${item.endDate}` `` | `t('medications.endedOnPrefix', { date: item.endDate })` |
| `` `${item.name} heute bereits genommen` `` | `t('medications.takenA11yDone', { name: item.name })` |
| `` `${item.name} heute genommen` `` | `t('medications.takenA11yPending', { name: item.name })` |
| `` `${item.name} bearbeiten` `` | `t('medications.editA11y', { name: item.name })` |
| `` `${item.name} beenden` `` | `t('medications.endA11y', { name: item.name })` |
| `` `${item.name} beendet` `` | `t('medications.endedA11y', { name: item.name })` |
| `` `${item.name} löschen` `` | `t('medications.deleteA11y', { name: item.name })` |

- [ ] **Step 8: `ScreeningReminderCard.tsx` migrieren**

| Alt | Neu |
|---|---|
| `'Bitte ein gültiges Intervall in Monaten eingeben (ganze Zahl größer 0).'` | `t('medications.invalidInterval')` |
| `'Bitte ein gültiges Datum eingeben (JJJJ-MM-TT).'` | `t('medications.invalidDate')` |
| `'Vorsorge-Termin löschen?'` | `t('medications.screeningDeleteConfirmTitle')` |
| `'Der gespeicherte Koloskopie-Termin wird endgültig gelöscht.'` | `t('medications.screeningDeleteConfirmMessage')` |
| `'Abbrechen'` | `t('common.cancel')` |
| `'Löschen'` | `t('common.delete')` |
| `'Vorsorge-Koloskopie'` (Titel, 2 Vorkommen) | `t('medications.screeningTitle')` |
| `'Nächstes fälliges Datum'` | `t('medications.nextDueLabel')` |
| `'Intervall'` | `t('medications.intervalLabel')` |
| `` `Alle ${reminder.intervalMonths} Monate` `` | `t('medications.intervalValue', { months: reminder.intervalMonths })` |
| `'Notiz'` | `t('medications.screeningNoteLabel')` |
| `'Bearbeiten'` | `t('common.edit')` |
| Hinweistext (Zeilen 106-109) | `t('medications.screeningHint')` |
| `'Intervall (Monate)'` | `t('medications.intervalFieldLabel')` |
| `'z. B. 12'` | `t('medications.intervalPlaceholder')` |
| `'Nächstes fälliges Datum (JJJJ-MM-TT)'` | `t('medications.nextDueFieldLabel')` |
| `'z. B. Rücksprache mit Dr. …'` | `t('medications.screeningNotePlaceholder')` |
| `'Speichern'` | `t('common.save')` |

Das literale Datumsbeispiel `'2027-01-15'` bleibt unverändert.

- [ ] **Step 9: `formLogic.ts` + `formLogic.test.ts` anpassen**

Analog zu Task 6 Step 3-4. `validateMedicationForm(state)` → `validateMedicationForm(state, t)`:
```typescript
export function validateMedicationForm(
  state: MedicationFormState,
  t: (key: string, vars?: Record<string, string | number>) => string
): string[] {
  const errors: string[] = [];

  if (state.name.trim().length === 0) {
    errors.push(t('medications.missingName'));
  }
  if (state.dose.trim().length === 0) {
    errors.push(t('medications.missingDose'));
  }
  if (state.schedule.trim().length === 0) {
    errors.push(t('medications.missingSchedule'));
  }
  if (!isValidCalendarDate(state.startDate)) {
    errors.push(t('medications.invalidStartDate'));
  }
  if (state.endDate.length > 0 && !isValidCalendarDate(state.endDate)) {
    errors.push(t('medications.invalidEndDate'));
  }
  if (
    state.endDate.length > 0 &&
    isValidCalendarDate(state.startDate) &&
    isValidCalendarDate(state.endDate) &&
    state.endDate < state.startDate
  ) {
    errors.push(t('medications.endBeforeStart'));
  }
  for (const time of state.reminderTimes) {
    if (!REMINDER_TIME_PATTERN.test(time)) {
      errors.push(t('medications.invalidReminderTime', { time }));
    }
  }

  return errors;
}
```
`formLogic.test.ts`: `t = createTranslator(translations.de, translations.de)` importieren (wie Task 6 Step 4), jeden `validateMedicationForm(state)`-Aufruf zu `validateMedicationForm(state, t)` ändern. Assertions bleiben unverändert.

- [ ] **Step 10: `reminderScheduling.ts` anpassen**

`buildDailyReminderTrigger` und `buildScreeningReminderTrigger` bekommen `t` als letzten Parameter, die geworfenen `Error`-Meldungen werden übersetzt:
```typescript
export function buildDailyReminderTrigger(
  time: string,
  t: (key: string, vars?: Record<string, string | number>) => string
): DailyTrigger {
  const match = REMINDER_TIME_PATTERN.exec(time);
  if (!match) {
    throw new Error(t('medications.invalidReminderTime', { time }));
  }
  return { type: 'daily', hour: Number(match[1]), minute: Number(match[2]) };
}

export function buildScreeningReminderTrigger(
  nextDueDate: string,
  now: Date,
  t: (key: string, vars?: Record<string, string | number>) => string
): DateTrigger | null {
  if (!isValidCalendarDate(nextDueDate)) {
    throw new Error(t('medications.invalidScreeningDateInternal', { date: nextDueDate }));
  }
  const [year, month, day] = nextDueDate.split('-').map(Number);
  const dueDate = new Date(year, month - 1, day, SCREENING_REMINDER_HOUR, SCREENING_REMINDER_MINUTE, 0, 0);
  if (dueDate.getTime() <= now.getTime()) {
    return null;
  }
  return { type: 'date', date: dueDate };
}
```
Alle Aufrufstellen dieser beiden Funktionen (grep im `medications`-Feature-Ordner, u. a. `MedicationForm.tsx`/`ScreeningReminderCard.tsx` bzw. deren Save-Handler) um das zusätzliche `t`-Argument ergänzen.

- [ ] **Step 11: `reminderContent.ts` anpassen**

```typescript
import type { ReminderContent } from '../../../lib/notifications/notificationService';

export function buildMedicationReminderContent(
  medication: { name: string; dose?: string | null },
  t: (key: string, vars?: Record<string, string | number>) => string
): ReminderContent {
  return {
    title: t('medications.reminderNotificationTitle'),
    body: t('medications.reminderNotificationBody', { name: medication.name, dose: medication.dose ?? '' }),
  };
}

export function buildScreeningReminderContent(
  reminder: { note?: string | null },
  t: (key: string, vars?: Record<string, string | number>) => string
): ReminderContent {
  return {
    title: t('medications.screeningReminderNotificationTitle'),
    body: reminder.note && reminder.note.length > 0 ? reminder.note : t('medications.screeningReminderNotificationBody'),
  };
}
```
Aufrufstellen (grep nach `buildMedicationReminderContent`/`buildScreeningReminderContent`, typischerweise in den Save-Handlern von `app/(tabs)/medikamente/index.tsx` bzw. `ScreeningReminderCard.tsx`) um `t` ergänzen.

- [ ] **Step 12: `medicationPassBuilder.ts` anpassen**

```typescript
import { isMedicationActive, formatLocalDate } from './medicationStatus';
import type { Medication } from './types';
import type { Language } from '../../i18n/types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMedicationStartDate(startDate: string): string {
  const [year, month, day] = startDate.split('-');
  return `${day}.${month}.${year}`;
}

function buildMedicationSection(
  medication: Medication,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  return `
    <section class="medication">
      <h2>${escapeHtml(medication.name)}</h2>
      <p>${escapeHtml(medication.dose)} &middot; ${escapeHtml(medication.schedule)}</p>
      <p>${escapeHtml(t('medications.pdfSinceLabel', { date: formatMedicationStartDate(medication.startDate) }))}</p>
    </section>
  `;
}

export function buildMedicationPassHtml(
  medications: Medication[],
  today: Date,
  t: (key: string, vars?: Record<string, string | number>) => string,
  language: Language
): string {
  const activeMedications = medications.filter((medication) => isMedicationActive(medication.endDate, today));
  const body =
    activeMedications.length > 0
      ? activeMedications.map((medication) => buildMedicationSection(medication, t)).join('\n')
      : `<p>${escapeHtml(t('medications.pdfEmpty'))}</p>`;

  return `
    <!DOCTYPE html>
    <html lang="${language}">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, sans-serif; color: #2E2A26; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .generated { color: #6B6259; font-size: 12px; margin-bottom: 24px; }
          .medication { border-bottom: 1px solid #E4DACB; padding: 12px 0; }
          .medication h2 { font-size: 14px; margin: 0 0 6px; }
          .medication p { font-size: 12px; margin: 2px 0; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(t('medications.pdfTitle'))}</h1>
        <p class="generated">${escapeHtml(t('medications.pdfGeneratedOn', { date: formatMedicationStartDate(formatLocalDate(today)) }))}</p>
        ${body}
      </body>
    </html>
  `;
}
```

- [ ] **Step 13: `medicationPassExport.ts` anpassen**

```typescript
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildMedicationPassHtml } from './medicationPassBuilder';
import type { Medication } from './types';
import type { Language } from '../../i18n/types';

export async function exportMedicationPass(
  medications: Medication[],
  t: (key: string, vars?: Record<string, string | number>) => string,
  language: Language
): Promise<void> {
  const html = buildMedicationPassHtml(medications, new Date(), t, language);
  const { uri } = await Print.printToFileAsync({ html });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error(t('common.sharingUnavailable'));
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
```

- [ ] **Step 14: Typprüfung und Tests**

Run: `npx tsc --noEmit`
Run: `npm test`

- [ ] **Step 15: Commit**

```bash
git add src/i18n src/features/medications "app/(tabs)/medikamente"
git commit -m "feat: Medikamente vollstaendig uebersetzen"
```

---

## Task 10: Wissen (Screens + UI-Chrome der Artikel-Komponenten)

**Files:**
- Create: `src/i18n/translations/de/knowledge.ts`
- Create: `src/i18n/translations/en/knowledge.ts`
- Modify: `src/i18n/translations/de/index.ts`, `src/i18n/translations/en/index.ts`
- Modify: `app/(tabs)/wissen/index.tsx`
- Modify: `app/(tabs)/wissen/[slug].tsx`
- Modify: `app/(tabs)/wissen/feed.tsx`
- Modify: `src/features/knowledge/components/KnowledgeArticleList.tsx`
- Modify: `src/features/knowledge/components/KnowledgeArticleDetail.tsx`

**Interfaces:**
- Consumes: `useTranslation()`.
- Produces: `knowledge.*` Keys.

**Wichtig — Abgrenzung:** `article.title`, `article.body`, `article.sources` (Datenbankinhalte aus `src/features/knowledge/content/articles.ts`) werden **nicht** angefasst, nur die umgebende Chrome-Texte (Buttons, Platzhalter, Überschriften).

- [ ] **Step 1: `knowledge`-Namespace**

`src/i18n/translations/de/knowledge.ts`:
```typescript
export const knowledge = {
  loadFailure: 'Inhalte konnten nicht geladen werden.',
  communityLinkFailure: 'Community-Link konnte nicht geöffnet werden.',
  disclaimerTitle: 'Du verlässt die App',
  disclaimerMessage:
    'Der Discord-Server ist eine externe Plattform mit eigenen Datenschutzbestimmungen. Inhalte dort werden nicht von dieser App moderiert.',
  disclaimerConfirm: 'Verstanden, weiter',
  newsLinkA11y: 'Neuigkeiten ansehen',
  newsLinkText: 'Neuigkeiten ansehen →',
  communityLinkA11y: 'Community beitreten',
  communityLinkText: 'Community beitreten →',
  filterAll: 'Alle',
  filterFavorites: 'Favoriten',
  searchPlaceholder: 'Artikel durchsuchen …',
  searchA11y: 'Wissensartikel durchsuchen',
  articlesLoading: 'Artikel werden geladen …',
  noFavorites: 'Noch keine Favoriten markiert.',

  notFound: 'Artikel wurde nicht gefunden.',
  loadFailureSingle: 'Artikel konnte nicht geladen werden.',
  loadingSingle: 'Artikel wird geladen …',

  feedOfflineHint: 'Offline — zeigt zuletzt geladene Neuigkeiten',
  feedLoadFailure: 'Neuigkeiten konnten nicht geladen werden.',
  feedLoading: 'Neuigkeiten werden geladen …',

  emptyMessage: 'Keine Artikel gefunden.',
  articleA11y: 'Artikel: {{title}}',

  removeFavoriteA11y: 'Aus Favoriten entfernen',
  addFavoriteA11y: 'Zu Favoriten hinzufügen',
  favoritedLabel: '★ Favorit',
  notFavoritedLabel: '☆ Favorit',
  sourcesHeading: 'Quellen',
  openSourceA11y: 'Quelle öffnen: {{source}}',
};
```

`src/i18n/translations/en/knowledge.ts`:
```typescript
export const knowledge = {
  loadFailure: 'Content could not be loaded.',
  communityLinkFailure: 'The community link could not be opened.',
  disclaimerTitle: 'You are leaving the app',
  disclaimerMessage:
    'The Discord server is an external platform with its own privacy policy. Content there is not moderated by this app.',
  disclaimerConfirm: 'Understood, continue',
  newsLinkA11y: 'View news',
  newsLinkText: 'View news →',
  communityLinkA11y: 'Join community',
  communityLinkText: 'Join community →',
  filterAll: 'All',
  filterFavorites: 'Favorites',
  searchPlaceholder: 'Search articles …',
  searchA11y: 'Search knowledge articles',
  articlesLoading: 'Loading articles …',
  noFavorites: 'No favorites marked yet.',

  notFound: 'Article not found.',
  loadFailureSingle: 'The article could not be loaded.',
  loadingSingle: 'Loading article …',

  feedOfflineHint: 'Offline — showing last loaded news',
  feedLoadFailure: 'The news could not be loaded.',
  feedLoading: 'Loading news …',

  emptyMessage: 'No articles found.',
  articleA11y: 'Article: {{title}}',

  removeFavoriteA11y: 'Remove from favorites',
  addFavoriteA11y: 'Add to favorites',
  favoritedLabel: '★ Favorite',
  notFavoritedLabel: '☆ Favorite',
  sourcesHeading: 'Sources',
  openSourceA11y: 'Open source: {{source}}',
};
```

- [ ] **Step 2: Einhängen**

`de/index.ts`/`en/index.ts`: `knowledge` importieren und exportieren.

- [ ] **Step 3: `app/(tabs)/wissen/index.tsx` migrieren**

`useTranslation` importieren, `t` holen. Ersetzungen:

| Alt | Neu |
|---|---|
| `'Inhalte konnten nicht geladen werden.'` | `t('knowledge.loadFailure')` |
| `'Community-Link konnte nicht geöffnet werden.'` | `t('knowledge.communityLinkFailure')` |
| `'Du verlässt die App'` | `t('knowledge.disclaimerTitle')` |
| Disclaimer-Text | `t('knowledge.disclaimerMessage')` |
| `'Abbrechen'` | `t('common.cancel')` |
| `'Verstanden, weiter'` | `t('knowledge.disclaimerConfirm')` |
| `'Neuigkeiten ansehen'` (a11y) | `t('knowledge.newsLinkA11y')` |
| `'Neuigkeiten ansehen →'` | `t('knowledge.newsLinkText')` |
| `'Community beitreten'` (a11y) | `t('knowledge.communityLinkA11y')` |
| `'Community beitreten →'` | `t('knowledge.communityLinkText')` |
| `'Alle'` | `t('knowledge.filterAll')` |
| `'Favoriten'` | `t('knowledge.filterFavorites')` |
| `'Artikel durchsuchen …'` | `t('knowledge.searchPlaceholder')` |
| `'Wissensartikel durchsuchen'` | `t('knowledge.searchA11y')` |
| `'Artikel werden geladen …'` | `t('knowledge.articlesLoading')` |
| `'Noch keine Favoriten markiert.'` (als `emptyMessage`-Prop) | `t('knowledge.noFavorites')` |

- [ ] **Step 4: `app/(tabs)/wissen/[slug].tsx` migrieren**

`'Artikel wurde nicht gefunden.'` → `t('knowledge.notFound')`; `'Artikel konnte nicht geladen werden.'` → `t('knowledge.loadFailureSingle')`; `'Artikel wird geladen …'` → `t('knowledge.loadingSingle')`.

- [ ] **Step 5: `app/(tabs)/wissen/feed.tsx` migrieren**

`'Offline — zeigt zuletzt geladene Neuigkeiten'` → `t('knowledge.feedOfflineHint')`; `'Neuigkeiten konnten nicht geladen werden.'` → `t('knowledge.feedLoadFailure')`; `'Neuigkeiten werden geladen …'` → `t('knowledge.feedLoading')`.

- [ ] **Step 6: `KnowledgeArticleList.tsx` migrieren**

`DEFAULT_EMPTY_MESSAGE = 'Keine Artikel gefunden.'`-Konstante entfernen; stattdessen im Komponentenrumpf `const emptyMessage = props.emptyMessage ?? t('knowledge.emptyMessage');` verwenden (oder analoges Muster, je nach aktueller Implementierung der Default-Prop-Logik). `` `Artikel: ${item.title}` `` (accessibilityLabel) → `t('knowledge.articleA11y', { title: item.title })`. `item.title`/`teaserFor(item.body)` selbst bleiben unverändert (Datenbankinhalt).

- [ ] **Step 7: `KnowledgeArticleDetail.tsx` migrieren**

| Alt | Neu |
|---|---|
| `'Aus Favoriten entfernen'` | `t('knowledge.removeFavoriteA11y')` |
| `'Zu Favoriten hinzufügen'` | `t('knowledge.addFavoriteA11y')` |
| `'★ Favorit'` | `t('knowledge.favoritedLabel')` |
| `'☆ Favorit'` | `t('knowledge.notFavoritedLabel')` |
| `'Quellen'` | `t('knowledge.sourcesHeading')` |
| `` `Quelle öffnen: ${source}` `` | `t('knowledge.openSourceA11y', { source })` |

`article.title`, `article.body`-Absätze, `source` (die URL selbst) bleiben unverändert (Datenbankinhalt).

- [ ] **Step 8: Typprüfung und Tests**

Run: `npx tsc --noEmit`
Run: `npm test`

- [ ] **Step 9: Commit**

```bash
git add src/i18n src/features/knowledge "app/(tabs)/wissen"
git commit -m "feat: Wissen-Screens und Artikel-Chrome uebersetzen"
```

---

## Task 11: Toiletten (Screen, Komponenten, Validierung)

**Files:**
- Create: `src/i18n/translations/de/toilets.ts`
- Create: `src/i18n/translations/en/toilets.ts`
- Modify: `src/i18n/translations/de/index.ts`, `src/i18n/translations/en/index.ts`
- Modify: `app/(tabs)/toiletten/index.tsx`
- Modify: `src/features/toilets/components/LocationPermissionBanner.tsx`
- Modify: `src/features/toilets/components/SavedPlaceForm.tsx`
- Modify: `src/features/toilets/components/SavedPlaceInfoCard.tsx`
- Modify: `src/features/toilets/components/ToiletInfoCard.tsx`
- Modify: `src/features/toilets/components/ToiletMapView.tsx`
- Modify: `src/features/toilets/savedPlaceFormLogic.ts`
- Modify: `src/features/toilets/savedPlaceFormLogic.test.ts`

**Interfaces:**
- Consumes: `useTranslation()`, `common.*` (insb. `common.route`, `common.cancel`, `common.edit`, `common.delete`).
- Produces: `toilets.*` Keys.

**Wichtig:** `CATEGORY_SUGGESTIONS` (`'Arbeit', 'Freunde', 'Café', 'Sonstiges'`) in `savedPlaceFormLogic.ts` bleiben **unverändert und unübersetzt** (siehe Global Constraints) — nur die umgebende Accessibility-Vorlage wird übersetzt.

- [ ] **Step 1: `toilets`-Namespace**

`src/i18n/translations/de/toilets.ts`:
```typescript
export const toilets = {
  locationTimeout: 'Standortabfrage abgebrochen (Zeitüberschreitung).',
  locationFailure: 'Standort konnte nicht ermittelt werden.',
  offlineHint: 'Offline — zeigt zuletzt geladene Toiletten',
  loadFailure: 'Toiletten konnten nicht geladen werden.',
  savePlaceFailure: 'Sicherer Ort konnte nicht gespeichert werden.',
  deleteConfirmTitle: 'Sicheren Ort löschen?',
  deleteConfirmMessage: '"{{name}}" wird endgültig gelöscht.',
  deletePlaceFailure: 'Sicherer Ort konnte nicht gelöscht werden.',
  submitLabelCreate: 'Anlegen',

  explanation: 'Standortberechtigung erforderlich, um Toiletten in deiner Nähe zu finden.',
  settingsA11y: 'Geräteeinstellungen öffnen',
  settingsButton: 'Einstellungen öffnen',

  formTitle: 'Sicherer Ort',
  nameLabel: 'Name',
  namePlaceholder: 'z. B. Büro',
  categoryLabel: 'Kategorie',
  customCategoryPlaceholder: 'Eigene Kategorie',
  noteLabel: 'Notiz (optional)',
  notePlaceholder: 'z. B. Toilette im 2. Stock',
  categoryOptionA11y: 'Kategorie {{suggestion}} wählen',

  closeA11y: 'Infokarte schließen',

  distanceMeters: '{{meters}} m entfernt',
  distanceKm: '{{km}} km entfernt',
  fallbackName: 'Öffentliche Toilette',
  openingHoursPrefix: 'Öffnungszeiten: {{hours}}',

  mapLoadFailure: 'Karte konnte nicht geladen werden.',

  missingName: 'Bitte einen Namen eingeben.',
};
```

`src/i18n/translations/en/toilets.ts`:
```typescript
export const toilets = {
  locationTimeout: 'Location request cancelled (timeout).',
  locationFailure: 'The location could not be determined.',
  offlineHint: 'Offline — showing last loaded restrooms',
  loadFailure: 'Restrooms could not be loaded.',
  savePlaceFailure: 'The safe place could not be saved.',
  deleteConfirmTitle: 'Delete safe place?',
  deleteConfirmMessage: '"{{name}}" will be permanently deleted.',
  deletePlaceFailure: 'The safe place could not be deleted.',
  submitLabelCreate: 'Add',

  explanation: 'Location permission is required to find restrooms near you.',
  settingsA11y: 'Open device settings',
  settingsButton: 'Open settings',

  formTitle: 'Safe place',
  nameLabel: 'Name',
  namePlaceholder: 'e.g. office',
  categoryLabel: 'Category',
  customCategoryPlaceholder: 'Custom category',
  noteLabel: 'Note (optional)',
  notePlaceholder: 'e.g. restroom on 2nd floor',
  categoryOptionA11y: 'Select category {{suggestion}}',

  closeA11y: 'Close info card',

  distanceMeters: '{{meters}} m away',
  distanceKm: '{{km}} km away',
  fallbackName: 'Public restroom',
  openingHoursPrefix: 'Opening hours: {{hours}}',

  mapLoadFailure: 'The map could not be loaded.',

  missingName: 'Please enter a name.',
};
```

- [ ] **Step 2: Einhängen**

`de/index.ts`/`en/index.ts`: `toilets` importieren und exportieren.

- [ ] **Step 3: `app/(tabs)/toiletten/index.tsx` migrieren**

`useTranslation` importieren, `t` holen. Ersetzungen:

| Alt | Neu |
|---|---|
| `'Standortabfrage abgebrochen (Zeitüberschreitung).'` | `t('toilets.locationTimeout')` |
| `'Standort konnte nicht ermittelt werden.'` | `t('toilets.locationFailure')` |
| `'Offline — zeigt zuletzt geladene Toiletten'` | `t('toilets.offlineHint')` |
| `'Toiletten konnten nicht geladen werden.'` | `t('toilets.loadFailure')` |
| `'Sicherer Ort konnte nicht gespeichert werden.'` | `t('toilets.savePlaceFailure')` |
| `'Sicheren Ort löschen?'` | `t('toilets.deleteConfirmTitle')` |
| `` `"${place.name}" wird endgültig gelöscht.` `` | `t('toilets.deleteConfirmMessage', { name: place.name })` |
| `'Abbrechen'` | `t('common.cancel')` |
| `'Löschen'` | `t('common.delete')` |
| `'Sicherer Ort konnte nicht gelöscht werden.'` | `t('toilets.deletePlaceFailure')` |
| `submitLabel="Speichern"` (Bearbeiten-Fall) | `submitLabel={t('common.save')}` |
| `submitLabel="Anlegen"` (Neu-Fall) | `submitLabel={t('toilets.submitLabelCreate')}` |

- [ ] **Step 4: `LocationPermissionBanner.tsx` migrieren**

`'Standortberechtigung erforderlich, um Toiletten in deiner Nähe zu finden.'` → `t('toilets.explanation')`; `'Geräteeinstellungen öffnen'` → `t('toilets.settingsA11y')`; `'Einstellungen öffnen'` → `t('toilets.settingsButton')`.

- [ ] **Step 5: `SavedPlaceForm.tsx` migrieren**

| Alt | Neu |
|---|---|
| `'Sicherer Ort'` | `t('toilets.formTitle')` |
| `'Name'` | `t('toilets.nameLabel')` |
| `'z. B. Büro'` | `t('toilets.namePlaceholder')` |
| `'Kategorie'` | `t('toilets.categoryLabel')` |
| `'Eigene Kategorie'` | `t('toilets.customCategoryPlaceholder')` |
| `'Notiz (optional)'` | `t('toilets.noteLabel')` |
| `'z. B. Toilette im 2. Stock'` | `t('toilets.notePlaceholder')` |
| `'Abbrechen'` (a11y + Text) | `t('common.cancel')` |
| `` `Kategorie ${suggestion} wählen` `` | `t('toilets.categoryOptionA11y', { suggestion })` |

`suggestion`-Werte selbst (aus `CATEGORY_SUGGESTIONS`) bleiben unverändert.

- [ ] **Step 6: `SavedPlaceInfoCard.tsx` migrieren**

| Alt | Neu |
|---|---|
| `'Infokarte schließen'` | `t('toilets.closeA11y')` |
| `'Bearbeiten'` (a11y + Text) | `t('common.edit')` |
| `'Löschen'` (a11y + Text) | `t('common.delete')` |
| `'Route dorthin'` (a11y + Text) | `t('common.route')` |

- [ ] **Step 7: `ToiletInfoCard.tsx` migrieren**

| Alt | Neu |
|---|---|
| `` `${Math.round(distanceMeters)} m entfernt` `` | `t('toilets.distanceMeters', { meters: Math.round(distanceMeters) })` |
| `` `${(distanceMeters / 1000).toFixed(1)} km entfernt` `` | `t('toilets.distanceKm', { km: (distanceMeters / 1000).toFixed(1) })` |
| `'Infokarte schließen'` | `t('toilets.closeA11y')` |
| `'Öffentliche Toilette'` | `t('toilets.fallbackName')` |
| `` `Öffnungszeiten: ${toilet.openingHours}` `` | `t('toilets.openingHoursPrefix', { hours: toilet.openingHours })` |
| `'Route dorthin'` (a11y + Text) | `t('common.route')` |

- [ ] **Step 8: `ToiletMapView.tsx` migrieren**

`'Karte konnte nicht geladen werden.'` → `t('toilets.mapLoadFailure')`.

- [ ] **Step 9: `savedPlaceFormLogic.ts` + Test anpassen**

`src/features/toilets/savedPlaceFormLogic.ts` — `validateSavedPlaceForm` ändern (`buildSavedPlaceInput`, `CATEGORY_SUGGESTIONS` bleiben komplett unverändert):
```typescript
export function validateSavedPlaceForm(
  state: SavedPlaceFormState,
  t: (key: string, vars?: Record<string, string | number>) => string
): string[] {
  const errors: string[] = [];
  if (state.name.trim().length === 0) {
    errors.push(t('toilets.missingName'));
  }
  return errors;
}
```
`savedPlaceFormLogic.test.ts`: wie in Task 6 Step 4 `createTranslator`/`translations` importieren, `const t = createTranslator(translations.de, translations.de);` anlegen, jeden Aufruf `validateSavedPlaceForm(state)` zu `validateSavedPlaceForm(state, t)` ändern. Aufrufstelle in `SavedPlaceForm.tsx` (grep nach `validateSavedPlaceForm(`) um `t` aus `useTranslation()` ergänzen.

- [ ] **Step 10: Typprüfung und Tests**

Run: `npx tsc --noEmit`
Run: `npm test`

- [ ] **Step 11: Commit**

```bash
git add src/i18n src/features/toilets "app/(tabs)/toiletten"
git commit -m "feat: Toiletten-Feature vollstaendig uebersetzen"
```

---

## Task 12: Sonstiges (App-Sperre-Screen, Backup-Komponenten, Wortwitz-Modal, Neuigkeiten-Liste, Schnellzugriff, Nicht-gefunden)

**Files:**
- Create: `src/i18n/translations/de/dailyJoke.ts`
- Create: `src/i18n/translations/en/dailyJoke.ts`
- Create: `src/i18n/translations/de/newsFeed.ts`
- Create: `src/i18n/translations/en/newsFeed.ts`
- Modify: `src/i18n/translations/de/misc.ts`, `src/i18n/translations/en/misc.ts`
- Modify: `src/i18n/translations/de/index.ts`, `src/i18n/translations/en/index.ts`
- Modify: `src/features/appLock/components/LockScreen.tsx`
- Modify: `src/features/appLock/pinFormLogic.ts`
- Modify: `src/lib/appReset.ts`
- Modify: `app/_layout.tsx` (Aufrufstelle von `resetAppData`)
- Modify: `src/features/backup/components/BackupPasswordForm.tsx`
- Modify: `src/features/backup/backupFileService.ts`
- Modify: `src/features/backup/scheduleBackupReminder.ts`
- Modify: `src/features/dailyJoke/components/DailyJokeModal.tsx`
- Modify: `src/features/newsFeed/components/NewsFeedList.tsx`
- Modify: `src/features/newsFeed/sourceLabel.ts`
- Modify: `app/schnellzugriff.tsx`
- Modify: `app/+not-found.tsx`

**Interfaces:**
- Consumes: `useTranslation()`, `appLock.*`/`backup.*` (bereits vollständig aus Task 4), `common.*`.
- Produces: `dailyJoke.*`, `newsFeed.*` Keys, `misc.schnellzugriff.*`/`misc.notFound.*` (Erweiterung).

**Wichtig:** `appLock.ts` und `backup.ts` werden in diesem Task **nicht verändert** — alle hier benötigten Keys wurden bereits in Task 4 vollständig angelegt.

- [ ] **Step 1: `dailyJoke`-Namespace**

`src/i18n/translations/de/dailyJoke.ts`:
```typescript
export const dailyJoke = {
  title: 'Wortwitz des Tages',
};
```

`src/i18n/translations/en/dailyJoke.ts`:
```typescript
export const dailyJoke = {
  title: 'Joke of the day',
};
```

- [ ] **Step 2: `newsFeed`-Namespace**

`src/i18n/translations/de/newsFeed.ts`:
```typescript
export const newsFeed = {
  emptyState: 'Noch keine Neuigkeiten vorhanden.',
  itemA11y: 'Neuigkeit: {{title}}',
  itemA11yReadSuffix: ' (bereits gelesen)',
  sourceAwmf: 'AWMF-Leitlinie',
};
```

`src/i18n/translations/en/newsFeed.ts`:
```typescript
export const newsFeed = {
  emptyState: 'No news yet.',
  itemA11y: 'News: {{title}}',
  itemA11yReadSuffix: ' (already read)',
  sourceAwmf: 'AWMF guideline',
};
```

- [ ] **Step 3: `misc.ts` um `schnellzugriff`/`notFound` erweitern**

`src/i18n/translations/de/misc.ts` (ersetzen):
```typescript
export const misc = {
  rootLayout: {
    fontError: 'Fehler beim Laden der Symbole: {{message}}',
    preparing: 'Wird vorbereitet …',
    dbOpenError: 'Fehler beim Öffnen der Datenbank: {{message}}',
    dbLoading: 'Datenbank wird geladen …',
    migrationError: 'Datenbank-Migration fehlgeschlagen: {{message}}',
    dbPreparing: 'Datenbank wird vorbereitet …',
  },
  schnellzugriff: {
    searching: 'Nächste Toilette wird gesucht …',
    noLocationPermission: 'Standort nicht verfügbar. Bitte Standortberechtigung erteilen.',
    genericError: 'Es ist ein Fehler aufgetreten. Bitte versuche es erneut.',
    noCandidates: 'Es sind noch keine Toiletten oder sicheren Orte bekannt.',
    openToiletsTab: 'Toiletten-Tab öffnen',
  },
  notFound: {
    title: 'Nicht gefunden',
    body: 'Diese Seite existiert nicht.',
    link: 'Zur Startseite',
  },
};
```

`src/i18n/translations/en/misc.ts` (ersetzen):
```typescript
export const misc = {
  rootLayout: {
    fontError: 'Error loading icons: {{message}}',
    preparing: 'Preparing …',
    dbOpenError: 'Error opening the database: {{message}}',
    dbLoading: 'Loading database …',
    migrationError: 'Database migration failed: {{message}}',
    dbPreparing: 'Preparing database …',
  },
  schnellzugriff: {
    searching: 'Searching for the nearest restroom …',
    noLocationPermission: 'Location not available. Please grant location permission.',
    genericError: 'An error occurred. Please try again.',
    noCandidates: 'No restrooms or safe places are known yet.',
    openToiletsTab: 'Open restrooms tab',
  },
  notFound: {
    title: 'Not found',
    body: 'This page does not exist.',
    link: 'Go to home screen',
  },
};
```

- [ ] **Step 4: Einhängen**

`de/index.ts`/`en/index.ts`: `dailyJoke` und `newsFeed` importieren und exportieren (`misc` ist bereits eingehängt, keine Änderung an der Import-Zeile nötig).

- [ ] **Step 5: `pinFormLogic.ts` anpassen**

```typescript
export const PIN_LENGTH = 6;

const PIN_PATTERN = new RegExp(`^\\d{${PIN_LENGTH}}$`);

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function isResetConfirmationValid(input: string, expectedPhrase: string): boolean {
  return input.trim() === expectedPhrase;
}
```
`RESET_CONFIRMATION_PHRASE` wird entfernt — der erwartete Text kommt jetzt aus `t('appLock.resetConfirmationPhrase')` (siehe nächster Schritt). Grep nach allen Importeuren von `RESET_CONFIRMATION_PHRASE` (mindestens `LockScreen.tsx`) und anpassen.

- [ ] **Step 6: `LockScreen.tsx` migrieren**

`useTranslation` importieren, `const { t } = useTranslation();` in der Komponente ergänzen. `RESET_CONFIRMATION_PHRASE`-Import entfernen, stattdessen `const expectedResetPhrase = t('appLock.resetConfirmationPhrase');` verwenden. `isResetConfirmationValid(resetConfirmation)` → `isResetConfirmationValid(resetConfirmation, expectedResetPhrase)`. Ersetzungen:

| Alt | Neu |
|---|---|
| `'Colitis2Go entsperren'` (2 Vorkommen) | `t('appLock.unlockPromptReason')` |
| `'Biometrie ist gerade nicht verfügbar. Bitte PIN verwenden.'` | `t('appLock.biometricsUnavailable')` |
| `'Falscher PIN. Bitte erneut versuchen.'` | `t('appLock.wrongPin')` |
| `'PIN konnte nicht geprüft werden. Bitte erneut versuchen.'` | `t('appLock.pinCheckFailure')` |
| `'Zurücksetzen konnte nicht vollständig abgeschlossen werden. Bitte erneut versuchen.'` | `t('appLock.resetFailure')` |
| `'PIN zurücksetzen'` | `t('appLock.resetTitle')` |
| Warntext (Zeilen 108-109) | `t('appLock.resetWarning')` |
| `` `Tippe zur Bestätigung „${RESET_CONFIRMATION_PHRASE}“ ein:` `` | `t('appLock.resetConfirmInstruction', { phrase: expectedResetPhrase })` |
| `'Alle Daten endgültig löschen'` | `t('appLock.resetConfirmButtonA11y')` |
| `'Endgültig löschen'` | `t('appLock.resetConfirmButton')` |
| `'Abbrechen'` (a11y + Text) | `t('common.cancel')` |
| `'App gesperrt'` | `t('appLock.lockedTitle')` |
| `'PIN eingeben'` | `t('appLock.pinInputLabel')` |
| `'Mit Biometrie entsperren'` (a11y + Text) | `t('appLock.biometricsRetryButton')` |
| `'PIN vergessen'` (a11y + Text) | `t('appLock.forgotPinButton')` |

- [ ] **Step 7: `appReset.ts` anpassen**

```typescript
import * as SQLite from 'expo-sqlite';
import { DB_FILE_NAME, resetDbCache } from '../db/client';
import { clearDbKey } from './encryption';
import { resetAppLock } from '../features/appLock/pinAuth';

interface ResetStepFailure {
  step: string;
  error: unknown;
}

export async function resetAppData(
  t: (key: string, vars?: Record<string, string | number>) => string
): Promise<void> {
  const failures: ResetStepFailure[] = [];

  await runResetStep(failures, t('appLock.stepDeleteDatabase'), () => SQLite.deleteDatabaseAsync(DB_FILE_NAME));
  await runResetStep(failures, t('appLock.stepDeleteDbKey'), () => clearDbKey());
  await runResetStep(failures, t('appLock.stepResetPin'), () => resetAppLock());
  await runResetStep(failures, t('appLock.stepResetDbCache'), () => Promise.resolve(resetDbCache()));

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`[AppReset] Schritt fehlgeschlagen (${failure.step}):`, failure.error);
    }
    const failedSteps = failures.map((failure) => failure.step).join(', ');
    throw new Error(t('appLock.resetComposedFailure', { steps: failedSteps }));
  }
}

async function runResetStep(
  failures: ResetStepFailure[],
  step: string,
  action: () => Promise<void> | void
): Promise<void> {
  try {
    await action();
  } catch (error: unknown) {
    failures.push({ step, error });
  }
}
```

- [ ] **Step 8: Aufrufstelle in `app/_layout.tsx` anpassen**

`handleReset` (in `RootLayoutInner`) ruft aktuell `await resetAppData();` auf. Dort ist bereits `const { t } = useTranslation();` aus Task 3 vorhanden — Aufruf zu `await resetAppData(t);` ändern.

- [ ] **Step 9: `BackupPasswordForm.tsx` migrieren**

`useTranslation` importieren, `t` holen. Ersetzungen:

| Alt | Neu |
|---|---|
| `` `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.` `` | `t('backup.passwordLengthError', { minLength: MIN_PASSWORD_LENGTH })` |
| `'Die beiden Passwörter stimmen nicht überein.'` | `t('backup.passwordMismatch')` |
| `'Backup-Passwort'` | `t('backup.passwordFieldLabel')` |
| `'Passwort bestätigen'` | `t('backup.confirmPasswordLabel')` |
| `'Abbrechen'` (a11y + Text) | `t('common.cancel')` |

- [ ] **Step 10: `backupFileService.ts` migrieren**

Beide Funktionen (`writeAndShareBackup`, ggf. weitere) bekommen `t` als zusätzlichen Parameter, `'Teilen ist auf diesem Gerät nicht verfügbar.'` → `t('common.sharingUnavailable')`. Aufrufstelle in `app/(tabs)/einstellungen/index.tsx` (`handleExport`, aus Task 4) um `t` ergänzen: `writeAndShareBackup(JSON.stringify(envelope), t)`.

- [ ] **Step 11: `scheduleBackupReminder.ts` anpassen**

```typescript
import {
  getBackupReminderEnabledRaw,
  getBackupReminderIntervalDays,
  getLastBackupAt,
  getBackupReminderNotificationId,
  setBackupReminderNotificationId,
} from '../settings/settingsStorage';
import { resolveBackupReminderEnabled, buildBackupReminderTrigger } from './reminderScheduling';
import {
  requestNotificationPermission,
  cancelScheduledReminder,
  scheduleDateReminder,
} from '../../lib/notifications/notificationService';

export async function rescheduleBackupReminder(
  t: (key: string, vars?: Record<string, string | number>) => string,
  now: Date = new Date()
): Promise<void> {
  const existingNotificationId = await getBackupReminderNotificationId();
  if (existingNotificationId !== null) {
    await cancelScheduledReminder(existingNotificationId);
    await setBackupReminderNotificationId(null);
  }

  const [rawEnabled, intervalDays, lastBackupAt] = await Promise.all([
    getBackupReminderEnabledRaw(),
    getBackupReminderIntervalDays(),
    getLastBackupAt(),
  ]);

  if (lastBackupAt === null || !resolveBackupReminderEnabled(rawEnabled, lastBackupAt)) {
    return;
  }

  const triggerDate = buildBackupReminderTrigger(lastBackupAt, intervalDays, now);
  if (triggerDate === null) {
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    return;
  }

  const notificationId = await scheduleDateReminder(triggerDate, {
    title: t('backup.reminderNotificationTitle'),
    body: t('backup.reminderNotificationBody'),
  });
  await setBackupReminderNotificationId(notificationId);
}
```
Die Modul-Konstante `BACKUP_REMINDER_CONTENT` entfällt (jetzt inline über `t()` gebaut). Alle Aufrufstellen von `rescheduleBackupReminder()` (in `app/(tabs)/einstellungen/index.tsx`, dort bereits `t` aus Task 4 vorhanden) zu `rescheduleBackupReminder(t)` ändern — der optionale `now`-Parameter behält seinen Default.

- [ ] **Step 12: `DailyJokeModal.tsx` migrieren**

`useTranslation` importieren, `t` holen. `'Wortwitz des Tages'` → `t('dailyJoke.title')`. `'Schließen'` (a11y + Text) → `t('common.close')`.

- [ ] **Step 13: `NewsFeedList.tsx` migrieren**

`useTranslation` importieren, `t` holen. `'Noch keine Neuigkeiten vorhanden.'` → `t('newsFeed.emptyState')`. `` `Neuigkeit: ${item.title}${item.isRead ? ' (bereits gelesen)' : ''}` `` → `` `${t('newsFeed.itemA11y', { title: item.title })}${item.isRead ? t('newsFeed.itemA11yReadSuffix') : ''}` ``.

- [ ] **Step 14: `sourceLabel.ts` anpassen**

```typescript
import type { FeedItem } from './types';

export function sourceLabelFor(
  source: FeedItem['source'],
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  if (source === 'awmf') {
    return t('newsFeed.sourceAwmf');
  }
  const NON_GERMAN_LABELS: Record<Exclude<FeedItem['source'], 'awmf'>, string> = {
    pubmed: 'PubMed',
    fda: 'FDA',
    ema: 'EMA',
  };
  return NON_GERMAN_LABELS[source as Exclude<FeedItem['source'], 'awmf'>] ?? source;
}
```
Aufrufstelle in `NewsFeedList.tsx` (`sourceLabelFor(item.source)` → `sourceLabelFor(item.source, t)`) anpassen.

- [ ] **Step 15: `app/schnellzugriff.tsx` migrieren**

`useTranslation` importieren, `t` holen. Ersetzungen:

| Alt | Neu |
|---|---|
| `'Nächste Toilette wird gesucht …'` | `t('misc.schnellzugriff.searching')` |
| `'Standort nicht verfügbar. Bitte Standortberechtigung erteilen.'` | `t('misc.schnellzugriff.noLocationPermission')` |
| `'Es ist ein Fehler aufgetreten. Bitte versuche es erneut.'` | `t('misc.schnellzugriff.genericError')` |
| `'Es sind noch keine Toiletten oder sicheren Orte bekannt.'` | `t('misc.schnellzugriff.noCandidates')` |
| `'Toiletten-Tab öffnen'` (a11y + Text) | `t('misc.schnellzugriff.openToiletsTab')` |

- [ ] **Step 16: `app/+not-found.tsx` migrieren**

`useTranslation` importieren, `t` holen. `title: 'Nicht gefunden'` → `title: t('misc.notFound.title')`. `'Diese Seite existiert nicht.'` → `t('misc.notFound.body')`. `'Zur Startseite'` → `t('misc.notFound.link')`.

- [ ] **Step 17: Typprüfung und Tests**

Run: `npx tsc --noEmit`
Run: `npm test`

- [ ] **Step 18: Commit**

```bash
git add src/i18n src/features/appLock src/lib/appReset.ts app/_layout.tsx src/features/backup src/features/dailyJoke src/features/newsFeed app/schnellzugriff.tsx "app/+not-found.tsx"
git commit -m "feat: App-Sperre, Backup, Wortwitz, Neuigkeiten und Restseiten uebersetzen"
```

---

## Task 13: Alltagstest-Checkliste ergänzen + finale Verifikation

**Files:**
- Modify: `docs/superpowers/colitis-app-alltagstest-checkliste.md`

**Interfaces:**
- Consumes: nichts Neues — reine Abschluss-Verifikation über die vorherigen 12 Tasks.

- [ ] **Step 1: Vollständige Test-Suite und Typprüfung**

Run: `npx tsc --noEmit`
Run: `npm test`
Expected: beide fehlerfrei/grün.

- [ ] **Step 2: `expo-doctor` laufen lassen**

Run: `npx expo-doctor`
Expected: keine neuen Warnungen (dieses Feature fügt keine Abhängigkeit hinzu).

- [ ] **Step 3: Grep-Verifikation — keine übersehenen deutschen UI-Strings**

Aus `colitis-app/colitis-app` heraus:
```bash
git grep -n "Einträge konnten nicht geladen\|Löschen\"\|Abbrechen\"\|wird geladen …" -- 'app/*.tsx' 'app/**/*.tsx' 'src/**/*.tsx' ':!src/features/knowledge/content/articles.ts'
```
Erwartung: Keine Treffer außerhalb von `src/i18n/translations/de/**` (dort sind die deutschen Werte ja korrekt vorhanden) und außerhalb von `articles.ts`. Falls doch ein Treffer außerhalb dieser beiden Orte auftaucht, wurde eine Stelle in Task 6-12 übersehen — nachträglich mit demselben `t(...)`-Muster migrieren, passenden Key in der jeweiligen Namespace-Datei ergänzen, committen.

Zusätzlich stichprobenartig nach typischen verbliebenen deutschen Wörtern suchen, die in keiner der vorherigen Tabellen vorkamen:
```bash
git grep -nE "'[A-ZÄÖÜ][a-zäöüß]+ (konnte|können|wurde|werden) nicht" -- 'app/*.tsx' 'app/**/*.tsx' 'src/**/*.tsx' ':!src/features/knowledge/content/articles.ts' ':!src/i18n/**'
```
Erwartung: keine Treffer.

- [ ] **Step 4: Manueller Rundgang**

Metro-Bundler starten (`npx expo start`), Sprache in den Einstellungen auf Englisch umschalten, danach jeden Tab einmal öffnen (Tagebuch inkl. Schnell-Eintrag/Auswertung/Arztbesuche, Wissen inkl. eines Artikels und der Neuigkeiten, Medikamente inkl. Anlegen eines Test-Eintrags, Toiletten, Einstellungen) und sichtprüfen, dass keine deutschen Reste sichtbar sind — außer den Wissensartikel-Inhalten selbst (erwartetes, bewusstes Verhalten). Zurück auf Deutsch umschalten und denselben Rundgang wiederholen, um sicherzustellen, dass der deutsche Text (Fallback- und Standardpfad) unverändert korrekt ist.

- [ ] **Step 5: Alltagstest-Checkliste ergänzen**

Am Ende von `docs/superpowers/colitis-app-alltagstest-checkliste.md` folgenden Abschnitt anfügen (Format an bestehende Abschnitte wie „Wischgeste zum Tab-Wechsel" angleichen):

```markdown
## Sprachumschaltung (Deutsch/Englisch)

- [ ] In den Einstellungen ist ein Abschnitt „Sprache" mit den Optionen „Deutsch" und „English" sichtbar.
- [ ] Beim Umschalten auf „English" ändern sich die Tab-Namen unten in der Navigation sofort.
- [ ] Auf jedem der fünf Tabs (Tagebuch, Wissen, Medikamente, Toiletten, Einstellungen) sind alle Buttons, Überschriften und Platzhaltertexte auf Englisch, wenn „English" gewählt ist.
- [ ] Eine Wissensartikel-Detailseite zeigt den Artikelinhalt weiterhin auf Deutsch, auch wenn „English" gewählt ist (bewusstes Verhalten).
- [ ] Eine Validierungsfehlermeldung (z. B. leerer Name beim Anlegen eines Medikaments) erscheint in der aktuell gewählten Sprache.
- [ ] Ein PDF-Export (z. B. Medikamenten-Pass) enthält bei gewählter Sprache „English" englische Überschriften/Labels.
- [ ] Nach Zurückschalten auf „Deutsch" sind wieder alle Texte wie vor der Umstellung auf Deutsch.
- [ ] Die gewählte Sprache bleibt nach einem vollständigen Neustart der App erhalten.
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/colitis-app-alltagstest-checkliste.md
git commit -m "docs: Alltagstest-Checkliste um Sprachumschaltung ergaenzen"
```
