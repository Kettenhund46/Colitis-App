import { describe, it, expect } from 'vitest';
import { palettes } from './palettes';

const COLOR_PATTERN = /^(#[0-9A-Fa-f]{6}|rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\))$/;

describe('theme palettes', () => {
  Object.entries(palettes).forEach(([themeId, colors]) => {
    describe(themeId, () => {
      it('defines a hex or rgba value for every color token', () => {
        Object.values(colors).forEach((value) => {
          expect(value).toMatch(COLOR_PATTERN);
        });
      });

      it('does not use pure alarm red as the primary or accent color', () => {
        expect(colors.primary.toUpperCase()).not.toBe('#FF0000');
        expect(colors.accent.toUpperCase()).not.toBe('#FF0000');
      });
    });
  });

  it('defines exactly the same color keys across all themes', () => {
    const [firstKeys, ...restKeys] = Object.values(palettes).map((colors) => Object.keys(colors).sort());
    restKeys.forEach((keys) => {
      expect(keys).toEqual(firstKeys);
    });
  });

  it('does not reuse the same accent color across different themes', () => {
    const accentColors = Object.values(palettes).map((colors) => colors.accent.toUpperCase());
    expect(new Set(accentColors).size).toBe(accentColors.length);
  });
});
