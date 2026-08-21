# Gestaltungssprache (Phase 2) — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die 113 kopierten Kartenmuster in 36 Dateien durch gemeinsame Bausteine ersetzen und in diesen Bausteinen wirklich gestalten — Erhebung statt Rand, Zustandskante, erklärende Leerzustände, Ladeskelette.

**Architecture:** Eine reine Stilschicht (`cardStyle.ts`) trifft alle Entscheidungen als testbare Funktionen ohne React. Darüber liegen dünne Komponenten (`Card`, `GhostCard`, `EmptyState`, `SkeletonList`, `SectionHeading`). Die Aufrufer werden danach bereichsweise umgestellt, damit jeder Schritt für sich auf dem Gerät prüfbar bleibt.

**Tech Stack:** React Native 0.86.2, Expo SDK 57, TypeScript, Vitest (`environment: 'node'`, keine Renderer-Abhängigkeit).

**Entwurf:** `docs/superpowers/specs/2026-08-20-colitis-app-gestaltungssprache-design.md`

## Global Constraints

- **Windows:** immer `npx.cmd`, nie `npx`.
- **Arbeitsverzeichnis für alle Befehle:** `D:\Claude\colitis-app`.
- **Testlauf:** `npm test` (das ist `vitest run`). Typprüfung: `npx.cmd tsc --noEmit`.
- **Vitest kann keine Komponenten rendern.** `environment: 'node'`, kein jsdom, kein `@testing-library/react-native`, kein `react-test-renderer`. Es darf **keine** neue Test-Abhängigkeit hinzugefügt werden. Getestet wird ausschließlich die reine Stilschicht.
- **Die Kante ist Zugabe, nie die einzige Information.** Vorhandene Formen (`RatingIndicator`) und Wörter (`RATING_LABELS`) bleiben unverändert stehen.
- **`accent` nimmt eine Bedeutung entgegen, keine Farbe.** Kein Aufrufer schreibt je einen Farbwert für die Kante.
- **`primary` bleibt in allen drei Themes unverändert.** Nur `success` wird geändert.
- **`success` bleibt grün** in allen drei Themes, auch im hellblauen.
- **Rundung:** überall `tokens.radius.md`. Die hart getippte `12` verschwindet aus jeder angefassten Datei.
- **Vorhandene `accessibilityLabel` und `accessibilityRole` bleiben unverändert.** `Card` fügt keine eigenen hinzu; wo heute ein `Pressable` die Karte ist, bleibt es ein `Pressable`.
- **`Card` bringt keinen Außenabstand mit.** Den Abstand zwischen Karten setzt der umgebende Container mit `gap: tokens.spacing.md`. Grund: Bei den berührbaren Listen liegt `Card` innerhalb eines `Pressable`; ein `marginBottom` an der Karte läge im Berührungsbereich und ein Tipp in die Lücke würde die Karte darüber öffnen. Wo eine Kartenkopie entfernt wird, wandert ihr `marginBottom` als `gap` in den Container.
- **Keine Bewegung.** Kein Pulsieren, kein Schimmern im Ladeplatzhalter. Das gehört zu Phase 3.
- **Deutsche Texte**, Du-Form, wie im Rest der App.
- **Keine Datei über 800 Zeilen.** Alle neuen Dateien deutlich darunter.
- **Nicht in `colitis-app/.superpowers/` schreiben.** Zwischenberichte gehören in das vom Aufrufer genannte Verzeichnis.

## Dateistruktur

**Neu:**

| Datei | Verantwortung |
|---|---|
| `src/components/ui/cardStyle.ts` | Reine Entscheidungen: Theme → Erhebungsmittel, Bedeutung → Farbe, Flächenstil |
| `src/components/ui/cardStyle.test.ts` | Tests dazu |
| `src/components/ui/Card.tsx` | Hülle: Fläche, Rundung, Erhebung, Kante |
| `src/components/ui/GhostCard.tsx` | Blasse Karte in der Form eines Eintrags |
| `src/components/ui/EmptyState.tsx` | Geisterkarte, Überschrift, Erklärung, optionaler Knopf |
| `src/components/ui/SkeletonList.tsx` | Mehrere `GhostCard` untereinander |
| `src/components/ui/SectionHeading.tsx` | Abschnittsüberschrift für die Einstellungen |

**Geändert:** `src/theme/palettes.ts`, `src/theme/palettes.test.ts`, sechs Listenkomponenten, sechs Bildschirme, der Einstellungen-Bildschirm, `DiaryReminderSettings.tsx`.

---

### Task 1: `success` von `primary` trennen

**Warum:** `success` und `primary` sind heute in allen drei Themes derselbe Wert. Ein guter Tag im Tagebuch hat damit dieselbe Farbe wie jeder Knopf; „gut" ist keine eigene Aussage. Ohne diese Trennung ist die grüne Zustandskante aus Task 3 bedeutungslos.

**Files:**
- Modify: `src/theme/palettes.ts`
- Modify: `src/theme/palettes.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: `palettes.light.success`, `palettes.dark.success`, `palettes['light-blue'].success` — je ein Grünton, der sich von `primary` desselben Themes unterscheidet. Task 2 liest sie über `accentColorFor`.

- [ ] **Step 1: Test schreiben, der die Trennung fordert**

An `src/theme/palettes.test.ts` anhängen, innerhalb des äußeren `describe('theme palettes', …)`, direkt vor der schließenden Klammer:

```typescript
  it('separates success from primary in every theme', () => {
    Object.entries(palettes).forEach(([themeId, colors]) => {
      expect(colors.success.toUpperCase(), `${themeId}: success darf nicht primary sein`).not.toBe(
        colors.primary.toUpperCase()
      );
    });
  });

  it('keeps success distinguishable from warning and danger in every theme', () => {
    Object.entries(palettes).forEach(([themeId, colors]) => {
      const stateColors = [colors.success, colors.warning, colors.danger].map((value) => value.toUpperCase());
      expect(new Set(stateColors).size, `${themeId}: Zustandsfarben doppelt`).toBe(3);
    });
  });
