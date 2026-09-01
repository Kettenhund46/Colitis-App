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
    expect(accentColorFor('neutral', colors)).toBe(colors.borderStrong);
  });

  it('keeps the neutral edge apart from the card outline in every theme', () => {
    // Im dunklen Theme umgibt colors.border die Karte; waere die Kante
    // derselbe Ton, bliebe sie nur ein dickerer Rahmen.
    for (const palette of Object.values(palettes)) {
      expect(accentColorFor('neutral', palette)).not.toBe(palette.border);
    }
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
