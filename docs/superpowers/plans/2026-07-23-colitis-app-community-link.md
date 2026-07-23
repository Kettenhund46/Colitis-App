# Community-Einstiegspunkt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein neuer Link im Wissen-Tab öffnet (nach einem einmaligen Datenschutz-Hinweis) einen externen Discord-Einladungslink, damit Nutzer sich mit anderen Betroffenen austauschen können.

**Architecture:** Ein fester Konstanten-Wert für den Einladungslink, zwei neue Persistenz-Funktionen im bestehenden `settingsStorage.ts`-Muster für den "Hinweis gesehen"-Status, und eine UI-Ergänzung im Wissen-Tab, die vor dem ersten `Linking.openURL`-Aufruf einen Bestätigungsdialog zeigt.

**Tech Stack:** React Native / Expo, TypeScript, `@react-native-async-storage/async-storage`, Vitest.

## Global Constraints

- Referenz: `docs/superpowers/specs/2026-07-23-colitis-app-community-link-design.md`
- Der Discord-Server selbst wird nicht von dieser App erstellt/moderiert – nur der App-seitige Verweis ist Teil dieses Plans.
- Kein neues Forum, kein Chat, keine Accounts in der App.
- Einladungslink ist ein fester Code-Wert (`COMMUNITY_INVITE_URL`), keine Einstellungs-UI zum Ändern.
- Hinweis-Dialog erscheint nur einmalig (persistiert über `AsyncStorage`, gleiches `get.../set...`-Muster wie bestehende Einstellungen in `src/features/settings/settingsStorage.ts`).
- Windows-Testbefehl: `npx.cmd vitest run <pfad>`; Type-Check: `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`).
- `AGENTS.md` beachten: Expo SDK 57 Doku unter https://docs.expo.dev/versions/v57.0.0/ ist maßgeblich, falls Expo-APIs verwendet werden (hier: `Linking` aus `react-native`, bereits an anderen Stellen der App etabliert, keine neue API).

---

### Task 1: Einladungslink-Konstante und Persistenz-Funktionen

**Files:**
- Create: `colitis-app/src/features/community/constants.ts`
- Modify: `colitis-app/src/features/settings/settingsStorage.ts`
- Modify: `colitis-app/src/features/settings/settingsStorage.test.ts`

**Interfaces:**
- Consumes: nichts aus vorherigen Tasks (erster Task).
- Produces (für Task 2):
  - `export const COMMUNITY_INVITE_URL: string` in `src/features/community/constants.ts`.
  - `export function getCommunityDisclaimerSeen(): Promise<boolean>` in `src/features/settings/settingsStorage.ts`.
  - `export function setCommunityDisclaimerSeen(seen: boolean): Promise<void>` in `src/features/settings/settingsStorage.ts`.

- [ ] **Step 1: Einladungslink-Konstante anlegen**

Create `colitis-app/src/features/community/constants.ts`:

```typescript
export const COMMUNITY_INVITE_URL = 'https://discord.gg/PLATZHALTER';
```

- [ ] **Step 2: Write the failing test für die neuen Persistenz-Funktionen**

In `colitis-app/src/features/settings/settingsStorage.test.ts`, ändere den bestehenden Import-Block:

```typescript
import {
  getThemeId,
  setThemeId,
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
  getBackupReminderNotificationId,
  setBackupReminderNotificationId,
} from './settingsStorage';
```

zu:

```typescript
import {
  getThemeId,
  setThemeId,
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
  getBackupReminderNotificationId,
  setBackupReminderNotificationId,
  getCommunityDisclaimerSeen,
  setCommunityDisclaimerSeen,
} from './settingsStorage';
```

Ergänze am Ende der Datei (nach dem bestehenden `describe('backup reminder settings', ...)`-Block):