```

- [ ] **Step 2: Testlauf, muss fehlschlagen**

```bash
npm test -- src/theme/palettes.test.ts
```

Erwartet: FAIL bei „separates success from primary in every theme" für alle drei Themes, weil `success` und `primary` heute identisch sind.

- [ ] **Step 3: Die drei Werte ändern**

In `src/theme/palettes.ts` genau drei Zeilen ändern — sonst nichts:

In `lightColors`: `success: '#5B8C7B',` → `success: '#3E8E4F',`

In `darkColors`: `success: '#7BAF9C',` → `success: '#7BC98C',`

In `lightBlueColors`: `success: '#3E7CB1',` → `success: '#3E8E4F',`

`primary` bleibt in allen drei Themes unangetastet.

- [ ] **Step 4: Testlauf, muss durchlaufen**

```bash
npm test -- src/theme/palettes.test.ts
```

Erwartet: PASS, alle Tests der Datei.

- [ ] **Step 5: Vollständiger Testlauf und Typprüfung**

```bash
npm test
```

Erwartet: PASS, keine Regression in den vorhandenen Tests.

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe.

- [ ] **Step 6: Commit**

```bash
git add src/theme/palettes.ts src/theme/palettes.test.ts
git commit -m "feat: success in allen drei Themes von primary trennen"
```

---

### Task 2: Reine Stilschicht `cardStyle.ts`

**Warum:** Hier stecken alle Entscheidungen der Karte. Weil Vitest keine Komponenten rendern kann, ist das die einzige Schicht, die sich prüfen lässt — deshalb muss alles Entscheidbare hier liegen und nicht in der Komponente.

**Files:**
- Create: `src/components/ui/cardStyle.ts`
- Create: `src/components/ui/cardStyle.test.ts`

**Interfaces:**
- Consumes: `ThemeColors` und `ThemeId` aus `src/theme/types.ts`; `tokens` aus `src/styles/tokens.ts`
- Produces:
  - `type CardAccent = 'good' | 'warning' | 'danger' | 'info' | 'neutral'`
  - `type SurfaceTreatment = 'shadow' | 'border'`
  - `surfaceTreatmentFor(themeId: ThemeId): SurfaceTreatment`
  - `accentColorFor(accent: CardAccent | undefined, colors: ThemeColors): string | null`
  - `cardSurfaceStyle(colors: ThemeColors, treatment: SurfaceTreatment): ViewStyle`
  - `ACCENT_BORDER_WIDTH: number`

- [ ] **Step 1: Die fehlschlagenden Tests schreiben**

`src/components/ui/cardStyle.test.ts` anlegen:

```typescript
import { describe, it, expect } from 'vitest';
import { surfaceTreatmentFor, accentColorFor, cardSurfaceStyle, ACCENT_BORDER_WIDTH } from './cardStyle';
import { palettes } from '../../theme/palettes';

describe('surfaceTreatmentFor', () => {
  it('uses a border in the dark theme, where Android shadows are invisible', () => {
    expect(surfaceTreatmentFor('dark')).toBe('border');
  });

  it('uses a shadow in both light themes', () => {
    expect(surfaceTreatmentFor('light')).toBe('shadow');
    expect(surfaceTreatmentFor('light-blue')).toBe('shadow');
  });
});

describe('accentColorFor', () => {
  it('returns null without an accent so the card draws no edge', () => {
    expect(accentColorFor(undefined, palettes.light)).toBeNull();
  });

  it('maps every meaning to a colour of the given theme', () => {
    const colors = palettes.light;
    expect(accentColorFor('good', colors)).toBe(colors.success);
    expect(accentColorFor('warning', colors)).toBe(colors.warning);
    expect(accentColorFor('danger', colors)).toBe(colors.danger);
    expect(accentColorFor('info', colors)).toBe(colors.accent);
    expect(accentColorFor('neutral', colors)).toBe(colors.border);
  });

  it('follows the theme it is given, not a fixed palette', () => {
    expect(accentColorFor('good', palettes.dark)).toBe(palettes.dark.success);
    expect(accentColorFor('good', palettes.dark)).not.toBe(palettes.light.success);
  });
});

describe('cardSurfaceStyle', () => {
  it('carries no border width when the theme uses a shadow', () => {
    const style = cardSurfaceStyle(palettes.light, 'shadow');
    expect(style.borderWidth).toBeUndefined();
    expect(style.elevation).toBeGreaterThan(0);
  });

  it('carries no elevation when the theme uses a border', () => {
    const style = cardSurfaceStyle(palettes.dark, 'border');
    expect(style.elevation).toBeUndefined();
    expect(style.shadowOpacity).toBeUndefined();
    expect(style.borderWidth).toBe(1);
    expect(style.borderColor).toBe(palettes.dark.border);
  });

  it('always paints the theme surface and the shared radius', () => {
    const style = cardSurfaceStyle(palettes['light-blue'], 'shadow');
    expect(style.backgroundColor).toBe(palettes['light-blue'].surface);
    expect(style.borderRadius).toBe(12);
  });
});

describe('ACCENT_BORDER_WIDTH', () => {
  it('is thick enough to read while scrolling', () => {
    expect(ACCENT_BORDER_WIDTH).toBe(4);
  });
});
```

- [ ] **Step 2: Testlauf, muss fehlschlagen**

```bash
npm test -- src/components/ui/cardStyle.test.ts
```

Erwartet: FAIL, „Failed to resolve import ./cardStyle".

- [ ] **Step 3: `cardStyle.ts` schreiben**

`src/components/ui/cardStyle.ts` anlegen:

```typescript
import { tokens } from '../../styles/tokens';
import type { ViewStyle } from 'react-native';
import type { ThemeColors, ThemeId } from '../../theme/types';

/** Bedeutung einer Zustandskante — nie eine Farbe. */
export type CardAccent = 'good' | 'warning' | 'danger' | 'info' | 'neutral';

/** Wie eine Fläche in einem Theme vom Hintergrund abgesetzt wird. */
export type SurfaceTreatment = 'shadow' | 'border';

/** Breite der Zustandskante. Schmaler wird sie beim Scrollen nicht mehr erkannt. */
export const ACCENT_BORDER_WIDTH = 4;

const SHADOW_OPACITY = 0.09;
const SHADOW_RADIUS = 3;
const SHADOW_ELEVATION = 2;

const TREATMENT_BY_THEME: Record<ThemeId, SurfaceTreatment> = {
  light: 'shadow',
  'light-blue': 'shadow',
  // Android leitet den Schatten aus der Erhebung ab; auf dunklem Grund ist er
  // praktisch unsichtbar. Statt Tiefe vorzutaeuschen trennt hier ein Rand die
  // hellere Kartenflaeche vom Hintergrund.
  dark: 'border',
};

export function surfaceTreatmentFor(themeId: ThemeId): SurfaceTreatment {
  return TREATMENT_BY_THEME[themeId];
}

