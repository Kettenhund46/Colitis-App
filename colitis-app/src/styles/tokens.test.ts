import { describe, it, expect } from 'vitest';
import { tokens } from './tokens';

describe('design tokens', () => {
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