```typescript

describe('community disclaimer setting', () => {
  it('defaults communityDisclaimerSeen to false', async () => {
    expect(await getCommunityDisclaimerSeen()).toBe(false);
  });

  it('persists communityDisclaimerSeen', async () => {
    await setCommunityDisclaimerSeen(true);
    expect(await getCommunityDisclaimerSeen()).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx.cmd vitest run colitis-app/src/features/settings/settingsStorage.test.ts`
Expected: FAIL — `getCommunityDisclaimerSeen`/`setCommunityDisclaimerSeen` sind nicht aus `./settingsStorage` exportiert.

- [ ] **Step 4: Write the implementation**

In `colitis-app/src/features/settings/settingsStorage.ts`, ergänze am Ende der Datei (nach der bestehenden `setBackupReminderNotificationId`-Funktion):

```typescript

const COMMUNITY_DISCLAIMER_SEEN_KEY = 'colitis2go.settings.communityDisclaimerSeen';

export async function getCommunityDisclaimerSeen(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(COMMUNITY_DISCLAIMER_SEEN_KEY);
  return stored === 'true';
}

export async function setCommunityDisclaimerSeen(seen: boolean): Promise<void> {
  await AsyncStorage.setItem(COMMUNITY_DISCLAIMER_SEEN_KEY, seen ? 'true' : 'false');
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx.cmd vitest run colitis-app/src/features/settings/settingsStorage.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 6: Run the full test suite and type check**

Run: `npx.cmd vitest run` und `npx.cmd tsc --noEmit --pretty false` (aus `colitis-app/`)
Expected: Alle bestehenden Tests weiterhin grün, keine neuen Typfehler.

- [ ] **Step 7: Commit**

```bash
git add colitis-app/src/features/community/constants.ts colitis-app/src/features/settings/settingsStorage.ts colitis-app/src/features/settings/settingsStorage.test.ts
git commit -m "feat: Einladungslink-Konstante und Persistenz fuer Community-Hinweis ergaenzen"
```

---

### Task 2: Community-Link im Wissen-Tab verdrahten

**Files:**
- Modify: `colitis-app/app/(tabs)/wissen/index.tsx`

**Interfaces:**
- Consumes: `COMMUNITY_INVITE_URL` aus `../../../src/features/community/constants` (Task 1); `getCommunityDisclaimerSeen`, `setCommunityDisclaimerSeen` aus `../../../src/features/settings/settingsStorage` (Task 1).
- Produces: nichts für weitere Tasks – letzter Task dieses Plans.

Diese Aufgabe ändert eine bestehende UI-Datei – nicht automatisiert testbar (native `Linking`/`Alert`-Aufrufe, nicht gemockt in diesem Projekt). Verifikation über `tsc --noEmit`, die bestehende Vitest-Suite und manuellen Test in Schritt 3.

- [ ] **Step 1: Imports ergänzen**

In `colitis-app/app/(tabs)/wissen/index.tsx`, ändere:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { seedKnowledgeArticles, listKnowledgeArticles } from '../../../src/features/knowledge/db/knowledgeRepository';
import { listFavoriteSlugs } from '../../../src/features/knowledge/db/knowledgeFavoritesRepository';
import { filterKnowledgeArticles, filterFavoriteArticles } from '../../../src/features/knowledge/search';
import { KnowledgeArticleList } from '../../../src/features/knowledge/components/KnowledgeArticleList';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { KnowledgeArticle } from '../../../src/features/knowledge/types';
import type { ThemeColors } from '../../../src/theme/types';
```

zu:

```typescript
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Linking, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { createEncryptedDb } from '../../../src/db/client';
import { seedKnowledgeArticles, listKnowledgeArticles } from '../../../src/features/knowledge/db/knowledgeRepository';
import { listFavoriteSlugs } from '../../../src/features/knowledge/db/knowledgeFavoritesRepository';
import { filterKnowledgeArticles, filterFavoriteArticles } from '../../../src/features/knowledge/search';
import { KnowledgeArticleList } from '../../../src/features/knowledge/components/KnowledgeArticleList';
import { COMMUNITY_INVITE_URL } from '../../../src/features/community/constants';
import {
  getCommunityDisclaimerSeen,
  setCommunityDisclaimerSeen,
} from '../../../src/features/settings/settingsStorage';
import { useTheme } from '../../../src/theme/ThemeContext';
import { tokens } from '../../../src/styles/tokens';
import type { KnowledgeArticle } from '../../../src/features/knowledge/types';
import type { ThemeColors } from '../../../src/theme/types';
```

- [ ] **Step 2: Handler-Funktionen ergänzen**

Ergänze in `colitis-app/app/(tabs)/wissen/index.tsx`, direkt nach dem bestehenden `useFocusEffect(...)`-Block (vor `const searchedArticles = ...`):

```typescript
  async function openCommunityLink() {
    try {
      await Linking.openURL(COMMUNITY_INVITE_URL);
      setError(null);
    } catch (linkError: unknown) {
      console.error('[Wissen] Community-Link konnte nicht geöffnet werden:', linkError);
      setError('Community-Link konnte nicht geöffnet werden.');
    }
  }

  async function confirmCommunityDisclaimer() {
    await setCommunityDisclaimerSeen(true);
    await openCommunityLink();
  }

  async function handleCommunityPress() {
    const alreadySeen = await getCommunityDisclaimerSeen();
    if (alreadySeen) {
      await openCommunityLink();
      return;
    }
    Alert.alert(
      'Du verlässt die App',
      'Der Discord-Server ist eine externe Plattform mit eigenen Datenschutzbestimmungen. Inhalte dort werden nicht von dieser App moderiert.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Verstanden, weiter',
          onPress: () => void confirmCommunityDisclaimer(),
        },
      ]
    );
  }

```

- [ ] **Step 3: Link-Button im JSX ergänzen**

Ändere den bestehenden Block:

```typescript
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Neuigkeiten ansehen"
        style={styles.newsLink}
        onPress={() => router.push('/wissen/feed')}
      >
        <Text style={styles.newsLinkText}>Neuigkeiten ansehen →</Text>
      </Pressable>
      <View style={styles.viewToggleRow}>
```

zu:

```typescript
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Neuigkeiten ansehen"
        style={styles.newsLink}
        onPress={() => router.push('/wissen/feed')}
      >
        <Text style={styles.newsLinkText}>Neuigkeiten ansehen →</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Community beitreten"
        style={styles.newsLink}
        onPress={() => void handleCommunityPress()}
      >
        <Text style={styles.newsLinkText}>Community beitreten →</Text>
      </Pressable>
      <View style={styles.viewToggleRow}>
```

- [ ] **Step 4: Type-Check, volle Test-Suite und manueller Test**

Run (aus `colitis-app/`): `npx.cmd tsc --noEmit --pretty false` und `npx.cmd vitest run`
Expected: Keine Fehler, alle bestehenden Tests weiterhin grün.

Manueller Test (im laufenden Expo-Dev-Build oder per EAS-Build):
- Wissen-Tab öffnen → neuer Link "Community beitreten →" sichtbar unterhalb von "Neuigkeiten ansehen →".
- Erster Tap → Hinweis-Dialog "Du verlässt die App" erscheint.
- "Abbrechen" → kein Link öffnet sich, Dialog erscheint beim nächsten Tap erneut.
- Erneuter Tap → "Verstanden, weiter" → Discord-Einladungslink öffnet sich (Browser oder Discord-App, sofern `COMMUNITY_INVITE_URL` bereits auf einen echten Server zeigt).
- Danach erneuter Tap auf "Community beitreten →" → Link öffnet sich direkt, kein Dialog mehr.

- [ ] **Step 5: Commit**

```bash
git add "colitis-app/app/(tabs)/wissen/index.tsx"
git commit -m "feat: Community-Link im Wissen-Tab verdrahten"
```