export function accentColorFor(accent: CardAccent | undefined, colors: ThemeColors): string | null {
  if (accent === undefined) {
    return null;
  }

  switch (accent) {
    case 'good':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'danger':
      return colors.danger;
    case 'info':
      return colors.accent;
    case 'neutral':
      return colors.border;
  }
}

export function cardSurfaceStyle(colors: ThemeColors, treatment: SurfaceTreatment): ViewStyle {
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
  };

  if (treatment === 'border') {
    return { ...base, borderWidth: 1, borderColor: colors.border };
  }

  return {
    ...base,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: SHADOW_OPACITY,
    shadowRadius: SHADOW_RADIUS,
    elevation: SHADOW_ELEVATION,
  };
}
```

- [ ] **Step 4: Testlauf, muss durchlaufen**

```bash
npm test -- src/components/ui/cardStyle.test.ts
```

Erwartet: PASS, 9 Tests.

- [ ] **Step 5: Typprüfung**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe. Falls `switch` über `CardAccent` als nicht erschöpfend gemeldet wird, ist ein Wert im Typ ergänzt worden, der keinen `case` hat — dann den fehlenden `case` nachtragen, nicht `default` einbauen.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/cardStyle.ts src/components/ui/cardStyle.test.ts
git commit -m "feat: reine Stilschicht fuer Karten mit Zustandskante"
```

---

### Task 3: `Card.tsx`

**Warum:** Die Hülle, die alle Bildschirme künftig benutzen. Sie enthält bewusst keine Entscheidung — alles Entscheidbare liegt in Task 2.

**Files:**
- Create: `src/components/ui/Card.tsx`

**Interfaces:**
- Consumes: `surfaceTreatmentFor`, `accentColorFor`, `cardSurfaceStyle`, `ACCENT_BORDER_WIDTH`, `CardAccent` aus `./cardStyle`; `useTheme` aus `../../theme/ThemeContext`
- Produces:
  ```typescript
  interface CardProps {
    children: ReactNode;
    accent?: CardAccent;
    isMuted?: boolean;
    style?: StyleProp<ViewStyle>;
  }
  export function Card(props: CardProps): JSX.Element;
  ```
  Tasks 5 bis 8 benutzen ausschließlich diese Signatur. `CardAccent` wird aus `Card.tsx` re-exportiert, damit Aufrufer nur einen Import brauchen.

- [ ] **Step 1: `Card.tsx` schreiben**

`src/components/ui/Card.tsx` anlegen:

```tsx
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import { surfaceTreatmentFor, accentColorFor, cardSurfaceStyle, ACCENT_BORDER_WIDTH } from './cardStyle';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { CardAccent } from './cardStyle';

export type { CardAccent } from './cardStyle';

const MUTED_OPACITY = 0.6;

interface CardProps {
  children: ReactNode;
  /** Bedeutung der Zustandskante. Ohne diesen Wert hat die Karte keine Kante. */
  accent?: CardAccent;
  /** Gedaempfter Inhalt, etwa ein beendetes Medikament. Unabhaengig von accent. */
  isMuted?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, accent, isMuted = false, style }: CardProps) {
  const { colors, themeId } = useTheme();
  const surface = cardSurfaceStyle(colors, surfaceTreatmentFor(themeId));
  const accentColor = accentColorFor(accent, colors);

  return (
    <View
      style={[
        styles.base,
        surface,
        accentColor !== null && { borderLeftWidth: ACCENT_BORDER_WIDTH, borderLeftColor: accentColor },
        isMuted && styles.muted,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  muted: {
    opacity: MUTED_OPACITY,
  },
});
```

Entferne dabei `styles.base` aus dem `style`-Array in der Komponente — es bleibt:

```tsx
      style={[
        surface,
        accentColor !== null && { borderLeftWidth: ACCENT_BORDER_WIDTH, borderLeftColor: accentColor },
        isMuted && styles.muted,
        style,
      ]}
```

**`Card` bringt bewusst keinen Außenabstand mit.** Bei den berührbaren Listen (Arztbesuche, Neuigkeiten, Wissen) liegt `Card` innerhalb eines `Pressable`; ein `marginBottom` an der Karte läge dann im Berührungsbereich, und ein Tipp in die Lücke zwischen zwei Karten würde die obere öffnen. Den Abstand setzt stattdessen der umgebende Container über `gap` — so steht es in den Tasks 4, 6, 7 und 8.

Dadurch wird auch der `tokens`-Import in `Card.tsx` nicht mehr gebraucht — entferne ihn.

- [ ] **Step 2: Typprüfung**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe.

- [ ] **Step 3: Vollständiger Testlauf**

```bash
npm test
```

Erwartet: PASS. `Card.tsx` hat keine eigenen Tests — das Prüfbare liegt in `cardStyle.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Card.tsx
git commit -m "feat: Card als gemeinsame Kartenhuelle"
```

---

### Task 4: `GhostCard`, `EmptyState`, `SkeletonList`

**Warum:** Ein Baustein deckt zwei Anforderungen ab. Die blasse Karte im Leerzustand und der Ladeplatzhalter sind dieselbe Form; sie getrennt zu bauen, wäre die dritte Kopie desselben Musters.

**Files:**
- Create: `src/components/ui/GhostCard.tsx`
- Create: `src/components/ui/EmptyState.tsx`
- Create: `src/components/ui/SkeletonList.tsx`

**Interfaces:**
- Consumes: `Card` aus `./Card`; `useTheme`; `tokens`
- Produces:
  ```typescript
  export function GhostCard(props: { lines?: number; hasHeaderBadge?: boolean }): JSX.Element;

  interface EmptyStateProps {
    title: string;
    description: string;
    action?: { label: string; onPress: () => void };
    /** false bei ergebnisloser Abfrage — dort entsteht nichts durch Anlegen. */
    showGhost?: boolean;
  }
  export function EmptyState(props: EmptyStateProps): JSX.Element;

  export function SkeletonList(props: { count?: number; lines?: number }): JSX.Element;
  ```

- [ ] **Step 1: `GhostCard.tsx` schreiben**

