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
      // Nicht colors.border: Im dunklen Theme umgibt genau dieser Ton die
      // Karte, die Kante waere dort nur ein dickerer Rahmen.
      return colors.borderStrong;
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
