import { describe, it, expect } from 'vitest';
import { tokens } from './tokens';

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const RGBA_COLOR_PATTERN = /^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/;
const COLOR_PATTERN = /^(#[0-9A-Fa-f]{6}|rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\))$/;

describe('design tokens', () => {
  it('defines a hex or rgba value for every color token', () => {
    Object.values(tokens.colors).forEach((value) => {
      expect(value).toMatch(COLOR_PATTERN);
    });
  });

  it('does not use pure alarm red as the primary or accent color', () => {
    expect(tokens.colors.primary.toUpperCase()).not.toBe('#FF0000');
    expect(tokens.colors.accent.toUpperCase()).not.toBe('#FF0000');
  });

  it('defines a strictly increasing spacing scale', () => {
    const values = Object.values(tokens.spacing);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('defines a strictly increasing font size scale', () => {
    const values = Object.values(tokens.typography.fontSize);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});