```tsx
import { View, StyleSheet } from 'react-native';
import { Card } from './Card';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import type { ThemeColors } from '../../theme/types';

const DEFAULT_LINES = 2;
const LINE_HEIGHT = 9;
/** Zeilenbreiten in Prozent, damit der Block nicht wie ein Rechteck wirkt. */
const LINE_WIDTHS = ['100%', '62%', '78%'] as const;

interface GhostCardProps {
  /** Wie viele Textzeilen angedeutet werden. */
  lines?: number;
  /** Kopfzeile mit Titelbalken und Marke rechts, wie in der Tagebuch-Karte. */
  hasHeaderBadge?: boolean;
}

export function GhostCard({ lines = DEFAULT_LINES, hasHeaderBadge = true }: GhostCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const lineIndexes = Array.from({ length: Math.max(lines, 1) }, (_, index) => index);

  return (
    <Card accent="neutral">
      {hasHeaderBadge && (
        <View style={styles.header}>
          <View style={[styles.bar, styles.title]} />
          <View style={[styles.bar, styles.badge]} />
        </View>
      )}
      {lineIndexes.map((index) => (
        <View
          key={index}
          style={[
            styles.bar,
            styles.line,
            { width: LINE_WIDTHS[index % LINE_WIDTHS.length] },
          ]}
        />
      ))}
    </Card>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.sm,
    },
    bar: {
      backgroundColor: colors.border,
      borderRadius: tokens.radius.sm / 2,
      height: LINE_HEIGHT,
    },
    title: { width: '48%' },
    badge: { width: 44 },
    line: { marginTop: tokens.spacing.xs },
  });
}
```

- [ ] **Step 2: `EmptyState.tsx` schreiben**

```tsx
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { GhostCard } from './GhostCard';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import type { ThemeColors } from '../../theme/types';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
  /**
   * Geisterkarte zeigen. false bei ergebnisloser Abfrage: Dort entsteht nichts
   * durch Anlegen, eine Formvorschau waere ein falsches Versprechen.
   */
  showGhost?: boolean;
}

export function EmptyState({ title, description, action, showGhost = true }: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      {showGhost && (
        <View style={styles.ghostWrapper}>
          <GhostCard lines={2} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={styles.button}
          onPress={action.onPress}
        >
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: tokens.spacing.lg,
      backgroundColor: colors.background,
    },
    ghostWrapper: {
      alignSelf: 'stretch',
      maxWidth: 320,
      width: '100%',
      marginBottom: tokens.spacing.sm,
    },
    title: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.md,
      fontWeight: tokens.typography.fontWeight.bold,
      textAlign: 'center',
      marginBottom: tokens.spacing.xs,
    },
    description: {
      color: colors.textSecondary,
      fontSize: tokens.typography.fontSize.sm,
      textAlign: 'center',
      lineHeight: 20,
      maxWidth: 300,
    },
    button: {
      marginTop: tokens.spacing.md,
      backgroundColor: colors.primary,
      borderRadius: tokens.radius.pill,
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.lg,
    },
    buttonText: {
      color: colors.surface,
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
    },
  });
}
```

- [ ] **Step 3: `SkeletonList.tsx` schreiben**

```tsx
import { View, StyleSheet } from 'react-native';
import { GhostCard } from './GhostCard';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import type { ThemeColors } from '../../theme/types';

const DEFAULT_COUNT = 3;

interface SkeletonListProps {
  /** Wie viele Platzhalterkarten. */
  count?: number;
  /** Wie viele Textzeilen je Karte. */
  lines?: number;
}

export function SkeletonList({ count = DEFAULT_COUNT, lines = 2 }: SkeletonListProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const cardIndexes = Array.from({ length: Math.max(count, 1) }, (_, index) => index);

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel="Inhalte werden geladen"
    >
      {cardIndexes.map((index) => (
        <GhostCard key={index} lines={lines} />
      ))}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: tokens.spacing.lg,
      gap: tokens.spacing.md,
      backgroundColor: colors.background,
    },
  });
}
```

`gap` statt `marginBottom` an der Karte — `Card` bringt keinen Außenabstand mit, siehe Task 3.

- [ ] **Step 4: Typprüfung und Testlauf**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe.

```bash
npm test
```

Erwartet: PASS, unverändert viele Tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/GhostCard.tsx src/components/ui/EmptyState.tsx src/components/ui/SkeletonList.tsx
git commit -m "feat: Geisterkarte, Leerzustand und Ladeskelett"
```

---

### Task 5: `SectionHeading` und der Einstellungen-Bildschirm

**Warum:** Der Fehler, der Phase 2 ausgelöst hat, saß hier: Ein Abschnitt war als Karte gebaut, während alle anderen flach auf dem Hintergrund liegen. Ein gemeinsamer Baustein macht das unwiederholbar.

**Files:**
- Create: `src/components/ui/SectionHeading.tsx`
- Modify: `app/(tabs)/einstellungen/index.tsx`
- Modify: `src/features/diary/components/DiaryReminderSettings.tsx`

**Interfaces:**
- Consumes: `useTheme`, `tokens`
- Produces: `export function SectionHeading(props: { children: string }): JSX.Element;`

- [ ] **Step 1: `SectionHeading.tsx` schreiben**

Die Werte stammen aus `sectionTitle` in `app/(tabs)/einstellungen/index.tsx` — dort nachschlagen und übernehmen, falls sie von den folgenden abweichen:

```tsx
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { tokens } from '../../styles/tokens';
import type { ThemeColors } from '../../theme/types';

interface SectionHeadingProps {
  children: string;
}

export function SectionHeading({ children }: SectionHeadingProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return <Text style={styles.heading}>{children}</Text>;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    heading: {
      color: colors.textPrimary,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      marginTop: tokens.spacing.lg,
      marginBottom: tokens.spacing.sm,
    },
  });
}
```

- [ ] **Step 2: Den Einstellungen-Bildschirm umstellen**

In `app/(tabs)/einstellungen/index.tsx`:

1. Import ergänzen: `import { SectionHeading } from '../../../src/components/ui/SectionHeading';` — den relativen Pfad an die vorhandenen Imports der Datei anpassen.
2. Jedes `<Text style={styles.sectionTitle}>…</Text>` durch `<SectionHeading>…</SectionHeading>` ersetzen.
3. Den nun unbenutzten Eintrag `sectionTitle` aus `makeStyles` entfernen.

Alle übrigen Stile der Datei bleiben unverändert. Prüfe mit

```bash
grep -n "sectionTitle" "app/(tabs)/einstellungen/index.tsx"
```

Erwartet: keine Treffer mehr.

- [ ] **Step 3: `DiaryReminderSettings` auf denselben Baustein bringen**

In `src/features/diary/components/DiaryReminderSettings.tsx`:

1. Import ergänzen: `import { SectionHeading } from '../../../components/ui/SectionHeading';`
2. `<Text style={styles.heading}>Tägliche Erinnerung</Text>` ersetzen durch `<SectionHeading>Tägliche Erinnerung</SectionHeading>`
3. Den Eintrag `heading` aus `makeStyles` entfernen.

- [ ] **Step 4: Typprüfung und Testlauf**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe. Meldet TypeScript einen unbenutzten Import `Text` in `DiaryReminderSettings.tsx`, prüfe zuerst, ob `Text` dort noch anderweitig verwendet wird — es wird für `rowLabel`, `hint` und `errorText` gebraucht und darf nicht entfernt werden.

```bash
npm test
```

Erwartet: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SectionHeading.tsx "app/(tabs)/einstellungen/index.tsx" src/features/diary/components/DiaryReminderSettings.tsx
git commit -m "feat: Abschnittsueberschrift als gemeinsamer Baustein"
```

---

### Task 6: Tagebuch umstellen

**Warum:** Der Bereich mit dem meisten Gewinn — hier trägt die Kante den Schweregrad, der in Phase 1 nur als kleine Form neben dem Datum stand.

**Files:**
- Modify: `src/features/diary/components/DiaryHistoryList.tsx`
- Modify: `src/features/diary/components/TriggerAnalysisView.tsx`
- Modify: `src/features/diary/components/DiaryTrendChart.tsx`
- Modify: `app/(tabs)/tagebuch/index.tsx`
- Modify: `app/(tabs)/tagebuch/auswertung.tsx`

**Interfaces:**
- Consumes: `Card` und `CardAccent` aus `src/components/ui/Card`; `EmptyState`; `SkeletonList`
- Produces: `DiaryHistoryList` bekommt eine zusätzliche Pflicht-Prop `onCreate: () => void`. Kein anderer Task ruft diese Komponente auf.

- [ ] **Step 1: Zuordnung Bewertung → Kante in `calendarLogic.ts` ergänzen**

Ans Ende von `src/features/diary/calendarLogic.ts` anhängen:

```typescript
/** Uebersetzt die Tagesbewertung in die Bedeutung der Kartenkante. */
export function accentForRating(rating: DayRating | undefined): CardAccent | undefined {
  if (rating === undefined) {
    return undefined;
  }
  switch (rating) {
    case 'good':
      return 'good';
    case 'medium':
      return 'warning';
    case 'bad':
      return 'danger';
  }
}
```

Dazu oben in derselben Datei ergänzen: `import type { CardAccent } from '../../components/ui/Card';`

`DayRating` ist in Zeile 3 derselben Datei als `'good' | 'medium' | 'bad'` definiert; die drei `case`-Zweige decken den Typ damit vollständig ab. Kein `default` — läuft der `switch` nicht mehr erschöpfend, soll TypeScript das melden.

- [ ] **Step 2: Test für die Zuordnung schreiben**

An `src/features/diary/calendarLogic.test.ts` ein neues `describe` anhängen:

```typescript
describe('accentForRating', () => {
  it('leaves days without a rating without an edge', () => {
    expect(accentForRating(undefined)).toBeUndefined();
  });

  it('maps a flare-suspect day to the danger edge', () => {
    expect(accentForRating('bad')).toBe('danger');
  });

  it('maps a good day to the good edge and a middling one to warning', () => {
    expect(accentForRating('good')).toBe('good');
    expect(accentForRating('medium')).toBe('warning');
  });
});
```

Den Import in derselben Datei um `accentForRating` erweitern.

- [ ] **Step 3: Testlauf, muss durchlaufen**

```bash
npm test -- src/features/diary
```

Erwartet: PASS, drei Tests mehr als vorher.

- [ ] **Step 4: `DiaryHistoryList` umstellen**

In `src/features/diary/components/DiaryHistoryList.tsx`:

Imports ergänzen:
```tsx
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { buildDayRatings, formatDateKey, accentForRating } from '../calendarLogic';
```
(die bestehende `calendarLogic`-Importzeile ersetzen, nicht verdoppeln)

Die Props-Schnittstelle erweitern:
```tsx
interface DiaryHistoryListProps {
  entries: DiaryEntryWithTriggers[];
  onDelete: (entryId: number) => void;
  onCreate: () => void;
}
```
und die Signatur entsprechend: `export function DiaryHistoryList({ entries, onDelete, onCreate }: DiaryHistoryListProps) {`

Den Leerzustand ersetzen:
```tsx
  if (entries.length === 0) {
    return (
      <EmptyState
        title="Dein Tagebuch ist noch leer"
        description="Hier sammeln sich deine Tage — Stuhlgang, Schmerz, Blut und was du dazu notierst. Nach einigen Einträgen zeigt die Auswertung, welche Auslöser mit stärkeren Beschwerden zusammenfallen."
        action={{ label: 'Ersten Eintrag anlegen', onPress: onCreate }}
      />
    );
  }
```

Im `renderItem` das äußere `<View style={styles.card} …>` durch `<Card>` ersetzen und den schließenden Tag mitziehen:
```tsx
        return (
          <Card accent={accentForRating(rating)}>
            <View
              accessibilityRole="text"
              accessibilityLabel={buildCardAccessibilityLabel(item, rating)}
            >
```
… unverändertes Innenleben …
```tsx
            </View>
          </Card>
        );
```

Der `accessibilityRole="text"` und das Label bleiben erhalten, wandern aber auf ein inneres `View`, weil `Card` keine Rollen entgegennimmt.

Aus `makeStyles` entfernen: `card`, `emptyContainer`, `emptyText`. Alles andere bleibt.

In `listContent` ergänzen: `gap: tokens.spacing.md,` — das ersetzt den `marginBottom` der entfernten Kartenkopie.

- [ ] **Step 5: `TriggerAnalysisView` umstellen**

In `src/features/diary/components/TriggerAnalysisView.tsx`:

Imports ergänzen:
```tsx
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
```

Leerzustand ersetzen:
```tsx
  if (patterns.length === 0) {
    return (
      <EmptyState
        title="Noch keine Muster erkennbar"
        description="Sobald du beim Eintragen Auslöser mit erfasst, erscheint hier, welche davon mit stärkeren Beschwerden zusammenfallen."
      />
    );
  }
```

Die Kartenschleife:
```tsx
      {patterns.map((pattern) => (
        <Card key={pattern.category}>
          <Text style={styles.cardTitle}>{labelForCategory(pattern.category)}</Text>
          <Text style={styles.cardDetail}>
            {pattern.entryCount} {pattern.entryCount === 1 ? 'Eintrag' : 'Einträge'}
          </Text>
          <Text style={styles.cardDetail}>Ø Schmerzlevel: {pattern.averagePainLevel}/10</Text>
        </Card>
      ))}
```

Aus `makeStyles` entfernen: `card`, `emptyContainer`, `emptyText`.

In `list` ergänzen: `gap: tokens.spacing.md,`.

Der `View`-Import bleibt, weil `styles.list` weiterhin ein `View` umschließt.

- [ ] **Step 6: `DiaryTrendChart` — Leerzustand ohne Geisterkarte**

In `src/features/diary/components/DiaryTrendChart.tsx` die Zeile mit `Keine Daten in diesem Zeitraum.` ersetzen. Sie steht heute innerhalb einer umgebenden Ansicht; ersetze nur den `<Text style={styles.emptyText}>…</Text>` durch:

```tsx
        <EmptyState
          title="Keine Daten in diesem Zeitraum"
          description="Wähle einen anderen Zeitraum, oder erfasse Einträge für diese Tage."
          showGhost={false}
        />
```

Import ergänzen: `import { EmptyState } from '../../../components/ui/EmptyState';`
`emptyText` aus `makeStyles` entfernen, sofern es nirgends sonst benutzt wird — mit `grep -n "emptyText" src/features/diary/components/DiaryTrendChart.tsx` prüfen.

`showGhost={false}`, weil hier nichts durch Anlegen entsteht: Der Nutzer muss den Zeitraum wechseln.

- [ ] **Step 7: Ladeskelette in den beiden Tagebuch-Bildschirmen**

In `app/(tabs)/tagebuch/index.tsx` diesen Block:
```tsx
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Einträge werden geladen …</Text>
        </View>
      ) : viewMode === 'list' ? (
        <DiaryHistoryList entries={entries} onDelete={handleDelete} />
```
ersetzen durch:
```tsx
      {isLoading ? (
        <SkeletonList count={3} lines={3} />
      ) : viewMode === 'list' ? (
        <DiaryHistoryList
          entries={entries}
          onDelete={handleDelete}
          onCreate={() => router.push('/tagebuch/neu')}
        />
```

Import ergänzen: `import { SkeletonList } from '../../../src/components/ui/SkeletonList';` — den relativen Pfad an die vorhandenen Imports der Datei anpassen. Prüfe, dass `router` in dieser Datei bereits vorhanden ist (`const router = useRouter()`); falls nicht, ergänze es nach dem Muster der anderen Bildschirme.

In `app/(tabs)/tagebuch/auswertung.tsx`:
```tsx
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Auswertung wird geladen …</Text>
        </View>
      ) : (
```
ersetzen durch:
```tsx
      {isLoading ? (
        <SkeletonList count={2} lines={2} />
      ) : (
```
mit demselben Import.

In beiden Dateien danach `loadingContainer` und `loadingText` aus `makeStyles` entfernen, sofern `grep -n "loadingContainer\|loadingText" <datei>` keine weiteren Treffer zeigt.

- [ ] **Step 8: Typprüfung und vollständiger Testlauf**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe. Meldet TypeScript einen unbenutzten Import (`Text`, `View`), entferne genau diesen Import — aber erst nachdem `grep` bestätigt hat, dass er wirklich nirgends mehr vorkommt.

```bash
npm test
```

Erwartet: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/diary "app/(tabs)/tagebuch"
git commit -m "feat: Tagebuch auf Karte, Leerzustand und Ladeskelett umstellen"
```

---

### Task 7: Medikamente und Arztbesuche umstellen

**Warum:** Zwei Listen mit demselben Zustandsmuster — laufend gegen beendet, künftig gegen vergangen. Sie zusammen umzustellen hält die Entscheidung an einer Stelle.

**Files:**
- Modify: `src/features/medications/components/MedicationList.tsx`
- Modify: `src/features/doctorVisits/components/DoctorVisitList.tsx`
- Modify: `app/(tabs)/medikamente/index.tsx`
- Modify: `app/(tabs)/tagebuch/arztbesuche/index.tsx`

**Interfaces:**
- Consumes: `Card`, `EmptyState`, `SkeletonList`
- Produces: `MedicationList` bekommt `onCreate: () => void`, `DoctorVisitList` bekommt `onCreate: () => void`.

- [ ] **Step 1: `MedicationList` umstellen**

In `src/features/medications/components/MedicationList.tsx`:

Imports ergänzen:
```tsx
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
```

Props erweitern um `onCreate: () => void;` und in der Signatur aufnehmen.

Leerzustand ersetzen:
```tsx
  if (medications.length === 0) {
    return (
      <EmptyState
        title="Noch keine Medikamente hinterlegt"
        description="Trage ein, was du nimmst — Dosis, Zeitplan und Erinnerungszeiten. Die App meldet sich dann von selbst zur richtigen Zeit."
        action={{ label: 'Erstes Medikament anlegen', onPress: onCreate }}
      />
    );
  }
```

Im `renderItem` das äußere Element ersetzen:
```tsx
          <Card accent={isActive ? 'good' : 'neutral'} isMuted={!isActive}>
```
und den schließenden `</View>` des äußeren Elements durch `</Card>`. Das Innenleben bleibt unverändert.

Aus `makeStyles` entfernen: `card`, `cardEnded`, `emptyContainer`, `emptyText`.

In `listContent` ergänzen: `gap: tokens.spacing.md,`.

`accent="good"` für laufende, `accent="neutral"` für beendete Medikamente; `isMuted` übernimmt, was bisher `cardEnded` tat.

- [ ] **Step 2: `DoctorVisitList` umstellen**

In `src/features/doctorVisits/components/DoctorVisitList.tsx`:

Imports ergänzen:
```tsx
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
```

Props erweitern um `onCreate: () => void;`.

Leerzustand ersetzen:
```tsx
  if (visits.length === 0) {
    return (
      <EmptyState
        title="Noch keine Arztbesuche erfasst"
        description="Halte fest, wann du bei wem warst und worum es ging. Vor dem nächsten Termin hast du dann alles beisammen."
        action={{ label: 'Ersten Besuch anlegen', onPress: onCreate }}
      />
    );
  }
```

Die Karte ist hier ein `Pressable` und muss eines bleiben — `Card` nimmt keine Berührungen entgegen. Setze `Card` **innerhalb** des `Pressable` und nimm dem `Pressable` seinen Stil:

```tsx
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Arztbesuch vom ${formatGermanDate(item.visitDate)} bearbeiten`}
          onPress={() => onEdit(item.id)}
        >
          <Card accent="neutral">
```
… unverändertes Innenleben …
```tsx
          </Card>
        </Pressable>
      )}
```

Aus `makeStyles` entfernen: `card`, `emptyContainer`, `emptyText`.

In `listContent` ergänzen: `gap: tokens.spacing.md,`.

- [ ] **Step 3: Dieselbe Behandlung für die anderen berührbaren Karten prüfen**

`MedicationList` benutzt kein `Pressable` als Karte — dort bleibt es bei Step 1. Prüfe das mit:

```bash
grep -n "styles.card" src/features/medications/components/MedicationList.tsx src/features/doctorVisits/components/DoctorVisitList.tsx
```

Erwartet: keine Treffer mehr.

- [ ] **Step 4: Ladeskelette und die neuen Props in den Bildschirmen**

In `app/(tabs)/medikamente/index.tsx`:
```tsx
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Medikamente werden geladen …</Text>
        </View>
      ) : (
        <MedicationList
          medications={medications}
          today={new Date()}
```
ersetzen durch:
```tsx
      {isLoading ? (
        <SkeletonList count={3} lines={2} />
      ) : (
        <MedicationList
          onCreate={() => router.push('/medikamente/neu')}
          medications={medications}
          today={new Date()}
```

In `app/(tabs)/tagebuch/arztbesuche/index.tsx`:
```tsx
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Arztbesuche werden geladen …</Text>
        </View>
      ) : (
        <DoctorVisitList
          visits={visits}
```
ersetzen durch:
```tsx
      {isLoading ? (
        <SkeletonList count={3} lines={2} />
      ) : (
        <DoctorVisitList
          onCreate={() => router.push('/tagebuch/arztbesuche/neu')}
          visits={visits}
```

In beiden Dateien den `SkeletonList`-Import ergänzen (relativen Pfad an die Datei anpassen) und danach `loadingContainer` und `loadingText` aus `makeStyles` entfernen, sofern `grep` keine weiteren Treffer zeigt.

Prüfe in beiden Dateien, dass `router` bereits vorhanden ist, und dass die Zielrouten existieren:

```bash
ls "app/(tabs)/medikamente/neu.tsx" "app/(tabs)/tagebuch/arztbesuche/neu.tsx"
```

Erwartet: beide Dateien werden aufgelistet.

- [ ] **Step 5: Typprüfung und Testlauf**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe.

```bash
npm test
```

Erwartet: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/medications src/features/doctorVisits "app/(tabs)/medikamente" "app/(tabs)/tagebuch/arztbesuche"
git commit -m "feat: Medikamente und Arztbesuche auf die gemeinsame Karte umstellen"
```

---

### Task 8: Wissen und Neuigkeiten umstellen

**Warum:** Der letzte Bereich. Hier sitzt zugleich der einzige Leerzustand der zweiten Art, der eine eigene Behandlung braucht: „Keine Artikel gefunden" ist keine leere Liste, sondern eine ergebnislose Suche.

**Files:**
- Modify: `src/features/newsFeed/components/NewsFeedList.tsx`
- Modify: `src/features/knowledge/components/KnowledgeArticleList.tsx`
- Modify: `app/(tabs)/wissen/feed.tsx`
- Modify: `app/(tabs)/wissen/index.tsx`

**Interfaces:**
- Consumes: `Card`, `EmptyState`, `SkeletonList`
- Produces: `KnowledgeArticleList` tauscht die Prop `emptyMessage?: string` gegen `emptyVariant?: 'search' | 'favorites'` (Vorgabe `'search'`). Kein anderer Task ruft diese Komponente auf.

- [ ] **Step 1: `NewsFeedList` umstellen**

In `src/features/newsFeed/components/NewsFeedList.tsx`:

Imports ergänzen:
```tsx
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
```

Leerzustand ersetzen:
```tsx
  if (items.length === 0) {
    return (
      <EmptyState
        title="Noch keine Neuigkeiten"
        description="Sobald neue Beiträge aus den hinterlegten Quellen eintreffen, erscheinen sie hier."
      />
    );
  }
```

Kein Knopf: Es gibt hier nichts anzulegen, die Beiträge kommen von außen. Die Geisterkarte bleibt, weil hier tatsächlich Inhalt dieser Form entstehen wird.

Die Karte ist ein `Pressable` und bleibt eines; `Card` kommt hinein:
```tsx
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Neuigkeit: ${item.title}${item.isRead ? ' (bereits gelesen)' : ''}`}
          onPress={() => onSelect(item)}
        >
          <Card accent={item.isRead ? undefined : 'info'} isMuted={item.isRead}>
            <Text style={[styles.cardTitle, item.isRead && styles.textRead]}>{item.title}</Text>
            <Text style={[styles.cardSummary, item.isRead && styles.textRead]}>{item.summaryDe}</Text>
            <Text style={styles.cardMeta}>
              {sourceLabelFor(item.source)} · {item.publishedDate}
            </Text>
          </Card>
        </Pressable>
      )}
```

Aus `makeStyles` entfernen: `card`, `cardRead`, `emptyContainer`, `emptyText`. `textRead` bleibt.

In `listContent` ergänzen: `gap: tokens.spacing.md,`.

Ungelesen bekommt die Kante, gelesen keine — die Kante markiert hier das, was noch Aufmerksamkeit braucht.

**`cardSummary` bleibt bewusst auf `colors.textPrimary`**, obwohl die übrigen Karten ihr Detail in `colors.textSecondary` setzen. Die Zusammenfassung eines Beitrags ist hier der eigentliche Inhalt, nicht Beiwerk. Das ist die einzige gewollte Abweichung von der Abstufung Titel/Detail.

- [ ] **Step 2: `KnowledgeArticleList` umstellen**

In `src/features/knowledge/components/KnowledgeArticleList.tsx`:

Imports ergänzen:
```tsx
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
```

Die Konstante `DEFAULT_EMPTY_MESSAGE` löschen und die Props ändern:
```tsx
interface KnowledgeArticleListProps {
  articles: KnowledgeArticle[];
  onSelect: (slug: string) => void;
  emptyVariant?: 'search' | 'favorites';
}
```
Signatur: `export function KnowledgeArticleList({ articles, onSelect, emptyVariant = 'search' }: KnowledgeArticleListProps) {`

Leerzustand ersetzen:
```tsx
  if (articles.length === 0) {
    return emptyVariant === 'favorites' ? (
      <EmptyState
        title="Noch keine Favoriten"
        description="Markiere einen Artikel als Favorit, dann findest du ihn hier ohne Suchen wieder."
      />
    ) : (
      <EmptyState
        title="Keine Artikel gefunden"
        description="Versuch es mit einem anderen Suchbegriff."
        showGhost={false}
      />
    );
  }
```

Bei `'favorites'` bleibt die Geisterkarte, weil hier durch Markieren tatsächlich Inhalt entsteht. Bei `'search'` nicht: Da gibt es nichts anzulegen, der Suchbegriff muss sich ändern.

Die Karte ist ein `Pressable` und bleibt eines:
```tsx
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Artikel: ${item.title}`}
          onPress={() => onSelect(item.slug)}
        >
          <Card>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardTeaser}>{teaserFor(item.body)}</Text>
          </Card>
        </Pressable>
      )}
```

Aus `makeStyles` entfernen: `card`, `emptyContainer`, `emptyText`.

In `listContent` ergänzen: `gap: tokens.spacing.md,`.

Keine Kante: Ein Wissensartikel hat keinen Zustand.

- [ ] **Step 3: Die beiden Bildschirme umstellen**

In `app/(tabs)/wissen/feed.tsx`:
```tsx
      {isLoading && items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Neuigkeiten werden geladen …</Text>
        </View>
      ) : (
```
ersetzen durch:
```tsx
      {isLoading && items.length === 0 ? (
        <SkeletonList count={3} lines={3} />
      ) : (
```

In `app/(tabs)/wissen/index.tsx`:
```tsx
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Artikel werden geladen …</Text>
        </View>
      ) : (
        <KnowledgeArticleList
          articles={visibleArticles}
          onSelect={(slug) => router.push(`/wissen/${slug}`)}
          emptyMessage={viewFilter === 'favorites' ? 'Noch keine Favoriten markiert.' : undefined}
        />
      )}
```
ersetzen durch:
```tsx
      {isLoading ? (
        <SkeletonList count={4} lines={2} />
      ) : (
        <KnowledgeArticleList
          articles={visibleArticles}
          onSelect={(slug) => router.push(`/wissen/${slug}`)}
          emptyVariant={viewFilter === 'favorites' ? 'favorites' : 'search'}
        />
      )}
```

In beiden Dateien den `SkeletonList`-Import ergänzen und danach `loadingContainer` und `loadingText` aus `makeStyles` entfernen, sofern `grep` keine weiteren Treffer zeigt.

- [ ] **Step 4: Prüfen, dass keine Kartenkopie übrig ist**

```bash
grep -rn "borderRadius: 12" --include=*.tsx app src
```

Erwartet: keine Treffer. Falls doch, sind es Elemente, die keine Karten sind (Knöpfe, Abzeichen) — dann `tokens.radius.md` einsetzen statt der Zahl, aber nicht auf `Card` umstellen.

```bash
grep -rln "backgroundColor: colors.surface" --include=*.tsx app src | wc -l
```

Erwartet: deutlich weniger als die 36 Dateien vom Anfang. Die verbleibenden sind Formulare, Modale und Banner, die dieser Plan bewusst nicht anfasst.

- [ ] **Step 5: Typprüfung und vollständiger Testlauf**

```bash
npx.cmd tsc --noEmit
```

Erwartet: keine Ausgabe.

```bash
npm test
```

Erwartet: PASS, mindestens 463 Tests plus die in Task 1, 2 und 6 hinzugekommenen.

- [ ] **Step 6: Commit**

```bash
git add src/features/newsFeed src/features/knowledge "app/(tabs)/wissen"
git commit -m "feat: Wissen und Neuigkeiten auf die gemeinsame Karte umstellen"
```

---

## Abnahme auf dem Gerät

Im Testlauf nicht nachbildbar. Nach dem Merge und einem Build zu prüfen:

1. **Tagebuch-Liste:** Jeder Eintrag hat links eine Kante in der Farbe seiner Tagesbewertung. Form und Wort stehen unverändert daneben.
2. **Kante gegen Kalender:** Ein Tag, der im Kalender als schub-verdächtig gilt, hat in der Liste die rote Kante.
3. **Leeres Tagebuch:** Geisterkarte, Überschrift, Erklärung, Knopf. Der Knopf führt zum Eintrags-Formular.
4. **Ladeskelett:** Beim Öffnen des Tagebuchs erscheinen kurz drei Platzhalterkarten, kein Text. Nichts bewegt sich.
5. **Wissens-Suche:** Ein Suchbegriff ohne Treffer zeigt „Keine Artikel gefunden" **ohne** Geisterkarte und ohne Knopf.
6. **Favoriten ohne Einträge:** zeigt Geisterkarte, aber ebenfalls keinen Knopf.
7. **Medikamente:** Laufende haben eine grüne Kante, beendete eine graue und sind gedämpft.
8. **Neuigkeiten:** Ungelesene haben eine orange Kante, gelesene keine und sind gedämpft.
9. **Dunkles Theme:** Karten haben einen sichtbaren Rand und keinen Schatten. Die Kanten sind erkennbar.
10. **Helles und hellblaues Theme:** Karten liegen mit Schatten auf dem Hintergrund und haben keinen Rand.
11. **Guter Tag gegen Knopf:** Der grüne Punkt eines guten Tages hat erkennbar eine andere Farbe als die Knöpfe der App.
12. **Einstellungen:** Alle Abschnittsüberschriften sehen gleich aus, auch „Tägliche Erinnerung".
13. **Offene Punkte aus Phase 1** (Abnahmepunkte 9 bis 11 aus `2026-08-20-colitis-app-erinnerung-schweregrad.md`) im selben Durchgang miterledigen.

## Was dieser Plan nicht anfasst

- Formulare, Modale und Banner über die Kartenform hinaus
- Bewegung jeder Art — gehört zu Phase 3
- Die drei Detail-Ladezustände (`medikamente/[id]`, `arztbesuche/[id]`, `wissen/[slug]`) und die zwei Sonderfälle (`_layout.tsx`, `tagebuch/schnell.tsx`)
- `DiaryCalendarView` — die Kalenderzellen sind keine Karten
- Der Fahrplan-Widerspruch zu Phase 4 (Medikamenteneinnahme ist teilweise schon gebaut). Nach Phase 2 zu klären.
